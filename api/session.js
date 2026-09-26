import { setSession, getSession, clearSession, botBase, botHeaders } from '../lib/_session.js';
import { FB_KEY, readJson, fbCreds, avatarUrl, siteBase } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = url.pathname;

  // POST /api/session - Firebase ID token ile oturum oluştur
  if (op === '/api/session' && req.method === 'POST') {
    if (!FB_KEY) return res.status(500).json({ error: 'FIREBASE_API_KEY tanımlı değil' });

    const body = await readJson(req);
    const idToken = String(body.idToken || '');
    if (!idToken) return res.status(400).json({ error: 'token yok' });

    try {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      if (!r.ok) return res.status(401).json({ error: 'geçersiz oturum' });
      const j = await r.json();
      const email = j.users?.[0]?.email || '';
      const m = /^d(\d+)@discord\.risebunny\.local$/.exec(email);
      if (!m) return res.status(403).json({ error: 'discord köprüsü değil' });
      const id = m[1];

      let username = 'Üye';
      const bBase = botBase();
      const bSec = process.env.BOT_API_SECRET || '';
      if (bBase && bSec) {
        try {
          const br = await fetch(`${bBase}/api/user/${id}`, {
            headers: { 'x-bot-secret': bSec }
          });
          if (br.ok) {
            const bj = await br.json();
            username = bj.username || username;
          }
        } catch {}
      }
      setSession(res, { id, username, avatar: null, email: '',
        fbEmail: (() => { try { return fbCreds(String(id)).email; } catch { return ''; } })(),
        fbPw: (() => { try { return fbCreds(String(id)).pw; } catch { return ''; } })()
      }, req);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'hata' }); }
  }

  // GET /api/me - Mevcut oturum bilgisi
  if (op === '/api/me' && req.method === 'GET') {
    const base = siteBase(req);
    const logout = url.searchParams.get('logout') === '1';
    if (logout) {
      clearSession(res, req);
      return res.json({ ok: false });
    }

    const s = getSession(req);
    if (!s) return res.status(401).json({ ok: false });

    const out = {
      ok: true,
      user: {
        id: s.id,
        username: s.username,
        avatar: avatarUrl(s.id, s.avatar),
        email: s.email || ''
      },
      fb: (s.fbEmail && s.fbPw) ? { email: s.fbEmail, pw: s.fbPw } : null,
      game: null,
      botOnline: false
    };

    const bBase = botBase();
    const bSec = process.env.BOT_API_SECRET || '';
    if (!bBase) out.botNeden = 'no-url';
    else if (!bSec) out.botNeden = 'no-secret';
    if (bBase && bSec) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(s.id)}`, {
          headers: botHeaders()
        });
        if (r.ok) { out.game = await r.json(); out.botOnline = true; }
        else out.botNeden = 'http-' + r.status;
      } catch { out.botNeden = 'erisim-yok'; }
    }
    return res.json(out);
  }

  return res.status(404).json({ error: 'not found' });
}