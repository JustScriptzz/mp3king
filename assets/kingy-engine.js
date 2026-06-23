/* Kingy AI — local in-browser engine (WebLLM + WebGPU, no server, no API keys) */
let webllm = null;
let engine = null;
let state = "idle"; // idle | loading | ready | unsupported | error
let progressText = "";
let loadPromise = null;
const listeners = new Set();

const MODEL_ID = "SmolLM2-135M-Instruct-q0f16-MLC"; // smallest WebLLM prebuilt model available

function notify() {
  listeners.forEach((fn) => {
    try {
      fn({ state, progressText });
    } catch {}
  });
}

function supportsWebGPU() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}

async function preload() {
  if (state === "ready" || state === "loading" || state === "unsupported") return loadPromise;
  if (!supportsWebGPU()) {
    state = "unsupported";
    notify();
    return null;
  }
  state = "loading";
  progressText = "Starting download...";
  notify();
  loadPromise = (async () => {
    try {
      if (!webllm) {
        webllm = await import("https://esm.run/@mlc-ai/web-llm");
      }
      engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          progressText = report && report.text ? report.text : "Downloading model...";
          notify();
        },
      });
      state = "ready";
      progressText = "Ready";
      notify();
    } catch (err) {
      console.error("KingyEngine load error:", err);
      state = "error";
      progressText = (err && err.message) || "Failed to load local model";
      notify();
    }
  })();
  return loadPromise;
}

function isReady() {
  return state === "ready" && !!engine;
}
function getState() {
  return { state, progressText };
}
function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function chat(messages, onToken) {
  if (!isReady()) throw new Error("Local model not ready yet");
  const completion = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.8,
  });
  let full = "";
  for await (const chunk of completion) {
    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
    if (delta) {
      full += delta;
      onToken(full);
    }
  }
  return full;
}

window.KingyEngine = { preload, isReady, getState, onStateChange, chat, supportsWebGPU };

/* Resume an already-started or previously-completed download on every page load
   (e.g. user navigated away mid-download, or model is already cached by the browser). */
if (localStorage.getItem("mp3king_ai_local_started") === "1") {
  preload();
}
const _origPreload = preload;
window.KingyEngine.preload = (...args) => {
  try {
    localStorage.setItem("mp3king_ai_local_started", "1");
  } catch {}
  return _origPreload(...args);
};
