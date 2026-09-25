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
  }


  if (!code) {
    return res.redirect(302, '/risebunny?login=hata');
  }

  const secretKey = process.env.DISCORD_CLIENT_SECRET || '';
  const sessionSecret = process.env.SESSION_SECRET || '';

  if (!secretKey) {
    return res.status(500).send('DISCORD_CLIENT_SECRET tanımlı değil.');
  }
  if (!sessionSecret || sessionSecret.length < 16) {
    return res.status(500).send('SESSION_SECRET tanımlı değil veya çok kısa.');
  }
  if (!CLIENT_ID) {
    return res.status(500).send('DISCORD_CLIENT_ID tanımlı değil.');
  }

  try {

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


    if (!tok.ok) {
      const errBody = await tok.text().catch(() => '');
      throw new Error('token exchange failed: ' + errBody);
    }

    const tj = await tok.json();

    const me = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tj.access_token}` }
    });

    if (!me.ok) {
      const meErr = await me.text().catch(() => '');
      throw new Error('user fetch failed');
    }

    const u = await me.json();

    const fb = fbCreds(String(u.id));

    await ensureFirebaseUser(fb.email, fb.pw);

    /* Launcher cihaz akışıyla mı gelindi? Bota giriş kaynağını da bildir. */
    const deviceKod = (String(next).match(/[?&]device=([A-Za-z0-9]{4,12})/) || [])[1];
    linkBot(String(u.id), u.username, u.email || '', deviceKod ? 'launcher' : 'site');

    // Launcher device bridge
    try {
     const dm = deviceKod ? [null, deviceKod] : null;
      if (dm && PROJECT && FB_KEY) {
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
      }
    } catch (e) {
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
    return res.redirect(302, finalUrl);

  } catch (e) {
    return res.redirect(302, '/risebunny?login=hata');
  }
}
