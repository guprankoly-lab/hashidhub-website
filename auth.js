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

let onReady = null;

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
    try {
      f();
    } catch (_) {}
  });
  state.unsubs = [];
}

export function authView() {
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Hashid<span class="brand">Hub</span> 3.0</h1>
      <p class="note">${t("تواصل · أنشئ · انطلق", "Connect · Create · Grow")}</p>
      <div class="col" style="margin-top:14px">
        <input class="input" id="em" type="email" placeholder="${t("البريد", "Email")}" dir="ltr">
        <input class="input" id="pw" type="password" placeholder="${t("كلمة المرور", "Password")}" dir="ltr">
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
  const $ = (id) => document.getElementById(id);
  $("btn-in")?.addEventListener("click", async () => {
    try {
      await signInWithEmailAndPassword(auth, $("em").value.trim(), $("pw").value);
    } catch (e) {
      toast(e.message || "Error");
    }
  });
  $("btn-up")?.addEventListener("click", async () => {
    try {
      await createUserWithEmailAndPassword(auth, $("em").value.trim(), $("pw").value);
    } catch (e) {
      toast(e.message || "Error");
    }
  });
  $("btn-google")?.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      toast(e.message || "Error");
    }
  });
  $("btn-guest")?.addEventListener("click", () => {
    state.isGuest = true;
    state.me = { uid: "__guest__" };
    state.prof = { name: t("زائر", "Guest") };
    if (onReady) onReady("guest-browse");
  });
  $("btn-reset")?.addEventListener("click", async () => {
    try {
      await sendPasswordResetEmail(auth, $("em").value.trim());
      toast(t("تم إرسال رابط الاستعادة", "Reset link sent"));
    } catch (e) {
      toast(e.message || "Error");
    }
  });
  $("btn-save-prof")?.addEventListener("click", async () => {
    const name = ($("pn")?.value || "").trim();
    if (!name) return toast(t("اكتب اسمك", "Enter your name"));
    const bio = ($("pb")?.value || "").trim();
    const data = { name, bio, photo: state.me.photoURL || "", ts: Date.now() };
    await setDoc(doc(db, "users", state.me.uid), data, { merge: true });
    state.prof = Object.assign({ id: state.me.uid }, data);
    if (onReady) onReady("ready");
  });
}

export async function doLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    toast(e.message || "Logout failed");
  }
}
