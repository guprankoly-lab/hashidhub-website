/**
 * HashidHub Reels 3.0 — performance-first vertical player
 * - Direct media URL + browser Range (no Blob download)
 * - Preload: active + next only; skip on 2G / Save-Data
 * - DOM window capped (~120 around focus)
 * - Videos stay preload="none" until activated
 * - Double-tap like + reelLikes/{uid}_{rid}
 */
import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  uploadMedia
} from "./firebase.js";
import { state, t, toast, esc, DEF_AV, ago } from "./state.js";

const DOM_WINDOW = 120;
const PRELOAD_NEXT = true;

state.reelLikes = state.reelLikes || {};

function mediaOf(r) {
  return r.videoUrl || r.media || r.url || "";
}

export function canPreloadMedia() {
  try {
    if (navigator.connection) {
      const c = navigator.connection;
      if (c.saveData) return false;
      const et = String(c.effectiveType || "");
      if (et === "slow-2g" || et === "2g") return false;
    }
  } catch (_) {}
  return true;
}

export function listenReels() {
  const q = query(collection(db, "reels"), orderBy("ts", "desc"), limit(100));
  const unsub = onSnapshot(
    q,
    (snap) => {
      state.reels = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "reels" }));
    },
    (err) => console.warn("[reels]", err?.code, err?.message)
  );
  state.unsubs.push(unsub);

  if (state.me?.uid && state.me.uid !== "__guest__") {
    const uq = query(collection(db, "reelLikes"), where("uid", "==", state.me.uid), limit(300));
    const u2 = onSnapshot(
      uq,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.rid) map[data.rid] = true;
        });
        state.reelLikes = map;
      },
      () => {}
    );
    state.unsubs.push(u2);
  }
}

export function reelShelfHtml() {
  const list = state.reels.filter((r) => mediaOf(r)).slice(0, 12);
  let h = `<div class="row" style="justify-content:space-between;margin:4px 0 8px">
    <h3 style="margin:0">🎬 ${t("ريلز", "Reels")}</h3>
    <button class="btn alt sm" data-act="tab" data-t="reels">${t("الكل", "All")}</button>
  </div>`;
  if (!list.length) {
    h += `<div class="card note">${t("لا ريلز بعد — انشر أول ريل من تبويب الريلز.", "No reels yet — post from the Reels tab.")}</div>`;
    return h;
  }
  h += `<div class="reel-shelf">`;
  list.forEach((r) => {
    const cover = r.poster || r.photo || DEF_AV;
    h += `<button type="button" class="reel-tile" data-act="open-reel" data-id="${esc(r.id)}">
      <img src="${esc(cover)}" alt="" loading="lazy" decoding="async">
      <div class="play">▶</div>
      <div class="meta">${esc(r.name || "")}</div>
    </button>`;
  });
  h += `</div>`;
  return h;
}

export function reelsPageHtml() {
  const list = state.reels.filter((r) => mediaOf(r));
  let h = `<div class="row" style="justify-content:space-between;margin-bottom:12px">
    <h2 style="margin:0">🎬 ${t("ريلز", "Reels")}</h2>
    ${
      !state.isGuest
        ? `<button class="btn" data-act="add-reel">+ ${t("ريل جديد", "New reel")}</button>`
        : ""
    }
  </div>
  <p class="note" style="margin-top:0">${t("اضغط أي ريل للمشغل العمودي · نقر مزدوج للإعجاب", "Tap a reel for vertical player · Double-tap to like")}</p>`;
  if (!list.length) {
    return (
      h +
      `<div class="empty"><div class="ico">🎬</div><h3>${t("لا ريلز", "No reels")}</h3>
      <p>${t("ارفع فيديو قصيراً ليظهر هنا.", "Upload a short video to appear here.")}</p>
      ${!state.isGuest ? `<button class="btn" data-act="add-reel">${t("رفع ريل", "Upload reel")}</button>` : ""}</div>`
    );
  }
  h += `<div class="reel-grid">`;
  list.forEach((r) => {
    const cover = r.poster || r.photo || DEF_AV;
    const liked = !!state.reelLikes[r.id];
    h += `<button type="button" class="reel-tile tall" data-act="open-reel" data-id="${esc(r.id)}">
      <img src="${esc(cover)}" alt="" loading="lazy" decoding="async">
      <div class="play">▶</div>
      <div class="meta"><div>${esc(r.name || "")}</div>
        <div>${liked ? "❤️" : "🤍"} ${r.likes || 0} · 👁 ${r.views || 0}</div>
      </div>
    </button>`;
  });
  h += `</div>`;
  return h;
}

export async function publishReel(file, caption) {
  if (!state.me?.uid || state.me.uid === "__guest__") throw new Error("auth");
  const videoUrl = await uploadMedia(file, "reels");
  const payload = {
    uid: state.me.uid,
    name: state.prof?.name || "",
    photo: state.prof?.photo || "",
    ver: !!state.prof?.verified,
    videoUrl,
    poster: "",
    caption: String(caption || "").slice(0, 300),
    likes: 0,
    views: 0,
    comments: 0,
    ts: Date.now()
  };
  const ref = await addDoc(collection(db, "reels"), payload);
  state.reels = [Object.assign({ id: ref.id }, payload), ...state.reels];
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "reels" }));
  toast(t("تم نشر الريل", "Reel published"));
  return ref.id;
}

export async function toggleReelLike(rid) {
  if (!state.me?.uid || state.me.uid === "__guest__") {
    toast(t("سجّل أولاً", "Sign in first"));
    return;
  }
  if (!rid) return;
  const likeId = state.me.uid + "_" + rid;
  const liked = !!state.reelLikes[rid];
  try {
    if (liked) {
      await deleteDoc(doc(db, "reelLikes", likeId));
      state.reelLikes[rid] = false;
      const r = state.reels.find((x) => x.id === rid);
      if (r) r.likes = Math.max(0, (r.likes || 1) - 1);
    } else {
      await setDoc(doc(db, "reelLikes", likeId), {
        uid: state.me.uid,
        rid: rid,
        ts: Date.now()
      });
      state.reelLikes[rid] = true;
      const r = state.reels.find((x) => x.id === rid);
      if (r) r.likes = (r.likes || 0) + 1;
    }
  } catch (e) {
    toast(e.message || "Error");
  }
}

function showDoubleTapHeart(container) {
  const el = container.querySelector(".double-tap-heart");
  if (!el) return;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 600);
}

export function openReelPlayer(startId) {
  const all = state.reels.filter((r) => mediaOf(r));
  if (!all.length) return toast(t("لا ريلز", "No reels"));

  let index = Math.max(0, all.findIndex((r) => r.id === startId));
  if (index < 0) index = 0;

  const allowPreload = canPreloadMedia();
  const root = document.createElement("div");
  root.className = "reel-player-v";
  root.innerHTML = `
    <div class="rp-top">
      <button type="button" class="btn alt sm" data-rp="close">✕</button>
      <span class="note" style="color:#fff">${t("ريلز", "Reels")}</span>
      <span class="note" style="color:#aaa;font-size:.75rem">${allowPreload ? "" : "💾 " + t("توفير بيانات", "Data saver")}</span>
    </div>
    <div class="rp-scroller" id="rp-scroller"></div>`;
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";

  const scroller = root.querySelector("#rp-scroller");
  let lastTap = 0;
  let activeIndex = index;

  function windowSlice(focus) {
    const half = Math.floor(DOM_WINDOW / 2);
    let start = Math.max(0, focus - half);
    let end = Math.min(all.length, start + DOM_WINDOW);
    start = Math.max(0, end - DOM_WINDOW);
    return { start, end, items: all.slice(start, end) };
  }

  function releaseVideo(video) {
    if (!video) return;
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch (_) {}
  }

  function activate(i) {
    activeIndex = i;
    scroller.querySelectorAll(".rp-slide").forEach((slide) => {
      const vi = Number(slide.dataset.i);
      const video = slide.querySelector("video");
      if (!video) return;
      if (vi === i) {
        if (!video.getAttribute("src")) video.src = video.dataset.src;
        video.preload = "auto";
        video.play().catch(() => {});
      } else if (vi === i + 1 && allowPreload && PRELOAD_NEXT) {
        if (!video.getAttribute("src")) video.src = video.dataset.src;
        video.preload = "metadata";
        try {
          video.pause();
        } catch (_) {}
      } else {
        releaseVideo(video);
        video.preload = "none";
      }
    });
  }

  function buildWindow(focus) {
    const { start, items } = windowSlice(focus);
    scroller.innerHTML = "";
    items.forEach((r, local) => {
      const globalI = start + local;
      const src = mediaOf(r);
      const liked = !!state.reelLikes[r.id];
      const slide = document.createElement("div");
      slide.className = "rp-slide";
      slide.dataset.i = String(globalI);
      slide.dataset.id = r.id;
      slide.innerHTML = `
        <div class="rp-loading" data-load><div class="spinner"></div><div>${t("جاري تحميل الفيديو…","Loading video…")}</div></div>
        <video playsinline loop muted data-src="${esc(src)}" preload="none" poster="${esc(r.poster || "")}"></video>
        <div class="double-tap-heart">❤️</div>
        <div class="rp-overlay">
          <div class="rp-side">
            <button type="button" data-act-like="${esc(r.id)}">${liked ? "❤️" : "🤍"} ${r.likes || 0}</button>
            <button type="button" data-act-share="${esc(r.id)}">↗</button>
          </div>
          <div class="rp-info">
            <div class="row">
              <img class="av" src="${esc(r.photo || DEF_AV)}" alt="">
              <b>${esc(r.name || "")}</b>
            </div>
            <p>${esc(r.caption || "")}</p>
          </div>
        </div>`;
      const video = slide.querySelector("video");
      const loadEl = slide.querySelector("[data-load]");
      const hideLoad = () => { if (loadEl) loadEl.style.display = "none"; };
      video.addEventListener("loadstart", () => { if (loadEl) loadEl.style.display = "grid"; });
      video.addEventListener("canplay", hideLoad);
      video.addEventListener("playing", hideLoad);
      video.addEventListener("error", () => {
        if (loadEl) loadEl.innerHTML = "<div>" + t("تعذّر تشغيل الفيديو","Could not play video") + "</div>";
      });
      video.addEventListener(
        "play",
        () => {
          video.muted = false;
        },
        { once: true }
      );

      let tapTimer = null;
      slide.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const now = Date.now();
        if (now - lastTap < 280) {
          clearTimeout(tapTimer);
          lastTap = 0;
          showDoubleTapHeart(slide);
          toggleReelLike(r.id).then(() => {
            const btn = slide.querySelector("[data-act-like]");
            const rr = state.reels.find((x) => x.id === r.id) || r;
            if (btn) btn.textContent = (state.reelLikes[r.id] ? "❤️ " : "🤍 ") + (rr.likes || 0);
          });
        } else {
          lastTap = now;
          tapTimer = setTimeout(() => {
            if (video.paused) video.play().catch(() => {});
            else video.pause();
          }, 280);
        }
      });

      slide.querySelector("[data-act-like]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleReelLike(r.id).then(() => {
          const btn = slide.querySelector("[data-act-like]");
          const rr = state.reels.find((x) => x.id === r.id) || r;
          if (btn) btn.textContent = (state.reelLikes[r.id] ? "❤️ " : "🤍 ") + (rr.likes || 0);
        });
      });

      slide.querySelector("[data-act-share]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = location.origin + "/?reel=" + encodeURIComponent(r.id);
        if (navigator.share) navigator.share({ title: "HashidHub Reel", url }).catch(() => {});
        else {
          try {
            navigator.clipboard.writeText(url);
          } catch (_) {}
          toast(t("تم نسخ الرابط", "Link copied"));
        }
      });

      scroller.appendChild(slide);
    });

    requestAnimationFrame(() => {
      const target = scroller.querySelector('.rp-slide[data-i="' + focus + '"]');
      if (target) {
        target.scrollIntoView({ block: "center" });
        activate(focus);
      }
      scroller.querySelectorAll(".rp-slide").forEach((s) => io.observe(s));
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting || en.intersectionRatio < 0.6) return;
        const i = Number(en.target.dataset.i);
        if (!Number.isFinite(i)) return;
        if (i !== activeIndex) activate(i);
        const { start, end } = windowSlice(i);
        if ((i - start < 8 && start > 0) || (end - i < 8 && end < all.length)) {
          io.disconnect();
          buildWindow(i);
        }
      });
    },
    { root: scroller, threshold: [0.6] }
  );

  buildWindow(index);

  root.querySelector('[data-rp="close"]').onclick = () => {
    io.disconnect();
    scroller.querySelectorAll("video").forEach(releaseVideo);
    root.remove();
    document.body.style.overflow = "";
  };

  const onKey = (e) => {
    if (e.key === "Escape") root.querySelector('[data-rp="close"]')?.click();
  };
  document.addEventListener("keydown", onKey);
  const obs = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      document.removeEventListener("keydown", onKey);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true });
}
