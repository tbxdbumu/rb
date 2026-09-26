import crypto from 'node:crypto';
import { timingSafeEqual, readRaw, originalPath } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);

  console.log('[webhooks] path:', op, 'method:', req.method);

  // ── TOPGG VOTE ──
  if (op.endsWith('/vote') && req.method === 'POST') {
    const secret = process.env.TOPGG_WEBHOOK_SECRET || '';
    if (!secret) return res.status(500).json({ error: 'webhook secret not configured' });

    let raw;
    try {
      raw = await readRaw(req);
    } catch {
      return res.status(400).json({ error: 'malformed request' });
    }

    const sigHeader = req.headers['x-topgg-signature'];
    if (!sigHeader) return res.status(401).json({ error: 'signature missing' });

    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const parts = Object.fromEntries(String(sig).split(',').map(p => p.split('=')));
    if (!parts.t || !parts.v1) return res.status(422).json({ error: 'invalid signature format' });

    if (Math.abs(Date.now() - parseInt(parts.t, 10) * 1000) > 30000) {
      return res.status(403).json({ error: 'timestamp outside window' });
    }

    const expected = crypto.createHmac('sha256', secret)
      .update(`${parts.t}.${raw}`).digest('hex');
    if (!timingSafeEqual(expected, parts.v1)) {
      return res.status(403).json({ error: 'invalid signature' });
    }

    try {
      const body = JSON.parse(raw.toString('utf8'));
      console.log(`[topgg-vote] v1 ${body.type} alındı`);
    } catch {
      return res.status(400).json({ error: 'malformed json' });
    }

    return res.status(204).end();
  }

  return res.status(404).json({ error: 'not found', path: op });
}