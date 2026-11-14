/**
 * Creator Analytics Dashboard — client-side from live state
 * Charts: pure SVG (no chart library)
 */
import { state, t, toast, esc, ago } from "./state.js";
import { totalPoints, activityPoints, userBonus, weeklyPoints, countFollowers } from "./gamification.js";

function dayKey(d) {
  d = d instanceof Date ? d : new Date(d);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function myReels() {
  const uid = state.me?.uid;
  return (state.reels || []).filter((r) => r.uid === uid);
}

function myPosts() {
  const uid = state.me?.uid;
  return (state.posts || []).filter((p) => p.uid === uid);
}

/** Estimated reach from engagement heuristics */
export function estimateReach(uid) {
  const followers = countFollowers(uid);
  const reels = (state.reels || []).filter((r) => r.uid === uid);
  const posts = (state.posts || []).filter((p) => p.uid === uid);
  const views = reels.reduce((s, r) => s + (Number(r.views) || 0), 0);
  const likes = reels.reduce((s, r) => s + (Number(r.likes) || 0), 0);
  const postLikes = (state.likes || []).filter((l) => posts.some((p) => p.id === l.pid)).length;
  // simple model: followers * 0.3 + views * 0.5 + engagement * 2
  return Math.round(followers * 0.35 + views * 0.55 + (likes + postLikes) * 2.2);
}

function weekSeries() {
  const days = lastNDays(7);
  const uid = state.me?.uid;
  const posts = myPosts();
  const reels = myReels();
  const likesOnMine = (state.likes || []).filter((l) => posts.some((p) => p.id === l.pid));

  return days.map((dk) => {
    const p = posts.filter((x) => dayKey(x.ts || 0) === dk).length;
    const r = reels.filter((x) => dayKey(x.ts || 0) === dk).length;
    const likes = likesOnMine.filter((x) => dayKey(x.ts || 0) === dk).length;
    // views attributed by reel day published (approximation)
    const views = reels
      .filter((x) => dayKey(x.ts || 0) === dk)
      .reduce((s, x) => s + (Number(x.views) || 0), 0);
    return {
      day: dk,
      label: dk.slice(5),
      posts: p,
      reels: r,
      likes,
      views,
      activity: p + r * 2 + likes
    };
  });
}

function svgBarChart(series, key, color) {
  const w = 320;
  const h = 120;
  const pad = 8;
  const max = Math.max(1, ...series.map((s) => s[key] || 0));
  const bw = (w - pad * 2) / series.length - 4;
  let bars = "";
  series.forEach((s, i) => {
    const val = s[key] || 0;
    const bh = Math.round(((h - 28) * val) / max);
    const x = pad + i * ((w - pad * 2) / series.length) + 2;
    const y = h - 18 - bh;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(2, bh)}" rx="4" fill="${color}" opacity="0.9"/>`;
    bars += `<text x="${x + bw / 2}" y="${h - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">${esc(s.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="120" class="chart-svg" role="img">${bars}</svg>`;
}

function svgLineChart(series, key, color) {
  const w = 320;
  const h = 120;
  const pad = 12;
  const max = Math.max(1, ...series.map((s) => s[key] || 0));
  const pts = series.map((s, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
    const y = h - 20 - ((h - 36) * (s[key] || 0)) / max;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const dots = pts
    .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${color}"/>`)
    .join("");
  const labels = series
    .map((s, i) => {
      const x = pts[i][0];
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">${esc(s.label)}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="120" class="chart-svg" role="img">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

export function creatorDashboardHtml() {
  if (state.isGuest || !state.me) {
    return `<div class="empty"><div class="ico">📊</div><h3>${t("لوحة المبدع", "Creator dashboard")}</h3>
      <p>${t("سجّل الدخول لعرض إحصائياتك.", "Sign in to view your analytics.")}</p>
      <button class="btn" data-act="goto-auth">${t("دخول", "Sign in")}</button></div>`;
  }

  const uid = state.me.uid;
  const reels = myReels();
  const posts = myPosts();
  const followers = countFollowers(uid);
  const following = (state.follows || []).filter((f) => f.a === uid).length;
  const views = reels.reduce((s, r) => s + (Number(r.views) || 0), 0);
  const likes = reels.reduce((s, r) => s + (Number(r.likes) || 0), 0);
  const comments = reels.reduce((s, r) => s + (Number(r.comments) || 0), 0);
  const postLikes = (state.likes || []).filter((l) => posts.some((p) => p.id === l.pid)).length;
  const pts = totalPoints(uid);
  const wpts = weeklyPoints(uid);
  const reach = estimateReach(uid);
  const engRate =
    views > 0 ? Math.min(100, ((likes + comments) / views) * 100) : likes + comments > 0 ? 5 : 0;
  const series = weekSeries();
  // earnings placeholder (points as soft currency until payments)
  const earningsPts = userBonus(uid);
  const earningsHint = t(
    "الأرباح المالية تُربط لاحقاً عند تفعيل المدفوعات. حالياً: نقاط المكافآت.",
    "Cash earnings connect later with payments. For now: bonus points."
  );

  // top reels
  const topReels = reels
    .slice()
    .sort(
      (a, b) =>
        (Number(b.views) || 0) + (Number(b.likes) || 0) * 3 -
        ((Number(a.views) || 0) + (Number(a.likes) || 0) * 3)
    )
    .slice(0, 5);

  let h = `<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <div>
      <h2 style="margin:0">📊 ${t("لوحة المبدع", "Creator dashboard")}</h2>
      <p class="note" style="margin:4px 0 0">${t("أداؤك هذا الأسبوع وفي كل الوقت", "Your weekly & all-time performance")}</p>
    </div>
    <span class="chip gold">${state.prof?.creatorType || "Creator"}</span>
  </div>`;

  // KPI grid
  h += `<div class="creator-kpis">
    <div class="kpi"><b>${views.toLocaleString()}</b><span>${t("مشاهدات الريلز", "Reel views")}</span></div>
    <div class="kpi"><b>${likes.toLocaleString()}</b><span>${t("إعجابات الريلز", "Reel likes")}</span></div>
    <div class="kpi"><b>${comments.toLocaleString()}</b><span>${t("تعليقات", "Comments")}</span></div>
    <div class="kpi"><b>${followers.toLocaleString()}</b><span>${t("متابعون", "Followers")}</span></div>
    <div class="kpi"><b>${pts.toLocaleString()}</b><span>${t("النقاط", "Points")}</span></div>
    <div class="kpi accent"><b>${reach.toLocaleString()}</b><span>${t("وصول متوقع", "Est. reach")}</span></div>
  </div>`;

  h += `<div class="card" style="margin-top:12px">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div><b>${t("معدل التفاعل", "Engagement rate")}</b>
        <div class="note">${engRate.toFixed(1)}% · ${t("أسبوعي", "Weekly")} ${wpts} ⭐</div></div>
      <div><b>${t("منشورات / ريلز", "Posts / Reels")}</b>
        <div class="note">${posts.length} / ${reels.length}</div></div>
      <div><b>${t("إعجابات المنشورات", "Post likes")}</b>
        <div class="note">${postLikes}</div></div>
    </div>
  </div>`;

  // Charts
  h += `<div class="card" style="margin-top:12px">
    <h3 style="margin:0 0 8px">📈 ${t("نشاط 7 أيام", "7-day activity")}</h3>
    ${svgBarChart(series, "activity", "#00B894")}
    <div class="note">${t("منشورات + ريلز×2 + إعجابات", "Posts + reels×2 + likes")}</div>
  </div>`;

  h += `<div class="card">
    <h3 style="margin:0 0 8px">👁 ${t("مشاهدات حسب يوم النشر", "Views by publish day")}</h3>
    ${svgLineChart(series, "views", "#0984E3")}
  </div>`;

  // Account growth-ish
  h += `<div class="card">
    <h3 style="margin:0 0 8px">👤 ${t("الحساب", "Account")}</h3>
    <div class="grid-3">
      <div><b>${followers}</b><div class="note">${t("متابعون", "Followers")}</div></div>
      <div><b>${following}</b><div class="note">${t("يتابع", "Following")}</div></div>
      <div><b>${activityPoints(uid)}</b><div class="note">${t("نقاط أساسية", "Base points")}</div></div>
    </div>
    <p class="note" style="margin-top:10px">${t(
      "نمو المتابعين التفصيلي يحتاج سجلاً تاريخياً — حالياً العدد الحي من follows.",
      "Detailed follower growth needs history — showing live follows count."
    )}</p>
  </div>`;

  // Earnings
  h += `<div class="card">
    <h3 style="margin:0 0 8px">💰 ${t("الأرباح / المكافآت", "Earnings / rewards")}</h3>
    <div class="row" style="justify-content:space-between">
      <div><b style="font-size:1.4rem;color:var(--accent)">${earningsPts}</b>
        <div class="note">${t("نقاط مكافأة", "Bonus points")}</div></div>
      <span class="chip">$ — ${t("قريباً", "Soon")}</span>
    </div>
    <p class="note" style="margin-top:8px">${earningsHint}</p>
  </div>`;

  // Reach explanation
  h += `<div class="card">
    <h3 style="margin:0 0 6px">📡 ${t("توقعات الوصول", "Reach estimate")}</h3>
    <p style="margin:0;font-size:1.5rem;font-weight:800;color:var(--secondary)">${reach.toLocaleString()}</p>
    <p class="note">${t(
      "معادلة تقديرية: متابعون×0.35 + مشاهدات×0.55 + تفاعل×2.2 — للاسترشاد وليست ضماناً.",
      "Heuristic: followers×0.35 + views×0.55 + engagement×2.2 — guidance only."
    )}</p>
  </div>`;

  // Top videos
  h += `<div class="card"><h3 style="margin:0 0 10px">🎬 ${t("أفضل الريلز", "Top reels")}</h3>`;
  if (!topReels.length) {
    h += `<p class="note">${t("لا ريلز بعد — انشر لترى الإحصائيات.", "No reels yet — publish to see stats.")}</p>`;
  } else {
    topReels.forEach((r, i) => {
      h += `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
        <span class="chip">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.caption || t("ريل", "Reel"))}</b>
          <span class="note">👁 ${r.views || 0} · ❤️ ${r.likes || 0} · 💬 ${r.comments || 0}</span>
        </div>
        <button class="btn alt sm" data-act="open-reel" data-id="${esc(r.id)}">▶</button>
      </div>`;
    });
  }
  h += `</div>`;

  return h;
}
