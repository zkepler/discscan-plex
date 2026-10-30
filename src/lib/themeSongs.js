import { base44 } from '@/api/base44Client';
import { plexUrl } from '@/lib/plex';

// Theme clips are fetched once per title and kept as blob URLs while browsing.
const CACHE_LIMIT = 40;
const cache = new Map();

function prune() {
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    const pending = cache.get(oldest);
    cache.delete(oldest);
    Promise.resolve(pending)
      .then((url) => {
        if (url) URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }
}

function blobUrlFromBase64(data) {
  const bytes = Uint8Array.from(atob(data.audio), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: data.type || 'audio/mpeg' }));
}

async function fromServer(config, ratingKey) {
  try {
    const response = await base44.functions.invoke('plexTheme', {
      plex_url: config.plex_url,
      plex_token: config.plex_token,
      rating_key: ratingKey,
    });
    const data = response?.data || {};
    if (!data.found || !data.audio) return { found: false };
    return { found: true, url: blobUrlFromBase64(data) };
  } catch (error) {
    // The server could not reach this Plex; the device itself may still manage it.
    if (error?.response?.data?.error) return { found: false, unreachable: true };
    throw error;
  }
}

async function fromBrowser(config, ratingKey) {
  const res = await fetch(
    plexUrl(config.plex_url, config.plex_token, `/library/metadata/${encodeURIComponent(ratingKey)}/theme`)
  );
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

export function loadThemeSong(config, ratingKey) {
  const key = `${config?.plex_url}|${ratingKey}`;
  if (cache.has(key)) return cache.get(key);

  const pending = (async () => {
    const served = await fromServer(config, ratingKey);
    if (served.found) return served.url;
    if (!served.unreachable) return null;
    return fromBrowser(config, ratingKey).catch(() => null);
  })();

  cache.set(key, pending);
  prune();
  return pending;
}