import { base44 } from '@/api/base44Client';
import { emitDisc } from '@/lib/discEvents';

// One extra physical copy per additional format of the same film.
export async function addFormatCopies(source, formats) {
  if (!formats?.length) return [];

  const payloads = formats.map((format) => ({
    title: source.title,
    year: source.year || null,
    format,
    location: source.location || '',
    notes: source.notes || '',
    cover_url: source.cover_url || '',
    plex_rating_key: source.plex_rating_key || null,
    plex_title: source.plex_title || null,
  }));

  const created = await base44.entities.Disc.bulkCreate(payloads);
  const list = Array.isArray(created) ? created : [];
  list.forEach((disc) => emitDisc({ type: 'create', disc }));
  return list;
}