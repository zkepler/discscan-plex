import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function MetadataFields({ form, set }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="meta-directors">Director</Label>
          <Input
            id="meta-directors"
            placeholder="Ridley Scott"
            value={form.directors}
            onChange={(e) => set('directors', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-studio">Studio</Label>
          <Input
            id="meta-studio"
            placeholder="Warner Bros."
            value={form.studio}
            onChange={(e) => set('studio', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-runtime">Runtime (minutes)</Label>
          <Input
            id="meta-runtime"
            inputMode="numeric"
            placeholder="117"
            value={form.runtime}
            onChange={(e) => set('runtime', e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-rating">Rated</Label>
          <Input
            id="meta-rating"
            placeholder="PG-13"
            value={form.rating}
            onChange={(e) => set('rating', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-genres">Genres</Label>
          <Input
            id="meta-genres"
            placeholder="Sci-Fi, Drama"
            value={form.genres}
            onChange={(e) => set('genres', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-edition">Edition</Label>
          <Input
            id="meta-edition"
            placeholder="Director's Cut"
            value={form.edition}
            onChange={(e) => set('edition', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-cast">Cast</Label>
        <Input
          id="meta-cast"
          placeholder="Harrison Ford, Sean Young"
          value={form.cast}
          onChange={(e) => set('cast', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-plot">Synopsis</Label>
        <Textarea
          id="meta-plot"
          rows={3}
          placeholder="What the film is about"
          value={form.plot}
          onChange={(e) => set('plot', e.target.value)}
        />
      </div>

      <p className="text-xs text-muted-foreground">Separate multiple names or genres with commas.</p>
    </div>
  );
}