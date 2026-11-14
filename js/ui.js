import { t, esc } from "./state.js";

export function showSheet(html, opts) {
  opts = opts || {};
  const overlay = document.createElement("div");
  overlay.className = "sheet";
  overlay.innerHTML = `<div class="sheet-in">${html}</div>`;
  document.body.appendChild(overlay);
  const close = () => {
    overlay.remove();
    if (opts.onClose) opts.onClose();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
  return { el: overlay, close };
}

export function confirmDialog(message, title) {
  return new Promise((resolve) => {
    const { close } = showSheet(`
      <h3 style="margin:0 0 10px">${esc(title || t("تأكيد", "Confirm"))}</h3>
      <p class="note" style="margin:0 0 16px;color:var(--ink)">${esc(message)}</p>
      <div class="row" style="gap:8px">
        <button class="btn alt" style="flex:1" data-no>${t("إلغاء", "Cancel")}</button>
        <button class="btn" style="flex:1" data-yes>${t("موافق", "OK")}</button>
      </div>`);
    const root = document.querySelector(".sheet:last-of-type");
    root.querySelector("[data-yes]").onclick = () => {
      close();
      resolve(true);
    };
    root.querySelector("[data-no]").onclick = () => {
      close();
      resolve(false);
    };
  });
}

export function promptDialog(message, def, title) {
  return new Promise((resolve) => {
    const { close } = showSheet(`
      <h3 style="margin:0 0 10px">${esc(title || t("إدخال", "Input"))}</h3>
      <p class="note" style="margin:0 0 8px">${esc(message)}</p>
      <input class="input" id="hh-prompt-val" value="${esc(def || "")}">
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn alt" style="flex:1" data-no>${t("إلغاء", "Cancel")}</button>
        <button class="btn" style="flex:1" data-yes>${t("حسناً", "OK")}</button>
      </div>`);
    const root = document.querySelector(".sheet:last-of-type");
    const inp = root.querySelector("#hh-prompt-val");
    setTimeout(() => inp?.focus(), 50);
    root.querySelector("[data-yes]").onclick = () => {
      const v = inp?.value ?? null;
      close();
      resolve(v);
    };
    root.querySelector("[data-no]").onclick = () => {
      close();
      resolve(null);
    };
  });
}

export function loadingOverlay(text) {
  let el = document.getElementById("hh-loading");
  if (!el) {
    el = document.createElement("div");
    el.id = "hh-loading";
    el.className = "hh-loading";
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="hh-loading-card"><div class="spinner"></div><div>${esc(text || t("جاري التحميل…", "Loading…"))}</div></div>`;
  el.classList.remove("hidden");
  return {
    set(t2) {
      const d = el.querySelector("div:last-child");
      if (d) d.textContent = t2;
    },
    hide() {
      el.classList.add("hidden");
    }
  };
}
