import { botBase, botHeaders } from '../lib/_session.js';
import { FB_KEY, PROJECT, readJson, originalPath } from '../lib/_helpers.js';

const HARDCODED_PREMIUM_IDS = (process.env.LAUNCHER_PREMIUM_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function randCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

const launcherDocUrl = (code) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_logins/${code}?key=${FB_KEY}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();

  console.log('[launcher] path:', op, 'method:', req.method);

  // ═══════════════ VERIFY ═══════════════
  if (op.endsWith('/verify')) {
    let id = url.searchParams.get('id');
    /* notify=1 → kullanıcı launcher'dan ELLE giriş yaptı; bot DM + sahip log
       üretir. Arka plan tazelemeleri notify göndermediği için spam olmaz. */
    const notify = url.searchParams.get('notify') === '1';
    if (!id && req.method === 'POST') {
      const body = await readJson(req);
      id = body.id || body.discordId;
    }
    id = String(id || '').replace(/\D/g, '').slice(0, 20);
    if (!id || id.length < 15) {
      return res.status(400).json({ ok: false, premium: false, error: 'Geçersiz veya eksik Discord ID.' });
    }

    let isPremium = HARDCODED_PREMIUM_IDS.includes(id);
    let username = `Kullanıcı_${id.slice(-4)}`;
    let role = isPremium ? 'vip' : 'member';
    let daysLeft = isPremium ? 365 : 0;

    // 1) Bot API'den kullanıcı bilgisi
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
          headers: botHeaders()
        });
        if (r.ok) {
          const u = await r.json();
          if (u.username) username = u.username;
          if (u.premium && u.premium.active) {
            isPremium = true;
            daysLeft = u.premium.daysLeft || 30;
            role = 'vip';
          }
        }
      } catch (e) { console.error('[launcher] bot user fetch err:', e.message); }
    }

    // 2) Firestore'dan rol/premium kontrolü (site kullanıcıları)
    if (PROJECT && FB_KEY) {
      try {
        const fr = await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?key=${FB_KEY}`,
          { headers: { Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, '')}/` : 'https://risebunny.vercel.app/' } }
        );
        if (fr.ok) {
          const data = await fr.json();
          const docs = data.documents || [];
          for (const d of docs) {
            const f = d.fields || {};
            if (f.discordId?.stringValue === id) {
              if (f.username?.stringValue) username = f.username.stringValue;
              const roleVal = f.role?.stringValue;
              if (['kurucu', 'moderator', 'developer', 'vip'].includes(roleVal) || f.premium?.booleanValue) {
                isPremium = true;
                role = roleVal || 'vip';
              }
              break;
            }
          }
        }
      } catch (e) { console.error('[launcher] firestore err:', e.message); }
    }

    if (!isPremium) {
      /* Premium olmasa da giriş başarılı sayılır (oynamak ücretsiz); bildirim yine gider. */
      if (notify && bBase && process.env.BOT_API_SECRET) {
        try {
          await fetch(`${bBase}/api/login`, {
            method: 'POST',
            headers: { ...botHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id, username, source: 'launcher' })
          });
        } catch (e) { console.error('[launcher] login notify err:', e.message); }
      }
      return res.status(403).json({
        ok: false, premium: false, discordId: id,
        error: 'Bu Discord ID için aktif Premium bulunamadı.'
      });
    }

    // Launcher kullanıcı kaydı
    if (PROJECT && FB_KEY) {
      try {
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_users/${id}?key=${FB_KEY}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: {
              discordId: { stringValue: id },
              username: { stringValue: username },
              role: { stringValue: role },
              premium: { booleanValue: true },
              launcher: { stringValue: 'RiseBunny Client' },
              lastLaunch: { timestampValue: new Date().toISOString() }
            }})
          }
        );
      } catch (e) { console.error('[launcher] firestore write err:', e.message); }
    }

    /* Launcher giriş bildirimi: bota ilet (DM + sahip log). */
    if (notify && bBase && process.env.BOT_API_SECRET) {
      try {
        await fetch(`${bBase}/api/login`, {
          method: 'POST',
          headers: { ...botHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, username, source: 'launcher' })
        });
      } catch (e) { console.error('[launcher] login notify err:', e.message); }
    }

    /* Loader bileti için kısa ömürlü erişim jetonu: HMAC(userId:expires).
       SESSION_SECRET ile imzalanır; loader /api/launcher/ticket'a gönderir. */
    const SESSION_SECRET = process.env.SESSION_SECRET || '';
    let accessToken = '';
    if (SESSION_SECRET) {
      const { createHmac } = await import('node:crypto');
      const expires = Date.now() + 12 * 60 * 60 * 1000; // 12 saat
      const payload = `${id}.${expires}`;
      const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
      accessToken = `${payload}.${sig}`;
    }

    return res.json({
      ok: true, premium: true, discordId: id,
      username, role, daysLeft,
      accessToken,
      verifiedAt: Date.now(),
      server: 'RiseBunny Auth Gateway'
    });
  }

  // ═══════════════ TICKET (loader bilet doğrulama) ═══════════════
  /* Launcher, loader'ı base64 bilet (userId:token:timestamp) ile başlatır.
     Loader (DLL) bu ucu çağırıp biletin geçerliliğini ve premium durumunu
     sorgular. Bilet 10 dakika geçerli; ayrıca bilet iade edilemez (tek kullanım
     değil ama timestamp penceresi sınırlar). */
  if (op.endsWith('/ticket') && req.method === 'POST') {
    const body = await readJson(req);
    let raw = String(body.ticket || '');
    try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch {}
    /* İki bilet formatı:
       1) Yeni: "userId.accessToken" — accessToken verify'dan gelen 12s HMAC jetonu.
       2) Eski: "userId:token:timestamp" — 10 dk pencere. */
    let id = '';
    if (raw.includes('.')) {
      const dot = raw.lastIndexOf('.');
      id = String(raw.slice(0, dot)).replace(/\D/g, '').slice(0, 20);
      const token = raw.slice(dot + 1);
      const SESSION_SECRET = process.env.SESSION_SECRET || '';
      const segs = token.split('.');
      if (!SESSION_SECRET || segs.length !== 3) {
        return res.status(403).json({ ok: false, active: false, error: 'geçersiz bilet' });
      }
      const [tokId, expires, sig] = segs;
      const { createHmac, timingSafeEqual } = await import('node:crypto');
      const expect = createHmac('sha256', SESSION_SECRET).update(`${tokId}.${expires}`).digest('hex');
      const a = Buffer.from(expect), b = Buffer.from(sig);
      if (a.length !== b.length || !timingSafeEqual(a, b) || tokId !== id) {
        return res.status(403).json({ ok: false, active: false, error: 'geçersiz bilet' });
      }
      if (Date.now() > Number(expires)) {
        return res.status(403).json({ ok: false, active: false, error: 'oturum süresi doldu, launcherdan tekrar giriş yap' });
      }
    } else {
      const parts = raw.split(':');
      id = String(parts[0] || '').replace(/\D/g, '').slice(0, 20);
      const ts = Number(parts[2] || 0);
      if (!id || id.length < 15) {
        return res.status(400).json({ ok: false, active: false, error: 'geçersiz bilet' });
      }
      if (!ts || Date.now() - ts > 10 * 60 * 1000 || ts - Date.now() > 60 * 1000) {
        return res.status(403).json({ ok: false, active: false, error: 'bilet süresi doldu, launcherdan tekrar başlat' });
      }
    }
    if (!id || id.length < 15) {
      return res.status(400).json({ ok: false, active: false, error: 'geçersiz bilet' });
    }
    /* Premium durumu: bot API + Firestore (verify ile aynı mantık). */
    let isPremium = HARDCODED_PREMIUM_IDS.includes(id);
    let username = `Kullanıcı_${id.slice(-4)}`;
    let role = isPremium ? 'vip' : 'member';
    let daysLeft = isPremium ? 365 : 0;
    let paidUntil = null;
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, { headers: botHeaders() });
        if (r.ok) {
          const u = await r.json();
          if (u.username) username = u.username;
          if (u.premium && u.premium.active) {
            isPremium = true;
            daysLeft = u.premium.daysLeft || 30;
            if (u.premium.paidUntil) paidUntil = u.premium.paidUntil;
            role = 'vip';
          }
        }
      } catch {}
    }
    if (PROJECT && FB_KEY) {
      try {
        const fr = await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?key=${FB_KEY}`,
          { headers: { Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, '')}/` : 'https://risebunny.vercel.app/' } }
        );
        if (fr.ok) {
          const data = await fr.json();
          for (const d of (data.documents || [])) {
            const f = d.fields || {};
            if (f.discordId?.stringValue === id) {
              if (f.username?.stringValue) username = f.username.stringValue;
              const roleVal = f.role?.stringValue;
              if (['kurucu', 'moderator', 'developer', 'vip'].includes(roleVal) || f.premium?.booleanValue) {
                isPremium = true;
                role = roleVal || 'vip';
              }
              break;
            }
          }
        }
      } catch {}
    }
    const staff = ['kurucu', 'moderator', 'developer'].includes(role);
    return res.json({
      ok: true,
      active: isPremium && (staff || daysLeft > 0),
      premium: isPremium,
      role,
      username,
      daysLeft,
      paidUntil,
      staff
    });
  }

  // ═══════════════ TOKEN EXCHANGE ═══════════════
  if (op.endsWith('/token') && req.method === 'POST') {
    const body = await readJson(req);
    const code = String(body.code || '');
    const redirect = String(body.redirect_uri || 'http://127.0.0.1:8741/callback');
    const verifier = String(body.code_verifier || '');
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
    const clientId = process.env.DISCORD_CLIENT_ID || '';

    if (!clientSecret || !clientId) {
      return res.status(500).json({ ok: false, error: 'sunucu yapılandırma hatası' });
    }
    if (!code) return res.status(400).json({ ok: false, error: 'no-code' });

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect
      });
      if (verifier) params.set('code_verifier', verifier);

      const tok = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const tj = await tok.json().catch(() => ({}));
      if (!tok.ok || !tj.access_token) {
        return res.status(400).json({ ok: false, error: tj.error_description || tj.error || 'token-failed' });
      }

      const me = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tj.access_token}` }
      });
      if (!me.ok) return res.status(400).json({ ok: false, error: 'user-failed' });
      const u = await me.json();
      const avatar = u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
        : '';
      return res.json({
        ok: true,
        id: String(u.id),
        username: u.username || '',
        avatar
      });
    } catch (e) {
      console.error('[launcher] token err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  // ═══════════════ DEVICE FLOW ═══════════════
  if (op.endsWith('/device')) {
    try {
      // POST = yeni device code oluştur
      if (req.method === 'POST') {
        const body = await readJson(req);
        if (body.action !== 'create') return res.status(400).json({ ok: false });
        const code = randCode();
        const write = await fetch(launcherDocUrl(code), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: {
            status: { stringValue: 'pending' },
            createdAt: { timestampValue: new Date().toISOString() }
          }})
        }).catch((e) => {
          console.error('[launcher] device create err:', e.message);
          return null;
        });
        /* Yazma reddedildiyse (Firestore kuralı eksik) kodu yine dönmek
           launcher'ı sonsuza kadar 'pending' bekletir — açık hata dön. */
        if (!write || !write.ok) {
          const detail = write ? await write.text().catch(() => '') : '';
          console.error('[launcher] device-store write rejected:',
            write ? write.status : 'network', String(detail).slice(0, 300));
          return res.status(503).json({
            ok: false,
            error: 'device-store-unavailable',
            detail: 'launcher_logins Firestore kuralı eksik veya yayınlanmadı.'
          });
        }
        return res.json({ ok: true, code });
      }

      // GET = device code kontrolü
      const code = String(url.searchParams.get('code') || '')
        .replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
      if (!code) return res.status(400).json({ ok: false });

      const r = await fetch(launcherDocUrl(code));
      if (r.status === 401 || r.status === 403) {
        console.error('[launcher] device-store read denied:', r.status);
        return res.status(503).json({
          ok: false,
          status: 'error',
          error: 'device-store-unavailable',
          detail: 'launcher_logins Firestore kuralı eksik veya yayınlanmadı.'
        });
      }
      if (!r.ok) return res.json({ ok: true, status: 'pending' });

      const d = await r.json();
      const f = d.fields || {};
      const created = f.createdAt?.timestampValue
        ? new Date(f.createdAt.timestampValue).getTime()
        : 0;

      // 10 dk sonra expire
      if (created && Date.now() - created > 10 * 60 * 1000) {
        await fetch(launcherDocUrl(code), { method: 'DELETE' }).catch(() => {});
        return res.json({ ok: true, status: 'expired' });
      }

      // Onaylandı
      if (f.status?.stringValue === 'done') {
        const out = {
          ok: true,
          status: 'done',
          id: f.id?.stringValue || '',
          username: f.username?.stringValue || '',
          avatar: f.avatar?.stringValue || ''
        };
        await fetch(launcherDocUrl(code), { method: 'DELETE' }).catch(() => {});
        return res.json(out);
      }

      return res.json({ ok: true, status: 'pending' });
    } catch (e) {
      console.error('[launcher] device err:', e.message);
      return res.status(500).json({ ok: false });
    }
  }

  // ═══════════════ LAUNCHER PROFILE (bot parası + seviye) ═══════════════
  if (op.endsWith('/profile')) {
    let id = url.searchParams.get('id');
    if (!id && req.method === 'POST') {
      const body = await readJson(req);
      id = body.id || body.discordId;
    }
    id = String(id || '').replace(/\D/g, '').slice(0, 20);
    if (!id || id.length < 15) {
      return res.status(400).json({ ok: false, error: 'Geçersiz Discord ID.' });
    }
    if (!bBase || !process.env.BOT_API_SECRET) {
      return res.status(503).json({ ok: false, error: 'Bot API bağlı değil.' });
    }
    try {
      const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
        headers: botHeaders()
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: 'Bot verisi alınamadı.' });
      const u = await r.json();
      const avatar = u.avatar
        ? (String(u.avatar).startsWith('http') ? u.avatar
          : `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128`)
        : '';
     return res.json({
  ok: true,
  user: { id, username: u.username || '', avatar },
  premium: Boolean(u.premium && u.premium.active),
  capes: Array.isArray(u.capes) ? u.capes : [],  // ✅ YENİ
  game: {
          money: Number(u.money ?? u.total ?? u.wallet ?? 0),
          level: Number(u.level ?? 0),
          xp: Number(u.xp ?? 0),
          pets: Array.isArray(u.pets) ? u.pets.length : Number(u.pets ?? 0)
        }
      });
    } catch (e) {
      console.error('[launcher] profile err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  // ═══════════════ LAUNCHER BUY (bot parasıyla cosmetic) ═══════════════
  // Bot `userId` + katalog ID bekler (bot.js SHOP_CATALOG: minecon2011,
  // bunny-neon, anniversary15, ender-heart, bunny-gold). Bot `total` döner.
  if (op.endsWith('/buy') && req.method === 'POST') {
    const body = await readJson(req);
    const id = String(body.id || body.userId || '').replace(/\D/g, '').slice(0, 20);
    const item = String(body.item || '').slice(0, 40);
    const price = Number(body.price || 0);
    if (!id || id.length < 15 || !item || !(price > 0)) {
      return res.status(400).json({ ok: false, error: 'Geçersiz istek.' });
    }
    if (!bBase || !process.env.BOT_API_SECRET) {
      return res.status(503).json({ ok: false, error: 'Bot API bağlı değil.' });
    }
    try {
      const r = await fetch(`${bBase}/api/shop/buy`, {
        method: 'POST',
        headers: { ...botHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, item, price, source: 'launcher' })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok !== true) {
        return res.status(400).json({ ok: false, error: j.error || 'Bot satın almayı reddetti.' });
      }
      const wallet = Number(j.wallet || 0), bank = Number(j.bank || 0);
      return res.json({ ok: true, newBalance: Number(j.total ?? (wallet + bank)) });
    } catch (e) {
      console.error('[launcher] buy err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  return res.status(404).json({ error: 'not found', path: op });
}