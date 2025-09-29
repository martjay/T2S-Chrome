// 基础设置的存取
const defaultSettings = {
  enabled: true,
  mode: 's2t' // s2t, t2s, s2tw, s2hk, s2twp, t2cn, cn2t
};

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(defaultSettings, resolve);
  });
}

function onSettingsChange(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.enabled || changes.mode)) {
      callback();
    }
  });
}

// 文本节点遍历与替换（跳过code/pre/script/style/textarea/input/iframe/内容可编辑）
const BLOCK_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'IFRAME']);

function shouldSkip(node) {
  if (!node) return true;
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = /** @type {HTMLElement} */ (node);
    if (BLOCK_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    if (el.closest('input, textarea, [contenteditable="true"]')) return true;
  }
  return false;
}

function isValidRoot(root) {
  return !!root && typeof root === 'object' && typeof root.nodeType === 'number';
}

function walkTextNodes(root, visitor) {
  if (!isValidRoot(root)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
      const text = node.nodeValue;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) {
    visitor(n);
  }
}

// OpenCC 初始化（UMD 全量构建）
// 在 manifest 中已先注入 vendor/opencc.full.umd.js 暴露 window.OpenCC
let converter = null;
let lastSettings = { ...defaultSettings };
// 记录每个文本节点的原始内容，禁用或切换模式时可恢复
let originalTextMap = new WeakMap();

function createConverterByMode(mode) {
  // 依赖 opencc-js 的预设：full 里包含多地区字典与最长匹配逻辑
  const OpenCC = window.OpenCC;
  if (!OpenCC) return null;

  // 简化：将模式映射到 opencc-js 的 to/from 预设
  // s2t: cn -> tw/hk（以 tw 为默认）; t2s: tw/hk -> cn
  switch (mode) {
    case 's2t':
      return OpenCC.Converter({ from: 'cn', to: 'tw' });
    case 's2tw':
      return OpenCC.Converter({ from: 'cn', to: 'tw' });
    case 's2hk':
      return OpenCC.Converter({ from: 'cn', to: 'hk' });
    case 's2twp':
      return OpenCC.Converter({ from: 'cn', to: 'twp' });
    case 't2s':
    case 't2cn':
      return OpenCC.Converter({ from: 'tw', to: 'cn' });
    case 't2sp':
      // 繁 → 简（大陆常用词）：等价于 OpenCC tw2sp.json 路线
      return OpenCC.Converter({ from: 'twp', to: 'cn' });
    case 'cn2t':
      return OpenCC.Converter({ from: 'cn', to: 'tw' });
    default:
      return OpenCC.Converter({ from: 'cn', to: 'tw' });
  }
}

function replaceInNode(node) {
  if (!converter) return;
  const original = node.nodeValue;
  if (!originalTextMap.has(node)) {
    originalTextMap.set(node, original);
  }
  const converted = converter(original);
  if (converted && converted !== original) {
    node.nodeValue = converted;
  }
}

function restoreInNode(node) {
  const orig = originalTextMap.get(node);
  if (typeof orig === 'string' && node.nodeValue !== orig) {
    node.nodeValue = orig;
  }
}

function restoreAll() {
  // 遍历整页，将已记录原文的文本节点恢复
  const root = document.body || document.documentElement;
  walkTextNodes(root, restoreInNode);
  // 清空缓存，避免不同模式叠加偏差
  originalTextMap = new WeakMap();
}

async function applyAll() {
  const { enabled, mode } = await getSettings();
  lastSettings = { enabled, mode };
  if (!enabled) return;
  converter = createConverterByMode(mode);
  if (!converter) return;
  const run = () => walkTextNodes(document.body || document.documentElement, replaceInNode);
  if (document.body || document.documentElement) {
    run();
  } else {
    window.addEventListener('DOMContentLoaded', run, { once: true });
  }
}

// 监听 DOM 变化，动态替换
const observer = new MutationObserver(mutations => {
  if (!converter) return;
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceInNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE && !shouldSkip(node)) {
        walkTextNodes(node, replaceInNode);
      }
    }
  }
});

async function start() {
  await applyAll();
  const observeTarget = document.documentElement || document.body;
  if (isValidRoot(observeTarget)) {
    observer.observe(observeTarget, {
      childList: true,
      subtree: true
    });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const t = document.documentElement || document.body;
      if (isValidRoot(t)) {
        observer.observe(t, { childList: true, subtree: true });
      }
    }, { once: true });
  }
  initUrlChangeHandlers();
}

start();

onSettingsChange(async () => {
  const { enabled, mode } = await getSettings();
  const prev = lastSettings;
  lastSettings = { enabled, mode };

  if (!enabled) {
    // 关闭：停止应用并恢复原文
    converter = null;
    restoreAll();
    return;
  }

  // 开启或模式变化：先恢复到原文，再按新模式重应用，避免二次转换
  if (prev.mode !== mode || !prev.enabled) {
    restoreAll();
  }
  converter = createConverterByMode(mode);
  if (!converter) return;
  walkTextNodes(document.body || document.documentElement, replaceInNode);
});

// 监听 URL / 可见性变化，SPA 或同域跳转时自动重新应用
let lastUrl = location.href;
const reapplyOnUrlChange = () => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  // 恢复后再按当前模式应用，避免二次转换
  restoreAll();
  applyAll();
};

function initUrlChangeHandlers() {
  const fire = () => window.dispatchEvent(new Event('locationchange'));
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  if (origPush) {
    history.pushState = function() {
      const r = origPush.apply(this, arguments);
      fire();
      return r;
    };
  }
  if (origReplace) {
    history.replaceState = function() {
      const r = origReplace.apply(this, arguments);
      fire();
      return r;
    };
  }
  window.addEventListener('popstate', fire);
  window.addEventListener('hashchange', fire);
  window.addEventListener('locationchange', reapplyOnUrlChange);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // 标签再次可见时，确保应用到最新 DOM
      applyAll();
    }
  });
  window.addEventListener('pageshow', () => applyAll());
}


