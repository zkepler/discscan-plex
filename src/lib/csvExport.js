import { groupDiscs } from '@/lib/groupDiscs';

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

const formatRank = (format) => {
  const index = FORMAT_ORDER.indexOf(format || 'DVD');
  return index === -1 ? FORMAT_ORDER.length : index;
};

// Every copy of a film shares one row, so all of its formats sit in a single cell.
function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function groupRow(discs) {
  const copies = [...discs].sort((a, b) => formatRank(a.format) - formatRank(b.format));
  const first = copies[0];
  const formats = unique(copies.map((disc) => disc.format || 'DVD'));
  const runtime = copies.find((disc) => disc.runtime_minutes)?.runtime_minutes;

  return {
    title: first.title || 'Untitled',
    year: copies.find((disc) => disc.year)?.year || '',
    formats,
    copies: String(copies.length),
    editions: unique(copies.map((disc) => disc.edition)),
    locations: unique(copies.map((disc) => disc.location)),
    meta: copies.find((disc) => disc.studio) || first,
    directors: unique(copies.flatMap((disc) => disc.directors || [])),
    genres: unique(copies.flatMap((disc) => disc.genres || [])),
    runtime: runtime || '',
    rating: copies.find((disc) => disc.rating)?.rating || '',
    inPlex: copies.some((disc) => disc.plex_rating_key) ? 'Yes' : 'No',
    upcs: unique(copies.map((disc) => disc.upc)),
  };
}

export function buildCollectionCsv({ discs = [] }) {
  const rows = groupDiscs(discs)
    .map((group) => groupRow(group.discs))
    .sort((a, b) => formatRank(a.formats[0]) - formatRank(b.formats[0]) || byTitle(a, b));

  return toCsv(
    [
      'Title',
      'Year',
      'Formats',
      'Copies',
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
    rows.map((row) => [
      row.title,
      row.year,
      listOf(row.formats),
      row.copies,
      listOf(row.editions),
      listOf(row.locations),
      row.meta.studio || '',
      listOf(row.directors),
      listOf(row.genres),
      row.runtime,
      row.rating,
      row.inPlex,
      listOf(row.upcs),
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