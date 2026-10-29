import { Link } from 'react-router-dom';

const FORMAT_TONE = {
  DVD: 'text-foreground/85',
  'Blu-ray': 'text-sky-300',
  '4K UHD': 'text-primary',
  VHS: 'text-amber-300',
  LaserDisc: 'text-violet-300',
  Other: 'text-muted-foreground',
};

export default function DiscCard({ disc, onSelect }) {
  const plexQuery = disc.plex_title || disc.title || '';

  return (
    <div className="group relative">
      <button type="button" onClick={() => onSelect(disc)} className="block w-full text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted shadow-lg shadow-black/30">
          {disc.cover_url ? (
            <img
              src={disc.cover_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,hsl(var(--muted)),hsl(var(--card)))]">
              <span className="font-display text-5xl text-muted-foreground/50">
                {(disc.title || '?').charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 pt-10">
            <p className="line-clamp-2 text-sm font-medium leading-tight text-white">{disc.title}</p>
            <p className="mt-1 text-[11px] text-white/60">
              {[disc.year || null, disc.location || null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </button>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 rounded-t-lg border-b border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
            FORMAT_TONE[disc.format] || FORMAT_TONE.Other
          }`}
        >
          {disc.format || 'DVD'}
        </span>
        {disc.plex_rating_key ? (
          <Link
            to={`/plex?q=${encodeURIComponent(plexQuery)}`}
            title={`In Plex as ${plexQuery}`}
            className="text-[10px] uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-primary"
          >
            In Plex
          </Link>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">Not in Plex</span>
        )}
      </div>
    </div>
  );
}