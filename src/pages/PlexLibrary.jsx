import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PlexMovieRow from '@/components/plex/PlexMovieRow';
import { loadConfig } from '@/lib/appSettings';
import { syncPlexLibrary } from '@/lib/plexSync';
import { escapeRegex } from '@/lib/matching';
import { listAllPlexMovies } from '@/lib/plexStore';
import { subscribeSync } from '@/lib/syncEvents';
import { downloadPlexLibraryWorkbook } from '@/lib/xlsxExport';
import { useTabReselect } from '@/lib/tabReset';
import PullIndicator from '@/components/PullIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { ChevronDown, Download, Loader2, RefreshCw, Search, Tv } from 'lucide-react';

const PAGE_SIZE = 50;

const KIND_FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'movie', label: 'Movies' },
  { value: '4k', label: '4K Movies' },
  { value: 'show', label: 'TV shows' },
];

function queryPage(query, cursor, kind = 'all') {
  const filter = query ? { search_title: { $regex: escapeRegex(query) } } : {};
  if (kind === 'show') filter.kind = 'show';
  else if (kind === '4k') filter.kind = '4k';
  else if (kind === 'movie') filter.kind = 'movie';
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
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [kind, setKind] = useState('all');
  const [debounced, setDebounced] = useState(
    () => (new URLSearchParams(window.location.search).get('q') || '').trim().toLowerCase()
  );
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingScope, setSyncingScope] = useState('all');
  const [progress, setProgress] = useState('');

  const labelFor = (value) => KIND_FILTERS.find((option) => option.value === value)?.label || 'Everything';

  useTabReselect('/plex', () => {
    setQuery('');
    setKind('all');
  });

  const load = async () => {
    const cfg = await loadConfig();
    setConfig(cfg);
    if (!cfg?.plex_url) {
      setLoading(false);
      return;
    }
    const [discs, page] = await Promise.all([base44.entities.Disc.list(), queryPage('', null, kind)]);
    setOwnedKeys(new Set(discs.map((disc) => disc.plex_rating_key).filter(Boolean)));
    setMovies(page.items || []);
    setCursor(page.next_cursor || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // The header sync button reloads this list from the server.
  useEffect(() => subscribeSync(load), [kind]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (loading || !config?.plex_url) return;
    let active = true;
    (async () => {
      const page = await queryPage(debounced, null, kind);
      if (!active) return;
      setMovies(page.items || []);
      setCursor(page.next_cursor || null);
    })();
    return () => {
      active = false;
    };
  }, [debounced, kind, loading, config?.plex_url]);

  const { pull, refreshing, threshold } = usePullToRefresh(load, {
    disabled: loading || !config?.plex_url || syncing,
  });

  const loadMore = async () => {
    const page = await queryPage(debounced, cursor, kind);
    setMovies((prev) => [...prev, ...(page.items || [])]);
    setCursor(page.next_cursor || null);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const items = await listAllPlexMovies();
      const sheets = downloadPlexLibraryWorkbook({ items, ownedKeys });
      toast({
        title: 'Library exported',
        description: sheets.map((sheet) => `${sheet.name}: ${sheet.count}`).join(' · '),
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export failed', description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const sync = async (scope = 'all') => {
    setSyncing(true);
    setSyncingScope(scope);
    setProgress('Reading your Plex library…');
    try {
      const result = await syncPlexLibrary(
        config,
        (count, section) => setProgress(`${section} · ${count.toLocaleString()} titles`),
        scope === 'all' ? null : [scope]
      );
      toast({
        title: `${labelFor(scope)} synced`,
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
          Add your Plex server address and token once, then pull your movies and TV shows into the catalogue.
        </p>
        <Button asChild className="mt-5">
          <Link to="/settings">Connect Plex</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PullIndicator pull={pull} refreshing={refreshing} threshold={threshold} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Synced from your server</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Plex library</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {config.last_sync
              ? `Last synced ${new Date(config.last_sync).toLocaleString()}`
              : 'Never synced'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={exporting || syncing}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={syncing}>
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {syncing ? `Syncing ${labelFor(syncingScope)}…` : 'Sync'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sync from Plex</DropdownMenuLabel>
              {KIND_FILTERS.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => sync(option.value)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

      <div className="mt-3 flex flex-wrap gap-2">
        {KIND_FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={kind === option.value ? 'default' : 'outline'}
            className="select-none"
            onClick={() => setKind(option.value)}
          >
            {option.label}
          </Button>
        ))}
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