import { botBase } from '../lib/_session.js';
import { originalPath } from '../lib/_helpers.js';

/* Vape istemcisi → bot köprüsü: /api/client/<bot-yolu> isteklerini botun
   kendi HTTP API'sine aktarır. İstemcinin (RisebunnyApi.java) kullandığı
   uçlar whitelist'lidir; bot admin uçlarına (/api/user/:id, /api/shop gibi
   x-bot-secret isteyenler) geçit yoktur.

   Eşlemeler (istemci apiBase = .../api/client):
     GET  /dogrula/{id}      → bot /api/dogrula/{id}
     GET  /user/{id}          → bot /api/kullanici/{id}
     GET  /config/{id}        → bot /api/config/{id}
     /public/*                → bot /api/public/*   (yazma uçları launcher bileti ister)
     /friends/*               → bot /api/friends/* (launcher bileti ister)
     /presence, /presence/leave, /presence/same → bot aynısı (bilet ister)
     /party/*                 → bot /api/party/*   (bilet ister)

   NOT: bu dosya rb-main'deki api/vape.js'ten farklı olarak Authorization
   başlığını /public/, /friends/, /party/ ve presence uçlarına da iletir —
   botun _ticketIzinli doğrulaması başlıktan okur. */

const ALLOW_PREFIXES = [
  '/dogrula/',
  '/kullanici/',
  '/config/',
  '/public/',
  '/friends/',
  '/party/',
];
const ALLOW_EXACT = new Set([
  '/public',
  '/presence',
  '/presence/leave',
  '/presence/same',
]);

const TICKET_PREFIXES = [
  '/public/',
  '/friends/',
  '/party/',
  '/presence',
];

const BOT_TIMEOUT_MS = 9500;
const MAX_BODY = 1.5 * 1024 * 1024; // config base64 ~1 MB sınırına başlık payı

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const bBase = botBase();
  if (!bBase) return res.status(502).json({ error: 'BOT_API_URL tanimli degil' });

  const url = new URL(req.url, `https://${req.headers.host}`);
  /* Gerçek yol artık rewrite'in kendi parametresiyle geliyor:
       /api/client/:rest*  ->  /api/client?rest=:rest*
     Önceden x-vercel-original-url header'ı okunuyordu; header PRODUCTION'DA
     GELMİYOR (canlıda ölçüldü: "yol izinli degil", path "/"), yani istemcinin
     /public, /friends, /party, /presence ucalarinin hepsi 404 donuyordu.
     Sıra: query -> req.url -> header. */
  const rest = req.query?.rest;
  const ham = rest
    ? (Array.isArray(rest) ? rest.join('/') : String(rest))
    : String(req.url || '').split('?')[0].replace(/^\/api\/client\/?/, '');
  /* ALLOW_PREFIXES/ALLOW_EXACT girdileri BAŞTA '/' ile yazılmış
     ("/dogrula/", "/public"). Rewrite parametresi slash'SİZ gelir
     (rest=dogrula/9851...), req.url ise "/dogrula/..." şeklinde. İkisini de
     tek biçime getiriyoruz: baştaki slash'i normalize et, sondakini at.
     (Canlıda ölçtük: slash yoksa allowlist'e takılıp 404 dönüyor.) */
  const op = ('/' + ham.replace(/^\/+/, ''))
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '') || '/';
  const allowed = ALLOW_PREFIXES.some(p => op.startsWith(p)) || ALLOW_EXACT.has(op);
  if (!allowed) return res.status(404).json({ error: 'yol izinli degil', path: op });

  const headers = { 'user-agent': 'RiseBunnySiteProxy' };
  if (TICKET_PREFIXES.some(p => op.startsWith(p))) {
    const auth = req.headers['authorization'];
    if (auth && /^Bearer [\w.-]{10,300}$/i.test(String(auth))) {
      headers['authorization'] = String(auth);
    }
  }

  const init = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
  };
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = await readBody(req);
      if (body.length) init.body = body;
      headers['content-type'] = req.headers['content-type'] || 'application/json';
    } catch (e) {
      return res.status(413).json({ error: String(e.message || e) });
    }
  }

  try {
    const hedef = `${bBase}/api${op}${url.search || ''}`;
    const cevap = await fetch(hedef, init);
    const metin = await cevap.text();
    res.status(cevap.status)
      .setHeader('Content-Type', cevap.headers.get('content-type') || 'application/json')
      .send(metin || '{}');
  } catch (e) {
    res.status(502).json({ error: 'bot yanit vermedi', detay: String((e && e.message) || e) });
  }
}
