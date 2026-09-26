import { setSession, botBase } from '../lib/_session.js';
import { FB_KEY, readJson, fbCreds } from '../lib/_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
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