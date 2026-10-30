import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { seasonNumber } from '@/lib/groupDiscs';
import { formatStyle } from '@/lib/mediaStyles';

// Every season a show has in Plex, marked with the ones on the shelf.
export default function ShowSeasonsDialog({ show, onClose, onSelect }) {
  const isMobile = useIsMobile();
  if (!show) return null;

  const copiesBySeason = new Map();
  const unnumbered = [];

  show.discs.forEach((disc) => {
    const season = seasonNumber(disc.title);
    if (season === null) {
      unnumbered.push(disc);
      return;
    }
    copiesBySeason.set(season, [...(copiesBySeason.get(season) || []), disc]);
  });

  const ownedSeasons = [...copiesBySeason.keys()];
  const total = Math.max(show.seasonCount || 0, ...ownedSeasons);
  const seasons = Array.from({ length: total }, (_, index) => index + 1);

  const row = (season, copies) => {
    const owned = copies.length > 0;
    return (
      <button
        key={`season-${season}`}
        type="button"
        disabled={!owned}
        onClick={() => (owned ? onSelect(copies[0]) : null)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
          owned
            ? 'border-border bg-card hover:border-primary'
            : 'border-dashed border-border/70 opacity-60'
        }`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Season {season}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {owned ? (
              copies.map((disc) => (
                <span
                  key={disc.id}
                  className={`rounded border px-1.5 py-0.5 text-xs uppercase tracking-[0.08em] ${formatStyle(
                    disc.format || 'DVD'
                  )}`}
                >
                  {disc.format || 'DVD'}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Nothing on the shelf</span>
            )}
          </span>
        </span>
        {owned ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            <Check className="h-3.5 w-3.5" />
            Owned
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Not owned
          </span>
        )}
      </button>
    );
  };

  const body = (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {ownedSeasons.length} of {total || '?'} seasons owned
      </p>
      <div className="mt-4 space-y-2">
        {seasons.length ? (
          seasons.map((season) => row(season, copiesBySeason.get(season) || []))
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No season list for this show yet. Sync Plex to pull it in.
          </p>
        )}
      </div>

      {unnumbered.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Also on your shelf</p>
          <div className="mt-2 space-y-2">
            {unnumbered.map((disc) => (
              <button
                key={disc.id}
                type="button"
                onClick={() => onSelect(disc)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary"
              >
                <span className="truncate text-sm text-foreground">{disc.title}</span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs uppercase tracking-[0.08em] ${formatStyle(
                    disc.format || 'DVD'
                  )}`}
                >
                  {disc.format || 'DVD'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => (!open ? onClose() : null)}>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-x-0 border-b-0 border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="min-h-0 overflow-y-auto px-5 pb-2">
            <DrawerTitle className="pt-1 font-display text-2xl font-normal">{show.title}</DrawerTitle>
            <div className="mt-3">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">{show.title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}