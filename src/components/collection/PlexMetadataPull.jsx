import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { findPlexMatch } from '@/lib/matching';
import { normaliseMetadata } from '@/lib/discMetadata';
import { Download, Loader2 } from 'lucide-react';

export default function PlexMetadataPull({ title, year, format, ratingKey, onMetadata }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function pull() {
    if (busy) return;
    setBusy(true);
    setNote('');

    try {
      const configs = await base44.entities.PlexConfig.list();
      const config = configs[0];
      if (!config?.plex_url || !config?.plex_token) {
        throw new Error('Connect your Plex server in Settings first.');
      }

      let key = String(ratingKey || '');
      if (!key) {
        const match = await findPlexMatch(title, year ? Number(year) : null, format);
        if (!match) throw new Error('No copy of this title in your Plex library.');
        key = String(match.rating_key);
      }

      const response = await base44.functions.invoke('plexDetails', {
        plex_url: config.plex_url,
        plex_token: config.plex_token,
        rating_key: key,
      });
      const data = response?.data || {};
      if (data.error) throw new Error(data.error);
      if (!data.found) throw new Error('Plex has no details for that item.');

      const patch = normaliseMetadata(data.metadata);
      if (!Object.keys(patch).length) throw new Error('Plex had nothing to add.');

      onMetadata(patch);
      setNote('Filled from Plex');
    } catch (error) {
      setNote(
        error?.response?.data?.error || error.message || 'Could not pull details from Plex.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={pull}
        disabled={busy || !String(title || '').trim()}
        className="select-none"
      >
        {busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" />
        )}
        Pull from Plex
      </Button>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}