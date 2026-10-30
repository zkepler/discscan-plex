import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const VIDEO_FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS'];

// Most specific format wins: a "Blu-ray + DVD" listing is a Blu-ray, a tape is a tape.
const FORMAT_PATTERNS = [
  [/\b(?:4k|uhd)\b/i, '4K UHD'],
  [/blu-?ray/i, 'Blu-ray'],
  [/\bvhs\b|video\s?cassette|video\s?tape|videotape|\bbetamax\b/i, 'VHS'],
  [/\bdvds?\b/i, 'DVD'],
];

function detectFormat(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const hit = FORMAT_PATTERNS.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : '';
}

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\((?:dvd|blu-?ray|4k|uhd|vhs|video\s?cassette|videotape|widescreen|fullscreen|full screen|special edition|collector'?s edition|anniversary edition|\d+\s*disc[^)]*|multi-format|digital copy|unrated|rated)[^)]*\)/gi,
      ' '
    )
    .replace(/\((?:good|very good|acceptable|used|new|like new|sealed)[^)]*\)/gi, ' ')
    .replace(/^(?:pre-?owned|used|new)\s*[-–:]?\s*/i, '')
    .replace(/\s*[-–]\s*(dvd|blu-?ray|vhs|4k.*)$/i, '')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWebTitle(raw) {
  return String(raw || '')
    .replace(/\((?:dvd|blu-?ray|4k|uhd|vhs|videotape|widescreen|fullscreen|digital copy)\)/gi, ' ')
    .replace(/\s*[-–]\s*(dvd|blu-?ray|vhs|4k|uhd)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDetails(raw) {
  if (!raw || raw.found === false || !raw.title) return null;

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  const toList = (value, limit) =>
    (Array.isArray(value) ? value : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .slice(0, limit);

  const imdbId = String(raw.imdb_id || '').trim();
  const poster = String(raw.poster || '').trim();

  return {
    title: cleanWebTitle(raw.title),
    year: toNumber(raw.year),
    directors: toList(raw.directors, 3),
    runtime_minutes: toNumber(raw.runtime_minutes),
    genres: toList(raw.genres, 3),
    rating: toNumber(raw.rating),
    plot: String(raw.plot || '').slice(0, 320),
    imdb_id: /^tt\d{7,9}$/.test(imdbId) ? imdbId : '',
    poster: /^https?:\/\//i.test(poster) ? poster : '',
  };
}

async function movieDetails(base44, title, year) {
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt:
      `Look up the film or TV title "${title}"${year ? ` (${year})` : ''} on public movie databases — IMDb, TMDb, Rotten Tomatoes, Wikipedia — and identify the single most likely title behind a physical disc release.\n` +
      'Return:\n' +
      '- found: true only when you positively identified the title, false otherwise\n' +
      '- title: the canonical title\n' +
      '- year: the original release year as a 4-digit integer\n' +
      '- directors: up to 3 director (or creator) names\n' +
      '- runtime_minutes: the theatrical run time in whole minutes\n' +
      '- genres: up to 3 genres\n' +
      '- rating: the IMDb user rating out of 10, one decimal place\n' +
      '- plot: a two-sentence synopsis under 300 characters\n' +
      '- imdb_id: the IMDb title id such as tt0133093, only when a page states it\n' +
      '- poster: a direct https poster image URL\n' +
      'Never invent a value. Omit any field you cannot verify on a real page.',
    add_context_from_internet: true,
    model: 'gemini_3_8_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        title: { type: 'string' },
        year: { type: 'integer' },
        directors: { type: 'array', items: { type: 'string' } },
        runtime_minutes: { type: 'integer' },
        genres: { type: 'array', items: { type: 'string' } },
        rating: { type: 'number' },
        plot: { type: 'string' },
        imdb_id: { type: 'string' },
        poster: { type: 'string' },
      },
      required: ['found'],
    },
  });

  return normalizeDetails(response);
}

async function webBarcodeLookup(base44, upc) {
  // Plain text, not a JSON schema: web grounding and structured output do not combine,
  // and the groundless answer just guesses at the barcode.
  const spaced = upc.length === 12 ? `${upc[0]} ${upc.slice(1, 6)} ${upc.slice(6, 11)} ${upc[11]}` : '';
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt:
      `Find the movie or TV title released with the barcode ${upc}${spaced ? ` (often printed as ${spaced})` : ''}.\n` +
      'Search product listings and barcode pages that quote these digits — eBay, Walmart, Amazon, barcodelookup, go-upc, upcitemdb, vhscollector.\n' +
      'Answer with the title and year only, in the form "Title (Year) - Format", where Format is DVD, Blu-ray, 4K UHD or VHS and the title carries no edition or format words.\n' +
      'If no listing confirms the barcode, answer exactly: none\n' +
      'Never guess a title from a similar barcode.',
    add_context_from_internet: true,
    model: 'gemini_3_1_pro',
  });

  const line = String(response || '').trim().split('\n')[0].split('[')[0].trim();
  if (!line || /^none/i.test(line)) return null;

  const match = line.match(/^(.*?)\s*\((\d{4})\)\s*(?:[-–—]\s*(.+))?$/);
  const title = cleanWebTitle((match ? match[1] : line).replace(/[*`"]/g, ''));
  if (!title || /^(?:none|not found|unknown|n\/a)$/i.test(title)) return null;

  const formatHint = match?.[3] || '';
  return {
    title,
    year: match ? Number(match[2]) : null,
    format: detectFormat(formatHint, title),
    image: '',
  };
}

async function webReleaseSearch(base44, query) {
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt:
      `Search the web for the physical editions of "${query}" that exist as real releases — DVD, Blu-ray, 4K UHD and vintage VHS tape, including anniversary, collector and special editions. Secondhand and out-of-print releases count: a tape from 1988 is a valid answer.\n` +
      'Look across retailer and catalogue pages (Blu-ray.com, Amazon, Best Buy, Walmart, eBay, VHScollector, Wikipedia) for real releases.\n' +
      `Return 5 to 8 entries, most relevant first, one entry per edition rather than one per film — the collector wants options, so do not stop at a single best match. When VHS tape editions exist, include at least one of them.\n` +
      'Put the film or show name plus the edition name in the title (for example "Blade Runner: The Final Cut" or "Blade Runner (30th Anniversary Collector\'s Edition)"), but leave format words such as DVD, Blu-ray, 4K and VHS out of it and report them in format instead.\n' +
      'For each release provide:\n' +
      '- title: the film or show name only\n' +
      '- year: the film release year as a 4-digit integer, when the page states it\n' +
      '- format: exactly one of "DVD", "Blu-ray", "4K UHD", "VHS"\n' +
      '- upc: the release barcode (UPC/EAN digits) only when a page states it\n' +
      '- image: a direct https image URL of that release cover art from a public site\n' +
      'Never invent barcodes, years or image URLs — omit any field you cannot verify.',
    add_context_from_internet: true,
    model: 'gemini_3_8_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              year: { type: 'integer' },
              format: { type: 'string' },
              upc: { type: 'string' },
              image: { type: 'string' },
            },
            required: ['title'],
          },
        },
      },
      required: ['results'],
    },
  });

  const items = Array.isArray(response?.results) ? response.results : [];
  return items
    .filter((entry) => entry && entry.title)
    .map((entry) => ({
      title: cleanWebTitle(entry.title),
      year: entry.year || null,
      format: VIDEO_FORMATS.includes(entry.format) ? entry.format : detectFormat(entry.format, entry.title),
      upc: String(entry.upc || '').replace(/\D/g, ''),
      image: typeof entry.image === 'string' && /^https?:\/\//i.test(entry.image) ? entry.image : '',
    }))
    .filter((entry) => entry.title);
}

const NOISE = /funko|\bpop!?\b|action figure|figure|statue|poster|t-?shirt|apparel|soundtrack|vinyl|\bcd\b|\bbook\b|novel|comic|video game|board game|\bmug\b|\btoy\b/i;
const MEDIA = /dvd|blu-?ray|4k|uhd|movie|film|video|\bvhs\b|video\s?cassette|videotape/i;

async function catalogSearch(query) {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}&type=product`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }
  );
  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .filter((entry) => {
      const raw = String(entry.title || '');
      return !NOISE.test(raw) && MEDIA.test(`${raw} ${entry.category || ''}`);
    })
    .map((entry) => {
      const raw = String(entry.title || '');
      const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
      return {
        title: cleanTitle(raw),
        upc: String(entry.upc || entry.ean || '').replace(/\D/g, ''),
        image: Array.isArray(entry.images) && entry.images.length ? entry.images[0] : '',
        year: yearMatch ? Number(yearMatch[0]) : null,
        format: detectFormat(raw, entry.category),
      };
    })
    .filter((entry) => entry.title);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body?.query) {
      const query = String(body.query).trim().replace(/\s+/g, ' ').slice(0, 80);
      if (query.length < 2) {
        return Response.json({ error: 'Type at least two characters' }, { status: 400 });
      }

      const [web, catalog] = await Promise.all([
        webReleaseSearch(base44, query).catch(() => []),
        catalogSearch(query).catch(() => []),
      ]);

      const seen = new Set();
      const results = [...web, ...catalog]
        .filter((entry) => {
          const key = String(entry.title || '').toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8);

      return Response.json({ found: results.length > 0, results });
    }

    if (body?.title) {
      const title = String(body.title).trim().replace(/\s+/g, ' ').slice(0, 120);
      if (title.length < 2) {
        return Response.json({ error: 'Type at least two characters' }, { status: 400 });
      }
      const details = await movieDetails(base44, title, Number(body.year) || null).catch(() => null);
      return Response.json({ found: !!details, details });
    }

    const upc = String(body?.upc || '').replace(/\D/g, '');
    if (upc.length < 8) {
      return Response.json({ error: 'Enter a valid barcode' }, { status: 400 });
    }

    // Tape era barcodes are patchy: scanners return 13-digit codes padded with a
    // leading zero, and older sleeves are often printed without it — try each spelling.
    const candidates = [upc];
    if (upc.length === 13 && upc.startsWith('0')) candidates.push(upc.slice(1));
    if (upc.length === 12) candidates.push(`0${upc}`);
    if (upc.length === 10 || upc.length === 11) candidates.push(upc.padStart(12, '0'));

    let item = null;
    let upstream = 'none';
    for (const code of candidates) {
      try {
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        });
        upstream = String(res.status);
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data?.items) ? data.items : [];
        item = items.find((entry) => !/^\s*pre-?owned/i.test(entry.title || '')) || items[0] || null;
        if (!item) upstream = `${res.status}:${data?.code || 'empty'}`;
      } catch (lookupError) {
        item = null;
        upstream = `error:${lookupError?.name || 'unknown'}`;
      }
      // A rate limit or rejected request will not improve on another spelling.
      if (item || /^4/.test(upstream)) break;
    }

    if (!item) {
      // The catalogue has no record (or is rate-limited) — search the web for the barcode instead.
      const web = await webBarcodeLookup(base44, upc).catch(() => null);
      if (web?.title) {
        const webDetails = await movieDetails(base44, web.title, web.year).catch(() => null);
        return Response.json({
          found: true,
          upc,
          title: webDetails?.title || web.title,
          year: webDetails?.year || web.year || null,
          format: web.format,
          image: web.image || webDetails?.poster || '',
          details: webDetails,
          source: 'web',
        });
      }
      return Response.json({ found: false, upc, title: '', image: '', upstream });
    }

    const image = Array.isArray(item.images) && item.images.length ? item.images[0] : '';
    const title = cleanTitle(item.title);
    const format = detectFormat(item.title, item.category) || detectFormat(item.description);
    const details = await movieDetails(base44, title, null).catch(() => null);

    return Response.json({
      found: true,
      upc,
      title: details?.title || title,
      year: details?.year || null,
      format,
      brand: item.brand || '',
      category: item.category || '',
      image: image || details?.poster || '',
      details,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}