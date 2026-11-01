// إرسال إشعارات الدفع (FCM) في الخلفية: مكالمات، رسائل، إعجابات…
// يتطلب متغير بيئة FIREBASE_SERVICE_ACCOUNT في Vercel (محتوى ملف JSON لحساب الخدمة كاملاً).
// لا يستقبل نصاً حراً من المتصفح: الرسائل تُبنى هنا من قوالب ثابتة لمنع إساءة الاستخدام.
const crypto = require("crypto");

const PROJECT = "hashid-net";
const b64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const b64uEnc = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

let certCache = { keys: null, exp: 0 };
async function googleCerts() {
  if (certCache.keys && Date.now() < certCache.exp) return certCache.keys;
  const r = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  certCache = { keys: await r.json(), exp: Date.now() + 3600e3 };
  return certCache.keys;
}
async function verifyIdToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const header = JSON.parse(b64u(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64u(parts[1]).toString("utf8"));
  const pem = (await googleCerts())[header.kid];
  if (header.alg !== "RS256" || !pem) throw new Error("kid");
  const ok = crypto.createVerify("RSA-SHA256").update(parts[0] + "." + parts[1]).verify(pem, b64u(parts[2]));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || payload.aud !== PROJECT || payload.iss !== "https://securetoken.google.com/" + PROJECT || payload.exp < now || !payload.sub) throw new Error("invalid");
  return payload;
}

let adminTok = { t: null, exp: 0 };
async function adminToken(sa) {
  if (adminTok.t && Date.now() < adminTok.exp) return adminTok.t;
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64uEnc(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64uEnc(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64uEnc(crypto.createSign("RSA-SHA256").update(hdr + "." + claim).sign(sa.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + hdr + "." + claim + "." + sig });
  const j = await r.json();
  if (!j.access_token) throw new Error("admin token failed");
  adminTok = { t: j.access_token, exp: Date.now() + 3300e3 };
  return adminTok.t;
}

const FS = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/";
async function fsGet(path, tok) {
  const r = await fetch(FS + path, { headers: { Authorization: "Bearer " + tok } });
  return r.ok ? r.json() : null;
}

const TEMPLATES = {
  call: (n, x) => ({ title: "📞 مكالمة واردة", body: n + (x === "video" ? " يتصل بك بالفيديو" : " يتصل بك صوتياً") }),
  message: (n) => ({ title: "💬 رسالة جديدة", body: n + " أرسل لك رسالة" }),
  like: (n) => ({ title: "❤️ إعجاب جديد", body: n + " أعجب بمحتواك" }),
  comment: (n) => ({ title: "💬 تعليق جديد", body: n + " علّق على منشورك" }),
  follow: (n) => ({ title: "➕ متابِع جديد", body: n + " بدأ بمتابعتك" }),
  friendreq: (n) => ({ title: "👋 طلب صداقة", body: n + " أرسل لك طلب صداقة" }),
  friendacc: (n) => ({ title: "🤝 صداقة جديدة", body: n + " قبل طلب صداقتك" }),
  question: () => ({ title: "❓ سؤال سري جديد", body: "وصلك سؤال من شخص مجهول، اكتشفه الآن" })
};
const recent = new Map(); // تحديد معدل بسيط لكل مرسل (ضمن نفس النسخة)

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); } catch (e) { return res.status(503).json({ error: "FIREBASE_SERVICE_ACCOUNT غير مضبوط" }); }
  try {
    const me = await verifyIdToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const to = String(body.to || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
    const type = String(body.type || "");
    if (!to || to === me.sub || !TEMPLATES[type]) return res.status(400).json({ error: "bad request" });

    const k = me.sub, now = Date.now(), arr = (recent.get(k) || []).filter((t) => now - t < 60000);
    if (arr.length >= 30) return res.status(429).json({ error: "rate" });
    arr.push(now); recent.set(k, arr);

    const tok = await adminToken(sa);
    const tdoc = await fsGet("pushTokens/" + to, tok);
    const tokens = ((tdoc && tdoc.fields && tdoc.fields.tokens && tdoc.fields.tokens.arrayValue && tdoc.fields.tokens.arrayValue.values) || []).map((v) => v.stringValue).filter(Boolean);
    if (!tokens.length) return res.status(200).json({ sent: 0 });

    let name = "عضو";
    if (type !== "question") {
      const u = await fsGet("users/" + me.sub, tok);
      name = (u && u.fields && u.fields.name && u.fields.name.stringValue) || me.name || "عضو";
    }
    const m = TEMPLATES[type](String(name).slice(0, 40), body.x === "video" ? "video" : "audio");
    const urgent = type === "call";
    let sent = 0;
    const alive = [];
    await Promise.all(tokens.map(async (t) => {
      const r = await fetch("https://fcm.googleapis.com/v1/projects/" + PROJECT + "/messages:send", {
        method: "POST",
        headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: t, data: { title: m.title, body: m.body, type: type, tag: type, url: "/" }, webpush: { headers: { Urgency: urgent ? "high" : "normal", TTL: urgent ? "45" : "86400" } }, android: { priority: urgent ? "HIGH" : "NORMAL" } } })
      });
      if (r.ok) { sent++; alive.push(t); }
      else {
        const j = await r.json().catch(() => ({}));
        const dead = r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(JSON.stringify(j));
        if (!dead) alive.push(t);
      }
    }));
    if (alive.length !== tokens.length) {
      fetch(FS + "pushTokens/" + to + "?updateMask.fieldPaths=tokens", {
        method: "PATCH", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { tokens: { arrayValue: { values: alive.map((t) => ({ stringValue: t })) } } } })
      }).catch(() => {});
    }
    return res.status(200).json({ sent });
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
};
