import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
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
import { buildRecentPlexEmail, buildShareEmail, mailtoLink } from '@/lib/shareText';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'collection', label: 'My collection' },
  { id: 'recent', label: 'Recently added' },
];

export default function ShareDialog({ open, onOpenChange, discs, inPlex }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('collection');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [includeList, setIncludeList] = useState(true);
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    if (open) setMode(discs.length ? 'collection' : 'recent');
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'recent' || recent) return;
    let active = true;
    (async () => {
      const page = await base44.entities.PlexMovie.filter({}, { sort: '-added_at', limit: 20 });
      if (active) setRecent(page.items || []);
    })();
    return () => {
      active = false;
    };
  }, [open, mode, recent]);

  const loading = mode === 'recent' && !recent;

  const email = useMemo(
    () =>
      mode === 'recent'
        ? buildRecentPlexEmail({ items: recent || [], note })
        : buildShareEmail({ discs, inPlex, includeList, note }),
    [mode, recent, note, discs, inPlex, includeList]
  );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(email.body);
      toast({
        title: mode === 'recent' ? 'Recent additions copied' : 'Collection copied',
        description: 'Paste it into any email or message.',
      });
    } catch (error) {
      toast({ title: 'Could not copy', description: 'Select the preview text and copy it manually.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === 'recent' ? 'Share what is new in Plex' : 'Share the collection'}
          </DialogTitle>
          <DialogDescription>
            Add a note, check the preview, then send it from your own email app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={cn(
                  'select-none rounded-full px-3 py-1.5 text-xs transition-colors',
                  mode === option.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

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
              placeholder={
                mode === 'recent' ? 'Look what just landed on the server.' : "Here's what's on my shelf these days."
              }
            />
          </div>

          {mode === 'collection' ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm text-foreground">Include every title</p>
                <p className="text-xs text-muted-foreground">Turn off to send just the totals.</p>
              </div>
              <Switch checked={includeList} onCheckedChange={setIncludeList} />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Preview</Label>
            {loading ? (
              <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Reading your Plex library…
              </p>
            ) : mode === 'recent' && (recent || []).length === 0 ? (
              <p className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Nothing has been added to Plex yet — run a sync on the Plex page first.
              </p>
            ) : (
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {email.body}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copyText} disabled={loading}>
            <Copy className="mr-2 h-4 w-4" />
            Copy text
          </Button>
          <Button asChild>
            <a
              href={loading ? undefined : mailtoLink({ to, subject: email.subject, body: email.body })}
              aria-disabled={loading}
              onClick={(event) => {
                if (loading) event.preventDefault();
              }}
              className={loading ? 'pointer-events-none opacity-50' : undefined}
            >
              <Mail className="mr-2 h-4 w-4" />
              Open email app
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}