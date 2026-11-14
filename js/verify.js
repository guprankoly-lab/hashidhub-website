import {
  db,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc
} from "./firebase.js";
import { state, t, toast, esc } from "./state.js";
import {
  VERIFY_FOLLOWERS_NEED,
  VERIFY_POSTS_NEED,
  VERIFY_INSTANT_POINTS,
  countFollowers,
  countContent,
  totalPoints
} from "./gamification.js";

state.verifyRequests = state.verifyRequests || [];

export function listenVerifyRequests() {
  const unsub = onSnapshot(
    collection(db, "verifyRequests"),
    (snap) => {
      state.verifyRequests = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      if (state.tab === "verification" || state.tab === "admin") {
        window.dispatchEvent(new CustomEvent("hh:data", { detail: "verify" }));
      }
    },
    (err) => console.warn("[verify]", err?.code)
  );
  state.unsubs.push(unsub);
}

export function verificationStats(uid) {
  const followers = countFollowers(uid);
  const content = countContent(uid);
  const points = totalPoints(uid);
  const eligible = followers >= VERIFY_FOLLOWERS_NEED && content >= VERIFY_POSTS_NEED;
  return { followers, content, points, eligible };
}

export function verificationHtml() {
  if (state.isGuest || !state.me) {
    return `<div class="empty"><div class="ico">✅</div><h3>${t("التوثيق", "Verification")}</h3>
      <p>${t("سجّل الدخول لطلب التوثيق.", "Sign in to request verification.")}</p>
      <button class="btn" data-act="goto-auth">${t("دخول", "Sign in")}</button></div>`;
  }
  if (state.prof?.verified) {
    return `<div class="empty"><div class="ico">✅</div><h3>${t("حسابك موثّق", "You're verified")}</h3>
      <p>${t("ظهرت الشارة بجانب اسمك.", "The badge appears next to your name.")}</p></div>`;
  }

  const st = verificationStats(state.me.uid);
  const pending = (state.verifyRequests || []).some(
    (r) => r.uid === state.me.uid && r.status === "pending"
  );
  const fPct = Math.min(100, Math.round((st.followers / VERIFY_FOLLOWERS_NEED) * 100));
  const cPct = Math.min(100, Math.round((st.content / VERIFY_POSTS_NEED) * 100));
  const pPct = Math.min(100, Math.round((st.points / VERIFY_INSTANT_POINTS) * 100));

  let h = `<h2 style="margin:0 0 8px">✅ ${t("التوثيق", "Verification")}</h2>
    <p class="note">${t("شارة موثّقة تزيد الثقة وتفتح فرص الظهور.", "A verified badge builds trust and visibility.")}</p>
    <div class="card">
      <h3 style="margin:0 0 10px">${t("تقدمك", "Your progress")}</h3>
      <div style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><b>${t("متابعون", "Followers")}</b><span class="note">${st.followers}/${VERIFY_FOLLOWERS_NEED}</span></div>
        <div style="height:8px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${fPct}%;background:var(--secondary)"></i></div></div>
      <div style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><b>${t("منشورات + ريلز", "Posts + Reels")}</b><span class="note">${st.content}/${VERIFY_POSTS_NEED}</span></div>
        <div style="height:8px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${cPct}%;background:#a78bfa"></i></div></div>
      <div><div class="row" style="justify-content:space-between"><b>${t("نقاط", "Points")}</b><span class="note">${st.points}/${VERIFY_INSTANT_POINTS}</span></div>
        <div style="height:8px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${pPct}%;background:var(--accent)"></i></div></div>
      ${
        st.eligible
          ? `<p class="note" style="margin-top:12px;color:var(--brand);font-weight:700">✨ ${t("مؤهل للمكافأة المجانية", "Eligible for free reward track")}</p>`
          : `<p class="note" style="margin-top:12px">${t("واصل النشر وجمع المتابعين.", "Keep posting and growing.")}</p>`
      }
    </div>`;

  h += `<div class="plat-grid" style="margin-top:12px">
    <article class="plat-card" style="padding:14px;border-color:${st.eligible ? "var(--brand)" : "var(--line)"}">
      <span class="chip brand">🎁 ${t("مجاني", "Free")}</span>
      <h3 style="margin:8px 0">${t("طلب توثيق كمكافأة", "Reward verification")}</h3>
      <p class="note">${t("يُفتح عند", "Unlocks at")} ${VERIFY_FOLLOWERS_NEED} ${t("متابع و", "followers &")} ${VERIFY_POSTS_NEED} ${t("محتوى. يراجعه الفريق.", "content. Team reviews.")}</p>`;
  if (pending) {
    h += `<button class="btn alt" disabled>${t("طلب معلّق", "Pending request")}</button>`;
  } else if (st.eligible || state.prof?.verificationEligible) {
    h += `<button class="btn" data-act="verify-free">${t("طلب التوثيق مجاناً", "Request free verification")}</button>`;
  } else {
    h += `<button class="btn alt" disabled>${t("الشروط غير مكتملة", "Requirements not met")}</button>`;
  }
  h += `</article>
    <article class="plat-card" style="padding:14px;border-color:var(--accent)">
      <span class="chip gold">⚡ ${t("فوري", "Instant")}</span>
      <h3 style="margin:8px 0">${t("توثيق فوري (نقاط)", "Instant (points)")}</h3>
      <p class="note">${t("يتطلب", "Needs")} ${VERIFY_INSTANT_POINTS} ${t("نقطة. أولوية أعلى. الدفع لاحقاً.", "points. Higher priority. Payments later.")}</p>`;
  if (pending) {
    h += `<button class="btn alt" disabled>${t("طلب معلّق", "Pending request")}</button>`;
  } else if (st.points >= VERIFY_INSTANT_POINTS) {
    h += `<button class="btn" data-act="verify-instant">${t("طلب فوري", "Request instant")}</button>`;
  } else {
    h += `<button class="btn alt" disabled>${st.points}/${VERIFY_INSTANT_POINTS} ${t("نقطة", "pts")}</button>`;
  }
  h += `</article></div>`;

  const mine = (state.verifyRequests || [])
    .filter((r) => r.uid === state.me.uid)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 6);
  if (mine.length) {
    h += `<div class="card" style="margin-top:12px"><h3 style="margin:0 0 8px">${t("طلباتك", "Your requests")}</h3>`;
    mine.forEach((r) => {
      h += `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
        <span>${r.priority === "instant" ? "⚡" : "🎁"} ${esc(r.status)}</span>
        <span class="note">${new Date(r.ts || 0).toLocaleDateString()}</span>
      </div>`;
    });
    h += `</div>`;
  }
  return h;
}

export async function requestVerify(track) {
  if (!state.me?.uid) return;
  const st = verificationStats(state.me.uid);
  if ((state.verifyRequests || []).some((r) => r.uid === state.me.uid && r.status === "pending")) {
    return toast(t("لديك طلب معلّق", "You already have a pending request"));
  }
  if (track === "free" && !(st.eligible || state.prof?.verificationEligible)) {
    return toast(t("الشروط غير مكتملة", "Requirements not met"));
  }
  if (track === "instant" && st.points < VERIFY_INSTANT_POINTS) {
    return toast(t("نقاط غير كافية", "Not enough points"));
  }
  const payload = {
    uid: state.me.uid,
    name: state.prof?.name || "",
    photo: state.prof?.photo || "",
    status: "pending",
    priority: track === "instant" ? "instant" : "reward",
    track: track === "instant" ? "instant" : "reward",
    stats: { followers: st.followers, content: st.content, points: st.points },
    ts: Date.now()
  };
  await addDoc(collection(db, "verifyRequests"), payload);
  if (track === "free") {
    try {
      await updateDoc(doc(db, "users", state.me.uid), { verificationEligible: true });
      state.prof.verificationEligible = true;
    } catch (_) {}
  }
  toast(t("تم إرسال الطلب", "Request submitted"));
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "verify" }));
}
