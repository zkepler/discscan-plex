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

export const formatStyle = (format) => FORMAT_STYLES[format] || FORMAT_STYLES.Other;

export const kindStyle = (kind) => KIND_STYLES[kind] || KIND_STYLES.movie;