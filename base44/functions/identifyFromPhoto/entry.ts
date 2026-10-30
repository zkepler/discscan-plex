import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'LaserDisc', 'Other'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUri = String(body?.file_uri || '').trim();
    if (!fileUri) return Response.json({ error: 'file_uri is required' }, { status: 400 });

    // The photo is stored privately, so the model reads it through a short-lived link.
    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 300,
    });

    const answer = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:
        'This photo shows a physical movie or TV release — a DVD, Blu-ray, 4K UHD case, or a VHS sleeve or tape label.\n' +
        'Read the cover and identify the single title being sold:\n' +
        '- found: true only when the title on the artwork is clearly legible, false otherwise\n' +
        '- title: the film or show name as printed, without format words (DVD, Blu-ray, 4K, UHD, VHS), without store or condition words, and without disc-count wording. Keep the edition name when it is part of the printed title, such as "The Final Cut" or "Collector\'s Edition"\n' +
        '- year: the release year of the film or show printed on the artwork as a 4-digit integer, when visible\n' +
        '- format: exactly one of "DVD", "Blu-ray", "4K UHD", "VHS", "LaserDisc", "Other", judged from the case shape, logos and sleeve style\n' +
        'Never guess: if the artwork is too blurry, cropped, or shows no title, answer found: false.',
      file_urls: [signed?.signed_url],
      model: 'gemini_3_8_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          title: { type: 'string' },
          year: { type: 'integer' },
          format: { type: 'string' },
        },
        required: ['found'],
      },
    });

    const title = String(answer?.title || '').replace(/\s+/g, ' ').trim();
    const year = Number(answer?.year);
    const format = FORMATS.includes(answer?.format) ? answer.format : '';

    if (!answer?.found || !title) return Response.json({ found: false });

    return Response.json({
      found: true,
      title,
      year: Number.isFinite(year) && year > 1800 ? year : null,
      format,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}