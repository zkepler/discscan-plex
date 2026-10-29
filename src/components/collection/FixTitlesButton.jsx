import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Wand2 } from 'lucide-react';
import { fixDiscTitles } from '@/lib/plexTitles';

export default function FixTitlesButton({ config, discs, onDone, disabled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const run = async () => {
    setBusy(true);
    setStatus('Reading your Plex server…');
    try {
      const result = await fixDiscTitles({
        config,
        discs,
        onProgress: ({ fetched, applied, total }) =>
          setStatus(
            applied != null
              ? `Saving ${applied} of ${total}…`
              : `${fetched || 0} Plex titles checked…`
          ),
      });

      toast({
        title: result.total
          ? `Updated ${result.total} disc${result.total === 1 ? '' : 's'}`
          : 'Everything already matches Plex',
        description: result.total
          ? `${result.renamed} renamed · ${result.linked} linked to Plex`
          : `${result.checked} discs checked against movies, 4K and TV shows.`,
      });

      if (result.total && onDone) await onDone();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not check Plex',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={run}
        disabled={disabled || busy || !config?.plex_url}
        title={config?.plex_url ? undefined : 'Connect Plex first'}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-4 w-4" />
        )}
        {busy ? 'Checking Plex…' : 'Fix titles'}
      </Button>
      {status ? (
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{status}</span>
      ) : null}
    </div>
  );
}