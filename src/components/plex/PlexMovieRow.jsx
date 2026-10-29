import { posterUrl } from '@/lib/plex';

export default function PlexMovieRow({ movie, config, owned }) {
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
        <p className="truncate text-sm font-medium text-foreground">{movie.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[
            movie.year || null,
            movie.kind === 'show'
              ? 'TV show'
              : movie.kind === '4k'
                ? '4K'
                : movie.resolution
                  ? movie.resolution.toUpperCase()
                  : null,
            movie.library,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

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