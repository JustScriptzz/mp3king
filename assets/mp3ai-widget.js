(function () {
  "use strict";

  /* ============================================================
     CONFIG
  ============================================================ */
  const STORE_KEY        = "mp3king_ai_chat";
  const MODEL_READY_KEY  = "mp3king_kingy_q25_05b";
  const AI_NAME          = "Kingy";
  const ROUTE            = "/chat";
  const ROUTE_CHAT = id => `/chat/${id}`;

  const WLLAMA_CDN  = "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/";
  const MODEL_URL   = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";
  const IMG_ENDPOINT = "https://image.pollinations.ai/prompt/";
  const ACTION_RE    = /\[\[ACTION\]\]([\s\S]*?)\[\[\/ACTION\]\]/;
  const IMG_TRIGGER_RE = /\b(genera|crea|disegna|fammi|fai|generate|draw|create)\b.{0,25}\b(immagine|foto|disegno|wallpaper|copertina|image|picture|drawing)\b|\bimmagine di\b|\bimage of\b|\bdisegna(mi)?\b/i;

  /* ============================================================
     LOCAL MODEL STATE
  ============================================================ */
  let _wllama      = null;
  let _modelState  = "idle";   // idle | loading | ready | error
  let _modelPromise = null;
  let _lastError   = "";

  async function loadModel(onProgress) {
    if (_modelState === "ready") return true;
    if (_modelPromise) { await _modelPromise; return _modelState === "ready"; }

    _modelState = "loading";
    _modelPromise = (async () => {
      try {
        const mod = await import(WLLAMA_CDN + "index.js");
        const Wllama = mod.Wllama || mod.default?.Wllama || mod.default;
        _wllama = new Wllama({
          "single-thread/wllama.wasm": WLLAMA_CDN + "single-thread/wllama.wasm",
          "multi-thread/wllama.wasm":  WLLAMA_CDN + "multi-thread/wllama.wasm",
        });
        await _wllama.loadModelFromUrl(MODEL_URL, {
          n_ctx: 2048,
          progressCallback: ({ loaded, total }) => onProgress && onProgress(loaded, total),
        });
        _modelState = "ready";
        localStorage.setItem(MODEL_READY_KEY, "1");
      } catch (e) {
        console.error("KingyLocal load error:", e);
        _modelState = "error";
        _modelPromise = null;
        _lastError = (e && e.message) || String(e);
        throw e;
      }
    })();
    await _modelPromise;
    return _modelState === "ready";
  }

  function buildChatML(messages) {
    let p = "";
    for (const m of messages) p += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
    p += "<|im_start|>assistant\n";
    return p;
  }

  async function localInference(messages, onToken) {
    const prompt = buildChatML(messages);
    let out = "";
    await _wllama.createCompletion(prompt, {
      nPredict: 512,
      sampling: { temp: 0.8, top_p: 0.9 },
      onNewToken: (_tok, _piece, cur) => {
        out = cur.split("<|im_end|>")[0];
        onToken(out);
      },
    });
    return out.trim();
  }

  /* ============================================================
     STYLES
  ============================================================ */
  const style = document.createElement("style");
  style.textContent = `
  #mp3ai-anchor-btn { font-family:inherit; cursor:pointer; border:none; outline:none; }
  #mp3ai-anchor-btn {
    width:100%; margin-top:18px;
    background:linear-gradient(180deg,#111 0%,#050505 100%);
    color:#facc15; border:1.5px solid #facc15;
    padding:13px 16px; border-radius:14px;
    font-weight:700; font-size:13.5px;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:background .15s,transform .1s,box-shadow .2s;
  }
  #mp3ai-anchor-btn:hover { background:#1a1a1a; box-shadow:0 0 14px rgba(250,204,21,.25); }
  #mp3ai-anchor-btn:active { transform:scale(.98); }
  .mp3ai-spark { width:16px; height:16px; flex-shrink:0; animation:mp3ai-spin 3.5s linear infinite; }
  @keyframes mp3ai-spin { to { transform:rotate(360deg); } }

  #mp3ai-overlay {
    position:fixed; inset:0; z-index:999999;
    background:radial-gradient(circle at 50% 0%,#161200 0%,#050505 55%);
    display:flex; opacity:0; pointer-events:none;
    transform:translateY(14px);
    transition:opacity .25s ease, transform .25s ease;
    font-family:inherit;
  }
  #mp3ai-overlay.mp3ai-open { opacity:1; pointer-events:auto; transform:translateY(0); }
  #mp3ai-main { flex:1; display:flex; flex-direction:column; min-width:0; }

  /* sidebar */
  #mp3ai-sidebar {
    width:260px; flex-shrink:0; background:#0a0a0a; border-right:1px solid #1c1c1c;
    display:flex; flex-direction:column;
    transform:translateX(-100%); transition:transform .25s ease;
    position:absolute; top:0; bottom:0; left:0; z-index:2;
  }
  #mp3ai-sidebar.open { transform:translateX(0); }
  #mp3ai-sidebar-head { padding:16px; border-bottom:1px solid #1c1c1c; }
  #mp3ai-new-chat {
    width:100%; background:#facc15; color:#0a0a0a; border:none; font-weight:700;
    padding:10px 12px; border-radius:12px; cursor:pointer; font-size:13px;
    display:flex; align-items:center; justify-content:center; gap:6px;
  }
  #mp3ai-chat-list { flex:1; overflow-y:auto; padding:8px; }
  .mp3ai-chat-item {
    display:flex; align-items:center; justify-content:space-between; gap:6px;
    padding:10px 12px; border-radius:10px; cursor:pointer; margin-bottom:2px;
    color:#c9c9c9; font-size:13px;
  }
  .mp3ai-chat-item:hover { background:#131313; }
  .mp3ai-chat-item.active { background:#1a1a08; color:#facc15; }
  .mp3ai-chat-item span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mp3ai-chat-del { opacity:.5; flex-shrink:0; background:none; border:none; color:inherit; cursor:pointer; padding:2px; }
  .mp3ai-chat-del:hover { opacity:1; color:#ef4444; }
  #mp3ai-sidebar-backdrop {
    position:absolute; inset:0; background:rgba(0,0,0,.5);
    opacity:0; pointer-events:none; transition:opacity .2s; z-index:1;
  }
  #mp3ai-sidebar-backdrop.open { opacity:1; pointer-events:auto; }

  /* header */
  #mp3ai-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 18px; border-bottom:1px solid #1c1c1c; flex-shrink:0;
  }
  #mp3ai-header .mp3ai-left { display:flex; align-items:center; gap:10px; }
  #mp3ai-header .mp3ai-title-wrap { display:flex; flex-direction:column; gap:2px; }
  #mp3ai-header .mp3ai-title {
    color:#facc15; font-weight:800; font-size:17px; letter-spacing:.3px;
    display:flex; align-items:center; gap:8px;
    text-shadow:0 0 18px rgba(250,204,21,.35);
  }
  #mp3ai-header .mp3ai-subtitle { color:#6b6b6b; font-size:11px; font-weight:500; margin-left:24px; }
  .mp3ai-icon-btn {
    background:transparent; border:none; color:#e5e5e5;
    width:36px; height:36px; border-radius:999px;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:background .15s; flex-shrink:0;
  }
  .mp3ai-icon-btn:active { background:#1a1a1a; }

  /* body + empty */
  #mp3ai-body { flex:1; overflow-y:auto; padding:18px 16px; display:flex; flex-direction:column; gap:14px; }
  #mp3ai-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; text-align:center; padding:0 24px; }

  /* mascot — Kingy pixel art (11x9) */
  .mp3ai-mascot {
    display:grid; grid-template-columns:repeat(11,11px); grid-template-rows:repeat(9,11px); gap:2px;
    animation:mp3ai-bob 2.4s ease-in-out infinite;
    filter:drop-shadow(0 10px 16px rgba(250,204,21,.18));
  }
  @keyframes mp3ai-bob { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-7px) rotate(-1.5deg)} }
  .mp3ai-cube { width:11px; height:11px; border-radius:3px; background:linear-gradient(155deg,#fde047 0%,#facc15 45%,#d4a309 100%); box-shadow:inset -2px -2px 0 rgba(0,0,0,.22),inset 2px 2px 0 rgba(255,255,255,.25); }
  .mp3ai-cube.dark { background:#050505; box-shadow:inset -1px -1px 0 rgba(255,255,255,.05); animation:mp3ai-blink 4.5s infinite; }
  .mp3ai-cube.orange { background:linear-gradient(155deg,#fb923c 0%,#f97316 45%,#ea580c 100%); box-shadow:inset -2px -2px 0 rgba(0,0,0,.22),inset 2px 2px 0 rgba(255,255,255,.2); }
  .mp3ai-cube.empty { background:transparent; box-shadow:none; }
  @keyframes mp3ai-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(.15)} }

  #mp3ai-empty h2 { color:#f5f5f5; font-size:22px; font-weight:800; margin:0; letter-spacing:-.2px; }
  #mp3ai-empty p { color:#8a8a8a; font-size:13px; margin:0; max-width:280px; line-height:1.5; }
  .mp3ai-suggestions { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:6px; }
  .mp3ai-chip { background:#131313; border:1px solid #2a2a2a; color:#e0e0e0; font-size:12px; padding:9px 14px; border-radius:999px; cursor:pointer; transition:border-color .15s,transform .1s; }
  .mp3ai-chip:hover { border-color:#facc15; }
  .mp3ai-chip:active { transform:scale(.96); }

  /* setup / install screen */
  #mp3ai-setup { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; text-align:center; padding:0 28px; }
  #mp3ai-setup h2 { color:#f5f5f5; font-size:20px; font-weight:800; margin:0; }
  #mp3ai-setup p { color:#8a8a8a; font-size:13px; margin:0; max-width:280px; line-height:1.5; }
  #mp3ai-start-btn {
    background:linear-gradient(135deg,#fde047,#facc15); color:#0a0a0a;
    border:none; border-radius:14px; padding:14px 28px;
    font-weight:800; font-size:15px; cursor:pointer;
    display:flex; align-items:center; gap:8px;
    transition:transform .1s, box-shadow .2s;
    box-shadow:0 0 18px rgba(250,204,21,.3);
  }
  #mp3ai-start-btn:active { transform:scale(.97); }
  #mp3ai-start-btn:disabled { opacity:.5; cursor:not-allowed; }

  /* progress bar */
  #mp3ai-progress-wrap { width:100%; max-width:280px; }
  #mp3ai-progress-label { color:#8a8a8a; font-size:12px; margin-bottom:8px; text-align:center; }
  #mp3ai-progress-bar { width:100%; height:6px; background:#1c1c1c; border-radius:999px; overflow:hidden; }
  #mp3ai-progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#f97316,#facc15); border-radius:999px; transition:width .3s ease; }

  /* auto-load badge */
  #mp3ai-model-status {
    position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
    background:#131313; border:1px solid #2a2a2a; color:#6b6b6b;
    font-size:11px; padding:6px 12px; border-radius:999px; white-space:nowrap;
    display:none; z-index:10;
  }
  #mp3ai-model-status.visible { display:block; }

  /* messages */
  .mp3ai-row { display:flex; flex-direction:column; max-width:84%; }
  .mp3ai-row.user { align-self:flex-end; align-items:flex-end; }
  .mp3ai-row.assistant { align-self:flex-start; align-items:flex-start; }
  .mp3ai-msg { padding:12px 15px; border-radius:18px; font-size:14.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word; animation:mp3ai-rise .22s ease; cursor:pointer; }
  @keyframes mp3ai-rise { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .mp3ai-row.user .mp3ai-msg { background:linear-gradient(135deg,#fde047,#facc15); color:#0a0a0a; font-weight:500; border-bottom-right-radius:4px; }
  .mp3ai-row.assistant .mp3ai-msg { background:#131313; color:#ececec; border:1px solid #1e1e1e; border-bottom-left-radius:4px; }
  .mp3ai-msg img { max-width:100%; border-radius:14px; margin-top:10px; display:block; border:1px solid #2a2a2a; }
  .mp3ai-cursor { display:inline-block; width:7px; height:14px; background:#facc15; margin-left:2px; vertical-align:-2px; animation:mp3ai-caret .8s steps(1) infinite; }
  @keyframes mp3ai-caret { 50%{opacity:0} }

  .mp3ai-msg-actions { display:flex; gap:6px; margin-top:4px; max-height:0; overflow:hidden; transition:max-height .18s ease; }
  .mp3ai-row.actions-open .mp3ai-msg-actions { max-height:40px; }
  .mp3ai-msg-actions button { background:#131313; border:1px solid #2a2a2a; color:#d4d4d4; font-size:11px; padding:6px 10px; border-radius:999px; cursor:pointer; display:flex; align-items:center; gap:5px; }
  .mp3ai-msg-actions button:hover { border-color:#facc15; color:#facc15; }

  .mp3ai-action-card { background:#131313; border:1.5px solid #facc15; border-radius:16px; padding:14px; max-width:84%; align-self:flex-start; font-size:13.5px; color:#ececec; animation:mp3ai-rise .22s ease; }
  .mp3ai-action-card .mp3ai-action-label { color:#facc15; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
  .mp3ai-action-card .mp3ai-action-desc { margin-bottom:12px; line-height:1.45; }
  .mp3ai-action-buttons { display:flex; gap:8px; }
  .mp3ai-action-buttons button { flex:1; padding:9px; border-radius:10px; font-size:12.5px; font-weight:700; border:none; cursor:pointer; }
  .mp3ai-approve { background:#facc15; color:#0a0a0a; }
  .mp3ai-cancel  { background:#1f1f1f; color:#aaa; }
  .mp3ai-action-result { font-size:12px; color:#8a8a8a; margin-top:8px; }

  .mp3ai-typing { display:flex; gap:4px; padding:4px 2px; }
  .mp3ai-typing span { width:6px; height:6px; border-radius:50%; background:#facc15; animation:mp3ai-typing 1.1s infinite ease-in-out; }
  .mp3ai-typing span:nth-child(2){animation-delay:.15s}
  .mp3ai-typing span:nth-child(3){animation-delay:.3s}
  @keyframes mp3ai-typing { 0%,60%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-5px);opacity:1} }

  /* input bar */
  #mp3ai-inputbar { flex-shrink:0; display:flex; align-items:flex-end; gap:10px; padding:12px 14px calc(14px + env(safe-area-inset-bottom)); border-top:1px solid #1c1c1c; background:#050505; }
  #mp3ai-input { flex:1; resize:none; max-height:110px; background:#131313; border:1.5px solid #262626; color:#f5f5f5; border-radius:20px; padding:12px 16px; font-size:14.5px; font-family:inherit; outline:none; transition:border-color .15s,box-shadow .15s; }
  #mp3ai-input:focus { border-color:#facc15; box-shadow:0 0 0 3px rgba(250,204,21,.12); }
  #mp3ai-send { width:44px; height:44px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,#fde047,#facc15); color:#0a0a0a; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .1s; }
  #mp3ai-send:active { transform:scale(.92); }
  #mp3ai-send:disabled { opacity:.4; }
  @media(max-width:640px){ #mp3ai-sidebar{width:78vw;} }
  `;
  document.head.appendChild(style);

  /* ============================================================
     ICONS
  ============================================================ */
  const svgClose  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const svgSpark  = `<svg class="mp3ai-spark" viewBox="0 0 24 24" fill="#facc15"><path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z"/></svg>`;
  const svgSend   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-8-8 18-2-8-8-2z"/></svg>`;
  const svgMenu   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`;
  const svgCopy   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const svgRedo   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`;
  const svgTrash  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`;
  const svgPlus   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  const svgCpu    = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>`;

  /* ============================================================
     STORAGE
  ============================================================ */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function readJSON(k, fb) { try { const r=localStorage.getItem(k); return r?JSON.parse(r):fb; } catch { return fb; } }

  function loadStore() {
    let s = readJSON(STORE_KEY, null);
    if (!s || Array.isArray(s)) {
      const id = uid();
      s = { activeId:id, chats:{ [id]:{id, title:"New chat", messages:Array.isArray(s)?s:[], updatedAt:Date.now()} } };
      saveStore(s);
    }
    return s;
  }
  function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} }
  function getActiveChat(s) { return s.chats[s.activeId] || Object.values(s.chats)[0]; }
  function titleFromText(t) { const x=t.trim().slice(0,40); return x.length===t.trim().length?x:x+"..."; }

  /* ============================================================
     USER CONTEXT
  ============================================================ */
  function buildUserContext() {
    const liked     = readJSON("mp3king_liked_tracks",[]);
    const stats     = readJSON("mp3king_listening_stats",{});
    const profile   = readJSON("mp3king_profile",{});
    const playlists = readJSON("mp3king_local_playlists",[]);
    let nowPlaying  = "nothing";
    try { const md=navigator.mediaSession?.metadata; if(md?.title) nowPlaying=`${md.title}${md.artist?" - "+md.artist:""}`; } catch {}
    const likedList = Array.isArray(liked)?liked.slice(-20).map(t=>`${t.title||"?"} - ${t.artist||"?"}`).join("; "):"";
    const plStr = Array.isArray(playlists)?playlists.map(p=>`${p.name}(id:${p.id},${(p.tracks||[]).length}tr)`).join("; "):"";
    return [
      `User: ${profile?.name||"unknown"}.`,
      `Now playing: ${nowPlaying}.`,
      `Stats: ${stats?.totalTracks||0} tracks, ${Math.round((stats?.totalSeconds||0)/60)}min total.`,
      `Liked (recent): ${likedList||"none"}.`,
      `Playlists: ${plStr||"none"}.`,
    ].join(" ");
  }

  function systemPrompt() {
    const ctx = buildUserContext();
    return `You are Kingy, a friendly music AI in mp3king. Answer only about music and the app. Keep replies short. User info: ${ctx}`;
  }

  /* ============================================================
     TRACK SEARCH + ACTIONS
  ============================================================ */
  async function searchTrack(q) {
    try {
      const r = await fetch("https://itunes.apple.com/search?term="+encodeURIComponent(q)+"&media=music&limit=1");
      const d = await r.json(); const t = d.results?.[0];
      if (!t) return null;
      return { id:"itunes-"+t.trackId, title:t.trackName, artist:t.artistName, album:t.collectionName||"", duration:"0:00", coverUrl:(t.artworkUrl100||"/placeholder.svg").replace("100x100","512x512") };
    } catch { return null; }
  }
  function actionDesc(a) {
    switch(a.action) {
      case "add_to_queue":    return `Add "${a.query}" to the queue`;
      case "play_now":        return `Play "${a.query}" right now`;
      case "remove_from_queue": return `Remove "${a.query}" from the queue`;
      case "like_track":      return `Like "${a.query}"`;
      case "create_playlist": return `Create playlist "${a.name}"${a.tracks?.length?` with ${a.tracks.length} tracks`:""}`;
      case "add_to_playlist": return `Add "${a.query}" to playlist "${a.playlistName}"`;
      default: return "Run this action";
    }
  }
  async function executeAction(a) {
    const P = window._mp3kingPlayer, D = window._mp3kingData;
    if (!P||!D) throw new Error("App bridge not ready, reload the page.");
    switch(a.action) {
      case "add_to_queue":    { const t=await searchTrack(a.query); if(!t) throw new Error("Track not found."); P.addToQueue(t); return `Added "${t.title} - ${t.artist}" to queue.`; }
      case "play_now":        { const t=await searchTrack(a.query); if(!t) throw new Error("Track not found."); P.addToQueue(t); P.playTrack(t); return `Now playing "${t.title} - ${t.artist}".`; }
      case "remove_from_queue":{ const q=P.getQueue(); const m=q.find(t=>(t.title+" "+t.artist).toLowerCase().includes(a.query.toLowerCase())); if(!m) throw new Error("Track not in queue."); P.removeFromQueue(m.id); return `Removed "${m.title}".`; }
      case "like_track":      { const t=await searchTrack(a.query); if(!t) throw new Error("Track not found."); P.toggleLike(t); return `Liked "${t.title} - ${t.artist}".`; }
      case "create_playlist": { const pl=D.createPlaylist(a.name,""); if(a.tracks?.length) for(const q of a.tracks.slice(0,10)){ const t=await searchTrack(q); if(t) D.addTrackToPlaylist(pl.id,t); } return `Created playlist "${a.name}".`; }
      case "add_to_playlist": { const pls=D.getPlaylists(); const pl=pls.find(p=>p.name.toLowerCase()===a.playlistName.toLowerCase()); if(!pl) throw new Error(`Playlist "${a.playlistName}" not found.`); const t=await searchTrack(a.query); if(!t) throw new Error("Track not found."); D.addTrackToPlaylist(pl.id,t); return `Added "${t.title}" to "${pl.name}".`; }
      default: throw new Error("Unknown action.");
    }
  }

  /* ============================================================
     UI STATE
  ============================================================ */
  let overlay, bodyEl, inputEl, sendBtn, sidebarEl, chatListEl, backdropEl, statusBadge;
  let prevPath = null;

  function esc(s) { const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }

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
              
            </div>
          </div>
          <button class="mp3ai-icon-btn" id="mp3ai-close" type="button">${svgClose}</button>
        </div>
        <div id="mp3ai-body"></div>
        <div id="mp3ai-model-status"></div>
        <div id="mp3ai-inputbar">
          <textarea id="mp3ai-input" rows="1" placeholder="Ask anything..."></textarea>
          <button id="mp3ai-send" type="button">${svgSend}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    bodyEl      = overlay.querySelector("#mp3ai-body");
    inputEl     = overlay.querySelector("#mp3ai-input");
    sendBtn     = overlay.querySelector("#mp3ai-send");
    sidebarEl   = overlay.querySelector("#mp3ai-sidebar");
    chatListEl  = overlay.querySelector("#mp3ai-chat-list");
    backdropEl  = overlay.querySelector("#mp3ai-sidebar-backdrop");
    statusBadge = overlay.querySelector("#mp3ai-model-status");

    overlay.querySelector("#mp3ai-close").addEventListener("click", closeOverlay);
    overlay.querySelector("#mp3ai-menu").addEventListener("click", toggleSidebar);
    backdropEl.addEventListener("click", closeSidebar);
    overlay.querySelector("#mp3ai-new-chat").addEventListener("click", () => {
      const s=loadStore(), id=uid();
      s.chats[id]={id, title:"New chat", messages:[], updatedAt:Date.now()};
      s.activeId=id; saveStore(s); history.replaceState({mp3ai:true},"",ROUTE); renderSidebar(); renderBody(); closeSidebar();
    });
    sendBtn.addEventListener("click", handleSend);
    inputEl.addEventListener("keydown", e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();} });
    inputEl.addEventListener("input", ()=>{ inputEl.style.height="auto"; inputEl.style.height=Math.min(inputEl.scrollHeight,110)+"px"; });
  }

  function toggleSidebar() { sidebarEl.classList.toggle("open"); backdropEl.classList.toggle("open"); }
  function closeSidebar()  { sidebarEl.classList.remove("open"); backdropEl.classList.remove("open"); }

  function renderSidebar() {
    const s = loadStore();
    const chats = Object.values(s.chats).sort((a,b)=>b.updatedAt-a.updatedAt);
    chatListEl.innerHTML = "";
    chats.forEach(c=>{
      const item = document.createElement("div");
      item.className = "mp3ai-chat-item"+(c.id===s.activeId?" active":"");
      item.innerHTML = `<span>${esc(c.title||"New chat")}</span><button class="mp3ai-chat-del" type="button">${svgTrash}</button>`;
      item.addEventListener("click", e=>{ if(e.target.closest(".mp3ai-chat-del"))return; const s2=loadStore(); s2.activeId=c.id; saveStore(s2); const hasMsg=c.messages&&c.messages.some(m=>m.role==="user"); history.replaceState({mp3ai:true},"",hasMsg?ROUTE_CHAT(c.id):ROUTE); renderSidebar(); renderBody(); closeSidebar(); });
      item.querySelector(".mp3ai-chat-del").addEventListener("click", e=>{ e.stopPropagation(); const s2=loadStore(); delete s2.chats[c.id]; if(!Object.keys(s2.chats).length){const id=uid();s2.chats[id]={id,title:"New chat",messages:[],updatedAt:Date.now()};s2.activeId=id;} else if(s2.activeId===c.id){s2.activeId=Object.values(s2.chats).sort((a,b)=>b.updatedAt-a.updatedAt)[0].id;} saveStore(s2); renderSidebar(); renderBody(); });
      chatListEl.appendChild(item);
    });
  }

  /* mascot Kingy pixel art */
  const MASCOT = [
    "..OOOOOOO..",
    "OOKKKKKKKOO",
    "OOYYYYYYYOO",
    "OOYYYYYYYOO",
    "OOYKYYYKYOO",
    "OOYYYYYYYOO",
    "OOYYYYYYYOO",
    "OOYYYYYYYOO",
    "..YY.YY.YY.",
  ];
  function mascotHTML() {
    let c="";
    for(const row of MASCOT) for(const ch of row) {
      if(ch===".")      c+=`<div class="mp3ai-cube empty"></div>`;
      else if(ch==="O") c+=`<div class="mp3ai-cube orange"></div>`;
      else if(ch==="K") c+=`<div class="mp3ai-cube dark"></div>`;
      else              c+=`<div class="mp3ai-cube"></div>`;
    }
    return `<div class="mp3ai-mascot">${c}</div>`;
  }

  /* ---- render body ---- */
  function renderBody() {
    bodyEl.innerHTML = "";
    if (_modelState === "idle" && !localStorage.getItem(MODEL_READY_KEY)) {
      renderSetupScreen(); return;
    }
    if (_modelState === "loading") {
      renderLoadingScreen(); return;
    }
    const s = loadStore(), chat = getActiveChat(s);
    if (!chat.messages.length) { renderEmptyState(); return; }
    chat.messages.forEach(m=>{ bodyEl.appendChild(buildRow(m)); if(m.role==="assistant"&&m.pendingAction) bodyEl.appendChild(buildActionCard(m.pendingAction)); });
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderSetupScreen() {
    const wrap = document.createElement("div");
    wrap.id = "mp3ai-setup";
    wrap.innerHTML = `
      ${mascotHTML()}
      <h2>Meet ${AI_NAME}</h2>
      <p>Your local AI music assistant. The first time, the model (~300MB) downloads and installs on your device. After that it loads instantly every visit — no internet needed.</p>
      <button id="mp3ai-start-btn" type="button">${svgCpu}<span>Start Listening</span></button>
      <div id="mp3ai-progress-wrap" style="display:none">
        <div id="mp3ai-progress-label">Downloading model…</div>
        <div id="mp3ai-progress-bar"><div id="mp3ai-progress-fill"></div></div>
      </div>`;
    bodyEl.appendChild(wrap);
    wrap.querySelector("#mp3ai-start-btn").addEventListener("click", startInstall);
  }

  function renderLoadingScreen() {
    const wrap = document.createElement("div");
    wrap.id = "mp3ai-setup";
    wrap.innerHTML = `
      ${mascotHTML()}
      <h2>Loading ${AI_NAME}…</h2>
      <div id="mp3ai-progress-wrap">
        <div id="mp3ai-progress-label">Warming up the model…</div>
        <div id="mp3ai-progress-bar"><div id="mp3ai-progress-fill" style="width:100%;animation:mp3ai-pulse-bar 1.5s infinite"></div></div>
      </div>`;
    bodyEl.appendChild(wrap);
  }

  function renderEmptyState() {
    const wrap = document.createElement("div");
    wrap.id = "mp3ai-empty";
    wrap.innerHTML = `
      ${mascotHTML()}
      <h2>What's on your mind today?</h2>
      <p>Ask me for music recs, generate an image, or get me to act on your library.</p>
      <div class="mp3ai-suggestions">
        <button class="mp3ai-chip" data-q="Based on what I listen to, what do you recommend?">Recommend something</button>
        <button class="mp3ai-chip" data-q="Give me a summary of my music taste">My taste</button>
        <button class="mp3ai-chip" data-q="Generate an image inspired by what I'm listening to">Generate image</button>
      </div>`;
    wrap.querySelectorAll(".mp3ai-chip").forEach(ch=>ch.addEventListener("click",()=>{ inputEl.value=ch.dataset.q; handleSend(); }));
    bodyEl.appendChild(wrap);
  }

  function startInstall() {
    const btn  = document.getElementById("mp3ai-start-btn");
    const prog = document.getElementById("mp3ai-progress-wrap");
    const fill = document.getElementById("mp3ai-progress-fill");
    const lbl  = document.getElementById("mp3ai-progress-label");
    if (btn) btn.disabled = true;
    if (prog) prog.style.display = "block";
    loadModel((loaded, total) => {
      if (!fill||!lbl) return;
      const pct = total ? Math.round(loaded/total*100) : 0;
      fill.style.width = pct+"%";
      lbl.textContent = `Downloading… ${pct}%`;
    }).then(ok => {
      if (ok) { renderSidebar(); renderBody(); }
      else    { if(lbl) lbl.textContent = "Error: " + (_lastError || "unknown"); if(btn) btn.disabled = false; }
    }).catch(() => { const l=document.getElementById("mp3ai-progress-label"); if(l) l.textContent = "Error: " + (_lastError || "unknown"); if(btn) btn.disabled = false; });
  }

  /* ---- message rows ---- */
  function buildRow(msg) {
    const row = document.createElement("div");
    row.className = "mp3ai-row "+msg.role;
    row.dataset.id = msg.id;
    const bubble = document.createElement("div");
    bubble.className = "mp3ai-msg";
    bubble.textContent = msg.content;
    row.appendChild(bubble);
    if (msg.image) { const img=document.createElement("img"); img.src=msg.image; img.alt="Generated image"; bubble.appendChild(img); }
    if (msg.role === "user") {
      const acts = document.createElement("div"); acts.className = "mp3ai-msg-actions";
      acts.innerHTML = `<button type="button">${svgCopy}Copy</button><button type="button">${svgRedo}Resend</button>`;
      row.appendChild(acts);
      bubble.addEventListener("click", ()=>row.classList.toggle("actions-open"));
      acts.children[0].addEventListener("click", e=>{ e.stopPropagation(); navigator.clipboard?.writeText(msg.content).catch(()=>{}); });
      acts.children[1].addEventListener("click", e=>{ e.stopPropagation(); resendFrom(msg.id); });
    }
    return row;
  }

  function buildActionCard(action) {
    const card = document.createElement("div");
    card.className = "mp3ai-action-card";
    card.innerHTML = `<div class="mp3ai-action-label">${AI_NAME} wants to</div><div class="mp3ai-action-desc">${esc(actionDesc(action))}?</div><div class="mp3ai-action-buttons"><button type="button" class="mp3ai-approve">Approve</button><button type="button" class="mp3ai-cancel">Cancel</button></div>`;
    card.querySelector(".mp3ai-cancel").addEventListener("click",()=>{ card.querySelector(".mp3ai-action-buttons").remove(); const r=document.createElement("div"); r.className="mp3ai-action-result"; r.textContent="Cancelled."; card.appendChild(r); });
    card.querySelector(".mp3ai-approve").addEventListener("click",async()=>{ const btns=card.querySelector(".mp3ai-action-buttons"); btns.querySelectorAll("button").forEach(b=>b.disabled=true); try{ const res=await executeAction(action); btns.remove(); const r=document.createElement("div"); r.className="mp3ai-action-result"; r.textContent="✓ "+res; card.appendChild(r); }catch(e){ btns.remove(); const r=document.createElement("div"); r.className="mp3ai-action-result"; r.textContent="✗ "+(e.message||"Error"); card.appendChild(r); } });
    return card;
  }

  function showTypingRow() {
    const d=document.createElement("div"); d.className="mp3ai-row assistant"; d.id="mp3ai-typing-row";
    d.innerHTML=`<div class="mp3ai-msg"><div class="mp3ai-typing"><span></span><span></span><span></span></div></div>`;
    bodyEl.appendChild(d); bodyEl.scrollTop=bodyEl.scrollHeight; return d;
  }

  /* ---- inference ---- */
  async function runAssistantTurn(latestUserText) {
    sendBtn.disabled = true;
    const s = loadStore(), chat = getActiveChat(s);
    renderBody();
    const typingRow = showTypingRow();
    const bubble = typingRow.querySelector(".mp3ai-msg");

    const wantsImg = IMG_TRIGGER_RE.test(latestUserText);
    let imageUrl = null;
    if (wantsImg) {
      imageUrl = "https://image.pollinations.ai/prompt/"+encodeURIComponent(latestUserText)+"?model=flux&seed=-1&width=1024&height=1024&nologo=true&rand="+Math.floor(Math.random()*1e9);
      await new Promise(r=>{ const i=new Image(); i.onload=r; i.onerror=r; i.src=imageUrl; });
    }

    try {
      const messages = [
        { role:"system", content:systemPrompt() },
        ...chat.messages.slice(-8).map(m=>({role:m.role, content:m.content})),
      ];

      let lastRender="";
      const full = await localInference(messages, partial=>{
        const display = partial.replace(ACTION_RE,"").trimEnd();
        if(display!==lastRender){
          lastRender=display;
          bubble.innerHTML="";
          bubble.appendChild(document.createTextNode(display));
          const cur=document.createElement("span"); cur.className="mp3ai-cursor"; bubble.appendChild(cur);
          bodyEl.scrollTop=bodyEl.scrollHeight;
        }
      });

      let text=full, pendingAction=null;
      const match=full.match(ACTION_RE);
      if(match){ text=full.replace(ACTION_RE,"").trim(); try{pendingAction=JSON.parse(match[1].trim());}catch{} }

      const s2=loadStore(), c2=getActiveChat(s2);
      c2.messages.push({id:uid(), role:"assistant", content:text||"...", image:imageUrl||undefined, pendingAction:pendingAction||undefined});
      c2.updatedAt=Date.now(); saveStore(s2); renderBody();
    } catch(e) {
      const s2=loadStore(), c2=getActiveChat(s2);
      c2.messages.push({id:uid(), role:"assistant", content:"Something went wrong: "+(e.message||"try again.")});
      saveStore(s2); renderBody(); console.error("Kingy:",e);
    } finally {
      sendBtn.disabled=false;
      document.getElementById("mp3ai-typing-row")?.remove();
    }
  }

  async function handleSend() {
    if (_modelState !== "ready") return;
    const text = inputEl.value.trim(); if(!text) return;
    inputEl.value=""; inputEl.style.height="auto";
    const s=loadStore(), chat=getActiveChat(s);
    chat.messages.push({id:uid(), role:"user", content:text});
    if(chat.messages.filter(m=>m.role==="user").length===1){ chat.title=titleFromText(text); history.replaceState({mp3ai:true},"",ROUTE_CHAT(s.activeId)); }
    chat.updatedAt=Date.now(); saveStore(s); renderSidebar();
    await runAssistantTurn(text);
  }

  async function resendFrom(userMsgId) {
    if (_modelState !== "ready") return;
    const s=loadStore(), chat=getActiveChat(s);
    const idx=chat.messages.findIndex(m=>m.id===userMsgId); if(idx===-1)return;
    const text=chat.messages[idx].content;
    chat.messages=chat.messages.slice(0,idx+1); saveStore(s);
    await runAssistantTurn(text);
  }

  window.KingyLocal = {
    preload: () => loadModel(),
    isReady: () => _modelState === "ready",
    getState: () => _modelState,
  };

  /* ---- auto-load model on page open (if already installed) ---- */
  function autoLoad() {
    if (!localStorage.getItem(MODEL_READY_KEY)) return;
    if (statusBadge) { statusBadge.textContent="Loading Kingy…"; statusBadge.classList.add("visible"); }
    loadModel().then(ok=>{
      if(statusBadge){ statusBadge.classList.remove("visible"); }
      if(ok && overlay?.classList.contains("mp3ai-open")) renderBody();
    }).catch(()=>{ if(statusBadge) statusBadge.classList.remove("visible"); });
  }

  /* ---- open / close overlay + /chat route ---- */
  function openOverlay(pushUrl) {
    if (!overlay) createOverlay();
    renderSidebar(); renderBody();
    overlay.classList.add("mp3ai-open");
    if (pushUrl!==false) {
      const st=loadStore(); const chat=getActiveChat(st);
      const hasMessages=chat.messages.some(m=>m.role==="user");
      const targetUrl=hasMessages?ROUTE_CHAT(st.activeId):ROUTE;
      if(location.pathname!==targetUrl){ prevPath=location.pathname+location.search; history.pushState({mp3ai:true},"",targetUrl); }
    }
    setTimeout(()=>inputEl?.focus(),200);
  }
  function closeOverlay(skipNav) {
    overlay?.classList.remove("mp3ai-open"); closeSidebar();
    if(!skipNav && (location.pathname===ROUTE||location.pathname.startsWith(ROUTE+"/"))) history.pushState({},"",prevPath||"/");
  }
  window.addEventListener("popstate",()=>{
    if(location.pathname===ROUTE||location.pathname.startsWith(ROUTE+"/")){
      const parts=location.pathname.split("/"); const chatId=parts[2];
      if(chatId){ const st=loadStore(); if(st.chats[chatId]){st.activeId=chatId;saveStore(st);} }
      openOverlay(false);
    } else { closeOverlay(true); }
  });

  /* ---- anchor button in Queue panel ---- */
  function tryMountAnchorButton() {
    if(document.getElementById("mp3ai-anchor-btn")) return true;
    const heading=Array.from(document.querySelectorAll("h1,h2,h3,div,span")).find(el=>el.children.length===0&&el.textContent.trim()==="Queue");
    if(!heading) return false;
    let c=heading.parentElement;
    while(c&&c.parentElement&&c.clientHeight<80&&c.parentElement!==document.body) c=c.parentElement;
    if(!c) return false;
    const btn=document.createElement("button"); btn.id="mp3ai-anchor-btn"; btn.type="button";
    btn.innerHTML=`${svgSpark}<span>${AI_NAME}</span>`;
    btn.addEventListener("click",()=>openOverlay());
    c.appendChild(btn); return true;
  }

  function init() {
    if (!tryMountAnchorButton()) {
      const obs=new MutationObserver(()=>tryMountAnchorButton());
      obs.observe(document.body,{childList:true,subtree:true});
    }
    if(location.pathname===ROUTE||location.pathname.startsWith(ROUTE+"/")){
      const parts=location.pathname.split("/"); const chatId=parts[2];
      if(chatId){ const st=loadStore(); if(st.chats[chatId]){st.activeId=chatId;saveStore(st);} }
      setTimeout(()=>openOverlay(false),50);
    }
    // auto-load model in background if already installed
    if (document.readyState==="complete") autoLoad();
    else window.addEventListener("load", autoLoad);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
