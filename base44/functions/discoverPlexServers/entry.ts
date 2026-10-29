import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    if (!token || token.length > 200) {
      return Response.json({ error: 'A Plex token is required' }, { status: 400 });
    }

    const url =
      'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1' +
      '&X-Plex-Client-Identifier=shelfmark-web&X-Plex-Product=Shelfmark';

    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Plex-Token': token },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 401) {
      return Response.json({ error: 'Plex rejected that token. Check the value and try again.' }, { status: 400 });
    }
    if (!res.ok) {
      return Response.json({ error: `Plex.tv responded with ${res.status}. Try again in a moment.` }, { status: 502 });
    }

    const data = await res.json().catch(() => []);
    const servers = (Array.isArray(data) ? data : [])
      .filter((resource) => String(resource?.provides || '').includes('server'))
      .map((resource) => ({
        name: resource.name || 'Plex server',
        machineId: resource.clientIdentifier || '',
        owned: Boolean(resource.owned),
        connections: (Array.isArray(resource.connections) ? resource.connections : [])
          .filter((connection) => connection?.uri)
          .map((connection) => ({
            uri: String(connection.uri),
            protocol:
              String(connection.protocol || '').toLowerCase() ||
              (String(connection.uri).startsWith('https') ? 'https' : 'http'),
            local: Boolean(connection.local),
            relay: Boolean(connection.relay),
          })),
      }))
      .sort((a, b) => Number(b.owned) - Number(a.owned));

    return Response.json({ servers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}