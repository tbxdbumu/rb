try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}

const DOMAIN = "@risebunny.app";
const WEIGHT = { member:1, vip:2, developer:2, moderator:3, kurucu:5 };
const BADGE = {
  kurucu:    { icon:"👑", tr:"Kurucu",     en:"Founder" },
  developer: { icon:"💻", tr:"Geliştirici", en:"Developer" },
  moderator: { icon:"🛡️", tr:"Moderatör",  en:"Moderator" },
  vip:       { icon:"⭐", tr:"VIP",        en:"VIP" },
  member:    { icon:"🐰", tr:"Üye",        en:"Member" }
};
let CURRENT = null;

const norm  = u => (u||"").trim().toLowerCase();
const valid = u => /^[a-z0-9_]{3,20}$/.test(u);
const myWeight = () => CURRENT ? (WEIGHT[CURRENT.role] || 1) : 0;

const lockCount = u => { try { return parseInt(localStorage.getItem("rb_lock_" + u) || "0", 10); } catch(e){ return 0; } };
const isLocked  = u => lockCount(u) >= 3;
const bumpLock  = u => { try { localStorage.setItem("rb_lock_" + u, String(lockCount(u) + 1)); } catch(e){} };
const clearLock = u => { try { localStorage.removeItem("rb_lock_" + u); } catch(e){} };

async function usernameExists(u) {
  const s = await db.collection("users").where("username","==",u).get();
  return s.size > 0;
}
async function loadCurrent(uid) {
  const s = await db.collection("users").doc(uid).get();
  let data = s.exists ? s.data() : null;
  if (!data) {
    try {
      var chk = await fetch('/api/check-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: uid }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
      if (chk && chk.isAdmin) data = { username: "kurucu", role: "kurucu", banned: false, avatar: "", stats: { threads: 0, posts: 0, likes: 0 } };
    } catch (e) {}
  }

  if (data && !data.role) {
    data.role = "member";
    try { await db.collection("users").doc(uid).update({ role: "member" }); } catch (e) {}
  }
  if (data && data.banned == null) data.banned = false;
  CURRENT = data ? { uid, ...data } : null;
  return CURRENT;
}
function saveCred(uid, password) {

  return Promise.resolve();
}
function newProfile(uid, username, role) {
  return db.collection("users").doc(uid).set({
    username, role: role || "member", avatar:"", banned:false,
    stats:{ threads:0, posts:0, likes:0 },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function register(username, password) {
  username = norm(username);
  if (!valid(username)) throw "3-20 karakter; sadece a-z, 0-9, _";
  if (password.length < 6) throw "Şifre en az 6 karakter olmalı.";
  if (await usernameExists(username)) throw "Bu kullanıcı adı alınmış.";
  let cred;
  try {
    cred = await auth.createUserWithEmailAndPassword(username + DOMAIN, password);
  } catch (e) {

    if (e && e.code === "auth/email-already-in-use") {
      try {
        cred = await auth.signInWithEmailAndPassword(username + DOMAIN, password);
      } catch (e2) {
        throw "Bu ad eski bir hesaba kayıtlı. Aynı şifreyle dene veya paneliden şifreyi değiştir.";
      }
      const ex = await db.collection("users").doc(cred.user.uid).get();
      if (!ex.exists) await newProfile(cred.user.uid, username, "member");
      await saveCred(cred.user.uid, password);
      return cred;
    }
    throw (e && e.message) || e;
  }
  await newProfile(cred.user.uid, username);
  await saveCred(cred.user.uid, password);
  return cred;
}

async function smartLogin(identifier, password) {
  const idf = identifier.trim().toLowerCase();
  const isMail = idf.includes("@");
  const uname = isMail ? null : norm(idf);
  if (!isMail && isLocked(uname))
    throw "🔒 Bu tarayıcıda '" + uname + "' hesabı 3 hatalı deneme nedeniyle kalıcı kilitlendi.";
  try {
    let cred;
    if (isMail) cred = await auth.signInWithEmailAndPassword(idf, password);
    else if (await usernameExists(uname)) cred = await auth.signInWithEmailAndPassword(uname + DOMAIN, password);
    else cred = await register(uname, password);
    const u = await loadCurrent(cred.user.uid);
    if (u && u.banned) { await auth.signOut(); CURRENT = null; throw "Bu hesap topluluktan uzaklaştırılmış. 🚫"; }
    if (!isMail) clearLock(uname);
    await saveCred(cred.user.uid, password);
    try {
      const chk2 = await fetch('/api/check-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: cred.user.uid }) }).then(function (r) { return r.json(); }).catch(function () { return null; });
      if (chk2 && chk2.isAdmin) {
        const ex = await db.collection("users").doc(cred.user.uid).get();
        if (!ex.exists) await newProfile(cred.user.uid, "kurucu", "kurucu");
        else await db.collection("users").doc(cred.user.uid).update({ role: "kurucu", lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      } else {
        db.collection("users").doc(cred.user.uid).update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      }
    } catch (e) {
      try { db.collection("users").doc(cred.user.uid).update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {}); } catch (e2) {}
    }
    await loadCurrent(cred.user.uid);
    return true;
  } catch (err) {
    const code = err && err.code;
    const wrong = code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials";
    if (!isMail && wrong) {
      bumpLock(uname);
      if (isLocked(uname)) throw "🔒 3 hatalı deneme! Bu tarayıcıda '" + uname + "' ile giriş kalıcı olarak kilitlendi.";
      throw "Şifre yanlış. Kalan deneme: " + (3 - lockCount(uname));
    }
    throw (typeof err === "string") ? err : ((err && err.message) || "Hata!");
  }
}
const logout = () => auth.signOut();
function onAuth(cb) {
  return auth.onAuthStateChanged(async u => {
    if (!u) { CURRENT = null; return cb(null); }
    await loadCurrent(u.uid);
    cb(CURRENT);
  });
}
window.RBAuth = { CURRENT: () => CURRENT, WEIGHT, BADGE, myWeight, smartLogin, logout, onAuth, norm };
