# ربط hashidhub.com ونطاق الوسائط media.hashidhub.com

## لماذا يظهر خطأ في Cloudflare؟
«النطاق المخصص» لأي Worker لا يُقبل إلا إذا كان النطاق نفسه (hashidhub.com) **مضافاً إلى Cloudflare وخوادم الأسماء (Nameservers) عنده**.
إن كنت ربطت النطاق بـ Vercel فقط من لوحة المسجّل، فـ Cloudflare لا يرى النطاق ويرفض إضافة media. وقد يظهر الخطأ أيضاً لوجود سجل DNS قديم باسم media.

## الخطوات
1. Cloudflare ← Add a site ← `hashidhub.com` ← الخطة المجانية.
2. في DNS تأكد من وجود هذين السجلين (انسخ القيم من Vercel ← Project ← Settings ← Domains)، وكلاهما **DNS only (سحابة رمادية)**:
   - `A` الاسم `@` القيمة `76.76.21.21`
   - `CNAME` الاسم `www` القيمة `cname.vercel-dns.com`
   احذف أي سجل باسم `media` إن وُجد.
3. عند المسجّل غيّر Nameservers إلى الاثنين اللذين يعطيك إياهما Cloudflare. انتظر حتى تصبح الحالة Active (دقائق إلى ساعات). الموقع يبقى يعمل عبر Vercel خلال ذلك.
4. Workers & Pages ← `hashid-media` ← Settings ← Domains & Routes ← Add ← **Custom Domain** ← `media.hashidhub.com`.
5. افتح `https://media.hashidhub.com/health` فيجب أن يظهر `ok`.
6. في متغيرات الـ Worker: `ALLOWED_ORIGINS` = `https://hashidhub.com,https://www.hashidhub.com,https://*.vercel.app`
7. في `media-config.js` غيّر السطرين إلى `https://media.hashidhub.com`، وارفعه. الروابط القديمة (workers.dev وvercel.app) تُحوَّل تلقائياً إلى العنوان الجديد.
8. **Firebase** ← Authentication ← Settings ← Authorized domains: أضف `hashidhub.com` و`www.hashidhub.com` (بدونها يفشل دخول Google وFacebook على النطاق الجديد). وفي تطبيق Facebook أضفهما إلى App Domains.

## ملاحظات
- جرّب `media.hashidhub.com` من شبكة في اليمن قبل اعتماده؛ إن كان محجوباً فأبقِ `/media` عبر Vercel كما هو (يعمل حالياً).
- تغيّر المصدر (origin) يعني أن المستخدمين يعيدون تفعيل الإشعارات ويثبّتون التطبيق من جديد على النطاق الجديد.
- ضع hashidhub.com دومين رئيسياً في Vercel وحوّل vercel.app إليه إن أردت.

# المحتوى الرسمي اليومي (سؤال + استطلاع)
1. في Vercel أضف متغير بيئة `CRON_SECRET` بقيمة نص عشوائي طويل (و`FIREBASE_SERVICE_ACCOUNT` موجود من قبل).
2. أضف إلى `vercel.json` عندك (دون المساس بالـ rewrites): `"crons": [{ "path": "/api/daily", "schedule": "0 6 * * *" }]`
3. أعد النشر. للتجربة الفورية: Vercel ← Project ← Settings ← Cron Jobs ← Run.
