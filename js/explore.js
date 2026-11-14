import { state, t, esc, DEF_AV, ago } from "./state.js";

export function exploreHtml() {
  const q = (state.searchQ || "").trim().toLowerCase();
  const reels = state.reels.filter((r) => r.videoUrl || r.media || r.url).slice(0, 8);
  const posts = state.posts.slice(0, 10);
  const people = state.users
    .filter((u) => u.id !== state.me?.uid && (!q || String(u.name || "").toLowerCase().includes(q)))
    .slice(0, 12);

  // hashtags from posts
  const tags = {};
  state.posts.forEach((p) => {
    const m = String(p.t || "").match(/#[\u0600-\u06FF\w]+/g);
    if (m) m.forEach((tg) => (tags[tg] = (tags[tg] || 0) + 1));
  });
  const trendTags = Object.keys(tags)
    .sort((a, b) => tags[b] - tags[a])
    .slice(0, 10);

  let h = `<h2 style="margin:0 0 12px">🔍 ${t("استكشاف", "Explore")}</h2>`;

  h += `<div class="card"><h3 style="margin:0 0 8px">🔥 ${t("ترندات", "Trends")}</h3>`;
  if (!trendTags.length) h += `<p class="note">${t("لا هاشتاغات بعد", "No hashtags yet")}</p>`;
  trendTags.forEach((tg) => {
    h += `<button class="trend-item" data-act="search" data-q="${esc(tg)}"><b>${esc(tg)}</b><small>${tags[tg]} ${t("منشور", "posts")}</small></button>`;
  });
  h += `</div>`;

  h += `<div class="card"><h3 style="margin:0 0 8px">🎬 ${t("ريلز مقترحة", "Suggested reels")}</h3>`;
  if (!reels.length) h += `<p class="note">${t("لا ريلز", "No reels")}</p>`;
  else {
    h += `<div class="reel-shelf">`;
    reels.forEach((r) => {
      h += `<button class="reel-tile" data-act="open-reel" data-id="${esc(r.id)}">
        <img src="${esc(r.poster || r.photo || DEF_AV)}" alt="">
        <div class="play">▶</div>
        <div class="meta">${esc(r.name || "")}</div>
      </button>`;
    });
    h += `</div>`;
  }
  h += `</div>`;

  h += `<div class="card"><h3 style="margin:0 0 8px">✨ ${t("منشورات مقترحة", "Suggested posts")}</h3>`;
  posts.forEach((p) => {
    if (q && !String(p.t || "").toLowerCase().includes(q) && !String(p.name || "").toLowerCase().includes(q))
      return;
    h += `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <b>${esc(p.name || "")}</b> <span class="note">${ago(p.ts)}</span>
      <div>${esc(String(p.t || "").slice(0, 140))}</div>
    </div>`;
  });
  h += `</div>`;

  h += `<div class="card"><h3 style="margin:0 0 8px">👥 ${t("أشخاص", "People")}</h3>`;
  if (!people.length) h += `<p class="note">${t("لا نتائج", "No results")}</p>`;
  people.forEach((u) => {
    h += `<button class="row" style="width:100%;padding:8px 0;text-align:start" data-act="open-profile" data-u="${esc(u.id)}">
      <img class="av" src="${esc(u.photo || DEF_AV)}" alt="">
      <span style="flex:1;font-weight:600">${esc(u.name || "")}</span>
    </button>`;
  });
  h += `</div>`;

  return h;
}

export function trendsRailHtml() {
  const tags = {};
  state.posts.forEach((p) => {
    const m = String(p.t || "").match(/#[\u0600-\u06FF\w]+/g);
    if (m) m.forEach((tg) => (tags[tg] = (tags[tg] || 0) + 1));
  });
  const trendTags = Object.keys(tags)
    .sort((a, b) => tags[b] - tags[a])
    .slice(0, 6);
  const people = state.users.filter((u) => u.id !== state.me?.uid).slice(0, 5);

  let h = `<div class="card trend-block"><h4>🔥 ${t("هاشتاغات", "Hashtags")}</h4>`;
  if (!trendTags.length) h += `<p class="note">${t("ستظهر هنا مع النشاط", "Appear as people post")}</p>`;
  trendTags.forEach((tg) => {
    h += `<button class="trend-item" data-act="search" data-q="${esc(tg)}">${esc(tg)}<small>${tags[tg]}</small></button>`;
  });
  h += `</div>`;

  h += `<div class="card trend-block"><h4>👤 ${t("أشخاص", "People")}</h4>`;
  people.forEach((u) => {
    h += `<button class="trend-item" data-act="open-profile" data-u="${esc(u.id)}">${esc(u.name || "")}<small>${u.creatorType || ""}</small></button>`;
  });
  h += `</div>`;

  h += `<div class="card trend-block"><h4>👥 ${t("مجموعات", "Groups")}</h4>
    <p class="note">${t("المجموعات الشائعة قريباً", "Popular groups soon")}</p></div>`;
  return h;
}

/** Unified Search 3.0 */
export function searchHtml(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) {
    return `<div class="empty"><div class="ico">🔎</div><h3>${t("بحث موحّد", "Unified search")}</h3>
      <p>${t("أشخاص · منشورات · ريلز · مجموعات · صفحات · وظائف · سوق · دورات", "People · Posts · Reels · Groups · Pages · Jobs · Market · Courses")}</p></div>`;
  }
  let h = `<h2 style="margin:0 0 12px">🔎 ${esc(q)}</h2>`;

  const people = state.users.filter((u) => String(u.name || "").toLowerCase().includes(q)).slice(0, 8);
  const posts = state.posts.filter((p) => String(p.t || "").toLowerCase().includes(q) || String(p.name || "").toLowerCase().includes(q)).slice(0, 8);
  const reels = state.reels.filter((r) => String(r.caption || "").toLowerCase().includes(q) || String(r.name || "").toLowerCase().includes(q)).slice(0, 6);
  const market = (state.catalog.marketplace || []).filter((x) => String(x.title || "").toLowerCase().includes(q)).slice(0, 6);
  const jobs = (state.catalog.jobs || []).filter((x) => String(x.title || "").toLowerCase().includes(q)).slice(0, 6);
  const courses = (state.catalog.academy || []).filter((x) => String(x.title || "").toLowerCase().includes(q)).slice(0, 6);

  const section = (title, body) =>
    body
      ? `<div class="card"><h3 style="margin:0 0 8px">${title}</h3>${body}</div>`
      : "";

  h += section(
    "👤 " + t("أشخاص", "People"),
    people
      .map(
        (u) =>
          `<button class="row" style="width:100%;padding:6px 0" data-act="open-profile" data-u="${esc(u.id)}">
        <img class="av" src="${esc(u.photo || DEF_AV)}" alt=""><span>${esc(u.name || "")}</span></button>`
      )
      .join("")
  );
  h += section(
    "📝 " + t("منشورات", "Posts"),
    posts.map((p) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)">${esc(String(p.t || "").slice(0, 120))}</div>`).join("")
  );
  h += section(
    "🎬 " + t("ريلز", "Reels"),
    reels.map((r) => `<div class="note" style="padding:6px 0">${esc(r.caption || r.name || "Reel")}</div>`).join("")
  );
  h += section(
    "🛍️ " + t("سوق", "Market"),
    market.map((x) => `<div class="note">${esc(x.title)} · ${x.price || 0}</div>`).join("")
  );
  h += section(
    "💼 " + t("وظائف", "Jobs"),
    jobs.map((x) => `<div class="note">${esc(x.title)}</div>`).join("")
  );
  h += section(
    "🎓 " + t("دورات", "Courses"),
    courses.map((x) => `<div class="note">${esc(x.title)}</div>`).join("")
  );

  if (h.indexOf("card") < 0) h += `<div class="empty"><p>${t("لا نتائج", "No results")}</p></div>`;
  return h;
}
