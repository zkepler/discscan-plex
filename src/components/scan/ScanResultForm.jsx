import { useEffect, useState } from 'react';
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
import { filmCopies } from '@/lib/duplicates';
import { normaliseMetadata } from '@/lib/discMetadata';
import FormatPicker from '@/components/collection/FormatPicker';
import MovieDetailsCard from '@/components/scan/MovieDetailsCard';
import { Check } from 'lucide-react';

export default function ScanResultForm({ capture, onDone, onCancel }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: capture.title || '',
    year: capture.year ? String(capture.year) : '',
    formats: [FORMATS.includes(capture.format) ? capture.format : 'DVD'],
    location: '',
  });

  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const poster = capture.image || capture.details?.poster || '';

  // Catalogue details can arrive after the form mounts — fill only fields the user has not touched.
  useEffect(() => {
    const details = capture.details;
    if (!details) return;
    setForm((prev) => ({
      ...prev,
      title: prev.title || details.title || '',
      year: prev.year || (details.year ? String(details.year) : ''),
    }));
  }, [capture.details]);

  async function save() {
    if (saving) return;
    const title = form.title.trim();
    if (!title) return;

    const year = form.year ? Number(form.year) : null;
    const picked = form.formats.length ? form.formats : ['DVD'];
    let draft = null;

    setSaving(true);

    try {
      // A copy of a film already on the shelf joins that entry instead of making a second one.
      const shelf = await base44.entities.Disc.list();
      const owned = filmCopies(shelf, { title, year }).map((disc) => disc.format);
      const formats = picked.filter((format) => !owned.includes(format));

      if (!formats.length) {
        toast({
          title: 'Already on your shelf',
          description: `${title} · ${owned.join(', ')}`,
        });
        return;
      }

      draft = {
        id: `draft-${Date.now()}`,
        title,
        upc: capture.upc,
        year,
        format: formats[0],
        location: form.location.trim(),
        cover_url: poster,
        plex_rating_key: null,
        plex_title: null,
      };

      emitDisc({ type: 'create', disc: draft });
      toast({ title: 'Added to your shelf', description: title });
      onDone();

      const match = await findPlexMatch(title, year, formats[0]);
      const meta = normaliseMetadata(capture.details);
      const created = await base44.entities.Disc.create({
        title,
        upc: draft.upc,
        year: draft.year || meta.year || null,
        format: draft.format,
        location: draft.location,
        cover_url: draft.cover_url,
        plex_rating_key: match?.rating_key || null,
        plex_title: match?.title || null,
        directors: meta.directors || [],
        studio: meta.studio || '',
        runtime_minutes: meta.runtime_minutes ?? null,
        genres: meta.genres || [],
        rating: meta.rating || '',
        cast: meta.cast || [],
        plot: meta.plot || '',
        edition: meta.edition || '',
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
      if (draft) emitDisc({ type: 'remove', id: draft.id });
      toast({ variant: 'destructive', title: 'Could not save that disc', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="h-28 w-[76px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {poster ? (
            <img src={poster} alt="" className="h-full w-full object-cover" />
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

      <MovieDetailsCard details={capture.details} loading={capture.detailsPending} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-xs text-muted-foreground">
          {capture.upc ? `Barcode ${capture.upc}` : 'Added by title'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Scan another
          </Button>
          <Button onClick={save} disabled={!form.title.trim() || saving}>
            <Check className="mr-2 h-4 w-4" />
            Add to shelf
          </Button>
        </div>
      </div>
    </div>
  );
}