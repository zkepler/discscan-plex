// Colour coding for physical formats and Plex media types.
const FORMAT_STYLES = {
  DVD: 'border-slate-300/40 bg-slate-300/15 text-slate-100',
  'Blu-ray': 'border-sky-400/40 bg-sky-400/15 text-sky-300',
  '4K UHD': 'border-primary/50 bg-primary/15 text-primary',
  VHS: 'border-amber-400/40 bg-amber-400/15 text-amber-300',
  LaserDisc: 'border-violet-400/40 bg-violet-400/15 text-violet-300',
  Other: 'border-white/25 bg-white/10 text-white/70',
};

const KIND_STYLES = {
  movie: { label: 'Movie', className: 'border-sky-400/40 bg-sky-400/10 text-sky-500' },
  '4k': { label: '4K', className: 'border-primary/50 bg-primary/10 text-primary' },
  show: { label: 'TV show', className: 'border-violet-400/40 bg-violet-400/10 text-violet-500' },
};

// Full-width banners shown under a shelf card: one per format the movie is owned in.
const FORMAT_BANNER_STYLES = {
  DVD: 'bg-slate-600 text-white',
  'Blu-ray': 'bg-sky-600 text-white',
  '4K UHD': 'bg-primary text-primary-foreground',
  VHS: 'bg-amber-600 text-white',
  LaserDisc: 'bg-violet-600 text-white',
  Other: 'bg-muted text-muted-foreground',
};

export const formatStyle = (format) => FORMAT_STYLES[format] || FORMAT_STYLES.Other;

export const formatBannerStyle = (format) =>
  FORMAT_BANNER_STYLES[format] || FORMAT_BANNER_STYLES.Other;

export const kindStyle = (kind) => KIND_STYLES[kind] || KIND_STYLES.movie;

// "5 seasons" for a show, or null when Plex reported no seasons.
export const seasonsLabel = (count) => {
  const seasons = Number(count || 0);
  if (!seasons) return null;
  return `${seasons} season${seasons === 1 ? '' : 's'}`;
};

// Which seasons of a show sit on the shelf: "Season 2", "Seasons 1–3", "Seasons 1, 4".
export const seasonListLabel = (numbers = []) => {
  if (!numbers.length) return null;
  const runs = numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);
  const list =
    runs && numbers.length > 2 ? `${numbers[0]}–${numbers[numbers.length - 1]}` : numbers.join(', ');
  return `${numbers.length === 1 ? 'Season' : 'Seasons'} ${list}`;
};