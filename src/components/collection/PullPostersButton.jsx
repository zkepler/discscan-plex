import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ImageDown, Loader2 } from 'lucide-react';
import { pullPostersForDiscs } from '@/lib/plexPosters';

export default function PullPostersButton({ onDone, disabled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const run = async () => {
    setBusy(true);
    setDone(0);
    try {
      const data = await pullPostersForDiscs(undefined, (step) => setDone(step.updated));
      toast({
        title: data.updated
          ? `Refreshed ${data.updated} poster${data.updated === 1 ? '' : 's'}`
          : 'No posters found',
        description: data.updated
          ? 'Movie, TV show and 4K posters were taken from Plex, with the web as a fallback.'
          : 'Plex and the web had no poster artwork for those titles.',
      });
      if (data.updated && onDone) await onDone();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not fetch posters',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setBusy(false);
      setDone(0);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={run}
      disabled={disabled || busy}
      title="Replace shelf artwork with movie, TV show and 4K posters from Plex, with the web as a fallback"
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
      {busy ? (done ? `Fetching ${done}…` : 'Fetching posters…') : 'Fetch posters'}
    </Button>
  );
}