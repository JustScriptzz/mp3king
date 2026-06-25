export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid playlist ID' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const res = await fetch(`https://open.spotify.com/playlist/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Spotify returned ${res.status}` }), {
        status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not parse playlist — may be private or region-locked' }), {
        status: 422, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const data = JSON.parse(match[1]);
    const pl = data?.props?.pageProps?.state?.data?.playlist;
    if (!pl) {
      return new Response(JSON.stringify({ error: 'Playlist not found or private' }), {
        status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const tracks = (pl?.content?.items || []).map(item => {
      const t = item?.itemV2?.data;
      if (!t?.name) return null;
      const durMs = t?.duration?.totalMilliseconds || 0;
      const durSec = Math.floor(durMs / 1000);
      return {
        id: 'spotify-' + (t?.uri?.split(':')?.[2] || Math.random().toString(36).slice(2)),
        title: t.name,
        artist: t?.artists?.items?.[0]?.profile?.name || 'Unknown',
        album: t?.albumOfTrack?.name || '',
        duration: `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}`,
        coverUrl: t?.albumOfTrack?.coverArt?.sources?.[0]?.url || '/placeholder.svg',
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({
      name: pl.name || 'Spotify Playlist',
      description: pl.description || '',
      coverUrl: pl?.images?.items?.[0]?.sources?.[0]?.url || '',
      tracks,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Fetch failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
