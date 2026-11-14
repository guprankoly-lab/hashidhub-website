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
      return `<article class="post" data-id="${esc(p.id)}">
        <div class="post-head">
          <img class="av" src="${esc(p.photo || DEF_AV)}" alt="">
          <div style="flex:1">
            <div class="name">${esc(p.name || t("عضو", "Member"))}${p.ver ? " ✓" : ""}</div>
            <div class="time">${ago(p.ts)}</div>
          </div>
        </div>
        <div class="post-body">${esc(p.t || p.text || "")}</div>
        ${
          p.media
            ? p.type === "video"
              ? `<div class="post-media"><video src="${esc(p.media)}" controls playsinline></video></div>`
              : `<div class="post-media"><img src="${esc(p.media)}" alt="" loading="lazy"></div>`
            : ""
        }
        <div class="post-actions">
          <button class="btn alt sm" data-act="like-post" data-id="${esc(p.id)}">${liked ? "❤️" : "🤍"} ${lc}</button>
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

export async function toggleLike(pid) {
  if (!state.me?.uid || state.me.uid === "__guest__") return toast(t("سجّل أولاً", "Sign in first"));
  const existing = state.likes.find((l) => l.pid === pid && l.uid === state.me.uid);
  if (existing) {
    await deleteDoc(doc(db, "likes", existing.id));
  } else {
    await addDoc(collection(db, "likes"), { pid, uid: state.me.uid, ts: Date.now() });
  }
}
