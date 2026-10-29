import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FORMATS } from '@/lib/constants';
import DiscPlexMatch from '@/components/collection/DiscPlexMatch';

export default function DiscDialog({ disc, onClose, onChange }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!disc) {
      setForm(null);
      return;
    }
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
  }, [disc]);

  if (!disc || !form) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    await base44.entities.Disc.update(disc.id, {
      title: form.title.trim(),
      year: form.year ? Number(form.year) : null,
      format: form.format,
      location: form.location.trim(),
      notes: form.notes.trim(),
      plex_rating_key: form.plex_rating_key || null,
      plex_title: form.plex_rating_key ? form.plex_title || null : null,
    });
    setSaving(false);
    await onChange();
    onClose();
  }

  async function remove() {
    await base44.entities.Disc.delete(disc.id);
    await onChange();
    onClose();
  }

  return (
    <Dialog open={!!disc} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Disc details</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="h-32 w-[86px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {disc.cover_url ? (
              <img src={disc.cover_url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>

          <div className="flex-1 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  inputMode="numeric"
                  value={form.year}
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
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="location">Where it lives</Label>
            <Input
              id="location"
              placeholder="Shelf 3, living room"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <DiscPlexMatch
            discTitle={form.title}
            ratingKey={form.plex_rating_key}
            plexTitle={form.plex_title}
            onLink={(match) =>
              setForm((prev) => ({ ...prev, plex_rating_key: match.rating_key, plex_title: match.title }))
            }
            onUnlink={() => setForm((prev) => ({ ...prev, plex_rating_key: '', plex_title: '' }))}
          />
          {disc.upc ? <p className="text-xs text-muted-foreground">Barcode {disc.upc}</p> : null}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant={confirming ? 'destructive' : 'ghost'}
            size="sm"
            onClick={() => (confirming ? remove() : setConfirming(true))}
          >
            {confirming ? 'Confirm remove' : 'Remove'}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}