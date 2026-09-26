import { botBase, botHeaders } from '../lib/_session.js';
import { originalPath } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
  res.setHeader('Access-Control-Allow-Origin', site || '*');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');

  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);

  let kind = null;
  if (op.endsWith('/rich')) kind = 'rich';
  else if (op.endsWith('/level')) kind = 'level';
  if (!kind) return res.status(400).json({ error: 'kind=rich|level', path: op });

  console.log('[lb] path:', op, 'kind:', kind);

  const bBase = botBase();
  const bSec = process.env.BOT_API_SECRET || '';
  if (bBase && bSec) {
    try {
      const br = await fetch(`${bBase}/api/leaderboard/${kind}`, {
        headers: botHeaders()
      });
      if (br.ok) {
        const bj = await br.json();
        if (bj.data && Array.isArray(bj.data)) {
          return res.json({
            kind,
            updated: new Date().toISOString(),
            data: bj.data.slice(0, 10),
            source: 'croxydb'
          });
        }
      }
    } catch {}
  }
  return res.json({
    kind,
    updated: new Date().toISOString(),
    data: [],
    source: 'unavailable'
  });
}