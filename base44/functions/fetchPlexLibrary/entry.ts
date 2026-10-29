import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  fetchPlexMovies,
  listPlexServers,
  resolveReachable,
} from '../../shared/plexServer.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.plex_token || '').trim();
    if (!token || token.length > 200) {
      return Response.json({ error: 'A Plex token is required' }, { status: 400 });
    }
    const requested = String(body?.plex_url || '').trim();
    const kinds = Array.isArray(body?.kinds)
      ? body.kinds
          .map((kind: any) => String(kind))
          .filter((kind: string) => ['movie', '4k', 'show'].includes(kind))
          .slice(0, 3)
      : [];

    let baseUrl = '';
    if (requested) {
      const servers = await listPlexServers(token).catch(() => []);
      baseUrl = (await resolveReachable(servers, token, requested)) || '';
    } else {
      const servers = await listPlexServers(token);
      baseUrl = (await resolveReachable(servers, token)) || '';
    }

    if (!baseUrl) {
      return Response.json(
        {
          code: 'unreachable',
          error:
            'This server is not reachable from the internet. Turn on Remote Access in Plex → Settings, then sync again.',
        },
        { status: 502 }
      );
    }

    const { sections, movies } = await fetchPlexMovies(baseUrl, token, kinds.length ? kinds : undefined);
    return Response.json({ url: baseUrl, sections, movies });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}