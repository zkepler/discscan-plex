import { useMemo } from 'react';
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
import { buildCollectionCsv, downloadCsv } from '@/lib/csvExport';

export default function ShareDialog({ open, onOpenChange, discs }) {
  const { toast } = useToast();

  const csv = useMemo(() => buildCollectionCsv({ discs }), [discs]);

  const fileName = `disc-collection-${new Date().toISOString().slice(0, 10)}.csv`;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      toast({ title: 'Collection copied', description: 'Paste it into any spreadsheet.' });
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
      <DialogContent className="max-h-[94vh] min-h-[84vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Share the collection</DialogTitle>
          <DialogDescription>
            Download a CSV of your shelf and open it in any spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{fileName}</p>
          <pre className="max-h-[64vh] min-h-[56vh] overflow-auto whitespace-pre rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {csv}
          </pre>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" onClick={copyText}>
            <Copy className="mr-2 h-4 w-4" />
            Copy text
          </Button>
          <Button onClick={save}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}