import {
  db,
  auth,
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  limit,
  uploadMedia
} from "./firebase.js";
import { state, t, toast, esc, DEF_AV, ago } from "./state.js";

/** chatWith / chatName held on state for simplicity */
state.chatWith = null;
state.chatName = "";
state.replyTo = null; // { id, t, a }
state.msgs = state.msgs || [];

let typingUnsub = null;
let typingTimer = null;
let typingLast = 0;
let seenMarkTimer = null;

function pairKey(a, b) {
  return [a, b].sort().join("_");
}

export function listenMessages() {
  if (!state.me?.uid || state.me.uid === "__guest__") return;
  // Fast inbox: one query, client-side thread grouping (no N+1)
  const q = query(
    collection(db, "messages"),
    where("members", "array-contains", state.me.uid),
    limit(120)
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      state.msgs = snap.docs
        .map((d) => Object.assign({ id: d.id }, d.data()))
        .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
      window.dispatchEvent(new CustomEvent("hh:data", { detail: "msgs" }));
    },
    (err) => console.warn("[chat] listen", err?.code, err?.message)
  );
  state.unsubs.push(unsub);
}

function peerOf(m) {
  const members = m.members || [];
  return members.find((x) => x !== state.me.uid) || members[0];
}

/** Build inbox threads from flat messages — O(n) */
export function buildThreads() {
  const map = {};
  (state.msgs || []).forEach((m) => {
    const peer = peerOf(m);
    if (!peer) return;
    const prev = map[peer];
    if (!prev || (m.ts || 0) >= (prev.last.ts || 0)) {
      const name =
        (m.names && (m.names[peer] || m.names[state.me.uid])) ||
        state.users.find((u) => u.id === peer)?.name ||
        peer.slice(0, 8);
      map[peer] = {
        peer,
        name: (m.names && m.names[peer]) || name,
        last: m,
        unread: 0
      };
    }
  });
  // unread: messages from peer without my seen
  (state.msgs || []).forEach((m) => {
    const peer = peerOf(m);
    if (!peer || !map[peer]) return;
    if (m.a !== state.me.uid && !(m.seenBy && m.seenBy[state.me.uid])) {
      map[peer].unread++;
    }
  });
  return Object.values(map).sort((a, b) => (b.last.ts || 0) - (a.last.ts || 0));
}

export function inboxHtml() {
  if (state.isGuest) {
    return `<div class="empty"><div class="ico">💬</div><h3>${t("الرسائل", "Messages")}</h3>
      <p>${t("سجّل الدخول لمراسلة الأعضاء.", "Sign in to message members.")}</p>
      <button class="btn" data-act="goto-auth">${t("دخول", "Sign in")}</button></div>`;
  }
  const threads = buildThreads();
  let h = `<div class="row" style="justify-content:space-between;margin-bottom:12px">
    <h2 style="margin:0">💬 ${t("الرسائل", "Messages")}</h2>
  </div>`;
  if (!threads.length) {
    return (
      h +
      `<div class="empty"><div class="ico">✉️</div><h3>${t("لا محادثات بعد", "No chats yet")}</h3>
      <p>${t("ابدأ محادثة من ملف أي عضو عبر زر الرسالة.", "Start a chat from a profile via Message.")}</p></div>`
    );
  }
  h += `<div class="card" style="padding:6px">`;
  threads.forEach((th) => {
    const preview =
      th.last.type === "audio"
        ? "🎙 " + t("رسالة صوتية", "Voice note")
        : String(th.last.t || "").slice(0, 60);
    h += `<button type="button" class="chat-list-item" data-act="open-chat" data-u="${esc(th.peer)}" data-n="${esc(th.name)}">
      <img class="av" src="${esc(state.users.find((u) => u.id === th.peer)?.photo || DEF_AV)}" alt="">
      <div class="preview"><b>${esc(th.name)}</b><span>${esc(preview)}</span></div>
      <div class="meta">
        <div class="note">${ago(th.last.ts)}</div>
        ${th.unread ? `<span class="unread">${th.unread}</span>` : ""}
      </div>
    </button>`;
  });
  h += `</div>`;
  return h;
}

function bubbleHtml(m) {
  const mine = m.a === state.me.uid;
  const seen =
    mine && m.seenBy && Object.keys(m.seenBy).some((uid) => uid !== state.me.uid);
  let body = "";
  if (m.replyTo && m.replyText) {
    body += `<div class="reply-quote">${esc(String(m.replyText).slice(0, 120))}</div>`;
  }
  if (m.type === "audio" && m.media) {
    body += `<div class="voice-msg">🎙 <audio controls preload="metadata" src="${esc(m.media)}"></audio>
      ${m.dur ? `<span class="note">${Math.round(m.dur)}s</span>` : ""}</div>`;
  } else {
    body += esc(m.t || "");
  }
  body += `<span class="time">${ago(m.ts)}${
    mine ? (seen ? ` <span class="seen">✓✓ ${t("تمت القراءة", "Seen")}</span>` : ` <span class="seen">✓</span>`) : ""
  }</span>`;
  if (!mine) {
    body += `<div class="act-row"><button type="button" data-act="reply-msg" data-id="${esc(m.id)}" data-t="${esc(String(m.t || (m.type === "audio" ? "🎙" : "")).slice(0, 80))}" data-a="${esc(m.a)}">${t("رد", "Reply")}</button></div>`;
  } else {
    body += `<div class="act-row"><button type="button" data-act="reply-msg" data-id="${esc(m.id)}" data-t="${esc(String(m.t || "").slice(0, 80))}" data-a="${esc(m.a)}">${t("رد", "Reply")}</button></div>`;
  }
  return `<div class="bubble ${mine ? "me" : "them"}" data-mid="${esc(m.id)}">${body}</div>`;
}

export function chatHtml() {
  const peer = state.chatWith;
  const list = (state.msgs || []).filter((m) => (m.members || []).indexOf(peer) >= 0);
  // mark seen async (debounced)
  scheduleMarkSeen(list);

  let h = `<div class="chat-shell card" style="margin:0">
    <div class="chat-head">
      <button class="btn alt sm" data-act="tab" data-t="msgs">←</button>
      <img class="av" src="${esc(state.users.find((u) => u.id === peer)?.photo || DEF_AV)}" alt="">
      <div style="flex:1;min-width:0">
        <b>${esc(state.chatName || t("محادثة", "Chat"))}</b>
        <div class="typing-line" id="typing-line"><span class="typing-dots"><span></span><span></span><span></span></span> ${t("يكتب الآن…", "typing…")}</div>
      </div>
    </div>
    <div class="chat-thread" id="chat-thread">`;
  if (!list.length) {
    h += `<div class="note" style="margin:auto;text-align:center">${t("ابدأ المحادثة 👋", "Say hello 👋")}</div>`;
  } else {
    list.forEach((m) => {
      h += bubbleHtml(m);
    });
  }
  h += `</div>
    <div class="chat-compose">`;
  if (state.replyTo) {
    h += `<div class="reply-bar">↩ ${esc(String(state.replyTo.t || "").slice(0, 80))}
      <button type="button" class="btn alt sm" data-act="cancel-reply">✕</button></div>`;
  }
  h += `<div class="row">
      <button class="btn alt sm" data-act="rec-msg" title="${t("صوتي", "Voice")}">🎙</button>
      <input type="text" class="input" id="chat-input" maxlength="1000" placeholder="${t("اكتب رسالة…", "Type a message…")}" autocomplete="off">
      <button class="btn sm" data-act="send-msg">${t("إرسال", "Send")}</button>
    </div>
    <div id="voice-rec-ui" class="hidden"></div>
  </div></div>`;
  return h;
}

function scheduleMarkSeen(list) {
  clearTimeout(seenMarkTimer);
  seenMarkTimer = setTimeout(() => markSeen(list), 300);
}

async function markSeen(list) {
  if (!state.me?.uid || !state.chatWith) return;
  const mine = state.me.uid;
  const pending = list.filter(
    (m) => m.a !== mine && !(m.seenBy && m.seenBy[mine]) && m.id
  );
  // limit writes for speed
  const batch = pending.slice(-30);
  await Promise.all(
    batch.map((m) =>
      updateDoc(doc(db, "messages", m.id), {
        ["seenBy." + mine]: Date.now()
      }).catch(() => {})
    )
  );
}

export function openChat(uid, name) {
  if (!uid || uid === state.me?.uid) return;
  state.chatWith = uid;
  state.chatName = name || state.users.find((u) => u.id === uid)?.name || t("عضو", "Member");
  state.replyTo = null;
  state.tab = "chat";
  attachTypingListener(uid);
  window.dispatchEvent(new CustomEvent("hh:data", { detail: "chat" }));
}

function attachTypingListener(peer) {
  if (typingUnsub) {
    try {
      typingUnsub();
    } catch (_) {}
    typingUnsub = null;
  }
  if (!state.me?.uid || !peer) return;
  // peer is typing TO me: doc id peer_me
  const id = peer + "_" + state.me.uid;
  typingUnsub = onSnapshot(doc(db, "typing", id), (snap) => {
    const el = document.getElementById("typing-line");
    if (!el) return;
    const d = snap.exists() ? snap.data() : null;
    const on = d && d.active && Date.now() - (d.ts || 0) < 7000;
    el.classList.toggle("on", !!on);
  });
}

export async function signalTyping(active) {
  if (!state.me?.uid || !state.chatWith) return;
  const id = state.me.uid + "_" + state.chatWith;
  try {
    await setDoc(
      doc(db, "typing", id),
      { from: state.me.uid, to: state.chatWith, active: !!active, ts: Date.now() },
      { merge: true }
    );
  } catch (_) {}
}

export function onChatInput() {
  const now = Date.now();
  if (now - typingLast > 1200) {
    typingLast = now;
    signalTyping(true);
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => signalTyping(false), 2600);
}

export async function sendText(text) {
  text = String(text || "").trim();
  if (!text || !state.chatWith || !state.me?.uid) return;
  await signalTyping(false);
  const members = [state.me.uid, state.chatWith];
  const names = {};
  names[state.me.uid] = state.prof?.name || "";
  names[state.chatWith] = state.chatName || "";
  const payload = {
    a: state.me.uid,
    members,
    names,
    t: text.slice(0, 1000),
    ts: Date.now(),
    type: "text",
    seenBy: { [state.me.uid]: Date.now() }
  };
  if (state.replyTo) {
    payload.replyTo = state.replyTo.id;
    payload.replyText = String(state.replyTo.t || "").slice(0, 120);
  }
  await addDoc(collection(db, "messages"), payload);
  state.replyTo = null;
}

export async function sendVoice(file, dur) {
  if (!state.chatWith || !state.me?.uid) return;
  toast(t("جاري رفع التسجيل…", "Uploading voice…"));
  const url = await uploadMedia(file, "voice");
  const members = [state.me.uid, state.chatWith];
  const names = {};
  names[state.me.uid] = state.prof?.name || "";
  names[state.chatWith] = state.chatName || "";
  const payload = {
    a: state.me.uid,
    members,
    names,
    t: "🎙 " + t("رسالة صوتية", "Voice note"),
    ts: Date.now(),
    type: "audio",
    media: url,
    dur: dur || 0,
    seenBy: { [state.me.uid]: Date.now() }
  };
  if (state.replyTo) {
    payload.replyTo = state.replyTo.id;
    payload.replyText = String(state.replyTo.t || "").slice(0, 120);
  }
  await addDoc(collection(db, "messages"), payload);
  state.replyTo = null;
  toast(t("تم الإرسال", "Sent"));
}

/** Simple MediaRecorder voice note */
export function startVoiceNote() {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      const t0 = Date.now();
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const dur = (Date.now() - t0) / 1000;
        const file = new File([blob], "voice-" + Date.now() + ".webm", {
          type: blob.type
        });
        resolve({ file, dur });
      };
      rec.start();
      // UI stop control
      const ui = document.getElementById("voice-rec-ui");
      if (ui) {
        ui.classList.remove("hidden");
        ui.innerHTML = `<div class="voice-rec">🔴 ${t("جاري التسجيل…", "Recording…")}
          <button type="button" class="btn sm" id="voice-stop">${t("إيقاف وإرسال", "Stop & send")}</button>
          <button type="button" class="btn alt sm" id="voice-cancel">${t("إلغاء", "Cancel")}</button></div>`;
        ui.querySelector("#voice-stop").onclick = () => rec.stop();
        ui.querySelector("#voice-cancel").onclick = () => {
          try {
            rec.onstop = () => {
              stream.getTracks().forEach((tr) => tr.stop());
              reject(new Error("cancelled"));
            };
            rec.stop();
          } catch (_) {
            reject(new Error("cancelled"));
          }
          ui.classList.add("hidden");
          ui.innerHTML = "";
        };
      }
      // auto stop 60s
      setTimeout(() => {
        try {
          if (rec.state === "recording") rec.stop();
        } catch (_) {}
      }, 60000);
    } catch (e) {
      reject(e);
    }
  });
}

export function afterChatRender() {
  const thread = document.getElementById("chat-thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
  const input = document.getElementById("chat-input");
  if (input && !input._bound) {
    input._bound = true;
    input.addEventListener("input", onChatInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.querySelector('[data-act="send-msg"]')?.click();
      }
    });
  }
}

export function unreadCount() {
  if (!state.me?.uid) return 0;
  return (state.msgs || []).filter(
    (m) => m.a !== state.me.uid && !(m.seenBy && m.seenBy[state.me.uid])
  ).length;
}
