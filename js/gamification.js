import { db, doc, updateDoc } from "./firebase.js";
import { state, t, toast, esc, dayKey, DEF_AV } from "./state.js";

export const VERIFY_FOLLOWERS_NEED = 50;
export const VERIFY_POSTS_NEED = 10;
export const VERIFY_INSTANT_POINTS = 500;

export const DAILY_QUESTS = [
  { id: "post3", title: "انشر 3 منشورات اليوم", titleEn: "Post 3 times today", target: 3, reward: 20, kind: "posts" },
  { id: "reel1", title: "انشر ريلاً واحداً", titleEn: "Post 1 reel", target: 1, reward: 15, kind: "reels" },
  { id: "react5", title: "تفاعل مع 5 منشورات", titleEn: "React to 5 posts", target: 5, reward: 10, kind: "likes" },
  { id: "chall1", title: "شارك في تحدي اليوم", titleEn: "Join today's challenge", target: 1, reward: 15, kind: "challenge" }
];

const CHALLENGES = [
  "صوّر شيئاً أخضر 🌿", "شاركنا أجمل غروب 🌅", "اكتب كلمة تشجيع 💬", "ما آخر أغنية سمعتها؟ 🎵",
  "صورة من مكانك المفضل 📍", "اقتباس يلهمك ✨", "ما أمنيتك لهذا الأسبوع؟ 🌠", "قل شكراً لشخص 💛"
];

export function todayChallenge() {
  const d = new Date();
  const i = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) % CHALLENGES.length;
  return CHALLENGES[i];
}

export function countFollowers(uid) {
  return (state.follows || []).filter((f) => f.b === uid).length;
}

export function countContent(uid) {
  const p = (state.posts || []).filter((x) => x.uid === uid).length;
  const r = (state.reels || []).filter((x) => x.uid === uid).length;
  return p + r;
}

export function activityPoints(uid) {
  const p = (state.posts || []).filter((x) => x.uid === uid).length;
  const r = (state.reels || []).filter((x) => x.uid === uid).length;
  const f = countFollowers(uid);
  return p * 5 + r * 8 + f * 2;
}

export function userBonus(uid) {
  if (state.me && uid === state.me.uid && state.prof) return Number(state.prof.bonusPoints || 0) || 0;
  const u = (state.users || []).find((x) => x.id === uid);
  return u ? Number(u.bonusPoints || 0) || 0 : 0;
}

export function totalPoints(uid) {
  return activityPoints(uid) + userBonus(uid);
}

function weekStartMs() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - diff);
  s.setHours(0, 0, 0, 0);
  return s.getTime();
}

export function weekKey() {
  const s = new Date(weekStartMs());
  return s.getFullYear() + "-W" + dayKey(s);
}

function inWeek(ts) {
  return (Number(ts) || 0) >= weekStartMs();
}

export function weeklyPoints(uid) {
  const wp = (state.posts || []).filter((x) => x.uid === uid && inWeek(x.ts)).length * 5;
  const wr = (state.reels || []).filter((x) => x.uid === uid && inWeek(x.ts)).length * 8;
  const wl = (state.likes || []).filter((x) => x.uid === uid && inWeek(x.ts)).length * 2;
  let extra = 0;
  if (state.me && uid === state.me.uid && state.prof?.weeklyBonusWeek === weekKey()) {
    extra = Number(state.prof.weeklyBonus || 0) || 0;
  } else {
    const u = (state.users || []).find((x) => x.id === uid);
    if (u && u.weeklyBonusWeek === weekKey()) extra = Number(u.weeklyBonus || 0) || 0;
  }
  return wp + wr + wl + extra;
}

export function buildWeeklyLeaderboard(limit) {
  limit = limit || 20;
  const ids = {};
  (state.posts || []).forEach((p) => { if (p.uid && inWeek(p.ts)) ids[p.uid] = 1; });
  (state.reels || []).forEach((r) => { if (r.uid && inWeek(r.ts)) ids[r.uid] = 1; });
  (state.likes || []).forEach((l) => { if (l.uid && inWeek(l.ts)) ids[l.uid] = 1; });
  (state.users || []).forEach((u) => { if (u?.id) ids[u.id] = 1; });
  if (state.me) ids[state.me.uid] = 1;
  return Object.keys(ids)
    .map((uid) => {
      const u = (state.users || []).find((x) => x.id === uid) || {};
      const name = state.me && uid === state.me.uid ? state.prof?.name || u.name : u.name;
      const photo = state.me && uid === state.me.uid ? state.prof?.photo || u.photo : u.photo;
      return {
        uid,
        name: name || t("عضو", "Member"),
        photo: photo || "",
        points: weeklyPoints(uid),
        verified: !!(u.verified || (state.prof && uid === state.me?.uid && state.prof.verified))
      };
    })
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

function todayCount(kind, uid) {
  const today = dayKey();
  if (kind === "posts")
    return (state.posts || []).filter((x) => x.uid === uid && dayKey(new Date(x.ts || 0)) === today).length;
  if (kind === "reels")
    return (state.reels || []).filter((x) => x.uid === uid && dayKey(new Date(x.ts || 0)) === today).length;
  if (kind === "likes")
    return (state.likes || []).filter((x) => x.uid === uid && dayKey(new Date(x.ts || 0)) === today).length;
  if (kind === "challenge") {
    const tag = "#تحدي_اليوم";
    return (state.posts || []).filter(
      (x) => x.uid === uid && String(x.t || "").indexOf(tag) > -1 && dayKey(new Date(x.ts || 0)) === today
    ).length;
  }
  return 0;
}

export function questProgress(q, uid) {
  return todayCount(q.kind, uid);
}

export function claimedToday() {
  const map = (state.prof && state.prof.claimedQuests) || {};
  const arr = map[dayKey()] || [];
  return Array.isArray(arr) ? arr : [];
}

export function pointsCardHtml() {
  if (state.isGuest || !state.me) return "";
  const pts = totalPoints(state.me.uid);
  const need = VERIFY_INSTANT_POINTS;
  const pct = Math.min(100, Math.round((pts / need) * 100));
  const left = Math.max(0, need - pts);
  return `<div class="card" style="background:linear-gradient(145deg,rgba(0,184,148,.12),rgba(253,203,110,.1))">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div class="note">${t("نقاطك", "Your points")}</div>
        <div style="font-size:2rem;font-weight:900;color:var(--brand)">${pts}</div>
        <div class="note">${t("أساسي", "Base")} ${activityPoints(state.me.uid)} · ${t("مكافآت", "Bonus")} ${userBonus(state.me.uid)}</div>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn alt sm" data-act="tab" data-t="verification">✓ ${t("توثيق", "Verify")}</button>
        <button class="btn alt sm" data-act="tab" data-t="leaderboard">🏆</button>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="row" style="justify-content:space-between"><b style="font-size:.9rem">${t("نحو التوثيق الفوري", "Toward instant verify")}</b><span class="note">${pts}/${need}</span></div>
      <div style="height:10px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:6px">
        <i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--brand),var(--accent))"></i>
      </div>
      <div class="note" style="margin-top:6px">${left > 0 ? t("يتبقى", "Remaining") + " " + left + " " + t("نقطة", "pts") : "✨ " + t("جاهز للتوثيق الفوري", "Ready for instant verification")}</div>
    </div>
  </div>`;
}

export function dailyQuestsHtml() {
  if (state.isGuest || !state.me) return "";
  const claimed = claimedToday();
  let h = `<div class="card">
    <h3 style="margin:0 0 6px">🎯 ${t("تحديات يومية", "Daily challenges")}</h3>
    <p class="note" style="margin:0 0 10px">${t("تحدي اليوم:", "Today's challenge:")} <b>${esc(todayChallenge())}</b></p>`;
  DAILY_QUESTS.forEach((q) => {
    const cur = questProgress(q, state.me.uid);
    const done = cur >= q.target;
    const got = claimed.indexOf(q.id) >= 0;
    const pct = Math.min(100, Math.round((cur / q.target) * 100));
    const title = state.lang === "en" ? q.titleEn : q.title;
    h += `<div style="padding:10px 0;border-top:1px solid var(--line)">
      <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div style="flex:1"><b>${esc(title)}</b><div class="note">${Math.min(cur, q.target)}/${q.target} · +${q.reward}</div></div>
        ${got ? `<span class="chip brand">✓</span>` : done ? `<button class="btn sm" data-act="claim-quest" data-id="${q.id}" data-reward="${q.reward}">+${q.reward} ⭐</button>` : `<span class="chip">${pct}%</span>`}
      </div>
      <div style="height:6px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:8px">
        <i style="display:block;height:100%;width:${pct}%;background:var(--secondary)"></i>
      </div>
    </div>`;
  });
  h += `</div>`;
  return h;
}

export async function claimQuest(id, reward) {
  const q = DAILY_QUESTS.find((x) => x.id === id);
  if (!q || !state.me) return;
  if (claimedToday().indexOf(id) >= 0) return toast(t("استلمت اليوم", "Already claimed today"));
  if (questProgress(q, state.me.uid) < q.target) return toast(t("لم يكتمل بعد", "Not completed yet"));
  const today = dayKey();
  const map = Object.assign({}, state.prof.claimedQuests || {});
  const arr = Array.isArray(map[today]) ? map[today].slice() : [];
  arr.push(id);
  map[today] = arr;
  const add = Number(reward) || q.reward;
  const bonus = (Number(state.prof.bonusPoints) || 0) + add;
  const wk = weekKey();
  const wb = (state.prof.weeklyBonusWeek === wk ? Number(state.prof.weeklyBonus) || 0 : 0) + add;
  await updateDoc(doc(db, "users", state.me.uid), {
    bonusPoints: bonus,
    claimedQuests: map,
    weeklyBonus: wb,
    weeklyBonusWeek: wk
  });
  state.prof.bonusPoints = bonus;
  state.prof.claimedQuests = map;
  state.prof.weeklyBonus = wb;
  state.prof.weeklyBonusWeek = wk;
  toast("+" + add + " ⭐");
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "points" }));
}

export function leaderboardHtml() {
  const board = buildWeeklyLeaderboard(20);
  const wk = weekKey();
  let myRank = -1;
  const myPts = state.me ? weeklyPoints(state.me.uid) : 0;
  board.forEach((row, i) => {
    if (state.me && row.uid === state.me.uid) myRank = i;
  });
  const top1 = board[0];
  const canClaim =
    state.me &&
    top1 &&
    top1.uid === state.me.uid &&
    myPts > 0 &&
    state.prof?.weekCrownClaimed !== wk;

  let h = `<h2 style="margin:0 0 8px">🏆 ${t("متصدرون الأسبوع", "Weekly leaderboard")}</h2>
    <div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div><b>${t("الأسبوع", "Week")}</b><div class="note">${esc(wk)}</div></div>
      ${state.me ? `<div class="note">${t("ترتيبك", "Your rank")}: <b>${myRank >= 0 ? myRank + 1 : "—"}</b> · ${myPts} ⭐</div>` : ""}
    </div></div>`;

  if (canClaim) {
    h += `<div class="card" style="border-color:var(--accent)">
      <b>👑 ${t("أنت الأول!", "You're #1!")}</b>
      <p class="note">${t("استلم +50 نقطة وشارة التاج.", "Claim +50 pts and the crown badge.")}</p>
      <button class="btn" data-act="claim-crown">👑 ${t("استلام", "Claim")}</button>
    </div>`;
  }

  if (!board.length) {
    return h + `<div class="empty"><div class="ico">🏁</div><p>${t("لا نشاط بعد هذا الأسبوع", "No weekly activity yet")}</p></div>`;
  }

  h += `<div class="card" style="padding:8px">`;
  board.forEach((row, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
    const isMe = state.me && row.uid === state.me.uid;
    h += `<div class="row" style="padding:10px 6px;border-bottom:1px solid var(--line);${isMe ? "background:rgba(0,184,148,.08);border-radius:12px" : ""}">
      <div style="width:32px;text-align:center;font-weight:800">${medal}</div>
      <img class="av" src="${esc(row.photo || DEF_AV)}" alt="">
      <button class="name" data-act="open-profile" data-u="${esc(row.uid)}" style="flex:1;text-align:start;font-weight:700">${esc(row.name)}${row.verified ? " ✓" : ""}${isMe ? ` <span class="chip brand">${t("أنت", "You")}</span>` : ""}</button>
      <b style="color:var(--brand)">${row.points} ⭐</b>
    </div>`;
  });
  h += `</div>
    <p class="note">${t("منشورات×5 + ريلز×8 + تفاعلات×2 + مكافآت الأسبوع", "Posts×5 + Reels×8 + Reactions×2 + week bonuses")}</p>`;
  return h;
}

export async function claimWeekCrown() {
  const board = buildWeeklyLeaderboard(1);
  if (!board[0] || board[0].uid !== state.me.uid) return toast(t("لست الأول", "Not #1"));
  const wk = weekKey();
  if (state.prof.weekCrownClaimed === wk) return toast(t("استلمت مسبقاً", "Already claimed"));
  const bonus = (Number(state.prof.bonusPoints) || 0) + 50;
  const wb = (Number(state.prof.weeklyBonus) || 0) + 50;
  await updateDoc(doc(db, "users", state.me.uid), {
    bonusPoints: bonus,
    weeklyBonus: wb,
    weeklyBonusWeek: wk,
    weekCrownClaimed: wk,
    weekCrownAt: Date.now()
  });
  Object.assign(state.prof, {
    bonusPoints: bonus,
    weeklyBonus: wb,
    weeklyBonusWeek: wk,
    weekCrownClaimed: wk
  });
  toast("👑 +50");
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "leaderboard" }));
}
