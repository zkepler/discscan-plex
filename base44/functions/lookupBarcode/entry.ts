import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const VIDEO_FORMATS = ['DVD', 'Blu-ray', '4K UHD'];

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\((?:dvd|blu-?ray|4k|uhd|widescreen|fullscreen|full screen|special edition|collector'?s edition|anniversary edition|\d+\s*disc[^)]*|multi-format|digital copy|unrated|rated)[^)]*\)/gi,
      ' '
    )
    .replace(/\((?:good|very good|acceptable|used|new|like new|sealed)[^)]*\)/gi, ' ')
    .replace(/^(?:pre-?owned|used|new)\s*[-–:]?\s*/i, '')
    .replace(/\s*[-–]\s*(dvd|blu-?ray|4k.*)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWebTitle(raw) {
  return String(raw || '')
    .replace(/\((?:dvd|blu-?ray|4k|uhd|widescreen|fullscreen|digital copy)\)/gi, ' ')
    .replace(/\s*[-–]\s*(dvd|blu-?ray|4k|uhd)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function webReleaseSearch(base44, query) {
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt:
      `Search the web for the physical disc editions of "${query}" sold today — DVD, Blu-ray, 4K UHD, anniversary, collector and special editions.\n` +
      'Look across retailer and catalogue pages (Blu-ray.com, Amazon, Best Buy, Walmart, eBay, Wikipedia) for real releases.\n' +
      `Return 5 to 8 entries, most relevant first, one entry per edition rather than one per film — the collector wants options, so do not stop at a single best match.\n` +
      'Put the film or show name plus the edition name in the title (for example "Blade Runner: The Final Cut" or "Blade Runner (30th Anniversary Collector\'s Edition)"), but leave disc format words such as DVD, Blu-ray and 4K out of it and report them in format instead.\n' +
      'For each release provide:\n' +
      '- title: the film or show name only\n' +
      '- year: the film release year as a 4-digit integer, when the page states it\n' +
      '- format: exactly one of "DVD", "Blu-ray", "4K UHD"\n' +
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
      format: VIDEO_FORMATS.includes(entry.format) ? entry.format : '',
      upc: String(entry.upc || '').replace(/\D/g, ''),
      image: typeof entry.image === 'string' && /^https?:\/\//i.test(entry.image) ? entry.image : '',
    }))
    .filter((entry) => entry.title);
}

const NOISE = /funko|\bpop!?\b|action figure|figure|statue|poster|t-?shirt|apparel|soundtrack|vinyl|\bcd\b|\bbook\b|novel|comic|video game|board game|\bmug\b|\btoy\b/i;
const MEDIA = /dvd|blu-?ray|4k|uhd|movie|film|video/i;

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
        format: '',
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

    const upc = String(body?.upc || '').replace(/\D/g, '');
    if (upc.length < 8) {
      return Response.json({ error: 'Enter a valid barcode' }, { status: 400 });
    }

    let item = null;
    let upstream = 'none';
    try {
      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
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

    if (!item) {
      return Response.json({ found: false, upc, title: '', image: '', upstream });
    }

    const image = Array.isArray(item.images) && item.images.length ? item.images[0] : '';

    return Response.json({
      found: true,
      upc,
      title: cleanTitle(item.title),
      brand: item.brand || '',
      category: item.category || '',
      image,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}