/**
 * 唐诗时光长河 — 主入口
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createRiver, updateRiver, setScatter } from './river.js';
import { createNodes, updateNodes, highlightNode, resetNodes, getSelectedIndex } from './nodes.js';
import { initPanel, showPanel, hidePanel, isPanelOpen } from './panel.js';
import { poets } from './poets.js';

// ===================== 场景初始化 =====================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080604);
scene.fog = new THREE.FogExp2(0x080604, 0.007);

// --- 相机 ---
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 250
);
camera.position.set(0, 28, 45);
camera.lookAt(0, 0, 0);

// --- 渲染器 ---
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// --- 后处理 ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.2,   // strength
  0.4,   // radius
  0.6    // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// --- 控制器 ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.minDistance = 8;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * 0.78;
controls.minPolarAngle = Math.PI * 0.1;
controls.enablePan = true;
controls.panSpeed = 0.5;
controls.rotateSpeed = 0.4;
controls.zoomSpeed = 0.8;

// --- 灯光 ---
const ambientLight = new THREE.AmbientLight(0x998866, 0.25);
scene.add(ambientLight);

const topLight = new THREE.DirectionalLight(0xd4a44c, 0.15);
topLight.position.set(0, 30, 0);
scene.add(topLight);

// ===================== 创建场景元素 =====================

const curve = createRiver(scene);
const { clickTargets } = createNodes(scene, curve, poets);

initPanel(() => {
  // 关闭面板回调 → 恢复节点 & 粒子
  resetNodes();
  setScatter(false);
});

// ===================== 射线检测与点击 =====================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', onCanvasClick);

function onCanvasClick(event) {
  // 如果面板已打开，不处理画布点击（面板有自己的关闭逻辑）
  if (isPanelOpen()) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickTargets, false);

  if (intersects.length > 0) {
    const target = intersects[0].object;
    const poet = target.userData.poet;
    const idx = target.userData.index;

    highlightNode(idx);
    setScatter(true);   // 打散粒子
    showPanel(poet);
  }
}

// ===================== 窗口自适应 =====================

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
});

// ===================== 加载过渡 =====================

const loadingScreen = document.getElementById('loading-screen');

setTimeout(() => {
  loadingScreen.classList.add('fade-out');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 1600);
}, 3000);

setTimeout(() => {
  const hint = document.getElementById('hint');
  if (hint) hint.classList.add('hidden');
}, 12000);

// ===================== 动画循环 =====================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  controls.update();
  updateRiver(elapsed);
  updateNodes(camera, elapsed);
  composer.render();
}

animate();
