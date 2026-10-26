// معاينة المشاركة (Open Graph): /s/<id> يعيد HTML فيه صورة ووصف للمنشور ثم يحوّل الزائر للتطبيق.
// يقرأ لقطة عامة من مجموعة shares في Firestore (يكتبها المستخدم عند ضغط مشاركة).
const PROJECT = "hashid-net";
const API_KEY = "AIzaSyAUlBb4PTSSFTAds01-ZlozcM5Lc1Wt0hY"; // مفتاح الويب العام، ليس سرياً

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const val = (f) => (f && (f.stringValue !== undefined ? f.stringValue : "")) || "";

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const origin = "https://" + host;
  let d = {};
  if (id) {
    try {
      const r = await fetch("https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/shares/" + id + "?key=" + API_KEY);
      if (r.ok) { const j = await r.json(); const f = j.fields || {}; d = { kind: val(f.kind), title: val(f.title), desc: val(f.desc), image: val(f.image) }; }
    } catch (e) {}
  }
  const title = d.title || "HashidHub";
  const desc = d.desc || "شاهد هذا المحتوى على HashidHub — تواصل · شارك · انطلق";
  let image = d.image || "";
  if (image.charAt(0) === "/") image = origin + image;
  if (!/^https:\/\//i.test(image)) image = "";
  const target = origin + "/#" + (d.kind === "reel" ? "reel=" : "p=") + id;
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + esc(title) + "</title>" +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="HashidHub">' +
    '<meta property="og:type" content="' + (d.kind === "reel" ? "video.other" : "article") + '">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(origin + "/s/" + id) + '">' +
    (image ? '<meta property="og:image" content="' + esc(image) + '"><meta name="twitter:image" content="' + esc(image) + '">' : "") +
    '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '">' +
    '<meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(target) + '">' +
    "</head><body><p>جارٍ فتح المنشور…</p><script>location.replace(" + JSON.stringify(target) + ");</script></body></html>";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
};
