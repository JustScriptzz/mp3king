export const config = { runtime: 'edge' };

// Proxies chat requests to DuckDuckGo AI Chat (duck.ai) — fully anonymous,
// no signup, no API key. Unofficial/reverse-engineered protocol: DuckDuckGo
// issues a short-lived session token (x-vqd-4) that must be fetched first,
// then included on the actual chat request.
const STATUS_URL = 'https://duckduckgo.com/duckchat/v1/status';
const CHAT_URL   = 'https://duckduckgo.com/duckchat/v1/chat';
const MODEL      = 'gpt-4o-mini';

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
    // Step 1: get a fresh vqd session token
    const statusRes = await fetch(STATUS_URL, {
      headers: {
        'x-vqd-accept': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    const vqd = statusRes.headers.get('x-vqd-4');
    if (!vqd) {
      return json({ error: 'Could not obtain session token from DuckDuckGo' }, 502);
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
        'Content-Type': 'application/json',
        'x-vqd-4': vqd,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ model: MODEL, messages: chatMsgs }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text().catch(() => '');
      return json({ error: `DuckDuckGo chat error ${chatRes.status}`, detail: errText.slice(0, 300) }, 502);
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

    return json({ text: full.trim() });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
