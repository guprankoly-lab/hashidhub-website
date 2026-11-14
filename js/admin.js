import {
  db,
  doc,
  updateDoc,
  addDoc,
  collection
} from "./firebase.js";
import { state, t, toast, esc, ago } from "./state.js";
import { weekKey } from "./gamification.js";
import { verificationStats } from "./verify.js";

state.adminTab = state.adminTab || "home";
state.adminVerifyFilter = state.adminVerifyFilter || "all";

async function notify(to, type, extra) {
  if (!to || to === state.me?.uid) return;
  try {
    await addDoc(collection(db, "notifs"), {
      to,
      from: state.me.uid,
      name: state.prof?.name || "Admin",
      type,
      ts: Date.now(),
      ...(extra || {})
    });
  } catch (_) {}
}

export function adminHtml() {
  if (!state.isAdmin) {
    return `<div class="empty"><div class="ico">🔒</div><h3>${t("للإدارة فقط", "Admins only")}</h3></div>`;
  }
  const tabs = [
    ["home", "📊", t("الرئيسية", "Home")],
    ["verify", "✅", t("التوثيق", "Verify")],
    ["users", "👤", t("أعضاء", "Users")],
    ["reports", "🚩", t("بلاغات", "Reports")]
  ];
  let h = `<h2 style="margin:0 0 10px">🛠️ ${t("لوحة الإدارة", "Admin")}</h2>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">`;
  tabs.forEach(([id, ico, label]) => {
    h += `<button class="chip ${state.adminTab === id ? "brand" : ""}" data-act="admin-tab" data-v="${id}">${ico} ${label}</button>`;
  });
  h += `</div>`;

  if (state.adminTab === "verify") return h + adminVerifyPanel();
  if (state.adminTab === "users") return h + adminUsersPanel();
  if (state.adminTab === "reports") {
    return h + `<div class="card"><p class="note">${t("البلاغات تُدار من الإصدار السابق مؤقتاً أو تُنقل لاحقاً.", "Reports panel can be expanded next.")}</p></div>`;
  }

  const pending = (state.verifyRequests || []).filter((r) => r.status === "pending").length;
  const usersN = (state.users || []).length;
  const postsN = (state.posts || []).length;
  return (
    h +
    `<div class="grid-3" style="margin-bottom:12px">
      <div class="card"><b>${pending}</b><div class="note">${t("طلبات توثيق", "Verify requests")}</div></div>
      <div class="card"><b>${usersN}</b><div class="note">${t("أعضاء", "Users")}</div></div>
      <div class="card"><b>${postsN}</b><div class="note">${t("منشورات", "Posts")}</div></div>
    </div>
    <div class="card"><p class="note">${t("اختر تبويب التوثيق لمراجعة الطلبات بالموافقة أو الرفض.", "Open Verify tab to approve or reject requests.")}</p></div>`
  );
}

function adminVerifyPanel() {
  const vf = state.adminVerifyFilter || "all";
  let list = (state.verifyRequests || []).filter((r) => r.status === "pending");
  const nInst = list.filter((r) => r.priority === "instant" || r.track === "instant").length;
  const nPage = list.filter((r) => r.kind === "page" || r.pageId).length;
  const nRew = list.filter((r) => {
    const inst = r.priority === "instant" || r.track === "instant";
    const page = r.kind === "page" || r.pageId;
    return !inst && !page;
  }).length;

  list = list.slice().sort((a, b) => {
    const pa = a.priority === "instant" || a.track === "instant" ? 0 : 1;
    const pb = b.priority === "instant" || b.track === "instant" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (b.ts || 0) - (a.ts || 0);
  });
  if (vf === "instant") list = list.filter((r) => r.priority === "instant" || r.track === "instant");
  else if (vf === "reward")
    list = list.filter((r) => {
      const inst = r.priority === "instant" || r.track === "instant";
      const page = r.kind === "page" || r.pageId;
      return !inst && !page;
    });
  else if (vf === "pages") list = list.filter((r) => r.kind === "page" || r.pageId);

  let h = `<div class="card">
    <h3 style="margin:0 0 10px">✓ ${t("طلبات التوثيق", "Verification requests")}</h3>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">
      <button class="chip ${vf === "all" ? "brand" : ""}" data-act="admin-vfilter" data-v="all">${t("الكل", "All")} (${(state.verifyRequests || []).filter((r) => r.status === "pending").length})</button>
      <button class="chip ${vf === "instant" ? "brand" : ""}" data-act="admin-vfilter" data-v="instant">⚡ ${nInst}</button>
      <button class="chip ${vf === "reward" ? "brand" : ""}" data-act="admin-vfilter" data-v="reward">🎁 ${nRew}</button>
      <button class="chip ${vf === "pages" ? "brand" : ""}" data-act="admin-vfilter" data-v="pages">📄 ${nPage}</button>
    </div>`;

  if (!list.length) {
    h += `<p class="note">${t("لا طلبات معلّقة لهذا الفلتر.", "No pending requests for this filter.")}</p></div>`;
    return h;
  }

  list.forEach((r) => {
    const live = r.uid ? verificationStats(r.uid) : { followers: 0, content: 0, points: 0 };
    const st = r.stats || {};
    const followers = st.followers != null ? st.followers : live.followers;
    const content = st.content != null ? st.content : live.content;
    const points = st.points != null ? st.points : live.points;
    const isInst = r.priority === "instant" || r.track === "instant";
    const isPage = r.kind === "page" || !!r.pageId;
    const trackLabel = isInst
      ? "⚡ " + t("فوري", "Instant")
      : isPage
        ? "📄 " + t("صفحة", "Page")
        : "🎁 " + t("مكافأة", "Reward");
    const u = (state.users || []).find((x) => x.id === r.uid) || {};
    h += `<div class="card" style="margin-bottom:10px;border-color:${isInst ? "var(--accent)" : "var(--line)"}">
      <div class="row" style="align-items:flex-start">
        <img class="av" src="${esc(r.photo || u.photo || "")}" alt="">
        <div style="flex:1">
          <div class="row" style="flex-wrap:wrap;gap:6px"><b>${esc(r.name || u.name || "")}</b>
            <span class="chip ${isInst ? "gold" : "brand"}">${trackLabel}</span>
            ${u.verified ? `<span class="chip brand">${t("موثّق", "Verified")}</span>` : ""}
          </div>
          <div class="note">${ago(r.ts)}</div>
        </div>
      </div>
      <div class="grid-3" style="margin:12px 0">
        <div><b>${followers}</b><div class="note">${t("متابع", "Followers")}</div></div>
        <div><b>${content}</b><div class="note">${t("محتوى", "Content")}</div></div>
        <div><b>${points}</b><div class="note">${t("نقاط", "Points")}</div></div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" style="flex:1" data-act="verify-accept" data-i="${esc(r.id)}" data-u="${esc(r.uid || "")}" data-k="${esc(r.kind || "")}" data-p="${esc(r.pageId || "")}">✓ ${t("موافقة", "Approve")}</button>
        <button class="btn danger" style="flex:1" data-act="verify-reject" data-i="${esc(r.id)}" data-u="${esc(r.uid || "")}">${t("رفض", "Reject")}</button>
      </div>
    </div>`;
  });
  h += `</div>`;

  const done = (state.verifyRequests || [])
    .filter((r) => r.status !== "pending")
    .sort((a, b) => (b.reviewedAt || b.ts || 0) - (a.reviewedAt || a.ts || 0))
    .slice(0, 10);
  if (done.length) {
    h += `<div class="card"><h3 style="margin:0 0 8px">${t("سجل حديث", "Recent history")}</h3>`;
    done.forEach((r) => {
      h += `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
        <span>${esc(r.name || r.uid)} ${r.priority === "instant" ? "⚡" : "🎁"}
          ${r.rejectReason ? `<div class="note">${esc(r.rejectReason)}</div>` : ""}</span>
        <span class="chip ${r.status === "accepted" ? "brand" : ""}">${esc(r.status)}</span>
      </div>`;
    });
    h += `</div>`;
  }
  return h;
}

function adminUsersPanel() {
  const list = (state.users || []).slice(0, 40);
  let h = `<div class="card"><h3 style="margin:0 0 8px">${t("أعضاء", "Users")} (${(state.users || []).length})</h3>`;
  list.forEach((u) => {
    h += `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <img class="av" src="${esc(u.photo || "")}" alt="">
      <div style="flex:1"><b>${esc(u.name || "")}</b> ${u.verified ? "✓" : ""}
        <div class="note" dir="ltr" style="font-size:.7rem">${esc(u.id || "")}</div>
      </div>
      <button class="btn alt sm" data-act="open-profile" data-u="${esc(u.id)}">${t("عرض", "View")}</button>
    </div>`;
  });
  h += `</div>`;
  return h;
}

export async function adminAcceptVerify(id, uid, kind, pageId) {
  try {
    if (kind === "page" && pageId) {
      await updateDoc(doc(db, "pages", pageId), { verified: true });
    } else if (uid) {
      const target = (state.users || []).find((x) => x.id === uid) || {};
      const addPts = 100;
      const newBonus = (Number(target.bonusPoints) || 0) + addPts;
      const wk = weekKey();
      const wb = (target.weeklyBonusWeek === wk ? Number(target.weeklyBonus) || 0 : 0) + addPts;
      await updateDoc(doc(db, "users", uid), {
        verified: true,
        verificationEligible: true,
        bonusPoints: newBonus,
        weeklyBonus: wb,
        weeklyBonusWeek: wk
      });
      if (target) {
        target.verified = true;
        target.bonusPoints = newBonus;
      }
    }
    await updateDoc(doc(db, "verifyRequests", id), {
      status: "accepted",
      reviewedAt: Date.now(),
      reviewedBy: state.me.uid,
      rewardPoints: 100
    });
    if (uid) {
      await notify(uid, "verified", {
        msg: t("تم قبول توثيقك ✓ ومنحت +100 نقطة", "Verification approved ✓ (+100 pts)")
      });
    }
    toast(t("تم القبول +100 نقطة", "Approved +100 pts"));
    window.dispatchEvent(new CustomEvent("hh:data", { detail: "admin" }));
  } catch (e) {
    toast(e.message || "Error");
  }
}

export async function adminRejectVerify(id, uid) {
  const reason = prompt(t("سبب الرفض (اختياري)", "Reject reason (optional)")) || "";
  try {
    await updateDoc(doc(db, "verifyRequests", id), {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: state.me.uid,
      rejectReason: reason.slice(0, 300)
    });
    if (uid) {
      await notify(uid, "verify_rejected", {
        msg: t("تم رفض طلب التوثيق", "Verification request rejected") + (reason ? ": " + reason : "")
      });
    }
    toast(t("تم الرفض", "Rejected"));
    window.dispatchEvent(new CustomEvent("hh:data", { detail: "admin" }));
  } catch (e) {
    toast(e.message || "Error");
  }
}
