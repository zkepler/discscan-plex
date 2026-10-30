import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStyle } from '@/lib/mediaStyles';

// The season itself: your copies of it, plus the episodes Plex holds for it.
export default function SeasonDetails({ title, season, copies = [], config, plexKey, onOpenCopy, onPlex }) {
  const [details, setDetails] = useState(null);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  const connected = Boolean(config?.plex_url && config?.plex_token);

  useEffect(() => {
    if (!connected || !plexKey) {
      setState('offline');
      return undefined;
    }

    let active = true;
    setDetails(null);
    setError('');
    setState('loading');

    base44.functions
      .invoke('plexSeasonDetails', {
        plex_url: config.plex_url,
        plex_token: config.plex_token,
        rating_key: plexKey,
        season,
      })
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        if (data.error) throw new Error(data.error);
        setDetails(data.found ? data : null);
        setState(data.found ? 'ready' : 'empty');
      })
      .catch((failure) => {
        if (!active) return;
        setError(failure?.response?.data?.error || failure.message || 'Could not load that season from Plex.');
        setState('error');
      });

    return () => {
      active = false;
    };
  }, [connected, plexKey, season, config?.plex_url]);

  const meta = details?.season;
  const episodes = details?.episodes || [];

  return (
    <div className="space-y-3 border-t border-border/70 bg-muted/40 px-3 py-3">
      {copies.length ? (
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Your copies</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {copies.map((disc) => (
              <button
                key={disc.id}
                type="button"
                onClick={() => onOpenCopy?.(disc)}
                className={cn(
                  'rounded border px-2 py-1 text-xs uppercase tracking-[0.08em] transition-opacity hover:opacity-80',
                  formatStyle(disc.format || 'DVD')
                )}
              >
                {disc.format || 'DVD'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state === 'loading' ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading season {season} from Plex…
        </p>
      ) : null}

      {state === 'offline' ? (
        <p className="text-xs text-muted-foreground">
          {plexKey ? 'Connect Plex to see this season on your server.' : 'This show is not matched to a Plex title yet.'}
        </p>
      ) : null}

      {state === 'empty' ? (
        <p className="text-xs text-muted-foreground">Plex does not hold season {season}.</p>
      ) : null}

      {state === 'error' ? <p className="text-xs text-destructive">{error}</p> : null}

      {state === 'ready' && meta ? (
        <>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {meta.episode_count ? `${meta.episode_count} episodes` : 'Episodes in Plex'}
            {meta.watched_count ? ` · ${meta.watched_count} watched` : ''}
          </p>
          {meta.summary ? (
            <p className="text-sm leading-relaxed text-foreground">{meta.summary}</p>
          ) : null}
          {episodes.length ? (
            <ol className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {episodes.map((episode) => (
                <li
                  key={episode.key || episode.number}
                  className="flex items-start gap-2 rounded border border-border/70 bg-card/70 px-2 py-1.5"
                >
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{episode.number ?? '·'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{episode.title}</span>
                    {episode.summary ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                        {episode.summary}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {episode.watched ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : episode.runtime_minutes ? (
                      `${episode.runtime_minutes}m`
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Plex has no episodes filed for this season yet.</p>
          )}
        </>
      ) : null}

      {onPlex ? (
        <button
          type="button"
          onClick={() => onPlex(title)}
          className="text-xs font-semibold uppercase tracking-[0.1em] text-primary"
        >
          Open in Plex library
        </button>
      ) : null}
    </div>
  );
}