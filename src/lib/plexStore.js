import { base44 } from '@/api/base44Client';
import { normalizeTitle } from '@/lib/matching';

const CHUNK = 500;
const TRACKED = [
  'title',
  'search_title',
  'kind',
  'year',
  'thumb',
  'library',
  'resolution',
  'duration_ms',
  'added_at',
  'progress_pct',
  'season_count',
  'season_numbers',
  'last_viewed_at',
  'view_count',
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimit(error) {
  return error?.status === 429 || error?.response?.status === 429;
}

export async function writeWithRetry(run) {
  try {
    return await run();
  } catch (error) {
    if (!isRateLimit(error)) throw error;
    await wait(8000);
    return run();
  }
}

export async function listAllPlexMovies() {
  const rows = [];
  let cursor = null;
  do {
    const page = await base44.entities.PlexMovie.list({
      limit: CHUNK,
      ...(cursor ? { cursor } : {}),
    });
    rows.push(...(page.items || []));
    cursor = page.next_cursor || null;
  } while (cursor);
  return rows;
}

function changed(existing, next) {
  return TRACKED.some((field) => (existing?.[field] ?? null) !== (next?.[field] ?? null));
}

// Only writes what actually changed, so repeat syncs cost almost nothing.
export async function ingestPlexMovies(movies, { onProgress, existing, scope } = {}) {
  const rows = movies.map((movie) => ({ ...movie, search_title: normalizeTitle(movie.title) }));
  const current = existing || (await listAllPlexMovies());
  const existingByKey = new Map(current.map((row) => [String(row.rating_key), row]));
  const incoming = new Set(rows.map((row) => String(row.rating_key)));

  const toCreate = rows.filter((row) => !existingByKey.has(String(row.rating_key)));
  const toUpdate = rows
    .filter((row) => existingByKey.has(String(row.rating_key)))
    .map((row) => ({ id: existingByKey.get(String(row.rating_key)).id, ...row }))
    .filter((row) => changed(existingByKey.get(String(row.rating_key)), row));
  const staleKeys = current
    .filter((row) => !incoming.has(String(row.rating_key)) && (!scope || scope.has(row.kind)))
    .map((row) => row.rating_key);

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await writeWithRetry(() => base44.entities.PlexMovie.bulkCreate(toCreate.slice(i, i + CHUNK)));
    onProgress?.(Math.min(i + CHUNK, toCreate.length), 'Saving new titles');
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    await writeWithRetry(() => base44.entities.PlexMovie.bulkUpdate(toUpdate.slice(i, i + CHUNK)));
    onProgress?.(Math.min(i + CHUNK, toUpdate.length), 'Updating titles');
  }

  for (let i = 0; i < staleKeys.length; i += CHUNK) {
    await writeWithRetry(() =>
      base44.entities.PlexMovie.deleteMany({ rating_key: { $in: staleKeys.slice(i, i + CHUNK) } })
    );
  }

  return { created: toCreate.length, updated: toUpdate.length, removed: staleKeys.length };
}