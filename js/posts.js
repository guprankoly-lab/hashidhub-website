import {
  db,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  uploadMedia
} from "./firebase.js";
import { state, t, toast, esc, DEF_AV, ago } from "./state.js";

export function listenPosts() {
  const q = query(collection(db, "posts"), orderBy("ts", "desc"), limit(40));
  const unsub = onSnapshot(
    q,
    (snap) => {
      state.posts = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "posts" }));
    },
    (err) => console.warn("[posts]", err?.code)
  );
  state.unsubs.push(unsub);

  const u2 = onSnapshot(collection(db, "likes"), (snap) => {
    state.likes = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  });
  state.unsubs.push(u2);
}

export function composerHtml() {
  if (state.isGuest || !state.prof) {
    return `<div class="card empty"><div class="ico">👋</div><h3>${t("انضم للنشر", "Join to post")}</h3>
      <p>${t("سجّل حساباً لتشارك المنشورات والقصص والريلز.", "Sign in to share posts, stories and reels.")}</p>
      <button class="btn" data-act="goto-auth">${t("تسجيل الدخول", "Sign in")}</button></div>`;
  }
  return `<div class="card composer">
    <div class="row">
      <img class="av" src="${esc(state.prof.photo || DEF_AV)}" alt="">
      <textarea id="post-text" placeholder="${t("بماذا تفكر؟", "What's on your mind?")}" maxlength="5000"></textarea>
    </div>
    <div id="post-preview" class="note"></div>
    <div class="composer-tools">
      <label class="btn alt sm">${t("صورة", "Photo")}<input type="file" id="post-img" accept="image/*" hidden></label>
      <button class="btn" id="post-pub">${t("نشر", "Post")}</button>
    </div>
  </div>`;
}

export function feedHtml() {
  if (!state.posts.length) {
    return `<div class="empty"><div class="ico">✨</div><h3>${t("الموجز فارغ", "Feed is empty")}</h3>
      <p>${t("كن أول من ينشر اليوم.", "Be the first to post today.")}</p></div>`;
  }
  return state.posts
    .map((p) => {
      const liked = state.likes.some((l) => l.pid === p.id && l.uid === state.me?.uid);
      const lc = state.likes.filter((l) => l.pid === p.id).length;
      const mine = state.me && p.uid === state.me.uid;
      return `<article class="post" data-id="${esc(p.id)}">
        <div class="post-head">
          <img class="av" src="${esc(p.photo || DEF_AV)}" alt="" data-act="open-profile" data-u="${esc(p.uid || "")}">
          <div style="flex:1">
            <div class="name">${esc(p.name || t("عضو", "Member"))}${p.ver ? " ✓" : ""}</div>
            <div class="time">${ago(p.ts)}</div>
          </div>
          <button type="button" class="post-menu-btn" data-act="post-menu" data-id="${esc(p.id)}" data-uid="${esc(p.uid || "")}" aria-label="menu">⋮</button>
        </div>
        <div class="post-body">${esc(p.t || p.text || "")}</div>
        ${
          p.media
            ? p.type === "video"
              ? `<div class="post-media"><video src="${esc(p.media)}" controls playsinline preload="metadata"></video></div>`
              : `<div class="post-media"><img src="${esc(p.media)}" alt="" loading="lazy"></div>`
            : ""
        }
        <div class="post-actions">
          <button class="btn alt sm" data-act="like-post" data-id="${esc(p.id)}">${liked ? "❤️" : "🤍"} ${lc}</button>
          <button class="btn alt sm" data-act="comment-post" data-id="${esc(p.id)}">💬</button>
          <button class="btn alt sm" data-act="share-post" data-id="${esc(p.id)}">↗</button>
        </div>
      </article>`;
    })
    .join("");
}

export function bindComposer() {
  const fileInput = document.getElementById("post-img");
  let file = null;
  fileInput?.addEventListener("change", () => {
    file = fileInput.files?.[0] || null;
    const prev = document.getElementById("post-preview");
    if (prev) prev.textContent = file ? file.name : "";
  });
  document.getElementById("post-pub")?.addEventListener("click", async () => {
    if (!state.me?.uid || state.me.uid === "__guest__") return toast(t("سجّل أولاً", "Sign in first"));
    const text = (document.getElementById("post-text")?.value || "").trim();
    if (!text && !file) return toast(t("اكتب شيئاً أو أضف صورة", "Write something or add a photo"));
    try {
      const d = {
        uid: state.me.uid,
        name: state.prof.name,
        photo: state.prof.photo || "",
        t: text,
        ts: Date.now(),
        ver: !!state.prof.verified
      };
      if (file) {
        d.media = await uploadMedia(file, "posts");
        d.type = "image";
      }
      await addDoc(collection(db, "posts"), d);
      document.getElementById("post-text").value = "";
      file = null;
      if (fileInput) fileInput.value = "";
      const prev = document.getElementById("post-preview");
      if (prev) prev.textContent = "";
      toast(t("تم النشر", "Published"));
    } catch (e) {
      toast(e.message || "Error");
    }
  });
}

export async function toggleLike(pid, btn) {
  if (!state.me?.uid || state.me.uid === "__guest__") return toast(t("سجّل أولاً", "Sign in first"));
  if (btn) {
    btn.classList.remove("tap-pop");
    void btn.offsetWidth;
    btn.classList.add("tap-pop");
  }
  const existing = state.likes.find((l) => l.pid === pid && l.uid === state.me.uid);
  if (existing) {
    await deleteDoc(doc(db, "likes", existing.id));
  } else {
    await addDoc(collection(db, "likes"), { pid, uid: state.me.uid, ts: Date.now() });
  }
}


export async function openPostMenu(pid, uid) {
  const { showSheet, confirmDialog, promptDialog } = await import("./ui.js");
  const post = state.posts.find((p) => p.id === pid);
  const mine = state.me && uid === state.me.uid;
  const items = [];
  if (mine) {
    items.push({ id: "edit", label: t("تعديل المنشور", "Edit post") });
    items.push({ id: "delete", label: t("حذف المنشور", "Delete post"), danger: true });
    items.push({ id: "pin", label: t("تثبيت المنشور", "Pin post") });
  }
  items.push({ id: "copy", label: t("نسخ الرابط", "Copy link") });
  if (!mine) items.push({ id: "report", label: t("إبلاغ", "Report"), danger: true });

  const html = `<h3 style="margin:0 0 12px">${t("خيارات المنشور", "Post options")}</h3>` +
    items.map((it) => `<button type="button" class="btn ${it.danger ? "danger" : "alt"}" style="width:100%;margin-bottom:8px" data-m="${it.id}">${it.label}</button>`).join("") +
    `<button type="button" class="btn ghost" style="width:100%" data-close>${t("إغلاق", "Close")}</button>`;
  const { el, close } = showSheet(html);
  el.querySelectorAll("[data-m]").forEach((b) => {
    b.onclick = async () => {
      const a = b.dataset.m;
      close();
      if (a === "copy") {
        const url = location.origin + "/?post=" + encodeURIComponent(pid);
        try { await navigator.clipboard.writeText(url); } catch (_) {}
        toast(t("تم نسخ الرابط", "Link copied"));
      } else if (a === "delete" && mine) {
        if (!(await confirmDialog(t("حذف هذا المنشور؟", "Delete this post?")))) return;
        await deleteDoc(doc(db, "posts", pid));
        state.posts = state.posts.filter((p) => p.id !== pid);
        toast(t("تم الحذف", "Deleted"));
        window.dispatchEvent(new CustomEvent("hh:data", { detail: "posts" }));
      } else if (a === "edit" && mine) {
        const text = await promptDialog(t("نص المنشور", "Post text"), post?.t || "");
        if (text == null) return;
        const { updateDoc } = await import("./firebase.js");
        await updateDoc(doc(db, "posts", pid), { t: String(text).slice(0, 5000) });
        if (post) post.t = text;
        toast(t("تم التعديل", "Updated"));
        window.dispatchEvent(new CustomEvent("hh:data", { detail: "posts" }));
      } else if (a === "pin") {
        toast(t("التثبيت قريباً", "Pin coming soon"));
      } else if (a === "report") {
        const reason = await promptDialog(t("سبب البلاغ", "Report reason"), "");
        if (reason == null) return;
        await addDoc(collection(db, "reports"), {
          kind: "post", target: pid, reason: String(reason).slice(0, 400),
          uid: state.me.uid, ts: Date.now()
        });
        toast(t("تم إرسال البلاغ", "Report sent"));
      }
    };
  });
}
