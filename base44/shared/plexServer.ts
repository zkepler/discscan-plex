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

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.lan',
  '.intranet',
  '.localdomain',
];

// Ranges that must never be reachable from a backend request: loopback, LAN,
// link-local (cloud metadata), CGNAT, multicast and reserved space.
const BLOCKED_V4: [number, number][] = [
  [0x00000000, 0x00ffffff],
  [0x0a000000, 0x0affffff],
  [0x64400000, 0x647fffff],
  [0x7f000000, 0x7fffffff],
  [0xa9fe0000, 0xa9feffff],
  [0xac100000, 0xac1fffff],
  [0xc0000000, 0xc00000ff],
  [0xc0a80000, 0xc0a8ffff],
  [0xc6120000, 0xc613ffff],
  [0xe0000000, 0xefffffff],
  [0xf0000000, 0xffffffff],
];

function ipv4ToInt(host: string): number | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isPublicIpv4(host: string): boolean {
  const value = ipv4ToInt(host);
  if (value === null) return false;
  return !BLOCKED_V4.some(([low, high]) => value >= low && value <= high);
}

function isPublicIpv6(host: string): boolean {
  const ip = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!ip.includes(':')) return true;
  if (/^[0:]+$/.test(ip)) return false; // :: and fully expanded zero addresses
  if (/^[0:]+1$/.test(ip)) return false; // ::1 in any form
  const mappedV4 = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedV4) return isPublicIpv4(mappedV4[1]);
  if (/^f[cd]/.test(ip)) return false; // unique local
  if (/^fe[89ab]/.test(ip)) return false; // link local
  if (/^ff/.test(ip)) return false; // multicast
  return true;
}

function isBlockedHost(hostname: string): boolean {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (/^\d+$/.test(host)) return true; // bare integer is an alternative loopback notation
  if (ipv4ToInt(host) !== null) return !isPublicIpv4(host);
  if (host.includes(':')) return !isPublicIpv6(host);
  if (!host.includes('.')) return true; // single-label names only resolve internally
  return false;
}

async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  // IP literals were already classified above; only real names need a lookup.
  if (ipv4ToInt(host) !== null || host.includes(':')) return true;

  const resolveDns = (globalThis as any).Deno?.resolveDns;
  if (typeof resolveDns !== 'function') return true;

  const addresses: string[] = [];
  for (const type of ['A', 'AAAA']) {
    try {
      const found = await resolveDns.call((globalThis as any).Deno, host, type);
      if (Array.isArray(found)) addresses.push(...found.map((entry: any) => String(entry)));
    } catch (error: any) {
      const name = String(error?.name || '');
      if (name === 'NotFound' || String(error?.code || '') === 'NotFound') continue;
      if (/perm|notcapable/i.test(name)) return true; // resolver unavailable: host checks still apply
      return false;
    }
  }
  // Nothing resolvable means the request itself could not connect; the literal-host
  // checks above already covered the direct-IP forms.
  if (!addresses.length) return true;
  return addresses.every((address) =>
    address.includes(':') ? isPublicIpv6(address) : isPublicIpv4(address)
  );
}

// Every outbound Plex request goes through this: only public http(s) hosts.
export async function assertFetchableUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw plexError('That Plex address is not a valid URL.', 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw plexError('Only http and https Plex addresses are supported.', 400);
  }
  if (parsed.username || parsed.password) {
    throw plexError('That Plex address is not allowed.', 400);
  }
  if (isBlockedHost(parsed.hostname) || !(await resolvesToPublicHost(parsed.hostname))) {
    throw plexError(
      'That Plex address points to a private or internal network, which is not supported.',
      400
    );
  }
  return parsed;
}

// Redirects are followed by hand so each hop is validated, never straight to an internal host.
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  hops = 0
): Promise<Response> {
  await assertFetchableUrl(url);
  const res = await fetch(url, { ...init, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400 && hops < 2) {
    const location = res.headers.get('location');
    if (!location) return res;
    const next = new URL(location, url).toString();
    try {
      await res.body?.cancel();
    } catch {
      // body already consumed/closed
    }
    return safeFetch(next, init, hops + 1);
  }
  return res;
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
    const res = await safeFetch(`${baseUrl}/identity?X-Plex-Token=${encodeURIComponent(token)}`, {
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
  const res = await safeFetch(
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
    // The key is interpolated into the next request path, so only plain integers pass.
    .filter((dir: any) => /^\d+$/.test(String(dir.key ?? '')))
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
        view_count: Number(item.viewCount || 0),
      });
    });
  }

  return { sections, movies: [...byKey.values()] };
}