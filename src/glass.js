/* ==========================================================================
   Bing Liquid Glass · content script
   负责：注入极光背景层、应用设置、鼠标高光、右下角玻璃控制面板
   ========================================================================== */
(function () {
  'use strict';

  var S = window.LGSettings;
  if (!S || window.__bingLiquidGlass) return;
  window.__bingLiquidGlass = true;

  var HTML = document.documentElement;
  var HUD_ID = 'lg-hud';
  var PAGE = detectPage();
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  var cfg = S.cached ? S.cached() : S.normalize(S.DEFAULTS);
  var cfgTouched = false;
  var bgUrl = '';
  var themeMeta = null;
  var themeMetaCreated = false;
  var themeMetaOriginal = null;
  var ui = null;
  var panelOpen = false;

  /* ------------------------------------------------------------------ */
  /* 页面判定                                                           */
  /* ------------------------------------------------------------------ */
  function detectPage() {
    var p = location.pathname;
    if (p === '/' || p === '/index.html') return 'home';
    if (/^\/(search|images|videos|news|maps|travel|academic|dict|shop)/.test(p)) return 'search';
    return 'other';
  }

  /* ------------------------------------------------------------------ */
  /* 极光背景                                                           */
  /* ------------------------------------------------------------------ */
  function ensureBackdrop() {
    var bg = document.getElementById('lg-bg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'lg-bg';
      bg.setAttribute('aria-hidden', 'true');
      bg.innerHTML =
        '<div class="lg-photo"></div>' +
        '<div class="lg-blob blob-a"></div>' +
        '<div class="lg-blob blob-b"></div>' +
        '<div class="lg-blob blob-c"></div>' +
        '<div class="lg-blob blob-d"></div>' +
        '<div class="lg-veil"></div>' +
        '<div class="lg-scrim"></div>' +
        '<div class="lg-noise"></div>';
      HTML.appendChild(bg);
    }
    if (document.body && bg.parentNode !== document.body) {
      document.body.insertBefore(bg, document.body.firstChild);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 设置应用                                                           */
  /* ------------------------------------------------------------------ */
  function currentTheme() {
    if (cfg.theme === 'light' || cfg.theme === 'dark') return cfg.theme;
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function apply() {
    var customBg = cfg.enabled && cfg.bgMode === 'custom' && !!bgUrl;
    var aurora = cfg.enabled && (PAGE === 'search' || customBg);
    HTML.classList.toggle('lg-on', !!cfg.enabled);
    HTML.dataset.lgTheme = currentTheme();
    HTML.dataset.lgPage = PAGE;
    HTML.dataset.lgAurora = aurora ? '1' : '0';
    HTML.dataset.lgBg = customBg ? 'custom' : 'aurora';
    HTML.style.setProperty('--lg-blur', cfg.blur + 'px');
    HTML.style.setProperty('--lg-a', (cfg.alpha / 100).toFixed(3));
    HTML.style.setProperty('--lg-scrim', (cfg.bgScrim / 100).toFixed(2));
    HTML.style.setProperty('--lg-bg-blur', cfg.bgBlur + 'px');
    if (!cfg.enabled || !cfg.specular) clearSpecular();
    setThemeColor();
  }

  function applyPhoto() {
    var bg = document.getElementById('lg-bg');
    if (!bg) return;
    var photo = bg.querySelector('.lg-photo');
    if (!photo) {
      photo = document.createElement('div');
      photo.className = 'lg-photo';
      bg.insertBefore(photo, bg.firstChild);
    }
    photo.style.backgroundImage = bgUrl ? 'url("' + bgUrl + '")' : 'none';
  }

  /* 让 Edge 的标题栏 / 工具栏跟随页面主色（需在 Edge 外观里开启） */
  function setThemeColor() {
    try {
      if (!cfg.enabled) {
        if (themeMeta && themeMetaCreated) {
          themeMeta.remove();
          themeMeta = null;
          themeMetaCreated = false;
        } else if (themeMeta && themeMetaOriginal !== null) {
          themeMeta.setAttribute('content', themeMetaOriginal);
        }
        return;
      }
      if (!themeMeta) {
        themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
          themeMetaOriginal = themeMeta.getAttribute('content') || '';
        } else {
          themeMeta = document.createElement('meta');
          themeMeta.setAttribute('name', 'theme-color');
          themeMetaCreated = true;
          (document.head || HTML).appendChild(themeMeta);
        }
      }
      themeMeta.setAttribute('content', currentTheme() === 'dark' ? '#080b12' : '#e9eefb');
    } catch (e) { /* ignore */ }
  }

  function saveCfg() {
    cfg = S.normalize(cfg);
    cfgTouched = true;
    S.save(cfg);
  }

  function commit(patch) {
    cfg = S.normalize(Object.assign({}, cfg, patch));
    apply();
    syncControls();
    saveCfg();
  }

  /* ------------------------------------------------------------------ */
  /* 鼠标跟随高光                                                       */
  /* ------------------------------------------------------------------ */
  var litEl = null;
  var rafId = 0;
  var lastX = 0;
  var lastY = 0;
  var lastTarget = null;

  function clearSpecular() {
    if (!litEl) return;
    litEl.style.setProperty('--lg-lit', '0');
    litEl.classList.remove('lg-lit');
    litEl = null;
  }

  function onPointerMove(e) {
    if (!cfg.enabled || !cfg.specular || REDUCED) return;
    if (e.pointerType === 'touch') return;
    lastX = e.clientX;
    lastY = e.clientY;
    lastTarget = e.target;
    if (!rafId) rafId = window.requestAnimationFrame(paintSpecular);
  }

  function paintSpecular() {
    rafId = 0;
    if (!cfg.enabled || !cfg.specular || !lastTarget) {
      clearSpecular();
      return;
    }
    var el = null;
    if (lastTarget.closest) {
      el = lastTarget.closest('#b_results > li, #b_context > *');
    }
    if (el !== litEl) {
      clearSpecular();
      litEl = el;
      if (el) el.classList.add('lg-lit');
    }
    if (!el) return;
    var rect = el.getBoundingClientRect();
    el.style.setProperty('--lg-mx', (lastX - rect.left).toFixed(1) + 'px');
    el.style.setProperty('--lg-my', (lastY - rect.top).toFixed(1) + 'px');
    el.style.setProperty('--lg-lit', '0.55');
  }

  function bindSpecular() {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('blur', clearSpecular);
    document.documentElement.addEventListener('pointerleave', clearSpecular);
  }

  /* ------------------------------------------------------------------ */
  /* 控制面板样式（Shadow DOM 内，完全隔离必应样式）                     */
  /* ------------------------------------------------------------------ */
  var HUD_CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; }

  .lg-fab, .lg-panel {
    font-family: "Segoe UI Variable Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .lg-fab {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin: 0;
    padding: 0;
    color: #eaf1ff;
    cursor: pointer;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, .38);
    background:
      linear-gradient(150deg, rgba(255, 255, 255, .34), rgba(255, 255, 255, .06) 55%, rgba(255, 255, 255, .16)),
      rgba(20, 26, 44, .38);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    backdrop-filter: blur(18px) saturate(180%);
    box-shadow:
      0 14px 34px -12px rgba(6, 12, 28, .70),
      inset 0 1px 0 rgba(255, 255, 255, .55),
      inset 0 -1px 0 rgba(0, 0, 0, .35);
    transition: transform .28s cubic-bezier(.2, .8, .3, 1), box-shadow .28s ease, border-radius .28s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .lg-fab:hover {
    transform: translateY(-2px) scale(1.05);
    border-radius: 22px;
    box-shadow:
      0 20px 44px -14px rgba(6, 12, 28, .80),
      inset 0 1px 0 rgba(255, 255, 255, .70),
      inset 0 -1px 0 rgba(0, 0, 0, .35);
  }

  .lg-fab:active { transform: scale(.95); }

  .lg-fab[aria-expanded="true"] {
    border-radius: 26px;
    background:
      linear-gradient(150deg, rgba(255, 255, 255, .42), rgba(255, 255, 255, .10) 55%, rgba(255, 255, 255, .20)),
      rgba(20, 26, 44, .48);
  }

  .lg-fab svg {
    display: block;
    width: 27px;
    height: 27px;
    filter: drop-shadow(0 2px 6px rgba(90, 140, 255, .55));
  }

  .lg-panel {
    position: fixed;
    right: 20px;
    bottom: 84px;
    z-index: 2147483647;
    width: 306px;
    padding: 16px 16px 12px;
    color: #e9eefc;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, .24);
    background:
      linear-gradient(155deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, .04) 42%, rgba(255, 255, 255, .10)),
      rgba(14, 19, 33, .64);
    -webkit-backdrop-filter: blur(26px) saturate(190%);
    backdrop-filter: blur(26px) saturate(190%);
    box-shadow:
      0 30px 70px -20px rgba(3, 8, 20, .80),
      0 2px 10px rgba(3, 8, 20, .40),
      inset 0 1px 0 rgba(255, 255, 255, .32),
      inset 0 -1px 0 rgba(0, 0, 0, .40);
    transform-origin: calc(100% - 26px) 100%;
    transition: opacity .24s ease, transform .34s cubic-bezier(.2, .9, .25, 1), visibility .24s;
    overflow: hidden;
  }

  .lg-panel::before {
    content: "";
    position: absolute;
    inset: 1px 1px auto;
    height: 46%;
    border-radius: 23px 23px 45% 45%;
    background: linear-gradient(180deg, rgba(255, 255, 255, .16), rgba(255, 255, 255, 0));
    pointer-events: none;
  }

  .lg-panel[hidden] {
    display: block;
    opacity: 0;
    visibility: hidden;
    transform: translateY(12px) scale(.94);
    pointer-events: none;
  }

  .lg-head {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .lg-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 650;
    letter-spacing: .02em;
    color: #f2f6ff;
  }

  .lg-brand i {
    width: 18px;
    height: 18px;
    border-radius: 7px;
    background: conic-gradient(from 210deg, #8fb6ff, #c7a4ff, #ffa8cf, #8fe8d8, #8fb6ff);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .85), 0 2px 6px rgba(90, 140, 255, .45);
  }

  .lg-x {
    position: relative;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, .14);
    background: rgba(255, 255, 255, .06);
    color: #cfd9ee;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: background .2s ease, color .2s ease;
  }

  .lg-ver {
    margin-left: auto;
    margin-right: 8px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, .10);
    color: #8e9cb5;
    font-size: 9.5px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .lg-x:hover { background: rgba(255, 255, 255, .14); color: #fff; }

  .lg-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 2px;
    font-size: 13px;
    color: #d5def0;
  }

  .lg-row + .lg-row { border-top: 1px solid rgba(255, 255, 255, .08); }

  .lg-field { position: relative; padding: 10px 2px 2px; }

  .lg-field + .lg-field { border-top: 1px solid rgba(255, 255, 255, .08); }

  .lg-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 7px;
    font-size: 12.5px;
    color: #b9c6de;
  }

  .lg-label b {
    color: #eef4ff;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }

  .lg-seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    padding: 3px;
    border-radius: 12px;
    background: rgba(255, 255, 255, .07);
    border: 1px solid rgba(255, 255, 255, .10);
  }

  .lg-seg button {
    padding: 6px 0;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #b6c3da;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
    transition: background .2s ease, color .2s ease, box-shadow .2s ease;
  }

  .lg-seg button:hover { color: #fff; background: rgba(255, 255, 255, .06); }

  .lg-seg button[aria-pressed="true"] {
    color: #fff;
    background: linear-gradient(150deg, rgba(255, 255, 255, .28), rgba(255, 255, 255, .12));
    box-shadow: 0 1px 4px rgba(0, 0, 0, .25), inset 0 1px 0 rgba(255, 255, 255, .30);
  }

  .lg-switch { position: relative; display: inline-flex; flex: none; cursor: pointer; }

  .lg-switch input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .lg-switch i {
    position: relative;
    display: block;
    width: 42px;
    height: 24px;
    border-radius: 999px;
    background: rgba(255, 255, 255, .14);
    border: 1px solid rgba(255, 255, 255, .16);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, .40);
    transition: background .25s ease, border-color .25s ease;
  }

  .lg-switch i::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(180deg, #fff, #dbe6fb);
    box-shadow: 0 2px 5px rgba(0, 0, 0, .35);
    transition: transform .25s cubic-bezier(.2, .9, .3, 1.2);
  }

  .lg-switch input:checked + i {
    background: linear-gradient(135deg, #6aa4ff, #9a7bff);
    border-color: rgba(255, 255, 255, .35);
  }

  .lg-switch input:checked + i::after { transform: translateX(18px); }

  .lg-switch input:focus-visible + i { outline: 2px solid rgba(140, 180, 255, .75); outline-offset: 2px; }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: 100%;
    height: 20px;
    margin: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, #8fb6ff 0%, #b49dff var(--p, 50%), rgba(255, 255, 255, .14) var(--p, 50%));
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, .90);
    background: radial-gradient(circle at 35% 30%, #fff, #cfe0ff 55%, #9fbdf0);
    box-shadow: 0 2px 8px rgba(40, 80, 160, .55);
  }

  input[type="range"]:focus-visible { outline: 2px solid rgba(140, 180, 255, .75); outline-offset: 4px; border-radius: 999px; }

  .lg-foot {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, .08);
    font-size: 11px;
    color: #8e9cb5;
  }

  kbd {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, .10);
    border: 1px solid rgba(255, 255, 255, .12);
    font-family: inherit;
    font-size: 10px;
    color: #cfd9ee;
  }

  .lg-reset {
    padding: 2px 4px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #9fb6dd;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .lg-reset:hover { color: #dfeaff; background: rgba(255, 255, 255, .08); }

  .lg-linkbtn {
    flex: none;
    padding: 5px 10px;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, .14);
    background: rgba(255, 255, 255, .08);
    color: #dbe7ff;
    font-family: inherit;
    font-size: 11.5px;
    line-height: 1.2;
    cursor: pointer;
    transition: background .2s ease, border-color .2s ease;
  }

  .lg-linkbtn:hover {
    background: rgba(255, 255, 255, .16);
    border-color: rgba(255, 255, 255, .24);
  }

  .lg-panel button:focus-visible,
  .lg-panel input:focus-visible { outline: 2px solid rgba(140, 180, 255, .75); outline-offset: 2px; }

  @media (max-width: 520px) {
    .lg-panel { right: 12px; width: calc(100vw - 24px); max-width: 340px; }
    .lg-fab { right: 12px; bottom: 12px; }
  }

  @media (max-height: 560px) {
    .lg-panel { max-height: calc(100vh - 104px); overflow-y: auto; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lg-fab, .lg-panel, .lg-switch i, .lg-switch i::after, .lg-seg button { transition: none; }
    .lg-fab:hover { transform: none; }
  }
  `;

  var HUD_HTML = `
  <button class="lg-fab" id="lg-fab" type="button" aria-label="液态玻璃设置" aria-expanded="false" title="液态玻璃设置（Alt+G）">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="lgDrop" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stop-color="#eaf2ff"></stop>
          <stop offset=".45" stop-color="#a9c8ff"></stop>
          <stop offset="1" stop-color="#c3a7ff"></stop>
        </linearGradient>
        <linearGradient id="lgShine" x1="8" y1="4" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop stop-color="#fff" stop-opacity=".95"></stop>
          <stop offset="1" stop-color="#fff" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path d="M12 2.4c3.9 4.6 6.6 7.7 6.6 11.2a6.6 6.6 0 1 1-13.2 0C5.4 10.1 8.1 7 12 2.4Z"
            fill="url(#lgDrop)" stroke="rgba(255,255,255,.75)" stroke-width=".7"></path>
      <ellipse cx="9.6" cy="9.6" rx="2.1" ry="3" transform="rotate(-28 9.6 9.6)" fill="url(#lgShine)" opacity=".85"></ellipse>
    </svg>
  </button>

  <div class="lg-panel" id="lg-panel" role="dialog" aria-label="液态玻璃设置" hidden>
    <div class="lg-head">
      <div class="lg-brand"><i></i>液态玻璃</div>
      <span class="lg-ver" id="lg-ver"></span>
      <button class="lg-x" id="lg-close" type="button" aria-label="关闭">×</button>
    </div>

    <div class="lg-row">
      <span>启用效果</span>
      <label class="lg-switch"><input type="checkbox" id="lg-enabled"><i></i></label>
    </div>

    <div class="lg-field">
      <div class="lg-label"><span>主题</span></div>
      <div class="lg-seg" id="lg-theme" role="group" aria-label="主题">
        <button type="button" data-theme="auto" aria-pressed="true">自动</button>
        <button type="button" data-theme="light" aria-pressed="false">浅色</button>
        <button type="button" data-theme="dark" aria-pressed="false">深色</button>
      </div>
    </div>

    <div class="lg-field">
      <div class="lg-label"><span>模糊强度</span><b id="lg-blur-out">26px</b></div>
      <input type="range" id="lg-blur" min="0" max="48" step="1" aria-label="模糊强度">
    </div>

    <div class="lg-field">
      <div class="lg-label"><span>玻璃通透</span><b id="lg-alpha-out">46%</b></div>
      <input type="range" id="lg-alpha" min="10" max="80" step="1" aria-label="玻璃通透度">
    </div>

    <div class="lg-row">
      <span>鼠标高光</span>
      <label class="lg-switch"><input type="checkbox" id="lg-specular"><i></i></label>
    </div>

    <div class="lg-row">
      <span>自定义背景</span>
      <button class="lg-linkbtn" id="lg-bg-open" type="button">裁剪 / 设置</button>
    </div>

    <div class="lg-foot">
      <span><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> 开关</span>
      <button class="lg-reset" id="lg-reset" type="button">恢复默认</button>
    </div>
  </div>
  `;

  /* ------------------------------------------------------------------ */
  /* HUD 挂载与交互                                                     */
  /* ------------------------------------------------------------------ */
  function mountHud() {
    if (!document.body) return;
    if (document.getElementById(HUD_ID)) return;

    var host = document.createElement('div');
    host.id = HUD_ID;
    host.style.cssText = 'all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483647;';

    var shadow;
    try {
      shadow = host.attachShadow({ mode: 'open' });
    } catch (e) {
      return;
    }

    var style = document.createElement('style');
    style.textContent = HUD_CSS;
    shadow.appendChild(style);

    var frag = document.createRange().createContextualFragment(HUD_HTML);
    shadow.appendChild(frag);

    document.body.appendChild(host);

    var fab = shadow.getElementById('lg-fab');
    var panel = shadow.getElementById('lg-panel');

    ui = {
      host: host,
      shadow: shadow,
      fab: fab,
      panel: panel,
      enabled: shadow.getElementById('lg-enabled'),
      blur: shadow.getElementById('lg-blur'),
      alpha: shadow.getElementById('lg-alpha'),
      blurOut: shadow.getElementById('lg-blur-out'),
      alphaOut: shadow.getElementById('lg-alpha-out'),
      specular: shadow.getElementById('lg-specular'),
      themeGroup: shadow.getElementById('lg-theme')
    };

    fab.addEventListener('click', function () { setPanel(!panelOpen, false); });
    shadow.getElementById('lg-close').addEventListener('click', function () { setPanel(false, true); });
    shadow.getElementById('lg-reset').addEventListener('click', function () { commit({ enabled: true, theme: 'auto', blur: 26, alpha: 46, specular: true }); });

    ui.enabled.addEventListener('change', function (e) { commit({ enabled: !!e.target.checked }); });
    ui.specular.addEventListener('change', function (e) { commit({ specular: !!e.target.checked }); });

    var bgOpen = shadow.getElementById('lg-bg-open');
    if (bgOpen) bgOpen.addEventListener('click', openOptions);

    ui.blur.addEventListener('input', function (e) {
      cfg.blur = parseInt(e.target.value, 10) || 0;
      ui.blurOut.textContent = cfg.blur + 'px';
      setRangeFill(e.target);
      apply();
    });
    ui.blur.addEventListener('change', function () { saveCfg(); });

    ui.alpha.addEventListener('input', function (e) {
      cfg.alpha = parseInt(e.target.value, 10) || 10;
      ui.alphaOut.textContent = cfg.alpha + '%';
      setRangeFill(e.target);
      apply();
    });
    ui.alpha.addEventListener('change', function () { saveCfg(); });

    Array.prototype.forEach.call(ui.themeGroup.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () { commit({ theme: btn.getAttribute('data-theme') }); });
    });

    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('keydown', onGlobalKeyDown, true);

    syncControls();

    try {
      var ver = chrome.runtime.getManifest().version;
      shadow.getElementById('lg-ver').textContent = 'v' + ver;
    } catch (e) { /* ignore */ }
  }

  function setRangeFill(input) {    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 100;
    var val = parseFloat(input.value) || 0;
    var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--p', pct.toFixed(1) + '%');
  }

  function syncControls() {
    if (!ui) return;
    var focused = null;
    try { focused = ui.shadow.activeElement; } catch (e) { focused = null; }

    ui.enabled.checked = !!cfg.enabled;
    ui.specular.checked = !!cfg.specular;

    if (focused !== ui.blur) ui.blur.value = String(cfg.blur);
    if (focused !== ui.alpha) ui.alpha.value = String(cfg.alpha);

    ui.blurOut.textContent = cfg.blur + 'px';
    ui.alphaOut.textContent = cfg.alpha + '%';
    setRangeFill(ui.blur);
    setRangeFill(ui.alpha);

    Array.prototype.forEach.call(ui.themeGroup.querySelectorAll('button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === cfg.theme));
    });
  }

  function setPanel(open, restoreFocus) {
    if (!ui) return;
    panelOpen = !!open;
    ui.panel.hidden = !panelOpen;
    ui.fab.setAttribute('aria-expanded', String(panelOpen));
    if (panelOpen) {
      try { ui.shadow.getElementById('lg-close').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    } else if (restoreFocus) {
      try { ui.fab.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  function onDocPointerDown(e) {
    if (!panelOpen || !ui) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(ui.host) !== -1) return;
    setPanel(false, false);
  }

  function onDocKeyDown(e) {
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault();
      e.stopPropagation();
      setPanel(false, true);
    }
  }

  function onGlobalKeyDown(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyG') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      commit({ enabled: !cfg.enabled });
    } else {
      setPanel(!panelOpen, false);
    }
  }

  function openOptions() {
    try {
      if (!globalThis.chrome || !chrome.runtime) return;
      if (chrome.runtime.openOptionsPage) {
        try {
          chrome.runtime.openOptionsPage();
          return;
        } catch (err) { /* 回退到后台消息 */ }
      }
      if (chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'lg-open-options' }, function () {
          void chrome.runtime.lastError;
        });
        return;
      }
      if (chrome.runtime.getURL) {
        window.open(chrome.runtime.getURL('options.html#background'), '_blank', 'noopener');
      }
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */
  function bindThemeWatcher() {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function () { if (cfg.theme === 'auto') apply(); };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    } catch (e) { /* ignore */ }
  }

  function boot() {
    ensureBackdrop();
    apply();
    mountHud();
    bindSpecular();
    bindThemeWatcher();

    if (S.getBackground) {
      S.getBackground().then(function (url) {
        bgUrl = url || '';
        applyPhoto();
        apply();
      });
    }
    if (S.onBackgroundChange) {
      S.onBackgroundChange(function (url) {
        bgUrl = url || '';
        applyPhoto();
        apply();
      });
    }

    S.load().then(function (stored) {
      if (!cfgTouched) {
        cfg = stored;
        apply();
        syncControls();
      }
    });

    S.onChange(function (next) {
      cfg = next;
      apply();
      syncControls();
    });
  }

  if (document.readyState === 'loading') {
    apply();
    ensureBackdrop();
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
