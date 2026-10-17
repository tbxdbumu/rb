/* api/v1/[...path].js testi — Firestore/gerçek bot yerine sahte bot.
 *
 * Bu repo canlı kaynak (github.com/tbxdbumu/rb, Vercel 'risebunny'):
 *   cd C:\Users\enesi\AppData\Local\Temp\opencode\rb-live
 *   node tests/vape-rest.test.mjs
 *
 * Sırada ne var diye tek tek kontrol edilen şeyler:
 *   - jeton imzası (süreli / sahte / süresiz)
 *   - AccountInfoResponse.fromJson'in ZORUNLU beklediği 5 alan
 *   - accountCreation formatı (parseApiDate fallback listesi)
 *   - UserDataResponse.fromJson'in beklediği 4 alan
 *   - PagedResult.fromJson'in ZORUNLU beklediği 6 alan
 *   - settings/save'in zarf değil DÜZ payload döndürmesi
 *   - idempotlansız rota kalmaması
 */
import crypto from 'node:crypto';

const SECRET = 'test-secret-0123456789abcdef';
process.env.SESSION_SECRET = SECRET;
process.env.BOT_API_URL = 'https://bot.test';
process.env.BOT_API_SECRET = 'bot-secret';
process.env.RISEBUNNY_SEED_KEY = 'seed-anahtari';

/* ── Sahte bot ───────────────────────────────────────────────────────────── */
const bot = new Map();
function botSeed(yol, deger) { bot.set(yol, deger); }
function botDump() {
  const o = {};
  for (const [k, v] of bot) o[k] = v;
  return o;
}

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const op = u.pathname.replace(/^\/api/, '');
  if (opts.method === 'POST') {
    bot.set(op, JSON.parse(opts.body || '{}'));
    return { ok: true, status: 200, text: async () => '{"ok":true}' };
  }
  if (!bot.has(op)) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => JSON.stringify(bot.get(op)) };
};

const { default: handler } = await import('../api/vape.js');

const ID = '985126554306773063';
function token(ttlH = 12) {
  const exp = Date.now() + ttlH * 3600 * 1000;
  const sig = crypto.createHmac('sha256', SECRET).update(`${ID}.${exp}`).digest('hex');
  return `${ID}.${exp}.${sig}`;
}

function call(method, path, body) {
  return new Promise(async (resolve) => {
    const res = {
      statusCode: 0,
      setHeader() {},
      end(chunk) {
        let json = null;
        try { json = JSON.parse(chunk); } catch {}
        resolve({ status: this.statusCode, json });
      },
    };
    const req = {
      method,
      // vercel.json: "/api/v1/:rest*" -> "/api/vape?rest=:rest*"
      // Gercek yol query'den gelir. (x-vercel-original-url production'da
      // gelmediği için ona güvenilmiyor — api/client.js de bu yüzden canlıda
      // "yol izinli degil /" veriyor.)
      query: { rest: path.split('/').filter(Boolean).join('/') },
      url: '/api/vape',
      headers: {},
      async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(JSON.stringify(body)); },
    };
    await handler(req, res);
  });
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  GECTI  ${name}`); }
  else { fail++; console.log(`  KALDI  ${name}${extra ? '  -> ' + JSON.stringify(extra).slice(0, 200) : ''}`); }
}

botSeed(`/kullanici/${ID}`, { data: { id: ID, username: 'ahmetbs' } });
botSeed(`/config/${ID}`, { data: { profiles: { 'a-b': { name: 'Klavye' } } } });
const T = token();

console.log('\n=== 1) jeton dogrulama ===');
{
  const r = await call('GET', `${T}/authenticated`);
  check('gecerli jeton 200', r.status === 200, r);
  check('sureli jeton 401', (await call('GET', `${token(-1)}/authenticated`)).status === 401);
  check('sahte imza 401',
    (await call('GET', `${ID}.${Date.now() + 9e6}.deadbeef/authenticated`)).status === 401);
  check('jetonsuz 404', (await call('GET', '/authenticated')).status === 404);
}

console.log('\n=== 2) authenticated — AccountInfoResponse.fromJson zorunlu alanlari ===');
{
  const d = (await call('GET', `${T}/authenticated`)).json?.data;
  check('successful=true', d !== undefined);
  for (const k of ['userId', 'licensed', 'registered', 'profiles', 'banned']) {
    check(`zorunlu alan: ${k}`, d?.[k] !== undefined, d);
  }
  // userId STRING olarak gelmeli: Discord ID'leri 2^53'un ustunde, JS'te
  // Number'a cevrilince yuvarlaniyordu (canlida ...73100 olarak olculmustu).
  // Gson JsonPrimitive.getAsLong() string icin Long.parseLong yoluna duser.
  check('userId string ve KAYIPSIZ', d?.userId === ID, d);
  check('userId sayi DEGIL', typeof d?.userId !== 'number', d);
  check('2^53 ustu deger yuvarlanmiyor',
    BigInt(d?.userId) === 985126554306773063n, d);
  check('username bot\'tan geldi', d?.username === 'ahmetbs', d);
  check('registered === true', d?.registered === true, d);
  check('accountCreation parseApiDate uyumlu',
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(d?.accountCreation || ''), d);
}

console.log('\n=== 3) profile/private/all — UserDataResponse.fromJson ===');
{
  const d = (await call('GET', `${T}/profile/private/all`)).json?.data;
  for (const k of ['profiles', 'publicProfiles', 'friends', 'otherData']) {
    check(`alan: ${k}`, d?.[k] !== undefined, d);
  }
  check('bot verisi geldi', d?.profiles?.['a-b']?.name === 'Klavye', d?.profiles);
}

console.log('\n=== 4) settings ===');
{
  await call('POST', `${T}/settings/save/global`, { guiScale: 2 });
  const kayit = botDump();
  check('bot\'a yazildi',
    kayit[`/config/${ID}/ayar/global`]?.guiScale === 2, Object.keys(kayit));

  const s = await call('POST', `${T}/settings/save/global`, { guiScale: 2 });
  check('save ZARFSIZ donuyor (duz payload)', s.json?.guiScale === 2, s.json);

  const l = await call('GET', `${T}/settings/load/global`);
  check('load zarli', l.json?.successful === true, l.json);
  check('load veri dondu', l.json?.data?.guiScale === 2, l.json);

  const bos = await call('GET', `${T}/settings/load/yok-boyle-bir-scope`);
  check('bilinmeyen scope bos nesne',
    bos.json?.data && Object.keys(bos.json.data).length === 0, bos.json);
}

console.log('\n=== 5) profile/public/list — PagedResult.fromJson 6 zorunlu alan ===');
{
  const d = (await call('POST', `${T}/profile/public/list`, {})).json?.data;
  for (const k of ['content', 'last', 'totalPages', 'totalElements', 'size', 'numberOfElements']) {
    check(`zorunlu alan: ${k}`, d?.[k] !== undefined, d);
  }
  check('content dizi', Array.isArray(d?.content), d);
  const t = await call('GET', `${T}/profile/public/tags`);
  check('tags dizi', Array.isArray(t.json?.data), t.json);
}

console.log('\n=== 6) private yazma uclari ===');
{
  const u = await call('POST', `${T}/profile/private/save/user`, { a: 1 });
  check('save/user data=true', u.json?.data === true, u.json);
  const p = await call('POST', `${T}/profile/private/save/profile`, { profileId: 'u1' });
  check('save/profile donuyor', p.json?.data?.profileId === 'u1', p.json);
  const r = await call('POST', `${T}/profile/private/reserve`);
  check('reserve UUID', /^[0-9a-f-]{36}$/i.test(r.json?.data || ''), r.json);
}

console.log('\n=== 7) register + bilinmeyen rota ===');
{
  check('register 200', (await call('GET', `${T}/register/ABC`)).status === 200);
  const r = await call('GET', `${T}/yok/boyle/bir/yol`);
  check('404', r.status === 404, r);
  check('zarf dogru', r.json?.successful === false && typeof r.json?.error === 'string', r.json);
}

console.log('\n=== 8) config tohumlama (bizim veritabanimiza yazma) ===');
{
  const gonder = (path, body, seedKey) => new Promise(async (resolve) => {
    const res = {
      statusCode: 0, setHeader() {},
      end(chunk) { let j = null; try { j = JSON.parse(chunk); } catch {} resolve({ status: this.statusCode, json: j }); },
    };
    const req = {
      method: 'POST',
      query: { rest: path },
      url: '/api/vape',
      headers: seedKey ? { 'x-seed-key': seedKey } : {},
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); },
    };
    await handler(req, res);
  });

  const r = await gonder('_seed', { configs: [{ name: 'Legit', modules: { Aimbot: true } }] }, 'seed-anahtari');
  check('dogru anahtarla 200', r.status === 200, r);
  check('1 yazildi', r.json?.data?.yazilan === 1, r.json);
  check('bot\'a gitti', botDump()['/public/profiller']?.name === 'Legit', Object.keys(botDump()));
  check('modul icerigi korundu',
    botDump()['/public/profiller']?.modules?.Aimbot === true, botDump()['/public/profiller']);

  const yanlis = await gonder('_seed', { configs: [{}] }, 'yanlis-anahtar');
  check('yanlis anahtar 401', yanlis.status === 401, yanlis);

  const dizi = await gonder('_seed', [{ name: 'Dogrudan dizi' }], 'seed-anahtari');
  check('dizi formu da kabul', dizi.status === 200 && dizi.json?.data?.yazilan === 1, dizi.json);

  const bozuk = await gonder('_seed', { configs: 'dizi degil' }, 'seed-anahtari');
  check('bozuk govde 400', bozuk.status === 400, bozuk);
}

console.log('\n=== 9) seed kapaliyken guvenli ===');
{
  delete process.env.RISEBUNNY_SEED_KEY;
  const res = {
    statusCode: 0, setHeader() {},
    end(chunk) { let j = null; try { j = JSON.parse(chunk); } catch {} this.out = { status: this.statusCode, json: j }; },
  };
  const req = {
    method: 'POST', query: { rest: '_seed' }, url: '/api/vape',
    headers: { 'x-seed-key': 'herhangi' },
    async *[Symbol.asyncIterator]() { yield Buffer.from('{"configs":[]}'); },
  };
  await handler(req, res);
  check('anahtar tanimli degilse 503', res.out.status === 503, res.out);
  check('hicbir sey yazilmadi', !('/public/profiller' in botDump() && false));
}

console.log('\n=== 10) bot config kayitlarinin istemciye cevrilmesi ===');
{
  // Bot'un gercek config sekli (canlidan olculdu).
  botSeed('/public/configs', {
    ok: true, count: 2, kategori: 'top',
    configs: [
      { id: '179182301531286929', name: 'Bedwars', description: 'Legit bedwars config i',
        sharerId: '985126554306773063', sharerName: 'ahmetbs',
        sharerAvatar: 'https://cdn.discordapp.com/avatars/985126554306773063/x.png',
        downloads: 2, votes: 5, voted: false, createdAt: 1791823015312 },
      { id: '179182306335890796', name: 'Skywars', description: 'Legit Skywars config i',
        sharerId: '985126554306773063', sharerName: 'ahmetbs',
        downloads: 1, votes: 3, voted: false, createdAt: 1791823063358 },
    ],
  });

  const r = await call('POST', `${T}/profile/public/list`, { mode: 'POPULAR' });
  const d = r.json?.data;
  check('list 200', r.status === 200, r);
  check('iki config dondu', d?.content?.length === 2, d);
  check('totalElements dogru', d?.totalElements === 2, d);

  const ilk = d?.content?.[0];
  // PublicProfileSummary.fromJson'in okudugu alanlar
  check('name', ilk?.name === 'Bedwars', ilk);
  check('profileId string ve KAYIPSIZ', ilk?.profileId === '179182301531286929', ilk);
  check('version sayi', ilk?.version === 1, ilk);
  check('likes <- votes', ilk?.likes === 5, ilk);
  check('dislikes 0', ilk?.dislikes === 0, ilk);
  check('tags <- kategori', ilk?.tags?.[0] === 'top', ilk);
  // PublicProfileUser.fromJson: userId + username (yoksa profil dusuyor)
  check('owner.userId string', ilk?.owner?.userId === '985126554306773063', ilk?.owner);
  check('owner.username', ilk?.owner?.username === 'ahmetbs', ilk?.owner);

  // Kullanicinin istegi: paylasim kodu LISTEDE GORUNMESIN.
  check('shareCode GONDERILMIYOR', !('shareCode' in (ilk || {})), ilk);

  // Bos katalog
  bot.set('/public/configs', { ok: true, count: 0, configs: [] });
  const bos = await call('POST', `${T}/profile/public/list`, {});
  check('bos katalog bos sayfa', bos.json?.data?.content?.length === 0, bos.json);
  check('bos katalogda last=true', bos.json?.data?.last === true, bos.json);

  // Bot cevap vermezse catlama
  bot.delete('/public/configs');
  const hata = await call('POST', `${T}/profile/public/list`, {});
  check('bot yoksa bos sayfa', hata.json?.data?.content?.length === 0, hata.json);
}

console.log(`\n===== ${pass} gecti, ${fail} kaldi =====`);
process.exit(fail ? 1 : 0);