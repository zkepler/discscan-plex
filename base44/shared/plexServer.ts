export type PlexConnection = {
  uri: string;
  protocol: string;
  local: boolean;
  relay: boolean;
};

export type PlexServer = {
  name: string;
  machineId: string;
  owned: boolean;
  connections: PlexConnection[];
};

const RESOURCES_URL =
  'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1' +
  '&X-Plex-Client-Identifier=shelfmark-web&X-Plex-Product=Shelfmark';

function plexError(message: string, status: number) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

export function normalizeBaseUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

function protocolOf(connection: any): string {
  return (
    String(connection?.protocol || '').toLowerCase() ||
    (String(connection?.uri || '').startsWith('https') ? 'https' : 'http')
  );
}

// Ranked for a cloud caller: public https first, then Plex Relay, then anything else.
function remoteScore(connection: any): number {
  const protocol = protocolOf(connection);
  if (protocol === 'https' && !connection.local && !connection.relay) return 0;
  if (connection.relay) return 1;
  if (protocol === 'https' && !connection.local) return 2;
  if (protocol === 'https') return 3;
  if (!connection.local) return 4;
  return 5;
}

export async function listPlexServers(token: string): Promise<PlexServer[]> {
  const res = await fetch(RESOURCES_URL, {
    headers: { Accept: 'application/json', 'X-Plex-Token': token },
    signal: AbortSignal.timeout(12000),
  });

  if (res.status === 401) {
    throw plexError('Plex rejected that token. Check the value and try again.', 400);
  }
  if (!res.ok) {
    throw plexError(`Plex.tv responded with ${res.status}. Try again in a moment.`, 502);
  }

  const data = await res.json().catch(() => []);
  return (Array.isArray(data) ? data : [])
    .filter((resource: any) => String(resource?.provides || '').includes('server'))
    .map((resource: any) => ({
      name: resource.name || 'Plex server',
      machineId: resource.clientIdentifier || '',
      owned: Boolean(resource.owned),
      connections: (Array.isArray(resource.connections) ? resource.connections : [])
        .filter((connection: any) => connection?.uri)
        .map((connection: any) => ({
          uri: String(connection.uri),
          protocol: protocolOf(connection),
          local: Boolean(connection.local),
          relay: Boolean(connection.relay),
        })),
    }))
    .sort((a: PlexServer, b: PlexServer) => Number(b.owned) - Number(a.owned));
}

export function candidateUrls(servers: PlexServer[], requested?: string): string[] {
  const list: string[] = [];
  const add = (value: string) => {
    const normalized = normalizeBaseUrl(value);
    if (normalized && !list.includes(normalized)) list.push(normalized);
  };

  if (requested) add(requested);
  for (const server of servers) {
    const ordered = [...server.connections].sort((a, b) => remoteScore(a) - remoteScore(b));
    ordered.forEach((connection) => add(connection.uri));
  }
  return list.slice(0, 8);
}

async function reachable(baseUrl: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/identity?X-Plex-Token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (error) {
    return false;
  }
}

export async function resolveReachable(servers: PlexServer[], token: string, requested?: string) {
  if (requested) {
    const base = normalizeBaseUrl(requested);
    if (base && (await reachable(base, token))) return base;
  }
  for (const base of candidateUrls(servers, '')) {
    if (await reachable(base, token)) return base;
  }
  return null;
}

async function plexJson(baseUrl: string, token: string, path: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}${path}${sep}X-Plex-Token=${encodeURIComponent(token)}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) }
  );

  if (res.status === 401) throw plexError('Plex rejected that token. Check the token value.', 400);
  if (!res.ok) throw plexError(`Plex responded with ${res.status}.`, 502);
  return res.json();
}

const FOUR_K = /^(4k|uhd|2160p?)$/i;

function kindFor(baseKind: string, resolution: string | null): string {
  if (baseKind !== 'movie') return baseKind;
  return FOUR_K.test(String(resolution || '')) ? '4k' : 'movie';
}

function is4kTitle(title: string): boolean {
  return /(^|\W)(4k|uhd|2160p?)(\W|$)/i.test(String(title || ''));
}

function progressFor(kind: string, item: any): number {
  if (kind === 'show') {
    const total = Number(item.leafCount || 0);
    const seen = Number(item.viewedLeafCount || 0);
    if (!total) return 0;
    return Math.min(100, Math.round((seen / total) * 100));
  }
  const duration = Number(item.duration || 0);
  const offset = Number(item.viewOffset || 0);
  if (!duration || !offset) return 0;
  return Math.min(100, Math.round((offset / duration) * 100));
}

function wantsSection(kind: string, wanted: Set<string> | null): boolean {
  if (!wanted) return true;
  if (kind === 'show') return wanted.has('show');
  return wanted.has('movie') || wanted.has('4k');
}

export async function fetchPlexMovies(baseUrl: string, token: string, kinds?: string[]) {
  const wanted = Array.isArray(kinds) && kinds.length ? new Set(kinds) : null;
  const sectionsData = await plexJson(baseUrl, token, '/library/sections');
  const dirs = sectionsData?.MediaContainer?.Directory || [];
  const allSections = dirs
    .filter((dir: any) => dir.type === 'movie' || dir.type === 'show')
    .map((dir: any) => ({
      key: String(dir.key),
      title: dir.title || (dir.type === 'show' ? 'TV Shows' : 'Movies'),
      kind: dir.type === 'show' ? 'show' : is4kTitle(dir.title) ? '4k' : 'movie',
    }));
  const sections = allSections.filter((section: any) => wantsSection(section.kind, wanted));

  const byKey = new Map<string, any>();
  for (const section of sections) {
    const data = await plexJson(baseUrl, token, `/library/sections/${section.key}/all`);
    const items = data?.MediaContainer?.Metadata || [];
    items.forEach((item: any) => {
      if (!item?.ratingKey) return;
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
        progress_pct: progressFor(kind, item),
        last_viewed_at: item.lastViewedAt ? Number(item.lastViewedAt) * 1000 : null,
      });
    });
  }

  return { sections, movies: [...byKey.values()] };
}