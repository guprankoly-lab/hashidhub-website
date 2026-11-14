import { db, doc, getDoc, updateDoc, collection, onSnapshot, query, where, limit } from "./firebase.js";
import { state, t, toast, esc, DEF_AV } from "./state.js";

export const CREATOR_TYPES = [
  { id: "creator", label: "Creator", ico: "✨" },
  { id: "influencer", label: "Influencer", ico: "📣" },
  { id: "developer", label: "Developer", ico: "💻" },
  { id: "designer", label: "Designer", ico: "🎨" },
  { id: "business", label: "Business", ico: "💼" }
];

export function activityPoints(uid) {
  const p = state.posts.filter((x) => x.uid === uid).length;
  const r = state.reels.filter((x) => x.uid === uid).length;
  const f = state.follows.filter((x) => x.b === uid).length;
  return p * 5 + r * 8 + f * 2 + Number(state.prof?.bonusPoints || 0);
}

export function achievementsFor(uid, data) {
  const followers = state.follows.filter((x) => x.b === uid).length;
  const reelsN = state.reels.filter((x) => x.uid === uid).length;
  const pts = activityPoints(uid);
  return [
    { id: "f100", ico: "🏆", title: t("أول 100 متابع", "First 100 followers"), ok: followers >= 100 },
    { id: "r10", ico: "🎬", title: t("أول 10 ريلز", "First 10 reels"), ok: reelsN >= 10 },
    { id: "p1k", ico: "⭐", title: t("1000 نقطة نشاط", "1000 activity points"), ok: pts >= 1000 },
    { id: "crown", ico: "🔥", title: t("متصدر الأسبوع", "Weekly leader"), ok: !!data?.weekCrownClaimed }
  ];
}

export async function loadProfile(uid) {
  state.profileUid = uid;
  if (uid === state.me?.uid && state.prof) {
    state.profileData = state.prof;
    return state.prof;
  }
  const snap = await getDoc(doc(db, "users", uid));
  state.profileData = snap.exists() ? Object.assign({ id: uid }, snap.data()) : { id: uid, name: t("عضو", "Member") };
  return state.profileData;
}

export function profileHtml(uid, data) {
  data = data || {};
  const mine = uid === state.me?.uid;
  const followers = state.follows.filter((x) => x.b === uid).length;
  const following = state.follows.filter((x) => x.a === uid).length;
  const pts = activityPoints(uid);
  const reach = followers * 3 + state.posts.filter((x) => x.uid === uid).length * 10;
  const creator = CREATOR_TYPES.find((c) => c.id === data.creatorType);
  const ach = achievementsFor(uid, data);
  const tab = window.__profTab || "posts";

  let h = `<div class="card profile-card">
    <div class="profile-banner">${data.cover ? `<img src="${esc(data.cover)}" alt="">` : ""}</div>
    <div class="profile-main">
      <div class="profile-photo-row">
        <img class="av xl" src="${esc(data.photo || DEF_AV)}" alt="">
        ${mine ? `<button class="btn alt sm" data-act="edit-profile">${t("تعديل", "Edit")}</button>` : ""}
      </div>
      <div class="profile-name">
        ${esc(data.name || t("عضو", "Member"))}
        ${data.verified ? `<span class="badge-verified" title="Verified">✓</span>` : ""}
        ${creator ? `<span class="badge-creator">${creator.ico} ${creator.label}</span>` : ""}
      </div>
      <div class="profile-bio">${esc(data.bio || t("لا توجد نبذة.", "No bio yet."))}</div>
      <div class="profile-meta">
        ${data.location ? `<span>📍 ${esc(data.location)}</span>` : ""}
        ${data.website ? `<a href="${esc(data.website)}" target="_blank" rel="noopener">🔗 ${t("الموقع", "Website")}</a>` : ""}
      </div>
      <div class="profile-stats">
        <div><b>${followers}</b><span>${t("متابعون", "Followers")}</span></div>
        <div><b>${following}</b><span>${t("يتابع", "Following")}</span></div>
        <div><b>${reach}</b><span>${t("وصول", "Reach")}</span></div>
        <div><b>${pts}</b><span>${t("نقاط", "Points")}</span></div>
      </div>
      ${
        mine
          ? ""
          : `<div class="profile-cta">
        <button class="btn" data-act="follow" data-u="${esc(uid)}">${t("متابعة", "Follow")}</button>
        <button class="btn alt" data-act="message" data-u="${esc(uid)}">${t("رسالة", "Message")}</button>
        <button class="btn secondary" data-act="connect" data-u="${esc(uid)}">${t("تواصل", "Connect")}</button>
      </div>`
      }
    </div>
  </div>`;

  h += `<div class="profile-tabs">
    <button class="${tab === "posts" ? "on" : ""}" data-act="prof-tab" data-v="posts">${t("منشورات", "Posts")}</button>
    <button class="${tab === "reels" ? "on" : ""}" data-act="prof-tab" data-v="reels">${t("ريلز", "Reels")}</button>
    <button class="${tab === "about" ? "on" : ""}" data-act="prof-tab" data-v="about">${t("حول", "About")}</button>
    <button class="${tab === "portfolio" ? "on" : ""}" data-act="prof-tab" data-v="portfolio">${t("أعمال", "Portfolio")}</button>
    <button class="${tab === "achievements" ? "on" : ""}" data-act="prof-tab" data-v="achievements">${t("إنجازات", "Achievements")}</button>
    <button class="${tab === "pages" ? "on" : ""}" data-act="prof-tab" data-v="pages">📄 ${t("صفحات", "Pages")}</button>
  </div>`;

  if (tab === "achievements") {
    h += `<div class="achievements">`;
    ach.forEach((a) => {
      h += `<div class="ach-card ${a.ok ? "" : "locked"}"><div class="ico">${a.ico}</div><b>${esc(a.title)}</b></div>`;
    });
    h += `</div>`;
  } else if (tab === "about") {
    h += `<div class="card"><h3>${t("نوع المبدع", "Creator type")}</h3>
      <div class="creator-types">`;
    CREATOR_TYPES.forEach((c) => {
      h += `<button class="${data.creatorType === c.id ? "on" : ""}" data-act="set-creator" data-v="${c.id}" ${mine ? "" : "disabled"}>${c.ico} ${c.label}</button>`;
    });
    h += `</div></div>`;
  } else if (tab === "reels") {
    const rs = state.reels.filter((r) => r.uid === uid);
    h += rs.length
      ? rs
          .map(
            (r) =>
              `<div class="card"><b>${esc(r.caption || "Reel")}</b><div class="note">${r.views || 0} views</div></div>`
          )
          .join("")
      : `<div class="empty"><p>${t("لا ريلز", "No reels")}</p></div>`;
  } else if (tab === "portfolio") {
    h += `<div class="empty"><div class="ico">📁</div><p>${t("أضف أعمالك قريباً", "Portfolio coming soon")}</p></div>`;
  } else if (tab === "pages") {
    h += `<div data-pages-slot></div>`;
  } else {
    const ps = state.posts.filter((p) => p.uid === uid);
    h += ps.length
      ? ps
          .map(
            (p) =>
              `<div class="card"><div class="note">${esc(p.t || "").slice(0, 180)}</div></div>`
          )
          .join("")
      : `<div class="empty"><p>${t("لا منشورات", "No posts")}</p></div>`;
  }
  return h;
}

export async function setCreatorType(type) {
  if (!state.me?.uid) return;
  await updateDoc(doc(db, "users", state.me.uid), { creatorType: type });
  state.prof.creatorType = type;
  toast(t("تم تحديث شارة المبدع", "Creator badge updated"));
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "profile" }));
}

export function listenFollows() {
  const unsub = onSnapshot(collection(db, "follows"), (snap) => {
    state.follows = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    window.dispatchEvent(new CustomEvent("hh:data", { detail: "follows" }));
  });
  state.unsubs.push(unsub);
}
