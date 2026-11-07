# تفعيل الإشعارات في الخلفية (المكالمات والرسائل)

1. **مفتاح الخدمة:** Firebase Console ← Project settings ← Service accounts ← Generate new private key. افتح الملف JSON.
2. **Vercel:** Project ← Settings ← Environment Variables، أضف `FIREBASE_SERVICE_ACCOUNT` وقيمته محتوى ملف JSON كاملاً. ثم أعد النشر (Redeploy).
3. **Firebase:** تأكد أن Cloud Messaging API (V1) مفعّل (Project settings ← Cloud Messaging).
4. **القواعد:** انشر `firestore.rules` المحدّثة (تضيف pushTokens وaskQ وقراءة الزائر).
5. **مفتاح VAPID** موجود في `media-config.js` (`window.__HH_VAPID_KEY`).
6. على كل جهاز: يضغط المستخدم «تفعيل» في بطاقة الإشعارات بالصفحة الرئيسية ويوافق على الإذن.

ملاحظات: على iPhone تعمل الإشعارات فقط بعد «إضافة إلى الشاشة الرئيسية» (iOS 16.4+). إن بقي الرنين صامتاً على جهاز فاضغط أي مكان بالصفحة مرة واحدة (سياسة المتصفح للصوت).
الرسائل التي تُرسل عبر `/api/push` قوالب ثابتة من الخادم، ولا يقبل نصاً من المتصفح.
