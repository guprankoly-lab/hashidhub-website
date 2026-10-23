const { uploadHandler, BlobError } = require('@upstash/blob');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'hashid-net';
  // Supports either a full service-account JSON or the separate Vercel variables.
  // Secrets must remain in Vercel Environment Variables; never place them in frontend files.
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error('[upload-api] FIREBASE_SERVICE_ACCOUNT is not valid JSON');
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT environment variable');
    }
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    credential = admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    });
  } else {
    console.error('[upload-api] Missing Firebase Admin credentials: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
    throw new Error('Missing Firebase Admin credentials');
  }
  admin.initializeApp({ credential, projectId });
}

const uploads = uploadHandler({
  multipart: '16mb',
  constraints: {
    maxSize: '100mb',
    contentTypes: ['image/*', 'video/*']
  },
  onBeforeUpload: async ({ request, file }) => {
    const authorization = request.headers.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new BlobError('unauthorized', { message: 'سجّل الدخول قبل رفع الملفات' });

    let user;
    try {
      user = await admin.auth().verifyIdToken(match[1]);
    } catch (_) {
      throw new BlobError('unauthorized', { message: 'انتهت جلسة الدخول؛ سجّل الدخول مجدداً' });
    }

    const folder = request.headers.get('x-upload-folder') || '';
    const allowed = new Set(['avatars', 'videos', 'posts', 'pages', 'groups', 'stories', 'reels']);
    if (!allowed.has(folder)) throw new BlobError('forbidden', { message: 'مسار الرفع غير مسموح' });

    const type = file.type || '';
    const isImage = type.startsWith('image/');
    const isVideo = type.startsWith('video/');
    if (!isImage && !isVideo) throw new BlobError('invalid_input', { message: 'نوع الملف غير مدعوم' });
    if (isImage && file.size > 3 * 1024 * 1024) throw new BlobError('too_large', { message: 'الصورة أكبر من 3 ميغابايت' });
    if (isVideo && file.size > 100 * 1024 * 1024) throw new BlobError('too_large', { message: 'الفيديو أكبر من 100 ميغابايت' });

    const safeName = String(file.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    return {
      path: `${folder}/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`,
      metadata: { owner: user.uid, folder }
    };
  }
});

// Vercel Node Function adapter for this static-site project.
module.exports = async function handler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    const fn = uploads[method];
    if (!fn) { res.statusCode = 405; res.setHeader('Allow', 'GET, POST'); return res.end('Method Not Allowed'); }
    const url = new URL(req.url || '/api/upload', `https://${req.headers.host || 'localhost'}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers || {})) {
      if (Array.isArray(value)) headers.set(key, value.join(', '));
      else if (value != null) headers.set(key, String(value));
    }
    const request = new Request(url, {
      method,
      headers,
      ...(method === 'GET' || method === 'HEAD' ? {} : { body: req, duplex: 'half' })
    });
    const response = await fn(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (error) {
    console.error('[upload-api]', error && error.message ? error.message : error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ error: 'upload_service_error', message: 'تعذر تشغيل خدمة رفع الملفات. راجع سجلات الاستضافة.' }));
  }
};

module.exports.config = { api: { bodyParser: false } };
