/** Oturum yardımcısı: HMAC imzalı cookie (rb_session). Sır SADECE Vercel env'de. */
import crypto from 'node:crypto';

const COOKIE = 'rb_session';
const TTL = 7 * 24 * 3600 * 1000;

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

let _secretCache = null;
function secret() {
  if (_secretCache) return _secretCache;
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET missing or too short');
  _secretCache = s;
  return s;
}

export function signSession(payload) {
  const data = b64url(JSON.stringify({ ...payload, exp: Date.now() + TTL }));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifySession(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', secret()).update(data).digest());
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(unb64url(data));
    if (!p.exp || p.exp < Date.now() || !p.id) return null;
    return p;
  } catch { return null; }
}

export function readCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i <= 0) return;
    const k = p.slice(0, i).trim();
    const raw = p.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(raw); } catch { out[k] = raw; }
  });
  return out;
}

export function getSession(req) {
  return verifySession(readCookies(req)[COOKIE]);
}

function isSecureReq(req) {
  try {
    const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').toLowerCase();
    if (host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('192.168.') || host.startsWith('10.')) return false;
    if (proto) return proto === 'https';
    // Vercel / production varsayılanı: https. SITE_URL http ise Secure koyma.
    const site = String(process.env.SITE_URL || '').toLowerCase();
    if (site.startsWith('http://')) return false;
    if ((process.env.NODE_ENV || '').toLowerCase() === 'development') return false;
    return true;
  } catch { return false; }
}

export function setSession(res, payload, req) {
  const v = signSession(payload);
  const parts = [
    `${COOKIE}=${v}`,
    'Path=/',
    `Max-Age=${TTL / 1000}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (isSecureReq(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSession(res, req) {
  const parts = [`${COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (isSecureReq(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function safeNext(v) {
  const s = String(v || '/risebunny');
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/.test(s)) return '/risebunny';
  return s;
}

export function botHeaders() {
  const sec = process.env.BOT_API_SECRET;
  return { 'x-bot-secret': sec || '' };
}

export function botBase() {
  return (process.env.BOT_API_URL || '').replace(/\/+$/, '');
}