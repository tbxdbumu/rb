import { botBase } from '../lib/_session.js';
import { FB_KEY, PROJECT, BOT_ID, originalPath } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();

  console.log('[public] path:', op);

  // ── FIREBASE CONFIG ──
  if (op.endsWith('/firebase-config')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const config = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    if (!config.apiKey || !config.projectId) {
      return res.status(500).json({ error: 'Firebase config not configured' });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(config);
  }

  // ── STATS ──
  if (op.endsWith('/stats')) {
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
    const out = { servers: null, users: null, votes: null, live: false };
    const tok = process.env.TOPGG_TOKEN || '';

    if (tok && BOT_ID) {
      try {
        const [st, bot] = await Promise.all([
          fetch(`https://top.gg/api/bots/${BOT_ID}/stats`, { headers: { Authorization: tok } }),
          fetch(`https://top.gg/api/bots/${BOT_ID}`, { headers: { Authorization: tok } })
        ]);
        if (st.ok) {
          const sj = await st.json().catch(() => ({}));
          if (sj.server_count != null) { out.servers = sj.server_count; out.live = true; }
        }
        if (bot.ok) {
          const bj = await bot.json().catch(() => ({}));
          if (bj.monthlyPoints != null) { out.votes = bj.monthlyPoints; out.live = true; }
        }
        if (out.live) return res.json({ ...out, updated: new Date().toISOString() });
      } catch {}
    }
    if (bBase) {
      try {
        const r = await fetch(`${bBase}/api/stats`);
        if (r.ok) {
          const j = await r.json();
          if (j.servers != null) {
            out.servers = j.servers;
            out.users = j.users ?? null;
            out.live = true;
            return res.json({ ...out, updated: new Date().toISOString() });
          }
        }
      } catch {}
    }
    return res.json({ ...out, updated: new Date().toISOString() });
  }

  // ── STATUS ──
  if (op.endsWith('/status')) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30');
    const out = { bakim: false, sebep: '', kaynak: 'yok' };

    if (bBase) {
      try {
        const r = await fetch(`${bBase}/api/site-status`);
        if (r.ok) {
          const j = await r.json();
          if (j.bakim) {
            out.bakim = true;
            out.sebep = j.sebep || '';
            out.kaynak = 'bot';
            return res.json(out);
          }
        }
      } catch {}
    }
    if (PROJECT && FB_KEY) {
      try {
        const r = await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/config/maintenance?key=${FB_KEY}`,
          { headers: { Referer: (process.env.SITE_URL || 'https://risebunny.vercel.app').replace(/\/+$/, '') + '/' } }
        );
        if (r.ok) {
          const doc = await r.json();
          const f = doc.fields || {};
          const active = f.active && (f.active.booleanValue === true || f.active.booleanValue === 'true');
          if (active) {
            const msg = f.message && f.message.mapValue && f.message.mapValue.fields;
            const tr = msg && msg.tr && msg.tr.stringValue;
            const en = msg && msg.en && msg.en.stringValue;
            out.bakim = true;
            out.sebep = tr || en || '';
            out.kaynak = 'firestore';
          }
        }
      } catch {}
    }
    return res.json(out);
  }

  return res.status(404).json({ error: 'not found', path: op });
}