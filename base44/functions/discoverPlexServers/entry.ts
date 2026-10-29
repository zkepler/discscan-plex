import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { listPlexServers, resolveReachable } from '../../shared/plexServer.ts';

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

    const servers = await listPlexServers(token);
    const resolvedUrl = servers.length ? await resolveReachable(servers, token) : null;
    const owner = resolvedUrl
      ? servers.find((server) => server.connections.some((c) => c.uri.replace(/\/+$/, '') === resolvedUrl))
      : null;

    return Response.json({
      servers,
      resolvedUrl: resolvedUrl || '',
      resolvedName: owner?.name || '',
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}