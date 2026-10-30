import { posterUrl } from '@/lib/plex';
import { kindStyle, seasonsLabel } from '@/lib/mediaStyles';

function addedLabel(seconds) {
  if (!seconds) return 'Added date unknown';
  return `Added ${new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export default function AddedRow({ movie, config, owned }) {
  const meta = [
    addedLabel(movie.added_at),
    movie.kind === 'show' ? seasonsLabel(movie.season_count) : null,
    movie.library || null,
  ]
    .filter(Boolean)
    .join(' · ');
  const kind = kindStyle(movie.kind);

  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="h-[66px] w-11 shrink-0 overflow-hidden rounded border border-border bg-muted">
        {movie.thumb ? (
          <img
            src={posterUrl(config, movie.thumb, 110)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{movie.title}</p>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${kind.className}`}
          >
            {kind.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      {owned ? (
        <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
          On shelf
        </span>
      ) : null}
    </div>
  );
}