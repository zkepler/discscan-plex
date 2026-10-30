import { base44 } from '@/api/base44Client';
import { emitDisc } from '@/lib/discEvents';
import { baseTitle, groupDiscs, sameFilm, seasonNumber } from '@/lib/groupDiscs';

const normalizeFormat = (format) => String(format || 'DVD').trim().toLowerCase();
export const sameFormat = (a, b) => normalizeFormat(a) === normalizeFormat(b);

// Every copy of the same film that is already on the shelf.
export function filmCopies(discs, draft) {
  const film = {
    base: baseTitle(draft.title),
    year: draft.year || null,
    plexKey: draft.plex_rating_key || '',
  };
  return (discs || []).filter((disc) => sameFilm(film, disc));
}

// The original entry a new copy belongs to, when that format is already owned.
export function existingCopy(discs, draft) {
  return filmCopies(discs, draft).find((disc) => sameFormat(disc.format, draft.format)) || null;
}

// The copy worth keeping: the one carrying a barcode, cover and shelf.
const rank = (disc) => (disc.upc ? 4 : 0) + (disc.cover_url ? 2 : 0) + (disc.location ? 1 : 0);
const FILL = ['upc', 'cover_url', 'year', 'location', 'notes', 'plex_rating_key', 'plex_title'];

// Duplicates of one film in one format collapse onto a single entry.
export function mergeDuplicates(discs) {
  const kept = [];
  const extras = [];

  groupDiscs(discs || []).forEach((group) => {
    const buckets = new Map();
    group.discs.forEach((disc) => {
      // Seasons of one show are separate releases, never copies of each other.
      const key = `${normalizeFormat(disc.format)}|${seasonNumber(disc.title) ?? ''}`;
      buckets.set(key, [...(buckets.get(key) || []), disc]);
    });

    buckets.forEach((copies) => {
      const [head, ...rest] = [...copies].sort(
        (a, b) => rank(b) - rank(a) || String(a.created_date || '').localeCompare(String(b.created_date || ''))
      );
      // Nothing the extras know is lost when they fold in.
      const patch = {};
      rest.forEach((disc) => {
        FILL.forEach((field) => {
          if (!head[field] && !patch[field] && disc[field]) patch[field] = disc[field];
        });
      });
      kept.push({ disc: { ...head, ...patch }, patch });
      extras.push(...rest);
    });
  });

  return { kept, extras };
}

// Existing duplicates are combined with the original entry and removed.
export async function combineDuplicates(discs) {
  const { kept, extras } = mergeDuplicates(discs);
  if (!extras.length) return { discs, merged: 0 };

  const patches = kept.filter((entry) => Object.keys(entry.patch).length);
  await Promise.all([
    ...extras.map((disc) => base44.entities.Disc.delete(disc.id)),
    ...patches.map((entry) => base44.entities.Disc.update(entry.disc.id, entry.patch)),
  ]);

  extras.forEach((disc) => emitDisc({ type: 'remove', id: disc.id }));
  patches.forEach((entry) => emitDisc({ type: 'patch', id: entry.disc.id, patch: entry.patch }));

  return { discs: kept.map((entry) => entry.disc), merged: extras.length };
}