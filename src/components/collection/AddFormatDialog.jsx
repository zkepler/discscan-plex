import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { FORMATS } from '@/lib/constants';
import { addFormatCopies } from '@/lib/discCopies';
import FormatPicker from '@/components/collection/FormatPicker';
import { Loader2, Plus } from 'lucide-react';

export default function AddFormatDialog({ discs, onClose, onDone }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const source = discs.find((disc) => disc.cover_url) || discs[0];
  const owned = discs.map((disc) => disc.format || 'DVD');
  const available = FORMATS.filter((format) => !owned.includes(format));

  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    try {
      await addFormatCopies(source, picked);
      toast({ title: 'Formats added', description: `${source.title} · ${picked.join(', ')}` });
      onDone?.();
      onClose();
    } catch (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Could not add those formats', description: error.message });
    }
  }

  const body = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {source.title}
        {source.year ? ` (${source.year})` : ''} — tick the other formats you own.
      </p>

      {available.length ? (
        <FormatPicker formats={available} value={picked} onChange={setPicked} />
      ) : (
        <p className="text-sm text-muted-foreground">You already track every format for this title.</p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
        <Button variant="ghost" onClick={onClose} className="select-none">
          Cancel
        </Button>
        <Button onClick={add} disabled={!picked.length || saving} className="select-none">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          {picked.length > 1 ? `Add ${picked.length} formats` : 'Add format'}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => (!open ? onClose() : null)}>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-x-0 border-b-0 border-border bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="min-h-0 overflow-y-auto px-5 pb-2">
            <DrawerTitle className="pt-1 font-display text-2xl font-normal">Add a format</DrawerTitle>
            <div className="mt-4">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Add a format</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}