import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  doc,
  getDoc,
  setDoc
} from "./firebase.js";
import { state, t, toast, esc } from "./state.js";
import { loadingOverlay } from "./ui.js";

let onReady = null;
let authMode = "email"; // email | phone

const CC = [
  ["967","Yemen"],["966","Saudi Arabia"],["971","UAE"],["965","Kuwait"],["974","Qatar"],
  ["973","Bahrain"],["968","Oman"],["962","Jordan"],["963","Syria"],["961","Lebanon"],
  ["964","Iraq"],["20","Egypt"],["212","Morocco"],["216","Tunisia"],["213","Algeria"],
  ["218","Libya"],["249","Sudan"],["970","Palestine"],["1","USA/Canada"],["44","UK"],
  ["33","France"],["49","Germany"],["90","Turkey"],["91","India"],["92","Pakistan"],
  ["93","Afghanistan"],["98","Iran"],["86","China"],["81","Japan"],["82","South Korea"],
  ["234","Nigeria"],["254","Kenya"],["27","South Africa"],["55","Brazil"],["7","Russia"]
];

export function onAuthReady(fn) {
  onReady = fn;
}

export function startAuth() {
  onAuthStateChanged(auth, async (u) => {
    clearUnsubs();
    if (!u) {
      state.me = null;
      state.prof = null;
      state.isGuest = true;
      state.isAdmin = false;
      if (onReady) onReady("guest");
      return;
    }
    state.me = u;
    state.isGuest = false;
    const snap = await getDoc(doc(db, "users", u.uid));
    if (!snap.exists()) {
      state.prof = null;
      if (onReady) onReady("setup");
      return;
    }
    state.prof = Object.assign({ id: u.uid }, snap.data());
    try {
      const ad = await getDoc(doc(db, "admins", u.uid));
      state.isAdmin = ad.exists();
    } catch (_) {
      state.isAdmin = false;
    }
    if (onReady) onReady("ready");
  });
}

function clearUnsubs() {
  (state.unsubs || []).forEach((f) => {
    try { f(); } catch (_) {}
  });
  state.unsubs = [];
}

function phoneEmail() {
  const raw = document.getElementById("ph")?.value || "";
  const map = "٠١٢٣٤٥٦٧٨٩";
  let d = raw.replace(/[٠-٩]/g, (c) => String(map.indexOf(c)));
  d = d.replace(/\D/g, "");
  const cc = document.getElementById("cc")?.value || "967";
  if (!d) return "";
  return cc + d + "@phone.hashidhub.local";
}

export function authView() {
  const ccOpts = CC.map(
    (c) =>
      `<option value="${c[0]}"${c[0] === "967" ? " selected" : ""}>+${c[0]} ${c[1]}</option>`
  ).join("");
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Hashid<span class="brand">Hub</span> 3.0</h1>
      <p class="note">${t("تواصل · أنشئ · انطلق", "Connect · Create · Grow")}</p>
      <div class="row" style="gap:6px;margin:12px 0">
        <button type="button" class="chip ${authMode === "email" ? "brand" : ""}" id="tab-email">${t("بريد", "Email")}</button>
        <button type="button" class="chip ${authMode === "phone" ? "brand" : ""}" id="tab-phone">${t("هاتف", "Phone")}</button>
      </div>
      <div class="col" style="margin-top:4px">
        <div id="auth-fields"></div>
        <input class="input" id="pw" type="password" placeholder="${t("كلمة المرور (6 أحرف على الأقل)", "Password (min 6)")}" dir="ltr" autocomplete="current-password">
        <div class="row">
          <button class="btn" id="btn-in" style="flex:1">${t("دخول", "Sign in")}</button>
          <button class="btn alt" id="btn-up" style="flex:1">${t("حساب جديد", "Sign up")}</button>
        </div>
        <button class="btn secondary" id="btn-google">Google</button>
        <button class="btn ghost" id="btn-guest">${t("تصفح كزائر", "Browse as guest")}</button>
        <button class="btn ghost sm" id="btn-reset">${t("نسيت كلمة المرور؟", "Forgot password?")}</button>
      </div>
    </div>
  </div>`;
}

function fillAuthFields() {
  const box = document.getElementById("auth-fields");
  if (!box) return;
  if (authMode === "phone") {
    const ccOpts = CC.map(
      (c) =>
        `<option value="${c[0]}"${c[0] === "967" ? " selected" : ""}>+${c[0]} ${c[1]}</option>`
    ).join("");
    box.innerHTML = `<div class="row" style="gap:8px">
      <select class="input" id="cc" dir="ltr" style="max-width:42%">${ccOpts}</select>
      <input class="input" id="ph" type="tel" placeholder="${t("رقم هاتفك", "Phone number")}" dir="ltr" inputmode="numeric" style="flex:1" autocomplete="tel">
    </div>`;
  } else {
    box.innerHTML = `<input class="input" id="em" type="email" placeholder="${t("البريد الإلكتروني", "Email")}" dir="ltr" autocomplete="email">`;
  }
}

function identity() {
  if (authMode === "phone") return phoneEmail();
  return (document.getElementById("em")?.value || "").trim();
}

export function setupView() {
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>${t("أكمل ملفك", "Complete profile")}</h1>
      <div class="col" style="margin-top:12px">
        <input class="input" id="pn" maxlength="40" placeholder="${t("الاسم", "Name")}" value="${esc(state.me?.displayName || "")}">
        <textarea class="input" id="pb" maxlength="200" placeholder="${t("نبذة", "Bio")}"></textarea>
        <button class="btn" id="btn-save-prof">${t("حفظ ومتابعة", "Save & continue")}</button>
      </div>
    </div>
  </div>`;
}

export function bindAuthDom() {
  fillAuthFields();
  document.getElementById("tab-email")?.addEventListener("click", () => {
    authMode = "email";
    if (onReady) onReady(state._authScreen === "setup" ? "setup" : "guest");
  });
  // re-render needed for chips - simpler: just fill fields
  const rebindTabs = () => {
    document.getElementById("tab-email")?.addEventListener("click", () => {
      authMode = "email";
      fillAuthFields();
      document.getElementById("tab-email")?.classList.add("brand");
      document.getElementById("tab-phone")?.classList.remove("brand");
    });
    document.getElementById("tab-phone")?.addEventListener("click", () => {
      authMode = "phone";
      fillAuthFields();
      document.getElementById("tab-phone")?.classList.add("brand");
      document.getElementById("tab-email")?.classList.remove("brand");
    });
  };
  rebindTabs();

  const run = async (fn) => {
    const load = loadingOverlay(t("جاري تسجيل الدخول…", "Signing in…"));
    try {
      await fn();
    } catch (e) {
      toast(e.message || "Error");
    } finally {
      load.hide();
    }
  };

  document.getElementById("btn-in")?.addEventListener("click", () =>
    run(async () => {
      const id = identity();
      const pw = document.getElementById("pw")?.value || "";
      if (!id || pw.length < 6) throw new Error(t("أكمل البيانات", "Fill all fields"));
      await signInWithEmailAndPassword(auth, id, pw);
    })
  );
  document.getElementById("btn-up")?.addEventListener("click", () =>
    run(async () => {
      const id = identity();
      const pw = document.getElementById("pw")?.value || "";
      if (!id || pw.length < 6) throw new Error(t("أكمل البيانات", "Fill all fields"));
      await createUserWithEmailAndPassword(auth, id, pw);
    })
  );
  document.getElementById("btn-google")?.addEventListener("click", () =>
    run(async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    })
  );
  document.getElementById("btn-guest")?.addEventListener("click", () => {
    state.isGuest = true;
    state.me = { uid: "__guest__" };
    state.prof = { name: t("زائر", "Guest") };
    if (onReady) onReady("guest-browse");
  });
  document.getElementById("btn-reset")?.addEventListener("click", async () => {
    try {
      if (authMode === "phone") return toast(t("استعادة الهاتف عبر الدعم", "Phone reset via support"));
      await sendPasswordResetEmail(auth, identity());
      toast(t("تم إرسال رابط الاستعادة", "Reset link sent"));
    } catch (e) {
      toast(e.message || "Error");
    }
  });
  document.getElementById("btn-save-prof")?.addEventListener("click", async () => {
    const name = (document.getElementById("pn")?.value || "").trim();
    if (!name) return toast(t("اكتب اسمك", "Enter your name"));
    const load = loadingOverlay(t("جاري الحفظ…", "Saving…"));
    try {
      const bio = (document.getElementById("pb")?.value || "").trim();
      const data = { name, bio, photo: state.me.photoURL || "", ts: Date.now() };
      await setDoc(doc(db, "users", state.me.uid), data, { merge: true });
      state.prof = Object.assign({ id: state.me.uid }, data);
      if (onReady) onReady("ready");
    } catch (e) {
      toast(e.message || "Error");
    } finally {
      load.hide();
    }
  });
}

export async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    toast(e.message || "Logout failed");
  }
}
