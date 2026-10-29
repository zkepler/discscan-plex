import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DiscPlexMatch from '@/components/collection/DiscPlexMatch';
import FormatPicker from '@/components/collection/FormatPicker';

export default function DiscForm({ disc, form, set, confirming, onSave, onRemove, onClose }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="h-32 w-[86px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {disc.cover_url ? <img src={disc.cover_url} alt="" className="h-full w-full object-cover" /> : null}
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              inputMode="numeric"
              value={form.year}
              onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Formats</Label>
        <FormatPicker value={form.formats} onChange={(formats) => set('formats', formats)} />
        <p className="text-xs text-muted-foreground">
          This copy keeps the first format — any others are added as extra copies.
        </p>
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
          onLink={(match) => {
            set('plex_rating_key', match.rating_key);
            set('plex_title', match.title);
          }}
          onUnlink={() => {
            set('plex_rating_key', '');
            set('plex_title', '');
          }}
        />
        {disc.upc ? <p className="text-xs text-muted-foreground">Barcode {disc.upc}</p> : null}
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-3">
        <Button
          variant={confirming ? 'destructive' : 'ghost'}
          size="sm"
          onClick={onRemove}
          className="select-none"
        >
          {confirming ? 'Confirm remove' : 'Remove'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="select-none">
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.title.trim()} className="select-none">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}