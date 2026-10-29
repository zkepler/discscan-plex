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

export async function findPlexMatch(title, year) {
  const key = normalizeTitle(title);
  if (!key) return null;
  const page = await base44.entities.PlexMovie.filter({ search_title: key }, { limit: 20 });
  return pickMatch(page.items || [], year);
}