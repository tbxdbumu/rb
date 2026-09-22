import { getSession, clearSession, botBase, botHeaders } from '../lib/_session.js';
import { avatarUrl, siteBase } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const base = siteBase(req);
  const url = new URL(req.url, base);

  if (url.searchParams.get('logout') === '1') {
    clearSession(res);
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