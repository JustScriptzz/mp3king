export const config = { runtime: 'edge' };

// Proxies chat requests to Vercel AI Gateway. When deployed on Vercel,
// the Gateway authenticates automatically via OIDC — no API key needs
// to be created or stored by us. Falls back to AI_GATEWAY_API_KEY env
// var if present (useful for local dev / non-Vercel deploys).
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

  const { messages, model } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400);
  }

  const MODEL = model || 'openai/gpt-5-nano';

  try {
    const headers = { 'Content-Type': 'application/json' };
    // On Vercel, OIDC auth is injected automatically via the
    // VERCEL_OIDC_TOKEN env var when the AI Gateway provider is used —
    // but for a raw fetch proxy we still need an explicit bearer.
    // AI_GATEWAY_API_KEY (if set in project env vars) takes priority;
    // otherwise fall back to the auto-provisioned OIDC token.
    const authToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const gwRes = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!gwRes.ok) {
      // Fallback: Pollinations text API (free, keyless) so the assistant
      // keeps working while AI_GATEWAY_API_KEY isn't configured yet.
      try {
        const sysMsg = messages.find(m => m.role === 'system')?.content || '';
        const chatMsgs = messages.filter(m => m.role !== 'system');
        const lastUser = [...chatMsgs].reverse().find(m => m.role === 'user')?.content || '';
        const history = chatMsgs.slice(-7, -1)
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
        const prompt = history ? `${history}\nUser: ${lastUser}` : lastUser;
        const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt)
          + '?model=mistral&system=' + encodeURIComponent(sysMsg)
          + '&seed=' + Math.floor(Math.random() * 1e9) + '&private=true';
        const fbRes = await fetch(url);
        if (fbRes.ok) {
          const text = (await fbRes.text()).trim();
          return json({ text, fallback: true });
        }
      } catch {}
      const errText = await gwRes.text().catch(() => '');
      return json({ error: `Gateway error ${gwRes.status}`, detail: errText.slice(0, 500) }, 502);
    }

    const data = await gwRes.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return json({ text });
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
