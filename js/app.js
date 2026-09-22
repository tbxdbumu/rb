/*! RiseBunny app v12 — Lusion-minimal UI (secure render, original copy) — OFFLINE/STATIC */
(function () {
'use strict';
var $ = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function safeUrl(u, allowData) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^javascript:/i.test(u) || /^data:text\/html/i.test(u) || /^vbscript:/i.test(u)) return '';
  if (allowData && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(u)) return u;
  if (/^https:\/\//i.test(u) || /^\//.test(u) || /^#/.test(u)) return u;
  if (/^mailto:/i.test(u)) return u;
  return '';
}
function clean(v) { return (typeof v === 'string' && v.trim() !== '') ? v.trim() : ''; }

var I18N_DICT = {
  en: { nav_arena: 'Rubidium', nav_bot: 'Mod Bot', nav_sys: 'Systems', nav_faq: 'FAQ', nav_contact: 'Contact',
    hero_badge: 'RiseBunny Software',
    hero_title: 'Rise Beyond Limits.',
    hero_sub: 'Discord bots, Minecraft clients, Brawl Stars projects — one RiseBunny crew.',
    btn_explore: 'Explore the Lab', btn_learn: 'Meet the Crew', scroll_cue: 'Scroll to explore',
    sec_mc: 'Minecraft',
    arena_title: 'Rubidium V4',
    arena_desc: 'A ghost client for closet players: legit-looking combat modules, in-game ClickGUI and ready configs — Vape V4 and Rise class, free.',
    arena_f1: 'Ghost-focused', arena_f2: 'ClickGUI + configs', arena_f3: 'Fully free',
    arena_cta: 'Get It', arena_hint: 'Scroll — the warrior behind moves with you.',
    bot_title: 'RiseBunny Bot — Live 24/7.',
    bot_desc: 'Our multi-purpose Discord bot, live on top.gg: AI registration, subscriber roles, economy, moderation and automated raid protection — updated non-stop.',
    demo_msg1: 'anyone up for ranked?', demo_msg2: 'you suck',
    bot_flagged: 'Message flagged → removed.', bot_banned: 'USER BANNED',
    bot_cta: 'Invite', bot_replay: 'Replay moderation',
    feat_title: 'Why RiseBunny Never Sleeps', feat_sub: 'Four obsessions behind every release.',
    faq_title: 'Questions? We Answer Fast.',
    con_title: 'Got an Idea? Let Us Build It.', con_sub: 'Feedback, collabs, bug reports or wild ideas — the inbox is open.',
    lbl_name: 'Name', lbl_email: 'Email', lbl_subject: 'Subject', lbl_message: 'Message',
    ph_name: 'Your name', ph_email: 'you@example.com', ph_subject: 'Subject', ph_message: 'Your message...',
    btn_send: 'Send It', form_success: 'Message landed!', form_mailto: 'Opening your mail app…',
    form_login: 'Sign in with Discord to send a message.',
    form_note: 'Encrypted end-to-end. No spam, ever.',
    form_rate: 'Please wait a minute before sending again.', form_invalid: 'Please fill all fields correctly.',
    discord_title: 'Join the War Room', discord_desc: 'New builds drop on our Discord first. The invite link lands here very soon.',
    footer_nav: 'Navigation', footer_legal: 'Legal',
    privacy: 'Privacy Policy', terms: 'Terms of Service',
    copyright: '© 2026 RiseBunny. All rights reserved.', footer_slogan: 'Rise Beyond Limits.',
    modal_features: 'Under the Hood', btn_community: 'Join the Crew', btn_invite: 'Invite', btn_download: 'Cooking…', btn_download_now: 'Get It',
    status_dev: 'In the Lab', status_project: 'Prototype', status_active: 'Live 24/7' },
  tr: { nav_arena: 'Rubidium', nav_bot: 'Mod Bot', nav_sys: 'Sistemler', nav_faq: 'SSS', nav_contact: 'İletişim',
    hero_badge: 'RiseBunny Software',
    hero_title: 'Sınırların Ötesine Yüksel.',
    hero_sub: 'Discord botları, Minecraft istemcileri, Brawl Stars projeleri — tek RiseBunny ekibi.',
    btn_explore: 'Laboratuvarı Keşfet', btn_learn: 'Ekiple Tanış', scroll_cue: 'Keşfetmek için kaydır',
    sec_mc: 'Minecraft',
    arena_title: 'Rubidium V4',
    arena_desc: 'Closet oyuncular için ghost client: legit görünen combat modülleri, oyun içi ClickGUI ve hazır configler — Vape V4 ve Rise ayarında, ücretsiz.',
    arena_f1: 'Ghost odaklı', arena_f2: 'ClickGUI + configler', arena_f3: 'Tamamen ücretsiz',
    arena_cta: 'İndir', arena_hint: 'Kaydır — arkadaki savaşçı seninle hareket eder.',
    bot_title: 'RiseBunny Bot — 7/24 Yayında.',
    bot_desc: "top.gg'de yayında olan çok amaçlı Discord botumuz: Yapay zeka kayıt, abone rol sistemi, ekonomi, moderasyon ve otomatik koruma — sürekli güncel.",
    demo_msg1: 'ranked giren var mı?', demo_msg2: 'lanet olsun / küfür',
    bot_flagged: 'Mesaj işaretlendi → silindi.', bot_banned: 'KULLANICI BANLANDI',
    bot_cta: 'Davet Et', bot_replay: 'Moderasyonu tekrarla',
    feat_title: 'RiseBunny Neden Uyumaz?', feat_sub: 'Her sürümün arkasındaki dört takıntı.',
    faq_title: 'Sorun mu Var? Hızlı Cevaplar.',
    con_title: 'Fikrin mi Var? Biz İnşa Edelim.', con_sub: 'Geri bildirim, iş birliği, hata raporu ya da çılgın fikirler — kutu açık.',
    lbl_name: 'İsim', lbl_email: 'E-posta', lbl_subject: 'Konu', lbl_message: 'Mesaj',
    ph_name: 'Adınız', ph_email: 'ornek@eposta.com', ph_subject: 'Konu', ph_message: 'Mesajınız...',
    btn_send: 'Gönder', form_success: 'Mesaj ulaştı!', form_mailto: 'E-posta uygulaması açılıyor…',
    form_login: 'Mesaj göndermek için Discord ile giriş yap.',
    form_note: 'Uçtan uca şifreli. Spam yok, asla.',
    form_rate: 'Tekrar göndermeden önce bir dakika bekle.', form_invalid: 'Lütfen tüm alanları doğru doldur.',
    discord_title: 'Komuta Merkezine Katıl', discord_desc: 'Yeni buildler ilk olarak Discord sunucumuzda paylaşılır. Davet linki çok yakında burada.',
    footer_nav: 'Navigasyon', footer_legal: 'Yasal',
    privacy: 'Gizlilik Politikası', terms: 'Kullanım Şartları',
    copyright: '© 2026 RiseBunny. Tüm hakları saklıdır.', footer_slogan: 'Sınırların Ötesine Yüksel.',
    modal_features: 'Kaputun Altında', btn_community: 'Ekibe Katıl', btn_invite: 'Davet Et', btn_download: 'Pişiyor…', btn_download_now: 'İndir',
    status_dev: 'Laboratuvarda', status_project: 'Prototip', status_active: '7/24 Yayında' }
};

var RD = window.RB_DATA || { products: [], faqs: [], features: [] };
var PRODUCTS = JSON.parse(JSON.stringify(RD.products || []));
var FAQS = JSON.parse(JSON.stringify(RD.faqs || []));
var FEATURES = JSON.parse(JSON.stringify(RD.features || []));
var OVR = { en: {}, tr: {} };
var CFG = { defaultLang: 'en', fallbackEmail: 'info@risebunny.com', social: { discord: 'https://dsc.gg/risebunny' } };
var BANNER = null;
var LANG = localStorage.getItem('rb-lang') || 'tr';
if (LANG !== 'tr' && LANG !== 'en') LANG = 'tr';

function t(k) {
  var o = OVR[LANG] && OVR[LANG][k];
  if (o) return o;
  return (I18N_DICT[LANG] && I18N_DICT[LANG][k]) || I18N_DICT.en[k] || k;
}

/* Systems rows (admin Features) */
function renderSystems() {
  var grid = $('#sys-grid'); if (!grid) return;
  grid.innerHTML = '';
  var sorted = FEATURES.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  if (!sorted.length) { grid.textContent = '—'; return; }
  sorted.forEach(function (f, i) {
    var li = document.createElement('li');
    var b = document.createElement('b'); b.textContent = '0' + (i + 1); li.appendChild(b);
    var s = document.createElement('span'); s.textContent = (f.title && (f.title[LANG] || f.title.en)) || ''; li.appendChild(s);
    var d = document.createElement('span'); d.textContent = (f.desc && (f.desc[LANG] || f.desc.en)) || ''; li.appendChild(d);
    grid.appendChild(li);
  });
}
function renderSSS() {
  var list = $('#sss-list'); if (!list) return;
  list.innerHTML = '';
  FAQS.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (f) {
    var item = document.createElement('div'); item.className = 'faq-item';
    var q = document.createElement('button'); q.type = 'button'; q.className = 'faq-q';
    q.appendChild(document.createTextNode((f.q && (f.q[LANG] || f.q.en)) || ''));
    var ic = document.createElement('i'); ic.className = 'fa-solid fa-plus'; q.appendChild(ic);
    var a = document.createElement('div'); a.className = 'faq-a';
    var w = document.createElement('div'); var pp = document.createElement('p');
    pp.textContent = (f.a && (f.a[LANG] || f.a.en)) || '';
    w.appendChild(pp); a.appendChild(w);
    q.addEventListener('click', function () { item.classList.toggle('open'); });
    item.appendChild(q); item.appendChild(a); list.appendChild(item);
  });
}
function renderSocials() {
  var el = $('#social-links'); if (!el) return;
  el.innerHTML = '';
  var icons = { discord: 'fa-brands fa-discord', telegram: 'fa-brands fa-telegram', youtube: 'fa-brands fa-youtube', tiktok: 'fa-brands fa-tiktok' };
  Object.keys(CFG.social || {}).forEach(function (k) {
    var url = safeUrl(CFG.social[k], false);
    if (!url || !icons[k]) return;
    var a = document.createElement('a'); a.className = 'social-link'; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', k);
    var i = document.createElement('i'); i.className = icons[k]; a.appendChild(i); el.appendChild(a);
  });
}
function renderBanner() {
  var el = $('#site-banner'); if (!el) return;
  var closed = false;
  try { closed = sessionStorage.getItem('banner_closed') === '1'; } catch (e) {}
  if (!BANNER || !BANNER.enabled || closed) { el.hidden = true; document.body.classList.remove('has-banner'); return; }
  var text = (BANNER.text && (BANNER.text[LANG] || BANNER.text.en)) || '';
  if (!text) { el.hidden = true; return; }
  el.className = 'site-banner type-' + (/^(info|warning|success)$/.test(BANNER.type) ? BANNER.type : 'info');
  el.innerHTML = '';
  var sp = document.createElement('span'); sp.textContent = text; el.appendChild(sp);
  var link = safeUrl(BANNER.link, false);
  if (link) { var a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '→'; el.appendChild(a); }
  var x = document.createElement('button'); x.type = 'button'; x.className = 'banner-close'; x.setAttribute('aria-label', 'Close');
  x.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  x.addEventListener('click', function () { el.hidden = true; document.body.classList.remove('has-banner'); try { sessionStorage.setItem('banner_closed', '1'); } catch (e) {} });
  el.appendChild(x);
  el.hidden = false; document.body.classList.add('has-banner');
}
function openModal(id) {
  var p = null;
  for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) p = PRODUCTS[i];
  if (!p) return;
  $('#m-title').textContent = String(p.name || '');
  var tg = $('#m-tags'); tg.innerHTML = '';
  var st = document.createElement('span'); st.className = 'status-pill st-' + ((/^(active|dev|project)$/.test(p.status)) ? p.status : 'dev'); st.textContent = t('status_' + p.status); tg.appendChild(st);
  var pf = document.createElement('span'); pf.className = 'tag-plat'; pf.textContent = String(p.platform || ''); tg.appendChild(pf);
  $('#m-desc').textContent = (p.desc && (p.desc[LANG] || p.desc.en)) || '';
  var feats = (p.features && (p.features[LANG] || p.features.en)) || [];
  $('#m-feat-title').textContent = feats.length ? t('modal_features') : '';
  var fe = $('#m-features'); fe.innerHTML = '';
  feats.slice(0, 12).forEach(function (f) { var d = document.createElement('div'); d.className = 'mf'; var ic = document.createElement('i'); ic.className = 'fa-solid fa-check'; d.appendChild(ic); d.appendChild(document.createTextNode(String(f))); fe.appendChild(d); });
  var act = $('#modal-actions'); act.innerHTML = '';
  var inv = safeUrl(p.invite, false);
  if (inv) { var ai = document.createElement('a'); ai.className = 'btn solid sm'; ai.href = inv; ai.target = '_blank'; ai.rel = 'noopener'; ai.textContent = '🤖 ' + t('btn_invite'); act.appendChild(ai); }
  var dl = safeUrl(p.download, false);
  if (dl) { var a = document.createElement('a'); a.className = 'btn solid sm'; a.href = dl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '⬇ ' + t('btn_download_now'); act.appendChild(a); }
  else { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn solid sm'; b.disabled = true; b.textContent = t('btn_download'); act.appendChild(b); }
  var c2 = document.createElement('a'); c2.className = 'btn line sm'; c2.href = '#iletisim'; c2.textContent = t('btn_community');
  c2.addEventListener('click', closeModal); act.appendChild(c2);
  $('#modal').classList.add('open');
}
function closeModal() { var m = $('#modal'); if (m) m.classList.remove('open'); }
var mc = $('#modal-close'); if (mc) mc.addEventListener('click', closeModal);
var mo = $('#modal'); if (mo) mo.addEventListener('click', function (e) { if (e.target === mo) closeModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-open-product]') : null;
  if (!b) return;
  var pid = b.getAttribute('data-open-product');
  var p = null;
  for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === pid) p = PRODUCTS[i];
  var inv0 = p ? safeUrl(p.invite, false) : '';
  if (inv0) {
    window.open(inv0, '_blank', 'noopener');
    return;
  }
  var dl = p ? safeUrl(p.download, false) : '';
  if (dl) {
    window.open(dl, '_blank', 'noopener');
    return;
  }
  openModal(pid);
});

function toast(msg, type) {
  type = /^(success|error|info)$/.test(type) ? type : 'info';
  var el = document.createElement('div'); el.className = 'toast toast-' + type;
  var sp = document.createElement('span'); sp.textContent = String(msg);
  el.appendChild(sp);
  var w = $('#toast-wrap'); if (w) w.appendChild(el);
  requestAnimationFrame(function () { el.classList.add('show'); });
  setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 350); }, 4200);
}

function setLang(l) {
  LANG = (l === 'tr') ? 'tr' : 'en';
  try { localStorage.setItem('rb-lang', LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  document.title = LANG === 'tr' ? 'RiseBunny | Sınırların Ötesine Yüksel' : 'RiseBunny | Rise Beyond Limits';
  $$('[data-i18n]').forEach(function (el) { var v = t(el.getAttribute('data-i18n')); if (v) el.textContent = v; });
  $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  $$('.lang-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === LANG); });
  renderSystems(); renderSSS(); renderBanner();
}
window.RB = { setLang: setLang };
$$('.lang-btn').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

/* secret footer entry (ANASAYFA) → rol duyarlı yönlendirme, 5 tık
   - 2 yetkiliden biri (Discord cookie) veya kurucu rolü → admin.html (jetonlu)
   - moderator+ site rolü → forum.html#/mod
   - girişsiz/yetkisiz → SESSİZ, hiçbir şey olmaz (görsel ipucu YOK) */
(function secretEntry() {
  var foot = document.getElementById('foot-base') || document.querySelector('.site-footer .footer-base') || document.querySelector('.site-footer') || document.querySelector('footer.site-footer');
  if (!foot || foot.__rbTap) return;
  foot.__rbTap = true;
  var taps = 0, timer = null;
  foot.addEventListener('click', function () {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(function () { taps = 0; }, 2500);
    if (taps < 5) return;
    taps = 0;
    cozVeGit();
  });
  function jeton() {
    try {
      sessionStorage.setItem('rb_admin_token', '1');
      sessionStorage.setItem('rb_admin_time', String(Date.now()));
    } catch (e) {}
  }
  function bekle(p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms || 4000); })]);
  }
  async function cozVeGit() {
    try {
      // 1) Discord cookie oturumu: 2 yetkiliden biri mi?
      var s = await bekle(fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return null; }), 4000);
      if (s && s.ok && s.user && ['985126554306773063', '1310366324731547798'].indexOf(String(s.user.id)) > -1) {
        jeton();
        window.location.href = 'admin.html';
        return;
      }
      // 2) Firebase oturumu + site rolü
      if (window.firebase && firebase.auth && firebase.apps && firebase.apps.length) {
        var u = null;
        try { u = firebase.auth().currentUser; } catch (e) {}
        if (u) {
          if ((window.ADMIN_UIDS || []).indexOf(u.uid) > -1) {
            jeton();
            window.location.href = 'admin.html';
            return;
          }
          try {
            var doc = await bekle(firebase.firestore().collection('users').doc(u.uid).get(), 4000);
            var rol = (doc && doc.exists && doc.data().role) || 'member';
            if (rol === 'kurucu') {
              jeton();
              window.location.href = 'admin.html';
              return;
            }
            var W = { member: 1, vip: 2, developer: 2, moderator: 3, kurucu: 5 };
            if ((W[rol] || 1) >= 3) {
              window.location.href = 'forum.html#/mod';
              return;
            }
          } catch (e) {}
        }
      }
      // 3) yetkisiz/girişsiz → SESSİZ
    } catch (e) {}
  }
})();

/* slim mod replay (visual only) */
function replayMod() {
  var toxic = document.querySelector('#mod-demo .feed-line.toxic');
  var badge = $('#ban-badge');
  var sys = document.querySelector('#mod-demo .feed-line.sys');
  if (!toxic || !badge) return;
  var txt = toxic.querySelector('.txt');
  toxic.classList.remove('struck'); badge.classList.remove('show');
  if (sys) sys.style.opacity = '0.5';
  if (txt) txt.textContent = t('demo_msg2');
  void toxic.offsetWidth;
  setTimeout(function () {
    toxic.classList.add('struck');
    if (txt) txt.textContent = (LANG === 'tr' ? 'küfür silindi ✗' : 'profanity removed ✗');
    if (sys) sys.style.opacity = '1';
  }, 750);
  setTimeout(function () { badge.classList.add('show'); }, 1700);
}
var replayBtn = $('#btn-replay-mod');
if (replayBtn) replayBtn.addEventListener('click', replayMod);
setTimeout(replayMod, 1400);

/* nav */
var burger = $('#burger'), navLinks = $('#nav-links');
if (burger && navLinks) burger.addEventListener('click', function () {
  var open = navLinks.classList.toggle('open');
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
window.addEventListener('scroll', function () {
  var nav = $('#navbar');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  var ids = ['gate', 'arena', 'botcore', 'sistemler', 'sss', 'iletisim'];
  var cur = ids[0];
  ids.forEach(function (id) { var el = document.getElementById(id); if (el && window.scrollY + window.innerHeight * 0.4 >= el.offsetTop) cur = id; });
  $$('#nav-links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + cur); });
}, { passive: true });

/* contact (Discord-only: konu + mesaj, kimlik cookie'den) */
function cooldown() {
  try { return Date.now() - parseInt(localStorage.getItem('rb_con_last') || '0', 10) < 60000; }
  catch (e) { return false; }
}
var form = $('#con-form');
function conLoginDurumu() {
  try {
    var note = $('#con-login-note');
    var giris = !!(window.RBSession && window.RBSession.ok);
    if (note) note.hidden = giris;
    var btn = $('#send-btn');
    if (btn) btn.disabled = !giris;
  } catch (e) {}
}
try { document.addEventListener('rb-session', conLoginDurumu); } catch (e) {}
try { document.addEventListener('rb-login', conLoginDurumu); } catch (e) {}
try { document.addEventListener('visibilitychange', function () { if (!document.hidden && window.RBLogin) window.RBLogin.yenile().catch(function () {}); }); } catch (e) {}
conLoginDurumu();
if (form) form.addEventListener('submit', function (e) {
  e.preventDefault();
  var hp = $('#n-hp'); if (hp && hp.value) return;
  if (!(window.RBSession && window.RBSession.ok)) { toast(t('form_login'), 'error'); conLoginDurumu(); return; }
  var subject = String($('#n-subj').value || '').trim().slice(0, 120);
  var message = String($('#n-msg').value || '').trim().slice(0, 2000);
  var lang = 'tr';
  try { lang = localStorage.getItem('rb-lang') || localStorage.getItem('rb_lang') || 'tr'; } catch (e2) {}
  if (!subject || message.length < 3) { toast(t('form_invalid'), 'error'); return; }
  if (cooldown()) { toast(t('form_rate'), 'error'); return; }
  var btn = $('#send-btn'); btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> …';
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: subject, message: message, lang: lang === 'en' ? 'en' : 'tr' })
  }).then(function (r) {
    if (r.status === 401) { toast(t('form_login'), 'error'); conLoginDurumu(); throw new Error('login'); }
    if (!r.ok) throw new Error('contact failed');
    try { localStorage.setItem('rb_con_last', String(Date.now())); } catch (e2) {}
    toast(t('form_success'), 'success');
    form.reset();
  }).catch(function (err) {
    if (err && err.message === 'login') return;
    toast(LANG === 'tr' ? 'Mesaj gönderilemedi.' : 'Message could not be sent.', 'error');
  }).finally(function () {
    btn.disabled = !(window.RBSession && window.RBSession.ok);
    btn.innerHTML = esc(t('btn_send')) + ' <i class="fa-solid fa-arrow-right"></i>';
  });
});

function startApp() {
  renderSocials();
  setLang(LANG);
  replayMod();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();
})();
