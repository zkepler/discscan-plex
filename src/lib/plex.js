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

export async function listMovieSections(config) {
  const data = await getJson(plexUrl(config.plex_url, config.plex_token, '/library/sections'));
  const dirs = data?.MediaContainer?.Directory || [];
  return dirs.filter((d) => d.type === 'movie').map((d) => ({ key: String(d.key), title: d.title }));
}

export async function fetchLibraryMovies(config, onProgress) {
  const sections = await listMovieSections(config);
  if (!sections.length) throw new Error('No movie libraries found on this Plex server.');

  const byKey = new Map();
  for (const section of sections) {
    const data = await getJson(
      plexUrl(config.plex_url, config.plex_token, `/library/sections/${section.key}/all`)
    );
    const items = data?.MediaContainer?.Metadata || [];
    items.forEach((item) => {
      if (!item.ratingKey) return;
      byKey.set(String(item.ratingKey), {
        rating_key: String(item.ratingKey),
        title: item.title || 'Untitled',
        year: item.year ? Number(item.year) : null,
        thumb: item.thumb || null,
        library: section.title,
        resolution: item.Media?.[0]?.videoResolution || null,
        duration_ms: item.duration ? Number(item.duration) : null,
        added_at: item.addedAt ? Number(item.addedAt) : null,
      });
    });
    onProgress?.(byKey.size, section.title);
  }
  return [...byKey.values()];
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
    return response?.data?.servers || [];
  } catch (error) {
    throw new Error(
      error?.response?.data?.error || 'Could not look up the servers linked to that token.'
    );
  }
}

export async function findReachableServer(token) {
  const servers = await discoverServers(String(token || '').trim());
  if (!servers.length) throw new Error('No Plex servers are linked to that token.');

  for (const server of servers) {
    for (const connection of rankConnections(server.connections)) {
      const base = normalizeBaseUrl(connection.uri);
      try {
        await getJson(plexUrl(base, token, '/identity'));
        return { name: server.name, url: base, machineId: server.machineId };
      } catch (attempt) {
        // try the next address for this server
      }
    }
  }

  throw new Error(
    'Your server didn’t answer from this browser. Check that it’s running, then paste its address from Plex → Settings → Remote Access.'
  );
}