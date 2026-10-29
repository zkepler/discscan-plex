import { posterUrl } from '@/lib/plex';

export default function ContinueCard({ movie, config }) {
  const progress = Math.max(0, Math.min(100, Math.round(movie.progress_pct || 0)));

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card shadow-lg shadow-black/20">
      <div className="relative aspect-[2/3] bg-muted">
        {movie.thumb ? (
          <img
            src={posterUrl(config, movie.thumb, 240)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-4xl text-muted-foreground/50">
              {(movie.title || '?').charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="p-2.5">
        <p className="line-clamp-1 text-sm font-medium text-foreground">{movie.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[`${progress}% watched`, movie.kind === 'show' ? 'TV show' : null].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}