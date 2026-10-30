import { base44 } from '@/api/base44Client';
import { emitDisc } from '@/lib/discEvents';

// Copies directors, genres, cast and the synopsis from Plex onto shelf discs.
export async function pullMetadataForDiscs(discIds) {
  const response = await base44.functions.invoke('pullDiscMetadata', {
    ...(discIds?.length ? { disc_ids: discIds } : {}),
  });
  const data = response?.data || {};
  (data.discs || []).forEach((row) => {
    const { id, ...patch } = row;
    emitDisc({ type: 'patch', id, patch });
  });
  return data;
}