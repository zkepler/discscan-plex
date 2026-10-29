import { base44 } from '@/api/base44Client';

export function normalizeBaseUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const securePage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `${securePage ? 'https' : 'http'}://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

export function plexUrl(baseUrl, token, path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${normalizeBaseUrl(baseUrl)}${path}${sep}X-Plex-Token=${encodeURIComponent(token || '')}`;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Plex rejected that token. Check the token value.');
    throw new Error(`Plex responded with ${res.status}.`);
  }
  return res.json();
}

const FOUR_K = /^(4k|uhd|2160p?)$/i;

export function kindFor(baseKind, resolution) {
  if (baseKind !== 'movie') return baseKind;
  return FOUR_K.test(String(resolution || '')) ? '4k' : 'movie';
}

function is4kTitle(title) {
  return /(^|\W)(4k|uhd|2160p?)(\W|$)/i.test(String(title || ''));
}

export async function listMovieSections(config) {
  const data = await getJson(plexUrl(config.plex_url, config.plex_token, '/library/sections'));
  const dirs = data?.MediaContainer?.Directory || [];
  return dirs
    .filter((d) => d.type === 'movie' || d.type === 'show')
    .map((d) => ({
      key: String(d.key),
      title: d.title,
      kind: d.type === 'show' ? 'show' : is4kTitle(d.title) ? '4k' : 'movie',
    }));
}

function emptyMessage(kinds) {
  return kinds?.length
    ? 'Nothing found in that category on your Plex server.'
    : 'No movie or TV libraries found on this Plex server.';
}

function wantsSection(kind, wanted) {
  if (!wanted) return true;
  if (kind === 'show') return wanted.has('show');
  return wanted.has('movie') || wanted.has('4k');
}

// Used when the server can only be reached from this device (home network, Remote Access off).
export async function fetchLibraryMoviesInBrowser(config, onProgress, kinds) {
  const wanted = kinds?.length ? new Set(kinds) : null;
  const sections = (await listMovieSections(config)).filter((section) =>
    wantsSection(section.kind, wanted)
  );
  if (!sections.length) throw new Error(emptyMessage(kinds));

  const byKey = new Map();
  for (const section of sections) {
    const data = await getJson(
      plexUrl(config.plex_url, config.plex_token, `/library/sections/${section.key}/all`)
    );
    const items = data?.MediaContainer?.Metadata || [];
    items.forEach((item) => {
      if (!item.ratingKey) return;
      const resolution = item.Media?.[0]?.videoResolution || null;
      const kind = kindFor(section.kind, resolution);
      if (wanted && !wanted.has(kind)) return;
      byKey.set(String(item.ratingKey), {
        rating_key: String(item.ratingKey),
        title: item.title || 'Untitled',
        kind,
        year: item.year ? Number(item.year) : null,
        thumb: item.thumb || null,
        library: section.title,
        resolution,
        duration_ms: item.duration ? Number(item.duration) : null,
        added_at: item.addedAt ? Number(item.addedAt) : null,
        progress_pct: kind === 'show'
          ? (item.leafCount ? Math.min(100, Math.round((Number(item.viewedLeafCount || 0) / Number(item.leafCount)) * 100)) : 0)
          : (item.duration && item.viewOffset
              ? Math.min(100, Math.round((Number(item.viewOffset) / Number(item.duration)) * 100))
              : 0),
        last_viewed_at: item.lastViewedAt ? Number(item.lastViewedAt) * 1000 : null,
      });
    });
    onProgress?.(byKey.size, section.title);
  }
  return [...byKey.values()];
}

export async function fetchLibraryMovies(config, onProgress, kinds) {
  try {
    const response = await base44.functions.invoke('fetchPlexLibrary', {
      plex_url: config.plex_url,
      plex_token: config.plex_token,
      ...(kinds?.length ? { kinds } : {}),
    });
    const data = response?.data || {};
    const movies = Array.isArray(data.movies) ? data.movies : [];
    if (!movies.length) throw new Error(emptyMessage(kinds));
    onProgress?.(movies.length, 'Plex library');
    return { movies, url: data.url || normalizeBaseUrl(config.plex_url) };
  } catch (error) {
    const payload = error?.response?.data;
    if (payload?.code !== 'unreachable') {
      throw new Error(payload?.error || error.message || 'Could not read your Plex library.');
    }
    const movies = await fetchLibraryMoviesInBrowser(config, onProgress, kinds);
    return { movies, url: normalizeBaseUrl(config.plex_url) };
  }
}

export function posterUrl(config, thumb, width = 300) {
  if (!thumb) return '';
  const height = Math.round(width * 1.5);
  const path = `/photo/:/transcode?width=${width}&height=${height}&minSize=1&upscale=1&url=${encodeURIComponent(thumb)}`;
  return plexUrl(config.plex_url, config.plex_token, path);
}

function rankConnections(connections = []) {
  const securePage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return connections
    .map((connection) => {
      const protocol =
        String(connection.protocol || '').toLowerCase() ||
        (String(connection.uri).startsWith('https') ? 'https' : 'http');
      let score = 5;
      if (connection.local && protocol === 'https') score = 0;
      else if (protocol === 'https' && !connection.relay) score = 1;
      else if (connection.local) score = 2;
      else if (protocol === 'https') score = 3;
      return { ...connection, protocol, score };
    })
    .filter((connection) => !(securePage && connection.protocol !== 'https'))
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);
}

async function discoverServers(token) {
  try {
    const response = await base44.functions.invoke('discoverPlexServers', { token });
    return response?.data || {};
  } catch (error) {
    throw new Error(
      error?.response?.data?.error || 'Could not look up the servers linked to that token.'
    );
  }
}

export async function findReachableServer(token) {
  const trimmed = String(token || '').trim();
  const data = await discoverServers(trimmed);
  const servers = data?.servers || [];
  if (!servers.length) throw new Error('No Plex servers are linked to that token.');

  if (data.resolvedUrl) {
    const owner = servers.find((server) =>
      (server.connections || []).some((connection) => normalizeBaseUrl(connection.uri) === data.resolvedUrl)
    );
    return { name: data.resolvedName || owner?.name || servers[0].name, url: data.resolvedUrl };
  }

  // Nothing answered from the internet — try the addresses this device can reach itself.
  for (const server of servers) {
    for (const connection of rankConnections(server.connections)) {
      const base = normalizeBaseUrl(connection.uri);
      try {
        await getJson(plexUrl(base, trimmed, '/identity'));
        return { name: server.name, url: base, machineId: server.machineId };
      } catch (attempt) {
        // try the next address for this server
      }
    }
  }

  throw new Error(
    'Your server didn’t answer. Turn on Remote Access in Plex → Settings so Shelfmark can reach it from anywhere, then try again.'
  );
}