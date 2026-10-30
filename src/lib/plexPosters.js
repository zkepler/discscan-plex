import { base44 } from '@/api/base44Client';
import { emitDisc } from '@/lib/discEvents';

// Finds posters for every disc missing artwork — Plex library art first, then the
// web — and keeps going until the shelf is covered (or nothing more can be found).
export async function pullPostersForDiscs(discIds, onProgress) {
  const skip = [];
  const covers = [];

  for (let round = 0; round < 60; round += 1) {
    const response = await base44.functions.invoke('pullDiscPosters', {
      ...(discIds?.length ? { disc_ids: discIds } : {}),
      ...(skip.length ? { skip_ids: skip } : {}),
    });
    const data = response?.data || {};
    const fresh = data.covers || [];

    fresh.forEach((cover) =>
      emitDisc({ type: 'patch', id: cover.id, patch: { cover_url: cover.cover_url } })
    );
    covers.push(...fresh);

    const attempted = data.attempted || [];
    skip.push(...attempted);
    onProgress?.({ updated: covers.length, remaining: data.remaining || 0 });

    if (discIds?.length) break;
    if (!attempted.length || !data.remaining) break;
  }

  return { updated: covers.length, covers };
}