import { base44 } from '@/api/base44Client';
import { emitDisc } from '@/lib/discEvents';

// Copies posters from Plex onto shelf discs that are linked but have no artwork.
export async function pullPostersForDiscs(discIds) {
  const response = await base44.functions.invoke('pullDiscPosters', {
    ...(discIds?.length ? { disc_ids: discIds } : {}),
  });
  const data = response?.data || {};
  (data.covers || []).forEach((cover) =>
    emitDisc({ type: 'patch', id: cover.id, patch: { cover_url: cover.cover_url } })
  );
  return data;
}