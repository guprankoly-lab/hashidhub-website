// محتوى رسمي يومي (سؤال اليوم + استطلاع) لإبقاء المنصة حيّة. يُشغَّله Vercel Cron مرة يومياً.
// يتطلب: FIREBASE_SERVICE_ACCOUNT و CRON_SECRET في متغيرات بيئة Vercel.
const crypto = require("crypto");
const PROJECT = "hashid-net";
const FS = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/";

const QUESTIONS = [
  "لو تقدر تسافر لأي مكان غداً، وين تروح؟ ✈️", "ما أجمل شيء حصل لك هذا الأسبوع؟ 🌟", "أغنية أو نشيد ما تمل منه؟ 🎵",
  "وش الأكلة اللي تنسيك همومك؟ 🍽️", "لو عندك قوة خارقة وحدة، وش تختار؟ 🦸", "كلمة تشجيع تبغى تسمعها اليوم؟ 💬",
  "وش أول شيء تسويه لو صحيت ولقيت نفسك مليونير؟ 💰", "مين الشخص اللي تتصل فيه أول لما تفرح؟ 📞", "وش هوايتك اللي تتمنى تتقنها؟ 🎨",
  "أجمل ذكرى من أيام المدرسة؟ 🎒", "لو تكتب كتاب عن حياتك، وش اسمه؟ 📖", "وش نصيحتك لنفسك قبل خمس سنين؟ 🕰️",
  "أحلى موقف ضحكت فيه من قلبك؟ 😂", "فيلم أو مسلسل أنصح الكل يشوفه؟ 🎬", "وش الشيء البسيط اللي يعدّل مزاجك؟ ☕",
  "لو تقدر تتعلم لغة بسرعة، أي لغة تختار؟ 🌍", "وش حلمك الكبير اللي ما قلت لأحد؟ 🌠", "أفضل مكان في مدينتك تنصح به؟ 📍",
  "شيء تعلمته مؤخراً وغيّر نظرتك؟ 💡", "وش الشيء اللي تفتخر فيه بنفسك؟ 🏆", "لو بيدك تغيّر شيء واحد في العالم، وش هو؟ 🌱",
  "وش الكلمة اللي تتمنى الكل يقولها أكثر؟ 💛", "أحسن هدية استلمتها في حياتك؟ 🎁", "مين قدوتك وليش؟ ⭐"
];
const POLLS = [
  {q: "الصباح ولا الليل؟ 🌅🌙", o: ["الصباح", "الليل"]}, {q: "قهوة ولا شاي؟ ☕", o: ["قهوة", "شاي", "الاثنين"]},
  {q: "البحر ولا الجبل؟ 🌊⛰️", o: ["البحر", "الجبل"]}, {q: "سفر مع الأصدقاء ولا مع العائلة؟ ✈️", o: ["الأصدقاء", "العائلة"]},
  {q: "رسالة نصية ولا مكالمة؟ 💬📞", o: ["رسالة", "مكالمة"]}, {q: "فيلم ولا مسلسل؟ 🎬", o: ["فيلم", "مسلسل"]},
  {q: "حلو ولا مالح؟ 🍰🍟", o: ["حلو", "مالح"]}, {q: "تخطط لكل شيء ولا تمشي مع الأحداث؟ 🗓️", o: ["أخطط", "أمشي مع الأحداث"]},
  {q: "شتاء ولا صيف؟ ❄️☀️", o: ["شتاء", "صيف"]}, {q: "تسمع موسيقى وأنت تدرس/تعمل؟ 🎧", o: ["نعم", "لا", "أحياناً"]},
  {q: "تفضّل القراءة ولا الألعاب؟ 📚🎮", o: ["القراءة", "الألعاب", "الاثنين"]}, {q: "الصراحة ولا المجاملة؟ 🗣️", o: ["الصراحة", "المجاملة"]},
  {q: "سهر ولا نوم مبكر؟ 🦉", o: ["سهر", "نوم مبكر"]}, {q: "أكل في البيت ولا مطعم؟ 🍽️", o: ["البيت", "المطعم"]},
  {q: "هدية مفاجئة ولا تختارها بنفسك؟ 🎁", o: ["مفاجأة", "أختارها"]}, {q: "رياضة صباحية ولا مسائية؟ 🏃", o: ["صباحية", "مسائية", "ما أمارس"]},
  {q: "تصوير ولا رسم؟ 📷🎨", o: ["تصوير", "رسم"]}, {q: "تحب المفاجآت ولا تكرهها؟ 🎉", o: ["أحبها", "أكرهها"]}
];

const b64uEnc = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
async function adminToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64uEnc(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64uEnc(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64uEnc(crypto.createSign("RSA-SHA256").update(hdr + "." + claim).sign(sa.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + hdr + "." + claim + "." + sig });
  const j = await r.json();
  if (!j.access_token) throw new Error("token");
  return j.access_token;
}
const val = (v) => typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : { stringValue: String(v) };

async function createPost(tok, id, data) {
  const fields = {}; Object.keys(data).forEach((k) => { fields[k] = val(data[k]); });
  const r = await fetch(FS + "posts?documentId=" + id, { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  return r.status; // 409 = موجود مسبقاً (يمنع التكرار)
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: "CRON_SECRET غير مضبوط" });
  if ((req.headers.authorization || "") !== "Bearer " + secret) return res.status(401).json({ error: "unauthorized" });
  let sa; try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); } catch (e) { return res.status(503).json({ error: "FIREBASE_SERVICE_ACCOUNT غير مضبوط" }); }
  try {
    const tok = await adminToken(sa);
    const local = new Date(Date.now() + 3 * 3600e3); // توقيت اليمن
    const day = local.toISOString().slice(0, 10);
    const n = Math.floor(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) / 86400000);
    const base = { uid: "hashidhub-official", name: "HashidHub الرسمي", photo: "/icon.svg", ver: true, official: true, privacy: "public" };
    const q = QUESTIONS[n % QUESTIONS.length], p = POLLS[n % POLLS.length];
    const now = Date.now();
    const s1 = await createPost(tok, "daily-" + day + "-q", Object.assign({}, base, { t: "❓ سؤال اليوم\n" + q, ts: now }));
    const s2 = await createPost(tok, "daily-" + day + "-p", Object.assign({}, base, { t: "📊 استطلاع اليوم\n" + p.q, poll: p.o, ts: now + 1 }));
    return res.status(200).json({ day, question: s1, poll: s2 });
  } catch (e) {
    return res.status(500).json({ error: "failed" });
  }
};
