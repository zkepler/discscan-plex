import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { safeFetch } from '../../shared/plexServer.ts';
import { metadataFromPlex } from '../../shared/plexMetadata.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body?.plex_token || '').trim();
    const ratingKey = String(body?.rating_key || '').trim();
    const requested = String(body?.plex_url || '').trim();

    if (!token || token.length > 200) {
      return Response.json({ error: 'A Plex token is required' }, { status: 400 });
    }
    // The key is interpolated into the request path, so only plain digits pass.
    if (!/^\d{1,20}$/.test(ratingKey)) {
      return Response.json({ error: 'A valid Plex item key is required' }, { status: 400 });
    }
    if (!requested) {
      return Response.json({ error: 'A Plex server address is required' }, { status: 400 });
    }

    const baseUrl = requested.replace(/\/+$/, '');
    const res = await safeFetch(
      `${baseUrl}/library/metadata/${ratingKey}?X-Plex-Token=${encodeURIComponent(token)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000) }
    );

    if (res.status === 401) {
      return Response.json({ error: 'Plex rejected that token. Check the value in Settings.' }, { status: 400 });
    }
    if (!res.ok) {
      return Response.json({ error: `Plex responded with ${res.status}.` }, { status: 502 });
    }

    const data = await res.json().catch(() => null);
    const item = data?.MediaContainer?.Metadata?.[0];
    if (!item) return Response.json({ found: false });

    return Response.json({ found: true, metadata: metadataFromPlex(item) });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}