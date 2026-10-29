import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') {
      return Response.json({ error: 'Deletion was not confirmed' }, { status: 400 });
    }

    await Promise.allSettled([
      base44.asServiceRole.entities.Disc.deleteMany({ created_by_id: user.id }),
      base44.asServiceRole.entities.PlexConfig.deleteMany({ created_by_id: user.id }),
    ]);

    try {
      await base44.asServiceRole.entities.User.delete(user.id);
    } catch (accountError) {
      return Response.json(
        {
          error:
            'Your collection was deleted, but the account record could not be removed. Please contact support to finish closing the account.',
        },
        { status: 500 }
      );
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}