import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanLine, Search, Share2 } from 'lucide-react';
import StatsRow from '@/components/collection/StatsRow';
import DiscCard from '@/components/collection/DiscCard';
import DiscDialog from '@/components/collection/DiscDialog';
import PlexPreview from '@/components/collection/PlexPreview';
import ShareDialog from '@/components/collection/ShareDialog';
import { loadConfig } from '@/lib/appSettings';
import { cn } from '@/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All discs' },
  { id: 'in', label: 'In Plex' },
  { id: 'out', label: 'Missing from Plex' },
];

const PAGE_SIZE = 48;

export default function Collection() {
  const [discs, setDiscs] = useState([]);
  const [config, setConfig] = useState(null);
  const [plexTotal, setPlexTotal] = useState(0);
  const [plexOnly, setPlexOnly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sharing, setSharing] = useState(false);

  const refresh = async () => {
    const [discList, cfg] = await Promise.all([base44.entities.Disc.list(), loadConfig()]);
    setDiscs(discList);
    setConfig(cfg);

    if (cfg?.plex_url) {
      const total = await base44.entities.PlexMovie.count({});
      setPlexTotal(total);
      const owned = discList
        .map((disc) => disc.plex_rating_key)
        .filter(Boolean)
        .slice(0, 200);
      const page = await base44.entities.PlexMovie.filter(
        owned.length ? { rating_key: { $nin: owned } } : {},
        { sort: 'title', limit: 6 }
      );
      setPlexOnly(page.items || []);
    } else {
      setPlexTotal(0);
      setPlexOnly([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const inPlex = discs.filter((disc) => disc.plex_rating_key).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return discs
      .filter((disc) => {
        if (filter === 'in') return !!disc.plex_rating_key;
        if (filter === 'out') return !disc.plex_rating_key;
        return true;
      })
      .filter((disc) => {
        if (!q) return true;
        return (
          (disc.title || '').toLowerCase().includes(q) ||
          (disc.upc || '').includes(q) ||
          (disc.location || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [discs, query, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Everything you own</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">The Collection</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSharing(true)} disabled={loading || discs.length === 0}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button asChild>
            <Link to="/scan">
              <ScanLine className="mr-2 h-4 w-4" />
              Scan a disc
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <StatsRow
          discs={discs.length}
          inPlex={inPlex}
          missing={discs.length - inPlex}
          plexTotal={plexTotal}
        />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search titles, barcodes, shelves"
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-full border border-border p-1">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setFilter(option.id);
                setVisible(PAGE_SIZE);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition-colors',
                filter === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-foreground">
            {discs.length === 0 ? 'Your shelf is empty' : 'Nothing matches that'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {discs.length === 0
              ? 'Scan the barcode on a DVD case and it gets added to your catalogue, checked against Plex as you go.'
              : 'Try a different search or switch the filter.'}
          </p>
          {discs.length === 0 ? (
            <Button asChild className="mt-5">
              <Link to="/scan">
                <ScanLine className="mr-2 h-4 w-4" />
                Scan your first disc
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.slice(0, visible).map((disc) => (
              <DiscCard key={disc.id} disc={disc} onSelect={setSelected} />
            ))}
          </div>
          {filtered.length > visible ? (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}

      {!loading ? <PlexPreview items={plexOnly} config={config} plexTotal={plexTotal} /> : null}

      <DiscDialog disc={selected} onClose={() => setSelected(null)} onChange={refresh} />

      <ShareDialog open={sharing} onOpenChange={setSharing} discs={discs} inPlex={inPlex} />
    </div>
  );
}