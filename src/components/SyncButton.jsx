import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { loadConfig } from '@/lib/appSettings';
import { syncPlexLibrary } from '@/lib/plexSync';
import { runSync } from '@/lib/syncEvents';

export default function SyncButton() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    setProgress('');
    try {
      const config = await loadConfig();
      let pulled = null;

      // Pull the newest titles from the Plex server first, then reload every
      // screen from the account so all devices show the same thing.
      if (config?.plex_url) {
        try {
          pulled = await syncPlexLibrary(config, (count, section) =>
            setProgress(`${section} · ${count.toLocaleString()} titles`)
          );
        } catch (error) {
          toast({ variant: 'destructive', title: 'Plex sync failed', description: error.message });
        }
      }

      await runSync();

      if (pulled) {
        toast({
          title: 'Synced',
          description: `${pulled.total.toLocaleString()} Plex titles · ${pulled.matched} discs matched`,
        });
      } else if (!config?.plex_url) {
        toast({
          title: 'Synced',
          description: 'Pulled the latest from your account onto this device.',
        });
      }
    } finally {
      setSyncing(false);
      setProgress('');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={sync}
      disabled={syncing}
      title={progress || 'Sync your collection and Plex library'}
      aria-label="Sync your collection and Plex library"
      className="select-none rounded-full"
    >
      <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
      <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
    </Button>
  );
}