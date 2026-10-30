import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { posterUrl } from '@/lib/plex';
import { kindStyle, seasonsLabel } from '@/lib/mediaStyles';
import { Loader2 } from 'lucide-react';

const listOf = (value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : '');

// "Watched", "42% watched", "Not watched yet" — whatever Plex reports for the title.
function watchLabel(movie) {
  const pct = Number(movie?.progress_pct || 0);
  if (pct >= 95) return 'Watched';
  if (pct > 0) return `${pct}% watched`;
  if (Number(movie?.view_count || 0) > 0) return `Watched ${movie.view_count}×`;
  return 'Not watched yet';
}

function detailRows(metadata) {
  if (!metadata) return [];
  return [
    { label: 'Director', value: listOf(metadata.directors) },
    { label: 'Studio', value: metadata.studio },
    { label: 'Runtime', value: metadata.runtime_minutes ? `${metadata.runtime_minutes} min` : '' },
    { label: 'Rated', value: metadata.rating },
    { label: 'Genres', value: listOf(metadata.genres) },
    { label: 'Cast', value: listOf(metadata.cast) },
    { label: 'Edition', value: metadata.edition },
  ].filter((row) => String(row.value || '').trim());
}

export default function PlexTitleDialog({ movie, config, onClose }) {
  const isMobile = useIsMobile();
  const [shown, setShown] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  // Keep the panel mounted after it closes so the sheet can animate away.
  useEffect(() => {
    if (!movie) return;
    setShown(movie);
    setMetadata(null);
    setError('');

    if (!config?.plex_url || !movie.rating_key) {
      setState('ready');
      return undefined;
    }

    let active = true;
    setState('loading');
    base44.functions
      .invoke('plexDetails', {
        plex_url: config.plex_url,
        plex_token: config.plex_token,
        rating_key: movie.rating_key,
      })
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        if (data.error) throw new Error(data.error);
        setMetadata(data.found ? data.metadata : null);
        setState('ready');
      })
      .catch((failure) => {
        if (!active) return;
        setError(failure?.response?.data?.error || failure.message || 'Could not load details from Plex.');
        setState('ready');
      });

    return () => {
      active = false;
    };
  }, [movie?.rating_key, movie?.id, config?.plex_url]);

  if (!shown) return null;

  const subtitle = [
    shown.year || null,
    shown.kind === 'show' ? seasonsLabel(shown.season_count) : null,
    shown.resolution ? shown.resolution.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = detailRows(metadata);
  const plot = String(metadata?.plot || '').trim();

  const body = (
    <div className="space-y-5">
      <div className="flex gap-4">
        <div className="h-[156px] w-[104px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {shown.thumb ? (
            <img src={posterUrl(config, shown.thumb, 240)} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              kindStyle(shown.kind).className
            }`}
          >
            {kindStyle(shown.kind).label}
          </span>
          {subtitle ? <p className="mt-2 text-sm text-foreground">{subtitle}</p> : null}
          {shown.library ? (
            <p className="mt-1 text-xs text-muted-foreground">Library · {shown.library}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">{watchLabel(shown)}</p>
          {shown.added_at ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Added {new Date(shown.added_at * 1000).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      </div>

      {state === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading details from Plex…
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!error && state === 'ready' ? (
        rows.length || plot ? (
          <div className="space-y-3">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
            {plot ? (
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Synopsis</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{plot}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            Plex has no extra details saved for this title.
          </p>
        )
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={!!movie} onOpenChange={(open) => (!open ? onClose() : null)}>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-x-0 border-b-0 border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="min-h-0 overflow-y-auto px-5 pb-2">
            <DrawerTitle className="pt-1 pr-2 font-display text-2xl font-normal leading-tight">
              {shown.title}
            </DrawerTitle>
            <div className="mt-4">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={!!movie} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="pr-6 font-display text-2xl font-normal leading-tight">
          {shown.title}
        </DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}