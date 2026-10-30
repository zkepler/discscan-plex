import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { safeFetch } from '../../shared/plexServer.ts';

// Theme songs are short clips; anything far bigger than that is not a theme.
const MAX_BYTES = 3_000_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function cancelBody(res: Response) {
  try {
    await res.body?.cancel();
  } catch {
    // body already consumed or closed
  }
}

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
      `${baseUrl}/library/metadata/${ratingKey}/theme?X-Plex-Token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(90000) }
    );

    if (!res.ok) {
      await cancelBody(res);
      return Response.json({ found: false });
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) {
      await cancelBody(res);
      return Response.json({ found: false });
    }

    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) {
      return Response.json({ found: false });
    }

    return Response.json({
      found: true,
      type: res.headers.get('content-type') || 'audio/mpeg',
      audio: toBase64(new Uint8Array(buffer)),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}