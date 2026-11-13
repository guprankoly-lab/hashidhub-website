/**
 * Hashid AI — Vercel Serverless proxy to OpenAI
 * Env: OPENAI_API_KEY (required), OPENAI_MODEL (optional, default gpt-4o-mini)
 * After adding env vars: Redeploy the project.
 */

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "AI not configured",
      message: "أضف OPENAI_API_KEY في Vercel ثم أعد نشر المشروع (Redeploy)"
    }));
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
    }
    body = body || {};
    const prompt = String(body.prompt || "").trim().slice(0, 4000);
    const mode = String(body.mode || "general").slice(0, 40);
    if (!prompt || prompt.length < 2) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "empty_prompt", message: "اكتب نصاً أولاً" }));
    }

    const systemByMode = {
      improve: "أنت محرر محتوى عربي محترف على منصة اجتماعية للشباب. حسّن النص ليكون جذاباً وواضحاً وطبيعياً، مع الحفاظ على المعنى. أعد النص المحسّن فقط.",
      cv: "أنت مستشار توظيف. اكتب سيرة ذاتية قصيرة واحترافية بالعربية بناءً على المعطيات. استخدم نقاطاً واضحة.",
      ideas: "أنت مستشار ريادة أعمال للشباب. اقترح 5 أفكار عملية ومبتكرة بناءً على الموضوع، مع سطر واحد لكل فكرة يشرح القيمة.",
      translate: "ترجم النص إلى الإنجليزية بأسلوب طبيعي سلس. أعد الترجمة فقط دون شرح.",
      general: "أنت Hashid AI، مساعد ذكي داخل منصة HashidHub للشباب. أجب بالعربية بأسلوب ودود وعملي ومختصر."
    };
    const system = systemByMode[mode] || systemByMode.general;
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
          { role: "system", content: system },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "OpenAI error";
      res.statusCode = r.status;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "openai_error", message: msg }));
    }

    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      text: String(text || "").trim(),
      model: model,
      mode: mode
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "server_error",
      message: (e && e.message) || "حدث خطأ غير متوقع"
    }));
  }
}

// Vercel Node: CommonJS + ESM compatibility
module.exports = handler;
module.exports.default = handler;
try { module.exports.config = { maxDuration: 30 }; } catch (e) {}
