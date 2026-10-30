import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil } from 'lucide-react';
import DiscPlexMatch from '@/components/collection/DiscPlexMatch';
import DiscExternalLinks from '@/components/collection/DiscExternalLinks';
import FormatPicker from '@/components/collection/FormatPicker';
import PosterLightbox from '@/components/collection/PosterLightbox';
import PosterUpload from '@/components/PosterUpload';
import MetadataSummary from '@/components/collection/MetadataSummary';
import MetadataFields from '@/components/collection/MetadataFields';
import MetadataImport from '@/components/collection/MetadataImport';
import PlexMetadataPull from '@/components/collection/PlexMetadataPull';

export default function DiscForm({
  disc,
  form,
  set,
  confirming,
  onSave,
  onRemove,
  onClose,
  onMetadata,
  startEditingMeta,
}) {
  const [editingMeta, setEditingMeta] = useState(!!startEditingMeta);

  useEffect(() => {
    setEditingMeta(!!startEditingMeta);
  }, [startEditingMeta, disc.id]);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-[86px] shrink-0 space-y-1">
          {form.cover_url || disc.cover_url ? (
            <PosterLightbox src={form.cover_url || disc.cover_url} title={form.title} />
          ) : (
            <div className="h-32 overflow-hidden rounded-md border border-border bg-muted">
              <PosterUpload onUploaded={(url) => set('cover_url', url)} />
            </div>
          )}
          {form.cover_url || disc.cover_url ? (
            <div className="h-7 overflow-hidden rounded-md border border-border bg-muted">
              <PosterUpload
                label="Replace"
                compact
                onUploaded={(url) => set('cover_url', url)}
              />
            </div>
          ) : null}
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

      <div className="space-y-3 border-t border-border/70 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg leading-none text-foreground">Metadata &amp; rich details</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cast, synopsis and release details for this copy.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditingMeta((value) => !value)}
            className="select-none"
          >
            {editingMeta ? null : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
            {editingMeta ? 'Done' : 'Edit'}
          </Button>
        </div>

        <PlexMetadataPull
          title={form.title}
          year={form.year}
          format={form.formats[0]}
          ratingKey={form.plex_rating_key}
          onMetadata={onMetadata}
        />

        {editingMeta ? (
          <>
            <MetadataImport
              onImport={(patch) => onMetadata(patch)}
              onCover={(url) => set('cover_url', url)}
            />
            <MetadataFields form={form} set={set} />
          </>
        ) : (
          <MetadataSummary form={form} />
        )}
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
        <DiscExternalLinks title={form.title} year={form.year} />
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