import { useMemo, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { buildShareEmail, mailtoLink } from '@/lib/shareText';

export default function ShareDialog({ open, onOpenChange, discs, inPlex }) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [includeList, setIncludeList] = useState(true);

  const email = useMemo(
    () => buildShareEmail({ discs, inPlex, includeList, note }),
    [discs, inPlex, includeList, note]
  );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(email.body);
      toast({ title: 'Collection copied', description: 'Paste it into any email or message.' });
    } catch (error) {
      toast({ title: 'Could not copy', description: 'Select the preview text and copy it manually.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Share the collection</DialogTitle>
          <DialogDescription>
            Add a note, check the preview, then send it from your own email app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="share-to">Send to</Label>
            <Input
              id="share-to"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="friend@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="share-note">Note</Label>
            <Textarea
              id="share-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Here's what's on my shelf these days."
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm text-foreground">Include every title</p>
              <p className="text-[11px] text-muted-foreground">Turn off to send just the totals.</p>
            </div>
            <Switch checked={includeList} onCheckedChange={setIncludeList} />
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {email.body}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copyText}>
            <Copy className="mr-2 h-4 w-4" />
            Copy text
          </Button>
          <Button asChild>
            <a href={mailtoLink({ to, subject: email.subject, body: email.body })}>
              <Mail className="mr-2 h-4 w-4" />
              Open email app
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}