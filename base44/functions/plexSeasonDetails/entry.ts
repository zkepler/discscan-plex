import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { safeFetch } from '../../shared/plexServer.ts';

// One season of a TV show as Plex holds it: the season summary plus its episodes.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.plex_token || '').trim();
    const ratingKey = String(body?.rating_key || '').trim();
    const requested = String(body?.plex_url || '').trim();
    const season = Number(body?.season);

    if (!token || token.length > 200) {
      return Response.json({ error: 'A Plex token is required' }, { status: 400 });
    }
    // The key is interpolated into the request path, so only plain digits pass.
    if (!/^\d{1,20}$/.test(ratingKey)) {
      return Response.json({ error: 'A valid Plex show key is required' }, { status: 400 });
    }
    if (!requested) {
      return Response.json({ error: 'A Plex server address is required' }, { status: 400 });
    }
    if (!Number.isInteger(season) || season < 0 || season > 1000) {
      return Response.json({ error: 'A valid season number is required' }, { status: 400 });
    }

    const baseUrl = requested.replace(/\/+$/, '');

    const plexGet = async (path: string) => {
      const res = await safeFetch(`${baseUrl}${path}?X-Plex-Token=${encodeURIComponent(token)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 401) {
        throw Object.assign(new Error('Plex rejected that token. Check the value in Settings.'), { status: 400 });
      }
      if (!res.ok) {
        throw Object.assign(new Error(`Plex responded with ${res.status}.`), { status: 502 });
      }
      return res.json().catch(() => null);
    };

    const seasonList = await plexGet(`/library/metadata/${ratingKey}/children`);
    const seasons = seasonList?.MediaContainer?.Metadata || [];
    const match = seasons.find((item: any) => Number(item.index) === season);
    if (!match?.ratingKey) return Response.json({ found: false });

    const episodeList = await plexGet(`/library/metadata/${match.ratingKey}/children`);
    const rawEpisodes = episodeList?.MediaContainer?.Metadata || [];

    return Response.json({
      found: true,
      season: {
        number: season,
        title: match.title || `Season ${season}`,
        summary: match.summary || '',
        thumb: match.thumb || null,
        episode_count: Number(match.leafCount || rawEpisodes.length || 0),
        watched_count: Number(match.viewedLeafCount || 0),
        year: match.year ? Number(match.year) : null,
        added_at: match.addedAt ? Number(match.addedAt) : null,
      },
      episodes: rawEpisodes.slice(0, 200).map((item: any) => ({
        key: String(item.ratingKey || ''),
        number: item.index ? Number(item.index) : null,
        title: item.title || 'Untitled',
        summary: item.summary || '',
        runtime_minutes: item.duration ? Math.round(Number(item.duration) / 60000) : null,
        aired: item.originallyAvailableAt || null,
        watched: Number(item.viewCount || 0) > 0,
      })),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}