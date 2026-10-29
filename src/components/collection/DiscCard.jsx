import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { formatBannerStyle } from '@/lib/mediaStyles';
import { watchState } from '@/lib/watchStatus';

export default function DiscCard({ discs = [], watch = {}, onSelect, onAddFormat }) {
  const primary = discs.find((disc) => disc.cover_url) || discs[0];
  if (!primary) return null;

  const viewed = watchState(discs, watch);

  const plexDisc = discs.find((disc) => disc.plex_rating_key);
  const plexQuery = plexDisc?.plex_title || plexDisc?.title || primary.title || '';

  // One bold tag per format this movie is owned in.
  const formatEntries = [];
  discs.forEach((disc) => {
    const format = disc.format || 'DVD';
    if (!formatEntries.some((entry) => entry.format === format)) {
      formatEntries.push({ format, disc });
    }
  });

  return (
    <div className="group relative select-none">
      <button type="button" onClick={() => onSelect(primary)} className="block w-full text-left">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted shadow-lg shadow-black/30">
          {primary.cover_url ? (
            <img
              src={primary.cover_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,hsl(var(--muted)),hsl(var(--card)))]">
              <span className="font-display text-5xl text-muted-foreground/50">
                {(primary.title || '?').charAt(0)}
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 pt-10">
            <p className="line-clamp-2 text-sm font-medium leading-tight text-white">{primary.title}</p>
            <p className="mt-1 text-xs text-white/60">
              {[primary.year || null, primary.location || null].filter(Boolean).join(' · ')}
            </p>
          </div>

          {viewed && !viewed.watched && viewed.progress ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div className="h-full bg-primary" style={{ width: `${viewed.progress}%` }} />
            </div>
          ) : null}
        </div>
      </button>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 rounded-t-lg border-b border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
        <span className="flex items-center gap-1 text-xs uppercase tracking-[0.12em]">
          {viewed?.watched ? (
            <span className="flex items-center gap-1 font-semibold text-primary">
              <Check className="h-3 w-3" />
              Watched
            </span>
          ) : viewed?.progress ? (
            <span className="text-white/70">{viewed.progress}%</span>
          ) : null}
        </span>
        {plexDisc ? (
          <Link
            to={`/plex?q=${encodeURIComponent(plexQuery)}`}
            title={`In Plex as ${plexQuery}`}
            className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-400 transition-colors hover:text-orange-300"
          >
            In Plex
          </Link>
        ) : (
          <span className="text-xs uppercase tracking-[0.12em] text-white/30">Not in Plex</span>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {formatEntries.map(({ format, disc }) => (
          <button
            key={disc.id}
            type="button"
            onClick={() => onSelect(disc)}
            className={`block w-full rounded-md px-2 py-1 text-center text-xs font-bold uppercase tracking-[0.14em] shadow-sm transition-opacity hover:opacity-90 ${formatBannerStyle(
              format
            )}`}
          >
            {format}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onAddFormat?.(discs)}
          className="block w-full rounded-md border border-dashed border-border px-2 py-1 text-center text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          + Format
        </button>
      </div>
    </div>
  );
}