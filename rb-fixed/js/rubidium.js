(function () {
'use strict';
var $ = function (s, c) { return (c || document).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

var LANG = 'tr';
try { LANG = localStorage.getItem('rb-lang') || 'tr'; } catch (e) {}
if (LANG !== 'tr' && LANG !== 'en') LANG = 'tr';

function setLang(l) {
  LANG = (l === 'en') ? 'en' : 'tr';
  try { localStorage.setItem('rb-lang', LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  $$('[data-tr]').forEach(function (el) {
    var v = el.getAttribute(LANG === 'tr' ? 'data-tr' : 'data-en');
    if (v !== null) el.textContent = v;
  });
  $$('.lang-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === LANG); });
  paintFeatures();
  paintFaq();
  paintScenario(cur);
}
$$('.lang-btn').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

(function secretEntry() {
  var foot = document.getElementById('foot-base');
  if (!foot) return;
  var taps = 0, timer = null;
  foot.addEventListener('click', function () {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(function () { taps = 0; }, 2500);
    if (taps >= 5) {
      taps = 0;
      try {
        sessionStorage.setItem('rb_admin_token', '1');
        sessionStorage.setItem('rb_admin_time', String(Date.now()));
      } catch (e) {}
      window.location.href = 'admin.html';
    }
  });
})();

var burger = $('#burger'), navLinks = $('#nav-links');
if (burger && navLinks) burger.addEventListener('click', function () {
  var open = navLinks.classList.toggle('open');
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});

var FEATS = [
  { i: '⚔️', t: { tr: 'Combat', en: 'Combat' }, d: { tr: 'Reach, AimAssist, AutoClicker, Velocity — legit görünen vuruş aralığı.', en: 'Reach, AimAssist, AutoClicker, Velocity — legit-looking hit range.' }, c: 'reach: 3.0–3.4 (ghost)' },
  { i: '💨', t: { tr: 'Movement', en: 'Movement' }, d: { tr: 'Speed, Fly, Scaffold, NoFall — köprü ve strafe senaryoları için.', en: 'Speed, Fly, Scaffold, NoFall — for bridging and strafe scenarios.' }, c: 'scaffold: legit-delay' },
  { i: '👁️', t: { tr: 'Visual / ESP', en: 'Visuals / ESP' }, d: { tr: 'ESP, Tracers, HUD — rakipleri duvar arkasında gör, bilgi üstünlüğü kur.', en: 'ESP, Tracers, HUD — see rivals through walls, own the info game.' }, c: 'esp: player-box' },
  { i: '🧰', t: { tr: 'Utility + ClickGUI', en: 'Utility + ClickGUI' }, d: { tr: 'Oyun içi ClickGUI, hazır configler, Discord + Telegram üzerinden paylaşım.', en: 'In-game ClickGUI, ready configs, sharing via Discord + Telegram.' }, c: 'config: hypixel-ghost' }
];
function paintFeatures() {
  var g = $('#feat-grid');
  if (!g) return;
  g.innerHTML = FEATS.map(function (f) {
    return '<div class="feat-card"><div class="fi">' + f.i + '</div><h3>' + (LANG === 'tr' ? f.t.tr : f.t.en) + '</h3><p>' +
      (LANG === 'tr' ? f.d.tr : f.d.en) + '</p><code>' + f.c + '</code></div>';
  }).join('');
}

var SCENARIOS = [
  { id: 'bedwars', n: { tr: 'Hypixel BedWars', en: 'Hypixel BedWars' },
    note: { tr: 'Ghost Reach + Scaffold senaryosu. Rubidium ghost profiliyle öne geçiyor.', en: 'Ghost Reach + Scaffold scenario. Rubidium pulls ahead with its ghost profile.' },
    scores: [['Vape V4', 90, 'fill-vape'], ['Rise', 82, 'fill-rise'], ['Rubidium V4', 93, 'fill-rubi']] },
  { id: 'practice', n: { tr: 'Practice PvP', en: 'Practice PvP' },
    note: { tr: 'AimAssist + AutoClicker düellosu. Ücretsiz Rubidium, Vape bandında.', en: 'AimAssist + AutoClicker duel. Free Rubidium matches the Vape band.' },
    scores: [['Vape V4', 94, 'fill-vape'], ['Rise', 88, 'fill-rise'], ['Rubidium V4', 94, 'fill-rubi']] },
  { id: 'skywars', n: { tr: 'SkyWars', en: 'SkyWars' },
    note: { tr: 'ESP + Velocity ağırlıklı senaryo. Rubidium düşük profille zirvede.', en: 'ESP + Velocity weighted scenario. Rubidium tops with a low profile.' },
    scores: [['Vape V4', 89, 'fill-vape'], ['Rise', 84, 'fill-rise'], ['Rubidium V4', 91, 'fill-rubi']] }
];
var cur = 0;
function paintScenario(i) {
  cur = i;
  var s = SCENARIOS[i];
  var hints = $('#scn-hints');
  if (!hints) return;
  hints.innerHTML = '';
  SCENARIOS.forEach(function (q, j) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = LANG === 'tr' ? q.n.tr : q.n.en;
    if (j === i) b.className = 'on';
    b.addEventListener('click', function () { paintScenario(j); });
    hints.appendChild(b);
  });
  var box = $('#scn-bars');
  box.innerHTML = '';
  s.scores.forEach(function (row) {
    var wrap = document.createElement('div');
    wrap.className = 'bar-row';
    var lbl = document.createElement('div');
    lbl.className = 'lbl';
    var a = document.createElement('span'); a.textContent = row[0];
    var b2 = document.createElement('span'); b2.textContent = row[1] + ' / 100';
    lbl.appendChild(a); lbl.appendChild(b2);
    var track = document.createElement('div');
    track.className = 'bar-track';
    var fill = document.createElement('div');
    fill.className = 'bar-fill ' + row[2];
    track.appendChild(fill);
    wrap.appendChild(lbl); wrap.appendChild(track);
    box.appendChild(wrap);
    requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = row[1] + '%'; }); });
  });
  $('#scn-note').textContent = (LANG === 'tr' ? s.note.tr : s.note.en) + (LANG === 'tr' ? ' (Temsilî simülasyon.)' : ' (Illustrative simulation.)');
}

var FAQ = [
  { q: { tr: 'Rubidium V4 ücretsiz mi?', en: 'Is Rubidium V4 free?' }, a: { tr: 'Evet, tamamen ücretsiz. Vape V4 ($9.99/ay) ve Rise 6 ($34.99) ücretliyken Rubidium ücret istemez.', en: 'Yes, fully free — while Vape V4 ($9.99/mo) and Rise 6 ($34.99) are paid.' } },
  { q: { tr: 'Ban riski var mı?', en: 'Is there a ban risk?' }, a: { tr: 'Her hile clientında risk vardır. Ghost profiller + düşük ayarlar riski azaltır ama sıfırlamaz; ana hesabında dikkatli ol.', en: 'Every cheat client carries risk. Ghost profiles + low settings reduce but never remove it; be careful on your main.' } },
  { q: { tr: 'Vape / Rise kullanıcısı neden geçsin?', en: 'Why switch from Vape / Rise?' }, a: { tr: 'Ücretsiz olması, oyun içi ClickGUI ve Discord + Telegram üzerinden hızlı config paylaşımı en büyük artıları.', en: 'Being free, in-game ClickGUI and fast config sharing via Discord + Telegram are the biggest pluses.' } }
];
function paintFaq() {
  var fl = $('#sss-list');
  if (!fl) return;
  fl.innerHTML = '';
  FAQ.forEach(function (f) {
    var item = document.createElement('div'); item.className = 'faq-item';
    var q = document.createElement('button'); q.type = 'button'; q.className = 'faq-q';
    q.appendChild(document.createTextNode(LANG === 'tr' ? f.q.tr : f.q.en));
    var ic = document.createElement('i'); ic.className = 'fa-solid fa-plus'; q.appendChild(ic);
    var a = document.createElement('div'); a.className = 'faq-a';
    var w = document.createElement('div'); var pp = document.createElement('p');
    pp.textContent = LANG === 'tr' ? f.a.tr : f.a.en;
    w.appendChild(pp); a.appendChild(w);
    q.addEventListener('click', function () { item.classList.toggle('open'); });
    item.appendChild(q); item.appendChild(a); fl.appendChild(item);
  });
}

paintFeatures();
paintFaq();
paintScenario(0);
setLang(LANG);
})();
