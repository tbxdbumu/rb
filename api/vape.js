/* RiseBunny — Vape Online REST uyumluluk katmanı.
 *
 * Vape 4.22 istemcisi şu tabanı kullanıyor:
 *
 *   ApiServices.resolveBaseUrl()             System.getenv("VAPE_ONLINE_BASE_URL")
 *                                             (varsayılan "https://online.vape.chat")
 *   ApiAccessTokenProvider.getAccessToken()  NativeBridge.gat()   ← bizim DLL'imiz
 *   ZeusConnectionManager static{}           System.getenv("VAPE_ZEUS_ADDRESS")
 *                                             (varsayılan "zeus-prod.vape.chat:8091")
 *
 * Yani istemci "kimin sunucusu" sorusunu ortam değişkeninden soruyor; jar'da
 * tek bir sabit adres yok. Loader bu iki değişkeni ve jetonu kendi verdiği için
 * tüm online katman kendi sunucumuza bağlanır.
 *
 * Zarf ApiResponse.fromJson'dan — doğrulandı (canlı onlar sunucusu da aynı):
 *   {"data": null, "error": "Failed to find account", "successful": false}
 *
 * ── Kapı ──────────────────────────────────────────────────────────────────
 * OnlineConnectionManager.initialize() kararı:
 *
 *   if (getAccountInfo() == null)  -> REGISTRATION_OFFLINE (ekranda görülen bu)
 *   if (banned)                    -> BANNED
 *   else if (registered)           -> REGISTERED + connect()
 *   else                           -> UNREGISTERED (sadece arkadaş sekmesi kapanır)
 *
 * `licensed` okunuyor ama HİÇ kullanılmıyor. Yani geçerli bir REGISTERED
 * cevabı yeterli.
 *
 * ── Neden bot API'sine çeviriyoruz ────────────────────────────────────────
 * Config ve friends verisi zaten var: api/client.js, istemci isteklerini
 * BOT_API_URL'deki Discord botuna aktarıyor. Bu katman aynı veriyi Vape
 * protokolüne çeviriyor — ikinci bir veritabanı işletmiyoruz, bot zaten
 * doğru kaynak. (Kendi Firestore kopyamızla yapılan ilk deneme çalışıyordu
 * ama friends/config için veri orada değil.)
 */
import crypto from 'node:crypto';
import { originalPath } from '../lib/_helpers.js';
import { botBase, botHeaders } from '../lib/_session.js';

/* ── Kimlik ─────────────────────────────────────────────────────────────────
   Launcher'ın verdiği bilet aynen burada doğrulanır: {discordId}.{expMs}.{hmac}
   api/launcher.js:31 verifyLauncherToken ile birebir aynı imza. */
const SECRET = () => process.env.SESSION_SECRET || '';

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [tokId, expires, sig] = parts;
  const s = SECRET();
  if (!s || s.length < 16) return null;
  const expect = crypto.createHmac('sha256', s).update(`${tokId}.${expires}`).digest('hex');
  const a = Buffer.from(expect);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!/^\d{15,20}$/.test(tokId)) return null;
  if (!Number(expires) || Date.now() > Number(expires)) return null;
  return tokId;
}

/* ── Bot köprüsü ────────────────────────────────────────────────────────────
   api/client.js'in yaptığı çağrı, Vape yolundan. Bot bir zaman aşımı koyuyor
   (BOT_TIMEOUT_MS = 9500); aynı bütçeyi kullanıyoruz ki istekler üst üste
   binip istemcideki CompletableFuture'lar birikmesin. */
const BOT_TIMEOUT_MS = 9500;
const MAX_BODY = 1.5 * 1024 * 1024;

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

async function readJson(req) {
  try {
    const buf = await readBody(req);
    return buf.length ? JSON.parse(buf.toString('utf8')) : {};
  } catch {
    return {};
  }
}

/** `GET botBase()+yol` → JSON (hata durumunda null). */
async function botGet(op, bilet) {
  const base = botBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api${op}`, {
      headers: { ...botHeaders(), 'user-agent': 'RiseBunnyVapeCompat' },
      signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
    });
    const t = await r.text();
    if (!r.ok) return null;
    try { return JSON.parse(t || 'null'); } catch { return null; }
  } catch { return null; }
}

/** `POST botBase()+yol` gövde → JSON. */
async function botPost(op, bilet, govde) {
  const base = botBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api${op}`, {
      method: 'POST',
      headers: {
        ...botHeaders(),
        'user-agent': 'RiseBunnyVapeCompat',
        'content-type': 'application/json',
        ...(bilet ? { authorization: `Bearer ${bilet}` } : {}),
      },
      body: JSON.stringify(govde ?? {}),
      signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
    });
    const t = await r.text();
    if (!r.ok) return null;
    try { return JSON.parse(t || 'null'); } catch { return null; }
  } catch { return null; }
}

/* ── Zarf ────────────────────────────────────────────────────────────────── */
function send(res, status, govde) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(govde));
}
const ok = (res, data) => send(res, 200, { successful: true, error: null, data });
const fail = (res, status, error) => send(res, status, { successful: false, error, data: null });

/* ── Hesap ──────────────────────────────────────────────────────────────────
   AccountInfoResponse.fromJson şu alanları ZORUNLU okuyor:
     userId, licensed, registered, profiles, banned   → get().getAsBoolean()
   username ve accountCreation null-güvenli getString ile okunuyor.
   accountCreation parseApiDate'in fallback listesine uyacak ISO-8601 olmalı
   (…'sssZ'), aksi halde ParseException → initialize()'ın catch(Throwable)'ı →
   REGISTRATION_OFFLINE.

   userId STRING olarak gönderiliyor, sayı değil. Discord kimlikleri 2^53'ün
   üstünde (985126554306773063 > 9007199254740992), JS tarafında Number'a
   çevrilince yuvarlanıyor — canlıda 985126554306773100 olarak ölçtük. Gson'da
   JsonPrimitive.getAsLong() string için Long.parseLong(getAsString()) yoluna
   düşer, yani string hem kayıpsız hem getAsLong() ile uyumlu. */
function accountInfo(id, username) {
  return {
    userId: String(id),
    username: username || String(id),
    accountCreation: new Date().toISOString(),
    licensed: true,
    registered: true,
    profiles: true,
    banned: false,
  };
}

/* ── Config dönüşümü ────────────────────────────────────────────────────────
   RiseBunny config kayıtları bot'ta şu şekilde duruyor (ölçüldü):

     { id:"179182301531286929", name:"Bedwars", description:"Legit bedwars config i",
       sharerId:"985126554306773063", sharerName:"ahmetbs", sharerAvatar:"https://…",
       downloads:2, votes:0, voted:false, createdAt:1791823015312 }

   Vape istemcisi ise PublicProfileSummary.fromJson ile şunları okuyor:
     tags(JsonArray), profileId(long), owner(PublicProfileUser),
     name, version, likes, dislikes, shareCode

   PublicProfileUser.fromJson: userId(long) + username(string). username yoksa
   null dönüp profili düşürüyor — o yüzden sharerName her zaman gönderiliyor.

   id 1.79e18, yani 2^53'ün çok üstünde; getAsLong() string'i de kabul ettiği
   için profilId'yi string gönderiyoruz (userId ile aynı sebep).

   shareCode BİLEREK GÖNDERİLMİYOR: kullanıcı config listesinin üstündeki paylaşım
   kodunun görünmesini istemiyordu. getString alanı yoksa null döner, client
   da o satırı çizmez. */
function configOzeti(cfg, kategori) {
  const id = String(cfg?.id ?? '');
  if (!id) return null;
  return {
    profileId: id,
    name: typeof cfg?.name === 'string' && cfg.name ? cfg.name : 'Profile',
    version: Number.isFinite(cfg?.version) ? cfg.version : 1,
    likes: Number.isFinite(cfg?.votes) ? cfg.votes : 0,
    dislikes: 0,
    tags: kategori ? [String(kategori)] : [],
    owner: {
      userId: String(cfg?.sharerId ?? '0'),
      username: typeof cfg?.sharerName === 'string' && cfg.sharerName
        ? cfg.sharerName
        : (typeof cfg?.name === 'string' ? cfg.name : null),
    },
    // shareCode yok — bilerek.
  };
}
   /* ── Ayar payload varsayılanları ─────────────────────────────────────────────
   Alan adları ve tipleri resmî jar'dan çözüldü (javap/CFR):

   SettingsScope.getRouteName()      -> "global" | "online"
   SettingsDataType.GLOBAL           -> GlobalSettingsPayload
   SettingsDataType.ONLINE           -> OnlineSettingsPayload

   GlobalSettingsPayload
     @SerializedName("firstRun")  Boolean firstRun
     @SerializedName("cache")     Boolean cacheEnabled
   (ikisi de boxed Boolean; null kalırsa unbox NPE veriyor)

   OnlineSettingsPayload
     @SerializedName("inventorySwitchMode")  Integer
     @SerializedName("partyShowTarget")      Boolean
     @SerializedName("autoLogin")            Boolean
     @SerializedName("showSelf")             Boolean
     @SerializedName("showUsername")         Boolean
     @SerializedName("showInventoryKeybind") JsonArray
     @SerializedName("friendStates")         Map<Long, Boolean>
     @SerializedName("shareInventory")       Boolean
     @SerializedName("showServer")           Boolean
     @SerializedName("pingKeybind")          JsonArray

   friendStates dikkat: harici sunucuda arkadaş listesinin KALICI hali
   burada tutulur — resmî istemci arkadaşlarını bu payload'tan geri yükler. */
function ayarVarsayilani(scope) {
  switch (scope) {
    case 'global':
      return { firstRun: true, cache: false };
    case 'online':
      return {
        inventorySwitchMode: 0,
        partyShowTarget: true,
        autoLogin: true,
        showSelf: true,
        showUsername: true,
        showInventoryKeybind: [],
        friendStates: {},
        shareInventory: false,
        showServer: true,
        pingKeybind: [],
      };
    default:
      return null;
  }
}

/* ── Handler ────────────────────────────────────────────────────────────────
   Dosya adi `api/vape.js`; rota vercel.json'daki
   "/api/v1/:rest*" -> "/api/vape?rest=:rest*" rewrite'i ile geliyor.

   Önceki iki deneme ve neden çalışmadılar:
     1. api/v1/[...path].js — build'e giriyor ama /api/v1/* 404 donuyor,
        dosya sistemi eşleşmesi yakalanmıyor.
     2. api/vape.js + x-vercel-original-url — header PRODUCTION'DA GELMIYOR
        (api/client.js de aynı yüzden canlıda "yol izinli degil" veriyordu).

   Bu yüzden yol rewrite'in kendi parametresiyle taşınıyor (:rest*) ve
   req.query.rest üzerinden okunuyor. Altta iki yedek daha var: query -> req.url
   -> x-vercel-original-url. Hangisi gelirse gelsin rota çözülüyor. */
function gercekYol(req) {
  const q = req?.query?.rest;
  if (q) return Array.isArray(q) ? q.join('/') : String(q);
  const ham = originalPath(req, null);
  if (ham && ham !== '/' && !ham.startsWith('/api/vape')) return ham;
  const url = String(req?.url || '');
  if (url && !url.startsWith('/api/vape')) return url;
  return '';
}

export default async function handler(req, res) {
  const hamYol = gercekYol(req);
  const seg = String(hamYol)
    .split('?')[0]
    .replace(/^\/api\/v1\/?/, '')
    .split('/')
    .filter(Boolean);

  const method = String(req.method || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (method === 'OPTIONS') return send(res, 204, {});

  if (seg.length < 1) return fail(res, 404, 'bad route: ' + (hamYol || '(bos)'));

  /* ── Yönetim: config tohumlama ───────────────────────────────────────────
     RiseBunny veritabanına config yazmak için tek giriş. Bot'un
     /api/public/* ucu zaten api/client.js üzerinden açık; burada aynı uca
     x-bot-secret ile doğrudan yazıyoruz.

     Neden ayrı bir uc? Vape'nin public config listesi hesap doğruluyor
     ("Failed to find account"), yani onların verisini kendi hesabımız
     olmadan çekmek mümkün değil. Doğru yol veriyi bizim tarafta toplamak:
     config'ı buraya POST'layan kişi onu nereden bulduysa oradan alıyor,
     biz de kendi veritabanımıza yazıyoruz ve kendi istemcilerimize
     /profile/public/list ile sunuyoruz.

     Kimlik doğrulama: RISEBUNNY_SEED_KEY ortam değişkeni, istekte
     `x-seed-key` başlığı (veya ?key=). Anahtar tanımlı değilse uç
     tamamen kapalı — yanlışlıkla açık veri yazılmasın diye. */
  if (seg[0] === '_seed' && method === 'POST') {
    const anahtar = process.env.RISEBUNNY_SEED_KEY || '';
    if (!anahtar) return fail(res, 503, 'seed kapali (RISEBUNNY_SEED_KEY tanimli degil)');
    const gelen = req.headers['x-seed-key'] || new URL(req.url, 'http://x').searchParams.get('key') || '';
    const a = Buffer.from(String(gelen));
    const b = Buffer.from(anahtar);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return fail(res, 401, 'seed anahtari yanlis');
    }

    const govde = await readJson(req);
    const liste = Array.isArray(govde) ? govde : Array.isArray(govde?.configs) ? govde.configs : null;
    if (!liste) return fail(res, 400, 'config dizisi bekleniyor ({configs:[...]})');

    const base = botBase();
    if (!base) return fail(res, 502, 'BOT_API_URL tanimli degil');

    let yazilan = 0;
    const hatalar = [];
    for (const [i, cfg] of liste.entries()) {
      try {
        const r = await fetch(`${base}/api/public/profiller`, {
          method: 'POST',
          headers: { ...botHeaders(), 'content-type': 'application/json', 'user-agent': 'RiseBunnySeed' },
          body: JSON.stringify(cfg),
          signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
        });
        if (r.ok) yazilan++;
        else hatalar.push({ i, status: r.status, name: cfg?.name ?? null });
      } catch (e) {
        hatalar.push({ i, status: 0, name: cfg?.name ?? null, hata: String(e.message || e) });
      }
    }
    return send(res, yazilan ? 200 : 502, {
      successful: yazilan > 0,
      error: yazilan ? null : 'hicbiri yazilamadi',
      data: { istenen: liste.length, yazilan, hatalar },
    });
  }

  if (seg.length < 2) return fail(res, 404, 'bad route: ' + (hamYol || '(bos)'));

  const [token, ...rest] = seg;
  const route = rest.join('/').replace(/\/+$/, '');
  const id = verifyToken(token);
  if (!id) return fail(res, 401, 'bad token');

  /* ── Kapı ────────────────────────────────────────────────────────────────
     Kullanıcı adı bot'tan gelir; düşerse Discord ID yazılır (AccountInfo
     username alanı null'a izin veriyor, ama görsel olarak kimse görmesin). */
  if (route === 'authenticated' && method === 'GET') {
    const k = await botGet(`/kullanici/${id}`, token);
    const kullanici = k?.data || k?.user || k;
    const ad = typeof kullanici?.username === 'string'
      ? kullanici.username
      : typeof k?.username === 'string' ? k.username : undefined;
    return ok(res, accountInfo(id, ad));
  }

  /* ── Kullanıcı verisi (config + friends senkronu) ─────────────────────────
     UserDataResponse.fromJson şu bekliyor:
       profiles (UUID -> RemoteProfileData), publicProfiles (userId -> ...),
       friends (JsonArray, opsiyonel), otherData (JsonArray, opsiyonel) */
  if (route === 'profile/private/all' && method === 'GET') {
    const c = await botGet(`/config/${id}`, token);
    const veri = c?.data || c || {};
    const profil = veri.profiles || veri.configs || {};
    return ok(res, {
      profiles: profil && typeof profil === 'object' ? profil : {},
      publicProfiles: veri.publicProfiles || {},
      friends: Array.isArray(veri.friends) ? veri.friends : [],
      otherData: Array.isArray(veri.otherData) ? veri.otherData : [],
    });
  }

  if (route === 'profile/private/save/user' && method === 'POST') {
    const govde = await readJson(req);
    await botPost(`/config/${id}/kullanici`, token, govde);
    return ok(res, true);
  }

  if (route === 'profile/private/save/profile' && method === 'POST') {
    const govde = await readJson(req);
    await botPost(`/config/${id}/profil`, token, govde);
    return ok(res, govde);
  }

  if (route === 'profile/private/reserve' && method === 'POST') {
    const uuid = crypto.randomUUID();
    await botPost(`/config/${id}/profil/ayir`, token, { profileId: uuid });
    return ok(res, uuid);
  }

  /* ── Ayarlar ──────────────────────────────────────────────────────────────
     SettingsApi.loadSettings zarf bekliyor (successful/error/data).
     SettingsApi.saveSettings ise GÖVDEYİ DÜZ payload olarak okuyor —
     ApiHttpClient.post(url, payloadClass, payload), zarf değil.

     KRİTİK: data BOŞ OLAMAZ. Canlıda ölçüldü:
         200 GET /settings/load/global  ->  {"successful":true,"data":{}}
         Exception java.lang.NullPointerException
           at gg.vape.manager.client.GlobalSettingsController.load(:67)
           at gg.vape.manager.client.OnlineConnectionManager.initialize(:573)
     Sebep: GlobalSettingsPayload alanları boxed Boolean —
         @SerializedName("firstRun") Boolean firstRun;
         @SerializedName("cache")   Boolean cacheEnabled;
     Boş obje -> ikisi de null -> load() içinde `this.settings.isFirstRun()`
     çağrısında UNBOX NPE veriyor ve initializeManagers zinciri kırılıyor.
     initializeDefaults() null'u doldurur ama YALNIZCA hata YOLUNDA
     çağrılıyor; biz hata üretmediğimiz için hiç çağrılmıyor.

     Bu yüzden her iki scope için de tam alan listesi gönderiyoruz ve
     kaydedilmiş değerlerin üstüne VARSAYILANLARI seriyoruz — eksik alan
     asla null kalmıyor.

     Rotalar KÜÇÜK harfli: SettingsScope.getRouteName() -> "global" | "online"
     (SettingsDataType: GLOBAL->GlobalSettingsPayload, ONLINE->OnlineSettingsPayload) */
  if (route.startsWith('settings/load/')) {
    const scope = route.slice('settings/load/'.length).toLowerCase();
    const varsayilan = ayarVarsayilani(scope);
    if (!varsayilan) {
      return fail(res, 404, `bilinmeyen ayar kapsami: ${scope} (global | online)`);
    }
    const c = await botGet(`/config/${id}/ayar/${scope}`, token);
    const kayitli = c?.data && typeof c.data === 'object' ? c.data
      : (c && typeof c === 'object' && !c.error ? c : null);
    return ok(res, { ...varsayilan, ...(kayitli || {}) });
  }

  if (route.startsWith('settings/save/')) {
    const scope = route.slice('settings/save/'.length).toLowerCase();
    const varsayilan = ayarVarsayilani(scope);
    if (!varsayilan) {
      return fail(res, 404, `bilinmeyen ayar kapsami: ${scope} (global | online)`);
    }
    const govde = await readJson(req);
    const temiz = (govde && typeof govde === 'object' && !Array.isArray(govde)) ? govde : {};
    // Kaydet; bot ucu yoksa sessizce geç — istemci zarfı ZATEN 200 aldı,
    // cevabı bozmamak ve oyunu düşürmemek birincil amaç.
    await botPost(`/config/${id}/ayar/${scope}`, token, temiz);
    return send(res, 200, { ...varsayilan, ...temiz });
  }

  /* ── Kayıt ───────────────────────────────────────────────────────────────
     Bu akış launcher'da zaten tamamlanıyor; buradaki uç yalnızca REGISTERED
     durumunu sabitler. */
  if (route.startsWith('register/')) {
    return ok(res, { registered: true, via: 'launcher' });
  }

  /* ── Herkese açık profiller ───────────────────────────────────────────────
     PagedResult.fromJson alttı alanın hepsini zorunlu okuyor
     (content, last, totalPages, totalElements, size, numberOfElements); biri
     eksikse NPE → catch(Throwable) → REGISTRATION_OFFLINE, yani arkadaşlar
     sessizce açılmaz. */
  if (route === 'profile/public/list' && method === 'POST') {
    const govde = await readJson(req);
    const c = await botGet('/public/configs', token);
    const ham = Array.isArray(c?.configs) ? c.configs
      : Array.isArray(c?.data) ? c.data
      : Array.isArray(c) ? c : [];
    const kategori = c?.kategori || govde?.mode || null;
    const content = ham.map(cfg => configOzeti(cfg, kategori)).filter(Boolean);
    return ok(res, {
      content,
      last: true,
      totalPages: 1,
      totalElements: content.length,
      size: content.length,
      numberOfElements: content.length,
    });
  }

  /* Tekil görüntüleme — PublicProfile.fromJson. */
  const tekil = /^profile\/public\/(\d+)\/(view|download|update)$/.exec(route);
  if (tekil && method === 'GET') {
    const id = tekil[1];
    const c = await botGet(`/public/config/${id}`, token);
    const ham = c?.config || c?.data || c;
    if (!ham) return fail(res, 404, 'config bulunamadi');
    const ozet = configOzeti(ham, c?.kategori);
    if (!ozet) return fail(res, 404, 'config bulunamadi');
    return ok(res, ozet);
  }

  if (route === 'profile/public/tags' && method === 'GET') {
    return ok(res, []);
  }

  return fail(res, 404, 'unknown route: ' + route);
}