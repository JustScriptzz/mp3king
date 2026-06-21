(function () {
  "use strict";

  /* ============== CONFIG ============== */
  const CHAT_KEY = "mp3king_ai_chat";
  const LLM_ENDPOINT = "https://api.llm7.io/v1/chat/completions";
  const LLM_MODEL = "gpt-4o-mini-2024-07-18";
  const IMG_ENDPOINT = "https://image.pollinations.ai/prompt/";
  const AI_NAME = "MP3 AI";

  const IMG_TRIGGER_RE =
    /\b(genera|crea|disegna|fammi|fai|generate|draw|create)\b.{0,25}\b(immagine|foto|disegno|wallpaper|copertina|image|picture|drawing)\b|\bimmagine di\b|\bimage of\b|\bdisegna(mi)?\b/i;

  /* ============== STYLES ============== */
  const style = document.createElement("style");
  style.textContent = `
  #mp3ai-anchor-btn {
    font-family: inherit;
    cursor: pointer;
    border: none;
    outline: none;
  }
  #mp3ai-anchor-btn {
    width: 100%;
    margin-top: 18px;
    background: linear-gradient(180deg, #111 0%, #050505 100%);
    color: #facc15;
    border: 1.5px solid #facc15;
    padding: 13px 16px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 13.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background .15s ease, transform .1s ease, box-shadow .2s ease;
    box-shadow: 0 0 0 0 rgba(250,204,21,.35);
  }
  #mp3ai-anchor-btn:hover { background: #1a1a1a; box-shadow: 0 0 14px rgba(250,204,21,.25); }
  #mp3ai-anchor-btn:active { transform: scale(0.98); }
  .mp3ai-spark { width: 16px; height: 16px; flex-shrink: 0; animation: mp3ai-spin 3.5s linear infinite; }
  @keyframes mp3ai-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

  #mp3ai-overlay {
    position: fixed; inset: 0; z-index: 999999;
    background: radial-gradient(circle at 50% 0%, #161200 0%, #050505 55%);
    display: flex; flex-direction: column;
    opacity: 0; pointer-events: none;
    transform: translateY(14px);
    transition: opacity .25s ease, transform .25s ease;
    font-family: inherit;
  }
  #mp3ai-overlay.mp3ai-open { opacity: 1; pointer-events: auto; transform: translateY(0); }

  #mp3ai-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid #1c1c1c;
    flex-shrink: 0;
    backdrop-filter: blur(6px);
  }
  #mp3ai-header .mp3ai-title-wrap { display: flex; flex-direction: column; gap: 2px; }
  #mp3ai-header .mp3ai-title {
    color: #facc15; font-weight: 800; font-size: 17px; letter-spacing: .3px;
    display: flex; align-items: center; gap: 8px;
    text-shadow: 0 0 18px rgba(250,204,21,.35);
  }
  #mp3ai-header .mp3ai-subtitle {
    color: #6b6b6b; font-size: 11px; font-weight: 500; margin-left: 24px;
  }
  .mp3ai-icon-btn {
    background: transparent; border: none; color: #e5e5e5;
    width: 36px; height: 36px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s ease;
  }
  .mp3ai-icon-btn:active { background: #1a1a1a; }

  #mp3ai-body {
    flex: 1; overflow-y: auto; padding: 18px 16px;
    display: flex; flex-direction: column; gap: 14px;
  }

  #mp3ai-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px; text-align: center; padding: 0 24px;
  }

  /* ---- voxel mascot: built from many tiny cubes, not one block ---- */
  .mp3ai-mascot {
    display: grid;
    grid-template-columns: repeat(7, 12px);
    grid-template-rows: repeat(7, 12px);
    gap: 2px;
    animation: mp3ai-bob 2.4s ease-in-out infinite;
    filter: drop-shadow(0 10px 16px rgba(250,204,21,.18));
  }
  @keyframes mp3ai-bob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-7px) rotate(-1.5deg); } }
  .mp3ai-cube {
    width: 12px; height: 12px; border-radius: 3px;
    background: linear-gradient(155deg, #fde047 0%, #facc15 45%, #d4a309 100%);
    box-shadow: inset -2px -2px 0 rgba(0,0,0,.22), inset 2px 2px 0 rgba(255,255,255,.25);
  }
  .mp3ai-cube.dark {
    background: linear-gradient(155deg, #2b2b2b 0%, #0a0a0a 100%);
    box-shadow: inset -1px -1px 0 rgba(255,255,255,.08);
    animation: mp3ai-blink 4.5s infinite;
  }
  .mp3ai-cube.empty { background: transparent; box-shadow: none; }
  @keyframes mp3ai-blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.15); } }

  #mp3ai-empty h2 {
    color: #f5f5f5; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -.2px;
  }
  #mp3ai-empty p { color: #8a8a8a; font-size: 13px; margin: 0; max-width: 280px; line-height: 1.5; }

  .mp3ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
  .mp3ai-chip {
    background: #131313; border: 1px solid #2a2a2a; color: #e0e0e0;
    font-size: 12px; padding: 9px 14px; border-radius: 999px; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: border-color .15s ease, transform .1s ease;
  }
  .mp3ai-chip:hover { border-color: #facc15; }
  .mp3ai-chip:active { transform: scale(0.96); }

  .mp3ai-msg {
    max-width: 84%;
    padding: 12px 15px;
    border-radius: 18px;
    font-size: 14.5px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    animation: mp3ai-rise .22s ease;
  }
  @keyframes mp3ai-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .mp3ai-msg.user {
    align-self: flex-end;
    background: linear-gradient(135deg, #fde047, #facc15);
    color: #0a0a0a; font-weight: 500;
    border-bottom-right-radius: 4px;
  }
  .mp3ai-msg.assistant {
    align-self: flex-start;
    background: #131313; color: #ececec; border: 1px solid #1e1e1e;
    border-bottom-left-radius: 4px;
  }
  .mp3ai-msg img {
    max-width: 100%; border-radius: 14px; margin-top: 10px; display: block;
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
    display: flex; align-items: flex-end; gap: 10px;
    padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
    border-top: 1px solid #1c1c1c;
    background: #050505;
  }
  #mp3ai-input {
    flex: 1; resize: none; max-height: 110px;
    background: #131313; border: 1.5px solid #262626; color: #f5f5f5;
    border-radius: 20px; padding: 12px 16px; font-size: 14.5px; font-family: inherit;
    outline: none; transition: border-color .15s ease, box-shadow .15s ease;
  }
  #mp3ai-input:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250,204,21,.12); }
  #mp3ai-send {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #fde047, #facc15); color: #0a0a0a; border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    transition: transform .1s ease;
  }
  #mp3ai-send:active { transform: scale(0.92); }
  #mp3ai-send:disabled { opacity: .4; }
  #mp3ai-clear {
    color: #6b6b6b; font-size: 11.5px; background: none; border: none; cursor: pointer;
    transition: color .15s ease;
  }
  #mp3ai-clear:hover { color: #facc15; }
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

  /* ============== CONTEXT GATHERING (full access to user data) ============== */
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
      "Hmm, nothing came to mind, try again."
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
  let overlay, bodyEl, inputEl, sendBtn;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.id = "mp3ai-overlay";
    overlay.innerHTML = `
      <div id="mp3ai-header">
        <div class="mp3ai-title-wrap">
          <div class="mp3ai-title">${svgSpark}${AI_NAME}</div>
          <div class="mp3ai-subtitle">Powered by free AI</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <button id="mp3ai-clear" type="button">Clear chat</button>
          <button class="mp3ai-icon-btn" id="mp3ai-close" type="button">${svgClose}</button>
        </div>
      </div>
      <div id="mp3ai-body"></div>
      <div id="mp3ai-inputbar">
        <textarea id="mp3ai-input" rows="1" placeholder="Ask anything..."></textarea>
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

  /* Voxel mascot: a little character built from many small cubes (not a single block) */
  const MASCOT_PATTERN = [
    ".XXXXX.",
    "XXXXXXX",
    "XXXXXXX",
    "XXOXOXX",
    "XXXXXXX",
    "XOOOOOX",
    ".XXXXX.",
  ];

  function mascotHTML() {
    let cells = "";
    for (const row of MASCOT_PATTERN) {
      for (const ch of row) {
        if (ch === ".") cells += `<div class="mp3ai-cube empty"></div>`;
        else if (ch === "O") cells += `<div class="mp3ai-cube dark"></div>`;
        else cells += `<div class="mp3ai-cube"></div>`;
      }
    }
    return `<div class="mp3ai-mascot">${cells}</div>`;
  }

  function renderEmptyState() {
    const wrap = document.createElement("div");
    wrap.id = "mp3ai-empty";
    wrap.innerHTML = `
      ${mascotHTML()}
      <h2>What's on your mind today?</h2>
      <p>Ask me for music recommendations, get me to generate an image, or just chat.</p>
      <div class="mp3ai-suggestions">
        <button class="mp3ai-chip" data-q="Based on what I listen to, what do you recommend?">Recommend something</button>
        <button class="mp3ai-chip" data-q="Give me a summary of my music taste">My taste</button>
        <button class="mp3ai-chip" data-q="Generate an image inspired by what I'm listening to">Generate image</button>
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
      img.alt = "Generated image";
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
      const msg = "The free model seems to be having a moment, try again in a bit.";
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

  /* ============== ENTRY BUTTON (queue panel only) ============== */
  function makeButtonInner() {
    return `${svgSpark}<span>${AI_NAME}</span>`;
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
