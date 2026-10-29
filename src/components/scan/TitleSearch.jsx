import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search } from 'lucide-react';

export default function TitleSearch({ onPick }) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const trimmed = query.trim();

  const search = async () => {
    if (trimmed.length < 2) return;
    setSearching(true);
    try {
      const response = await base44.functions.invoke('lookupBarcode', { query: trimmed });
      setResults(response.data?.results || []);
    } catch (error) {
      setResults([]);
      toast({ variant: 'destructive', title: 'Search failed', description: 'Try again in a moment.' });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Label htmlFor="title-search" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Search by title
      </Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="title-search"
          value={query}
          placeholder="The Matrix"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') search();
          }}
        />
        <Button variant="secondary" onClick={search} disabled={searching || trimmed.length < 2}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results ? (
        results.length ? (
          <ul className="mt-4 divide-y divide-border/70">
            {results.map((result, index) => (
              <li key={`${result.upc || result.title}-${index}`}>
                <button
                  type="button"
                  onClick={() => onPick(result)}
                  className="flex w-full select-none items-center gap-3 py-3 text-left transition-colors hover:text-primary"
                >
                  <span className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-muted">
                    {result.image ? (
                      <img src={result.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-lg text-muted-foreground/60">
                        {(result.title || '?').charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{result.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[result.year, result.format, result.upc].filter(Boolean).join(' · ') || 'Disc'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No catalogue match — add it manually below.</p>
        )
      ) : null}

      <Button
        variant="ghost"
        className="mt-3 w-full"
        disabled={trimmed.length < 2}
        onClick={() => onPick({ title: trimmed, upc: '', image: '', year: null })}
      >
        {trimmed ? `Add “${trimmed}” manually` : 'Add the title manually'}
      </Button>
    </div>
  );
}