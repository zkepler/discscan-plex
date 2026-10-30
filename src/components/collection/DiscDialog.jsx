import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { emitDisc } from '@/lib/discEvents';
import { pullPostersForDiscs } from '@/lib/plexPosters';
import { addFormatCopies } from '@/lib/discCopies';
import { splitList, joinList } from '@/lib/discMetadata';
import DiscForm from '@/components/collection/DiscForm';

export default function DiscDialog({ disc, onClose, onChange }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [form, setForm] = useState(null);
  const [lastDisc, setLastDisc] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // Keep the panel mounted after it closes so the sheet can animate away.
  useEffect(() => {
    if (!disc) return;
    setLastDisc(disc);
    setForm({
      title: disc.title || '',
      year: disc.year ? String(disc.year) : '',
      formats: [disc.format || 'DVD'],
      location: disc.location || '',
      notes: disc.notes || '',
      plex_rating_key: disc.plex_rating_key || '',
      plex_title: disc.plex_title || '',
      cover_url: disc.cover_url || '',
      directors: joinList(disc.directors),
      studio: disc.studio || '',
      runtime: disc.runtime_minutes ? String(disc.runtime_minutes) : '',
      rating: disc.rating || '',
      genres: joinList(disc.genres),
      cast: joinList(disc.cast),
      plot: disc.plot || '',
      edition: disc.edition || '',
    });
    setConfirming(false);
  }, [disc?.id]);

  // Fill the form from a metadata file the user uploaded for this copy.
  const applyMetadata = (patch) =>
    setForm((prev) => ({
      ...prev,
      title: patch.title || prev.title,
      year: patch.year ? String(patch.year) : prev.year,
      directors: patch.directors ? joinList(patch.directors) : prev.directors,
      studio: patch.studio || prev.studio,
      runtime: patch.runtime_minutes ? String(patch.runtime_minutes) : prev.runtime,
      rating: patch.rating || prev.rating,
      genres: patch.genres ? joinList(patch.genres) : prev.genres,
      cast: patch.cast ? joinList(patch.cast) : prev.cast,
      plot: patch.plot || prev.plot,
      edition: patch.edition || prev.edition,
    }));

  const shown = disc || lastDisc;
  if (!shown || !form) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const failed = (error) =>
    toast({ variant: 'destructive', title: 'That change did not stick', description: error.message });

  function save() {
    const formats = form.formats.length ? form.formats : ['DVD'];
    const patch = {
      title: form.title.trim(),
      year: form.year ? Number(form.year) : null,
      format: formats[0],
      location: form.location.trim(),
      notes: form.notes.trim(),
      plex_rating_key: form.plex_rating_key || null,
      plex_title: form.plex_rating_key ? form.plex_title || null : null,
      cover_url: form.cover_url || '',
      directors: splitList(form.directors),
      studio: form.studio.trim(),
      runtime_minutes: form.runtime ? Number(form.runtime) : null,
      rating: form.rating.trim(),
      genres: splitList(form.genres),
      cast: splitList(form.cast),
      plot: form.plot.trim(),
      edition: form.edition.trim(),
    };

    emitDisc({ type: 'patch', id: shown.id, patch });
    onClose();

    base44.entities.Disc.update(shown.id, patch)
      .then(() => {
        if (formats.length > 1) {
          return addFormatCopies(patch, formats.slice(1));
        }
        return [];
      })
      .then((extra) => {
        onChange?.();
        if (patch.plex_rating_key && !patch.cover_url) {
          pullPostersForDiscs([shown.id, ...(extra || []).map((disc) => disc.id)]).catch(() => {});
        }
      })
      .catch((error) => {
        failed(error);
        onChange?.();
      });
  }

  function remove() {
    emitDisc({ type: 'remove', id: shown.id });
    onClose();

    base44.entities.Disc.delete(shown.id)
      .then(() => onChange?.())
      .catch((error) => {
        failed(error);
        onChange?.();
      });
  }

  const body = (
    <DiscForm
      disc={shown}
      form={form}
      set={set}
      confirming={confirming}
      onSave={save}
      onRemove={() => (confirming ? remove() : setConfirming(true))}
      onClose={onClose}
      onMetadata={applyMetadata}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={!!disc} onOpenChange={(open) => (!open ? onClose() : null)}>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-x-0 border-b-0 border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="min-h-0 overflow-y-auto px-5 pb-2">
            <DrawerTitle className="pt-1 font-display text-2xl font-normal">Disc details</DrawerTitle>
            <div className="mt-4">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={!!disc} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Disc details</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}