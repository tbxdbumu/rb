import { botBase } from '../lib/_session.js';

/* RiseBunny oyun istemcisi (Vape) için herkese açık proxy.
 *
 * Bot (croxydb destekli) doğrudan internete açık değildir; istemci ise
 * gizli anahtar (x-bot-secret) gönderemez. Bu dosya YALNIZCA istemcinin
 * güvenli şekilde çağırabileceği salt-okunur bot uçlarını
 * https://risebunny.vercel.app/api/client/* altında yayınlar.
 * Yazma uçları (oy/yükleme/silme/düzenleme) istemcinin launcher biletini
 * (Authorization: Bearer <discordId.exp.HMAC>) aynen bota iletir; bot
 * TICKET_SECRET ile doğrular. Sır burada tutulmaz, yalnızca iletilir.
 *
 * Bot adresi Vercel env BOT_API_URL'den gelir; tanımsızsa 503 dönülür ve
 * istemci yerel (çevrimdışı) modda çalışmaya devam eder.
 */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readBody(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function proxyGet(req, res, target, query) {
  const bBase = botBase();
  if (!bBase) return res.status(503).json({ ok: false, error: 'Bot API bağlı değil.' });
  try {
    const qs = query ? `?${query}` : '';
    const auth = req.headers.authorization || '';
    const r = await fetch(`${bBase}${target}${qs}`, {
      headers: { ...(auth ? { Authorization: auth } : {}) }
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Bot verisi alınamadı.' });
  }
}

async function proxyPost(req, res, target) {
  const bBase = botBase();
  if (!bBase) return res.status(503).json({ ok: false, error: 'Bot API bağlı değil.' });
  try {
    const body = await readBody(req);
    const auth = req.headers.authorization || '';
    const r = await fetch(`${bBase}${target}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: auth } : {})
      },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Bot verisi alınamadı.' });
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  // /api/client/... önekini at, bot yoluna çevir.
  const op = url.pathname.replace(/^\/api\/client/, '') || '/';
  const query = url.searchParams.toString();

  // ── Premium doğrulama + Discord kimliği (ad + avatar dahil) ──
  if (req.method === 'GET' && /^\/dogrula\/[0-9]{15,20}$/.test(op)) {
    return proxyGet(req, res, `/api${op}`, '');
  }

  // ── Hesap özeti (cüzdan, seviye, pelerin) ──
  if (req.method === 'GET' && /^\/user\/[0-9]{15,20}$/.test(op)) {
    return proxyGet(req, res, `/api/kullanici/${op.split('/').pop()}`, '');
  }

  // ── Kişisel onaylı configler: /config/<discordId>?durum=approved ──
  if (req.method === 'GET' && /^\/config\/[0-9A-Za-z._-]{1,40}$/.test(op)) {
    return proxyGet(req, res, `/api${op}`, query);
  }

  // ── Herkese açık katalog + indirme (yazar adı/avatar dahil) ──
  if (req.method === 'GET' && op === '/public/configs') {
    return proxyGet(req, res, '/api/public/configs', query);
  }
  if (req.method === 'GET' && /^\/public\/config\/[0-9A-Za-z._-]{1,40}$/.test(op)) {
    return proxyGet(req, res, `/api${op}`, query);
  }

  // ── Vape içi canlılık (nabız + çıkış) — bilet aynen iletilir ──
  if (req.method === 'POST' && (op === '/presence' || op === '/presence/leave')) {
    return proxyPost(req, res, `/api${op}`);
  }

  // ── Yazma uçları: launcher bileti aynen iletilir ──
  if (req.method === 'POST' && op === '/public/vote') {
    return proxyPost(req, res, '/api/public/vote');
  }
  if (req.method === 'POST' && op === '/public/upload') {
    return proxyPost(req, res, '/api/public/upload');
  }
  if (req.method === 'GET' && op === '/public/mine') {
    return proxyGet(req, res, '/api/public/mine', query);
  }
  if (req.method === 'POST' && op === '/public/delete') {
    return proxyPost(req, res, '/api/public/delete');
  }
  if (req.method === 'POST' && op === '/public/edit') {
    return proxyPost(req, res, '/api/public/edit');
  }

  return res.status(404).json({ ok: false, error: 'not found', path: op });
}
