# HashidHub 3.0

إعادة هيكلة كاملة بهيكل ملفات قابل للتوسع.

## البنية

```
v3/
  index.html
  css/
    style.css      # النظام البصري + التخطيط
    profile.css    # الملف الشخصي
    reels.css      # الريلز
  js/
    app.js         # التوجيه والواجهة
    state.js       # الحالة المشتركة
    firebase.js    # Firebase + رفع الوسائط
    auth.js        # المصادقة
    posts.js       # المنشورات
    stories.js     # القصص (إصلاح الظهور)
    reels.js       # الريلز
    profile.js     # الملف + الشارات + الإنجازات
    explore.js     # استكشاف + بحث موحّد
    ai.js          # Hashid AI
  api/ai.js
  firebase-config.js
  media-config.js
```

## النشر على Vercel

1. ارفع محتوى مجلد `v3` إلى جذر المشروع (أو اضبط Root Directory على `v3`).
2. تأكد من وجود `api/ai.js` و`OPENAI_API_KEY`.
3. Redeploy.

## ما يعمل في هذه الدفعة

- تخطيط Desktop: Menu | Feed | Trends
- Bottom nav للجوال
- قصص مع دمج محلي + السيرفر (لا تختفي بعد الرفع)
- ريلز: رف + صفحة + رفع
- منشورات + إعجاب
- ملف شخصي: بانر، إحصائيات، شارات Creator، إنجازات
- Explore + Search 3.0
- Hashid AI عبر `/api/ai`
- هوية ألوان جديدة (`#00B894` / `#0984E3` / `#FDCB6E`)

## الخطوات التالية

- نموذج سوق كامل (تصنيفات عالمية)
- رسائل (Seen / Typing / Voice)
- إحصائيات Creator Dashboard
- نقل باقي ميزات v1 (توثيق، تحديات، لوحة إدارة)

## Marketplace 3.0 (Global)

Module: `js/marketplace.js`

Categories: Electronics · Cars · Real Estate · Jobs · Services · Digital · Fashion · Other

Features:
- Filter chips + search
- Multi-image upload (up to 4)
- Instant list update after publish
- Owner delete
- Firestore `marketplace` collection (`status: published`)
