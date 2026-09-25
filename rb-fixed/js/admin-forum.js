(function () {
  'use strict';
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {

    if (window.loadForumUsers && window.loadForumUsers.__rbMain) return;

    var db = null;
    try {
      if (window.firebase && window.firebaseConfig && window.firebaseConfig.projectId) {
        if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
        db = firebase.firestore();
      }
    } catch (e) { db = null; }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    var FU = [];

    function render(q) {
      var box = document.getElementById('forum-users');
      if (!box) return;
      q = (q || '').toLowerCase().trim();
      var list = FU.filter(function (u) {
        var uname = (u.username || u.email || '').toLowerCase();
        return !q || uname.indexOf(q) > -1 || (u.uid || '').toLowerCase().indexOf(q) > -1;
      });
      if (!list.length) {
        box.innerHTML = '<div class="msg-empty">' + (FU.length ? 'Aramaya uygun üye yok.' : 'Henüz forum üyesi yok.') + '</div>';
        return;
      }
      box.innerHTML = list.map(function (u) {
        var isDiscord = u.uid.length > 15 && !isNaN(u.uid);
        return '<div class="admin-row" data-fuid="' + esc(u.uid) + '" style="margin-bottom:12px">' +
          '<div class="row-header"><div class="row-title"><b>👤 ' + esc(u.username || u.email || 'İsimsiz') + '</b>' +
          (u.banned ? ' 🚫' : '') + ' <span style="opacity:.6;font-size:12px">(' + esc(u.role || 'member') + ')</span>' +
          '<br><small style="opacity:.5;font-size:11px">' + (isDiscord ? 'Discord ID: ' : 'UID: ') + esc(u.uid) + '</small></div></div>' +
          '<div class="row-controls" style="margin-top:8px">' +
          '<select class="fu-role" style="padding:8px;border-radius:8px;background:#fff;color:var(--text);border:1px solid var(--border)">' +
          ['member', 'vip', 'moderator', 'developer', 'kurucu'].map(function (r) { return '<option' + (r === (u.role || 'member') ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="btn btn-outline btn-sm fu-ban">' + (u.banned ? '✅ Ban Kaldır' : '🚫 BAN') + '</button>' +
          '</div></div>';
      }).join('');

      box.querySelectorAll('.admin-row[data-fuid]').forEach(function (row) {
        var uid = row.getAttribute('data-fuid');
        var u = null; FU.forEach(function (x) { if (x.uid === uid) u = x; });
        row.querySelector('.fu-role').addEventListener('change', function (e) {
          db.collection('users').doc(uid).update({ role: e.target.value }).then(function () {
            alert('✅ Yetki güncellendi.'); load();
          }).catch(function (err) { alert('Hata: ' + err.message); });
        });
        row.querySelector('.fu-ban').addEventListener('click', function () {
          db.collection('users').doc(uid).update({ banned: !u.banned }).then(function () {
            alert(u.banned ? '✅ Ban kaldırıldı.' : '🚫 BANlandı.'); load();
          }).catch(function (err) { alert('Hata: ' + err.message); });
        });
      });
    }

    function load() {
      var box = document.getElementById('forum-users');
      if (!box || !db) return;
      box.innerHTML = '<div class="msg-empty">Yükleniyor...</div>';
      db.collection('users').get().then(function (r) {
        FU = []; r.forEach(function (d) { var u = d.data() || {}; u.uid = d.id; FU.push(u); });
        var si = document.getElementById('fu-search');
        render(si ? si.value : '');
      }).catch(function (e) {
        var msg = (e && e.message) || String(e);
        box.innerHTML = '<div class="msg-empty" style="color:#ef4444">Üyeler çekilemedi: ' + esc(msg) +
          (/permission/i.test(msg) ? '<br><b>→ firestore.rules publish edilmemiş olabilir.</b>' : '') + '</div>';
      });
    }

    var sIn = document.getElementById('fu-search');
    if (sIn) sIn.addEventListener('input', function (e) { render(e.target.value); });
    var rBtn = document.getElementById('fu-refresh');
    if (rBtn) rBtn.addEventListener('click', load);

    window.__rbFuFallback = load;
    load();
  });
})();
