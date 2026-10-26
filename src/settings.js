/* ============================================================
 * Bing Liquid Glass — 共享设置层
 * 内容脚本与 popup 共用，暴露 window.LGSettings
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'lgSettings';
  var CACHE_KEY = 'lgSettingsCache';
  var BG_KEY = 'lgBackground';

  var DEFAULTS = Object.freeze({
    enabled: true,   // 总开关
    theme: 'auto',   // auto | light | dark
    blur: 26,        // 模糊强度 px (0-48)
    alpha: 46,       // 玻璃通透度 % (10-80)
    contrast: 50,    // 文字对比度 % (0-100)
    specular: true,  // 鼠标跟随高光
    bgMode: 'aurora',// aurora | custom
    bgScrim: 32,     // 背景压暗/提亮 % (0-80)
    bgBlur: 0        // 背景虚化 px (0-16)
  });

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalize(raw) {
    var src = (raw && typeof raw === 'object') ? raw : {};
    var out = {};
    out.enabled = src.enabled !== false;
    out.theme = (src.theme === 'light' || src.theme === 'dark') ? src.theme : 'auto';
    out.blur = clampInt(src.blur, 0, 48, DEFAULTS.blur);
    out.alpha = clampInt(src.alpha, 10, 80, DEFAULTS.alpha);
    out.contrast = clampInt(src.contrast, 0, 100, DEFAULTS.contrast);
    out.specular = src.specular !== false;
    out.bgMode = src.bgMode === 'custom' ? 'custom' : 'aurora';
    out.bgScrim = clampInt(src.bgScrim, 0, 80, DEFAULTS.bgScrim);
    out.bgBlur = clampInt(src.bgBlur, 0, 16, DEFAULTS.bgBlur);
    return out;
  }

  function storageArea() {
    try {
      if (global.chrome && global.chrome.storage) {
        return global.chrome.storage.sync || global.chrome.storage.local || null;
      }
    } catch (err) { /* 无扩展权限时静默降级 */ }
    return null;
  }

  function load() {
    var area = storageArea();
    if (!area) {
      try {
        return Promise.resolve(normalize(JSON.parse(global.localStorage.getItem(KEY) || '{}')));
      } catch (err) {
        return Promise.resolve(normalize(DEFAULTS));
      }
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        resolve(normalize(value));
      }
      try {
        area.get(KEY, function (res) {
          void global.chrome.runtime.lastError;
          finish(res && res[KEY]);
        });
        setTimeout(function () { finish(cached()); }, 1500);
      } catch (err) {
        finish(DEFAULTS);
      }
    });
  }

  /* 同步缓存：内容脚本在 document_start 先用它，避免深色主题闪白 */
  function cached() {
    try {
      var raw = global.localStorage.getItem(CACHE_KEY);
      return normalize(raw ? JSON.parse(raw) : DEFAULTS);
    } catch (err) {
      return normalize(DEFAULTS);
    }
  }

  function save(cfg) {
    var clean = normalize(cfg);
    try { global.localStorage.setItem(CACHE_KEY, JSON.stringify(clean)); } catch (err) { /* ignore */ }
    var area = storageArea();
    if (!area) {
      try { global.localStorage.setItem(KEY, JSON.stringify(clean)); } catch (err) { /* ignore */ }
      return Promise.resolve(clean);
    }
    return new Promise(function (resolve) {
      try {
        var payload = {};
        payload[KEY] = clean;
        area.set(payload, function () {
          void global.chrome.runtime.lastError;
          resolve(clean);
        });
      } catch (err) {
        resolve(clean);
      }
    });
  }

  function onChange(callback) {
    try {
      if (!global.chrome || !global.chrome.storage || !global.chrome.storage.onChanged) {
        return function () {};
      }
      var handler = function (changes, areaName) {
        if (!changes || !changes[KEY]) return;
        callback(normalize(changes[KEY].newValue));
      };
      global.chrome.storage.onChanged.addListener(handler);
      return function () { global.chrome.storage.onChanged.removeListener(handler); };
    } catch (err) {
      return function () {};
    }
  }

  /* ---------------- 自定义背景（图片较大，单独放 local） ---------------- */
  function localArea() {
    try {
      if (global.chrome && global.chrome.storage) {
        return global.chrome.storage.local || null;
      }
    } catch (err) { /* ignore */ }
    return null;
  }

  function getBackground() {
    var area = localArea();
    if (!area) {
      try { return Promise.resolve(global.localStorage.getItem(BG_KEY) || ''); }
      catch (err) { return Promise.resolve(''); }
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        resolve(typeof value === 'string' ? value : '');
      }
      try {
        area.get(BG_KEY, function (res) {
          void global.chrome.runtime.lastError;
          finish(res && res[BG_KEY]);
        });
        setTimeout(function () { finish(''); }, 1800);
      } catch (err) {
        finish('');
      }
    });
  }

  function saveBackground(dataUrl) {
    var value = typeof dataUrl === 'string' ? dataUrl : '';
    var area = localArea();
    if (!area) {
      try { global.localStorage.setItem(BG_KEY, value); } catch (err) { /* ignore */ }
      return Promise.resolve(value);
    }
    return new Promise(function (resolve) {
      try {
        var payload = {};
        payload[BG_KEY] = value;
        area.set(payload, function () {
          if (global.chrome.runtime.lastError) {
            resolve('');
            return;
          }
          resolve(value);
        });
      } catch (err) {
        resolve('');
      }
    });
  }

  function clearBackground() {
    var area = localArea();
    if (!area) {
      try { global.localStorage.removeItem(BG_KEY); } catch (err) { /* ignore */ }
      return Promise.resolve('');
    }
    return new Promise(function (resolve) {
      try {
        area.remove(BG_KEY, function () {
          void global.chrome.runtime.lastError;
          resolve('');
        });
      } catch (err) {
        resolve('');
      }
    });
  }

  function onBackgroundChange(callback) {
    try {
      if (!global.chrome || !global.chrome.storage || !global.chrome.storage.onChanged) {
        return function () {};
      }
      var handler = function (changes) {
        if (!changes || !changes[BG_KEY]) return;
        callback(changes[BG_KEY].newValue || '');
      };
      global.chrome.storage.onChanged.addListener(handler);
      return function () { global.chrome.storage.onChanged.removeListener(handler); };
    } catch (err) {
      return function () {};
    }
  }

  global.LGSettings = {
    KEY: KEY,
    BG_KEY: BG_KEY,
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    cached: cached,
    load: load,
    save: save,
    onChange: onChange,
    getBackground: getBackground,
    saveBackground: saveBackground,
    clearBackground: clearBackground,
    onBackgroundChange: onBackgroundChange
  };
})(typeof window !== 'undefined' ? window : globalThis);
