import { base44 } from '@/api/base44Client';
import { fetchLibraryMovies } from '@/lib/plex';
import { baseTitle, normalizeTitle } from '@/lib/matching';

const KIND_ORDER = { movie: 0, '4k': 1, show: 2 };

function bestOf(items, disc) {
  return items
    .slice()
    .sort((a, b) => {
      if (disc.format === '4K UHD') {
        const a4 = a.kind === '4k' ? 0 : 1;
        const b4 = b.kind === '4k' ? 0 : 1;
        if (a4 !== b4) return a4 - b4;
      }
      const aYear = Number(a.year) === Number(disc.year) ? 0 : 1;
      const bYear = Number(b.year) === Number(disc.year) ? 0 : 1;
      if (aYear !== bYear) return aYear - bYear;
      return (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
    })[0] || null;
}

// Pulls every movie, 4K movie and TV show off the Plex server, then renames
// each disc to the title Plex uses and links it up.
export async function fixDiscTitles({ config, discs, onProgress }) {
  const { movies } = await fetchLibraryMovies(
    config,
    (count) => onProgress?.({ fetched: count }),
    ['movie', '4k', 'show']
  );

  const byKey = new Map();
  const index = new Map();
  movies.forEach((movie) => {
    byKey.set(String(movie.rating_key), movie);
    const key = normalizeTitle(movie.title);
    if (!key) return;
    index.set(key, [...(index.get(key) || []), movie]);
  });
  const keys = [...index.keys()];

  const updates = [];
  let renamed = 0;
  let linked = 0;

  discs.forEach((disc) => {
    const pinned = disc.plex_rating_key ? byKey.get(String(disc.plex_rating_key)) : null;
    let match = pinned;

    if (!match) {
      const key = normalizeTitle(disc.title);
      if (!key) return;
      const base = baseTitle(key) || key;
      let bucket = index.get(key) || index.get(base);
      if (!bucket) {
        const near = keys.filter(
          (candidate) => candidate.startsWith(`${base} `) || base.startsWith(`${candidate} `)
        );
        if (near.length) bucket = near.flatMap((candidate) => index.get(candidate));
      }
      match = bucket ? bestOf(bucket, disc) : null;
    }

    if (!match) return;

    const nextTitle = String(match.title || '').trim();
    const titleChanged = nextTitle && nextTitle !== disc.title;
    const linkChanged = String(match.rating_key) !== String(disc.plex_rating_key || '');
    if (!titleChanged && !linkChanged) return;

    if (titleChanged) renamed += 1;
    if (linkChanged) linked += 1;
    updates.push({
      id: disc.id,
      title: titleChanged ? nextTitle : disc.title,
      plex_rating_key: String(match.rating_key),
      plex_title: nextTitle || disc.plex_title || null,
    });
  });

  const CHUNK = 200;
  for (let index = 0; index < updates.length; index += CHUNK) {
    await base44.entities.Disc.bulkUpdate(updates.slice(index, index + CHUNK));
    onProgress?.({ applied: Math.min(index + CHUNK, updates.length), total: updates.length });
  }

  return { total: updates.length, renamed, linked, checked: discs.length };
}