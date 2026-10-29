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

// Chips that sit on the page surface (under a shelf card) instead of on a dark poster.
const FORMAT_CHIP_STYLES = {
  DVD: 'border-slate-400/60 bg-slate-500/10 text-slate-600 dark:text-slate-200',
  'Blu-ray': 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  '4K UHD': 'border-primary/60 bg-primary/10 text-primary',
  VHS: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  LaserDisc: 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300',
  Other: 'border-border bg-muted text-muted-foreground',
};

export const formatStyle = (format) => FORMAT_STYLES[format] || FORMAT_STYLES.Other;

export const formatChipStyle = (format) => FORMAT_CHIP_STYLES[format] || FORMAT_CHIP_STYLES.Other;

export const kindStyle = (kind) => KIND_STYLES[kind] || KIND_STYLES.movie;