import { botBase, botHeaders } from '../../../lib/_session.js';
import { readJson, originalPath, FB_KEY, PROJECT } from '../../../lib/_helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();

  if (op.endsWith('/contact') && req.method === 'POST') {
    const body = await readJson(req);
    const discordId = String(body.discordId || '').replace(/\D/g, '').slice(0, 20);
    const username = String(body.username || '').slice(0, 60);
    const subject = String(body.subject || '').slice(0, 120);
    const message = String(body.message || '').slice(0, 2000);
    const lang = body.lang === 'en' ? 'en' : 'tr';

    if (!discordId || discordId.length < 15) {
      return res.status(400).json({ ok: false, error: 'geçersiz discord id' });
    }
    if (!subject || message.length < 3) {
      return res.status(400).json({ ok: false, error: 'eksik alan' });
    }

    try {
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/messages?key=${FB_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              name: { stringValue: String(username || "Discord Üyesi").slice(0, 60) },
              email: { stringValue: `d${discordId}@discord.risebunny.local` },
              subject: { stringValue: subject },
              message: { stringValue: message },
              lang: { stringValue: lang },
              createdAt: { integerValue: String(Date.now()) },
              discordId: { stringValue: discordId },
              discordName: { stringValue: String(username || "").slice(0, 60) },
            },
          }),
        });

      if (!r.ok) {
        return res.status(500).json({ ok: false, error: 'mesaj kaydedilemedi' });
      }

      if (bBase && process.env.BOT_API_SECRET) {
        try {
          await fetch(`${bBase}/api/contact`, {
            method: 'POST',
            headers: { ...botHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, username, subject, message, lang })
          });
        } catch {}
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error('[contact] hata:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  return res.status(404).json({ error: 'not found' });
}