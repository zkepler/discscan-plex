import { base44 } from '@/api/base44Client';
import { fetchLibraryMovies } from '@/lib/plex';
import { normalizeTitle, pickMatch } from '@/lib/matching';
import { saveConfig } from '@/lib/appSettings';
import { ingestPlexMovies, listAllPlexMovies, writeWithRetry } from '@/lib/plexStore';

const CHUNK = 500;

// kinds: null syncs everything, or ['movie'], ['4k'], ['show'] to refresh one category.
export async function syncPlexLibrary(config, onProgress, kinds = null) {
  const { movies, url } = await fetchLibraryMovies(config, onProgress, kinds);
  const stored = await listAllPlexMovies();
  const scope = kinds?.length ? new Set(kinds) : new Set(movies.map((movie) => movie.kind));

  // Titles from categories we are not syncing stay available for disc matching.
  const pool = [...stored.filter((row) => !scope.has(row.kind)), ...movies];

  const index = new Map();
  pool.forEach((movie) => {
    const key = normalizeTitle(movie.title);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(movie);
  });

  const discs = await base44.entities.Disc.list();
  const updates = discs
    .map((disc) => {
      const match = pickMatch(index.get(normalizeTitle(disc.title)), disc.year);
      return {
        id: disc.id,
        plex_rating_key: match ? match.rating_key : null,
        plex_title: match ? match.title : null,
      };
    })
    .filter((update, i) => {
      const disc = discs[i];
      return (
        update.plex_rating_key !== (disc.plex_rating_key || null) ||
        update.plex_title !== (disc.plex_title || null)
      );
    });

  for (let i = 0; i < updates.length; i += CHUNK) {
    await writeWithRetry(() => base44.entities.Disc.bulkUpdate(updates.slice(i, i + CHUNK)));
  }

  await ingestPlexMovies(movies, { onProgress, existing: stored, scope });

  await saveConfig({ plex_url: url, last_sync: new Date().toISOString() });

  return { total: movies.length, matched: updates.filter((u) => u.plex_rating_key).length };
}