import { Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function runtimeLabel(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

export default function MovieDetailsCard({ details, loading }) {
  if (loading) {
    return (
      <div className="mt-4 space-y-2 rounded-lg border border-border/70 bg-secondary/30 p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <p className="pt-1 text-xs text-muted-foreground">Checking IMDb and other databases…</p>
      </div>
    );
  }

  if (!details) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
        No catalogue match — the title and year below are what you entered.
      </p>
    );
  }

  const facts = [details.year ? String(details.year) : '', runtimeLabel(details.runtime_minutes)]
    .filter(Boolean)
    .join(' · ');
  const directors = details.directors?.length ? details.directors.join(', ') : '';

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {details.rating ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            <Star className="h-3 w-3" />
            {details.rating.toFixed(1)} IMDb
          </span>
        ) : null}
        {facts ? <span className="text-xs text-muted-foreground">{facts}</span> : null}
      </div>

      {directors ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Directed by <span className="text-foreground">{directors}</span>
        </p>
      ) : null}

      {details.genres?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {details.genres.map((genre) => (
            <span key={genre} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {genre}
            </span>
          ))}
        </div>
      ) : null}

      {details.plot ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{details.plot}</p> : null}

      {details.imdb_id ? (
        <a
          href={`https://www.imdb.com/title/${details.imdb_id}/`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          Open on IMDb
        </a>
      ) : null}
    </div>
  );
}