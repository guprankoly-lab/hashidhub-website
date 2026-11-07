// الوضع الموصى به (يتجاوز حجب workers.dev): الوسائط تمرّ عبر نطاق موقعك نفسه /media
// ويحوّلها Vercel إلى الـ Worker (راجع rewrites في vercel.json).
window.HH_MEDIA_API = "https://media.hashidhub.com";      // الرفع والفحص
window.HH_MEDIA_PUBLIC = "https://media.hashidhub.com";   // عرض الصور والفيديو

// عند امتلاك نطاق خاص مربوط بالـ Worker (الأفضل لتخفيف الحمل عن Vercel) استبدل السطرين بـ:
// window.HH_MEDIA_API = "https://media.yourdomain.com";
// window.HH_MEDIA_PUBLIC = "https://media.yourdomain.com";

// مفتاح VAPID العام (آمن في المتصفح) للإشعارات في الخلفية
window.__HH_VAPID_KEY = "BEt1fdnF65TF198YZNu1l9Xq35tZcYBRDg_26ksYAWjbqrW7L5zp8pGfl0h1bJg4IDhfTUT2LS_HywTpLxoss4c";
