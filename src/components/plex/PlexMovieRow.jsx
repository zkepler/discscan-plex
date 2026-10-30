import { posterUrl } from '@/lib/plex';
import { kindStyle, seasonsLabel } from '@/lib/mediaStyles';
import ThemeSongButton from '@/components/plex/ThemeSongButton';

export default function PlexMovieRow({ movie, config, owned, onSelect }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <button
        type="button"
        onClick={() => onSelect?.(movie)}
        className="group flex min-w-0 flex-1 select-none items-center gap-3 text-left"
      >
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
            <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
              {movie.title}
            </p>
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${kindStyle(
                movie.kind
              ).className}`}
            >
              {kindStyle(movie.kind).label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              movie.year || null,
              movie.kind === 'show' ? seasonsLabel(movie.season_count) : null,
              movie.resolution ? movie.resolution.toUpperCase() : null,
              movie.library,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </button>

      <ThemeSongButton config={config} ratingKey={movie.rating_key} title={movie.title} />

      {owned ? (
        <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
          On shelf
        </span>
      ) : (
        <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Not owned</span>
      )}
    </div>
  );
}