import { state, t, toast, esc } from "./state.js";

export const AI_MODES = [
  { id: "general", label: t("مساعد", "Assistant") },
  { id: "improve", label: t("اكتب منشور", "Write post") },
  { id: "cv", label: t("حسّن السيرة", "Improve CV") },
  { id: "ideas", label: t("هاشتاغات / أفكار", "Hashtags / ideas") },
  { id: "translate", label: t("عنوان ريل", "Reel title") }
];

export function aiPageHtml() {
  const modes = [
    { id: "general", ar: "مساعد", en: "Assistant" },
    { id: "improve", ar: "اكتب منشور", en: "Write post" },
    { id: "cv", ar: "حسّن السيرة", en: "Improve CV" },
    { id: "ideas", ar: "اقترح هاشتاغات", en: "Suggest hashtags" },
    { id: "translate", ar: "عنوان ريل", en: "Reel title" }
  ];
  let h = `<h2 style="margin:0 0 8px">🤖 Hashid AI</h2>
    <p class="note">${t("اكتب منشوراً، حسّن سيرتك، اقترح هاشتاغات أو عنوان ريل.", "Write posts, improve CV, suggest hashtags or reel titles.")}</p>
    <div class="card">
      <div class="ai-modes">`;
  modes.forEach((m) => {
    h += `<button class="chip ${state.aiMode === m.id ? "brand" : ""}" data-act="ai-mode" data-v="${m.id}">${state.lang === "en" ? m.en : m.ar}</button>`;
  });
  h += `</div>
      <textarea id="ai-prompt" class="input" placeholder="${t("اكتب طلبك…", "Type your request…")}">${esc(state.aiPrompt || "")}</textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn" data-act="ai-run" ${state.aiBusy ? "disabled" : ""}>${state.aiBusy ? "⏳…" : "✨ " + t("توليد", "Generate")}</button>
        <button class="btn alt" data-act="ai-clear">${t("مسح", "Clear")}</button>
      </div>
      <div class="ai-out" style="margin-top:12px">${esc(state.aiOut || t("سيظهر الرد هنا", "Output appears here"))}</div>
      <p class="note" style="margin-top:8px;direction:ltr;text-align:left;font-size:.75rem">POST /api/ai</p>
    </div>`;
  return h;
}

export async function runAI() {
  if (state.aiBusy) return;
  const el = document.getElementById("ai-prompt");
  const prompt = (el?.value || state.aiPrompt || "").trim();
  if (prompt.length < 2) return toast(t("اكتب طلبك أولاً", "Write a prompt first"));
  state.aiPrompt = prompt;
  state.aiBusy = true;
  state.aiOut = "⏳ " + t("جاري التوليد…", "Generating…");
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "ai" }));

  const apiUrl = location.origin + "/api/ai";
  const body = { prompt, mode: state.aiMode || "general" };
  console.log("[AI] POST", apiUrl, body);
  try {
    const r = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin"
    });
    const raw = await r.text();
    console.log("[AI] status", r.status, "raw", raw.slice(0, 500));
    let data = {};
    try {
      data = JSON.parse(raw || "{}");
    } catch (_) {
      data = { message: raw.slice(0, 300) };
    }
    if (!r.ok) {
      state.aiOut = `[HTTP ${r.status}] ${data.message || data.error || r.statusText || "Error"}`;
      toast(state.aiOut, 5000);
    } else {
      state.aiOut = String(data.text || "").trim() || t("(فارغ)", "(empty)");
      toast(t("تم التوليد", "Generated"));
    }
  } catch (err) {
    console.error("[AI]", err);
    state.aiOut = `[HTTP NETWORK] ${err.message || "fetch failed"}`;
    toast(state.aiOut, 5000);
  }
  state.aiBusy = false;
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "ai" }));
}
