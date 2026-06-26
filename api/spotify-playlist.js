export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    return json({ error: 'Invalid playlist ID' }, 400);
  }

  try {
    // Step 1: get anonymous Spotify token (no credentials needed)
    const tokenRes = await fetch(
      'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en',
          'Referer': 'https://open.spotify.com/',
          'Cookie': 'sp_t=1; sp_new=1',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!tokenRes.ok) return json({ error: `Token fetch failed (${tokenRes.status})` }, 502);
    const { accessToken } = await tokenRes.json();
    if (!accessToken) return json({ error: 'Could not get Spotify token' }, 502);

    // Step 2: fetch playlist metadata + first 100 tracks
    const fields = 'name,description,images,tracks.total,tracks.items(track(id,name,duration_ms,artists(name),album(name,images)))';
    const plRes = await fetch(
      `https://api.spotify.com/v1/playlists/${id}?fields=${encodeURIComponent(fields)}&limit=100`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!plRes.ok) {
      const e = await plRes.json().catch(() => ({}));
      return json({ error: e?.error?.message || `Spotify API error ${plRes.status}` }, plRes.status);
    }
    const pl = await plRes.json();

    // Step 3: paginate if > 100 tracks
    let allItems = pl.tracks.items || [];
    const total = pl.tracks.total || 0;
    let offset = 100;
    while (offset < total && offset < 500) {
      const pageRes = await fetch(
        `https://api.spotify.com/v1/playlists/${id}/tracks?offset=${offset}&limit=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
      );
      if (!pageRes.ok) break;
      const page = await pageRes.json();
      allItems = allItems.concat(page.items || []);
      offset += 100;
    }

    // Step 4: format tracks
    const tracks = allItems.map(item => {
      const t = item?.track;
      if (!t?.name) return null;
      const durSec = Math.floor((t.duration_ms || 0) / 1000);
      return {
        id: 'spotify-' + (t.id || Math.random().toString(36).slice(2)),
        title: t.name,
        artist: t.artists?.[0]?.name || 'Unknown',
        album: t.album?.name || '',
        duration: `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}`,
        coverUrl: t.album?.images?.[0]?.url || '/placeholder.svg',
      };
    }).filter(Boolean);

    return json({
      name: pl.name || 'Spotify Playlist',
      description: pl.description || '',
      coverUrl: pl.images?.[0]?.url || '',
      tracks,
    });

  } catch (e) {
    return json({ error: e.message || 'Unknown error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
