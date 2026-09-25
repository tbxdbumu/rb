(function () {
'use strict';
if (window.__rbMntLoaded) return; window.__rbMntLoaded = true;
try {
function isAdminUser(u) {
  if (window.__RB_ADMIN === true) return true;
  if (window.__rbAdminCheck) { try { return !!window.__rbAdminCheck(u); } catch (e) {} }
  return false;
}
function refreshAdminFlag(u) {
  var id = u && (u.uid || u.id);
  if (!id) { window.__RB_ADMIN = false; return Promise.resolve(false); }
  return fetch('/api/check-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: id, discordId: id }) })
    .then(function (r) { return r.json(); }).then(function (j) { window.__RB_ADMIN = !!(j && j.isAdmin); return window.__RB_ADMIN; })
    .catch(function () { window.__RB_ADMIN = false; return false; });
}
var FORCE = /[?&]mnt=1/.test(location.search);
var ov = document.createElement('div');
ov.id = 'rb-maintenance';
ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483647;background:#ffffff;color:#111827;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
ov.innerHTML = '<img src="images/bot.svg" alt="RiseBunny" style="width:68px;height:68px;margin-bottom:20px;animation:rbPulse 2s infinite">' +
  '<span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#2563eb;background:#eff6ff;padding:4px 12px;border-radius:999px;border:1px solid #bfdbfe;margin-bottom:12px;display:inline-block">Bakim Modu / Maintenance</span>' +
  '<h1 style="margin:8px 0 12px;font-size:28px;font-weight:800;letter-spacing:-.02em;color:#111827">Rise Beyond Limits.</h1>' +
  '<p id="rb-mnt-msg" style="color:#4b5563;max-width:480px;line-height:1.6;font-size:16px;margin:0 auto"></p>' +
  '<p style="color:#9ca3af;font-size:13px;margin-top:32px">2026 RiseBunny Software.</p>' +
  '<style>@keyframes rbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}</style>';
function mount() { if (!document.getElementById('rb-maintenance')) (document.body || document.documentElement).appendChild(ov); }
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
function showMaintenance(m) {
  var lang = 'tr';
  try { lang = localStorage.getItem('rb-lang') || 'tr'; } catch (e) {}
  var msg = (m && m.message) || {};
  var el = document.getElementById('rb-mnt-msg');
  if (el) el.textContent = msg[lang] || msg.tr || msg.en || 'Site gecici olarak bakimda. / Site is under maintenance.';
  ov.style.display = 'flex';
  try { document.body.style.overflow = 'hidden'; } catch (e) {}
}
function hideMaintenance() {
  ov.style.display = 'none';
  try { document.body.style.overflow = ''; } catch (e) {}
}
function loadSDK(src) { return new Promise(function (res) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = res; document.head.appendChild(s); }); }
function getConf() {
  if (window.firebaseConfig && window.firebaseConfig.projectId) return Promise.resolve(window.firebaseConfig);
  return fetch('/api/firebase-config', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
    if (j && j.projectId) { window.firebaseConfig = j; return j; }
    throw 0;
  });
}
function start() {
  getConf().catch(function () { return null; }).then(function (CONF) {
    if (!CONF) return;
    var p = (window.firebase && window.firebase.firestore) ? Promise.resolve()
      : loadSDK('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
        .then(function () { return loadSDK('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'); })
        .then(function () { return loadSDK('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'); });
    p.then(function () {
      try {
        var app;
        try { app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig, 'rb-mnt'); }
        catch (e) { try { app = firebase.app('rb-mnt'); } catch (e2) { return; } }
        var db = app.firestore(), auth = app.auth();
        function decide(data) {
          if (FORCE) { showMaintenance(data); return; }
          try {
            var decided = false;
            showMaintenance(data);
            auth.onAuthStateChanged(function (u) {
              if (!u) { if (!decided) { decided = true; showMaintenance(data); } return; }
              refreshAdminFlag(u).then(function (ok) {
                if (ok) { decided = true; hideMaintenance(); }
                else if (!decided) { decided = true; showMaintenance(data); }
              });
            });
          } catch (e) { showMaintenance(data); }
        }
        function check(n) {
          db.collection('config').doc('maintenance').get().then(function (s) {
            if (s.exists && s.data() && s.data().active) decide(s.data());
          }).catch(function () { if (n < 3) setTimeout(function () { check(n + 1); }, 1500); });
        }
        check(0);
        try {
          fetch('api/status').then(function (r) { return r.json(); }).then(function (st) {
            if (st && st.bakim) decide({ message: { tr: st.sebep || 'Site gecici olarak bakimda.', en: st.sebep || 'Site is under maintenance.' } });
          }).catch(function () {});
        } catch (e) {}
      } catch (e) {}
    });
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
function findBanner(el) {
  while (el && el !== document.body) {
    var id = el.id || '', cl = (typeof el.className === 'string') ? el.className : '';
    if (/banner|duyuru|announce/i.test(id) || /banner|duyuru|announce/i.test(cl)) return el;
    el = el.parentNode;
  }
  return null;
}
function hideBanner(ban) {
  ban.style.display = 'none';
  try { sessionStorage.setItem('rb_banner_hidden_text', (ban.textContent || '').trim().slice(0, 120)); } catch (e) {}
}
function bindClose(btn, ban) {
  if (btn.__rb) return; btn.__rb = true;
  btn.addEventListener('click', function (ev) {
    try { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } catch (e) {}
    hideBanner(ban);
  }, true);
}
document.addEventListener('click', function (e) {
  var t = e.target; if (!t || !t.closest) return;
  var btn = t.closest('button, [class*="close" i], .fa-xmark, .fa-times');
  if (!btn) return;
  var sig = (btn.className || '') + ' ' + (btn.innerHTML || '') + ' ' + (btn.textContent || '');
  if (!/close|times|xmark/i.test(sig) && btn.getAttribute('data-rb-x') !== '1') return;
  var ban = findBanner(btn);
  if (!ban || ban === document.body || ban.offsetHeight > 320 || ban.offsetHeight === 0) return;
  hideBanner(ban);
}, true);
function patchBanner() {
  var saved = null; try { saved = sessionStorage.getItem('rb_banner_hidden_text'); } catch (e) {}
  var nodes = document.querySelectorAll('[id*="banner" i], [class*="banner" i], [id*="duyuru" i], [class*="duyuru" i]');
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.id === 'rb-maintenance' || el.offsetHeight > 320 || el.offsetHeight === 0) continue;
    var txt = (el.textContent || '').trim().slice(0, 120);
    if (!txt || txt.length < 3) continue;
    try {
      if (saved && saved === txt) { el.style.display = 'none'; continue; }
      if (saved && saved !== txt) sessionStorage.removeItem('rb_banner_hidden_text');
      var btns = el.querySelectorAll('button, [class*="close" i], .fa-xmark, .fa-times');
      if (!btns.length) {
        var b = document.createElement('button');
        b.type = 'button'; b.innerHTML = 'X'; b.setAttribute('data-rb-x', '1');
        b.setAttribute('style', 'position:absolute;top:8px;right:10px;background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;z-index:10');
        el.style.position = 'relative'; el.appendChild(b);
        bindClose(b, el);
      } else {
        for (var j = 0; j < btns.length; j++) bindClose(btns[j], el);
      }
    } catch (e) {}
  }
}
var pn = 0, pi = setInterval(function () { pn++; patchBanner(); if (pn > 10) clearInterval(pi); }, 1000);
} catch (e) {}
})();
