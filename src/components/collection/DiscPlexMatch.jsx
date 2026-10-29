import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { escapeRegex, normalizeTitle } from '@/lib/matching';
import { Link2, Loader2, Unlink } from 'lucide-react';

const KIND_LABEL = { movie: 'Movie', '4k': '4K', show: 'TV show' };

export default function DiscPlexMatch({ discTitle, ratingKey, plexTitle, onLink, onUnlink }) {
  const [query, setQuery] = useState(discTitle || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setQuery(discTitle || '');
  }, [discTitle]);

  useEffect(() => {
    const key = normalizeTitle(query);
    if (!key) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const page = await base44.entities.PlexMovie.filter(
        { search_title: { $regex: escapeRegex(key) } },
        { limit: 8 }
      );
      if (!active) return;
      setResults(page.items || []);
      setSearching(false);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plex</Label>
        {ratingKey ? (
          <Button type="button" variant="ghost" size="sm" onClick={onUnlink}>
            <Unlink className="mr-1.5 h-3.5 w-3.5" />
            Not in Plex
          </Button>
        ) : (
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
            Not in Plex
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {ratingKey ? `Linked to “${plexTitle}”` : 'Search your Plex library and link the title by hand.'}
      </p>

      <Input
        value={query}
        placeholder="Search your Plex library"
        onChange={(event) => setQuery(event.target.value)}
      />

      {searching ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching Plex…
        </p>
      ) : null}

      {results.length ? (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {results.map((item) => {
            const active = String(item.rating_key) === String(ratingKey || '');
            return (
              <button
                key={item.id || item.rating_key}
                type="button"
                onClick={() => onLink({ rating_key: String(item.rating_key), title: item.title })}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-primary/15 text-foreground' : 'hover:bg-accent'
                }`}
              >
                <span className="truncate">
                  {item.title}
                  {item.year ? <span className="text-muted-foreground"> ({item.year})</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {KIND_LABEL[item.kind] || 'Title'}
                  <Link2 className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}