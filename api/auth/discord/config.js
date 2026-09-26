import { botBase, botHeaders } from '../../../lib/_session.js';
import { readJson, originalPath, FB_KEY, PROJECT } from '../../../lib/_helpers.js';

function randCode(len = 8) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

const configDocUrl = (id) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_configs/${id}?key=${FB_KEY}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();

  if (op.endsWith('/configs') && req.method === 'GET') {
    try {
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_configs?key=${FB_KEY}&orderBy=createdAt desc&pageSize=50`,
        { headers: { Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, '')}/` : 'https://risebunny.vercel.app/' } }
      );
      if (!r.ok) return res.status(500).json({ ok: false, error: 'configler alınamadı' });
      const data = await r.json();
      const docs = data.documents || [];
      const configs = docs.map(d => {
        const f = d.fields || {};
        return {
          id: d.name.split('/').pop(),
          name: f.name?.stringValue || '',
          description: f.description?.stringValue || '',
          status: f.status?.stringValue || 'pending',
          uploader: f.uploader?.stringValue || '',
          uploaderName: f.uploaderName?.stringValue || '',
          createdAt: f.createdAt?.integerValue || 0,
          modules: f.modules?.arrayValue?.values?.map(v => v.stringValue).filter(Boolean) || [],
          approvedAt: f.approvedAt?.integerValue || null,
        };
      });
      return res.json({ ok: true, configs });
    } catch (e) {
      console.error('[config] list err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  if (op.endsWith('/configs') && req.method === 'POST') {
    const body = await readJson(req);
    const discordId = String(body.discordId || '').replace(/\D/g, '').slice(0, 20);
    const name = String(body.name || '').slice(0, 64);
    const description = String(body.description || '').slice(0, 200);
    const modules = Array.isArray(body.modules) ? body.modules : [];

    if (!discordId || discordId.length < 15 || !name || !modules.length) {
      return res.status(400).json({ ok: false, error: 'eksik alan' });
    }

    let username = `Kullanıcı_${discordId.slice(-4)}`;
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(discordId)}`, {
          headers: botHeaders()
        });
        if (r.ok) {
          const u = await r.json();
          if (u.username) username = u.username;
        }
      } catch {}
    }

    const id = randCode(8);
    const now = Date.now();

    try {
      await fetch(configDocUrl(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: {
          name: { stringValue: name },
          description: { stringValue: description },
          status: { stringValue: 'pending' },
          uploader: { stringValue: discordId },
          uploaderName: { stringValue: username },
          modules: { arrayValue: { values: modules.map(m => ({ stringValue: m })) } },
          createdAt: { integerValue: String(now) },
        }})
      });

      if (bBase && process.env.BOT_API_SECRET) {
        try {
          await fetch(`${bBase}/api/config/notify`, {
            method: 'POST',
            headers: { ...botHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, username, configId: id, name })
          });
        } catch {}
      }

      return res.json({ ok: true, id, status: 'pending' });
    } catch (e) {
      console.error('[config] create err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  if (op.match(/^\/api\/config\/configs\/[^/]+$/)) {
    const id = op.split('/').pop();
    try {
      const r = await fetch(configDocUrl(id));
      if (r.status === 404) return res.status(404).json({ ok: false, error: 'config bulunamadı' });
      if (!r.ok) return res.status(500).json({ ok: false, error: 'config alınamadı' });
      const d = await r.json();
      const f = d.fields || {};
      if (f.status?.stringValue !== 'approved') {
        return res.status(403).json({ ok: false, error: 'config onaylanmamış' });
      }
      return res.json({
        ok: true,
        id,
        name: f.name?.stringValue || '',
        description: f.description?.stringValue || '',
        modules: f.modules?.arrayValue?.values?.map(v => v.stringValue).filter(Boolean) || [],
      });
    } catch (e) {
      console.error('[config] get err:', e.message);
      return res.status(500).json({ ok: false, error: 'exception' });
    }
  }

  return res.status(404).json({ error: 'not found' });
}