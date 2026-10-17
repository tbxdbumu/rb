/* api/client.js yön çözümleme testi.
 *
 * Canlıda ölçülen iki hata:
 *   1) x-vercel-original-url production'da gelmiyor → op = "/" → her şey 404.
 *      Rewrite parametresi (:rest*) ile düzeltildi.
 *   2) Baştaki "/" silinince op = "dogrula/9851..." oluyordu ve
 *      ALLOW_PREFIXES ("/dogrula/") ile eşleşmiyordu → yine 404.
 *      Slash korunmalı.
 *
 * Burada handler'ı sahte req/res ile çağırıp operatörün ne ürettiğini izliyoruz:
 * allowlist reddi 404 döndürüyor, kabul 502'ye düşüyor (çünkü sahte fetch
 * hedefe bağlanamıyor — yani allowlist GEÇİLMİŞ demektir).
 */
process.env.BOT_API_URL = 'https://bot.invalid';
process.env.BOT_API_SECRET = 's';
process.env.SESSION_SECRET = 'test-secret-0123456789abcdef';

const { default: handler } = await import('../api/client.js');

async function opUret(query, url) {
  let out = null;
  const res = {
    statusCode: 0,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(o) { out = { status: this.statusCode, body: o }; },
    send(t) { out = { status: this.statusCode, body: String(t).slice(0, 80) }; },
    end() { out = out || { status: this.statusCode, body: null }; },
  };
  const req = {
    method: 'GET',
    query: query || {},
    url: url || '/api/client',
    headers: { host: 'risebunny.vercel.app' },
    async *[Symbol.asyncIterator]() {},
  };
  await handler(req, res);
  return out;
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  GECTI  ${name}`); }
  else { fail++; console.log(`  KALDI  ${name}${extra ? '  -> ' + JSON.stringify(extra) : ''}`); }
}

console.log('\n=== rewrite parametresinden yol (asil yol) ===');
{
  const r = await opUret({ rest: 'dogrula/985126554306773063' });
  // 502 = allowlist gecti, fetch basarisiz. 404 = reddedildi.
  check('dogrula/ allowlist\'i gecti', r.status !== 404, r);
}
{
  const r = await opUret({ rest: 'public/configs' });
  check('public/ allowlist\'i gecti', r.status !== 404, r);
}
{
  const r = await opUret({ rest: 'yok-boyle-bir-yol' });
  check('bilinmeyen yol reddedildi (404)', r.status === 404, r);
  check('reddetme yolu gosteriyor', r.body?.path === '/yok-boyle-bir-yol', r.body);
}
{
  const r = await opUret({ rest: 'presence/leave' });
  check('presence/leave gecti', r.status !== 404, r);
}
{
  const r = await opUret({ rest: 'friends/list' });
  check('friends/ gecti', r.status !== 404, r);
}

console.log('\n=== coklu segment (dizi formu) ===');
{
  const r = await opUret({ rest: ['party', 'create'] });
  check('dizi olarak gelen rest birlestiriliyor', r.status !== 404, r);
}

console.log('\n=== query yoksa req.url yedeği ===');
{
  const r = await opUret({}, '/api/client/dogrula/985126554306773063');
  check('req.url\'den yol okunuyor', r.status !== 404, r);
}
{
  const r = await opUret({}, '/api/client');
  check('yol yoksa izinli degil', r.status === 404, r);
}

console.log(`\n===== ${pass} gecti, ${fail} kaldi =====`);
process.exit(fail ? 1 : 0);