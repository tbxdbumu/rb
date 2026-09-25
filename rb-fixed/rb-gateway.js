/**
 * RiseBunny — rb-gateway.js
 *
 * Site tarafında, istenmeyen doğrudan URL'lerin (ör. /admin, /admin.html,
 * /yonetim, /panel, /risebunny-admin vs.) korunması için client-side bir
 * gate. Bu dosya, sayfanın yüklendiğinde çalışır ve eğer sayfadaki yol
 * "forbidden" listesinde ise, üstüne 404 overlay'ini çizer.
 *
 * GERÇEK ADMIN PANELİNE GİDEN TEK YOL:
 *   1) index.html altındaki footer "5 kere tıkla" akışı (app.js → secretEntry)
 *   2) sessionStorage içinde rb_admin_token=1 ile admin.html açılır
 *   3) admin.js içinde de token kontrolü var (hasToken → yoksa show404())
 *
 * BU DOSYA ŞU YOLLARI ENGELLEMEZ (Firebase Auth, giriş, vs.):
 *   /api/auth/*, /login, /giris, /register, /kayit, /auth/*
 *
 * Vercel tarafında da /api/auth/** → Firebase Functions rewrite vardır.
 */

(function () {
  'use strict';

  var FORBIDDEN = [
    '/admin',
    '/admin/',
    '/admin.html',
    '/yonetim',
    '/yonetim/',
    '/yonetim.html',
    '/panel',
    '/panel.html',
    '/dashboard',
    '/dashboard.html',
    '/wp-admin',
    '/wp-admin/',
    '/risebunny-admin',
    '/risebunny-admin.html',
    '/risebunny-panel'
  ];

  function pathOnly(url) {
    var u = String(url || location.href).replace(/#[^#]*$/, '').replace(/\?.*$/, '');
    var m = u.match(/^[^:]+:\/\/[^/]+(\/[^?#]*)/);
    return m ? m[1].replace(/\/+$/, '') : '/';
  }

  function isForbidden(path) {
    var p = path.toLowerCase();
    for (var i = 0; i < FORBIDDEN.length; i++) {
      var f = FORBIDDEN[i].toLowerCase();
      if (p === f || p.indexOf(f + '/') === 0) {
        return true;
      }
    }
    return false;
  }

  function gate() {
    var currentPath = pathOnly(location.href);
    if (!isForbidden(currentPath)) return;

    var existing = document.getElementById('rb-gateway-404');
    if (existing) return;

    var wrap = document.createElement('div');
    wrap.id = 'rb-gateway-404';
    wrap.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;' +
      'background:#0b0b10;color:#f5f5f7;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;text-align:center;padding:24px;' +
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
      'overflow:auto';

    var code = document.createElement('div');
    code.style.cssText = 'font-size:120px;font-weight:800;letter-spacing:-0.08em;line-height:1;color:#3f3f4b';
    code.textContent = '404';

    var title = document.createElement('h1');
    title.textContent = 'Sayfa bulunamadı';

    var sub = document.createElement('p');
    sub.textContent = 'Bu sayfa şu an erişim dışında. Yönetici paneline ulaşmak için lütfen site altındaki footer bölümünü kullan.';

    var back = document.createElement('a');
    back.href = '/index.html';
    back.textContent = '← Anasayfaya dön';
    back.style.cssText =
      'display:inline-block;margin-top:22px;padding:10px 18px;border-radius:10px;' +
      'background:#1e1e2a;color:#f5f5f7;text-decoration:none;font-weight:600;font-size:14px';

    wrap.appendChild(code);
    wrap.appendChild(title);
    wrap.appendChild(sub);
    wrap.appendChild(back);
    document.documentElement.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gate);
  } else {
    gate();
  }

  if (typeof window.history !== 'undefined' && history.pushState) {
    history.pushState = (function (original) {
      return function () {
        var result = original.apply(this, arguments);
        gate();
        return result;
      };
    })(history.pushState);

    history.replaceState = (function (original) {
      return function () {
        var result = original.apply(this, arguments);
        gate();
        return result;
      };
    })(history.replaceState);

    window.addEventListener('popstate', gate);
  }
})();