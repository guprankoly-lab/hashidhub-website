// الوضع الموصى به (يتجاوز حجب workers.dev): الوسائط تمرّ عبر نطاق موقعك نفسه /media
// ويحوّلها Vercel إلى الـ Worker (راجع rewrites في vercel.json).
window.HH_MEDIA_API = "/media";      // الرفع والفحص
window.HH_MEDIA_PUBLIC = "/media";   // عرض الصور والفيديو

// عند امتلاك نطاق خاص مربوط بالـ Worker (الأفضل لتخفيف الحمل عن Vercel) استبدل السطرين بـ:
// window.HH_MEDIA_API = "https://media.yourdomain.com";
// window.HH_MEDIA_PUBLIC = "https://media.yourdomain.com";
