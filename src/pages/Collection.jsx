import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ScanLine, Search } from 'lucide-react';
import StatsRow from '@/components/collection/StatsRow';
import DiscCard from '@/components/collection/DiscCard';
import DiscDialog from '@/components/collection/DiscDialog';
import AddFormatDialog from '@/components/collection/AddFormatDialog';
import PlexPreview from '@/components/collection/PlexPreview';
import ShareDialog from '@/components/collection/ShareDialog';
import FixTitlesButton from '@/components/collection/FixTitlesButton';
import PullPostersButton from '@/components/collection/PullPostersButton';
import PullMetadataButton from '@/components/collection/PullMetadataButton';
import PullIndicator from '@/components/PullIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { loadConfig } from '@/lib/appSettings';
import { cn } from '@/lib/utils';
import { subscribeDiscs } from '@/lib/discEvents';
import { subscribeSync } from '@/lib/syncEvents';
import { groupDiscs, seasonNumber, showBase } from '@/lib/groupDiscs';
import { combineDuplicates } from '@/lib/duplicates';
import { loadWatchStatus } from '@/lib/watchStatus';
import { useTabReselect } from '@/lib/tabReset';

const FILTERS = [
  { id: 'all', label: 'All discs' },
  { id: 'in', label: 'In Plex' },
  { id: 'out', label: 'Missing from Plex' },
];

const PAGE_SIZE = 48;

export default function Collection() {
  const [discs, setDiscs] = useState([]);
  const [watch, setWatch] = useState({});
  const [seasons, setSeasons] = useState({});
  const [config, setConfig] = useState(null);
  const [plexTotal, setPlexTotal] = useState(0);
  const [plexCounts, setPlexCounts] = useState({ movies: 0, shows: 0, fourK: 0 });
  const [plexOnly, setPlexOnly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sharing, setSharing] = useState(false);
  const [addingFormats, setAddingFormats] = useState(null);
  const [showAnchor, setShowAnchor] = useState(null);
  const navigate = useNavigate();

  useTabReselect('/', () => {
    setQuery('');
    setFilter('all');
    setVisible(PAGE_SIZE);
  });

  const refresh = async () => {
    const [discList, cfg] = await Promise.all([base44.entities.Disc.list(), loadConfig()]);
    // Duplicate copies fold into the entry they belong to.
    const { discs: shelf } = await combineDuplicates(discList);
    setDiscs(shelf);
    setConfig(cfg);
    setWatch(await loadWatchStatus(shelf.map((disc) => disc.plex_rating_key)));

    // TV discs carry the season count Plex holds for the show they match.
    const plexKeys = [...new Set(shelf.map((disc) => disc.plex_rating_key).filter(Boolean))];
    const seasonMap = {};
    for (let i = 0; i < plexKeys.length; i += 200) {
      const page = await base44.entities.PlexMovie.filter(
        { kind: 'show', rating_key: { $in: plexKeys.slice(i, i + 200) } },
        { limit: 200 }
      );
      (page.items || []).forEach((row) => {
        if (row.season_count) seasonMap[row.rating_key] = row.season_count;
      });
    }
    setSeasons(seasonMap);

    if (cfg?.plex_url) {
      const { rows = [] } = await base44.entities.PlexMovie.aggregate({ query: {}, groupBy: 'kind' });
      const byKind = rows.reduce((acc, row) => ({ ...acc, [row.kind || 'movie']: row.count || 0 }), {});
      setPlexCounts({ movies: byKind.movie || 0, shows: byKind.show || 0, fourK: byKind['4k'] || 0 });
      setPlexTotal(rows.reduce((sum, row) => sum + (row.count || 0), 0));
      const owned = shelf
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
      setPlexCounts({ movies: 0, shows: 0, fourK: 0 });
      setPlexOnly([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // The header sync button reloads the shelf from the server.
  useEffect(() => subscribeSync(refresh), []);

  // Discs saved, scanned or removed anywhere in the app land here instantly.
  useEffect(
    () =>
      subscribeDiscs((change) => {
        setDiscs((prev) => {
          if (change.type === 'create') return [...prev, change.disc];
          if (change.type === 'replace') return prev.map((disc) => (disc.id === change.id ? change.disc : disc));
          if (change.type === 'patch')
            return prev.map((disc) => (disc.id === change.id ? { ...disc, ...change.patch } : disc));
          if (change.type === 'remove') return prev.filter((disc) => disc.id !== change.id);
          return prev;
        });
      }),
    []
  );

  const inPlex = discs.filter((disc) => disc.plex_rating_key).length;

  const { pull, refreshing, threshold } = usePullToRefresh(refresh, { disabled: loading });

  const selected = useMemo(
    () => discs.find((disc) => disc.id === searchParams.get('disc')) || null,
    [discs, searchParams]
  );

  const openDisc = (disc, editMeta = false) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('disc', disc.id);
      if (editMeta) next.set('edit', 'meta');
      else next.delete('edit');
      return next;
    });
  };

  const closeDisc = () => {
    setShowAnchor(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('disc');
        next.delete('edit');
        return next;
      },
      { replace: true }
    );
  };

  // A show opens its disc details with every season listed underneath.
  const openShow = ({ title, discs: copies, seasonCount }) => {
    const numbered = copies
      .filter((disc) => seasonNumber(disc.title) !== null)
      .sort((a, b) => seasonNumber(a.title) - seasonNumber(b.title));
    const first = numbered[0] || copies[0];
    setShowAnchor({
      key: numbered.length ? showBase(first.title) : '',
      title,
      seasonCount,
      copies,
    });
    openDisc(first);
  };

  const showContext = useMemo(() => {
    if (!showAnchor) return null;
    const live = showAnchor.key
      ? groupDiscs(discs).find((group) => group.show === showAnchor.key)
      : null;
    const copies = live ? live.discs : showAnchor.copies;
    return {
      title: (live && live.showTitle) || showAnchor.title,
      seasonCount: showAnchor.seasonCount,
      discs: copies,
    };
  }, [showAnchor, discs]);

  const openInPlex = (title) => {
    closeDisc();
    navigate(`/plex?q=${encodeURIComponent(title)}`);
  };

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

  const groups = useMemo(() => groupDiscs(filtered), [filtered]);

  return (
    <div>
      <PullIndicator pull={pull} refreshing={refreshing} threshold={threshold} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Everything you own</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">The Collection</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FixTitlesButton
            config={config}
            discs={discs}
            onDone={refresh}
            disabled={loading || discs.length === 0}
          />
          <PullPostersButton
            config={config}
            onDone={refresh}
            disabled={loading || discs.length === 0}
          />
          <PullMetadataButton
            config={config}
            onDone={refresh}
            disabled={loading || discs.length === 0}
          />
          <Button
            variant="outline"
            onClick={() => setSharing(true)}
            disabled={loading || (discs.length === 0 && plexTotal === 0)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
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
          plexCounts={plexCounts}
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
                'select-none rounded-full px-3 py-1.5 text-xs transition-colors',
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
            {groups.slice(0, visible).map((group) => (
              <DiscCard
                key={group.key}
                discs={group.discs}
                watch={watch}
                seasons={seasons}
                onSelect={openDisc}
                onOpenShow={openShow}
                onAddFormat={setAddingFormats}
                onEditMeta={(disc) => openDisc(disc, true)}
              />
            ))}
          </div>
          {groups.length > visible ? (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}

      {!loading ? <PlexPreview items={plexOnly} config={config} plexTotal={plexTotal} /> : null}

      <DiscDialog
        disc={selected}
        editMetadata={searchParams.get('edit') === 'meta'}
        show={showContext}
        onSelectSeason={(disc) => openDisc(disc)}
        onPlex={openInPlex}
        onClose={closeDisc}
        onChange={refresh}
      />

      {addingFormats ? (
        <AddFormatDialog
          discs={addingFormats}
          onClose={() => setAddingFormats(null)}
          onDone={refresh}
        />
      ) : null}

      <ShareDialog open={sharing} onOpenChange={setSharing} discs={discs} />
    </div>
  );
}