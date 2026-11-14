import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyAUlBb4PTSSFTAds01-ZlozcM5Lc1Wt0hY",
  authDomain: "hashid-net.firebaseapp.com",
  projectId: "hashid-net",
  storageBucket: "hashid-net.firebasestorage.app",
  messagingSenderId: "461441652861",
  appId: "1:461441652861:web:d73f46fc672104be8fb914"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
};

/** Media upload via existing Worker proxy (/media) */
export async function uploadMedia(file, folder) {
  if (!auth.currentUser) throw new Error("Login required");
  const token = await auth.currentUser.getIdToken();
  const base = (window.HH_MEDIA_API || "/media").replace(/\/$/, "");
  const publicBase = (window.HH_MEDIA_PUBLIC || window.HH_MEDIA_API || "/media").replace(/\/$/, "");

  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", base + "/upload");
    x.setRequestHeader("Authorization", "Bearer " + token);
    x.timeout = 5 * 60 * 1000;
    x.onload = () => {
      let j = {};
      try {
        j = JSON.parse(x.responseText);
      } catch (_) {}
      if (x.status >= 200 && x.status < 300 && (j.path || j.url)) {
        resolve(j.path ? publicBase + j.path : j.url);
      } else {
        reject(new Error(j.message || "Upload failed (" + x.status + ")"));
      }
    };
    x.onerror = () => reject(new Error("Media network error"));
    x.ontimeout = () => reject(new Error("Upload timeout"));
    const fd = new FormData();
    fd.append("folder", folder || "posts");
    fd.append("file", file, file.name || "media");
    x.send(fd);
  });
}
