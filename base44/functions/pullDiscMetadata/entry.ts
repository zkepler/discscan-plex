import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { listPlexServers, resolveReachable, safeFetch } from '../../shared/plexServer.ts';
import { metadataFromPlex } from '../../shared/plexMetadata.ts';

const MAX = 24;
const BATCH = 6;

function needsDetails(disc: any) {
  return !String(disc.plot || '').trim() && !(Array.isArray(disc.directors) && disc.directors.length);
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
      const page = await base44.entities.Disc.filter({}, { limit: 500 });
      discs = page.items || [];
    }

    // The key is interpolated into the request path, so only plain digits pass.
    discs = discs
      .filter((disc: any) => /^\d{1,20}$/.test(String(disc.plex_rating_key || '')))
      .filter((disc: any) => (ids.length ? true : needsDetails(disc)))
      .slice(0, MAX);
    if (!discs.length) return Response.json({ updated: 0, checked: 0, discs: [] });

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

    const rows: any[] = [];
    for (let i = 0; i < discs.length; i += BATCH) {
      const batch = discs.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (disc: any) => {
          const res = await safeFetch(
            `${baseUrl}/library/metadata/${disc.plex_rating_key}?X-Plex-Token=${encodeURIComponent(token)}`,
            { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }
          );
          if (!res.ok) throw new Error(`Plex responded with ${res.status} for that item.`);
          const data = await res.json().catch(() => null);
          const meta = metadataFromPlex(data?.MediaContainer?.Metadata?.[0]);
          if (!meta) throw new Error('Plex had no details for that item.');

          const row: any = {
            id: disc.id,
            directors: meta.directors || [],
            studio: meta.studio || '',
            runtime_minutes: meta.runtime_minutes ?? null,
            genres: meta.genres || [],
            rating: meta.rating || '',
            cast: meta.cast || [],
            plot: meta.plot || '',
            edition: meta.edition || '',
          };
          // Never rename a shelf entry, and only fill a year that is missing.
          if (!disc.year && meta.year) row.year = meta.year;
          return row;
        })
      );
      settled.forEach((result) => {
        if (result.status === 'fulfilled') rows.push(result.value);
      });
    }

    if (rows.length) await base44.entities.Disc.bulkUpdate(rows);
    return Response.json({ updated: rows.length, checked: discs.length, discs: rows });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}