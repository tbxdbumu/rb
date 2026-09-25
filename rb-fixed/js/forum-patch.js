(function () {
'use strict';

const pesc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const plang = () => localStorage.getItem("rb-lang") || "tr";
const pfmt = ts => ts && ts.seconds ? new Date(ts.seconds*1000)
  .toLocaleString(plang()=="tr"?"tr-TR":"en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
const psecs = ts => (ts && ts.seconds) || 0;
const prel = ts => { if (!ts || !ts.seconds) return "—";
  const d = Math.floor(Date.now()/1000 - ts.seconds);
  if (d < 60) return "az önce"; if (d < 3600) return Math.floor(d/60)+" dk önce";
  if (d < 86400) return Math.floor(d/3600)+" sa önce"; return Math.floor(d/86400)+" gün önce"; };
const pbadge = r => { const b = window.RBAuth.BADGE[r] || window.RBAuth.BADGE.member;
  return `<span class="rb-badge" data-role="${r}">${b.icon}<i>${pesc(b[plang()]||b.tr)}</i></span>`; };

function stamp() {
  var f = document.querySelector('.rb-footer');
  if (f && f.getAttribute('data-v') !== '15') { f.setAttribute('data-v','15');
    f.innerHTML = f.innerHTML.replace(/v\d+<\/b>/,'v15</b>'); if (!/v15/.test(f.innerHTML)) f.innerHTML += ' · <b style="color:#8b5cf6">v15</b>'; }
}
setTimeout(stamp, 800);

var bn = 0;
function ensureBtn() {
  bn++;
  document.querySelectorAll('.rb-cathead').forEach(function (ch) {
    if (ch.querySelector('.rb-fab') || ch.querySelector('.rb-btn')) return;
    var slug = decodeURIComponent((location.hash.split('/')[2] || ''));
    var u = window.RBAuth && RBAuth.CURRENT();
    var a = document.createElement('a'); a.className = 'rb-btn';
    a.href = u ? '#/new/' + encodeURIComponent(slug) : '#/login';
    a.textContent = '＋ Yeni Konu'; ch.appendChild(a);
  });
  if (bn < 20) setTimeout(ensureBtn, 1200);
}
ensureBtn();

function cleanUname(raw) {
  var u = String(raw || "uye").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
  if (u.length < 3) u = (u + "uye").slice(0, 20);
  if (u.length < 3) u = "uye" + Math.floor(Math.random() * 900 + 100);
  return u;
}
function heal() {
  if (typeof db === 'undefined' || typeof auth === 'undefined') return setTimeout(heal, 300);
  auth.onAuthStateChanged(async function (u) {
    if (!u) return;
    try {
      var ref = db.collection("users").doc(u.uid);
      var s = await ref.get();
      if (!s.exists) {
        var disc = null;
        try { disc = JSON.parse(localStorage.getItem("rb_discord") || "null"); } catch (e2) {}
        var uname = (window.cleanUname || cleanUname)(((disc && disc.username) || (u.email || ("uye" + u.uid.slice(0, 6)))).split("@")[0]);
        await ref.set({ username: uname, role: "member",
          avatar: "", banned: false, stats: { threads: 0, posts: 0, likes: 0 },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastLogin: firebase.firestore.FieldValue.serverTimestamp() })
          .catch(async function () {
            await ref.set({ username: (window.cleanUname || cleanUname)(uname + Math.floor(Math.random()*90+10)), role: "member", avatar: "", banned: false,
              stats: { threads: 0, posts: 0, likes: 0 },
              createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
          });
        location.reload();
      }
    } catch (e) {}
  });
}
heal();

function touchLastLogin() {
  var u = window.RBAuth && RBAuth.CURRENT(); if (!u) return;
  var k = 'rb_ll_' + u.uid;
  if (sessionStorage.getItem(k)) return;
  sessionStorage.setItem(k, '1');
  db.collection('users').doc(u.uid).update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(function(){});
}
if (window.RBAuth) RBAuth.onAuth(function () { setTimeout(touchLastLogin, 600); });

function patchRB() {
  if (!window.RB) return setTimeout(patchRB, 300);
  var origNew = window.RB.newThread, origReply = window.RB.reply;
  window.RB.newThread = async function (slug) { try { await origNew(slug); } catch (e) { alert("⚠️ Konu açılamadı:\n" + ((e && e.message) || e)); } };
  window.RB.reply = async function (a, b, c) { try { await origReply(a, b, c); } catch (e) { alert("⚠️ Yanıt gönderilemedi:\n" + ((e && e.message) || e)); } };

  window.RB.delAccount = function (uid, username) {
    if (window.RBAuth.CURRENT() && window.RBAuth.CURRENT().uid === uid)
      return alert("⚠️ Kendi hesabını buradan silemezsin.");
    if (!confirm('"' + username + '" hesabının TÜM forum verileri silinecek. Emin misin?')) return;
    if (!confirm('SON UYARI: Bu işlem GERİ ALINAMAZ. Devam edilsin mi?')) return;
    var clean = function () {
      return Promise.all([
        db.collection('threads').where('authorId', '==', uid).get(),
        db.collection('posts').where('authorId', '==', uid).get()
      ]).then(function (snaps) {
        var b = db.batch();
        snaps[0].forEach(function (d) { b.delete(d.ref); });
        snaps[1].forEach(function (d) { b.delete(d.ref); });
        b.delete(db.collection('users').doc(uid));
        return b.commit();
      });
    };
    clean().then(function () {
      alert('✅ Forum verileri silindi. (Auth kaydı için: Firebase Console → Authentication)');
      if (typeof admSection === 'function') admSection('users'); else route();
    }).catch(function (e) { alert('⚠️ Hata: ' + ((e && e.message) || e)); });
  };

  window.RB.filterUsers = function (q) {
    q = (q || "").toLowerCase();
    const box = document.getElementById("adm-users"); if (!box) return;
    const list = (window.__ADM_USERS || []).filter(u => (u.username || "").toLowerCase().includes(q));
    box.innerHTML = list.map(u => `<div class="rb-row rb-rowclick" onclick="RB.userDetail('${u.uid}')">
      <b class="rb-ulink">👁 ${pesc(u.username)}${u.banned ? ' 🚫' : ''}</b> ${pbadge(u.role)}
      <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" onclick="event.stopPropagation()">
        <select onchange="RB.setRole('${u.uid}',this.value)">${Object.keys(RBAuth.WEIGHT).map(r=>`<option ${r===u.role?"selected":""}>${r}</option>`).join("")}</select>
        <button class="rb-ghost rb-danger" onclick="RB.ban('${u.uid}',${!u.banned})">${u.banned ? "BAN Kaldır" : "BAN"}</button>
        <button class="rb-ghost rb-danger" onclick="RB.delAccount('${u.uid}','${pesc(u.username)}')">🗑 Sil</button>
      </span></div>`).join("") || '<div class="rb-empty">—</div>';
  };

  window.RB.userDetail = async uid => {
    const body = document.getElementById("adm-body"); if (!body) return;
    body.innerHTML = '<div class="rb-empty">🐰...</div>';
    try {
      const ud = await db.collection("users").doc(uid).get();
      if (!ud.exists) return typeof admSection === 'function' ? admSection("users") : 0;
      const u = ud.data();
      const th = await db.collection("threads").where("authorId","==",uid).get();
      const threads = []; th.forEach(d => threads.push(d.data()));
      threads.sort((a,b) => psecs(b.createdAt) - psecs(a.createdAt));
      const po = await db.collection("posts").where("authorId","==",uid).get();
      const posts = []; po.forEach(d => posts.push(d.data()));
      posts.sort((a,b) => psecs(b.createdAt) - psecs(a.createdAt));
      body.innerHTML = `<div class="rb-udetail">
        <button class="rb-back" onclick="RB.admUsersBack()">← Kullanıcılar</button>
        <div class="rb-profile" style="text-align:left">
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <div class="rb-avatar" style="margin:0">${pesc((u.username||"?")[0].toUpperCase())}</div>
            <div><h2 style="margin:0">${pesc(u.username)} ${pbadge(u.role)}</h2>
            <small>UID: ${pesc(uid)}${u.banned?" · 🚫 BANLI":""}</small></div>
          </div>
          <div class="rb-stats" style="justify-content:flex-start;margin:14px 0">
            <div class="rb-stat"><b>${(u.stats&&u.stats.threads)||0}</b><span>Konu</span></div>
            <div class="rb-stat"><b>${(u.stats&&u.stats.posts)||0}</b><span>Yanıt</span></div>
          </div>
          <p style="color:var(--dim);font-size:12px">📅 Kayıt: ${pfmt(u.createdAt)}<br>🕐 Son giriş: ${pfmt(u.lastLogin)} · ${prel(u.lastLogin)}</p>
          <div class="rb-modbar">
            <select onchange="RB.setRole('${uid}',this.value)">${Object.keys(RBAuth.WEIGHT).map(r=>`<option ${r===u.role?"selected":""}>${r}</option>`).join("")}</select>
            <button class="rb-ghost rb-danger" onclick="RB.ban('${uid}',${!u.banned})">${u.banned?"BAN Kaldır":"BAN"}</button>
            <button class="rb-ghost rb-danger" onclick="RB.delAccount('${uid}','${pesc(u.username)}')">🗑 Hesabı Sil</button>
          </div>
          <h3>💬 Konuları (${threads.length})</h3>
          ${threads.slice(0,10).map(x=>`<div class="rb-row"><b>${pesc(x.title)}</b><small>${pfmt(x.createdAt)}</small></div>`).join("")||'<div class="rb-empty">—</div>'}
          <h3>📝 Son Yorumları (${posts.length})</h3>
          ${posts.slice(0,10).map(x=>`<div class="rb-row"><b style="font-weight:500">${pesc((x.content||"").slice(0,90))}</b><small>${pfmt(x.createdAt)}</small></div>`).join("")||'<div class="rb-empty">—</div>'}
        </div></div>`;
    } catch (e) { console.error(e); }
  };

  window.renderProfile = async username => {
    const s = await db.collection("users").where("username","==",username).get();
    if (s.empty) return document.getElementById("view").innerHTML = '<div class="forum-wrap"><a class="rb-back" href="#/">← Geri</a><div class="rb-empty">404 — Sayfa Bulunamadı</div></div>';
    let u = null, uid = ""; s.forEach(d => { u = d.data(); uid = d.id; });
    const CURu = RBAuth.CURRENT(); const myW2 = RBAuth.myWeight();
    document.getElementById("view").innerHTML = `<div class="forum-wrap"><a class="rb-back" href="#/">← Geri</a>
      <div class="rb-profile">
      <div class="rb-avatar">${pesc((u.username||"?")[0].toUpperCase())}</div>
      <h2>${pesc(u.username)} ${pbadge(u.role)}</h2>
      <div class="rb-stats"><div class="rb-stat"><b>${(u.stats&&u.stats.threads)||0}</b><span>Konu</span></div>
      <div class="rb-stat"><b>${(u.stats&&u.stats.posts)||0}</b><span>Yanıt</span></div></div>
      ${myW2>=3 && uid !== (CURu&&CURu.uid) ? `<div class="rb-modbar" style="justify-content:center">
        <select onchange="RB.setRole('${uid}',this.value)">${Object.keys(RBAuth.WEIGHT).map(r=>`<option ${r===u.role?"selected":""}>${r}</option>`).join("")}</select>
        <button class="rb-ghost rb-danger" onclick="RB.ban('${uid}',${!u.banned})">${u.banned?"BAN Kaldır":"BAN"}</button>
        <button class="rb-ghost rb-danger" onclick="RB.delAccount('${uid}','${pesc(u.username)}')">🗑 Hesabı Sil</button></div>` : ""}
    </div></div>`;
  };
}
patchRB();

(function watchUsers(){
  var orig = null;
  function hook(){
    if (!window.RB || !orig) {
      if (window.RB && !window.RB.__hooked) { window.RB.__hooked = true; }
    }
  }
  hook();

  setInterval(function(){
    try {
      if (typeof ADM_USERS !== 'undefined' && window.__ADM_USERS !== ADM_USERS) window.__ADM_USERS = ADM_USERS;
    } catch(e){}
  }, 800);
})();
})();
