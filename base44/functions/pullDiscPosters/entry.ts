import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  assertFetchableUrl,
  listPlexServers,
  resolveReachable,
  safeFetch,
} from '../../shared/plexServer.ts';

// Each call fills a slice of the shelf; the app keeps calling until nothing is left.
const LIMIT = 12;
const PLEX_BATCH = 6;
const WEB_SEARCHES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const normalize = (value: any) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function photoPath(thumb: string) {
  const dimensions = 'width=400&height=600&minSize=1&upscale=1';
  return `/photo/:/transcode?${dimensions}&url=${encodeURIComponent(thumb)}`;
}

async function loadDiscs(base44: any) {
  const all: any[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result: any = await base44.entities.Disc.list({
      limit: 250,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...(result?.items || []));
    if (!result?.has_more || !result?.next_cursor) break;
    cursor = result.next_cursor;
  }
  return all;
}

async function storeImage(base44: any, bytes: ArrayBuffer, type: string, name: string) {
  const file = new File([bytes], name, { type: type || 'image/jpeg' });
  const uploaded = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
  return String(uploaded?.file_url || '');
}

// The URL comes from a catalogue or from the model, so every hop is screened by the
// shared guard: public http(s) hosts only, DNS verified before and after connecting.
async function downloadImage(url: string) {
  if (!/^https?:\/\//i.test(String(url || ''))) return null;
  let res: Response;
  try {
    res = await safeFetch(url, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const type = String(res.headers.get('content-type') || 'image/jpeg');
  if (!type.startsWith('image/')) return null;
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return { bytes, type };
}

// Plex library art: an exact rating-key link first, then the closest title in any library
// (movies, 4K movies and TV shows all live in the synced PlexMovie records).
function chooseTitleMatch(list: any[], disc: any) {
  if (!list?.length) return null;
  if (disc.format === '4K UHD') {
    const fourK = list.find((item) => item.kind === '4k');
    if (fourK) return fourK;
  }
  return list.find((item) => item.kind === 'movie') || list.find((item) => item.kind === 'show') || list[0];
}

async function plexThumbByDisc(base44: any, batch: any[]) {
  const byDisc = new Map<string, string>();
  const keys = batch.map((disc) => String(disc.plex_rating_key || '')).filter(Boolean);
  const titles = [...new Set(batch.map((disc) => normalize(disc.title)).filter(Boolean))];

  const movies: any[] = [];
  if (keys.length) {
    const page = await base44.entities.PlexMovie.filter(
      { rating_key: { $in: keys } },
      { limit: keys.length }
    );
    movies.push(...(page.items || []));
  }
  if (titles.length) {
    const page = await base44.entities.PlexMovie.filter(
      { search_title: { $in: titles } },
      { limit: 400 }
    );
    movies.push(...(page.items || []));
  }

  const byKey = new Map<string, any>();
  const byTitle = new Map<string, any[]>();
  movies.forEach((movie: any) => {
    if (!movie?.thumb) return;
    if (movie.rating_key) byKey.set(String(movie.rating_key), movie);
    const key = String(movie.search_title || normalize(movie.title));
    if (!key) return;
    const list = byTitle.get(key) || [];
    if (!list.some((item) => item.rating_key === movie.rating_key)) list.push(movie);
    byTitle.set(key, list);
  });

  batch.forEach((disc: any) => {
    const linked = disc.plex_rating_key ? byKey.get(String(disc.plex_rating_key)) : null;
    const match = linked || chooseTitleMatch(byTitle.get(normalize(disc.title)) || [], disc);
    if (match?.thumb) byDisc.set(String(disc.id), String(match.thumb));
  });

  return byDisc;
}

async function barcodeImage(disc: any) {
  const upc = String(disc.upc || '').replace(/\D/g, '');
  if (upc.length < 8) return '';
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    const image = Array.isArray(data?.items?.[0]?.images) ? data.items[0].images[0] : '';
    return /^https?:\/\//i.test(String(image)) ? String(image) : '';
  } catch {
    return '';
  }
}

async function webPosterUrl(base44: any, disc: any) {
  const fromBarcode = await barcodeImage(disc);
  if (fromBarcode) return fromBarcode;

  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt:
      `Find the official poster artwork of the ${disc.format === 'VHS' ? 'VHS release' : 'physical release'} "${disc.title}"` +
      `${disc.year ? ` (${disc.year})` : ''}.\n` +
      'Search public film and TV databases (TMDb, IMDb, Wikipedia, Blu-ray.com) for a real poster image of that title.\n' +
      'Answer with one direct https image URL of a portrait poster (roughly 2:3) that loads on its own.\n' +
      'If you cannot verify a real poster URL, answer exactly: none',
    add_context_from_internet: true,
    model: 'gemini_3_8_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        poster: { type: 'string' },
      },
      required: ['found'],
    },
  });

  const poster = String(response?.poster || '').trim();
  if (!response?.found || !/^https?:\/\//i.test(poster)) return '';
  try {
    return String(await assertFetchableUrl(poster));
  } catch {
    return '';
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.disc_ids)
      ? body.disc_ids
          .map((id: any) => String(id || ''))
          .filter(Boolean)
          .slice(0, 50)
      : [];
    const skip = new Set<string>(
      Array.isArray(body?.skip_ids) ? body.skip_ids.map((id: any) => String(id || '')).filter(Boolean) : []
    );

    // The whole shelf is refreshed: existing retailer artwork is replaced by library
    // posters where one can be found, and left untouched when nothing better turns up.
    const discs = await loadDiscs(base44);
    let candidates = discs;
    if (ids.length) candidates = discs.filter((disc: any) => ids.includes(String(disc.id)));
    else candidates = discs.filter((disc: any) => !skip.has(String(disc.id)));

    if (!candidates.length) {
      return Response.json({ updated: 0, covers: [], attempted: [], remaining: 0 });
    }

    const batch = candidates.slice(0, LIMIT);
    const remaining = Math.max(0, candidates.length - batch.length);

    const configList = await base44.entities.PlexConfig.list();
    const config = Array.isArray(configList) ? configList[0] : configList?.items?.[0];
    const token = String(config?.plex_token || '').trim();

    let plexBase = '';
    if (token) {
      const servers = await listPlexServers(token).catch(() => []);
      plexBase = (await resolveReachable(servers, token, config?.plex_url).catch(() => '')) || '';
    }

    const covers: { id: string; cover_url: string }[] = [];
    const covered = new Set<string>();

    // 1. Plex library posters.
    if (plexBase) {
      const thumbs = await plexThumbByDisc(base44, batch).catch(() => new Map<string, string>());
      const jobs = batch
        .filter((disc: any) => thumbs.has(String(disc.id)))
        .map((disc: any) => ({ disc, thumb: thumbs.get(String(disc.id)) as string }));

      for (let i = 0; i < jobs.length; i += PLEX_BATCH) {
        const slice = jobs.slice(i, i + PLEX_BATCH);
        const settled = await Promise.allSettled(
          slice.map(async ({ disc, thumb }) => {
            const res = await safeFetch(
              `${plexBase}${photoPath(thumb)}&X-Plex-Token=${encodeURIComponent(token)}`,
              { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(60000) }
            );
            if (!res.ok) throw new Error(`Plex responded with ${res.status}`);
            const bytes = await res.arrayBuffer();
            const file = new File([bytes], `plex-${disc.id}.jpg`, {
              type: res.headers.get('content-type') || 'image/jpeg',
            });
            const uploaded = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
            if (!uploaded?.file_url) throw new Error('Could not store that poster.');
            return { id: String(disc.id), cover_url: String(uploaded.file_url) };
          })
        );
        settled.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          covers.push(result.value);
          covered.add(result.value.id);
        });
      }
    }

    // 2. The web, for whatever Plex could not supply.
    const needy = batch.filter((disc: any) => !covered.has(String(disc.id)));
    const settled = await Promise.allSettled(
      needy.map(async (disc: any, index: number) => {
        const url = index < WEB_SEARCHES ? await webPosterUrl(base44, disc) : await barcodeImage(disc);
        if (!url) throw new Error('No poster found');
        const image = await downloadImage(url);
        if (!image) throw new Error('That poster could not be downloaded');
        const stored = await storeImage(base44, image.bytes, image.type, `web-${disc.id}.jpg`);
        if (!stored) throw new Error('Could not store that poster.');
        return { id: String(disc.id), cover_url: stored };
      })
    );
    settled.forEach((result) => {
      if (result.status === 'fulfilled') covers.push(result.value);
    });

    if (covers.length) await base44.entities.Disc.bulkUpdate(covers);

    return Response.json({
      updated: covers.length,
      covers,
      attempted: batch.map((disc: any) => String(disc.id)),
      remaining,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}