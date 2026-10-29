import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { findPlexMatch } from '@/lib/matching';
import { FORMATS } from '@/lib/constants';
import { Check } from 'lucide-react';

export default function ScanResultForm({ capture, onDone, onCancel }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: capture.title || '',
    year: '',
    format: 'DVD',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const match = await findPlexMatch(form.title.trim(), form.year);
    await base44.entities.Disc.create({
      title: form.title.trim(),
      upc: capture.upc,
      year: form.year ? Number(form.year) : null,
      format: form.format,
      location: form.location.trim(),
      cover_url: capture.image || '',
      plex_rating_key: match?.rating_key || null,
      plex_title: match?.title || null,
    });
    setSaving(false);
    toast({
      title: 'Added to your shelf',
      description: match ? `${form.title.trim()} · matched in Plex` : form.title.trim(),
    });
    onDone();
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

          <div className="grid grid-cols-2 gap-3">
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
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(value) => set('format', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        <p className="text-xs text-muted-foreground">Barcode {capture.upc}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Scan another
          </Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            <Check className="mr-2 h-4 w-4" />
            {saving ? 'Adding…' : 'Add to shelf'}
          </Button>
        </div>
      </div>
    </div>
  );
}