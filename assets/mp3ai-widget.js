(function () {
  "use strict";

  /* ============== CONFIG ============== */
  const CHAT_KEY = "mp3king_ai_chat";
  const LLM_ENDPOINT = "https://api.llm7.io/v1/chat/completions";
  const LLM_MODEL = "gpt-4o-mini-2024-07-18";
  const IMG_ENDPOINT = "https://image.pollinations.ai/prompt/";
  const AI_NAME = "MP3 AI";

  const IMG_TRIGGER_RE =
    /\b(genera|crea|disegna|fammi|fai)\b.{0,25}\b(immagine|foto|disegno|wallpaper|copertina)\b|\bimmagine di\b|\bdisegna(mi)?\b/i;

  /* ============== STYLES ============== */
  const style = document.createElement("style");
  style.textContent = `
  #mp3ai-fab, #mp3ai-anchor-btn {
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
  }
  #mp3ai-fab {
    position: fixed;
    right: 18px;
    bottom: 88px;
    z-index: 99998;
    background: #0a0a0a;
    color: #facc15;
    border: 1.5px solid #facc15;
    padding: 11px 16px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.5), 0 4px 14px rgba(0,0,0,.4);
    animation: mp3ai-pulse 2.6s infinite;
    transition: transform .15s ease;
  }
  #mp3ai-fab:active { transform: scale(0.94); }
  @keyframes mp3ai-pulse {
    0% { box-shadow: 0 0 0 0 rgba(250,204,21,.45), 0 4px 14px rgba(0,0,0,.4); }
    70% { box-shadow: 0 0 0 10px rgba(250,204,21,0), 0 4px 14px rgba(0,0,0,.4); }
    100% { box-shadow: 0 0 0 0 rgba(250,204,21,0), 0 4px 14px rgba(0,0,0,.4); }
  }
  #mp3ai-anchor-btn {
    width: 100%;
    margin-top: 18px;
    background: #0a0a0a;
    color: #facc15;
    border: 1.5px solid #facc15;
    padding: 12px 16px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 13.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background .15s ease, transform .1s ease;
  }
  #mp3ai-anchor-btn:hover { background: #1a1a1a; }
  #mp3ai-anchor-btn:active { transform: scale(0.98); }
  .mp3ai-spark { width: 16px; height: 16px; flex-shrink: 0; animation: mp3ai-spin 3.5s linear infinite; }
  @keyframes mp3ai-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

  #mp3ai-overlay {
    position: fixed; inset: 0; z-index: 999999;
    background: #050505;
    display: flex; flex-direction: column;
    opacity: 0; pointer-events: none;
    transition: opacity .22s ease;
    font-family: inherit;
  }
  #mp3ai-overlay.mp3ai-open { opacity: 1; pointer-events: auto; }

  #mp3ai-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #1c1c1c;
    flex-shrink: 0;
  }
  #mp3ai-header .mp3ai-title {
    color: #facc15; font-weight: 800; font-size: 16px; letter-spacing: .3px;
    display: flex; align-items: center; gap: 8px;
  }
  .mp3ai-icon-btn {
    background: transparent; border: none; color: #e5e5e5;
    width: 36px; height: 36px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .mp3ai-icon-btn:active { background: #1a1a1a; }

  #mp3ai-body {
    flex: 1; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 14px;
  }

  #mp3ai-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; text-align: center; padding: 0 24px;
  }

  .mp3ai-mascot {
    width: 84px; height: 84px; position: relative;
    animation: mp3ai-bob 2.4s ease-in-out infinite;
  }
  @keyframes mp3ai-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .mp3ai-mascot-body {
    width: 100%; height: 100%;
    background: linear-gradient(150deg, #facc15, #eab308);
    border-radius: 22px;
    border: 3px solid #0a0a0a;
    position: relative;
    box-shadow: inset 0 -6px 0 rgba(0,0,0,.15), 0 8px 18px rgba(250,204,21,.18);
  }
  .mp3ai-eye {
    position: absolute; top: 32px; width: 12px; height: 12px;
    background: #0a0a0a; border-radius: 50%;
    animation: mp3ai-blink 4.2s infinite;
  }
  .mp3ai-eye.l { left: 22px; }
  .mp3ai-eye.r { right: 22px; }
  @keyframes mp3ai-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
  .mp3ai-mouth {
    position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
    width: 22px; height: 10px; border-radius: 0 0 10px 10px;
    border: 3px solid #0a0a0a; border-top: none;
  }
  .mp3ai-note {
    position: absolute; top: -14px; right: -6px; font-size: 18px;
    animation: mp3ai-float 2.4s ease-in-out infinite;
  }
  @keyframes mp3ai-float { 0%,100% { transform: translateY(0) rotate(-8deg); opacity: .85; } 50% { transform: translateY(-6px) rotate(8deg); opacity: 1; } }

  #mp3ai-empty h2 {
    color: #f5f5f5; font-size: 21px; font-weight: 700; margin: 0;
  }
  #mp3ai-empty p { color: #8a8a8a; font-size: 13px; margin: 0; max-width: 280px; }

  .mp3ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px; }
  .mp3ai-chip {
    background: #131313; border: 1px solid #2a2a2a; color: #d4d4d4;
    font-size: 12px; padding: 8px 12px; border-radius: 999px; cursor: pointer;
  }
  .mp3ai-chip:active { background: #1d1d1d; }

  .mp3ai-msg {
    max-width: 84%;
    padding: 11px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    animation: mp3ai-rise .22s ease;
  }
  @keyframes mp3ai-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .mp3ai-msg.user {
    align-self: flex-end;
    background: #facc15; color: #0a0a0a; font-weight: 500;
    border-bottom-right-radius: 4px;
  }
  .mp3ai-msg.assistant {
    align-self: flex-start;
    background: #131313; color: #ececec; border: 1px solid #1e1e1e;
    border-bottom-left-radius: 4px;
  }
  .mp3ai-msg img {
    max-width: 100%; border-radius: 12px; margin-top: 8px; display: block;
    border: 1px solid #2a2a2a;
  }
  .mp3ai-typing { display: flex; gap: 4px; padding: 4px 2px; }
  .mp3ai-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: #facc15;
    animation: mp3ai-typing 1.1s infinite ease-in-out;
  }
  .mp3ai-typing span:nth-child(2) { animation-delay: .15s; }
  .mp3ai-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes mp3ai-typing { 0%,60%,100% { transform: translateY(0); opacity:.5; } 30% { transform: translateY(-5px); opacity:1; } }

  #mp3ai-inputbar {
    flex-shrink: 0;
    display: flex; align-items: flex-end; gap: 8px;
    padding: 10px 12px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid #1c1c1c;
    background: #050505;
  }
  #mp3ai-input {
    flex: 1; resize: none; max-height: 110px;
    background: #131313; border: 1px solid #262626; color: #f5f5f5;
    border-radius: 18px; padding: 11px 14px; font-size: 14px; font-family: inherit;
    outline: none;
  }
  #mp3ai-input:focus { border-color: #facc15; }
  #mp3ai-send {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: #facc15; color: #0a0a0a; border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  #mp3ai-send:disabled { opacity: .4; }
  #mp3ai-clear {
    color: #6b6b6b; font-size: 11.5px; background: none; border: none; cursor: pointer;
  }
  `;
  document.head.appendChild(style);

  /* ============== ICONS (inline SVG, no external assets) ============== */
  const svgClose = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const svgSpark = `<svg class="mp3ai-spark" viewBox="0 0 24 24" fill="#facc15"><path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z"/></svg>`;
  const svgSend = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2z"/></svg>`;

  /* ============== STORAGE HELPERS ============== */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadHistory() {
    return readJSON(CHAT_KEY, []);
  }
  function saveHistory(history) {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-60)));
    } catch {}
  }

  /* ============== CONTEXT GATHERING (full access ai dati utente) ============== */
  function buildUserContext() {
    const liked = readJSON("mp3king_liked_tracks", []);
    const stats = readJSON("mp3king_listening_stats", {});
    const profile = readJSON("mp3king_profile", {});
    const playlists = readJSON("mp3king_local_playlists", []);
    const subs = readJSON("mp3king_subscribed_podcasts", []);

    let nowPlaying = "niente in riproduzione";
    try {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      if (md && md.title) {
        nowPlaying = `${md.title}${md.artist ? " - " + md.artist : ""}`;
      }
    } catch {}

    const likedList = Array.isArray(liked)
      ? liked
          .slice(-40)
          .map((t) => `${t.title || t.name || "?"} - ${t.artist || "?"}`)
          .join("; ")
      : "";

    const playlistSummary = Array.isArray(playlists)
      ? playlists.map((p) => `${p.name || "Playlist"} (${(p.tracks || []).length} tracce)`).join("; ")
      : "";

    return [
      `Nome utente/profilo: ${profile && profile.name ? profile.name : "non impostato"}.`,
      `In riproduzione ora: ${nowPlaying}.`,
      `Statistiche ascolto: ${stats && stats.totalTracks ? stats.totalTracks : 0} tracce totali, ${
        stats && stats.totalSeconds ? Math.round(stats.totalSeconds / 60) : 0
      } minuti totali, ${stats && stats.sessionsCount ? stats.sessionsCount : 0} sessioni.`,
      `Canzoni che piacciono all'utente (le più recenti): ${likedList || "nessuna ancora"}.`,
      `Playlist locali dell'utente: ${playlistSummary || "nessuna"}.`,
      `Podcast seguiti: ${Array.isArray(subs) ? subs.length : 0}.`,
    ].join("\n");
  }

  function systemPrompt() {
    return `Sei ${AI_NAME}, l'assistente musicale integrato dentro l'app mp3king. Il tuo nome è "${AI_NAME}" e te lo ricordi sempre se ti viene chiesto. Hai accesso completo ai dati di ascolto dell'utente (canzoni che gli piacciono, statistiche di ascolto, playlist, cosa sta ascoltando ora) e li usi in modo naturale per dare consigli musicali personalizzati, scoprire pattern nei suoi gusti, suggerire nuovi artisti o semplicemente chiacchierare di musica. Rispondi sempre in italiano a meno che l'utente scriva in un'altra lingua, in modo amichevole, conciso e diretto, senza essere robotico. Puoi anche generare immagini quando l'utente te lo chiede esplicitamente (es. copertine, fan art, immagini a tema): in quel caso l'app si occupa già di generare l'immagine, tu devi solo rispondere in modo naturale come se l'avessi creata tu.

Dati utente attuali:
${buildUserContext()}`;
  }

  /* ============== LLM CALL ============== */
  async function callLLM(history) {
    const messages = [
      { role: "system", content: systemPrompt() },
      ...history.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    ];
    const res = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        seed: -1,
        temperature: 0.8,
      }),
    });
    if (!res.ok) throw new Error("LLM error " + res.status);
    const data = await res.json();
    return (
      (data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
      "Mmh non mi è venuto in mente niente, riprova."
    );
  }

  function pollinationsImageUrl(prompt) {
    const seedRand = Math.floor(Math.random() * 1e9);
    return (
      IMG_ENDPOINT +
      encodeURIComponent(prompt) +
      `?model=flux&seed=-1&width=1024&height=1024&nologo=true&rand=${seedRand}`
    );
  }

  /* ============== UI BUILD ============== */
  let overlay, bodyEl, inputEl, sendBtn, emptyEl;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.id = "mp3ai-overlay";
    overlay.innerHTML = `
      <div id="mp3ai-header">
        <div class="mp3ai-title">${svgSpark}${AI_NAME}</div>
        <div style="display:flex;gap:4px;align-items:center;">
          <button id="mp3ai-clear" type="button">Cancella chat</button>
          <button class="mp3ai-icon-btn" id="mp3ai-close" type="button">${svgClose}</button>
        </div>
      </div>
      <div id="mp3ai-body"></div>
      <div id="mp3ai-inputbar">
        <textarea id="mp3ai-input" rows="1" placeholder="Scrivi qualcosa..."></textarea>
        <button id="mp3ai-send" type="button">${svgSend}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    bodyEl = overlay.querySelector("#mp3ai-body");
    inputEl = overlay.querySelector("#mp3ai-input");
    sendBtn = overlay.querySelector("#mp3ai-send");

    overlay.querySelector("#mp3ai-close").addEventListener("click", closeOverlay);
    overlay.querySelector("#mp3ai-clear").addEventListener("click", () => {
      saveHistory([]);
      renderMessages();
    });
    sendBtn.addEventListener("click", handleSend);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
    });
  }

  function mascotHTML() {
    return `
      <div class="mp3ai-mascot">
        <div class="mp3ai-mascot-body">
          <div class="mp3ai-eye l"></div>
          <div class="mp3ai-eye r"></div>
          <div class="mp3ai-mouth"></div>
        </div>
        <div class="mp3ai-note">&#9835;</div>
      </div>`;
  }

  function renderEmptyState() {
    const wrap = document.createElement("div");
    wrap.id = "mp3ai-empty";
    wrap.innerHTML = `
      ${mascotHTML()}
      <h2>What's on your mind today?</h2>
      <p>Chiedimi consigli sui tuoi gusti musicali, fammi generare un'immagine o chiacchieriamo e basta.</p>
      <div class="mp3ai-suggestions">
        <button class="mp3ai-chip" data-q="Basandoti sui miei ascolti, cosa mi consigli?">Consigliami qualcosa</button>
        <button class="mp3ai-chip" data-q="Fammi un riassunto dei miei gusti musicali">I miei gusti</button>
        <button class="mp3ai-chip" data-q="Genera un'immagine ispirata a quello che sto ascoltando">Genera immagine</button>
      </div>
    `;
    wrap.querySelectorAll(".mp3ai-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        inputEl.value = chip.dataset.q;
        handleSend();
      });
    });
    bodyEl.appendChild(wrap);
  }

  function addMessageBubble(role, content, imageUrl) {
    const div = document.createElement("div");
    div.className = "mp3ai-msg " + role;
    const textNode = document.createElement("div");
    textNode.textContent = content;
    div.appendChild(textNode);
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "Immagine generata";
      div.appendChild(img);
    }
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  function renderMessages() {
    bodyEl.innerHTML = "";
    const history = loadHistory();
    if (!history.length) {
      renderEmptyState();
      return;
    }
    history.forEach((m) => addMessageBubble(m.role, m.content, m.image));
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "mp3ai-msg assistant";
    div.id = "mp3ai-typing-bubble";
    div.innerHTML = `<div class="mp3ai-typing"><span></span><span></span><span></span></div>`;
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById("mp3ai-typing-bubble");
    if (el) el.remove();
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    sendBtn.disabled = true;

    const history = loadHistory();
    history.push({ role: "user", content: text });
    saveHistory(history);

    bodyEl.innerHTML = "";
    history.forEach((m) => addMessageBubble(m.role, m.content, m.image));
    showTyping();

    const wantsImage = IMG_TRIGGER_RE.test(text);

    try {
      let imageUrl = null;
      if (wantsImage) {
        imageUrl = pollinationsImageUrl(text);
        // preload so it's ready when shown
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = imageUrl;
        });
      }
      const reply = await callLLM(history);
      hideTyping();
      const newHistory = loadHistory();
      newHistory.push({ role: "assistant", content: reply, image: imageUrl || undefined });
      saveHistory(newHistory);
      addMessageBubble("assistant", reply, imageUrl);
    } catch (err) {
      hideTyping();
      const msg = "Mi sa che il modello gratuito sta avendo un momento no, riprova tra un attimo.";
      const newHistory = loadHistory();
      newHistory.push({ role: "assistant", content: msg });
      saveHistory(newHistory);
      addMessageBubble("assistant", msg);
      console.error("MP3 AI error:", err);
    } finally {
      sendBtn.disabled = false;
    }
  }

  function openOverlay() {
    if (!overlay) createOverlay();
    renderMessages();
    overlay.classList.add("mp3ai-open");
    setTimeout(() => inputEl && inputEl.focus(), 200);
  }
  function closeOverlay() {
    if (overlay) overlay.classList.remove("mp3ai-open");
  }

  /* ============== ENTRY BUTTON(S) ============== */
  function makeButtonInner() {
    return `${svgSpark}<span>${AI_NAME}</span>`;
  }

  function ensureFab() {
    if (document.getElementById("mp3ai-fab")) return;
    const btn = document.createElement("button");
    btn.id = "mp3ai-fab";
    btn.type = "button";
    btn.innerHTML = makeButtonInner();
    btn.addEventListener("click", openOverlay);
    document.body.appendChild(btn);
  }

  function tryMountAnchorButton() {
    if (document.getElementById("mp3ai-anchor-btn")) return true;
    const heading = Array.from(document.querySelectorAll("h1,h2,h3,div,span")).find(
      (el) => el.children.length === 0 && el.textContent.trim() === "Queue"
    );
    if (!heading) return false;
    let container = heading.parentElement;
    while (container && container.parentElement && container.clientHeight < 80 && container.parentElement !== document.body) {
      container = container.parentElement;
    }
    if (!container) return false;
    const btn = document.createElement("button");
    btn.id = "mp3ai-anchor-btn";
    btn.type = "button";
    btn.innerHTML = makeButtonInner();
    btn.addEventListener("click", openOverlay);
    container.appendChild(btn);
    return true;
  }

  function init() {
    ensureFab();
    if (!tryMountAnchorButton()) {
      const observer = new MutationObserver(() => {
        tryMountAnchorButton();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
