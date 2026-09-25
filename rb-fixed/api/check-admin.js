import { fbCreds } from '../lib/_helpers.js';

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
const ADMIN_DISCORD_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uid, discordId } = req.body || {};
  if (!uid) {
    return res.status(400).json({ error: 'UID required' });
  }

  let isAdmin = false;
  if (uid && ADMIN_UIDS.includes(uid)) {
    isAdmin = true;
  } else if (discordId && (ADMIN_DISCORD_IDS.includes(String(discordId)) || ADMIN_UIDS.includes(String(discordId)))) {
    isAdmin = true;
  } else {
    try {
      const fb = fbCreds(uid);
      const email = fb.email.toLowerCase();
      for (const discId of ADMIN_DISCORD_IDS) {
        if (email === 'd' + discId + '@discord.risebunny.local') {
          isAdmin = true;
          break;
        }
      }
    } catch (e) {}
  }

  return res.status(200).json({ isAdmin });
}