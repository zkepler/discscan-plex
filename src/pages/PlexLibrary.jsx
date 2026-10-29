import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import PlexMovieRow from '@/components/plex/PlexMovieRow';
import { loadConfig } from '@/lib/appSettings';
import { syncPlexLibrary } from '@/lib/plexSync';
import { escapeRegex } from '@/lib/matching';
import { Loader2, RefreshCw, Search, Tv } from 'lucide-react';

const PAGE_SIZE = 50;

function queryPage(query, cursor) {
  const filter = query ? { search_title: { $regex: escapeRegex(query) } } : {};
  return base44.entities.PlexMovie.filter(filter, {
    sort: 'title',
    limit: PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
}

export default function PlexLibrary() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [movies, setMovies] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [ownedKeys, setOwnedKeys] = useState(new Set());
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');

  const load = async () => {
    const cfg = await loadConfig();
    setConfig(cfg);
    if (!cfg?.plex_url) {
      setLoading(false);
      return;
    }
    const [discs, page] = await Promise.all([base44.entities.Disc.list(), queryPage('', null)]);
    setOwnedKeys(new Set(discs.map((disc) => disc.plex_rating_key).filter(Boolean)));
    setMovies(page.items || []);
    setCursor(page.next_cursor || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (loading || !config?.plex_url) return;
    let active = true;
    (async () => {
      const page = await queryPage(debounced, null);
      if (!active) return;
      setMovies(page.items || []);
      setCursor(page.next_cursor || null);
    })();
    return () => {
      active = false;
    };
  }, [debounced, loading, config?.plex_url]);

  const loadMore = async () => {
    const page = await queryPage(debounced, cursor);
    setMovies((prev) => [...prev, ...(page.items || [])]);
    setCursor(page.next_cursor || null);
  };

  const sync = async () => {
    setSyncing(true);
    setProgress('Reading your Plex library…');
    try {
      const result = await syncPlexLibrary(config, (count, section) =>
        setProgress(`Reading ${section} · ${count} titles`)
      );
      toast({
        title: 'Plex library synced',
        description: `${result.total} titles · ${result.matched} discs matched`,
      });
      await load();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Sync failed', description: error.message });
    } finally {
      setSyncing(false);
      setProgress('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your library…
      </div>
    );
  }

  if (!config?.plex_url) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <Tv className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl text-foreground">Plex isn’t connected yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Add your Plex server address and token once, then pull your whole movie library into the catalogue.
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
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Synced from your server</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Plex library</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {config.last_sync
              ? `Last synced ${new Date(config.last_sync).toLocaleString()}`
              : 'Never synced'}
          </p>
        </div>
        <Button onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      {syncing && progress ? <p className="mt-3 text-xs text-primary">{progress}</p> : null}

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your Plex library"
          className="pl-9"
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4">
        {movies.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {debounced ? 'No titles match that search.' : 'Nothing synced yet — run a sync to pull your library.'}
          </p>
        ) : (
          movies.map((movie) => (
            <PlexMovieRow
              key={movie.id}
              movie={movie}
              config={config}
              owned={ownedKeys.has(movie.rating_key)}
            />
          ))
        )}
      </div>

      {cursor ? (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}