import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Loader2 } from 'lucide-react';
import { pullMetadataForDiscs } from '@/lib/plexMetadata';

export default function PullMetadataButton({ config, onDone, disabled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const data = await pullMetadataForDiscs();
      toast({
        title: data.updated
          ? `Filled details for ${data.updated} disc${data.updated === 1 ? '' : 's'}`
          : 'No details to pull',
        description: data.updated
          ? data.updated >= 24
            ? 'Run it again to pick up the rest of your shelf.'
            : 'Discs that already had details were left alone.'
          : 'Every disc in Plex already has its cast, genres and synopsis.',
      });
      if (data.updated && onDone) await onDone();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not pull details',
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
      title={config?.plex_url ? 'Copy cast, genres and synopsis from Plex' : 'Connect Plex first'}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
      {busy ? 'Filling details…' : 'Plex details'}
    </Button>
  );
}