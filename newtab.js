/* ==========================================================================
   新标签页：Bing 壁纸 / 自定义背景 + 玻璃搜索 + 快捷网站
   ========================================================================== */
(function () {
  'use strict';

  var S = window.LGSettings;
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var cfg = S ? S.cached() : {
    theme: 'auto', bgMode: 'aurora', bgScrim: 32, bgBlur: 0
  };

  var customBg = '';
  var wallSeq = 0;
  var wallRetryTimer = 0;
  var addOpen = false;
  var sites = [];

  var DEFAULT_SITES = [
    { title: '哔哩哔哩', url: 'https://www.bilibili.com/' },
    { title: '知乎', url: 'https://www.zhihu.com/' },
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'YouTube', url: 'https://www.youtube.com/' },
    { title: '微博', url: 'https://weibo.com/' },
    { title: '百度', url: 'https://www.baidu.com/' },
    { title: '淘宝', url: 'https://www.taobao.com/' },
    { title: '豆瓣', url: 'https://www.douban.com/' }
  ];

  /* ------------------------------------------------------------------ */
  /* 基础                                                               */
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

  function applyGlass() {
    root.style.setProperty('--scrim', ((cfg.bgScrim || 0) / 100).toFixed(2));
    root.style.setProperty('--bg-blur', (cfg.bgBlur || 0) + 'px');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var d = new Date();
    $('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    $('date').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + week;
  }

  /* ------------------------------------------------------------------ */
  /* 背景                                                               */
  /* ------------------------------------------------------------------ */
  function setPhoto(url, token, opts) {
    opts = opts || {};
    if (!url || token !== wallSeq) return;
    var photo = $('photo');
    var img = new Image();
    var settled = false;

    function finish() {
      if (settled || token !== wallSeq) return;
      settled = true;
      photo.style.backgroundImage = 'url("' + url + '")';
      root.dataset.bg = 'photo';
      $('wallInfo').textContent = opts.label || '必应每日壁纸';
    }

    function fail() {
      if (settled || token !== wallSeq) return;
      settled = true;
      root.dataset.bg = 'aurora';
      $('wallInfo').textContent = opts.custom ? '自定义背景不可用' : '流动极光';
      if (opts.custom) return;
      if (opts.fromCache) {
        try { window.localStorage.removeItem('lgNtpWall'); } catch (e) { /* ignore */ }
        loadWallpaper(false, true);
      } else if (!opts.retried) {
        loadWallpaper(false, true);
      }
    }

    img.onload = finish;
    img.onerror = fail;
    img.src = url;
    if (img.complete && img.naturalWidth > 0) finish();
  }

  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function useCustomBg(token) {
    if (cfg.bgMode === 'custom' && customBg) {
      $('wallInfo').textContent = '自定义背景';
      $('refresh').hidden = true;
      setPhoto(customBg, token, { custom: true, label: '自定义背景' });
      return true;
    }
    return false;
  }

  function loadWallpaper(force, retried) {
    window.clearTimeout(wallRetryTimer);
    var token = ++wallSeq;
    if (useCustomBg(token)) return;

    $('refresh').hidden = false;
    $('wallInfo').textContent = '必应每日壁纸';

    var cache = null;
    try { cache = JSON.parse(window.localStorage.getItem('lgNtpWall') || 'null'); } catch (e) { cache = null; }
    if (!force && cache && cache.date === dayKey() && cache.url) {
      setPhoto(cache.url, token, { fromCache: true, retried: !!retried, label: '必应每日壁纸' });
      return;
    }

    root.dataset.bg = 'aurora';
    var idx = force ? Math.floor(Math.random() * 8) : 0;

    fetch('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=' + idx + '&n=1&mkt=zh-CN', { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('http');
        return res.json();
      })
      .then(function (json) {
        if (token !== wallSeq) return;
        var image = json && json.images && json.images[0];
        if (!image || !image.url) throw new Error('empty');
        var url = 'https://cn.bing.com' + image.url;
        if (!force) {
          try { window.localStorage.setItem('lgNtpWall', JSON.stringify({ date: dayKey(), url: url })); } catch (e) { /* ignore */ }
        }
        setPhoto(url, token, { fromCache: false, retried: !!retried, label: '必应每日壁纸' });
      })
      .catch(function () {
        if (token !== wallSeq) return;
        if (cache && cache.url) {
          setPhoto(cache.url, token, { fromCache: true, retried: true, label: '必应每日壁纸（缓存）' });
          return;
        }
        if (!retried) {
          wallRetryTimer = window.setTimeout(function () { loadWallpaper(false, true); }, 800);
          return;
        }
        root.dataset.bg = 'aurora';
        $('wallInfo').textContent = '流动极光';
      });
  }

  /* ------------------------------------------------------------------ */
  /* 快捷网站                                                           */
  /* ------------------------------------------------------------------ */
  function localGet(key) {
    return new Promise(function (resolve) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(key, function (res) { resolve(res ? res[key] : undefined); });
          return;
        }
      } catch (e) { /* ignore */ }
      try { resolve(JSON.parse(window.localStorage.getItem(key) || 'null')); }
      catch (e) { resolve(null); }
    });
  }

  function localSet(key, value) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var payload = {};
        payload[key] = value;
        chrome.storage.local.set(payload);
        return;
      }
    } catch (e) { /* ignore */ }
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function safeUrl(value) {
    try {
      var url = new URL(String(value));
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (e) { /* ignore */ }
    return '';
  }

  function hueFor(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
  }

  var toastTimer = 0;

  function toast(message) {
    var el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function faviconCandidates(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return [];
      return [
        u.origin + '/favicon.ico',
        u.origin + '/apple-touch-icon.png',
        u.origin + '/favicon.png',
        u.origin + '/favicon.svg',
        u.origin + '/apple-touch-icon-precomposed.png'
      ];
    } catch (e) {
      return [];
    }
  }

  function renderSites() {
    var quick = $('quick');
    while (quick.firstChild) quick.removeChild(quick.firstChild);

    sites.slice(0, 10).forEach(function (site) {
      var url = safeUrl(site && site.url);
      if (!url) return;
      var host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { host = url; }
      var title = String((site && site.title) || '').trim() || host;
      var first = Array.from(title)[0] || '\u00b7';

      var item = document.createElement('div');
      item.className = 'quick-item';

      var link = document.createElement('a');
      link.className = 'quick-link';
      link.href = url;
      link.rel = 'noopener';

      var icon = document.createElement('span');
      icon.className = 'quick-icon';

      var fallback = document.createElement('span');
      fallback.className = 'fallback';
      var hue = hueFor(title);
      fallback.style.setProperty('--h', String(hue));
      fallback.style.setProperty('--h2', String((hue + 40) % 360));
      fallback.textContent = first.toUpperCase();

      var img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';

      var candidates = faviconCandidates(url);
      var idx = 0;
      img.addEventListener('load', function () { icon.classList.add('has-fav'); });
      img.addEventListener('error', function () {
        icon.classList.remove('has-fav');
        if (idx < candidates.length) {
          img.src = candidates[idx];
          idx += 1;
        } else {
          img.removeAttribute('src');
        }
      });

      icon.appendChild(fallback);
      icon.appendChild(img);

      var name = document.createElement('span');
      name.className = 'quick-name';
      name.textContent = title;

      link.appendChild(icon);
      link.appendChild(name);

      var del = document.createElement('button');
      del.className = 'quick-del';
      del.type = 'button';
      del.title = '删除';
      del.setAttribute('aria-label', '删除 ' + title);
      del.textContent = '\u00d7';
      del.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        sites.splice(sites.indexOf(site), 1);
        localSet('lgShortcuts', sites);
        localSet('lgSitesCustomized', true);
        renderSites();
      });

      item.appendChild(link);
      item.appendChild(del);
      quick.appendChild(item);

      // 必须在插入 DOM 之后再开始加载：之前用 loading=lazy + display:none，
      // 图标永远不加载，load 不触发，has-fav 不加，只剩字母兜底。
      if (candidates.length) {
        img.src = candidates[idx];
        idx += 1;
      }
    });
  }

  function loadTopSites() {
    if (typeof chrome === 'undefined' || !chrome.topSites) {
      toast('浏览器不支持读取常用网站');
      return;
    }
    try {
      chrome.topSites.get(function (items) {
        if (chrome.runtime && chrome.runtime.lastError) {
          toast('读取常用网站失败，保留现在的快捷方式');
          return;
        }
        var list = [];
        (items || []).forEach(function (item) {
          var url = safeUrl(item && item.url);
          if (!url) return;
          var host = '';
          try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { host = url; }
          var title = String((item && item.title) || '').trim() || host;
          if (list.some(function (x) { return x.url === url; })) return;
          list.push({ title: title, url: url });
        });
        list = list.slice(0, 10);
        if (!list.length) {
          toast('没有读到常用网站，保留现在的快捷方式');
          return;
        }
        sites = list;
        localSet('lgShortcuts', sites);
        localSet('lgSitesCustomized', true);
        renderSites();
        toast('已恢复 ' + list.length + ' 个常用网站');
      });
    } catch (e) {
      toast('读取常用网站失败，保留现在的快捷方式');
    }
  }

  function requestTopSites() {
    if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.permissions.request) {
      toast('当前环境不能读取常用网站');
      return;
    }
    try {
      chrome.permissions.request({ permissions: ['topSites'] }, function (granted) {
        if (chrome.runtime && chrome.runtime.lastError) {
          toast('授权失败，保留现在的快捷方式');
          return;
        }
        if (!granted) {
          toast('没有授权，保留现在的快捷方式');
          return;
        }
        $('restoreSites').classList.remove('accent');
        loadTopSites();
      });
    } catch (e) {
      toast('授权失败，保留现在的快捷方式');
    }
  }

  function maybeRestore() {
    if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.permissions.contains) return;
    try {
      chrome.permissions.contains({ permissions: ['topSites'] }, function (granted) {
        $('restoreSites').classList.toggle('accent', !granted);
        if (!granted) return;
        localGet('lgSitesCustomized').then(function (customized) {
          if (!customized) loadTopSites();
        });
      });
    } catch (e) { /* ignore */ }
  }

  function openDialog() {
    addOpen = true;
    $('dialogError').textContent = '';
    $('siteName').value = '';
    $('siteUrl').value = '';
    $('dialog').hidden = false;
    window.setTimeout(function () { $('siteName').focus(); }, 40);
  }

  function closeDialog() {
    addOpen = false;
    $('dialog').hidden = true;
  }

  function bindSites() {
    localGet('lgShortcuts').then(function (list) {
      sites = Array.isArray(list) ? list : DEFAULT_SITES.slice();
      renderSites();
      maybeRestore();
    });

    $('addSite').addEventListener('click', openDialog);
    $('restoreSites').addEventListener('click', requestTopSites);
    $('cancelAdd').addEventListener('click', closeDialog);

    $('dialog').addEventListener('click', function (e) {
      if (e.target === $('dialog')) closeDialog();
    });

    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var title = $('siteName').value.trim();
      var raw = $('siteUrl').value.trim();
      if (!raw) {
        $('dialogError').textContent = '请输入网址';
        $('siteUrl').focus();
        return;
      }
      if (sites.length >= 10) {
        $('dialogError').textContent = '最多 10 个快捷网站，先删一个再加';
        return;
      }
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
      var url = safeUrl(raw);
      if (!url) {
        $('dialogError').textContent = '网址格式不对，试试 https://example.com';
        $('siteUrl').focus();
        return;
      }
      var host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (err) { host = url; }
      sites.push({ title: title || host, url: url });
      localSet('lgShortcuts', sites);
      localSet('lgSitesCustomized', true);
      renderSites();
      closeDialog();
    });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */
  function boot() {
    tick();
    window.setInterval(tick, 15000);

    root.dataset.bg = 'aurora';
    applyTheme();
    applyGlass();
    bindSites();

    $('searchForm').addEventListener('submit', function (e) {
      var q = $('q').value.trim();
      if (!q) {
        e.preventDefault();
        $('q').focus();
        return;
      }
      $('q').value = q;
    });

    $('refresh').addEventListener('click', function () { loadWallpaper(true); });

    $('settings').addEventListener('click', function () {
      try { chrome.runtime.openOptionsPage(); } catch (e) { /* ignore */ }
    });

    $('bgBtn').addEventListener('click', function () {
      try { window.open(chrome.runtime.getURL('options.html#background'), '_blank', 'noopener'); }
      catch (e) { /* ignore */ }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && addOpen) closeDialog();
      if (e.key === '/' && !addOpen && document.activeElement !== $('q')) {
        e.preventDefault();
        $('q').focus();
      }
    });

    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', function () { if (cfg.theme === 'auto') applyTheme(); });
    } catch (e) { /* ignore */ }

    if (!S) { loadWallpaper(false); return; }

    var bootTimer = window.setTimeout(function () { loadWallpaper(false); }, 2500);

    Promise.all([S.load(), S.getBackground()]).then(function (result) {
      window.clearTimeout(bootTimer);
      cfg = result[0];
      customBg = result[1] || '';
      if (cfg.bgMode === 'custom' && !customBg) {
        cfg.bgMode = 'aurora';
        S.save(cfg);
      }
      applyTheme();
      applyGlass();
      loadWallpaper(false);
    }).catch(function () {
      window.clearTimeout(bootTimer);
      applyTheme();
      applyGlass();
      loadWallpaper(false);
    });

    S.onBackgroundChange(function (url) {
      customBg = url || '';
      if (!customBg && cfg.bgMode === 'custom') {
        cfg.bgMode = 'aurora';
        S.save(cfg);
      }
      loadWallpaper(false);
    });

    S.onChange(function (next) {
      var modeChanged = next.bgMode !== cfg.bgMode;
      cfg = next;
      applyTheme();
      applyGlass();
      if (modeChanged) loadWallpaper(false);
    });
  }

  boot();
})();
