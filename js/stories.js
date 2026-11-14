import {
  db,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  uploadMedia
} from "./firebase.js";
import { state, t, toast, esc, DEF_AV, ago } from "./state.js";

/** Keep local optimistic stories until server confirms */
const localStories = new Map();

export function listenStories() {
  const q = query(collection(db, "stories"), orderBy("ts", "desc"), limit(80));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const byId = new Map();
      localStories.forEach((s, id) => byId.set(id, s));
      snap.docs.forEach((d) => {
        const x = Object.assign({ id: d.id }, d.data());
        const exp = Number(x.exp) || (Number(x.ts) ? Number(x.ts) + 86400000 : 0);
        if (exp && exp < now - 120000) {
          localStories.delete(d.id);
          return;
        }
        localStories.delete(d.id); // server has it
        byId.set(d.id, x);
      });
      state.stories = Array.from(byId.values()).sort(
        (a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0)
      );
      console.log("[stories] count", state.stories.length);
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "stories" }));
    },
    (err) => console.warn("[stories] listen", err?.code, err?.message)
  );
  state.unsubs.push(unsub);
}

export function storiesStripHtml() {
  const byUid = {};
  const order = [];
  state.stories.forEach((st) => {
    if (!st.uid) return;
    if (!byUid[st.uid]) {
      byUid[st.uid] = {
        uid: st.uid,
        name: st.name || "",
        photo: st.photo || "",
        media: st.media || "",
        ts: 0
      };
      order.push(byUid[st.uid]);
    }
    const g = byUid[st.uid];
    if ((st.ts || 0) >= g.ts) {
      g.ts = st.ts || 0;
      g.media = st.media || g.media;
      g.photo = st.photo || g.photo;
      g.name = st.name || g.name;
    }
  });
  order.sort((a, b) => b.ts - a.ts);

  let h = `<div class="stories">`;
  if (!state.isGuest && state.me?.uid && state.me.uid !== "__guest__") {
    h += `<button type="button" class="story-bubble" data-act="add-story">
      <div class="story-ring mine"><img src="${esc(state.prof?.photo || DEF_AV)}" alt=""><i class="story-add">+</i></div>
      <span>${t("أضف قصة", "Add story")}</span>
    </button>`;
  }
  order.forEach((g) => {
    let thumb = g.media || g.photo || DEF_AV;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(String(thumb))) thumb = g.photo || DEF_AV;
    const label = g.uid === state.me?.uid ? t("قصتك", "Your story") : g.name || t("عضو", "Member");
    h += `<button type="button" class="story-bubble" data-act="open-story" data-u="${esc(g.uid)}">
      <div class="story-ring"><img src="${esc(thumb)}" alt="" loading="lazy"></div>
      <span>${esc(label)}</span>
    </button>`;
  });
  h += `</div>`;
  if (!order.length && state.isGuest) return "";
  return h;
}

export async function publishStory(file, caption) {
  if (!state.me?.uid || state.me.uid === "__guest__") throw new Error("auth");
  const url = await uploadMedia(file, "stories");
  if (!url) throw new Error(t("رابط الوسائط فارغ", "Empty media URL"));
  const payload = {
    uid: state.me.uid,
    name: state.prof?.name || "",
    photo: state.prof?.photo || "",
    media: url,
    caption: String(caption || "").slice(0, 200),
    ts: Date.now(),
    exp: Date.now() + 24 * 3600 * 1000
  };
  console.log("[stories] publish", payload);
  const ref = await addDoc(collection(db, "stories"), payload);
  const local = Object.assign({ id: ref.id, _local: true }, payload);
  localStories.set(ref.id, local);
  state.stories = [local, ...state.stories.filter((s) => s.id !== ref.id)];
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "stories" }));
  toast(t("تم نشر القصة", "Story published"));
  return ref.id;
}

export function openStoryViewer(uid) {
  const list = state.stories
    .filter((s) => s.uid === uid)
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (!list.length) return toast(t("لا قصص", "No stories"));
  let i = 0;
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-in" style="background:#000;color:#fff;max-height:95vh">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <b>${esc(list[0].name || "")}</b>
      <button class="btn alt sm" data-close>✕</button>
    </div>
    <div id="story-stage" style="min-height:50vh;display:grid;place-items:center"></div>
    <div class="row" style="margin-top:10px">
      <button class="btn alt" id="st-prev">${t("السابق", "Prev")}</button>
      <button class="btn" id="st-next" style="flex:1">${t("التالي", "Next")}</button>
    </div>
  </div>`;
  document.body.appendChild(sheet);
  const stage = sheet.querySelector("#story-stage");
  const show = () => {
    const s = list[i];
    if (!s) {
      sheet.remove();
      return;
    }
    const media = s.media || "";
    if (/\.(mp4|webm|mov)(\?|$)/i.test(media)) {
      stage.innerHTML = `<video src="${esc(media)}" controls autoplay playsinline style="max-width:100%;max-height:70vh"></video>`;
    } else {
      stage.innerHTML = `<img src="${esc(media)}" alt="" style="max-width:100%;max-height:70vh;object-fit:contain">`;
    }
    if (s.caption) {
      stage.innerHTML += `<p class="note" style="color:#ddd;margin-top:8px">${esc(s.caption)}</p>`;
    }
  };
  show();
  sheet.querySelector("[data-close]").onclick = () => sheet.remove();
  sheet.querySelector("#st-prev").onclick = () => {
    i = Math.max(0, i - 1);
    show();
  };
  sheet.querySelector("#st-next").onclick = () => {
    i++;
    if (i >= list.length) sheet.remove();
    else show();
  };
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) sheet.remove();
  });
}
