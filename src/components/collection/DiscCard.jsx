import { Link } from 'react-router-dom';
import { Check, Pencil } from 'lucide-react';
import { seasonNumber, showName } from '@/lib/groupDiscs';
import { formatBannerStyle, seasonListLabel, seasonsLabel } from '@/lib/mediaStyles';
import { watchState } from '@/lib/watchStatus';

export default function DiscCard({ discs = [], watch = {}, seasons = {}, onSelect, onAddFormat, onEditMeta }) {
  const primary = discs.find((disc) => disc.cover_url) || discs[0];
  if (!primary) return null;

  const viewed = watchState(discs, watch);

  const plexDisc = discs.find((disc) => disc.plex_rating_key);
  const seasonCount = seasons[plexDisc?.plex_rating_key] || null;
  const plexQuery = plexDisc?.plex_title || plexDisc?.title || primary.title || '';

  // Seasons of one show stack onto a single card, filed under the show's name.
  const seasonDisc = discs.find((disc) => seasonNumber(disc.title) !== null);
  const ownedSeasons = [
    ...new Set(discs.map((disc) => seasonNumber(disc.title)).filter((value) => value !== null)),
  ].sort((a, b) => a - b);
  const heading = seasonDisc ? showName(seasonDisc.title) : primary.title;
  const year = seasonDisc?.year || primary.year;

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

        <button
          type="button"
          onClick={() => onSelect(primary)}
          aria-label={`Open ${primary.title}`}
          className="absolute inset-0 z-0"
        />

        <div className="absolute left-0 top-9 z-10 flex flex-col items-start gap-1 py-1 pl-1.5">
          {formatEntries.map(({ format, disc }) => (
            <button
              key={disc.id}
              type="button"
              onClick={() => onSelect(disc)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-[0.1em] shadow-sm transition-opacity hover:opacity-90 ${formatBannerStyle(
                format
              )}`}
            >
              {format}
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-12">
          <button
            type="button"
            onClick={() => onSelect(primary)}
            className="pointer-events-auto block w-full text-left"
          >
            <p className="line-clamp-2 text-sm font-medium leading-tight text-white">{heading}</p>
            <p className="mt-1 text-xs text-white/60">
              {[
                year || null,
                ownedSeasons.length ? seasonListLabel(ownedSeasons) : seasonsLabel(seasonCount),
                primary.location || null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </button>
        </div>

        {viewed && !viewed.watched && viewed.progress ? (
          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/20">
            <div className="h-full bg-primary" style={{ width: `${viewed.progress}%` }} />
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 rounded-t-lg border-b border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
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

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onAddFormat?.(discs)}
          className="flex-1 rounded-md border border-dashed border-border px-2 py-1 text-center text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          + Format
        </button>
        <button
          type="button"
          onClick={() => onEditMeta?.(primary)}
          aria-label={`Edit details for ${primary.title}`}
          title="Edit details"
          className="rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}