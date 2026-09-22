import { safeNext, setSession } from '../../../lib/_session.js';
import {
  CLIENT_ID, FB_KEY, PROJECT, fbCreds, ensureFirebaseUser, linkBot, siteBase
} from '../../../lib/_helpers.js';

export default async function handler(req, res) {
  const base = siteBase(req);
  const cbPath = process.env.DISCORD_CALLBACK_PATH || '/api/auth/discord/callback';
  const redirect = `${base}${cbPath}`;

  const url = new URL(req.url, base);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  let next = '/risebunny';
  try {
    next = safeNext(state ? Buffer.from(String(state), 'base64url').toString('utf8') : '/risebunny');
  } catch (e) {
    console.error('[cb] state decode err:', e.message);
  }

  console.log('[cb] ────────── CALLBACK BAŞLADI ──────────');
  console.log('[cb] base:', base);
  console.log('[cb] redirect_uri:', redirect);
  console.log('[cb] code var mı:', !!code);
  console.log('[cb] state var mı:', !!state);
  console.log('[cb] next:', next);

  if (!code) {
    console.error('[cb] ❌ code yok');
    return res.redirect(302, '/risebunny?login=hata');
  }

  const secretKey = process.env.DISCORD_CLIENT_SECRET || '';
  const sessionSecret = process.env.SESSION_SECRET || '';
  console.log('[cb] DISCORD_CLIENT_SECRET var mı:', !!secretKey, '| uzunluk:', secretKey.length);
  console.log('[cb] SESSION_SECRET var mı:', !!sessionSecret, '| uzunluk:', sessionSecret.length);

  if (!secretKey) {
    console.error('[cb] ❌ DISCORD_CLIENT_SECRET tanımlı değil');
    return res.status(500).send('DISCORD_CLIENT_SECRET tanımlı değil.');
  }
  if (!sessionSecret || sessionSecret.length < 16) {
    console.error('[cb] ❌ SESSION_SECRET tanımlı değil veya çok kısa');
    return res.status(500).send('SESSION_SECRET tanımlı değil veya çok kısa.');
  }
  if (!CLIENT_ID) {
    console.error('[cb] ❌ DISCORD_CLIENT_ID tanımlı değil');
    return res.status(500).send('DISCORD_CLIENT_ID tanımlı değil.');
  }

  try {
    console.log('[cb] → Discord token exchange başlıyor...');
    console.log('[cb] gönderilen client_id:', CLIENT_ID);
    console.log('[cb] gönderilen redirect_uri:', redirect);
    console.log('[cb] gönderilen secret uzunluk:', secretKey.length);
    console.log('[cb] gönderilen secret ilk 4:', secretKey.slice(0, 4));
    console.log('[cb] gönderilen secret son 4:', secretKey.slice(-4));
    console.log('[cb] gönderilen code uzunluk:', String(code).length);

    const tok = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: secretKey,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirect
      })
    });

    console.log('[cb] token status:', tok.status);

    if (!tok.ok) {
      const errBody = await tok.text().catch(() => '');
      console.error('[cb] ═══════════ TOKEN HATASI ═══════════');
      console.error('[cb] status:', tok.status);
      console.error('[cb] body:', errBody);
      console.error('[cb] client_id:', CLIENT_ID);
      console.error('[cb] redirect_uri:', redirect);
      console.error('[cb] secret_uzunluk:', secretKey.length);
      console.error('[cb] secret_ilk_4:', secretKey.slice(0, 4));
      console.error('[cb] secret_son_4:', secretKey.slice(-4));
      console.error('[cb] code_uzunluk:', String(code).length);
      console.error('[cb] ═══════════════════════════════════');
      throw new Error('token exchange failed: ' + errBody);
    }

    const tj = await tok.json();
    console.log('[cb] ✅ token exchange başarılı');

    const me = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tj.access_token}` }
    });
    console.log('[cb] me status:', me.status);

    if (!me.ok) {
      const meErr = await me.text().catch(() => '');
      console.error('[cb] ❌ me endpoint hatası:', meErr);
      throw new Error('user fetch failed');
    }

    const u = await me.json();
    console.log('[cb] ✅ kullanıcı:', u.id, u.username);

    const fb = fbCreds(String(u.id));
    console.log('[cb] firebase köprü email:', fb.email);

    await ensureFirebaseUser(fb.email, fb.pw);
    console.log('[cb] ✅ firebase user hazır');

    /* Launcher cihaz akışıyla mı gelindi? Bota giriş kaynağını da bildir. */
    const deviceKod = (String(next).match(/[?&]device=([A-Za-z0-9]{4,12})/) || [])[1];
    linkBot(String(u.id), u.username, u.email || '', deviceKod ? 'launcher' : 'site');
    console.log('[cb] ✅ bot link çağrısı yapıldı (kaynak:', deviceKod ? 'launcher' : 'site', ')');

    // Launcher device bridge
    try {
     const dm = deviceKod ? [null, deviceKod] : null;
      if (dm && PROJECT && FB_KEY) {
        console.log('[cb] launcher device bridge:', dm[1]);
        const dav = u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
          : '';
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_logins/${dm[1]}?key=${FB_KEY}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: {
              status: { stringValue: 'done' },
              id: { stringValue: String(u.id) },
              username: { stringValue: u.username || '' },
              avatar: { stringValue: dav },
              createdAt: { timestampValue: new Date().toISOString() }
            }})
          }
        );
        console.log('[cb] ✅ launcher bridge güncellendi');
      }
    } catch (e) {
      console.error('[cb] launcher device err:', e.message);
    }

    setSession(res, {
      id: String(u.id),
      username: u.username,
      avatar: u.avatar,
      email: u.email || '',
      fbEmail: fb.email,
      fbPw: fb.pw
    });

    /* login=ok parametresi fragment'tan ÖNCE eklenmeli:
       /risebunny#hesabim + ?login=ok → /risebunny#hesabim?login=ok (BOZUK: sunucu görmez)
       doğrusu: /risebunny?login=ok#hesabim */
    const hashIx = next.indexOf('#');
    const yol = hashIx > -1 ? next.slice(0, hashIx) : next;
    const frag = hashIx > -1 ? next.slice(hashIx) : '';
    const finalUrl = yol + (yol.includes('?') ? '&' : '?') + 'login=ok' + frag;
    console.log('[cb] ✅✅✅ BAŞARILI → redirect:', finalUrl);
    return res.redirect(302, finalUrl);

  } catch (e) {
    console.error('[cb] ❌❌❌ FATAL:', e.message);
    console.error('[cb] stack:', e.stack);
    return res.redirect(302, '/risebunny?login=hata');
  }
}