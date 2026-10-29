import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ImageDown, Loader2 } from 'lucide-react';
import { pullPostersForDiscs } from '@/lib/plexPosters';

export default function PullPostersButton({ config, onDone, disabled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const data = await pullPostersForDiscs();
      toast({
        title: data.updated
          ? `Pulled ${data.updated} poster${data.updated === 1 ? '' : 's'} from Plex`
          : 'No posters to pull',
        description: data.updated
          ? 'Titles already covered were left alone.'
          : 'Every disc linked to Plex already has its poster.',
      });
      if (data.updated && onDone) await onDone();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not pull posters',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={run}
      disabled={disabled || busy || !config?.plex_url}
      title={config?.plex_url ? 'Copy posters from Plex onto your shelf' : 'Connect Plex first'}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
      {busy ? 'Pulling posters…' : 'Plex posters'}
    </Button>
  );
}