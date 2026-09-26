import { getSession, botBase, botHeaders } from '../lib/_session.js';
import { readJson, originalPath } from '../lib/_helpers.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();
  const bSec = process.env.BOT_API_SECRET || '';

  console.log('[user] path:', op, 'method:', req.method);

  if (op.endsWith('/coupon/redeem') && req.method === 'POST') {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'Önce Discord ile giriş yapmalısın.' });
    const body = await readJson(req);
    const kod = String(body.kod || '').toUpperCase().trim();
    if (!kod) return res.status(400).json({ error: 'Kupon kodu gir.' });
    if (!bBase || !bSec) return res.status(503).json({ error: 'Bot çevrimdışı.' });
    try {
      const r = await fetch(`${bBase}/api/coupon/redeem`, {
        method: 'POST',
        headers: { ...botHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: s.id, kod })
      });
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json(j);
    } catch { return res.status(503).json({ error: 'Bot çevrimdışı.' }); }
  }

  if (op.endsWith('/deletion/request') && req.method === 'POST') {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    const body = await readJson(req);
    const docId = String(body.docId || '').slice(0, 60);
    const kapsam = ['bot', 'site', 'ikisi'].includes(body.kapsam) ? body.kapsam : 'ikisi';
    if (!docId) return res.status(400).json({ error: 'eksik alan' });
    if (!bBase || !bSec) return res.status(503).json({ error: 'bot çevrimdışı' });
    /* Kullanıcının platform verileri (sahip logunda listelenir) aynen iletilir;
       bot 429 dönerse (1 saat cooldown) durum + mesaj aynen taşınır. */
    const hamVeri = body.veri && typeof body.veri === 'object' ? body.veri : {};
    const liste = (v) => (Array.isArray(v) ? v.map(x => String(x).slice(0, 140)).slice(0, 25) : []);
    const veri = { site: liste(hamVeri.site), bot: liste(hamVeri.bot) };
    try {
      const r = await fetch(`${bBase}/api/deletion/request`, {
        method: 'POST',
        headers: { ...botHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, discordId: s.id, username: s.username || '', kapsam, veri })
      });
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json(j);
    } catch { return res.status(503).json({ error: 'bot çevrimdışı' }); }
  }

  if (op.endsWith('/deletion/status') && req.method === 'GET') {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    const docId = String(url.searchParams.get('doc') || '').slice(0, 60);
    if (!docId) return res.status(400).json({ error: 'eksik alan' });
    if (!bBase || !bSec) return res.json({ durum: 'bekliyor' });
    try {
      const r = await fetch(
        `${bBase}/api/deletion/status?doc=${encodeURIComponent(docId)}&user=${encodeURIComponent(s.id)}`,
        { headers: botHeaders() }
      );
      const j = await r.json().catch(() => ({}));
      if (j.discordId && String(j.discordId) !== String(s.id))
        return res.status(403).json({ error: 'forbidden' });
      return res.json({ durum: j.durum || 'bekliyor', sebep: j.sebep || '' });
    } catch { return res.json({ durum: 'bekliyor' }); }
  }

  if (op.endsWith('/log') && req.method === 'POST') {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    const body = await readJson(req);
    const baslik = String(body.baslik || '🌐 Site Olayı').slice(0, 100);
    const metin = String(body.metin || '').slice(0, 1500);
    if (!metin) return res.status(400).json({ error: 'eksik alan' });
    if (bBase && bSec) {
      try {
        await fetch(`${bBase}/api/log`, {
          method: 'POST',
          headers: { ...botHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ baslik, metin, kim: s.username || s.id })
        });
      } catch {}
    }
    return res.json({ ok: true, mirror: true });
  }

  if (op.endsWith('/notify') && req.method === 'POST') {
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    const body = await readJson(req);
    const userIds = Array.isArray(body.userIds) ? body.userIds.map(String).slice(0, 20) : [];
    const title = String(body.title || '🔔 Bildirim').slice(0, 100);
    const text = String(body.text || '').slice(0, 500);
    const link = String(body.url || '').slice(0, 200);
    const kind = String(body.kind || 'notify').slice(0, 30);
    const from = String(body.from || (s.username || s.id || '')).slice(0, 120);
    if (!userIds.length || !text) return res.status(400).json({ error: 'eksik alan' });
    if (bBase && bSec) {
      try {
        const nr = await fetch(`${bBase}/api/notify`, {
          method: 'POST',
          headers: { ...botHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds, title, text, url: link, kind, from })
        });
        if (nr.ok) return res.json({ ok: true, mirror: true, delivered: true });
        return res.json({ ok: true, mirror: true, delivered: false });
      } catch { return res.json({ ok: true, mirror: true, delivered: false }); }
    }
    return res.json({ ok: true, mirror: true, delivered: false });
  }

  if (op.endsWith('/contact') && req.method === 'POST') {
    /* Discord-only iletişim: isim/e-posta YOK, kimlik cookie oturumundan gelir.
       Mesaj bot API'ye iletilir; bot da sahip log kanalına düşürür ve
       yetkili cevap verirse kullanıcıya DM gider. */
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: 'Önce Discord ile giriş yapmalısın.' });
    const body = await readJson(req);
    const subject = String(body.subject || '').slice(0, 120);
    const message = String(body.message || '').slice(0, 2000);
    const lang = body.lang === 'en' ? 'en' : 'tr';
    if (!subject || message.length < 3)
      return res.status(400).json({ error: 'eksik alan' });
    if (!bBase || !bSec) return res.status(503).json({ error: 'Bot çevrimdışı.' });
    try {
      const r = await fetch(`${bBase}/api/contact`, {
        method: 'POST',
        headers: { ...botHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: s.id,
          username: s.username || '',
          subject,
          message,
          lang,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return res.status(r.status).json({
          error: j.error === 'missing-fields'
            ? 'eksik alan'
            : 'Mesajınız iletilemedi, lütfen tekrar dene.',
        });
      }
      return res.json({ ok: true, id: j.id });
    } catch {
      return res.status(503).json({ error: 'Bot çevrimdışı.' });
    }
  }

  return res.status(404).json({ error: 'not found', path: op });
}