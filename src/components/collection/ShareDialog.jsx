import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { buildCollectionCsv, buildRecentCsv, downloadCsv } from '@/lib/csvExport';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'collection', label: 'My collection' },
  { id: 'recent', label: 'Recently added' },
];

export default function ShareDialog({ open, onOpenChange, discs }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('collection');
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    if (open) setMode(discs.length ? 'collection' : 'recent');
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'recent' || recent) return;
    let active = true;
    (async () => {
      const page = await base44.entities.PlexMovie.filter({}, { sort: '-added_at', limit: 500 });
      if (active) setRecent(page.items || []);
    })();
    return () => {
      active = false;
    };
  }, [open, mode, recent]);

  const loading = mode === 'recent' && !recent;

  const csv = useMemo(
    () => (mode === 'recent' ? buildRecentCsv({ items: recent || [] }) : buildCollectionCsv({ discs })),
    [mode, recent, discs]
  );

  const fileName = `${mode === 'recent' ? 'recently-added' : 'disc-collection'}-${
    new Date().toISOString().slice(0, 10)
  }.csv`;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      toast({
        title: mode === 'recent' ? 'Recent additions copied' : 'Collection copied',
        description: 'Paste it into any spreadsheet.',
      });
    } catch (error) {
      toast({ title: 'Could not copy', description: 'Select the preview text and copy it manually.', variant: 'destructive' });
    }
  };

  const save = () => {
    downloadCsv(fileName, csv);
    toast({ title: 'CSV downloaded', description: fileName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === 'recent' ? 'Share what is new in Plex' : 'Share the collection'}
          </DialogTitle>
          <DialogDescription>
            Download a CSV of your shelf and open it in any spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={cn(
                  'select-none rounded-lg border px-4 py-2.5 text-sm transition-colors',
                  mode === option.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            {loading ? (
              <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Reading your Plex library…
              </p>
            ) : mode === 'recent' && (recent || []).length === 0 ? (
              <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Nothing has been added to Plex yet — run a sync on the Plex page first.
              </p>
            ) : (
              <pre className="max-h-64 overflow-auto whitespace-pre rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {csv}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copyText} disabled={loading}>
            <Copy className="mr-2 h-4 w-4" />
            Copy text
          </Button>
          <Button onClick={save} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}