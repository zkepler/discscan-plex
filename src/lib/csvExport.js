const FORMAT_ORDER = ['4K UHD', 'Blu-ray', 'DVD', 'VHS', 'LaserDisc', 'Other'];
const KIND_LABELS = { movie: 'Movie', '4k': '4K', show: 'TV show' };

function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

function listOf(value) {
  return Array.isArray(value) ? value.join('; ') : '';
}

function byTitle(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''));
}

export function buildCollectionCsv({ discs = [] }) {
  const sorted = [...discs].sort((a, b) => {
    const order = FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format);
    return order || byTitle(a, b);
  });

  return toCsv(
    [
      'Title',
      'Year',
      'Format',
      'Edition',
      'Location',
      'Studio',
      'Directors',
      'Genres',
      'Runtime (min)',
      'Rating',
      'In Plex',
      'UPC',
    ],
    sorted.map((disc) => [
      disc.title || 'Untitled',
      disc.year || '',
      disc.format || '',
      disc.edition || '',
      disc.location || '',
      disc.studio || '',
      listOf(disc.directors),
      listOf(disc.genres),
      disc.runtime_minutes || '',
      disc.rating || '',
      disc.plex_rating_key ? 'Yes' : 'No',
      disc.upc || '',
    ])
  );
}

export function buildRecentCsv({ items = [] }) {
  return toCsv(
    ['Title', 'Year', 'Type', 'Library', 'Resolution', 'Added'],
    items.map((item) => [
      item.title || 'Untitled',
      item.year || '',
      KIND_LABELS[item.kind] || '',
      item.library || '',
      item.resolution || '',
      item.added_at ? new Date(item.added_at * 1000).toISOString().slice(0, 10) : '',
    ])
  );
}

export function downloadCsv(filename, csv) {
  // A byte-order mark keeps accented titles readable when opened in Excel.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}