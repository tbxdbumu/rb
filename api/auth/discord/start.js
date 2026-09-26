import { safeNext } from '../../../lib/_session.js';
import { CLIENT_ID, siteBase } from '../../../lib/_helpers.js';

export default function handler(req, res) {
  try {
    if (!CLIENT_ID) return res.status(500).send('DISCORD_CLIENT_ID tanımlı değil.');
    const base = siteBase(req);
    const cbPath = process.env.DISCORD_CALLBACK_PATH || '/api/auth/discord/callback';
    const redirect = `${base}${cbPath}`;

    const url = new URL(req.url, base);
    
    // ✅ Launcher device kodu — next içinden VE doğrudan query'den al
    let device = String(url.searchParams.get('device') || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8);
    
    let next = safeNext(url.searchParams.get('next'));
    
    // next içinde device varsa onu da yakala (?device=ABC123)
    if (!device) {
      const m = String(next).match(/[?&]device=([A-Za-z0-9]{4,12})/);
      if (m) device = m[1];
    }

    // device'ı her zaman next'e ekle (varsa)
    if (device) {
      // Eski device'ı next'ten temizle, sonra ekle
      next = next.replace(/[?&]device=[A-Za-z0-9]+/g, '');
      next = next + (next.includes('?') ? '&' : '?') + 'device=' + device;
    }

    const u = new URL('https://discord.com/api/oauth2/authorize');
    u.searchParams.set('client_id', CLIENT_ID);
    u.searchParams.set('redirect_uri', redirect);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'identify email');
    u.searchParams.set('state', Buffer.from(next).toString('base64url'));

    res.redirect(302, u.toString());
  } catch (e) {
    res.status(500).send('OAuth start error');
  }
}
