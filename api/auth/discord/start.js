import { safeNext, signState } from "../../../lib/_session.js";

import { CLIENT_ID, siteBase } from "../../../lib/_helpers.js";

export default function handler(req, res) {
  try {
    if (!CLIENT_ID) return res.status(500).send("DISCORD_CLIENT_ID tanımlı değil.");
    const base = siteBase(req);
    const cbPath = process.env.DISCORD_CALLBACK_PATH || "/api/auth/discord/callback";
    const redirect = `${base}${cbPath}`;
    const url = new URL(req.url, base);
    let device = String(url.searchParams.get("device") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
    let next = safeNext(url.searchParams.get("next"));
    if (!device) {
      const m = String(next).match(/[?&]device=([A-Za-z0-9]{4,12})/);
      if (m) device = m[1];
    }
    if (device) {
      next = next.replace(/[?&]device=[A-Za-z0-9]+/g, "");
      next = next + (next.includes("?") ? "&" : "?") + "device=" + device;
    }
    const u = new URL("https://discord.com/api/oauth2/authorize");
    u.searchParams.set("client_id", CLIENT_ID);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "identify email");
    u.searchParams.set("state", signState(next));
    res.redirect(302, u.toString());
  } catch (e) {
    res.status(500).send("OAuth start error");
  }
}
