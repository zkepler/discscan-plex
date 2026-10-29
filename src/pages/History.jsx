import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ContinueCard from '@/components/history/ContinueCard';
import AddedRow from '@/components/history/AddedRow';
import { loadConfig } from '@/lib/appSettings';
import { History as HistoryIcon } from 'lucide-react';

export default function History() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [continued, setContinued] = useState([]);
  const [added, setAdded] = useState([]);
  const [ownedKeys, setOwnedKeys] = useState(new Set());

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setConfig(cfg);

      if (cfg?.plex_url) {
        const [watching, recent, discs] = await Promise.all([
          base44.entities.PlexMovie.filter(
            { progress_pct: { $gt: 0, $lt: 95 } },
            { sort: '-last_viewed_at', limit: 12 }
          ),
          base44.entities.PlexMovie.filter({}, { sort: '-added_at', limit: 15 }),
          base44.entities.Disc.list(),
        ]);
        setContinued(watching.items || []);
        setAdded(recent.items || []);
        setOwnedKeys(new Set(discs.map((disc) => disc.plex_rating_key).filter(Boolean)));
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full rounded-lg" />
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
          Connect your Plex server and Shelfmark will show what you&apos;re partway through and what was added
          recently.
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
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">History</h1>
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

      <section className="mt-8">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Continue watching</h2>
        {continued.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing partway through right now.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {continued.map((movie) => (
              <ContinueCard key={movie.id} movie={movie} config={config} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Recently added to Plex</h2>
        <div className="mt-3 rounded-xl border border-border bg-card px-4">
          {added.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing synced yet — run a sync to pull your library in.
            </p>
          ) : (
            added.map((movie) => (
              <AddedRow
                key={movie.id}
                movie={movie}
                config={config}
                owned={ownedKeys.has(movie.rating_key)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}