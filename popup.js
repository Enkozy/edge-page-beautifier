/* ============================================================
 * 扩展弹窗逻辑
 * 与内容脚本通过 chrome.storage 同步，无需消息通道
 * ============================================================ */
(function () {
  'use strict';

  var S = window.LGSettings;

  function $(id) { return document.getElementById(id); }

  function setFill(input) {
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 100;
    var val = parseFloat(input.value) || 0;
    var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--p', pct.toFixed(1) + '%');
  }

  function init(cfg) {
    var blur = $('blur');
    var alpha = $('alpha');
    var contrast = $('contrast');
    var saveTimer = 0;
    var touched = false;

    function paint() {
      $('enabled').checked = !!cfg.enabled;
      $('specular').checked = !!cfg.specular;
      if (document.activeElement !== blur) blur.value = String(cfg.blur);
      if (document.activeElement !== alpha) alpha.value = String(cfg.alpha);
      if (document.activeElement !== contrast) contrast.value = String(cfg.contrast);
      $('blurOut').textContent = cfg.blur + 'px';
      $('alphaOut').textContent = cfg.alpha + '%';
      $('contrastOut').textContent = cfg.contrast + '%';
      setFill(blur);
      setFill(alpha);
      setFill(contrast);
      Array.prototype.forEach.call(document.querySelectorAll('#theme button'), function (btn) {
        btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === cfg.theme));
      });
    }

    function saveNow() {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      S.save(cfg);
    }

    function scheduleSave() {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(saveNow, 140);
    }

    function commit(patch) {
      touched = true;
      cfg = S.normalize(Object.assign({}, cfg, patch));
      paint();
      saveNow();
    }

    $('enabled').addEventListener('change', function (e) { commit({ enabled: !!e.target.checked }); });
    $('specular').addEventListener('change', function (e) { commit({ specular: !!e.target.checked }); });

    blur.addEventListener('input', function () {
      touched = true;
      cfg.blur = parseInt(blur.value, 10) || 0;
      $('blurOut').textContent = cfg.blur + 'px';
      setFill(blur);
      scheduleSave();
    });

    alpha.addEventListener('input', function () {
      touched = true;
      cfg.alpha = parseInt(alpha.value, 10) || 10;
      $('alphaOut').textContent = cfg.alpha + '%';
      setFill(alpha);
      scheduleSave();
    });

    contrast.addEventListener('input', function () {
      touched = true;
      cfg.contrast = parseInt(contrast.value, 10) || 0;
      $('contrastOut').textContent = cfg.contrast + '%';
      setFill(contrast);
      scheduleSave();
    });

    blur.addEventListener('change', saveNow);
    alpha.addEventListener('change', saveNow);
    contrast.addEventListener('change', saveNow);

    Array.prototype.forEach.call(document.querySelectorAll('#theme button'), function (btn) {
      btn.addEventListener('click', function () { commit({ theme: btn.getAttribute('data-theme') }); });
    });

    $('reset').addEventListener('click', function () {
      commit({ enabled: true, theme: 'auto', blur: 26, alpha: 46, contrast: 50, specular: true });
    });

    $('more').addEventListener('click', function () {
      try { chrome.runtime.openOptionsPage(); } catch (e) { /* ignore */ }
    });

    S.onChange(function (next) {
      cfg = next;
      paint();
    });

    paint();

    S.load().then(function (stored) {
      if (touched) return;
      cfg = stored;
      paint();
    });

    try {
      var manifest = chrome.runtime.getManifest();
      $('ver').textContent = 'v' + manifest.version;
    } catch (e) { /* ignore */ }
  }

  if (!S) return;
  init(S.cached ? S.cached() : S.normalize(S.DEFAULTS));
})();
