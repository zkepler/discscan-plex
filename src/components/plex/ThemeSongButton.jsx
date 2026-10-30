import { useEffect, useState } from 'react';
import { Loader2, Music2, Pause } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTabActive } from '@/lib/tabActive';
import { cn } from '@/lib/utils';
import { loadThemeSong } from '@/lib/themeSongs';
import { playThemeSong, stopTheme, subscribeThemePlaying } from '@/lib/themePlayer';

export default function ThemeSongButton({ config, ratingKey, title }) {
  const { toast } = useToast();
  const [playingKey, setPlayingKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const tabActive = useTabActive();
  const playing = playingKey === ratingKey;

  useEffect(() => subscribeThemePlaying(setPlayingKey), []);

  // Music never keeps playing once the library tab is put away.
  useEffect(() => {
    if (!tabActive && playing) stopTheme();
  }, [tabActive, playing]);

  if (!config?.plex_url || !ratingKey || missing) return null;

  const toggle = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (playing) {
      stopTheme();
      return;
    }

    setLoading(true);
    try {
      const url = await loadThemeSong(config, ratingKey);
      if (!url) {
        setMissing(true);
        toast({ title: 'No theme song', description: `${title} has no theme music saved in Plex.` });
        return;
      }
      await playThemeSong(ratingKey, url);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not play that theme', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={playing ? `Pause the ${title} theme song` : `Play the ${title} theme song`}
      title={playing ? 'Pause theme song' : 'Play theme song'}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60',
        playing
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : playing ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Music2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}