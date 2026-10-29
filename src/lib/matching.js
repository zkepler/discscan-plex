import { base44 } from '@/api/base44Client';

export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pickMatch(candidates, year) {
  if (!candidates || !candidates.length) return null;
  if (year) {
    const exact = candidates.find((c) => Number(c.year) === Number(year));
    if (exact) return exact;
  }
  return candidates[0];
}

// A 4K disc should line up with the 4K library when the same film sits in both.
function kindForFormat(format) {
  return format === '4K UHD' ? '4k' : null;
}

function pickBest(candidates, year, format) {
  if (!candidates?.length) return null;
  const wanted = kindForFormat(format);
  const inKind = wanted ? candidates.filter((item) => item.kind === wanted) : [];
  return pickMatch(inKind.length ? inKind : candidates, year);
}

// "The Office Season 1" should still find the show "The Office".
export function baseTitle(key) {
  return key
    .replace(/\b(season|series|volume|vol|disc|complete|collection|box)\b.*$/, '')
    .trim();
}

async function searchPlex(query, limit = 20) {
  const page = await base44.entities.PlexMovie.filter(query, { limit });
  return page.items || [];
}

// Searches every synced category — movies, 4K movies and TV shows.
export async function findPlexMatch(title, year, format) {
  const key = normalizeTitle(title);
  if (!key) return null;

  const exact = await searchPlex({ search_title: key });
  const exactMatch = pickBest(exact, year, format);
  if (exactMatch) return exactMatch;

  const base = baseTitle(key);
  if (base && base !== key) {
    const relaxed = await searchPlex({ search_title: { $regex: `^${escapeRegex(base)}` } });
    const relaxedMatch = pickBest(relaxed, year, format);
    if (relaxedMatch) return relaxedMatch;
  }

  // Fall back to the 4K library for 4K discs, so a differently titled entry still links up.
  const wanted = kindForFormat(format);
  if (wanted) {
    const byKind = await searchPlex({ kind: wanted, search_title: { $regex: escapeRegex(key) } });
    return pickBest(byKind, year, format);
  }

  return null;
}