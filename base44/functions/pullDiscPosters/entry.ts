import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { listPlexServers, resolveReachable, safeFetch } from '../../shared/plexServer.ts';

const MAX = 24;
const BATCH = 6;

function photoPath(thumb: string) {
  const dimensions = 'width=400&height=600&minSize=1&upscale=1';
  return `/photo/:/transcode?${dimensions}&url=${encodeURIComponent(thumb)}`;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.disc_ids)
      ? body.disc_ids
          .map((id: any) => String(id || ''))
          .filter(Boolean)
          .slice(0, MAX)
      : [];

    const configList = await base44.entities.PlexConfig.list();
    const config = Array.isArray(configList) ? configList[0] : configList?.items?.[0];
    const token = String(config?.plex_token || '').trim();
    if (!token) {
      return Response.json({ error: 'Connect your Plex server first.' }, { status: 400 });
    }

    let discs: any[] = [];
    if (ids.length) {
      const page = await base44.entities.Disc.filter({ id: { $in: ids } }, { limit: ids.length });
      discs = page.items || [];
    } else {
      // Backfill the discs that are linked to Plex but have no artwork yet.
      const page = await base44.entities.Disc.filter({}, { limit: 500 });
      discs = page.items || [];
    }
    discs = discs.filter((disc: any) => disc.plex_rating_key && !disc.cover_url).slice(0, MAX);
    if (!discs.length) return Response.json({ updated: 0, checked: 0, covers: [] });

    const keys = [...new Set(discs.map((disc: any) => String(disc.plex_rating_key)))];
    const moviePage = await base44.entities.PlexMovie.filter(
      { rating_key: { $in: keys } },
      { limit: keys.length }
    );
    const thumbByKey = new Map<string, string>();
    (moviePage.items || []).forEach((movie: any) => {
      if (movie?.thumb) thumbByKey.set(String(movie.rating_key), String(movie.thumb));
    });

    const targets = discs.filter((disc: any) => thumbByKey.has(String(disc.plex_rating_key)));
    if (!targets.length) {
      return Response.json({ updated: 0, checked: discs.length, covers: [] });
    }

    const servers = await listPlexServers(token).catch(() => []);
    const baseUrl = await resolveReachable(servers, token, config?.plex_url);
    if (!baseUrl) {
      return Response.json(
        {
          error:
            'Your Plex server could not be reached. Turn on Remote Access in Plex → Settings, then try again.',
        },
        { status: 502 }
      );
    }

    const covers: { id: string; cover_url: string }[] = [];
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (disc: any) => {
          const thumb = thumbByKey.get(String(disc.plex_rating_key)) as string;
          const res = await safeFetch(
            `${baseUrl}${photoPath(thumb)}&X-Plex-Token=${encodeURIComponent(token)}`,
            { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(60000) }
          );
          if (!res.ok) throw new Error(`Plex responded with ${res.status} for that poster.`);
          const bytes = await res.arrayBuffer();
          const file = new File([bytes], `plex-${disc.plex_rating_key}.jpg`, {
            type: res.headers.get('content-type') || 'image/jpeg',
          });
          const uploaded = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
          if (!uploaded?.file_url) throw new Error('Could not store that poster.');
          return { id: disc.id, cover_url: uploaded.file_url };
        })
      );
      settled.forEach((result) => {
        if (result.status === 'fulfilled') covers.push(result.value);
      });
    }

    if (covers.length) await base44.entities.Disc.bulkUpdate(covers);
    return Response.json({ updated: covers.length, checked: discs.length, covers });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}