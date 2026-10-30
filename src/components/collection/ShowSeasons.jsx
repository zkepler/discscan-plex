import { Check, PlayCircle } from 'lucide-react';
import { seasonNumber } from '@/lib/groupDiscs';
import { formatStyle } from '@/lib/mediaStyles';

// Every season the show has, with the ones on the shelf and the ones only Plex holds.
export default function ShowSeasons({
  title,
  seasonCount = 0,
  seasonNumbers = null,
  discs = [],
  onSelect,
  onPlex,
}) {
  const copiesBySeason = new Map();
  const unnumbered = [];

  discs.forEach((disc) => {
    const season = seasonNumber(disc.title);
    if (season === null) {
      unnumbered.push(disc);
      return;
    }
    copiesBySeason.set(season, [...(copiesBySeason.get(season) || []), disc]);
  });

  const ownedSeasons = [...copiesBySeason.keys()];
  // The exact seasons Plex holds, when the last sync recorded them, so a season
  // Plex is missing is never marked as being there.
  const plexSeasons = Array.isArray(seasonNumbers) && seasonNumbers.length ? seasonNumbers : null;
  const total = Math.max(Number(seasonCount) || 0, ...ownedSeasons, ...(plexSeasons || [0]));
  const seasons = Array.from({ length: total }, (_, index) => index + 1);
  const onServer = (season) =>
    plexSeasons ? plexSeasons.includes(season) : season <= Number(seasonCount || 0);

  // A shelf copy whose title names no season stands for the whole show, so when
  // that show is also on Plex the seasons Plex holds count as owned.
  const showWide =
    copiesBySeason.size === 0 && unnumbered.length > 0 && (plexSeasons !== null || Number(seasonCount) > 0);
  const ownedCount = seasons.filter(
    (season) => copiesBySeason.has(season) || (showWide && onServer(season))
  ).length;

  const row = (season, copies) => {
    const inPlex = onServer(season);
    const shelfCopies = copies.length ? copies : showWide && inPlex ? unnumbered : [];
    const owned = shelfCopies.length > 0;

    if (!owned && !inPlex) {
      return (
        <div
          key={`season-${season}`}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 px-3 py-2.5 opacity-60"
        >
          <span className="block text-sm font-medium text-foreground">Season {season}</span>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Not owned
          </span>
        </div>
      );
    }

    return (
      <button
        key={`season-${season}`}
        type="button"
        onClick={() => (owned ? onSelect(shelfCopies[0]) : onPlex?.(title))}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Season {season}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {owned ? (
              shelfCopies.map((disc) => (
                <span
                  key={disc.id}
                  className={`rounded border px-1.5 py-0.5 text-xs uppercase tracking-[0.08em] ${formatStyle(
                    disc.format || 'DVD'
                  )}`}
                >
                  {disc.format || 'DVD'}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">On your Plex server</span>
            )}
          </span>
        </span>
        {owned ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            <Check className="h-3.5 w-3.5" />
            Owned
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-orange-400">
            <PlayCircle className="h-3.5 w-3.5" />
            In Plex
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="border-t border-border/70 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg leading-none text-foreground">Seasons</h3>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {ownedCount} of {total || '?'} owned
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {seasons.length ? (
          seasons.map((season) => row(season, copiesBySeason.get(season) || []))
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No seasons known for this show yet. Sync Plex to pull the season list in.
          </p>
        )}
      </div>

      {unnumbered.length && !showWide ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Also on your shelf</p>
          {unnumbered.map((disc) => (
            <button
              key={disc.id}
              type="button"
              onClick={() => onSelect(disc)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary"
            >
              <span className="truncate text-sm text-foreground">{disc.title}</span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-xs uppercase tracking-[0.08em] ${formatStyle(
                  disc.format || 'DVD'
                )}`}
              >
                {disc.format || 'DVD'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}