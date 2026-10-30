// Reads a metadata file (.nfo / .xml / .json / plain "Key: Value" text) and turns it
// into the fields a Disc stores, so an item can be described from an existing file.

const ALIASES = {
  title: ['title', 'name', 'originaltitle'],
  year: ['year', 'releaseyear', 'premiered', 'releasedate'],
  directors: ['directors', 'director', 'creator'],
  studio: ['studio', 'productioncompany', 'publisher', 'label'],
  runtime_minutes: ['runtime_minutes', 'runtime', 'duration', 'playtime'],
  genres: ['genres', 'genre'],
  rating: ['rating', 'mpaa', 'certification', 'contentrating', 'rated'],
  plot: ['plot', 'overview', 'synopsis', 'outline', 'description'],
  cast: ['cast', 'actors', 'actor', 'stars'],
  edition: ['edition', 'version', 'discversion'],
};

export function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function pick(raw, keys) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function toList(value, max = 12) {
  if (value === undefined) return undefined;
  const list = splitList(value).slice(0, max);
  return list.length ? list : undefined;
}

function toMinutes(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Math.round(value) || undefined;
  const text = String(value);
  const hours = text.match(/(\d+)\s*h/i);
  const minutes = text.match(/(\d+)\s*m(?!s)/i);
  if (hours || minutes) {
    const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total || undefined;
  }
  const digits = parseInt(text.replace(/\D/g, ''), 10);
  return Number.isFinite(digits) && digits > 0 ? digits : undefined;
}

export function normaliseMetadata(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};

  const title = pick(raw, ALIASES.title);
  if (typeof title === 'string' && title.trim()) out.title = title.trim();

  const year = pick(raw, ALIASES.year);
  if (year !== undefined) {
    const digits = String(year).replace(/\D/g, '').slice(0, 4);
    if (digits.length === 4) out.year = Number(digits);
  }

  const directors = toList(pick(raw, ALIASES.directors));
  if (directors) out.directors = directors;

  const cast = toList(pick(raw, ALIASES.cast), 20);
  if (cast) out.cast = cast;

  const genres = toList(pick(raw, ALIASES.genres));
  if (genres) out.genres = genres;

  const studio = pick(raw, ALIASES.studio);
  if (typeof studio === 'string' && studio.trim()) out.studio = studio.trim();

  const runtime = toMinutes(pick(raw, ALIASES.runtime_minutes));
  if (runtime) out.runtime_minutes = runtime;

  const rating = pick(raw, ALIASES.rating);
  // A bare number is a score (e.g. 7.8), not a certificate — leave it out.
  if (typeof rating === 'string' && rating.trim() && !/^\d+(\.\d+)?$/.test(rating.trim())) {
    out.rating = rating.trim().slice(0, 12);
  }

  const plot = pick(raw, ALIASES.plot);
  if (typeof plot === 'string' && plot.trim()) out.plot = plot.trim().slice(0, 2000);

  const edition = pick(raw, ALIASES.edition);
  if (typeof edition === 'string' && edition.trim()) out.edition = edition.trim().slice(0, 60);

  return out;
}

function tags(text, tag) {
  const matches = text.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'));
  return Array.from(matches)
    .map((match) => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const broken = doc.getElementsByTagName('parsererror').length > 0;

  if (!broken) {
    const all = (tag) => Array.from(doc.getElementsByTagName(tag)).map((node) => node.textContent.trim()).filter(Boolean);
    const one = (tag) => all(tag)[0];
    const actors = Array.from(doc.getElementsByTagName('actor'))
      .map((node) => (node.getElementsByTagName('name')[0]?.textContent || '').trim())
      .filter(Boolean);

    return {
      title: one('title'),
      year: one('year') || one('premiered'),
      directors: all('director'),
      studio: one('studio'),
      runtime_minutes: one('runtime'),
      genres: all('genre'),
      rating: one('mpaa') || one('certification') || one('contentrating'),
      plot: one('plot') || one('outline'),
      cast: actors,
      edition: one('edition'),
    };
  }

  // Lenient pass for .nfo files that are not well-formed XML.
  const first = (tag) => tags(text, tag)[0];
  return {
    title: first('title'),
    year: first('year'),
    directors: tags(text, 'director'),
    studio: first('studio'),
    runtime_minutes: first('runtime'),
    genres: tags(text, 'genre'),
    rating: first('mpaa') || first('certification'),
    plot: first('plot') || first('outline'),
    cast: tags(text, 'name'),
    edition: first('edition'),
  };
}

function parseKeyValues(text) {
  const raw = {};
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z _-]+?)\s*[:=]\s*(.+)$/);
    if (!match) return;
    const key = match[1].trim().toLowerCase().replace(/[\s_-]+/g, '');
    raw[key] = match[2].trim();
  });
  return raw;
}

export async function readMetadataFile(file) {
  const text = (await file.text()).trim();
  if (!text) throw new Error('That file is empty.');

  if (text.startsWith('{')) return normaliseMetadata(JSON.parse(text));
  if (text.startsWith('<')) return normaliseMetadata(parseXml(text));
  return normaliseMetadata(parseKeyValues(text));
}