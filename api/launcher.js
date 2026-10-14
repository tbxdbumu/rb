import crypto from "node:crypto";

import { botBase, botHeaders, getSession } from "../lib/_session.js";

import { FB_KEY, PROJECT, readJson, originalPath } from "../lib/_helpers.js";

const HARDCODED_PREMIUM_IDS = (process.env.LAUNCHER_PREMIUM_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

function randCode(len = 10) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += abc[crypto.randomInt(0, abc.length)];
  }
  return s;
}

const launcherDocUrl = code => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_logins/${code}?key=${FB_KEY}`;

const secret = () => process.env.SESSION_SECRET || "";

function verifyLauncherToken(token) {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [tokId, expires, sig] = parts;
  const s = secret();
  if (!s || s.length < 16) return null;
  const expect = crypto.createHmac("sha256", s).update(`${tokId}.${expires}`).digest("hex");
  const a = Buffer.from(expect), b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!/^\d{15,20}$/.test(tokId)) return null;
  if (!Number(expires) || Date.now() > Number(expires)) return null;
  return tokId;
}

function requireIdentity(req, body) {
  const sess = getSession(req);
  if (sess && /^\d{15,20}$/.test(String(sess.id || ""))) {
    return {
      id: String(sess.id),
      via: "session",
      username: sess.username || ""
    };
  }
  const rawToken = body && (body.token || body.accessToken) || (req.headers["x-launcher-token"] ? String(req.headers["x-launcher-token"]) : "");
  const fromToken = verifyLauncherToken(rawToken);
  if (fromToken) return {
    id: fromToken,
    via: "token",
    username: ""
  };
  return null;
}

function mintAccessToken(id) {
  const s = secret();
  if (!s) return "";
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${id}.${expires}`;
  const sig = crypto.createHmac("sha256", s).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

const ALLOWED_REDIRECT_URIS = new Set([ "http://127.0.0.1:8741/callback", "http://localhost:8741/callback" ]);

function allowedRedirect(uri) {
  try {
    const u = new URL(String(uri));
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!ALLOWED_REDIRECT_URIS.has(`${u.protocol}//${u.host}${u.pathname}`)) return null;
    if (u.search || u.hash) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const siteOrigin = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (siteOrigin) {
    res.setHeader("Access-Control-Allow-Origin", siteOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Launcher-Token");
  if (req.method === "OPTIONS") return res.status(200).end();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const op = originalPath(req, url);
  const bBase = botBase();
  console.log("[launcher] path:", op, "method:", req.method);
  if (op.endsWith("/verify")) {
    const body = req.method === "POST" ? await readJson(req) : {};
    const who = requireIdentity(req, body);
    if (!who) {
      return res.status(401).json({
        ok: false,
        premium: false,
        error: "Yetkilendirme gerekli. Launcher cihaz akışını kullanın veya siteye giriş yapın."
      });
    }
    const id = who.id;
    const notify = url.searchParams.get("notify") === "1";
    let isPremium = HARDCODED_PREMIUM_IDS.includes(id);
    let username = `Kullanıcı_${id.slice(-4)}`;
    let role = isPremium ? "vip" : "member";
    let daysLeft = isPremium ? 365 : 0;
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
          headers: botHeaders()
        });
        if (r.ok) {
          const u = await r.json();
          if (u.username) username = u.username;
          if (u.premium && u.premium.active) {
            isPremium = true;
            daysLeft = u.premium.daysLeft || 30;
            role = "vip";
          }
        }
      } catch (e) {
        console.error("[launcher] bot user fetch err:", e.message);
      }
    }
    if (PROJECT && FB_KEY) {
      try {
        const fr = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?key=${FB_KEY}`, {
          headers: {
            Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, "")}/` : "https://risebunny.vercel.app/"
          }
        });
        if (fr.ok) {
          const data = await fr.json();
          const docs = data.documents || [];
          for (const d of docs) {
            const f = d.fields || {};
            if (f.discordId?.stringValue === id) {
              if (f.username?.stringValue) username = f.username.stringValue;
              const roleVal = f.role?.stringValue;
              if ([ "kurucu", "moderator", "developer", "vip" ].includes(roleVal) || f.premium?.booleanValue) {
                isPremium = true;
                role = roleVal || "vip";
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error("[launcher] firestore err:", e.message);
      }
    }
    if (!isPremium) {
      if (notify && bBase && process.env.BOT_API_SECRET) {
        try {
          await fetch(`${bBase}/api/login`, {
            method: "POST",
            headers: {
              ...botHeaders(),
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              userId: id,
              username: username,
              source: "launcher"
            })
          });
        } catch (e) {
          console.error("[launcher] login notify err:", e.message);
        }
      }
      return res.status(403).json({
        ok: false,
        premium: false,
        discordId: id,
        error: "Bu Discord ID için aktif Premium bulunamadı."
      });
    }
    if (PROJECT && FB_KEY) {
      try {
        await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/launcher_users/${id}?key=${FB_KEY}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: {
              discordId: {
                stringValue: id
              },
              username: {
                stringValue: username
              },
              role: {
                stringValue: role
              },
              premium: {
                booleanValue: true
              },
              launcher: {
                stringValue: "RiseBunny Client"
              },
              lastLaunch: {
                timestampValue: (new Date).toISOString()
              }
            }
          })
        });
      } catch (e) {
        console.error("[launcher] firestore write err:", e.message);
      }
    }
    if (notify && bBase && process.env.BOT_API_SECRET) {
      try {
        await fetch(`${bBase}/api/login`, {
          method: "POST",
          headers: {
            ...botHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: id,
            username: username,
            source: "launcher"
          })
        });
      } catch (e) {
        console.error("[launcher] login notify err:", e.message);
      }
    }
    const accessToken = mintAccessToken(id);
    return res.json({
      ok: true,
      premium: true,
      discordId: id,
      username: username,
      role: role,
      daysLeft: daysLeft,
      accessToken: accessToken,
      verifiedAt: Date.now(),
      server: "RiseBunny Auth Gateway"
    });
  }
  if (op.endsWith("/ticket") && req.method === "POST") {
    const body = await readJson(req);
    let raw = String(body.ticket || "");
    try {
      raw = Buffer.from(raw, "base64").toString("utf8");
    } catch {}
    if (!raw.includes(".")) {
      return res.status(403).json({
        ok: false,
        active: false,
        error: "geçersiz bilet formatı — launcher'dan tekrar giriş yap"
      });
    }
    const dot = raw.lastIndexOf(".");
    const id = String(raw.slice(0, dot)).replace(/\D/g, "").slice(0, 20);
    const token = raw.slice(dot + 1);
    const verified = verifyLauncherToken(`${id}.${token}`);
    if (!verified || verified !== id) {
      return res.status(403).json({
        ok: false,
        active: false,
        error: "geçersiz bilet"
      });
    }
    if (!id || id.length < 15) {
      return res.status(400).json({
        ok: false,
        active: false,
        error: "geçersiz bilet"
      });
    }
    let isPremium = HARDCODED_PREMIUM_IDS.includes(id);
    let username = `Kullanıcı_${id.slice(-4)}`;
    let role = isPremium ? "vip" : "member";
    let daysLeft = isPremium ? 365 : 0;
    let paidUntil = null;
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
          headers: botHeaders()
        });
        if (r.ok) {
          const u = await r.json();
          if (u.username) username = u.username;
          if (u.premium && u.premium.active) {
            isPremium = true;
            daysLeft = u.premium.daysLeft || 30;
            if (u.premium.paidUntil) paidUntil = u.premium.paidUntil;
            role = "vip";
          }
        }
      } catch {}
    }
    if (PROJECT && FB_KEY) {
      try {
        const fr = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?key=${FB_KEY}`, {
          headers: {
            Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, "")}/` : "https://risebunny.vercel.app/"
          }
        });
        if (fr.ok) {
          const data = await fr.json();
          for (const d of data.documents || []) {
            const f = d.fields || {};
            if (f.discordId?.stringValue === id) {
              if (f.username?.stringValue) username = f.username.stringValue;
              const roleVal = f.role?.stringValue;
              if ([ "kurucu", "moderator", "developer", "vip" ].includes(roleVal) || f.premium?.booleanValue) {
                isPremium = true;
                role = roleVal || "vip";
              }
              break;
            }
          }
        }
      } catch {}
    }
    const staff = [ "kurucu", "moderator", "developer" ].includes(role);
    return res.json({
      ok: true,
      active: isPremium && (staff || daysLeft > 0),
      premium: isPremium,
      role: role,
      username: username,
      daysLeft: daysLeft,
      paidUntil: paidUntil,
      staff: staff
    });
  }
  if (op.endsWith("/token") && req.method === "POST") {
    const body = await readJson(req);
    const code = String(body.code || "");
    const redirect = allowedRedirect(body.redirect_uri || "http://127.0.0.1:8741/callback");
    const verifier = String(body.code_verifier || "");
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
    const clientId = process.env.DISCORD_CLIENT_ID || "";
    if (!clientSecret || !clientId) {
      return res.status(500).json({
        ok: false,
        error: "sunucu yapılandırma hatası"
      });
    }
    if (!redirect) {
      return res.status(400).json({
        ok: false,
        error: "redirect_uri izinli değil"
      });
    }
    if (!code) return res.status(400).json({
      ok: false,
      error: "no-code"
    });
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect
      });
      if (verifier) params.set("code_verifier", verifier);
      const tok = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      });
      const tj = await tok.json().catch(() => ({}));
      if (!tok.ok || !tj.access_token) {
        return res.status(400).json({
          ok: false,
          error: tj.error_description || tj.error || "token-failed"
        });
      }
      const me = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tj.access_token}`
        }
      });
      if (!me.ok) return res.status(400).json({
        ok: false,
        error: "user-failed"
      });
      const u = await me.json();
      const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : "";
      return res.json({
        ok: true,
        id: String(u.id),
        username: u.username || "",
        avatar: avatar
      });
    } catch (e) {
      console.error("[launcher] token err:", e.message);
      return res.status(500).json({
        ok: false,
        error: "exception"
      });
    }
  }
  if (op.endsWith("/device")) {
    try {
      if (req.method === "POST") {
        const body = await readJson(req);
        if (body.action !== "create") return res.status(400).json({
          ok: false
        });
        const code = randCode();
        const write = await fetch(launcherDocUrl(code), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: {
              status: {
                stringValue: "pending"
              },
              createdAt: {
                timestampValue: (new Date).toISOString()
              }
            }
          })
        }).catch(e => {
          console.error("[launcher] device create err:", e.message);
          return null;
        });
        if (!write || !write.ok) {
          const detail = write ? await write.text().catch(() => "") : "";
          console.error("[launcher] device-store write rejected:", write ? write.status : "network", String(detail).slice(0, 300));
          return res.status(503).json({
            ok: false,
            error: "device-store-unavailable",
            detail: "launcher_logins Firestore kuralı eksik veya yayınlanmadı."
          });
        }
        return res.json({
          ok: true,
          code: code
        });
      }
      const code = String(url.searchParams.get("code") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
      if (!code) return res.status(400).json({
        ok: false
      });
      const r = await fetch(launcherDocUrl(code));
      if (r.status === 401 || r.status === 403) {
        console.error("[launcher] device-store read denied:", r.status);
        return res.status(503).json({
          ok: false,
          status: "error",
          error: "device-store-unavailable",
          detail: "launcher_logins Firestore kuralı eksik veya yayınlanmadı."
        });
      }
      if (!r.ok) return res.json({
        ok: true,
        status: "pending"
      });
      const d = await r.json();
      const f = d.fields || {};
      const created = f.createdAt?.timestampValue ? new Date(f.createdAt.timestampValue).getTime() : 0;
      if (created && Date.now() - created > 10 * 60 * 1000) {
        await fetch(launcherDocUrl(code), {
          method: "DELETE"
        }).catch(() => {});
        return res.json({
          ok: true,
          status: "expired"
        });
      }
      if (f.status?.stringValue === "done") {
        const discordId = f.id?.stringValue || "";
        const proof = f.proof?.stringValue || "";
        const s = secret();
        const expected = s && discordId ? crypto.createHmac("sha256", s).update(`device:${code}:${discordId}`).digest("hex") : "";
        const a = Buffer.from(expected), b = Buffer.from(proof);
        if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          await fetch(launcherDocUrl(code), {
            method: "DELETE"
          }).catch(() => {});
          return res.json({
            ok: false,
            status: "rejected"
          });
        }
        const out = {
          ok: true,
          status: "done",
          id: discordId,
          username: f.username?.stringValue || "",
          avatar: f.avatar?.stringValue || "",
          accessToken: mintAccessToken(discordId)
        };
        await fetch(launcherDocUrl(code), {
          method: "DELETE"
        }).catch(() => {});
        return res.json(out);
      }
      return res.json({
        ok: true,
        status: "pending"
      });
    } catch (e) {
      console.error("[launcher] device err:", e.message);
      return res.status(500).json({
        ok: false
      });
    }
  }
  if (op.endsWith("/profile")) {
    const body = req.method === "POST" ? await readJson(req) : {};
    const who = requireIdentity(req, body);
    if (!who) {
      return res.status(401).json({
        ok: false,
        error: "Yetkilendirme gerekli."
      });
    }
    const id = who.id;
    if (!/^\d{15,20}$/.test(id)) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz Discord ID."
      });
    }
    if (!bBase || !process.env.BOT_API_SECRET) {
      return res.status(503).json({
        ok: false,
        error: "Bot API bağlı değil."
      });
    }
    try {
      const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
        headers: botHeaders()
      });
      if (!r.ok) return res.status(502).json({
        ok: false,
        error: "Bot verisi alınamadı."
      });
      const u = await r.json();
      const avatar = u.avatar ? String(u.avatar).startsWith("http") ? u.avatar : `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128` : "";
      return res.json({
        ok: true,
        user: {
          id: id,
          username: u.username || "",
          avatar: avatar
        },
        premium: Boolean(u.premium && u.premium.active),
        capes: Array.isArray(u.capes) ? u.capes : [],
        game: {
          money: Number(u.money ?? u.total ?? u.wallet ?? 0),
          level: Number(u.level ?? 0),
          xp: Number(u.xp ?? 0),
          pets: Array.isArray(u.pets) ? u.pets.length : Number(u.pets ?? 0)
        }
      });
    } catch (e) {
      console.error("[launcher] profile err:", e.message);
      return res.status(500).json({
        ok: false,
        error: "exception"
      });
    }
  }
  if (op.endsWith("/buy") && req.method === "POST") {
    const body = await readJson(req);
    const who = requireIdentity(req, body);
    if (!who) return res.status(401).json({
      ok: false,
      error: "Yetkilendirme gerekli."
    });
    const id = who.id;
    const item = String(body.item || "").slice(0, 40);
    if (!/^\d{15,20}$/.test(id) || !item) {
      return res.status(400).json({
        ok: false,
        error: "Geçersiz istek."
      });
    }
    if (!bBase || !process.env.BOT_API_SECRET) {
      return res.status(503).json({
        ok: false,
        error: "Bot API bağlı değil."
      });
    }
    const {STATIC_SHOP: STATIC_SHOP} = await (import("./shop.js"));
    let price = null;
    let premiumGerek = false;
    try {
      const cr = await fetch(`${bBase}/api/shop`, {
        headers: botHeaders()
      });
      if (cr.ok) {
        const cj = await cr.json();
        const hit = (cj.items || []).find(x => x && x.id === item);
        if (hit) {
          price = Number(hit.fiyat ?? hit.price);
          premiumGerek = !!hit.premiumGerek;
        }
      }
    } catch {}
    if (price === null) {
      const hit = STATIC_SHOP.find(x => x.id === item);
      if (hit) {
        price = Number(hit.fiyat);
        premiumGerek = !!hit.premiumGerek;
      }
    }
    if (price === null || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Ürün katalogda yok."
      });
    }
    let isPremium = HARDCODED_PREMIUM_IDS.includes(id);
    let role = isPremium ? "vip" : "member";
    if (bBase && process.env.BOT_API_SECRET) {
      try {
        const r = await fetch(`${bBase}/api/user/${encodeURIComponent(id)}`, {
          headers: botHeaders()
        });
        if (r.ok) {
          const u = await r.json();
          if (u.premium && u.premium.active) {
            isPremium = true;
            role = "vip";
          }
        }
      } catch {}
    }
    if (PROJECT && FB_KEY) {
      try {
        const fr = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?key=${FB_KEY}`, {
          headers: {
            Referer: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/+$/, "")}/` : ""
          }
        });
        if (fr.ok) {
          for (const d of fr.json().documents || []) {
            const f = d.fields || {};
            if (f.discordId?.stringValue === id) {
              const roleVal = f.role?.stringValue;
              if ([ "kurucu", "moderator", "developer", "vip" ].includes(roleVal) || f.premium?.booleanValue) {
                isPremium = true;
                role = roleVal || "vip";
              }
              break;
            }
          }
        }
      } catch {}
    }
    if (premiumGerek && !isPremium) {
      return res.status(403).json({
        ok: false,
        error: "Bu ürün için Premium gerekiyor."
      });
    }
    try {
      const r = await fetch(`${bBase}/api/shop/buy`, {
        method: "POST",
        headers: {
          ...botHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: id,
          item: item,
          price: price,
          source: "launcher"
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok !== true) {
        return res.status(400).json({
          ok: false,
          error: j.error || "Bot satın almayı reddetti."
        });
      }
      const wallet = Number(j.wallet || 0), bank = Number(j.bank || 0);
      return res.json({
        ok: true,
        newBalance: Number(j.total ?? wallet + bank)
      });
    } catch (e) {
      console.error("[launcher] buy err:", e.message);
      return res.status(500).json({
        ok: false,
        error: "exception"
      });
    }
  }
  return res.status(404).json({
    error: "not found",
    path: op
  });
}
