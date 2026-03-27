/**
 * 诗人节点、引线与标签管理
 */
import * as THREE from 'three';
import { YEAR_START, YEAR_END } from './poets.js';

// --- 内部状态 ---
let allNodes = [];          // { sprite, clickTarget, line, labelEl, labelPos3D, poet, index }
let selectedIndex = -1;
let glowTexture = null;
let labelsContainer = null;

/**
 * 创建发光纹理（Canvas 径向渐变）
 */
function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 240, 180, 0.95)');
  gradient.addColorStop(0.4, 'rgba(220, 170, 50, 0.35)');
  gradient.addColorStop(0.7, 'rgba(180, 130, 30, 0.1)');
  gradient.addColorStop(1, 'rgba(150, 100, 20, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 年份 → 曲线 t 值 (0~1)
 */
function yearToT(year) {
  return (year - YEAR_START) / (YEAR_END - YEAR_START);
}

/**
 * 创建所有诗人节点
 */
export function createNodes(scene, curve, poets) {
  glowTexture = createGlowTexture();
  labelsContainer = document.getElementById('labels-container');

  const clickTargets = [];
  const labelHeight = 3.5;

  poets.forEach((poet, index) => {
    const t = yearToT(poet.birthYear);
    const pos = curve.getPointAt(Math.min(Math.max(t, 0.01), 0.99));

    // 计算切线方向和垂直方向，以便将光点在河流两岸错落排开
    const tangent = curve.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // 偶数向左，奇数向右，偏移距离在河流宽度内（长河宽度约 25，所以偏移可达 10）
    const side = (index % 2 === 0 ? 1 : -1);
    const offsetAmount = 4.0 + Math.random() * 6.0; 
    pos.add(right.multiplyScalar(side * offsetAmount));

    // 高低错落
    pos.y += (Math.random() - 0.5) * 3.0;

    // 五颜六色的随机发光颜色 (使用 HSL 确保它总是明亮且色彩饱和)
    const randomHue = Math.random();
    const nodeColor = new THREE.Color().setHSL(randomHue, 0.8, 0.65);

    // --- 发光精灵 ---
    const spriteMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: nodeColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.userData = { poet, index };
    scene.add(sprite);

    // --- 不可见点击目标（球体） ---
    const clickGeo = new THREE.SphereGeometry(3.0, 8, 8);
    const clickMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const clickTarget = new THREE.Mesh(clickGeo, clickMat);
    clickTarget.position.copy(pos);
    clickTarget.userData = { poet, index };
    scene.add(clickTarget);
    clickTargets.push(clickTarget);

    // --- 引线 ---
    const lineTop = pos.clone();
    lineTop.y += labelHeight;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([pos, lineTop]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf0d080,
      transparent: true,
      opacity: 0.75,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    // --- HTML 标签 ---
    const labelEl = document.createElement('div');
    labelEl.className = 'poet-label';
    labelEl.textContent = `${poet.birthYear} · ${poet.name}`;
    labelsContainer.appendChild(labelEl);

    const labelPos3D = lineTop.clone();
    labelPos3D.y += 0.5;

    allNodes.push({
      sprite, clickTarget, line, labelEl, labelPos3D, poet, index,
      baseScale: 1.5,
      baseColor: nodeColor,
      baseOpacity: 0.85,
      baseLineOpacity: 0.75,
    });
  });

  return { clickTargets };
}

/**
 * 每帧更新标签位置 & 脉冲动画
 */
export function updateNodes(camera, elapsedTime) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const vec = new THREE.Vector3();

  allNodes.forEach((node, i) => {
    // --- 脉冲动画 ---
    const pulse = 1.0 + 0.08 * Math.sin(elapsedTime * 1.8 + i * 1.3);
    if (selectedIndex === -1 || selectedIndex === i) {
      const scale = node.baseScale * pulse;
      node.sprite.scale.set(scale, scale, 1);
    }

    // --- 投影标签到屏幕 ---
    vec.copy(node.labelPos3D).project(camera);
    if (vec.z > 1 || vec.z < -1) {
      node.labelEl.style.display = 'none';
      return;
    }

    let x = (vec.x * 0.5 + 0.5) * w;
    let y = (-vec.y * 0.5 + 0.5) * h;

    // --- 基于距离的标签缩放 ---
    const dist = camera.position.distanceTo(node.sprite.position);
    // 增加缩放范围，让近处的标签更大，远处的稍小，增强 3D 纵深感
    const scaleFactor = Math.max(0.5, Math.min(1.5, 30 / dist));
    
    node.labelEl.style.display = '';
    node.labelEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scaleFactor})`;
  });
}

/**
 * 高亮选中节点，其他变暗
 */
export function highlightNode(index) {
  selectedIndex = index;
  allNodes.forEach((node, i) => {
    if (i === index) {
      // 选中 → 放大、高亮为纯白
      node.sprite.scale.set(3.0, 3.0, 1);
      node.sprite.material.opacity = 1;
      node.sprite.material.color.set(0xffffff);
      node.line.material.opacity = 0.9;
      node.labelEl.classList.add('highlighted');
      node.labelEl.classList.remove('dimmed');
    } else {
      // 非选中 → 缩小、变暗
      node.sprite.scale.set(1.5, 1.5, 1);
      node.sprite.material.opacity = 0.2;
      node.sprite.material.color.set(0x997744);
      node.line.material.opacity = 0.08;
      node.labelEl.classList.add('dimmed');
      node.labelEl.classList.remove('highlighted');
    }
  });
}

/**
 * 恢复所有节点
 */
export function resetNodes() {
  selectedIndex = -1;
  allNodes.forEach(node => {
    node.sprite.scale.set(node.baseScale, node.baseScale, 1);
    node.sprite.material.opacity = node.baseOpacity;
    node.sprite.material.color.copy(node.baseColor);
    node.line.material.opacity = node.baseLineOpacity;
    node.labelEl.classList.remove('highlighted', 'dimmed');
  });
}

/**
 * 获取选中状态
 */
export function getSelectedIndex() {
  return selectedIndex;
}
