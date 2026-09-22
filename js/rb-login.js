/*! RiseBunny — Birleşik Discord SSO (v1)
   TEK giriş noktası: her sayfa bunu yükler, başka köprü kodu çalışmaz.
   - Cookie oturumu (/api/me) + Firebase Auth birlikte yönetilir
   - Herhangi bir sayfada Discord girişi → tüm sayfalarda tanınır
   - Çıkış ikisini birden kapatır
   Kullanım:
     <script src="js/rb-login.js?v=1"></script>
     RBLogin.init().then(state => { ... });
     // state: { cookie: null|{id,username,avatar,fb}, firebase: null|user, hazir: true }
     // Olay: window 'rb-login' (detail = state)
*/
(function () {
'use strict';

var DURUM = { cookie: null, firebase: null, hazir: false, bridgeHata: '' };
var BASLADI = false;

function olay() {
  try { window.RBSession = DURUM.cookie
    ? { loading: false, ok: true, user: DURUM.cookie, fb: DURUM.cookie.fb || null, game: DURUM.cookie.game || null, botOnline: !!DURUM.cookie.botOnline, botNeden: DURUM.cookie.botNeden || null }
    : { loading: false, ok: false, user: null, fb: null, game: null, botOnline: false, botNeden: null };
  } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('rb-login', { detail: DURUM })); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('rb-session', { detail: window.RBSession })); } catch (e) {}
}

function bekle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function firebaseHazirla() {
  try {
    if (!window.firebase || !firebase.auth) return false;
    if (!firebase.apps.length) {
      if (!window.firebaseConfig || !window.firebaseConfig.projectId) return false;
      firebase.initializeApp(window.firebaseConfig);
    }
    return true;
  } catch (e) { return false; }
}

async function cookieOku() {
  for (var i = 0; i < 3; i++) {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      const j = await r.json().catch(() => null);
      if (j && j.ok) {
        DURUM.cookie = {
          id: j.user.id, username: j.user.username, avatar: j.user.avatar,
          email: j.user.email || '', fb: j.fb || null,
          game: j.game || null, botOnline: !!j.botOnline, botNeden: j.botNeden || null
        };
        try { localStorage.setItem('rb_discord', JSON.stringify({ username: j.user.username || '' })); } catch (e) {}
        return true;
      }
      return false;
    } catch (e) { await bekle(800); }
  }
  return false;
}

async function firebaseKopru() {
  try {
    if (!firebaseHazirla()) { DURUM.bridgeHata = 'firebase-yok'; return false; }
    var au = firebase.auth();
    if (au.currentUser) { DURUM.firebase = au.currentUser; return true; }
    var fb = DURUM.cookie && DURUM.cookie.fb;
    if (!fb || !fb.email || !fb.pw) { DURUM.bridgeHata = 'kopru-bilgi-yok'; return false; }
    for (var i = 1; i <= 4; i++) {
      try {
        await au.signInWithEmailAndPassword(fb.email, fb.pw);
        DURUM.firebase = au.currentUser;
        DURUM.bridgeHata = '';
        return true;
      } catch (e) {
        var kod = (e && e.code) || 'bilinmiyor';
        DURUM.bridgeHata = kod;
        if (kod === 'auth/user-not-found' || kod === 'auth/invalid-credential') {
          try {
            await au.createUserWithEmailAndPassword(fb.email, fb.pw);
            await au.signInWithEmailAndPassword(fb.email, fb.pw);
            DURUM.firebase = au.currentUser;
            DURUM.bridgeHata = '';
            return true;
          } catch (e2) { DURUM.bridgeHata = (e2 && e2.code) || 'kayit-hatasi'; }
        }
        await bekle(1500);
      }
    }
    return false;
  } catch (e) { DURUM.bridgeHata = 'hata'; return false; }
}

async function cookieOnar() {
  // Firebase var ama cookie yok → cookie'yi Firebase'den geri yükle
  try {
    if (!firebaseHazirla()) return false;
    var u = firebase.auth().currentUser;
    if (!u) return false;
    const tok = await u.getIdToken().catch(() => null);
    if (!tok) return false;
    const r = await fetch('/api/session/restore', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok })
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j && j.ok) return cookieOku();
    return false;
  } catch (e) { return false; }
}

async function init() {
  if (BASLADI) return DURUM;
  BASLADI = true;
  try {
    firebaseHazirla();
    await cookieOku();
    if (DURUM.cookie) {
      await firebaseKopru();
    } else {
      // Cookie yok ama Firebase oturumu olabilir → cookie'yi onar
      try {
        if (window.firebase && firebase.auth && firebase.apps.length && firebase.auth().currentUser)
          await cookieOnar();
        else {
          // Firebase geç gelebilir; kısa bekle, bir şans daha ver
          await bekle(2500);
          if (firebaseHazirla()) {
            try { if (firebase.auth().currentUser) await cookieOnar(); } catch (e) {}
          }
        }
      } catch (e) {}
    }
    // Firebase Auth değişikliklerini dinle (başka sekmede giriş/çıkış)
    try {
      if (firebaseHazirla()) {
        firebase.auth().onAuthStateChanged(function (u) {
          DURUM.firebase = u || null;
          olay();
        });
      }
    } catch (e) {}
  } catch (e) {}
  DURUM.hazir = true;
  olay();
  return DURUM;
}

async function cikis() {
  try { await fetch('/api/me?logout=1', { credentials: 'same-origin' }).catch(() => {}); } catch (e) {}
  try { if (firebaseHazirla()) await firebase.auth().signOut().catch(() => {}); } catch (e) {}
  try { localStorage.removeItem('rb_discord'); } catch (e) {}
  try { sessionStorage.removeItem('rb_fadmin'); sessionStorage.removeItem('rb_admin_token'); sessionStorage.removeItem('rb_admin_time'); } catch (e) {}
  DURUM.cookie = null; DURUM.firebase = null;
  olay();
  location.reload();
}

function girisUrl(next) {
  var n = next || (location.pathname + location.search);
  return '/api/auth/discord/start?next=' + encodeURIComponent(n);
}

window.RBLogin = {
  init: init,
  durum: function () { return DURUM; },
  cikis: cikis,
  girisUrl: girisUrl,
  kopru: firebaseKopru,
  /* Başka sekmede giriş/çıkış olduysa veya sayfa odağa döndüyse yeniden tara */
  yenile: function () { BASLADI = false; DURUM.bridgeHata = ''; return init(); }
};

var __sonYenile = 0;
function odakYenile() {
  try {
    var simdi = Date.now();
    if (simdi - __sonYenile < 5000) return;
    __sonYenile = simdi;
    if (window.RBLogin) window.RBLogin.yenile().catch(function () {});
  } catch (e) {}
}
try {
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) odakYenile();
  });
  window.addEventListener('focus', odakYenile);
  window.addEventListener('storage', function (e) {
    if (e && (e.key === 'rb_discord' || e.key === null)) odakYenile();
  });
} catch (e) {}

/* OAuth dönüşü doğrulama: ?login=ok varsa cookie gerçekten yazılmış mı bak.
   Yazılmamışsa (nadir) sebebi göster, sessizce "girişli gibi" davranma. */
async function girisDogrula() {
  try {
    if (!/[?&]login=ok/.test(location.search)) return;
    for (var i = 0; i < 3; i++) {
      try {
        const j = await fetch('/api/me', { credentials: 'same-origin' }).then(x => x.json()).catch(() => null);
        if (j && j.ok) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} return; }
      } catch (e) {}
      await bekle(1200);
    }
    // Hâlâ yok → kullanıcıya söyle
    try {
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:#7f1d1d;color:#fff;font:13px/1.5 system-ui;padding:10px 16px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
      msg.textContent = '⚠️ Giriş kaydedilemedi (oturum çerezi yazılamadı). Gizli sekme/reklam engelleyiciyi kapatıp tekrar dene.';
      document.body.appendChild(msg);
      setTimeout(function () { try { msg.remove(); } catch (e) {} }, 9000);
    } catch (e) {}
  } catch (e) {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); girisDogrula(); });
else { init(); girisDogrula(); }
})();
