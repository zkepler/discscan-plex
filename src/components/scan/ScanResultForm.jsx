import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { findPlexMatch } from '@/lib/matching';
import { emitDisc } from '@/lib/discEvents';
import { pullPostersForDiscs } from '@/lib/plexPosters';
import { FORMATS } from '@/lib/constants';
import { addFormatCopies } from '@/lib/discCopies';
import FormatPicker from '@/components/collection/FormatPicker';
import { Check } from 'lucide-react';

export default function ScanResultForm({ capture, onDone, onCancel }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: capture.title || '',
    year: capture.year ? String(capture.year) : '',
    formats: [FORMATS.includes(capture.format) ? capture.format : 'DVD'],
    location: '',
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function save() {
    const title = form.title.trim();
    if (!title) return;

    const formats = form.formats.length ? form.formats : ['DVD'];

    const draft = {
      id: `draft-${Date.now()}`,
      title,
      upc: capture.upc,
      year: form.year ? Number(form.year) : null,
      format: formats[0],
      location: form.location.trim(),
      cover_url: capture.image || '',
      plex_rating_key: null,
      plex_title: null,
    };

    emitDisc({ type: 'create', disc: draft });
    toast({ title: 'Added to your shelf', description: title });
    onDone();

    (async () => {
      try {
        const match = await findPlexMatch(title, form.year, form.format);
        const created = await base44.entities.Disc.create({
          title,
          upc: draft.upc,
          year: draft.year,
          format: draft.format,
          location: draft.location,
          cover_url: draft.cover_url,
          plex_rating_key: match?.rating_key || null,
          plex_title: match?.title || null,
        });
        emitDisc({ type: 'replace', id: draft.id, disc: created });

        const extra = formats.length > 1
          ? await addFormatCopies(
              {
                ...draft,
                plex_rating_key: match?.rating_key || null,
                plex_title: match?.title || null,
              },
              formats.slice(1)
            )
          : [];

        if (match && !draft.cover_url) {
          pullPostersForDiscs([created.id, ...extra.map((disc) => disc.id)]).catch(() => {});
        }
      } catch (error) {
        emitDisc({ type: 'remove', id: draft.id });
        toast({ variant: 'destructive', title: 'Could not save that disc', description: error.message });
      }
    })();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="h-28 w-[76px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {capture.image ? (
            <img src={capture.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-3xl text-muted-foreground/60">
                {(form.title || '?').charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="scan-title">Title</Label>
            <Input
              id="scan-title"
              value={form.title}
              placeholder="Couldn't read it — type the title"
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scan-year">Year</Label>
            <Input
              id="scan-year"
              inputMode="numeric"
              value={form.year}
              placeholder="1999"
              onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Formats</Label>
            <FormatPicker value={form.formats} onChange={(formats) => set('formats', formats)} />
            <p className="text-xs text-muted-foreground">Own it on more than one format? Tick them all.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scan-location">Where it lives</Label>
            <Input
              id="scan-location"
              placeholder="Optional"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-xs text-muted-foreground">
          {capture.upc ? `Barcode ${capture.upc}` : 'Added by title'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Scan another
          </Button>
          <Button onClick={save} disabled={!form.title.trim()}>
            <Check className="mr-2 h-4 w-4" />
            Add to shelf
          </Button>
        </div>
      </div>
    </div>
  );
}