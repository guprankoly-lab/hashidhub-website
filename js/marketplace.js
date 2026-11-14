import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  limit,
  uploadMedia
} from "./firebase.js";
import { state, t, toast, esc } from "./state.js";

/** Global marketplace categories */
export const MARKET_CATEGORIES = [
  { id: "electronics", ar: "إلكترونيات", en: "Electronics", ico: "📱" },
  { id: "cars", ar: "سيارات", en: "Cars", ico: "🚗" },
  { id: "realestate", ar: "عقارات", en: "Real Estate", ico: "🏠" },
  { id: "jobs", ar: "وظائف", en: "Jobs", ico: "💼" },
  { id: "services", ar: "خدمات", en: "Services", ico: "🛠️" },
  { id: "digital", ar: "منتجات رقمية", en: "Digital Products", ico: "💾" },
  { id: "fashion", ar: "أزياء", en: "Fashion", ico: "👕" },
  { id: "other", ar: "أخرى", en: "Other", ico: "📦" }
];

export function catLabel(id) {
  const c = MARKET_CATEGORIES.find((x) => x.id === id || x.ar === id || x.en === id);
  if (!c) return id || t("عام", "General");
  return state.lang === "en" ? c.en : c.ar;
}

export function listenMarketplace() {
  const apply = (snap) => {
    state.catalog.marketplace = snap.docs
      .map((d) => Object.assign({ id: d.id }, d.data()))
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    if (state.tab === "marketplace") {
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "marketplace" }));
    }
  };
  try {
    const unsub = onSnapshot(
      query(collection(db, "marketplace"), where("status", "==", "published"), limit(80)),
      apply,
      (err) => {
        console.warn("[market] query", err?.code, err?.message);
        // fallback: all docs (client filter)
        const unsub2 = onSnapshot(
          query(collection(db, "marketplace"), limit(80)),
          (snap) => {
            state.catalog.marketplace = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .filter((x) => !x.status || x.status === "published")
              .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
            if (state.tab === "marketplace") {
              window.dispatchEvent(new CustomEvent("hh:data", { detail: "marketplace" }));
            }
          },
          (e2) => console.warn("[market] fallback", e2?.message)
        );
        state.unsubs.push(unsub2);
      }
    );
    state.unsubs.push(unsub);
  } catch (e) {
    console.warn(e);
  }
}

export function marketplacePageHtml() {
  const filter = window.__marketCat || "all";
  const q = (window.__marketQ || "").trim().toLowerCase();
  let list = state.catalog.marketplace || [];
  if (filter !== "all") {
    list = list.filter((x) => {
      const c = String(x.category || "").toLowerCase();
      return c === filter || c === catLabel(filter).toLowerCase() || c.includes(filter);
    });
  }
  if (q) {
    list = list.filter((x) =>
      (x.title + " " + x.description + " " + x.category + " " + (x.location || ""))
        .toLowerCase()
        .includes(q)
    );
  }

  let h = `<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <div>
      <h2 style="margin:0">🛍️ ${t("السوق العالمي", "Global Marketplace")}</h2>
      <p class="note" style="margin:4px 0 0">${t("إلكترونيات · سيارات · عقارات · خدمات · رقمي", "Electronics · Cars · Real estate · Services · Digital")}</p>
    </div>
    ${
      !state.isGuest
        ? `<button class="btn" data-act="market-add">+ ${t("إضافة عرض", "Add listing")}</button>`
        : `<button class="btn alt" data-act="goto-auth">${t("سجّل للنشر", "Sign in to post")}</button>`
    }
  </div>`;

  h += `<div class="card" style="padding:10px">
    <input class="input" id="market-q" type="search" placeholder="${t("ابحث في السوق…", "Search marketplace…")}" value="${esc(window.__marketQ || "")}">
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">
      <button class="chip ${filter === "all" ? "brand" : ""}" data-act="market-cat" data-v="all">${t("الكل", "All")} (${(state.catalog.marketplace || []).length})</button>`;
  MARKET_CATEGORIES.forEach((c) => {
    const n = (state.catalog.marketplace || []).filter((x) => {
      const v = String(x.category || "").toLowerCase();
      return v === c.id || v === c.ar.toLowerCase() || v === c.en.toLowerCase();
    }).length;
    h += `<button class="chip ${filter === c.id ? "brand" : ""}" data-act="market-cat" data-v="${c.id}">${c.ico} ${state.lang === "en" ? c.en : c.ar}${n ? " (" + n + ")" : ""}</button>`;
  });
  h += `</div></div>`;

  if (!list.length) {
    h += `<div class="empty">
      <div class="ico">🛍️</div>
      <h3>${t("لا عروض في هذا التصنيف", "No listings in this category")}</h3>
      <p>${t("كن أول من ينشر عرضاً في السوق العالمي.", "Be the first to list in the global marketplace.")}</p>
      ${!state.isGuest ? `<button class="btn" data-act="market-add">+ ${t("إضافة عرض", "Add listing")}</button>` : ""}
    </div>`;
    return h;
  }

  h += `<div class="plat-grid">`;
  list.forEach((x) => {
    const img = (x.images && x.images[0]) || x.image || "";
    const own = state.me && x.ownerId === state.me.uid;
    h += `<article class="plat-card">
      ${img ? `<img class="cover" src="${esc(img)}" alt="" loading="lazy">` : `<div class="cover" style="height:140px;display:grid;place-items:center;background:var(--card2);font-size:2rem">📦</div>`}
      <div class="body">
        <div class="row" style="flex-wrap:wrap;gap:4px">
          <span class="chip blue">${esc(catLabel(x.category))}</span>
          ${x.location ? `<span class="chip">📍 ${esc(x.location)}</span>` : ""}
          ${own ? `<span class="chip gold">${t("عرضك", "Yours")}</span>` : ""}
        </div>
        <h3 style="margin:8px 0 4px;font-size:1rem">${esc(x.title || "")}</h3>
        <p class="note" style="margin:0 0 8px">${esc(String(x.description || "").slice(0, 100))}${String(x.description || "").length > 100 ? "…" : ""}</p>
        <div class="row" style="justify-content:space-between;align-items:center">
          <span class="plat-price">${Number(x.price || 0).toLocaleString()} ${esc(x.currency || "USD")}</span>
          ${
            own
              ? `<button class="btn alt sm" data-act="market-del" data-id="${esc(x.id)}">${t("حذف", "Delete")}</button>`
              : `<button class="btn alt sm" data-act="market-contact" data-u="${esc(x.ownerId || "")}">${t("تواصل", "Contact")}</button>`
          }
        </div>
        ${x.delivery ? `<div class="note" style="margin-top:6px">⏱ ${esc(x.delivery)}</div>` : ""}
      </div>
    </article>`;
  });
  h += `</div>`;
  return h;
}

export function openMarketComposer() {
  if (!state.me?.uid || state.me.uid === "__guest__") {
    toast(t("سجّل أولاً", "Sign in first"));
    return;
  }
  const files = [];
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-in">
    <div style="width:40px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 12px"></div>
    <h3>${t("إضافة عرض للسوق", "Add marketplace listing")}</h3>
    <label class="note">${t("العنوان", "Title")}</label>
    <input class="input" id="mk-title" maxlength="160" placeholder="${t("مثال: iPhone 15 Pro", "e.g. iPhone 15 Pro")}">
    <label class="note">${t("الوصف", "Description")}</label>
    <textarea class="input" id="mk-desc" maxlength="2000" placeholder="${t("التفاصيل…", "Details…")}"></textarea>
    <label class="note">${t("التصنيف", "Category")}</label>
    <select class="input" id="mk-cat">
      ${MARKET_CATEGORIES.map((c) => `<option value="${c.id}">${c.ico} ${state.lang === "en" ? c.en : c.ar}</option>`).join("")}
    </select>
    <div class="row" style="gap:8px">
      <div style="flex:1"><label class="note">${t("السعر", "Price")}</label>
        <input class="input" id="mk-price" type="number" min="0" value="0"></div>
      <div style="width:100px"><label class="note">${t("العملة", "Currency")}</label>
        <input class="input" id="mk-cur" maxlength="3" value="USD"></div>
    </div>
    <label class="note">${t("الموقع", "Location")}</label>
    <input class="input" id="mk-loc" maxlength="120" placeholder="${t("مدينة / عن بُعد", "City / Remote")}">
    <label class="note">${t("التسليم / الكمية", "Delivery / quantity")}</label>
    <input class="input" id="mk-del" maxlength="80" placeholder="${t("مثال: خلال 3 أيام", "e.g. within 3 days")}">
    <label class="note">${t("صور المنتج (حتى 4)", "Product images (up to 4)")}</label>
    <div class="row" style="margin:8px 0">
      <label class="btn alt sm" style="cursor:pointer">${t("رفع صور", "Upload")}<input type="file" id="mk-imgs" accept="image/*" multiple hidden></label>
    </div>
    <div id="mk-preview" class="row" style="flex-wrap:wrap;gap:8px"></div>
    <div class="note" id="mk-err" style="color:var(--danger);min-height:1.2em"></div>
    <button class="btn" id="mk-save" style="width:100%;margin-top:8px">${t("نشر", "Publish")}</button>
    <button class="btn alt" data-close style="width:100%;margin-top:8px">${t("إلغاء", "Cancel")}</button>
  </div>`;
  document.body.appendChild(sheet);

  sheet.querySelector("[data-close]").onclick = () => sheet.remove();
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.remove();
  });

  sheet.querySelector("#mk-imgs").addEventListener("change", (e) => {
    const list = Array.from(e.target.files || []).slice(0, 4);
    files.length = 0;
    files.push(...list);
    const prev = sheet.querySelector("#mk-preview");
    prev.innerHTML = "";
    list.forEach((f) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.style.cssText = "width:72px;height:72px;object-fit:cover;border-radius:12px;border:1px solid var(--line)";
      prev.appendChild(img);
    });
  });

  sheet.querySelector("#mk-save").onclick = async () => {
    const err = sheet.querySelector("#mk-err");
    const title = (sheet.querySelector("#mk-title").value || "").trim();
    const description = (sheet.querySelector("#mk-desc").value || "").trim();
    const category = sheet.querySelector("#mk-cat").value || "other";
    const price = Math.max(0, Number(sheet.querySelector("#mk-price").value) || 0);
    const currency = (sheet.querySelector("#mk-cur").value || "USD").toUpperCase().slice(0, 3);
    const location = (sheet.querySelector("#mk-loc").value || "").trim().slice(0, 120);
    const delivery = (sheet.querySelector("#mk-del").value || "").trim().slice(0, 80);
    if (title.length < 3) {
      err.textContent = t("العنوان قصير", "Title too short");
      return;
    }
    if (description.length < 10) {
      err.textContent = t("الوصف قصير", "Description too short");
      return;
    }
    const saveBtn = sheet.querySelector("#mk-save");
    saveBtn.disabled = true;
    err.textContent = t("جاري الرفع والنشر…", "Uploading & publishing…");
    try {
      const images = [];
      for (const f of files) {
        try {
          images.push(await uploadMedia(f, "posts"));
        } catch (upE) {
          console.warn(upE);
        }
      }
      const payload = {
        ownerId: state.me.uid,
        title: title.slice(0, 160),
        description: description.slice(0, 2000),
        category,
        price,
        currency,
        location,
        delivery,
        images,
        status: "published",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const ref = await addDoc(collection(db, "marketplace"), payload);
      // instant UI update
      state.catalog.marketplace = [
        Object.assign({ id: ref.id }, payload),
        ...(state.catalog.marketplace || []).filter((x) => x.id !== ref.id)
      ];
      toast(t("تم نشر العرض", "Listing published"));
      sheet.remove();
      state.tab = "marketplace";
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "marketplace" }));
    } catch (ex) {
      err.textContent = ex.message || "Error";
      saveBtn.disabled = false;
    }
  };
}

export async function deleteListing(id) {
  if (!id) return;
  const { confirmDialog } = await import("./ui.js");
  if (!(await confirmDialog(t("حذف هذا العرض؟", "Delete this listing?")))) return;
  await deleteDoc(doc(db, "marketplace", id));
  state.catalog.marketplace = (state.catalog.marketplace || []).filter((x) => x.id !== id);
  toast(t("تم الحذف", "Deleted"));
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "marketplace" }));
}

export async function openSellerContact(ownerId, listing) {
  const { showSheet } = await import("./ui.js");
  const u = (state.users || []).find((x) => x.id === ownerId) || {};
  const nList = (state.catalog.marketplace || []).filter((x) => x.ownerId === ownerId).length;
  const wa = u.whatsapp || u.phone || "";
  const tel = u.phone || "";
  const tg = u.telegram || "";
  const html = `
    <h3 style="margin:0 0 8px">${t("تواصل مع البائع", "Contact seller")}</h3>
    <p><b>${esc(u.name || listing?.title || "")}</b></p>
    <p class="note">${nList} ${t("إعلان", "listings")} · ⭐ ${u.rating != null ? u.rating : "—"} ${t("تقييم", "rating")}</p>
    <div class="col" style="margin-top:12px;gap:8px">
      <button class="btn" data-act-c="msg" style="width:100%">💬 ${t("رسائل داخلية", "In-app message")}</button>
      ${wa ? `<a class="btn secondary" style="width:100%;text-align:center" href="https://wa.me/${esc(String(wa).replace(/\D/g,""))}" target="_blank" rel="noopener">WhatsApp</a>` : `<button class="btn alt" style="width:100%" disabled>WhatsApp — ${t("غير متوفر", "N/A")}</button>`}
      ${tel ? `<a class="btn alt" style="width:100%;text-align:center" href="tel:${esc(tel)}">📞 ${t("اتصال", "Call")}</a>` : ""}
      ${tg ? `<a class="btn alt" style="width:100%;text-align:center" href="https://t.me/${esc(String(tg).replace("@",""))}" target="_blank" rel="noopener">Telegram</a>` : ""}
      <button class="btn ghost" data-close style="width:100%">${t("إغلاق", "Close")}</button>
    </div>`;
  const { el, close } = showSheet(html);
  el.querySelector('[data-act-c="msg"]')?.addEventListener("click", () => {
    close();
    if (!ownerId) return;
    window.dispatchEvent(new CustomEvent("hh:open-chat", { detail: { uid: ownerId, name: u.name || "" } }));
  });
}


