import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AddedRow from '@/components/history/AddedRow';
import { loadConfig } from '@/lib/appSettings';
import { History as HistoryIcon } from 'lucide-react';

const PAGE_SIZE = 25;

export default function History() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState([]);
  const [ownedKeys, setOwnedKeys] = useState(new Set());
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setConfig(cfg);

      if (cfg?.plex_url) {
        const [recent, discs] = await Promise.all([
          base44.entities.PlexMovie.filter({}, { sort: '-added_at', limit: PAGE_SIZE + 1 }),
          base44.entities.Disc.list(),
        ]);
        const items = recent.items || [];
        setAdded(items.slice(0, PAGE_SIZE));
        setHasMore(items.length > PAGE_SIZE);
        setOwnedKeys(new Set(discs.map((disc) => disc.plex_rating_key).filter(Boolean)));
      }

      setLoading(false);
    })();
  }, []);

  const showMore = async () => {
    const next = limit + PAGE_SIZE;
    const page = await base44.entities.PlexMovie.filter({}, { sort: '-added_at', limit: next });
    const items = page.items || [];
    setAdded(items);
    setLimit(next);
    setHasMore(items.length === next);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!config?.plex_url) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <HistoryIcon className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl text-foreground">No Plex history yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Connect your Plex server and Shelfmark will show everything that landed in your library, newest first.
        </p>
        <Button asChild className="mt-5">
          <Link to="/settings">Connect Plex</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Straight from your server</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Recently added</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {config.last_sync
              ? `Pulled as of ${new Date(config.last_sync).toLocaleString()}`
              : 'Run a sync on the Plex page to fill this in'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/plex">Plex library</Link>
        </Button>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card px-4">
        {added.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing synced yet — run a sync to pull your library in.
          </p>
        ) : (
          added.map((movie) => (
            <AddedRow key={movie.id} movie={movie} config={config} owned={ownedKeys.has(movie.rating_key)} />
          ))
        )}
      </div>

      {hasMore ? (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={showMore}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}