(function () {
  "use strict";

  /* ============== CONFIG ============== */
  const STORE_KEY = "mp3king_ai_chat";
  const LLM_ENDPOINT = "https://api.llm7.io/v1/chat/completions";
  const LLM_MODEL = "gpt-4o-mini-2024-07-18";
  const IMG_ENDPOINT = "https://image.pollinations.ai/prompt/";
  const AI_NAME = "Kingy";
  const ROUTE = "/chat";

  const IMG_TRIGGER_RE =
    /\b(genera|crea|disegna|fammi|fai|generate|draw|create)\b.{0,25}\b(immagine|foto|disegno|wallpaper|copertina|image|picture|drawing)\b|\bimmagine di\b|\bimage of\b|\bdisegna(mi)?\b/i;

  const ACTION_RE = /\[\[ACTION\]\]([\s\S]*?)\[\[\/ACTION\]\]/;

  /* ============== STYLES ============== */
  const style = document.createElement("style");
  style.textContent = `
  #mp3ai-anchor-btn { font-family: inherit; cursor: pointer; border: none; outline: none; }
  #mp3ai-anchor-btn {
    width: 100%; margin-top: 18px;
    background: linear-gradient(180deg, #111 0%, #050505 100%);
    color: #facc15; border: 1.5px solid #facc15;
    padding: 13px 16px; border-radius: 14px;
    font-weight: 700; font-size: 13.5px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background .15s ease, transform .1s ease, box-shadow .2s ease;
  }
  #mp3ai-anchor-btn:hover { background: #1a1a1a; box-shadow: 0 0 14px rgba(250,204,21,.25); }
  #mp3ai-anchor-btn:active { transform: scale(0.98); }
  .mp3ai-spark { width: 16px; height: 16px; flex-shrink: 0; animation: mp3ai-spin 3.5s linear infinite; }
  @keyframes mp3ai-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

  #mp3ai-overlay {
    position: fixed; inset: 0; z-index: 999999;
    background: radial-gradient(circle at 50% 0%, #161200 0%, #050505 55%);
    display: flex; opacity: 0; pointer-events: none;
    transform: translateY(14px);
    transition: opacity .25s ease, transform .25s ease;
    font-family: inherit;
  }
  #mp3ai-overlay.mp3ai-open { opacity: 1; pointer-events: auto; transform: translateY(0); }
  #mp3ai-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  /* ---- sidebar (hamburger menu) ---- */
  #mp3ai-sidebar {
    width: 260px; flex-shrink: 0; background: #0a0a0a; border-right: 1px solid #1c1c1c;
    display: flex; flex-direction: column; transform: translateX(-100%);
    transition: transform .25s ease; position: absolute; top: 0; bottom: 0; left: 0; z-index: 2;
  }
  #mp3ai-sidebar.open { transform: translateX(0); }
  #mp3ai-sidebar-head { padding: 16px; border-bottom: 1px solid #1c1c1c; }
  #mp3ai-new-chat {
    width: 100%; background: #facc15; color: #0a0a0a; border: none; font-weight: 700;
    padding: 10px 12px; border-radius: 12px; cursor: pointer; font-size: 13px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  #mp3ai-chat-list { flex: 1; overflow-y: auto; padding: 8px; }
  .mp3ai-chat-item {
    display: flex; align-items: center; justify-content: space-between; gap: 6px;
    padding: 10px 12px; border-radius: 10px; cursor: pointer; margin-bottom: 2px;
    color: #c9c9c9; font-size: 13px;
  }
  .mp3ai-chat-item:hover { background: #131313; }
  .mp3ai-chat-item.active { background: #1a1a08; color: #facc15; }
  .mp3ai-chat-item span.mp3ai-chat-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mp3ai-chat-del { opacity: .5; flex-shrink: 0; background: none; border: none; color: inherit; cursor: pointer; padding: 2px; }
  .mp3ai-chat-del:hover { opacity: 1; color: #ef4444; }
  #mp3ai-sidebar-backdrop {
    position: absolute; inset: 0; background: rgba(0,0,0,.5); opacity: 0; pointer-events: none;
    transition: opacity .2s ease; z-index: 1;
  }
  #mp3ai-sidebar-backdrop.open { opacity: 1; pointer-events: auto; }

  #mp3ai-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid #1c1c1c; flex-shrink: 0;
  }
  #mp3ai-header .mp3ai-left { display: flex; align-items: center; gap: 10px; }
  #mp3ai-header .mp3ai-title-wrap { display: flex; flex-direction: column; gap: 2px; }
  #mp3ai-header .mp3ai-title {
    color: #facc15; font-weight: 800; font-size: 17px; letter-spacing: .3px;
    display: flex; align-items: center; gap: 8px;
    text-shadow: 0 0 18px rgba(250,204,21,.35);
  }
  #mp3ai-header .mp3ai-subtitle { color: #6b6b6b; font-size: 11px; font-weight: 500; margin-left: 24px; }
  .mp3ai-icon-btn {
    background: transparent; border: none; color: #e5e5e5;
    width: 36px; height: 36px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .15s ease; flex-shrink: 0;
  }
  .mp3ai-icon-btn:active { background: #1a1a1a; }

  #mp3ai-body { flex: 1; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
  #mp3ai-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; padding: 0 24px; }

  .mp3ai-mascot {
    display: grid; grid-template-columns: repeat(7, 12px); grid-template-rows: repeat(8, 12px); gap: 2px;
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

  #mp3ai-empty h2 { color: #f5f5f5; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -.2px; }
  #mp3ai-empty p { color: #8a8a8a; font-size: 13px; margin: 0; max-width: 280px; line-height: 1.5; }

  .mp3ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
  .mp3ai-chip {
    background: #131313; border: 1px solid #2a2a2a; color: #e0e0e0;
    font-size: 12px; padding: 9px 14px; border-radius: 999px; cursor: pointer;
    transition: border-color .15s ease, transform .1s ease;
  }
  .mp3ai-chip:hover { border-color: #facc15; }
  .mp3ai-chip:active { transform: scale(0.96); }

  .mp3ai-row { display: flex; flex-direction: column; max-width: 84%; }
  .mp3ai-row.user { align-self: flex-end; align-items: flex-end; }
  .mp3ai-row.assistant { align-self: flex-start; align-items: flex-start; }

  .mp3ai-msg {
    padding: 12px 15px; border-radius: 18px; font-size: 14.5px; line-height: 1.5;
    white-space: pre-wrap; word-break: break-word; animation: mp3ai-rise .22s ease; cursor: pointer;
  }
  @keyframes mp3ai-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .mp3ai-row.user .mp3ai-msg {
    background: linear-gradient(135deg, #fde047, #facc15); color: #0a0a0a; font-weight: 500;
    border-bottom-right-radius: 4px;
  }
  .mp3ai-row.assistant .mp3ai-msg {
    background: #131313; color: #ececec; border: 1px solid #1e1e1e; border-bottom-left-radius: 4px;
  }
  .mp3ai-msg img { max-width: 100%; border-radius: 14px; margin-top: 10px; display: block; border: 1px solid #2a2a2a; }
  .mp3ai-msg .mp3ai-cursor { display: inline-block; width: 7px; height: 14px; background: #facc15; margin-left: 2px; vertical-align: -2px; animation: mp3ai-caret .8s steps(1) infinite; }
  @keyframes mp3ai-caret { 50% { opacity: 0; } }

  .mp3ai-msg-actions { display: flex; gap: 6px; margin-top: 4px; max-height: 0; overflow: hidden; transition: max-height .18s ease; }
  .mp3ai-row.actions-open .mp3ai-msg-actions { max-height: 40px; }
  .mp3ai-msg-actions button {
    background: #131313; border: 1px solid #2a2a2a; color: #d4d4d4; font-size: 11px;
    padding: 6px 10px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 5px;
  }
  .mp3ai-msg-actions button:hover { border-color: #facc15; color: #facc15; }

  .mp3ai-action-card {
    background: #131313; border: 1.5px solid #facc15; border-radius: 16px;
    padding: 14px; max-width: 84%; align-self: flex-start; font-size: 13.5px; color: #ececec;
    animation: mp3ai-rise .22s ease;
  }
  .mp3ai-action-card .mp3ai-action-label { color: #facc15; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
  .mp3ai-action-card .mp3ai-action-desc { margin-bottom: 12px; line-height: 1.45; }
  .mp3ai-action-buttons { display: flex; gap: 8px; }
  .mp3ai-action-buttons button {
    flex: 1; padding: 9px; border-radius: 10px; font-size: 12.5px; font-weight: 700; border: none; cursor: pointer;
  }
  .mp3ai-approve { background: #facc15; color: #0a0a0a; }
  .mp3ai-cancel { background: #1f1f1f; color: #aaa; }
  .mp3ai-action-result { font-size: 12px; color: #8a8a8a; margin-top: 8px; }

  .mp3ai-typing { display: flex; gap: 4px; padding: 4px 2px; }
  .mp3ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: #facc15; animation: mp3ai-typing 1.1s infinite ease-in-out; }
  .mp3ai-typing span:nth-child(2) { animation-delay: .15s; }
  .mp3ai-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes mp3ai-typing { 0%,60%,100% { transform: translateY(0); opacity:.5; } 30% { transform: translateY(-5px); opacity:1; } }

  #mp3ai-inputbar {
    flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px;
    padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
    border-top: 1px solid #1c1c1c; background: #050505;
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
    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .1s ease;
  }
  #mp3ai-send:active { transform: scale(0.92); }
  #mp3ai-send:disabled { opacity: .4; }

  @media (max-width: 640px) {
    #mp3ai-sidebar { width: 78vw; }
  }
  `;
  document.head.appendChild(style);

  /* ============== ICONS ============== */
  const svgClose = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const svgSpark = `<svg class="mp3ai-spark" viewBox="0 0 24 24" fill="#facc15"><path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z"/></svg>`;
  const svgSend = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2z"/></svg>`;
  const svgMenu = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`;
  const svgCopy = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const svgRedo = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`;
  const svgTrash = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`;
  const svgPlus = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

  /* ============== STORAGE ============== */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadStore() {
    let store = readJSON(STORE_KEY, null);
    if (!store || Array.isArray(store)) {
      // migrate legacy flat-array format (or empty) into new multi-chat format
      const id = uid();
      const chat = { id, title: "New chat", messages: Array.isArray(store) ? store : [], updatedAt: Date.now() };
      store = { activeId: id, chats: { [id]: chat } };
      saveStore(store);
    }
    return store;
  }
  function saveStore(store) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {}
  }
  function getActiveChat(store) {
    return store.chats[store.activeId] || Object.values(store.chats)[0];
  }
  function titleFromText(text) {
    const t = text.trim().slice(0, 40);
    return t.length === text.trim().length ? t : t + "...";
  }

  /* ============== CONTEXT (full access to user data) ============== */
  function buildUserContext() {
    const liked = readJSON("mp3king_liked_tracks", []);
    const stats = readJSON("mp3king_listening_stats", {});
    const profile = readJSON("mp3king_profile", {});
    const playlists = readJSON("mp3king_local_playlists", []);
    const subs = readJSON("mp3king_subscribed_podcasts", []);

    let nowPlaying = "niente in riproduzione";
    try {
      const md = navigator.mediaSession && navigator.mediaSession.metadata;
      if (md && md.title) nowPlaying = `${md.title}${md.artist ? " - " + md.artist : ""}`;
    } catch {}

    const likedList = Array.isArray(liked)
      ? liked.slice(-40).map((t) => `${t.title || t.name || "?"} - ${t.artist || "?"}`).join("; ")
      : "";
    const playlistSummary = Array.isArray(playlists)
      ? playlists.map((p) => `${p.name || "Playlist"} (id:${p.id}, ${(p.tracks || []).length} tracce)`).join("; ")
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
    return `Sei ${AI_NAME}, l'assistente musicale integrato dentro l'app mp3king. Il tuo nome è "${AI_NAME}" e te lo ricordi sempre. Hai accesso completo ai dati di ascolto dell'utente e li usi in modo naturale per consigli personalizzati. Rispondi sempre in italiano a meno che l'utente scriva in un'altra lingua, in modo amichevole, conciso e diretto.

Puoi anche AGIRE davvero sull'app (creare playlist, aggiungere/rimuovere canzoni dalla coda o da una playlist, mettere like). L'utente deve sempre approvare prima che l'azione venga eseguita: tu proponi l'azione, l'app mostra una card di conferma. Per proporre un'azione, scrivi alla fine della tua risposta (dopo aver spiegato brevemente cosa stai per fare) un blocco esatto in questo formato, su una riga sola, con JSON valido:
[[ACTION]]{"action":"<tipo>", ...campi}[[/ACTION]]

Tipi di azione disponibili:
- add_to_queue: {"action":"add_to_queue","query":"titolo canzone artista"}
- play_now: {"action":"play_now","query":"titolo canzone artista"}
- remove_from_queue: {"action":"remove_from_queue","query":"titolo canzone da cercare nella coda attuale"}
- like_track: {"action":"like_track","query":"titolo canzone artista"}
- create_playlist: {"action":"create_playlist","name":"Nome playlist","tracks":["titolo1 artista1","titolo2 artista2"]}  (tracks è opzionale)
- add_to_playlist: {"action":"add_to_playlist","playlistName":"Nome playlist esistente","query":"titolo canzone artista"}

Usa al massimo UN blocco [[ACTION]] per risposta. Se l'utente non ha chiesto di fare qualcosa di concreto sull'app, non includere nessun blocco ACTION, parla e basta.

Dati utente attuali:
${buildUserContext()}`;
  }

  /* ============== TRACK SEARCH (for resolving actions) ============== */
  async function searchTrack(query) {
    try {
      const res = await fetch(
        "https://itunes.apple.com/search?term=" + encodeURIComponent(query) + "&media=music&limit=1"
      );
      const data = await res.json();
      const r = data.results && data.results[0];
      if (!r) return null;
      return {
        id: "itunes-" + r.trackId,
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName || "",
        duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) + "" : "0:00",
        coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "512x512") : "/placeholder.svg",
      };
    } catch {
      return null;
    }
  }

  /* ============== ACTION EXECUTION ============== */
  function actionDescription(a) {
    switch (a.action) {
      case "add_to_queue":
        return `Add "${a.query}" to the queue?`;
      case "play_now":
        return `Play "${a.query}" right now?`;
      case "remove_from_queue":
        return `Remove "${a.query}" from the queue?`;
      case "like_track":
        return `Like "${a.query}"?`;
      case "create_playlist":
        return `Create playlist "${a.name}"${a.tracks && a.tracks.length ? ` with ${a.tracks.length} track(s)` : ""}?`;
      case "add_to_playlist":
        return `Add "${a.query}" to playlist "${a.playlistName}"?`;
      default:
        return "Run this action?";
    }
  }

  async function executeAction(a) {
    const player = window._mp3kingPlayer;
    const data = window._mp3kingData;
    if (!player || !data) throw new Error("App bridge not ready, reload the page.");

    switch (a.action) {
      case "add_to_queue": {
        const track = await searchTrack(a.query);
        if (!track) throw new Error("Track not found.");
        player.addToQueue(track);
        return `Added "${track.title} - ${track.artist}" to the queue.`;
      }
      case "play_now": {
        const track = await searchTrack(a.query);
        if (!track) throw new Error("Track not found.");
        player.addToQueue(track);
        player.playTrack(track);
        return `Now playing "${track.title} - ${track.artist}".`;
      }
      case "remove_from_queue": {
        const q = player.getQueue();
        const match = q.find((t) =>
          (t.title + " " + t.artist).toLowerCase().includes(a.query.toLowerCase())
        );
        if (!match) throw new Error("That track isn't in the queue.");
        player.removeFromQueue(match.id);
        return `Removed "${match.title} - ${match.artist}" from the queue.`;
      }
      case "like_track": {
        const track = await searchTrack(a.query);
        if (!track) throw new Error("Track not found.");
        player.toggleLike(track);
        return `Liked "${track.title} - ${track.artist}".`;
      }
      case "create_playlist": {
        const pl = data.createPlaylist(a.name, "");
        if (a.tracks && a.tracks.length) {
          for (const q of a.tracks.slice(0, 15)) {
            const track = await searchTrack(q);
            if (track) data.addTrackToPlaylist(pl.id, track);
          }
        }
        return `Created playlist "${a.name}".`;
      }
      case "add_to_playlist": {
        const playlists = data.getPlaylists();
        const pl = playlists.find((p) => p.name.toLowerCase() === a.playlistName.toLowerCase());
        if (!pl) throw new Error(`Playlist "${a.playlistName}" not found.`);
        const track = await searchTrack(a.query);
        if (!track) throw new Error("Track not found.");
        data.addTrackToPlaylist(pl.id, track);
        return `Added "${track.title} - ${track.artist}" to "${pl.name}".`;
      }
      default:
        throw new Error("Unknown action.");
    }
  }

  /* ============== LLM CALL (streaming) ============== */
  async function streamLLM(messages, onToken) {
    const res = await fetch(LLM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: LLM_MODEL, messages, seed: -1, temperature: 0.8, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error("LLM error " + res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
          if (delta) {
            full += delta;
            onToken(full);
          }
        } catch {}
      }
    }
    return full;
  }

  function pollinationsImageUrl(prompt) {
    const seedRand = Math.floor(Math.random() * 1e9);
    return (
      IMG_ENDPOINT + encodeURIComponent(prompt) +
      `?model=flux&seed=-1&width=1024&height=1024&nologo=true&rand=${seedRand}`
    );
  }

  /* ============== UI STATE ============== */
  let overlay, bodyEl, inputEl, sendBtn, sidebarEl, chatListEl, backdropEl;
  let prevPath = null;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.id = "mp3ai-overlay";
    overlay.innerHTML = `
      <div id="mp3ai-sidebar-backdrop"></div>
      <div id="mp3ai-sidebar">
        <div id="mp3ai-sidebar-head">
          <button id="mp3ai-new-chat" type="button">${svgPlus}<span>New chat</span></button>
        </div>
        <div id="mp3ai-chat-list"></div>
      </div>
      <div id="mp3ai-main">
        <div id="mp3ai-header">
          <div class="mp3ai-left">
            <button class="mp3ai-icon-btn" id="mp3ai-menu" type="button">${svgMenu}</button>
            <div class="mp3ai-title-wrap">
              <div class="mp3ai-title">${svgSpark}${AI_NAME}</div>
              <div class="mp3ai-subtitle">Powered by Open AI</div>
            </div>
          </div>
          <button class="mp3ai-icon-btn" id="mp3ai-close" type="button">${svgClose}</button>
        </div>
        <div id="mp3ai-body"></div>
        <div id="mp3ai-inputbar">
          <textarea id="mp3ai-input" rows="1" placeholder="Ask anything..."></textarea>
          <button id="mp3ai-send" type="button">${svgSend}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    bodyEl = overlay.querySelector("#mp3ai-body");
    inputEl = overlay.querySelector("#mp3ai-input");
    sendBtn = overlay.querySelector("#mp3ai-send");
    sidebarEl = overlay.querySelector("#mp3ai-sidebar");
    chatListEl = overlay.querySelector("#mp3ai-chat-list");
    backdropEl = overlay.querySelector("#mp3ai-sidebar-backdrop");

    overlay.querySelector("#mp3ai-close").addEventListener("click", closeOverlay);
    overlay.querySelector("#mp3ai-menu").addEventListener("click", toggleSidebar);
    backdropEl.addEventListener("click", closeSidebar);
    overlay.querySelector("#mp3ai-new-chat").addEventListener("click", () => {
      const store = loadStore();
      const id = uid();
      store.chats[id] = { id, title: "New chat", messages: [], updatedAt: Date.now() };
      store.activeId = id;
      saveStore(store);
      renderSidebar();
      renderMessages();
      closeSidebar();
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

  function toggleSidebar() {
    sidebarEl.classList.toggle("open");
    backdropEl.classList.toggle("open");
  }
  function closeSidebar() {
    sidebarEl.classList.remove("open");
    backdropEl.classList.remove("open");
  }

  function renderSidebar() {
    const store = loadStore();
    const chats = Object.values(store.chats).sort((a, b) => b.updatedAt - a.updatedAt);
    chatListEl.innerHTML = "";
    chats.forEach((c) => {
      const item = document.createElement("div");
      item.className = "mp3ai-chat-item" + (c.id === store.activeId ? " active" : "");
      item.innerHTML = `<span class="mp3ai-chat-title">${escapeHtml(c.title || "New chat")}</span><button class="mp3ai-chat-del" type="button">${svgTrash}</button>`;
      item.addEventListener("click", (e) => {
        if (e.target.closest(".mp3ai-chat-del")) return;
        const s = loadStore();
        s.activeId = c.id;
        saveStore(s);
        renderSidebar();
        renderMessages();
        closeSidebar();
      });
      item.querySelector(".mp3ai-chat-del").addEventListener("click", (e) => {
        e.stopPropagation();
        const s = loadStore();
        delete s.chats[c.id];
        if (!Object.keys(s.chats).length) {
          const id = uid();
          s.chats[id] = { id, title: "New chat", messages: [], updatedAt: Date.now() };
          s.activeId = id;
        } else if (s.activeId === c.id) {
          s.activeId = Object.values(s.chats).sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
        }
        saveStore(s);
        renderSidebar();
        renderMessages();
      });
      chatListEl.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* Voxel mascot */
  const MASCOT_PATTERN = [
    "XX...XX",
    "XXX.XXX",
    "XXXXXXX",
    "XXXXXXX",
    "XOXXXOX",
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
      <p>Ask me for music recommendations, get me to take action on your library, or generate an image.</p>
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

  function buildMessageRow(msg) {
    const row = document.createElement("div");
    row.className = "mp3ai-row " + msg.role;
    row.dataset.id = msg.id;

    const bubble = document.createElement("div");
    bubble.className = "mp3ai-msg";
    bubble.textContent = msg.content;
    row.appendChild(bubble);

    if (msg.image) {
      const img = document.createElement("img");
      img.src = msg.image;
      img.alt = "Generated image";
      bubble.appendChild(img);
    }

    if (msg.role === "user") {
      const actions = document.createElement("div");
      actions.className = "mp3ai-msg-actions";
      actions.innerHTML = `<button type="button" class="mp3ai-act-copy">${svgCopy}Copy</button><button type="button" class="mp3ai-act-resend">${svgRedo}Resend</button>`;
      row.appendChild(actions);
      bubble.addEventListener("click", () => row.classList.toggle("actions-open"));
      actions.querySelector(".mp3ai-act-copy").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard && navigator.clipboard.writeText(msg.content).catch(() => {});
      });
      actions.querySelector(".mp3ai-act-resend").addEventListener("click", (e) => {
        e.stopPropagation();
        resendFrom(msg.id);
      });
    }
    return row;
  }

  function buildActionCard(action) {
    const card = document.createElement("div");
    card.className = "mp3ai-action-card";
    card.innerHTML = `
      <div class="mp3ai-action-label">${AI_NAME} wants to</div>
      <div class="mp3ai-action-desc">${escapeHtml(actionDescription(action))}</div>
      <div class="mp3ai-action-buttons">
        <button type="button" class="mp3ai-approve">Approve</button>
        <button type="button" class="mp3ai-cancel">Cancel</button>
      </div>
    `;
    card.querySelector(".mp3ai-cancel").addEventListener("click", () => {
      card.querySelector(".mp3ai-action-buttons").remove();
      const res = document.createElement("div");
      res.className = "mp3ai-action-result";
      res.textContent = "Cancelled.";
      card.appendChild(res);
    });
    card.querySelector(".mp3ai-approve").addEventListener("click", async () => {
      const btns = card.querySelector(".mp3ai-action-buttons");
      btns.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const result = await executeAction(action);
        btns.remove();
        const res = document.createElement("div");
        res.className = "mp3ai-action-result";
        res.textContent = "✓ " + result;
        card.appendChild(res);
      } catch (err) {
        btns.remove();
        const res = document.createElement("div");
        res.className = "mp3ai-action-result";
        res.textContent = "✗ " + (err.message || "Something went wrong.");
        card.appendChild(res);
      }
    });
    return card;
  }

  function renderMessages() {
    const store = loadStore();
    const chat = getActiveChat(store);
    bodyEl.innerHTML = "";
    if (!chat.messages.length) {
      renderEmptyState();
      return;
    }
    chat.messages.forEach((m) => {
      bodyEl.appendChild(buildMessageRow(m));
      if (m.role === "assistant" && m.pendingAction) {
        bodyEl.appendChild(buildActionCard(m.pendingAction));
      }
    });
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "mp3ai-row assistant";
    div.id = "mp3ai-typing-row";
    div.innerHTML = `<div class="mp3ai-msg"><div class="mp3ai-typing"><span></span><span></span><span></span></div></div>`;
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  async function resendFrom(userMsgId) {
    const store = loadStore();
    const chat = getActiveChat(store);
    const idx = chat.messages.findIndex((m) => m.id === userMsgId);
    if (idx === -1) return;
    const userText = chat.messages[idx].content;
    // drop everything after this user message (the old answer), keep the prompt itself
    chat.messages = chat.messages.slice(0, idx + 1);
    saveStore(store);
    await runAssistantTurn(userText);
  }

  async function runAssistantTurn(latestUserText) {
    sendBtn.disabled = true;
    const store = loadStore();
    const chat = getActiveChat(store);
    renderMessages();
    const typingRow = showTyping();
    const bubble = typingRow.querySelector(".mp3ai-msg");

    const wantsImage = IMG_TRIGGER_RE.test(latestUserText);
    let imageUrl = null;
    if (wantsImage) {
      imageUrl = pollinationsImageUrl(latestUserText);
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = imageUrl;
      });
    }

    try {
      const messages = [
        { role: "system", content: systemPrompt() },
        ...chat.messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
      ];
      let lastRendered = "";
      const full = await streamLLM(messages, (partial) => {
        const display = partial.replace(ACTION_RE, "").trimEnd();
        if (display !== lastRendered) {
          lastRendered = display;
          bubble.innerHTML = "";
          bubble.appendChild(document.createTextNode(display));
          const caret = document.createElement("span");
          caret.className = "mp3ai-cursor";
          bubble.appendChild(caret);
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }
      });

      let visibleText = full;
      let pendingAction = null;
      const match = full.match(ACTION_RE);
      if (match) {
        visibleText = full.replace(ACTION_RE, "").trim();
        try {
          pendingAction = JSON.parse(match[1].trim());
        } catch {
          pendingAction = null;
        }
      }

      const s2 = loadStore();
      const c2 = getActiveChat(s2);
      const assistantMsg = { id: uid(), role: "assistant", content: visibleText || "...", image: imageUrl || undefined, pendingAction: pendingAction || undefined };
      c2.messages.push(assistantMsg);
      c2.updatedAt = Date.now();
      saveStore(s2);
      renderMessages();
    } catch (err) {
      const s2 = loadStore();
      const c2 = getActiveChat(s2);
      c2.messages.push({ id: uid(), role: "assistant", content: "The free model seems to be having a moment, try again in a bit." });
      saveStore(s2);
      renderMessages();
      console.error("Kingy error:", err);
    } finally {
      sendBtn.disabled = false;
      const tr = document.getElementById("mp3ai-typing-row");
      if (tr) tr.remove();
    }
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    inputEl.style.height = "auto";

    const store = loadStore();
    const chat = getActiveChat(store);
    chat.messages.push({ id: uid(), role: "user", content: text });
    if (chat.messages.filter((m) => m.role === "user").length === 1) {
      chat.title = titleFromText(text);
    }
    chat.updatedAt = Date.now();
    saveStore(store);
    renderSidebar();

    await runAssistantTurn(text);
  }

  /* ============== OPEN/CLOSE + soft /chat route ============== */
  function openOverlay(pushUrl) {
    if (!overlay) createOverlay();
    renderSidebar();
    renderMessages();
    overlay.classList.add("mp3ai-open");
    if (pushUrl !== false && location.pathname !== ROUTE) {
      prevPath = location.pathname + location.search;
      history.pushState({ mp3ai: true }, "", ROUTE);
    }
    setTimeout(() => inputEl && inputEl.focus(), 200);
  }
  function closeOverlay(skipNav) {
    if (overlay) overlay.classList.remove("mp3ai-open");
    closeSidebar();
    if (!skipNav && location.pathname === ROUTE) {
      history.pushState({}, "", prevPath || "/");
    }
  }

  window.addEventListener("popstate", () => {
    if (location.pathname === ROUTE) {
      openOverlay(false);
    } else {
      closeOverlay(true);
    }
  });

  /* ============== ENTRY BUTTON (queue panel) ============== */
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
    btn.addEventListener("click", () => openOverlay());
    container.appendChild(btn);
    return true;
  }

  function init() {
    if (!tryMountAnchorButton()) {
      const observer = new MutationObserver(() => tryMountAnchorButton());
      observer.observe(document.body, { childList: true, subtree: true });
    }
    if (location.pathname === ROUTE) {
      setTimeout(() => openOverlay(false), 50);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
