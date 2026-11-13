/**
 * Hashid AI — Vercel Serverless proxy to OpenAI.
 * Set OPENAI_API_KEY in Vercel Environment Variables (never expose it client-side).
 *
 * Optional: OPENAI_MODEL (default: gpt-4o-mini)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "AI not configured",
      message: "أضف OPENAI_API_KEY في إعدادات Vercel Environment Variables"
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const prompt = String(body.prompt || "").trim().slice(0, 4000);
    const mode = String(body.mode || "general").slice(0, 40);

    if (!prompt || prompt.length < 2) {
      return res.status(400).json({ error: "empty_prompt", message: "اكتب نصاً أولاً" });
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
        model,
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
      return res.status(r.status).json({ error: "openai_error", message: msg });
    }

    const text = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    return res.status(200).json({
      text: String(text || "").trim(),
      model,
      mode
    });
  } catch (e) {
    return res.status(500).json({
      error: "server_error",
      message: e.message || "حدث خطأ غير متوقع"
    });
  }
}
