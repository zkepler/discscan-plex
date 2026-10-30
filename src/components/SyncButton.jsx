import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { runSync } from '@/lib/syncEvents';

export default function SyncButton() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await runSync();
      toast({ title: 'Synced', description: 'Pulled the latest from your account onto this device.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Sync failed', description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={sync}
      disabled={syncing}
      aria-label="Sync with all devices"
      className="select-none rounded-full"
    >
      <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
      <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
    </Button>
  );
}