import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { posterUrl } from '@/lib/plex';

export default function PlexPreview({ items, config, plexTotal }) {
  if (!config?.plex_url) return null;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">In your library</p>
          <h2 className="mt-1.5 font-display text-2xl text-foreground">Plex only</h2>
        </div>
        <Link
          to="/plex"
          className="flex items-center gap-1 text-xs uppercase tracking-widest text-primary hover:underline"
        >
          All {plexTotal} titles
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((movie) => (
          <div key={movie.rating_key} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-[2/3] bg-muted">
              {movie.thumb ? (
                <img
                  src={posterUrl(config, movie.thumb, 200)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium text-foreground">{movie.title}</p>
              <p className="text-xs text-muted-foreground">{movie.year || '—'}</p>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Everything in Plex is also on your shelf. Nice work.
        </p>
      ) : null}
    </section>
  );
}