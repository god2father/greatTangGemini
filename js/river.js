/**
 * 金色粒子河流系统
 * GPU 驱动粒子流动 + 环境沙尘 + 打散效果
 */
import * as THREE from 'three';

// --- 配置 ---
const RIVER_PARTICLE_COUNT = 24000;
const DUST_PARTICLE_COUNT = 4000;
const CURVE_RESOLUTION = 512;
const RIVER_WIDTH = 25.0;
const RIVER_DEPTH = 5.0;
const FLOW_SPEED = 0.012;

// --- 内部状态 ---
let riverMaterial, dustMaterial;
let curveTexture;
let scatterTarget = 0;  // 0 = 正常, 1 = 打散
let scatterCurrent = 0;

/**
 * 创建河流曲线
 */
function createCurve() {
  const points = [
    new THREE.Vector3(-65, 0, 3),
    new THREE.Vector3(-48, 1.8, -4),
    new THREE.Vector3(-30, -0.5, 5),
    new THREE.Vector3(-12, 1.2, -2),
    new THREE.Vector3(8, -0.8, 3),
    new THREE.Vector3(25, 1.5, -3),
    new THREE.Vector3(42, -0.3, 4),
    new THREE.Vector3(60, 0.5, -1),
    new THREE.Vector3(75, 0, 2),
  ];
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
}

/**
 * 将曲线烘焙到 DataTexture 供 GPU 采样
 */
function bakeCurveTexture(curve) {
  const data = new Float32Array(CURVE_RESOLUTION * 4);
  for (let i = 0; i < CURVE_RESOLUTION; i++) {
    const t = i / (CURVE_RESOLUTION - 1);
    const pt = curve.getPointAt(t);
    data[i * 4 + 0] = pt.x;
    data[i * 4 + 1] = pt.y;
    data[i * 4 + 2] = pt.z;
    data[i * 4 + 3] = 1.0;
  }
  const tex = new THREE.DataTexture(data, CURVE_RESOLUTION, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function gaussRand() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * 创建河流粒子系统
 */
function createRiverParticles(scene, curve) {
  curveTexture = bakeCurveTexture(curve);

  const baseT = new Float32Array(RIVER_PARTICLE_COUNT);
  const offsets = new Float32Array(RIVER_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(RIVER_PARTICLE_COUNT);
  const opacities = new Float32Array(RIVER_PARTICLE_COUNT);
  const speedVars = new Float32Array(RIVER_PARTICLE_COUNT);
  const scatterDirs = new Float32Array(RIVER_PARTICLE_COUNT * 3); // 打散方向
  const positions = new Float32Array(RIVER_PARTICLE_COUNT * 3);

  const up = new THREE.Vector3(0, 1, 0);
  const perp1 = new THREE.Vector3();
  const perp2 = new THREE.Vector3();

  for (let i = 0; i < RIVER_PARTICLE_COUNT; i++) {
    const t = Math.random();
    baseT[i] = t;

    const tangent = curve.getTangentAt(t);
    perp1.crossVectors(tangent, up).normalize();
    perp2.crossVectors(tangent, perp1).normalize();

    const r1 = gaussRand() * RIVER_WIDTH * 0.4;
    const r2 = gaussRand() * RIVER_DEPTH * 0.35;

    offsets[i * 3 + 0] = perp1.x * r1 + perp2.x * r2;
    offsets[i * 3 + 1] = perp1.y * r1 + perp2.y * r2;
    offsets[i * 3 + 2] = perp1.z * r1 + perp2.z * r2;

    const distFromCenter = Math.abs(r1) / (RIVER_WIDTH * 0.4);
    sizes[i] = (1.0 + Math.random() * 2.0) * (1.0 - distFromCenter * 0.4);
    opacities[i] = (0.15 + Math.random() * 0.45) * (1.0 - distFromCenter * 0.5);
    speedVars[i] = (Math.random() - 0.5) * 0.6;

    // 打散方向：向外扩散
    const scatterAngle = Math.random() * Math.PI * 2;
    const scatterDist = 8 + Math.random() * 20;
    scatterDirs[i * 3 + 0] = Math.cos(scatterAngle) * scatterDist;
    scatterDirs[i * 3 + 1] = (Math.random() - 0.3) * scatterDist * 0.6;
    scatterDirs[i * 3 + 2] = Math.sin(scatterAngle) * scatterDist;

    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBaseT', new THREE.BufferAttribute(baseT, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aSpeedVar', new THREE.BufferAttribute(speedVars, 1));
  geometry.setAttribute('aScatterDir', new THREE.BufferAttribute(scatterDirs, 3));

  riverMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: FLOW_SPEED },
      uCurveTexture: { value: curveTexture },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uScatter: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform sampler2D uCurveTexture;
      uniform float uPixelRatio;
      uniform float uScatter;

      attribute float aBaseT;
      attribute vec3 aOffset;
      attribute float aSize;
      attribute float aOpacity;
      attribute float aSpeedVar;
      attribute vec3 aScatterDir;

      varying float vOpacity;
      varying float vDistFactor;

      void main() {
        float t = fract(aBaseT + uTime * uFlowSpeed * (1.0 + aSpeedVar));

        float edgeFade = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.96, t);

        vec3 curvePos = texture2D(uCurveTexture, vec2(t, 0.5)).xyz;
        vec3 pos = curvePos + aOffset;

        pos.y += sin(uTime * 0.5 + aBaseT * 20.0) * 0.08;
        pos.x += cos(uTime * 0.3 + aBaseT * 15.0) * 0.05;

        // 打散效果：沿 scatter 方向偏移
        pos += aScatterDir * uScatter;

        // 打散时降低透明度
        float scatterFade = 1.0 - uScatter * 0.7;

        vOpacity = aOpacity * edgeFade * scatterFade;
        vDistFactor = length(aOffset) / ${RIVER_WIDTH.toFixed(1)};

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (180.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 0.5, 30.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying float vDistFactor;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float alpha = smoothstep(0.5, 0.05, dist) * vOpacity * 0.35;

        vec3 coreColor = vec3(0.75, 0.6, 0.32);
        vec3 edgeColor = vec3(0.5, 0.35, 0.14);
        vec3 color = mix(coreColor, edgeColor, vDistFactor);

        color += 0.03 * fract(sin(dot(gl_PointCoord, vec2(12.9898, 78.233))) * 43758.5453);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const riverParticles = new THREE.Points(geometry, riverMaterial);
  scene.add(riverParticles);
}

/**
 * 创建环境沙尘粒子
 */
function createDustParticles(scene) {
  const positions = new Float32Array(DUST_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(DUST_PARTICLE_COUNT);
  const opacities = new Float32Array(DUST_PARTICLE_COUNT);
  const driftSpeeds = new Float32Array(DUST_PARTICLE_COUNT * 3);

  for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 160;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

    sizes[i] = 0.5 + Math.random() * 1.5;
    opacities[i] = 0.02 + Math.random() * 0.08;

    driftSpeeds[i * 3 + 0] = (Math.random() - 0.5) * 0.3;
    driftSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
    driftSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aDriftSpeed', new THREE.BufferAttribute(driftSpeeds, 3));

  dustMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;

      attribute float aSize;
      attribute float aOpacity;
      attribute vec3 aDriftSpeed;

      varying float vOpacity;

      void main() {
        vec3 pos = position + aDriftSpeed * uTime;

        pos.x = mod(pos.x + 80.0, 160.0) - 80.0;
        pos.y = mod(pos.y + 20.0, 40.0) - 20.0;
        pos.z = mod(pos.z + 30.0, 60.0) - 30.0;

        vOpacity = aOpacity;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * uPixelRatio * (100.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 0.3, 8.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vOpacity;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
        vec3 color = vec3(0.85, 0.7, 0.4);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const dustParticles = new THREE.Points(geometry, dustMaterial);
  scene.add(dustParticles);
}

/**
 * 在河流路径上添加淡金色点光源
 */
function createRiverLights(scene, curve) {
  const lightCount = 5;
  for (let i = 0; i < lightCount; i++) {
    const t = (i + 0.5) / lightCount;
    const pos = curve.getPointAt(t);
    const light = new THREE.PointLight(0xd4a44c, 0.4, 30, 2);
    light.position.copy(pos);
    light.position.y += 3;
    scene.add(light);
  }
}

// --- 公开 API ---

export function createRiver(scene) {
  const curve = createCurve();
  createRiverParticles(scene, curve);
  createDustParticles(scene);
  createRiverLights(scene, curve);
  return curve;
}

export function updateRiver(elapsedTime) {
  // 平滑过渡打散值
  scatterCurrent += (scatterTarget - scatterCurrent) * 0.03;

  if (riverMaterial) {
    riverMaterial.uniforms.uTime.value = elapsedTime;
    riverMaterial.uniforms.uScatter.value = scatterCurrent;
  }
  if (dustMaterial) {
    dustMaterial.uniforms.uTime.value = elapsedTime;
  }
}

/**
 * 触发粒子打散
 */
export function setScatter(scattered) {
  scatterTarget = scattered ? 1 : 0;
}
