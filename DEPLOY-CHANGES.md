# Host / Deploy Değişiklik Listesi

Bu dosya **kod yorum silme sonrası** güncel hal içindir. Yorumlar kaldırıldı,
kod okunur formatta bırakıldı (minify edilmedi, isimler korundu).

Doğrulama: `node --check` 26/26 · Firestore kuralları 60/60 · Handler testleri 22/22 · `safeNext` birim 29/29

---

## 1. Yorum silme kapsamı

| Tip | Dosya | Silinen yorum |
|---|---|---|
| JS | `api/launcher.js` | 31 satır |
| JS | `api/auth/discord/callback.js` | 8 |
| JS | `api/user.js` | 9 |
| JS | `lib/_session.js` | 7 |
| JS | `api/public.js` | 5 |
| JS | `api/auth/discord/config.js` | 5 |
| JS | `api/auth/discord/start.js` | 5 |
| JS | `api/session.js` | 4 |
| JS | `lib/_helpers.js` | 3 |
| JS | `js/app.js` | 3 |
| JS | `js/auth.js` | 2 |
| JS | `api/shop.js` | 1 |
| JS | `api/webhooks.js` | 1 |
| JS | `js/changelog.html` (inline) | 1 |
| CSS | `css/styles.css` | 18 blok |
| Rules | `firestore.rules` | 34 satır |

Silmeyi yapan: JS için terser (`compress:false`, `mangle:false`, `beautify:true`,
`keep_numbers:true`) — string/regex/template literal içindeki `//` ve `/*` dokunulmadı.
CSS ve kurallar için string-duyarlı tarayıcı.

**Yedek:** `C:\Users\enesi\AppData\Local\Temp\opencode\rb-fixed-preStrip`

---

## 2. Güvenlik düzeltmeleri — kod değişiklikleri

### `lib/_session.js`
- `safeNext()` yeniden yazıldı. `//host`, `/\host`, `\\host`, `/a//b`, kontrol
  karakteri, >512 karakter → `/risebunny`.
- **`signState(next)`** eklendi: `base64url(next) + '.' + HMAC(SHA256, SESSION_SECRET)`
- **`readState(state)`** eklendi: imzayı `timingSafeEqual` ile doğrular, geçersizse `null`

### `api/auth/discord/start.js`
- `state` artık `signState(next)` ile üretiliyor (önce: `Buffer.from(next).toString('base64url')`)

### `api/auth/discord/callback.js`
- `readState(state)` ile doğrulama; imzasız/geçersiz state → `next = '/risebunny'`
- `deviceProof(code, discordId)` fonksiyonu eklendi → `launcher_logins` belgesine
  `proof` alanı (64 hk hex) yazılıyor
- Oturum çerezinden **`fbPw` çıkarıldı**

### `api/session.js`
- `setSession` çağrısından `fbPw` çıkarıldı
- `/api/me` yanıtından **`fb` alanı tamamen kaldırıldı** (parola düz metin dönüyordu)

### `api/launcher.js` — en çok değişen dosya
Yeni fonksiyonlar:
- `verifyLauncherToken(token)` — HMAC doğrulamalı launcher jetonu
- `requireIdentity(req, body)` — session **veya** launcher token; kimliği daima
  doğrulanmış kaynaktan türetir, gövdedeki `id`'yi yok sayar
- `mintAccessToken(id)`
- `allowedRedirect(uri)` + `ALLOWED_REDIRECT_URIS` (sadece `127.0.0.1:8741` / `localhost:8741`)
- `secret()`

Davranış değişiklikleri:
| Uç | Önce | Sonra |
|---|---|---|
| `/verify` | `?id=` güvenilirdi | `requireIdentity` zorunlu → 401 |
| `/verify` | token herkese veriliyordu | sadece kimliği doğrulanmış isteğe |
| `/ticket` | legacy `id:token:ts` kabul (token doğrulanmıyordu) | yalnızca HMAC jetonu |
| `/profile` | `?id=` oturumsuz | `requireIdentity` zorunlu |
| `/buy` | `price` ve `userId` gövdeden | fiyat sunucu kataloğundan, `userId` kimlikten, premium şartı sunucuda |
| `/token` | `redirect_uri` serbest | allowlist, sorgu/şema yasak, girdi doğrulaması config kontrolünden önce |
| `/device` | `status:'done'` belgesine güveniyordu | `proof` HMAC doğrulanıyor, sahte ise `status:'rejected'` |
| tümü | `ACAO: *` | `SITE_URL` origin'i |
| `randCode` | `Math.random()`, 6 karakter | `crypto.randomInt`, 10 karakter |

### `api/auth/discord/config.js`
- `POST /configs` artık `getSession()` zorunlu, `discordId` **gövdeden değil `s.id`'den**
- `randCode` 8 → 10 karakter, `crypto.randomInt`
- `ACAO: *` → `SITE_URL`

### `api/user.js`
- **`isStaffSession(s)`** eklendi — `ADMIN_UIDS` + `ADMIN_DISCORD_IDS` env'ini okur
- **`flat(s, max)`** eklendi — kontrol karakteri / newline temizliği
- **`safeLink(u)`** eklendi — yalnızca `SITE_HOST`/`SITE_URL` origin'ine izin
- `/notify` → staff'a özelli (403), `from` sabit `'RiseBunny'`, `userIds` biçim
  doğrulamalı (`/^\d{15,20}$/`), `kind` allowlist, link allowlist
- `/log`, `/contact` → girdi temizliği

### `api/public.js`
- `/firebase-config` → `ACAO: *` kaldırıldı, `Vary: Origin` eklendi
- `/stats` → `users` alanı çıkarıldı (11682 sızıyordu)

### `api/shop.js`
- `STATIC_SHOP` → **`export const`** yapıldı (launcher referans fiyat için kullanıyor)

---

## 3. `firestore.rules` değişiklikleri

| Koleksiyon | Değişiklik |
|---|---|
| `users` | `allow read: if true` → `get`: kendi/staff · `list`: staff |
| `users` yazma | `role`/`username`/`banned` kullanıcı tarafından değiştirilemez |
| `private_threads` | **yeni** — okuma `myWeight() >= 2`, yazma `>= 3` |
| `private_posts` | **yeni** — okuma `myWeight() >= 2`, yazma `>= 3` |
| `launcher_logins` | `done` → 64 hk `proof` şart; `pending` okunabilir; `create/update` alan listesi `proof` ekli |
| `launcher_users` | **yeni kural** — okuma kapalı, sunucu yazımı alan doğrulamalı |
| `launcher_configs` | **yeni kural** — `approved` okunur, `pending` yazılır, güncelleme admin |
| `myRole()` | `.data.role` → `.data.get('role','none')` (yoksa hata veriyordu) |

Yeni yardımcı fonksiyonlar: `userRole()`, `myRoleWeight()`, `myWeight()`

---

## 4. Deploy için yapman gerekenler

### 4.1 Yeni env değişkenleri (Vercel)

`.env.example` güncellendi. **Zorunlu olanlar:**

```
ADMIN_UIDS=oblLBCNGXEYF8plKq8KUr3m6o4f1,1310366324731547798
ADMIN_DISCORD_IDS=985126554306773063,1310366324731547798
SITE_HOST=risebunny.vercel.app
```

`ADMIN_UIDS` / `ADMIN_DISCORD_IDS` **yoksa `/api/notify` herkese kapanır** —
güvenli yönde ama bildirimler çalışmaz.

**Opsiyonel:**
```
LAUNCHER_PREMIUM_IDS=
TOPGG_TOKEN=
TOPGG_WEBHOOK_SECRET=
```

### 4.2 Firestore kurallarını yayınla

Firebase Console → Firestore Database → Rules → `firestore.rules` içeriğini
yapıştır → **Publish**. (Yorumlar kaldırıldı ama Publish adımı aynı.)

### 4.3 Veri taşıma — ZORUNLU

Kurallar yayınlanmadan önce `categories/vip` ve `categories/staff` altındaki
konuları taşı, yoksa hâlâ açık kalırlar:

```js
db.collection('threads').where('categoryId', 'in', ['vip', 'staff'])
  .get().then(s => s.docs.forEach(d =>
    d.ref.set({ ...d.data(), movedFrom: 'threads', movedAt: Date.now() })
      .then(() => d.ref.delete())));
```

Taşınmadan önce o konular **sızmış sayılır** — `RubidiumForTesters19327543943`
parolasını ve `dosya.co` linkini geçersiz kıl.

### 4.4 `creds` koleksiyonunu sil

Kurallar zaten `if false` ama veri duruyor. Firebase Console → Firestore → Data.

### 4.5 İstemci değişikliği — bu depoda YOK

`admin.html`, `js/admin.js`, `js/forum.js`, `js/admin-forum.js` canlıda var,
`rb-fixed`'te yok. Onlar olmadan:

| İstemci | Ne yapmalı |
|---|---|
| `admin.js` | `/api/launcher/*` çağrılarında `X-Launcher-Token` header'ı veya session göndermeli |
| `forum.js` | `minWeight >= 2` için `private_threads`, `>= 3` için `private_posts` kullanmalı |
| `admin.js` | kullanıcı listesini `/api/admin/users` üzerinden çekmeli (Firestore `users` listesi staff-only) |
| `admin.js` | `ADMIN_UIDS` / `ADMIN_DISCORD` dizilerini bundle'dan çıkarmalı |

Ağırlık eşleşmesi (`RBAuth.WEIGHT` ↔ kural):
`kurucu`/`moderator` = 3 · `vip`/`developer` = 2 · `member` = 1

### 4.6 Bot tarafı

`/api/shop/buy` hâlâ istemciden gelen `price`'a güveniyorsa açık orada kalır.
Bot repo'sunu da düzelt. Bot katalog yanıtında `fiyat` ve `premiumGerek`
alanlarını dönmeli (bu isimler kullanılıyor).

---

## 5. Deploy sonrası doğrulama

```bash
python C:\Users\enesi\Downloads\trosa\recon\verify_live.py
```

Beklenen: tüm `CRIT`/`HIGH` satırlarında **CONFIRMED** yerine artık
**blocked (401/403)** görünmeli. Özellikle:

| Uç | Beklenen |
|---|---|
| `GET /api/launcher/verify?id=<herhangi>` | 401 |
| `GET /api/launcher/profile?id=<herhangi>` | 401 |
| `POST /api/launcher/buy` | 401 |
| `POST /api/config/configs` | 401 |
| `GET .../documents/users` | 403 |
| `GET .../documents/private_threads` | 403 |
| `GET .../documents/threads` | 200 (herkese açık içerik) |

---

## 6. Dokunulmayanlar

- `js/cinematic.js`, `js/firebase-config.js`, `js/maintenance.js`, `js/mc-3d.js`,
  `js/rb-data.js`, `js/rb-env.js`, `js/rb-login.js`, `js/risebunny.js`,
  `js/rubidium.js`, `api/leaderboard.js` → yorumları yoktu, içerik aynı
- `package.json`, `vercel.json`, `robots.txt`, `sitemap.xml`, `.env.example` → dokunulmadı
- `SECURITY-FIXES.md` → yorum temizliği kapsamı dışı (bu deploy listesinin
  ayrıntılı versiyonu, silme)
- `js/Hshs`, `js/Twts` → 1 baytlık boş dosyalar, deploy'dan çıkarabilirsin
- `vercel.json.bak` → yedek dosya, deploy etme
---

## 7. 2026-10-15 — Bekleyen deploy (login + istemci proxy)

1. **`firestore.rules` (YENİDEN YAYINLA — Firebase Console):** `launcher_logins`
   done-yazımında `proof` alanına izin veriliyor. Bu yayınlanmadan Discord girişi
   launcher'da "onay bekliyor"da kalır.
2. **`api/launcher.js`:** device-done yanıtı `accessToken` döndürüyor (12h bilet);
   `?code=` kırpma sınırı 8→12.
3. **`api/auth/discord/start.js`:** `device` kırpma sınırı 8→12.
4. **`api/client.js` (YENİ DOSYA) + `vercel.json`:** Vape istemcisinin bot'a
   ulaşan `/api/client/*` köprüsü (config listesi, arkadaşlar, party, presence).
   Bu olmadan oyun içi Configler/Arkadaşlar/Uçtan uca botta boş kalır. Deploy
   sonrası test: `https://risebunny.vercel.app/api/client/public/configs?kategori=newest`
   `{"ok":true,...}` dönmeli.
