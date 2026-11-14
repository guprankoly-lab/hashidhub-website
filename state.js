/** Shared app state */
export const state = {
  me: null,
  prof: null,
  isGuest: true,
  isAdmin: false,
  tab: "home",
  theme: localStorage.getItem("hh_theme") || "dark",
  lang: localStorage.getItem("hh_lang") || "ar",
  posts: [],
  stories: [],
  reels: [],
  users: [],
  follows: [],
  likes: [],
  comments: [],
  pages: [],
  groups: [],
  notifs: [],
  catalog: { marketplace: [], jobs: [], academy: [] },
  unsubs: [],
  aiMode: "general",
  aiOut: "",
  aiBusy: false,
  searchQ: "",
  profileUid: null,
  profileData: null
};

export const DEF_AV =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="#18212b" width="80" height="80"/><circle cx="40" cy="30" r="14" fill="#3a4a5c"/><ellipse cx="40" cy="66" rx="24" ry="18" fill="#3a4a5c"/></svg>'
  );

export function t(ar, en) {
  return state.lang === "en" ? en || ar : ar;
}

export function toast(msg, ms) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.classList.add("hidden"), ms || 2800);
}

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ago(ts) {
  const d = Date.now() - (Number(ts) || 0);
  if (d < 60000) return t("الآن", "now");
  if (d < 3600000) return Math.floor(d / 60000) + t("د", "m");
  if (d < 86400000) return Math.floor(d / 3600000) + t("س", "h");
  return Math.floor(d / 86400000) + t("ي", "d");
}

export function dayKey(d) {
  d = d ? new Date(d) : new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  document.documentElement.lang = state.lang === "en" ? "en" : "ar";
  document.documentElement.dir = state.lang === "en" ? "ltr" : "rtl";
}
