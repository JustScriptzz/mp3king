export const config = { runtime: 'edge' };

// Proxies audio fingerprint requests to the Shazam API on RapidAPI.
// Requires the RAPIDAPI_KEY environment variable to be set on Vercel
// (Project Settings -> Environment Variables -> RAPIDAPI_KEY).
const RAPIDAPI_HOST = 'shazam.p.rapidapi.com';
const DETECT_URL = 'https://shazam.p.rapidapi.com/songs/v2/detect?timezone=UTC&locale=en-US';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return json({ error: 'RAPIDAPI_KEY not configured on the server' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { audio } = body || {};
  if (!audio || typeof audio !== 'string') {
    return json({ error: 'audio (base64 WAV) is required' }, 400);
  }

  try {
    const resp = await fetch(DETECT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      body: audio,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return json({ error: `Shazam API error (${resp.status})`, details: errText.slice(0, 300) }, 502);
    }

    const data = await resp.json();
    const track = data && data.track;

    if (!track) {
      return json({ match: false });
    }

    const images = track.images || {};
    return json({
      match: true,
      title: track.title || '',
      artist: track.subtitle || '',
      cover: images.coverarthq || images.coverart || images.background || '',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  });
}
