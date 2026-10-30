// Plex library metadata (directors, genres, cast, summary…) mapped to the fields a Disc stores.

export function plexTags(list: any, max = 20): string[] {
  return (Array.isArray(list) ? list : [])
    .map((entry: any) => String(entry?.tag || '').trim())
    .filter(Boolean)
    .slice(0, max);
}

export function metadataFromPlex(item: any) {
  if (!item) return null;
  const runtime = Number(item.duration || 0);
  return {
    title: item.title || '',
    year: item.year ? Number(item.year) : undefined,
    directors: plexTags(item.Director),
    studio: item.studio || '',
    runtime_minutes: runtime ? Math.round(runtime / 60000) : undefined,
    genres: plexTags(item.Genre),
    rating: item.contentRating || '',
    cast: plexTags(item.Role),
    plot: item.summary || '',
    edition: item.editionTitle || item.edition || '',
  };
}