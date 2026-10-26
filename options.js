/* ==========================================================================
   设置页脚本：外观同步、背景上传、拖拽缩放裁剪
   ========================================================================== */
(function () {
  'use strict';

  var S = window.LGSettings;
  if (!S) return;

  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var cfg = S.cached ? S.cached() : S.normalize(S.DEFAULTS);
  var bgData = '';
  var touched = false;
  var saveTimer = 0;
  var toastTimer = 0;

  /* ------------------------------------------------------------------ */
  /* 主题与外观                                                          */
  /* ------------------------------------------------------------------ */
  function resolvedTheme() {
    if (cfg.theme === 'light' || cfg.theme === 'dark') return cfg.theme;
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme() {
    var theme = resolvedTheme();
    root.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#080b12' : '#e9eefb');
  }

  function setFill(input) {
    if (!input) return;
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 100;
    var val = parseFloat(input.value) || 0;
    var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--p', pct.toFixed(1) + '%');
  }

  function paint() {
    $('enabled').checked = !!cfg.enabled;
    $('specular').checked = !!cfg.specular;

    if (document.activeElement !== $('blur')) $('blur').value = String(cfg.blur);
    if (document.activeElement !== $('alpha')) $('alpha').value = String(cfg.alpha);
    if (document.activeElement !== $('scrim')) $('scrim').value = String(cfg.bgScrim);
    if (document.activeElement !== $('bgBlur')) $('bgBlur').value = String(cfg.bgBlur);

    $('blurOut').textContent = cfg.blur + 'px';
    $('alphaOut').textContent = cfg.alpha + '%';
    $('scrimOut').textContent = cfg.bgScrim + '%';
    $('bgBlurOut').textContent = cfg.bgBlur + 'px';

    ['blur', 'alpha', 'scrim', 'bgBlur'].forEach(function (id) { setFill($(id)); });

    Array.prototype.forEach.call($('theme').querySelectorAll('button'), function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === cfg.theme));
    });
    Array.prototype.forEach.call($('bgMode').querySelectorAll('button'), function (btn) {
      var mode = btn.getAttribute('data-mode');
      var active = mode === 'custom' ? (cfg.bgMode === 'custom' && !!bgData) : cfg.bgMode !== 'custom';
      btn.setAttribute('aria-pressed', String(active));
    });

    renderBg();
  }

  function renderBg() {
    var has = !!bgData;
    var preview = $('bgPreview');
    preview.classList.toggle('has-image', has);

    if (has) {
      if ($('bgThumb').getAttribute('src') !== bgData) $('bgThumb').src = bgData;
      $('bgSize').textContent = Math.max(1, Math.round(bgData.length * 0.75 / 1024)) + ' KB';
    } else {
      $('bgThumb').removeAttribute('src');
      $('bgSize').textContent = '';
    }

    $('crop').disabled = !has;
    $('clear').disabled = !has;

    if (cfg.bgMode === 'custom' && has) $('bgBadge').textContent = '当前：自定义图片';
    else if (cfg.bgMode === 'custom' && !has) $('bgBadge').textContent = '未选择图片';
    else $('bgBadge').textContent = '当前：流动极光';
  }

  function saveNow() {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    touched = true;
    S.save(cfg);
  }

  function scheduleSave() {
    touched = true;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 160);
  }

  function commit(patch) {
    cfg = S.normalize(Object.assign({}, cfg, patch));
    applyTheme();
    paint();
    saveNow();
  }

  function toast(message) {
    var el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function setError(message) {
    var el = $('bgError');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function fail(message) {
    setError(message);
    toast(message);
  }

  /* ------------------------------------------------------------------ */
  /* 背景：选择 / 清除                                                   */
  /* ------------------------------------------------------------------ */
  function bindAppearance() {
    $('enabled').addEventListener('change', function (e) { commit({ enabled: !!e.target.checked }); });
    $('specular').addEventListener('change', function (e) { commit({ specular: !!e.target.checked }); });

    Array.prototype.forEach.call($('theme').querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () { commit({ theme: btn.getAttribute('data-theme') }); });
    });

    $('blur').addEventListener('input', function () {
      cfg.blur = parseInt($('blur').value, 10) || 0;
      $('blurOut').textContent = cfg.blur + 'px';
      setFill($('blur'));
      scheduleSave();
    });
    $('blur').addEventListener('change', saveNow);

    $('alpha').addEventListener('input', function () {
      cfg.alpha = parseInt($('alpha').value, 10) || 10;
      $('alphaOut').textContent = cfg.alpha + '%';
      setFill($('alpha'));
      scheduleSave();
    });
    $('alpha').addEventListener('change', saveNow);

    $('scrim').addEventListener('input', function () {
      cfg.bgScrim = parseInt($('scrim').value, 10) || 0;
      $('scrimOut').textContent = cfg.bgScrim + '%';
      setFill($('scrim'));
      scheduleSave();
    });
    $('scrim').addEventListener('change', saveNow);

    $('bgBlur').addEventListener('input', function () {
      cfg.bgBlur = parseInt($('bgBlur').value, 10) || 0;
      $('bgBlurOut').textContent = cfg.bgBlur + 'px';
      setFill($('bgBlur'));
      scheduleSave();
    });
    $('bgBlur').addEventListener('change', saveNow);
  }

  function guessImageType(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    var map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif'
    };
    return map[ext] || '';
  }

  function handleFile(file) {
    if (!file) return;
    setError('');
    if (file.type && !/^image\//.test(file.type)) {
      fail('这个文件不是图片格式，请选 JPG / PNG / WebP');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      fail('图片超过 25MB，换一张小一点的吧');
      return;
    }

    var type = file.type;
    if (!type || type === 'application/octet-stream') type = guessImageType(file.name);
    var blob = (type && type !== file.type) ? new Blob([file], { type: type }) : file;

    beginCropLoading('正在读取文件…');
    var seq = ++crop.seq;

    var reader = new FileReader();
    reader.onload = function () {
      if (seq !== crop.seq || !crop.opened) return;
      openCrop(String(reader.result || ''));
    };
    reader.onerror = function () {
      if (seq !== crop.seq || !crop.opened) return;
      showCropError('读取图片失败，换个位置或换一张图片试试。');
    };
    reader.readAsDataURL(blob);
  }

  function bindBackground() {
    $('pick').addEventListener('click', function () { $('file').click(); });

    $('file').addEventListener('change', function () {
      var file = $('file').files && $('file').files[0];
      $('file').value = '';
      handleFile(file);
    });

    var preview = $('bgPreview');
    ['dragenter', 'dragover'].forEach(function (type) {
      preview.addEventListener(type, function (e) {
        e.preventDefault();
        e.stopPropagation();
        preview.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      preview.addEventListener(type, function (e) {
        e.preventDefault();
        e.stopPropagation();
        preview.classList.remove('dragover');
      });
    });
    preview.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          var file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
          }
          return;
        }
      }
    });

    $('crop').addEventListener('click', function () { if (bgData) openCrop(bgData); });

    $('clear').addEventListener('click', function () {
      S.clearBackground().then(function () {
        bgData = '';
        if (cfg.bgMode === 'custom') cfg.bgMode = 'aurora';
        saveNow();
        setError('');
        paint();
        toast('已清除自定义背景');
      });
    });

    Array.prototype.forEach.call($('bgMode').querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-mode');
        if (mode === 'custom' && !bgData) {
          fail('先选一张图片，或把图片直接拖进上面的预览框');
          $('file').click();
          return;
        }
        commit({ bgMode: mode === 'custom' ? 'custom' : 'aurora' });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 裁剪                                                               */
  /* ------------------------------------------------------------------ */
  var crop = {
    nw: 0, nh: 0, base: 1, zoom: 1,
    tx: 0, ty: 0, w: 0, h: 0,
    drag: null, opened: false, seq: 0, timer: 0
  };

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function sizeStage() {
    var ar = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
    var maxW = Math.min(window.innerWidth * 0.86, 980);
    var maxH = Math.min(window.innerHeight * 0.55, 600);
    var w = maxW;
    var h = w / ar;
    if (h > maxH) { h = maxH; w = h * ar; }
    crop.w = Math.round(w);
    crop.h = Math.round(h);
    var stage = $('stage');
    stage.style.width = crop.w + 'px';
    stage.style.height = crop.h + 'px';
  }

  function layout() {
    var img = $('cropImg');
    if (!crop.nw) return;
    var s = crop.base * crop.zoom;
    var dw = crop.nw * s;
    var dh = crop.nh * s;
    var maxX = Math.max(0, (dw - crop.w) / 2);
    var maxY = Math.max(0, (dh - crop.h) / 2);
    crop.tx = clamp(crop.tx, -maxX, maxX);
    crop.ty = clamp(crop.ty, -maxY, maxY);

    img.style.width = dw + 'px';
    img.style.height = dh + 'px';
    img.style.left = ((crop.w - dw) / 2 + crop.tx) + 'px';
    img.style.top = ((crop.h - dh) / 2 + crop.ty) + 'px';
  }

  function setZoom(value) {
    crop.zoom = clamp(value, 1, 3);
    var pct = Math.round(crop.zoom * 100);
    $('zoom').value = String(pct);
    $('zoomOut').textContent = pct + '%';
    setFill($('zoom'));
    layout();
  }

  function beginCropLoading(label) {
    var modal = $('cropModal');
    var img = $('cropImg');

    crop.opened = true;
    crop.nw = 0;
    crop.nh = 0;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('cropLoading').hidden = false;
    $('cropError').hidden = true;
    $('cropInfo').textContent = label || '正在读取…';
    $('apply').disabled = true;
    img.style.visibility = 'hidden';
    $('stage').classList.remove('dragging');

    window.clearTimeout(crop.timer);
    crop.timer = window.setTimeout(function () {
      if (!crop.opened || $('cropLoading').hidden) return;
      showCropError('读取超时。图片可能太大或已损坏，换一张 JPG/PNG 试试。');
    }, 20000);
  }

  function showCropError(message) {
    window.clearTimeout(crop.timer);
    crop.nw = 0;
    crop.nh = 0;
    $('cropLoading').hidden = true;
    $('cropError').hidden = false;
    $('cropErrorText').textContent = message;
    $('cropInfo').textContent = '—';
    $('apply').disabled = true;
    $('cropImg').style.visibility = 'hidden';
    setError(message);
  }

  function openCrop(src) {
    if (!src) {
      showCropError('没有读取到图片数据，换一张图片试试。');
      return;
    }

    var img = $('cropImg');
    crop.seq += 1;
    beginCropLoading('正在解码图片…');

    var ready = function () {
      if (!crop.opened) return;
      if (!img.naturalWidth || !img.naturalHeight) {
        showCropError('图片无法解码。iPhone 的 HEIC 请先在相册导出为 JPG/PNG，或换一张图片。');
        return;
      }

      window.clearTimeout(crop.timer);
      crop.nw = img.naturalWidth;
      crop.nh = img.naturalHeight;
      img.style.visibility = 'visible';
      $('cropLoading').hidden = true;
      $('cropError').hidden = true;
      $('apply').disabled = false;
      setError('');
      $('zoom').value = '100';
      $('zoomOut').textContent = '100%';
      setFill($('zoom'));
      $('cropInfo').textContent = crop.nw + ' × ' + crop.nh + ' px';

      sizeStage();
      crop.base = Math.max(crop.w / crop.nw, crop.h / crop.nh);
      crop.zoom = 1;
      crop.tx = 0;
      crop.ty = 0;
      layout();

      window.requestAnimationFrame(function () {
        if (!crop.opened || !crop.nw) return;
        sizeStage();
        crop.base = Math.max(crop.w / crop.nw, crop.h / crop.nh);
        layout();
      });
    };

    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) {
      ready();
      return;
    }

    img.onload = ready;
    img.onerror = function () {
      if (!crop.opened) return;
      showCropError('图片无法解码。iPhone 的 HEIC 请先在相册导出为 JPG/PNG，或换一张图片。');
    };
    img.src = src;
  }

  function closeCrop() {
    crop.opened = false;
    crop.nw = 0;
    crop.nh = 0;
    crop.drag = null;
    crop.seq += 1;
    window.clearTimeout(crop.timer);
    $('cropModal').hidden = true;
    $('cropLoading').hidden = true;
    $('cropError').hidden = true;
    $('apply').disabled = true;
    document.body.style.overflow = '';
    $('cropImg').removeAttribute('src');
    $('cropImg').style.visibility = 'hidden';
    $('stage').classList.remove('dragging');
  }

  function applyCrop() {
    var img = $('cropImg');
    if (!crop.nw) return;

    var s = crop.base * crop.zoom;
    var left = (crop.w - crop.nw * s) / 2 + crop.tx;
    var top = (crop.h - crop.nh * s) / 2 + crop.ty;
    var sx = -left / s;
    var sy = -top / s;
    var sw = Math.min(crop.nw, crop.w / s);
    var sh = Math.min(crop.nh, crop.h / s);
    sx = clamp(sx, 0, Math.max(0, crop.nw - sw));
    sy = clamp(sy, 0, Math.max(0, crop.nh - sh));

    var ar = crop.w / crop.h;
    var outW = 2560;
    var outH = Math.round(outW / ar);
    if (outH > 2560) { outH = 2560; outW = Math.round(outH * ar); }

    var canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext('2d');
    if (!ctx) { fail('浏览器不支持 canvas，无法生成背景'); return; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    var data = canvas.toDataURL('image/jpeg', 0.9);

    if (data.length > 7 * 1024 * 1024) {
      var w2 = 1920;
      var h2 = Math.round(w2 / ar);
      canvas.width = w2;
      canvas.height = h2;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w2, h2);
      data = canvas.toDataURL('image/jpeg', 0.82);
    }

    if (!data || data.indexOf('data:image/') !== 0 || data.length < 100) {
      fail('裁剪图生成失败，换一张图片试试');
      return;
    }

    S.saveBackground(data).then(function (saved) {
      if (!saved) {
        fail('保存失败：本地存储写入失败。试试换一张小一点的图片，或在扩展详情里清理存储。');
        return;
      }
      bgData = data;
      cfg.bgMode = 'custom';
      saveNow();
      closeCrop();
      setError('');
      paint();
      toast('背景已保存');
    });
  }

  function bindCrop() {
    var stage = $('stage');

    stage.addEventListener('pointerdown', function (e) {
      if (!crop.opened) return;
      crop.drag = { x: e.clientX, y: e.clientY, tx: crop.tx, ty: crop.ty };
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!crop.drag) return;
      crop.tx = crop.drag.tx + (e.clientX - crop.drag.x);
      crop.ty = crop.drag.ty + (e.clientY - crop.drag.y);
      layout();
    });

    function endDrag() {
      crop.drag = null;
      stage.classList.remove('dragging');
    }

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    window.addEventListener('pointerup', endDrag);

    stage.addEventListener('wheel', function (e) {
      if (!crop.opened) return;
      e.preventDefault();
      setZoom(crop.zoom * (e.deltaY < 0 ? 1.08 : 0.925));
    }, { passive: false });

    $('zoom').addEventListener('input', function () {
      setZoom((parseInt($('zoom').value, 10) || 100) / 100);
    });

    $('reset').addEventListener('click', function () {
      crop.tx = 0;
      crop.ty = 0;
      setZoom(1);
    });

    $('apply').addEventListener('click', applyCrop);
    $('cancel').addEventListener('click', closeCrop);
    $('cropClose').addEventListener('click', closeCrop);
    $('cropErrorClose').addEventListener('click', closeCrop);
    $('cropModal').addEventListener('click', function (e) {
      if (e.target === $('cropModal')) closeCrop();
    });

    document.addEventListener('keydown', function (e) {
      if (!crop.opened) return;
      if (e.key === 'Escape') { e.preventDefault(); closeCrop(); }
      if (e.key === 'Enter') { e.preventDefault(); applyCrop(); }
    });

    window.addEventListener('resize', function () {
      if (!crop.opened) return;
      sizeStage();
      crop.base = Math.max(crop.w / crop.nw, crop.h / crop.nh);
      layout();
    });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */
  function boot() {
    try {
      var inExtension = !!(window.chrome && chrome.runtime && chrome.runtime.id);
      if (!inExtension) $('ctxWarn').hidden = false;
    } catch (e) {
      $('ctxWarn').hidden = false;
    }

    applyTheme();
    paint();
    bindAppearance();
    bindBackground();
    bindCrop();

    S.getBackground().then(function (url) {
      bgData = url || '';
      paint();
    });

    S.onBackgroundChange(function (url) {
      bgData = url || '';
      if (!bgData && cfg.bgMode === 'custom') {
        cfg.bgMode = 'aurora';
        saveNow();
      }
      paint();
    });

    S.onChange(function (next) {
      cfg = next;
      applyTheme();
      paint();
    });

    S.load().then(function (stored) {
      if (touched) return;
      cfg = stored;
      applyTheme();
      paint();
    });

    try {
      var manifest = chrome.runtime.getManifest();
      $('ver').textContent = 'v' + manifest.version;
    } catch (e) { /* ignore */ }

    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', function () { if (cfg.theme === 'auto') applyTheme(); });
    } catch (e) { /* ignore */ }
  }

  boot();
})();
