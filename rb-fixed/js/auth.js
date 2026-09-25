(function () {
'use strict';
function $(s, c) { return (c || document).querySelector(s); }
function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

window.RBSession = { loading: true, ok: false, user: null, fb: null, game: null, botOnline: false };

function loginBtnHTML(next) {
  var n = next || (location.pathname + location.search);
  return '<a class="btn sm solid" href="/api/auth/discord/start?next=' + encodeURIComponent(n) + '" style="white-space:nowrap"><i class="fa-brands fa-discord"></i><span data-i18n="tr">Discord ile Giriş</span><span data-i18n="en">Login with Discord</span></a>';
}
function chipHTML(u) {
  return '<span class="rb-discord-chip">'
    + '<a href="/risebunny#hesabim" title="Hesabım"><img src="' + u.avatar + '" alt=""></a>'
    + '<a href="#" class="rb-logout" title="Çıkış"><i class="fa-solid fa-right-from-bracket"></i></a>'
    + '</span>';
}

document.addEventListener('click', function (e) {
  var a = e.target.closest ? e.target.closest('a.rb-logout, #btn-logout2, a[href*="/api/me?logout=1"]') : null;
  if (!a) return;
  e.preventDefault();
  if (window.RBLogin) { window.RBLogin.cikis(); return; }
  fetch('/api/me?logout=1').then(function () { location.reload(); }).catch(function () { location.reload(); });
});

var __restoring = false;
function restoreFromFirebase() { try { if (window.RBLogin) window.RBLogin.init(); } catch (e) {} }

var __bridgeRun = false;
function forumBridge(s) {
  try { if (window.RBLogin) window.RBLogin.init(); } catch (e) {}
}

function paint() {
  var s = window.RBSession;
  var next = location.pathname + location.search;
  $all('[data-auth-slot]').forEach(function (el) {
    el.innerHTML = s.ok ? chipHTML(s.user) : loginBtnHTML(next);
  });

  var nav = document.getElementById('rb-nav-user');
  if (nav && !document.getElementById('rb-discord-slot')) {
    var sp = document.createElement('span');
    sp.id = 'rb-discord-slot';
    sp.style.cssText = 'display:inline-flex;align-items:center;margin-right:8px';
    nav.parentNode.insertBefore(sp, nav);
  }
  var fs = document.getElementById('rb-discord-slot');
  if (fs) fs.innerHTML = s.ok
    ? '<a href="/risebunny#hesabim" class="rb-dbtn" title="Hesabım"><img src="' + s.user.avatar + '" alt=""><span>' + s.user.username.replace(/[<>&"]/g, '') + (s.user.premium ? ' <span class="rb-premium-badge-inline">Premium</span>' : '') + '</span></a>'
    : '<a href="/api/auth/discord/start?next=' + encodeURIComponent(next) + '" class="rb-dbtn" title="Discord ile giriş"><i class="fa-brands fa-discord"></i><span data-i18n="tr">Discord</span><span data-i18n="en">Discord</span></a>';

  if (document.getElementById('rb-nav-user')) {
    $all('a.rb-loginbtn').forEach(function (b) {
      if (s.ok) { b.style.display = 'none'; }
      else {
        b.setAttribute('href', '/api/auth/discord/start?next=' + encodeURIComponent(next));
        b.innerHTML = '<i class="fa-brands fa-discord"></i><span data-i18n="tr">Discord ile Giriş</span><span data-i18n="en">Login with Discord</span>';
      }
    });
  }

  syncLangBtns();
  try { window.dispatchEvent(new CustomEvent('rb-session', { detail: s })); } catch (e) {}
}

function syncLangBtns() {
  var cur = localStorage.getItem('rb-lang') || 'tr';
  document.documentElement.lang = cur;
  $all('.lang-btn, [data-lang]').forEach(function (b) {
    var isTr = b.dataset.lang === 'tr' || b.id === 'flang-tr';
    var isEn = b.dataset.lang === 'en' || b.id === 'flang-en';
    if (isTr) b.classList.toggle('active', cur === 'tr');
    if (isEn) b.classList.toggle('active', cur === 'en');
  });

  $all('[data-i18n="tr"], [data-i18n="en"]').forEach(function (el) {
    if (el.dataset.i18n === cur) el.style.display = 'inline';
    else el.style.display = 'none';
  });
  $all('[data-i18n-block="tr"], [data-i18n-block="en"]').forEach(function (el) {
    if (el.dataset.i18nBlock === cur) el.style.display = 'block';
    else el.style.display = 'none';
  });

  $all('[data-tr]').forEach(function (el) {
    var val = el.getAttribute(cur === 'tr' ? 'data-tr' : 'data-en');
    if (val !== null) el.textContent = val;
  });
}

window.rbSetLang = function(l) {
  var cur = (l === 'en') ? 'en' : 'tr';
  try { localStorage.setItem('rb-lang', cur); } catch (e) {}
  syncLangBtns();

  try { if (window.RB && typeof window.RB.setLang === 'function') window.RB.setLang(cur); } catch (e) {}

  try { window.dispatchEvent(new CustomEvent('rb-lang-change', { detail: cur })); } catch (e) {}
  try { if (typeof route === 'function') route(); } catch (e) {}
  var hero = document.getElementById('forum-hero');
  if (hero) hero.style.display = (window.RBSession && window.RBSession.ok) ? 'none' : 'block';
};

function __rbPaintFromSession() {
  try { paint(); } catch (e) {}
  try {
    var el = document.getElementById('bridge-state');
    if (el && window.RBLogin) {
      var d = window.RBLogin.durum();
      if (d.cookie && !d.firebase) el.textContent = d.bridgeHata ? ('Bağlantı hatası (' + d.bridgeHata + ') — sayfayı yenile.') : 'Discord hesabın bağlanıyor…';
      else if (!d.cookie && !d.firebase) el.textContent = '';
    }
  } catch (e) {}
}
function loadSession() {
  if (window.RBLogin) {
    try {
      document.addEventListener('rb-login', __rbPaintFromSession);
      document.addEventListener('rb-session', __rbPaintFromSession);
    } catch (e) {}
    window.RBLogin.init().then(function () { __rbPaintFromSession(); }).catch(function () { __rbPaintFromSession(); });
    return;
  }
  fetch('/api/me').then(function (r) { return r.json(); }).then(function (j) {
    window.RBSession = { loading: false, ok: !!j.ok, user: j.user || null, fb: j.fb || null, game: j.game || null, botOnline: !!j.botOnline, botNeden: j.botNeden || null };
    paint();
  }).catch(function () {
    window.RBSession = { loading: false, ok: false, user: null, fb: null, game: null, botOnline: false };
    paint();
  });
}

loadSession();

var css = '.rb-discord-chip{display:inline-flex;align-items:center;gap:8px}'
  + '.rb-discord-chip img{width:32px;height:32px;border-radius:50%;display:block;border:2px solid #5865F2}'
  + '.rb-discord-chip .rb-logout{color:#6b7280;font-size:.9rem}'
  + '.rb-premium-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:.65rem;font-weight:700;color:#fff;background:linear-gradient(90deg,#f59e0b,#fbbf24);margin-left:4px;white-space:nowrap}'
  + '.rb-dbtn{display:inline-flex;align-items:center;gap:7px;padding:6px 12px 6px 6px;border:1px solid #e5e7eb;border-radius:999px;font-size:.8rem;font-weight:600;color:#111827;background:#fff;text-decoration:none}'
  + '.rb-dbtn img{width:26px;height:26px;border-radius:50%;display:block}'
  + '.rb-dbtn i{color:#5865F2;font-size:1rem;margin-left:4px}'
  + '.rb-premium-badge-inline{display:inline-flex;align-items:center;padding:1px 6px;border-radius:999px;font-size:.6rem;font-weight:700;color:#fff;background:linear-gradient(90deg,#f59e0b,#fbbf24);margin-left:4px;white-space:nowrap}';
var st = document.createElement('style');
st.textContent = css;
(document.head || document.documentElement).appendChild(st);
})();
