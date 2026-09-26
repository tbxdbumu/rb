/* lib/_helpers.js — ortak yardımcılar */
import crypto from 'node:crypto';
import { botBase, botHeaders } from './_session.js';

export const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
export const FB_KEY = process.env.FIREBASE_API_KEY || "AIzaSyAq5Nafl9aI2TabzGsj5J9ij6lNwyfTguM";
export const PROJECT = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0590499912';
export const BOT_ID = process.env.TOPGG_BOT_ID || '';

export function siteBase(req) {
  const env = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

/** Vercel rewrite yaptığında orijinal path'i taşıyan header'lardan okur */
export function originalPath(req, fallbackUrl) {
  const h = req.headers['x-vercel-original-url'] || req.headers['x-forwarded-uri'];
  if (h) return String(h).split('?')[0];
  return fallbackUrl ? fallbackUrl.pathname : '/';
}

export async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export async function readRaw(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 256 * 1024) throw new Error('body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function avatarUrl(id, hash) {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  try {
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(String(id)) >> 22n) % 6}.png`;
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

export function fbCreds(discordId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET missing');
  const pw = crypto.createHmac('sha256', secret).update('fb:' + discordId).digest('hex');
  return { email: `d${discordId}@discord.risebunny.local`, pw };
}

export async function ensureFirebaseUser(email, pw) {
  try {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw, returnSecureToken: false })
    });
  } catch {}
}

/* source: 'site' (web OAuth) | 'launcher' (launcher cihaz akışı). Bot bu
   bilgiye göre kullanıcıya DM + sahip loga giriş embed'i atar. */
export function linkBot(userId, username, email, source) {
  const base = botBase();
  if (!base) return;
  try {
    fetch(`${base}/api/discord/link`, {
      method: 'POST',
      headers: { ...botHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        username,
        email: email || '',
        source: source === 'launcher' ? 'launcher' : 'site'
      })
    }).catch(() => {});
  } catch {}
}