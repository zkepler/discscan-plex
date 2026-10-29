import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

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

      let items: any[] = [];
      try {
        const res = await fetch(
          `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}&type=product`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }
        );
        const data = await res.json().catch(() => ({}));
        items = Array.isArray(data?.items) ? data.items : [];
      } catch (searchError) {
        items = [];
      }

      const mapped = items
        .map((entry) => {
          const raw = String(entry.title || '');
          const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
          return {
            title: cleanTitle(raw),
            upc: String(entry.upc || entry.ean || '').replace(/\D/g, ''),
            image: Array.isArray(entry.images) && entry.images.length ? entry.images[0] : '',
            year: yearMatch ? Number(yearMatch[0]) : null,
            media: /dvd|blu-?ray|4k|uhd|movie|video/i.test(`${raw} ${entry.category || ''}`),
          };
        })
        .filter((entry) => entry.title);

      const ranked = [...mapped.filter((entry) => entry.media), ...mapped.filter((entry) => !entry.media)];
      const results = ranked.slice(0, 8).map(({ media, ...rest }) => rest);

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