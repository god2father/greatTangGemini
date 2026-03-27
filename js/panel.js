/**
 * 诗人面板 + 诗文打字机展示
 */

let panelOverlay, panelEl, nameEl, courtesyEl, yearsEl, eraEl, bioEl, worksListEl, closeBtn;
let poemDisplay, poemTitle, poemAuthor, poemBody, poemCloseBtn;
let isOpen = false;
let isPoemOpen = false;
let onCloseCallback = null;
let currentPoet = null;
let typewriterTimer = null;

/**
 * 创建飘散的金沙粒子效果
 */
function explodeIntoSand(rect) {
  const sandCount = 400; // 增加粒子数量，使化沙更细腻
  const container = document.body;
  const frag = document.createDocumentFragment();
  const sands = [];
  
  for (let i = 0; i < sandCount; i++) {
    const sand = document.createElement('div');
    sand.className = 'ui-sand-particle';
    
    const startX = rect.left + Math.random() * rect.width;
    const startY = rect.top + Math.random() * rect.height;
    
    sand.style.left = startX + 'px';
    sand.style.top = startY + 'px';
    
    // Varying sizes
    const size = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 2 : 1);
    sand.style.width = size + 'px';
    sand.style.height = size + 'px';
    
    frag.appendChild(sand);
    sands.push(sand);
  }
  container.appendChild(frag);
  
  sands.forEach(sand => {
    // 自然的飘散，像是在水中或风中化去，带有向上的浮力和随机扰动
    const tx = (Math.random() - 0.5) * 200; 
    const ty = (Math.random() - 0.7) * 200; // 更倾向于向上飘散
    const duration = 800 + Math.random() * 1200; // 动画变慢，更自然
    
    sand.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: Math.random() * 0.8 + 0.2 },
      { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
    ], {
      duration: duration,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // ease-out
      fill: 'forwards'
    });
    
    setTimeout(() => { if (sand.parentNode) sand.remove(); }, duration + 50);
  });
}

/**
 * 面板化沙消失动画
 */
function sandDisappear(element, closeLogic) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0) {
    closeLogic();
    return;
  }
  
  explodeIntoSand(rect);
  
  const oldTransition = element.style.transition;
  element.style.transition = 'none';
  
  const currentTransform = window.getComputedStyle(element).transform;
  // If matrix is 'none', use scale(1)
  const baseTransform = currentTransform === 'none' ? 'scale(1)' : currentTransform;
  
  // 面板虚化消散得更慢更柔和
  const anim = element.animate([
    { opacity: 1, filter: 'blur(0px) brightness(1)', transform: baseTransform },
    { opacity: 0, filter: 'blur(15px) brightness(1.5)', transform: `${baseTransform} translateY(10px) scale(0.98)` }
  ], {
    duration: 600,
    easing: 'ease-out',
    fill: 'forwards'
  });
  
  anim.onfinish = () => {
    anim.cancel();
    element.style.transition = oldTransition;
    closeLogic();
  };
}

/**
 * 初始化面板引用与事件
 */
export function initPanel(onClose) {
  panelOverlay = document.getElementById('panel-overlay');
  panelEl = document.getElementById('poet-panel');
  nameEl = document.getElementById('poet-name');
  courtesyEl = document.getElementById('poet-courtesy');
  yearsEl = document.getElementById('poet-years');
  eraEl = document.getElementById('poet-era');
  bioEl = document.getElementById('poet-bio');
  worksListEl = document.getElementById('works-list');
  closeBtn = document.getElementById('panel-close');
  onCloseCallback = onClose;

  poemDisplay = document.getElementById('poem-display');
  poemTitle = document.getElementById('poem-title');
  poemAuthor = document.getElementById('poem-author');
  poemBody = document.getElementById('poem-body');
  poemCloseBtn = document.getElementById('poem-close');

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hidePanel();
  });

  poemCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hidePoemDisplay();
  });

  // 点击 overlay 背景关闭面板
  panelOverlay.addEventListener('click', (e) => {
    if (e.target === panelOverlay) {
      hidePanel();
    }
  });
}

/**
 * 显示诗人面板（屏幕中央）
 */
export function showPanel(poet) {
  currentPoet = poet;

  nameEl.textContent = poet.name;
  courtesyEl.textContent = poet.courtesy ? `字 ${poet.courtesy}` : '';
  yearsEl.textContent = `${poet.birthYear} — ${poet.deathYear}`;
  eraEl.textContent = poet.era;
  bioEl.textContent = poet.brief;

  // 代表作标题列表（可点击）
  worksListEl.innerHTML = '';
  poet.works.forEach((work, idx) => {
    const btn = document.createElement('button');
    btn.className = 'work-title-btn';
    btn.textContent = work.title;
    btn.addEventListener('click', () => {
      showPoemDisplay(work, poet.name);
    });
    worksListEl.appendChild(btn);
  });

  panelOverlay.classList.add('active');
  panelEl.scrollTop = 0;
  isOpen = true;
}

/**
 * 隐藏诗人面板
 */
export function hidePanel() {
  if (!isOpen) return;
  isOpen = false;
  
  // 主面板化沙消失
  sandDisappear(panelEl, () => {
    panelOverlay.classList.remove('active');
    if (onCloseCallback) onCloseCallback();
  });
  
  if (isPoemOpen) {
    hidePoemDisplay();
  }
}

/**
 * 显示诗文（右侧打字机效果）
 */
function showPoemDisplay(work, poetName) {
  // 清除之前的打字机动画
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }

  poemTitle.textContent = work.title;
  poemAuthor.textContent = poetName;
  poemBody.innerHTML = '';

  // 将诗句拆分为列（竖排从右到左）
  // 每一行诗成为一列
  const allChars = [];
  work.lines.forEach(line => {
    const col = document.createElement('div');
    col.className = 'poem-column';

    // 拆分为单字
    const chars = [...line];
    chars.forEach(ch => {
      const span = document.createElement('span');
      span.className = 'poem-char';
      span.textContent = ch;
      col.appendChild(span);
      allChars.push(span);
    });

    poemBody.appendChild(col);
  });

  // 展开诗文面板
  poemDisplay.classList.add('active');
  isPoemOpen = true;

  // 打字机效果：逐字显示
  let charIndex = 0;
  const totalChars = allChars.length;
  const baseDelay = 80; // ms per character

  typewriterTimer = setInterval(() => {
    if (charIndex >= totalChars) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      return;
    }
    const currentChar = allChars[charIndex];
    currentChar.classList.add('visible');
    
    // 自动滚动到最新打字的字符，解决超长诗词超出屏幕的问题
    // 利用 CSS 的 scroll-behavior: smooth 实现最天然平滑的滚动
    currentChar.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
    
    charIndex++;
  }, baseDelay);
}

/**
 * 隐藏诗文展示
 */
function hidePoemDisplay() {
  if (!isPoemOpen) return;
  isPoemOpen = false;
  
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
  
  sandDisappear(poemDisplay, () => {
    poemDisplay.classList.remove('active');
  });
}

/**
 * 面板是否打开
 */
export function isPanelOpen() {
  return isOpen;
}
