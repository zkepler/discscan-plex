import { base44 } from '@/api/base44Client';

const CHUNK = 100;

// Watch state for the titles on the shelf, keyed by Plex rating key.
export async function loadWatchStatus(ratingKeys) {
  const keys = [...new Set((ratingKeys || []).filter(Boolean))];
  const map = {};

  for (let i = 0; i < keys.length; i += CHUNK) {
    const page = await base44.entities.PlexMovie.filter(
      { rating_key: { $in: keys.slice(i, i + CHUNK) } },
      { limit: CHUNK }
    );
    (page.items || []).forEach((row) => {
      map[row.rating_key] = {
        progress: Number(row.progress_pct || 0),
        watched: Number(row.view_count || 0) > 0,
      };
    });
  }

  return map;
}

// A movie you own in several formats may be watched in one copy and started in another.
export function watchState(discs, watch) {
  let best = null;
  (discs || []).forEach((disc) => {
    const entry = disc.plex_rating_key ? watch[disc.plex_rating_key] : null;
    if (!entry) return;
    if (entry.watched) best = { watched: true, progress: 100 };
    else if (!best?.watched && entry.progress > (best?.progress || 0)) best = entry;
  });
  return best;
}