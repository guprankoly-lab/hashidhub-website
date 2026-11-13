/**
 * Hashid AI — Vercel Serverless (Node)
 * Required env: OPENAI_API_KEY
 * Optional: OPENAI_MODEL (default gpt-4o-mini)
 * After setting env vars: Redeploy the project.
 */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // Health check for browser GET
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      service: "hashid-ai",
      hasKey: !!process.env.OPENAI_API_KEY,
      hint: "POST { prompt, mode } to generate"
    }));
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed", message: "Use POST", status: 405 }));
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.statusCode = 503;
    return res.end(JSON.stringify({
      error: "AI not configured",
      message: "أضف OPENAI_API_KEY في Vercel Environment Variables ثم اعمل Redeploy",
      status: 503
    }));
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
    }
    if (!body || typeof body !== "object") body = {};

    const prompt = String(body.prompt || "").trim().slice(0, 4000);
    const mode = String(body.mode || "general").slice(0, 40);
    if (prompt.length < 2) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "empty_prompt", message: "اكتب نصاً أولاً", status: 400 }));
    }

    const systemByMode = {
      improve: "أنت محرر محتوى عربي محترف على منصة اجتماعية للشباب. حسّن النص ليكون جذاباً وواضحاً وطبيعياً، مع الحفاظ على المعنى. أعد النص المحسّن فقط.",
      cv: "أنت مستشار توظيف. اكتب سيرة ذاتية قصيرة واحترافية بالعربية بناءً على المعطيات. استخدم نقاطاً واضحة.",
      ideas: "أنت مستشار ريادة أعمال للشباب. اقترح 5 أفكار عملية ومبتكرة بناءً على الموضوع، مع سطر واحد لكل فكرة.",
      translate: "ترجم النص إلى الإنجليزية بأسلوب طبيعي سلس. أعد الترجمة فقط دون شرح.",
      general: "أنت Hashid AI، مساعد ذكي داخل منصة HashidHub للشباب. أجب بالعربية بأسلوب ودود وعملي ومختصر."
    };

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.7,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemByMode[mode] || systemByMode.general },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("OpenAI HTTP " + r.status);
      res.statusCode = r.status;
      return res.end(JSON.stringify({ error: "openai_error", message: msg, status: r.status }));
    }

    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    res.statusCode = 200;
    return res.end(JSON.stringify({
      text: String(text || "").trim(),
      model: model,
      mode: mode,
      status: 200
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: "server_error",
      message: (e && e.message) || "حدث خطأ غير متوقع",
      status: 500
    }));
  }
};
