(function () {
  'use strict';
  if (window.__rbCoreLoaded) return;
  window.__rbCoreLoaded = true;

  if (/admin\.html(\?|$)/.test(location.pathname)) {
    var _tok = null;
    var _tim = 0;
    try {
      _tok = sessionStorage.getItem('rb_admin_token');
      _tim = parseInt(sessionStorage.getItem('rb_admin_time') || '0', 10) || 0;
    } catch (e) {}
    var _fresh = _tok === '1' && (Date.now() - _tim) < 5 * 60 * 1000;
    var _discordBack = /[?&]login=ok/.test(location.search);
    if (!_fresh && !_discordBack) {
      try {
        sessionStorage.removeItem('rb_admin_token');
        sessionStorage.removeItem('rb_admin_time');
      } catch (e2) {}
      show404();
      return;
    }
  }
  var FORCE_PREVIEW = /[?&]mnt=1/.test(location.search);

  function show404() {
    fetch('404.html').then(function (r) {
      if (!r.ok) throw 0;
      return r.text();
    }).then(function (h) {
      document.open();
      document.write(h);
      document.close();
    }).catch(function () {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050507;color:#fff;font-family:sans-serif;text-align:center;padding:20px"><div><h1 style="font-size:4rem;font-weight:800;letter-spacing:-.03em;margin:0">404</h1><p style="color:#9ca3af;margin:10px 0 26px">Page Not Found</p><a href="index.html" style="color:#06b6d4;text-decoration:none;font-weight:600">← Back to Home</a></div></div>';
    });
  }
  window.__rb404 = show404;

  function showMaintenance(msg) {
    if (document.getElementById('rb-maintenance')) return;
    var lang = 'en';
    try {
      lang = localStorage.getItem('rb-lang') || 'tr';
    } catch (e) {}
    if (lang !== 'tr' && lang !== 'en') lang = 'tr';
    var text = (msg && (msg[lang] || msg.tr || msg.en)) || 'Site geçici olarak bakımda. / Site is under maintenance.';
    var ov = document.createElement('div');
    ov.id = 'rb-maintenance';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#07040f;color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:24px;font-family:system-ui,sans-serif';
    var em = document.createElement('div');
    em.style.cssText = 'font-size:64px;animation:rbPulse 1.6s infinite';
    em.textContent = '🐰';
    var h = document.createElement('h1');
    h.style.cssText = 'margin:12px 0 4px;font-size:26px';
    h.textContent = lang === 'tr' ? '🔧 Bakım Modu' : '🔧 Maintenance';
    var p = document.createElement('p');
    p.style.cssText = 'color:#9ca3af;max-width:420px;line-height:1.6';
    p.textContent = text;
    var c = document.createElement('p');
    c.style.cssText = 'color:#4b5563;font-size:12px;margin-top:24px';
    c.textContent = '© 2026 RiseBunny';
    var st = document.createElement('style');
    st.textContent = '@keyframes rbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}';
    ov.appendChild(em);
    ov.appendChild(h);
    ov.appendChild(p);
    ov.appendChild(c);
    ov.appendChild(st);
    (document.body || document.documentElement).appendChild(ov);
    try {
      document.body.style.overflow = 'hidden';
    } catch (e) {}
  }
  function hideMaintenance() {
    var ov = document.getElementById('rb-maintenance');
    if (ov) ov.remove();
    try {
      document.body.style.overflow = '';
    } catch (e) {}
  }

  async function loadFirebaseConfig() {
    try {
      var resp = await fetch('/api/firebase-config');
      if (!resp.ok) throw new Error('Failed to load config');
      var cfg = await resp.json();
      window.firebaseConfig = cfg;
      return cfg;
    } catch (e) {
      show404();
      throw e;
    }
  }

  function init(cfg) {
    if (!window.firebase || !cfg || !cfg.projectId) {
      show404();
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    var auth = firebase.auth();
    var db = firebase.firestore();

    auth.onAuthStateChanged(function (u) {
      if (!u) return;
      try {
        db.collection('bans').doc(u.uid).get().then(function (snap) {
          if (snap.exists && snap.data().banned === true) {
            auth.signOut();
            show404();
          }
        }).catch(function () {});
      } catch (e) {}
    });

    function checkMaintenance(n) {
      n = n || 0;
      var req;
      try {
        req = db.collection('config').doc('maintenance').get();
      } catch (e) {
        if (n < 3) setTimeout(function () {
          checkMaintenance(n + 1);
        }, 1500);
        return;
      }
      req.then(function (s) {
        var d = (s && s.exists) ? s.data() : null;
        if ((!d || !d.active) && !FORCE_PREVIEW) return;
        showMaintenance(d && d.message);
        if (!auth) return;
        try {
          auth.onAuthStateChanged(function (u) {
            if (u) {
              fetch('/api/check-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: u.uid })
              }).then(function (r) {
                return r.json();
              }).then(function (data) {
                if (data && data.isAdmin) hideMaintenance();
                else showMaintenance(d && d.message);
              }).catch(function () {
                showMaintenance(d && d.message);
              });
            } else {
              showMaintenance(d && d.message);
            }
          });
        } catch (e) {}
      }).catch(function () {
        if (n < 3) setTimeout(function () {
          checkMaintenance(n + 1);
        }, 1500);
      });
    }
    checkMaintenance(0);
  }

  async function tryInit() {
    if (window.firebase && window.firebase.firestore) {
      var cfg = await loadFirebaseConfig();
      init(cfg);
    } else {
      setTimeout(tryInit, 100);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
