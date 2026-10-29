import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { emitDisc } from '@/lib/discEvents';
import { pullPostersForDiscs } from '@/lib/plexPosters';
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
      format: disc.format || 'DVD',
      location: disc.location || '',
      notes: disc.notes || '',
      plex_rating_key: disc.plex_rating_key || '',
      plex_title: disc.plex_title || '',
    });
    setConfirming(false);
  }, [disc?.id]);

  const shown = disc || lastDisc;
  if (!shown || !form) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const failed = (error) =>
    toast({ variant: 'destructive', title: 'That change did not stick', description: error.message });

  function save() {
    const patch = {
      title: form.title.trim(),
      year: form.year ? Number(form.year) : null,
      format: form.format,
      location: form.location.trim(),
      notes: form.notes.trim(),
      plex_rating_key: form.plex_rating_key || null,
      plex_title: form.plex_rating_key ? form.plex_title || null : null,
    };

    emitDisc({ type: 'patch', id: shown.id, patch });
    onClose();

    base44.entities.Disc.update(shown.id, patch)
      .then(() => {
        onChange?.();
        if (patch.plex_rating_key && !shown.cover_url) {
          pullPostersForDiscs([shown.id]).catch(() => {});
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Disc details</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}