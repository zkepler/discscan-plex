const FORMAT_ORDER = ['4K UHD', 'Blu-ray', 'DVD', 'VHS', 'LaserDisc', 'Other'];

function formatOf(disc) {
  return FORMAT_ORDER.includes(disc.format) ? disc.format : 'Other';
}

function detail(disc) {
  const bits = [
    disc.year ? String(disc.year) : null,
    disc.format || null,
    disc.location ? `shelf ${disc.location}` : null,
  ].filter(Boolean);
  return bits.length ? ` (${bits.join(' · ')})` : '';
}

export function buildShareEmail({ discs = [], inPlex = 0, includeList = true, note = '' }) {
  const sorted = [...discs].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  const groups = FORMAT_ORDER.map((format) => ({
    format,
    items: sorted.filter((disc) => formatOf(disc) === format),
  })).filter((group) => group.items.length);

  const breakdown = groups.map((group) => `${group.items.length} ${group.format}`).join(', ');
  const discOnly = sorted.length - inPlex;
  const lines = [];

  if (note.trim()) lines.push(note.trim(), '');

  lines.push(
    `My disc collection: ${sorted.length} ${sorted.length === 1 ? 'title' : 'titles'}${breakdown ? ` — ${breakdown}` : ''}.`,
    `${inPlex} ${inPlex === 1 ? 'is' : 'are'} in my Plex library, ${discOnly} ${discOnly === 1 ? 'is' : 'are'} on the shelf only.`
  );

  if (includeList) {
    groups.forEach((group) => {
      lines.push('', `${group.format} (${group.items.length})`);
      group.items.forEach((disc) => lines.push(`- ${disc.title || 'Untitled'}${detail(disc)}`));
    });
  }

  lines.push('', 'Shared from Shelfmark');

  return {
    subject: `My disc collection — ${sorted.length} titles`,
    body: lines.join('\n'),
  };
}

const KIND_LABELS = { movie: 'Movie', '4k': '4K', show: 'TV show' };

export function buildRecentPlexEmail({ items = [], note = '' }) {
  const lines = [];

  if (note.trim()) lines.push(note.trim(), '');

  lines.push(`Recently added to my Plex library: ${items.length} ${items.length === 1 ? 'title' : 'titles'}.`);

  items.forEach((item) => {
    const bits = [item.year ? String(item.year) : null, KIND_LABELS[item.kind]].filter(Boolean);
    const when = item.added_at
      ? new Date(item.added_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;
    lines.push(
      `- ${item.title || 'Untitled'}${bits.length ? ` (${bits.join(' · ')})` : ''}${when ? ` — added ${when}` : ''}`
    );
  });

  lines.push('', 'Shared from Shelfmark');

  return {
    subject: `Recently added to my Plex — ${items.length} ${items.length === 1 ? 'title' : 'titles'}`,
    body: lines.join('\n'),
  };
}

export function mailtoLink({ to = '', subject = '', body = '' }) {
  const recipient = String(to).trim();
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}