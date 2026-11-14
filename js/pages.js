import {
  db,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from "./firebase.js";
import { state, t, toast, esc, DEF_AV } from "./state.js";
import { promptDialog, loadingOverlay } from "./ui.js";

state.pages = state.pages || [];
state.activePageId = null;

export function listenPages() {
  try {
    const unsub = onSnapshot(
      query(collection(db, "pages"), orderBy("ts", "desc"), limit(80)),
      (snap) => {
        state.pages = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        window.dispatchEvent(new CustomEvent("hh:data", { detail: "pages" }));
      },
      (err) => console.warn("[pages]", err?.code)
    );
    state.unsubs.push(unsub);
  } catch (e) {
    console.warn(e);
  }
}

export function myPages(uid) {
  uid = uid || state.me?.uid;
  return (state.pages || []).filter((p) => p.owner === uid || (p.admins || []).includes(uid));
}

export function pagesBlockHtml(uid) {
  uid = uid || state.me?.uid;
  const mine = uid === state.me?.uid;
  const list = myPages(uid);
  let h = `<div class="card"><h3 style="margin:0 0 10px">📄 ${t("الصفحات", "Pages")}</h3>`;
  if (!list.length) {
    h += `<p class="note">${t("ليس لديك صفحة حتى الآن", "You don't have a page yet")}</p>`;
    if (mine) {
      h += `<button class="btn" data-act="page-create">➕ ${t("إنشاء صفحة جديدة", "Create a page")}</button>`;
    }
  } else {
    list.forEach((p) => {
      const followers = (state.follows || []).filter((f) => f.b === "page:" + p.id).length;
      const posts = (state.posts || []).filter((x) => x.pageId === p.id).length;
      h += `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">
        <img class="av" src="${esc(p.photo || DEF_AV)}" alt="">
        <div style="flex:1">
          <b>${esc(p.name || "")}</b>
          <div class="note">${followers} ${t("متابع", "followers")} · ${posts} ${t("منشور", "posts")}</div>
        </div>
        <button class="btn alt sm" data-act="page-open" data-id="${esc(p.id)}">${t("فتح", "Open")}</button>
      </div>`;
    });
    if (mine) {
      h += `<button class="btn alt" style="width:100%;margin-top:10px" data-act="page-create">➕ ${t("إنشاء صفحة جديدة", "Create a page")}</button>`;
    }
  }
  h += `</div>`;
  return h;
}

export function pageViewHtml(id) {
  const p = state.pages.find((x) => x.id === id);
  if (!p) return `<div class="empty"><p>${t("الصفحة غير موجودة", "Page not found")}</p></div>`;
  const isOwner = state.me && p.owner === state.me.uid;
  const posts = (state.posts || []).filter((x) => x.pageId === id);
  let h = `<div class="card profile-card">
    <div class="profile-banner">${p.cover ? `<img src="${esc(p.cover)}" alt="">` : ""}</div>
    <div class="profile-main">
      <div class="profile-photo-row">
        <img class="av xl" src="${esc(p.photo || DEF_AV)}" alt="">
      </div>
      <div class="profile-name">${esc(p.name || "")}${p.verified ? " ✓" : ""}</div>
      <div class="profile-bio">${esc(p.bio || "")}</div>
      ${
        isOwner
          ? `<div class="profile-cta">
        <button class="btn" data-act="page-switch" data-id="${esc(id)}">${t("التبديل للنشر باسم الصفحة", "Switch to page")}</button>
        <button class="btn alt" data-act="page-edit" data-id="${esc(id)}">${t("تحرير", "Edit")}</button>
      </div>`
          : ""
      }
    </div>
  </div>
  <div class="card"><h3 style="margin:0 0 8px">${t("منشورات الصفحة", "Page posts")}</h3>`;
  if (!posts.length) h += `<p class="note">${t("لا منشورات", "No posts")}</p>`;
  posts.slice(0, 20).forEach((x) => {
    h += `<div style="padding:8px 0;border-bottom:1px solid var(--line)">${esc(String(x.t || "").slice(0, 160))}</div>`;
  });
  h += `</div>
  <button class="btn alt" data-act="tab" data-t="me">← ${t("رجوع", "Back")}</button>`;
  return h;
}

export async function createPage() {
  if (!state.me?.uid || state.me.uid === "__guest__") return toast(t("سجّل أولاً", "Sign in first"));
  const name = await promptDialog(t("اسم الصفحة", "Page name"), "");
  if (name == null || String(name).trim().length < 2) return;
  const load = loadingOverlay(t("جاري إنشاء الصفحة…", "Creating page…"));
  try {
    const payload = {
      name: String(name).trim().slice(0, 60),
      owner: state.me.uid,
      photo: state.prof?.photo || "",
      bio: "",
      ts: Date.now(),
      verified: false
    };
    const ref = await addDoc(collection(db, "pages"), payload);
    state.pages = [Object.assign({ id: ref.id }, payload), ...state.pages];
    toast(t("تم إنشاء الصفحة", "Page created"));
    state.tab = "page";
    state.activePageId = ref.id;
    window.dispatchEvent(new CustomEvent("hh:data", { detail: "pages" }));
  } catch (e) {
    toast(e.message || "Error");
  } finally {
    load.hide();
  }
}
