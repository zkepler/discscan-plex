import { base44 } from '@/api/base44Client';
import { fetchLibraryMovies } from '@/lib/plex';
import { normalizeTitle, pickMatch } from '@/lib/matching';
import { saveConfig } from '@/lib/appSettings';

const CHUNK = 100;

export async function syncPlexLibrary(config, onProgress) {
  const { movies, url } = await fetchLibraryMovies(config, onProgress);

  const index = new Map();
  movies.forEach((movie) => {
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
    await base44.entities.Disc.bulkUpdate(updates.slice(i, i + CHUNK));
  }

  await base44.entities.PlexMovie.deleteMany({});
  const rows = movies.map((movie) => ({ ...movie, search_title: normalizeTitle(movie.title) }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await base44.entities.PlexMovie.bulkCreate(rows.slice(i, i + CHUNK));
  }

  await saveConfig({ plex_url: url, last_sync: new Date().toISOString() });

  return { total: movies.length, matched: updates.filter((u) => u.plex_rating_key).length };
}