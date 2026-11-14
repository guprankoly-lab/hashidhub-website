import { state, t, toast, esc, applyTheme, DEF_AV } from "./state.js";
import { startAuth, onAuthReady, authView, setupView, bindAuthDom, doLogout } from "./auth.js";
import { listenStories, storiesStripHtml, publishStory, openStoryViewer } from "./stories.js";
import { listenPosts, composerHtml, feedHtml, bindComposer, toggleLike } from "./posts.js";
import { listenReels, reelShelfHtml, reelsPageHtml, publishReel, openReelPlayer } from "./reels.js";
import { profileHtml, loadProfile, setCreatorType, listenFollows } from "./profile.js";
import { exploreHtml, trendsRailHtml, searchHtml } from "./explore.js";
import { aiPageHtml, runAI } from "./ai.js";
import { marketplacePageHtml, openMarketComposer, deleteListing, listenMarketplace } from "./marketplace.js";
import {
  listenMessages, inboxHtml, chatHtml, openChat, sendText, sendVoice,
  startVoiceNote, afterChatRender, unreadCount
} from "./chat.js";
import {
  pointsCardHtml, dailyQuestsHtml, leaderboardHtml,
  claimQuest, claimWeekCrown
} from "./gamification.js";
import { verificationHtml, requestVerify, listenVerifyRequests } from "./verify.js";
import { adminHtml, adminAcceptVerify, adminRejectVerify } from "./admin.js";
import { creatorDashboardHtml } from "./creator.js";
import { loadingOverlay } from "./ui.js";
import { pagesBlockHtml, pageViewHtml, createPage, listenPages } from "./pages.js";
import {
  db,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from "./firebase.js";

const appEl = () => document.getElementById("app");

function mobileMenuHtml() {
  const items = [
    ["home", "🏠", t("الرئيسية", "Home")],
    ["explore", "🔍", t("استكشاف", "Explore")],
    ["reels", "🎬", t("ريلز", "Reels")],
    ["ai", "🤖", "AI"],
    ["msgs", "💬", t("رسائل", "Chats")],
    ["verification", "✅", t("توثيق", "Verify")],
    ["leaderboard", "🏆", t("متصدرون", "Leaders")],
    ["creator", "📊", t("إحصائيات", "Stats")],
    ["marketplace", "🛍️", t("السوق", "Market")],
    ["jobs", "💼", t("وظائف", "Jobs")],
    ["academy", "🎓", t("أكاديمية", "Academy")],
    ["me", "👤", t("حسابي", "Me")]
  ];
  if (state.isAdmin) items.push(["admin", "🛠️", t("إدارة", "Admin")]);
  return `<nav class="mobile-menu">${items
    .map(
      ([id, ico, label]) =>
        `<button type="button" class="${state.tab === id ? "on" : ""}" data-act="tab" data-t="${id}">${ico} ${label}</button>`
    )
    .join("")}</nav>`;
}

function navItems() {
  const items = [
    ["home", "🏠", t("الرئيسية", "Home")],
    ["explore", "🔍", t("استكشاف", "Explore")],
    ["reels", "🎬", t("ريلز", "Reels")],
    ["ai", "🤖", "AI"],
    ["msgs", "💬", t("رسائل", "Messages")],
    ["verification", "✅", t("توثيق", "Verify")],
    ["leaderboard", "🏆", t("متصدرون", "Leaders")],
    ["creator", "📊", t("إحصائيات", "Analytics")],
    ["marketplace", "🛍️", t("السوق", "Market")],
    ["jobs", "💼", t("وظائف", "Jobs")],
    ["academy", "🎓", t("أكاديمية", "Academy")],
    ["me", "👤", t("حسابي", "Profile")],
    ...(state.isAdmin ? [["admin", "🛠️", t("إدارة", "Admin")]] : [])
  ];
  return items
    .map(
      ([id, ico, label]) =>
        `<button class="nav-item ${state.tab === id ? "on" : ""}" data-act="tab" data-t="${id}">
        <span>${ico}</span><span>${label}</span></button>`
    )
    .join("");
}

function headerHtml() {
  return `<header class="hh-header">
    <div class="logo">Hashid<b>Hub</b></div>
    <div class="search-bar">
      <input id="global-search" type="search" placeholder="${t("بحث: أشخاص، منشورات، ريلز، سوق..", "Search: people, posts, reels..")}" value="${esc(state.searchQ || "")}">
      <span>🔍</span>
    </div>
    <div class="hdr-actions">
      <button class="hbtn" data-act="toggle-theme" title="Theme">🌓</button>
      <button class="hbtn" data-act="toggle-lang" title="Lang">${state.lang === "en" ? "ع" : "EN"}</button>
      ${
        state.isGuest
          ? `<button class="btn sm" data-act="goto-auth">${t("دخول", "Sign in")}</button>`
          : `<button class="hbtn" data-act="tab" data-t="me" title="Profile"><img class="av" style="width:28px;height:28px" src="${esc(state.prof?.photo || DEF_AV)}" alt=""></button>`
      }
    </div>
  </header>`;
}

function bnavHtml() {
  const tabs = [
    ["home", "M3 11l9-8 9 8v10a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2z", t("رئيسية", "Home")],
    ["reels", "M8 5v14l11-7z", t("ريلز", "Reels")],
    ["msgs", "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", t("رسائل", "Chats")],
    ["explore", "M11 5a6 6 0 100 12 6 6 0 000-12zm10 10l-3.5-3.5", t("استكشاف", "Explore")],
    ["me", "M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z", t("حسابي", "Me")]
  ];
  return `<nav class="bnav">${tabs
    .map(
      ([id, path, label]) =>
        `<button class="${state.tab === id ? "on" : ""}" data-act="tab" data-t="${id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${path}"/></svg>
        ${label}</button>`
    )
    .join("")}</nav>`;
}

/* marketplace UI → marketplace.js */

function jobsHtml() {
  const list = state.catalog.jobs || [];
  let h = `<h2 style="margin:0 0 12px">💼 ${t("وظائف", "Jobs")}</h2>`;
  if (!list.length) return h + `<div class="empty"><div class="ico">💼</div><p>${t("لا وظائف حالياً", "No jobs yet")}</p></div>`;
  list.forEach((x) => {
    h += `<div class="card"><h3 style="margin:0 0 4px">${esc(x.title)}</h3>
      <div class="note">${esc(x.company || "")} · ${esc(x.location || "")}</div>
      <p class="note">${esc(String(x.description || "").slice(0, 160))}</p></div>`;
  });
  return h;
}

function academyHtml() {
  const list = state.catalog.academy || [];
  let h = `<h2 style="margin:0 0 12px">🎓 ${t("الأكاديمية", "Academy")}</h2>`;
  if (!list.length) return h + `<div class="empty"><div class="ico">🎓</div><p>${t("لا دورات بعد", "No courses yet")}</p></div>`;
  list.forEach((x) => {
    h += `<div class="card"><h3 style="margin:0 0 4px">${esc(x.title)}</h3>
      <p class="note">${esc(String(x.description || "").slice(0, 160))}</p></div>`;
  });
  return h;
}

function mePageHtml() {
  if (state.isGuest) {
    return `<div class="empty"><div class="ico">👤</div><h3>${t("حسابك", "Your account")}</h3>
      <p>${t("سجّل لفتح الملف الشخصي والنشر.", "Sign in to unlock profile & posting.")}</p>
      <button class="btn" data-act="goto-auth">${t("تسجيل الدخول", "Sign in")}</button></div>`;
  }
  return (
    profileHtml(state.me.uid, state.prof) +
    pointsCardHtml() +
    pagesBlockHtml() +
    dailyQuestsHtml() +
    `<div class="card"><button class="btn secondary" style="width:100%" data-act="tab" data-t="creator">📊 ${t("لوحة المبدع", "Creator dashboard")}</button></div>` +
    `<div class="card"><button class="btn danger" style="width:100%" data-act="logout">🚪 ${t("تسجيل الخروج", "Log out")}</button></div>`
  );
}

function mainHtml() {
  if (state.tab === "verification") return verificationHtml();
  if (state.tab === "leaderboard") return leaderboardHtml();
  if (state.tab === "creator") return creatorDashboardHtml();
  if (state.tab === "page") return pageViewHtml(state.activePageId);
  if (state.tab === "admin") return adminHtml();
  if (state.tab === "msgs") return inboxHtml();
  if (state.tab === "chat") return chatHtml();
  if (state.tab === "search") return searchHtml(state.searchQ);
  if (state.tab === "explore") return exploreHtml();
  if (state.tab === "reels") return reelsPageHtml();
  if (state.tab === "ai") return aiPageHtml();
  if (state.tab === "marketplace") return marketplacePageHtml();
  if (state.tab === "jobs") return jobsHtml();
  if (state.tab === "academy") return academyHtml();
  if (state.tab === "me") return mePageHtml();
  if (state.tab === "profile") return profileHtml(state.profileUid, state.profileData);

  // home
  return (
    storiesStripHtml() +
    reelShelfHtml() +
    composerHtml() +
    feedHtml()
  );
}

function pushNav(tab) {
  try {
    const url = tab === "home" ? "/" : "/?tab=" + encodeURIComponent(tab);
    if (location.search.indexOf("tab=" + tab) >= 0 || (tab === "home" && !location.search)) return;
    history.pushState({ tab }, "", url);
  } catch (_) {}
}

window.addEventListener("popstate", (e) => {
  const tab = (e.state && e.state.tab) || new URLSearchParams(location.search).get("tab") || "home";
  if (state._authScreen) return;
  state.tab = tab;
  render();
});

export function render() {
  applyTheme();
  if (state._authScreen === "login") {
    appEl().innerHTML = authView();
    bindAuthDom();
    return;
  }
  if (state._authScreen === "setup") {
    appEl().innerHTML = setupView();
    bindAuthDom();
    return;
  }

  appEl().innerHTML = `
    ${headerHtml()}
    ${mobileMenuHtml()}
    <div class="layout">
      <aside class="rail"><div class="card" style="padding:10px">${navItems()}</div></aside>
      <main class="main" id="main">${mainHtml()}</main>
      <aside class="trends">${trendsRailHtml()}</aside>
    </div>
    ${bnavHtml()}`;

  bindComposer();
  if (state.tab === "chat") afterChatRender();
  const slot = document.querySelector("[data-pages-slot]");
  if (slot) {
    import("./pages.js").then((m) => {
      slot.outerHTML = m.pagesBlockHtml(state.profileUid || state.me?.uid);
    });
  }
  const mq = document.getElementById("market-q");
  if (mq) {
    mq.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        window.__marketQ = mq.value.trim();
        render();
      }
    });
    mq.addEventListener("change", () => {
      window.__marketQ = mq.value.trim();
      render();
    });
  }
  const search = document.getElementById("global-search");
  search?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.searchQ = search.value.trim();
      state.tab = "search";
      render();
    }
  });
}

function listenCatalog() {
  const bind = (col, key) => {
    try {
      const unsub = onSnapshot(
        query(collection(db, col), where("status", "==", "published"), limit(40)),
        (snap) => {
          state.catalog[key] = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          if (["marketplace", "jobs", "academy"].includes(state.tab)) render();
        },
        (err) => console.warn("[catalog]", col, err?.code)
      );
      state.unsubs.push(unsub);
    } catch (e) {
      console.warn(e);
    }
  };
  bind("jobPosts", "jobs");
  bind("courses", "academy");
}

function listenUsers() {
  const unsub = onSnapshot(query(collection(db, "users"), limit(200)), (snap) => {
    state.users = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  });
  state.unsubs.push(unsub);
}

function startData() {
  listenPosts();
  listenStories();
  listenReels();
  listenFollows();
  listenUsers();
  listenCatalog();
  listenMessages();
  listenMarketplace();
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept || "image/*";
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  try {
    if (act === "tab") {
      state.tab = b.dataset.t || "home";
      pushNav(state.tab);
      render();
      return;
    }
    if (act === "goto-auth") {
      state._authScreen = "login";
      render();
      return;
    }
    if (act === "toggle-theme") {
      state.theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("hh_theme", state.theme);
      render();
      return;
    }
    if (act === "toggle-lang") {
      state.lang = state.lang === "en" ? "ar" : "en";
      localStorage.setItem("hh_lang", state.lang);
      render();
      return;
    }
    if (act === "logout") {
      await doLogout();
      return;
    }
    if (act === "add-story") {
      const file = await pickFile("image/*");
      if (!file) return;
      const cap = prompt(t("نص القصة (اختياري)", "Caption (optional)")) || "";
      await publishStory(file, cap);
      state.tab = "home";
      render();
      return;
    }
    if (act === "open-story") {
      openStoryViewer(b.dataset.u);
      return;
    }
    if (act === "add-reel") {
      const file = await pickFile("video/*");
      if (!file) return;
      const cap = prompt(t("وصف الريل", "Reel caption")) || "";
      toast(t("جاري الرفع…", "Uploading…"));
      await publishReel(file, cap);
      state.tab = "reels";
      render();
      return;
    }
    if (act === "open-reel") {
      openReelPlayer(b.dataset.id);
      return;
    }
    
    if (act === "like-post") {
      await toggleLike(b.dataset.id, b);
      return;
    }
    if (act === "post-menu") {
      await (await import("./posts.js")).openPostMenu(b.dataset.id, b.dataset.uid);
      return;
    }
    if (act === "share-post") {
      const url = location.origin + "/?post=" + encodeURIComponent(b.dataset.id);
      try { await navigator.clipboard.writeText(url); } catch (_) {}
      toast(t("تم نسخ الرابط", "Link copied"));
      b.classList.add("tap-pop");
      return;
    }
    if (act === "comment-post") {
      toast(t("التعليقات تُفتح في التحديث التالي من المنشور", "Comments expand in next post update"));
      return;
    }
    if (act === "market-contact") {
      await (await import("./marketplace.js")).openSellerContact(b.dataset.u);
      return;
    }
    if (act === "page-create") {
      await createPage();
      render();
      return;
    }
    if (act === "page-open") {
      state.activePageId = b.dataset.id;
      state.tab = "page";
      pushNav("page");
      render();
      return;
    }
    if (act === "page-switch") {
      state.activePageId = b.dataset.id;
      toast(t("تم التبديل — المنشورات باسم الصفحة قريباً بالكامل", "Switched — page-as-author posts coming fully next"));
      return;
    }

    if (act === "open-profile") {
      await loadProfile(b.dataset.u);
      state.tab = "profile";
      render();
      return;
    }
    if (act === "prof-tab") {
      window.__profTab = b.dataset.v;
      render();
      return;
    }
    if (act === "set-creator") {
      await setCreatorType(b.dataset.v);
      render();
      return;
    }
    if (act === "search") {
      state.searchQ = b.dataset.q || "";
      state.tab = "search";
      render();
      return;
    }
    if (act === "ai-mode") {
      state.aiMode = b.dataset.v;
      render();
      return;
    }
    if (act === "ai-run") {
      await runAI();
      return;
    }
    if (act === "ai-clear") {
      state.aiPrompt = "";
      state.aiOut = "";
      render();
      return;
    }
    
    if (act === "open-chat") {
      openChat(b.dataset.u, b.dataset.n);
      render();
      return;
    }
    if (act === "send-msg") {
      const input = document.getElementById("chat-input");
      const text = (input?.value || "").trim();
      if (!text) return;
      if (input) input.value = "";
      await sendText(text);
      return;
    }
    if (act === "reply-msg") {
      state.replyTo = { id: b.dataset.id, t: b.dataset.t, a: b.dataset.a };
      render();
      return;
    }
    if (act === "cancel-reply") {
      state.replyTo = null;
      render();
      return;
    }
    if (act === "rec-msg") {
      try {
        const { file, dur } = await startVoiceNote();
        const ui = document.getElementById("voice-rec-ui");
        if (ui) { ui.classList.add("hidden"); ui.innerHTML = ""; }
        await sendVoice(file, dur);
      } catch (err) {
        if (err.message !== "cancelled") toast(err.message || t("تعذر التسجيل", "Recording failed"));
        const ui = document.getElementById("voice-rec-ui");
        if (ui) { ui.classList.add("hidden"); ui.innerHTML = ""; }
      }
      return;
    }
    if (act === "message") {
      openChat(b.dataset.u, state.users.find(u => u.id === b.dataset.u)?.name);
      render();
      return;
    }

    
    if (act === "claim-quest") {
      await claimQuest(b.dataset.id, b.dataset.reward);
      render();
      return;
    }
    if (act === "claim-crown") {
      await claimWeekCrown();
      render();
      return;
    }
    if (act === "verify-free") {
      await requestVerify("free");
      render();
      return;
    }
    if (act === "verify-instant") {
      await requestVerify("instant");
      render();
      return;
    }
    if (act === "admin-tab") {
      state.adminTab = b.dataset.v || "home";
      render();
      return;
    }
    if (act === "admin-vfilter") {
      state.adminVerifyFilter = b.dataset.v || "all";
      render();
      return;
    }
    if (act === "verify-accept") {
      await adminAcceptVerify(b.dataset.i, b.dataset.u, b.dataset.k, b.dataset.p);
      render();
      return;
    }
    if (act === "verify-reject") {
      await adminRejectVerify(b.dataset.i, b.dataset.u);
      render();
      return;
    }

    if (act === "market-add" || act === "add-market") {
      openMarketComposer();
      return;
    }
    if (act === "market-cat") {
      window.__marketCat = b.dataset.v || "all";
      render();
      return;
    }
    if (act === "market-del") {
      await deleteListing(b.dataset.id);
      return;
    }
    if (act === "market-contact") {
      if (state.isGuest) return toast(t("سجّل أولاً", "Sign in first"));
      toast(t("المراسلة المباشرة تُفعَّل في دفعة الرسائل القادمة", "Direct messaging lands in the next messages slice"));
      return;
    }
  } catch (err) {
    console.error(err);
    toast(err.message || "Error");
  }
});

window.addEventListener("hh:open-chat", (e) => {
  if (e.detail?.uid) {
    openChat(e.detail.uid, e.detail.name || "");
    render();
  }
});

window.addEventListener("hh:data", () => {
  if (!state._authScreen) render();
});

onAuthReady((mode) => {
  if (mode === "login" || mode === "guest") {
    state._authScreen = "login";
    render();
    return;
  }
  if (mode === "setup") {
    state._authScreen = "setup";
    render();
    return;
  }
  if (mode === "guest-browse") {
    state._authScreen = null;
    state.tab = "home";
    startData();
    render();
    return;
  }
  // ready
  state._authScreen = null;
  startData();
  render();
});

try {
  applyTheme();
  startAuth();
  state._authScreen = "login";
  render();
  console.log("[HashidHub 3.0] boot");
} catch (err) {
  console.error(err);
  if (window.__hhShowErr) window.__hhShowErr(err);
}
