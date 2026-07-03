export const config = { runtime: 'edge' };

// Proxies chat requests to DuckDuckGo AI Chat (duck.ai) — fully anonymous,
// no signup, no API key. Unofficial/reverse-engineered protocol: DuckDuckGo
// issues a short-lived session token (x-vqd-4) that must be fetched first,
// then included on the actual chat request.
const STATUS_URL = 'https://duckduckgo.com/duckchat/v1/status';
const CHAT_URL   = 'https://duckduckgo.com/duckchat/v1/chat';
const MODEL      = 'gpt-4o-mini';

// Fallback: AI Horde — crowdsourced, community-run, fully anonymous with
// the shared key '0000000000'. Async job queue (submit then poll), can be
// slow or occasionally have no worker online for a given model — used only
// if DuckDuckGo fails.
const HORDE_SUBMIT = 'https://aihorde.net/api/v2/generate/text/async';
const HORDE_STATUS = id => `https://aihorde.net/api/v2/generate/text/status/${id}`;
const HORDE_KEY    = '0000000000';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400);
  }

  try {
    const text = await tryDuckDuckGo(messages);
    return json({ text });
  } catch (ddgErr) {
    try {
      const text = await tryAIHorde(messages);
      return json({ text, provider: 'aihorde' });
    } catch (hordeErr) {
      return json({ error: 'Both providers failed', duckduckgo: String(ddgErr.message || ddgErr), aihorde: String(hordeErr.message || hordeErr) }, 502);
    }
  }
}

async function tryDuckDuckGo(messages) {
  {
    // Step 1: get a fresh vqd session token
    const browserHeaders = {
      'x-vqd-accept': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://duckduckgo.com/',
      'Origin': 'https://duckduckgo.com',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    };

    let statusRes = await fetch(STATUS_URL, { headers: browserHeaders });
    let vqd = statusRes.headers.get('x-vqd-4');
    let cookies = statusRes.headers.get('set-cookie') || '';

    // Retry once on failure (DuckDuckGo occasionally 418s the first request)
    if (!vqd) {
      statusRes = await fetch(STATUS_URL, { headers: { ...browserHeaders, ...(cookies ? { Cookie: cookies } : {}) } });
      vqd = statusRes.headers.get('x-vqd-4');
      cookies = statusRes.headers.get('set-cookie') || cookies;
    }

    if (!vqd) {
      const bodyText = await statusRes.text().catch(() => '');
      throw new Error(`Could not obtain session token from DuckDuckGo (status ${statusRes.status}): ${bodyText.slice(0, 200)}`);
    }

    // DuckDuckGo's chat only accepts role user/assistant, no system —
    // fold any system message into the first user message instead.
    const sys = messages.find(m => m.role === 'system')?.content;
    const chatMsgs = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
    if (sys && chatMsgs.length && chatMsgs[0].role === 'user') {
      chatMsgs[0] = { ...chatMsgs[0], content: `[Instructions: ${sys}]\n\n${chatMsgs[0].content}` };
    }

    // Step 2: send the chat request
    const chatRes = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        ...browserHeaders,
        'Content-Type': 'application/json',
        'x-vqd-4': vqd,
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: JSON.stringify({ model: MODEL, messages: chatMsgs }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text().catch(() => '');
      throw new Error(`DuckDuckGo chat error ${chatRes.status}: ${errText.slice(0, 300)}`);
    }

    // Response is server-sent events; each data: line has a JSON chunk with .message
    const raw = await chatRes.text();
    let full = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]' || !payload) continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.message) full += obj.message;
      } catch {}
    }

    return full.trim();
  }
}

async function tryAIHorde(messages) {
  const sys = messages.find(m => m.role === 'system')?.content || '';
  const chatMsgs = messages.filter(m => m.role !== 'system');
  const lastUser = [...chatMsgs].reverse().find(m => m.role === 'user')?.content || '';
  const history = chatMsgs.slice(-6, -1)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  const prompt = (sys ? `[Instructions: ${sys}]\n\n` : '') + (history ? `${history}\nUser: ${lastUser}\nAssistant:` : `User: ${lastUser}\nAssistant:`);

  const submitRes = await fetch(HORDE_SUBMIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': HORDE_KEY, 'Client-Agent': 'mp3king-kingy:1.0:mp3king.vercel.app' },
    body: JSON.stringify({
      prompt,
      params: { max_context_length: 2048, max_length: 300, temperature: 0.8 },
    }),
  });
  if (!submitRes.ok) {
    const t = await submitRes.text().catch(() => '');
    throw new Error(`Horde submit ${submitRes.status}: ${t.slice(0, 200)}`);
  }
  const submitData = await submitRes.json();
  const jobId = submitData.id;
  if (!jobId) throw new Error('Horde: no job id returned');

  // Poll for completion, up to ~25s
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(HORDE_STATUS(jobId), {
      headers: { 'apikey': HORDE_KEY },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.done && statusData.generations && statusData.generations.length) {
      return (statusData.generations[0].text || '').trim();
    }
    if (statusData.faulted) throw new Error('Horde: job faulted');
  }
  throw new Error('Horde: timed out waiting for a worker');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
