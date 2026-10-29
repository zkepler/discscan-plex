import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import ConnectStatus from '@/components/settings/ConnectStatus';
import { loadConfig, saveConfig } from '@/lib/appSettings';
import { findReachableServer, listMovieSections, normalizeBaseUrl } from '@/lib/plex';
import { syncPlexLibrary } from '@/lib/plexSync';
import { Loader2, Sparkles } from 'lucide-react';

export default function PlexConnectCard() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setConfig(cfg);
      setUrl(cfg?.plex_url || '');
      setToken(cfg?.plex_token || '');
    })();
  }, []);

  const discover = async () => {
    setBusy('find');
    setStatus(null);
    setProgress('Asking Plex for your servers…');
    try {
      const server = await findReachableServer(token.trim());
      setUrl(server.url);
      setStatus({ ok: true, message: `Found ${server.name}. Ready to import.` });
    } catch (error) {
      setStatus({ ok: false, message: error.message });
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const connect = async () => {
    setBusy('import');
    setStatus(null);
    const payload = { plex_url: normalizeBaseUrl(url), plex_token: token.trim() };
    try {
      setProgress('Checking your movie libraries…');
      const sections = await listMovieSections(payload);
      if (!sections.length) throw new Error('Connected, but this server has no movie libraries.');

      setConfig(await saveConfig(payload));
      setProgress('Importing titles…');
      const result = await syncPlexLibrary(payload, (count, section) =>
        setProgress(`Reading ${section} · ${count} titles`)
      );

      setStatus({
        ok: true,
        message: `Imported ${result.total} titles · ${result.matched} discs matched to Plex.`,
      });
      toast({ title: 'Plex connected', description: `${result.total} titles pulled into the catalogue.` });
      setConfig(await loadConfig());
    } catch (error) {
      setStatus({
        ok: false,
        message:
          error instanceof TypeError
            ? 'This browser could not reach that address. If it starts with http://, use the https://…plex.direct address from Plex → Settings → Remote Access.'
            : error.message || 'Could not reach that server.',
      });
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const working = Boolean(busy);

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <Label htmlFor="plex-token">Plex token</Label>
        <Input
          id="plex-token"
          type="password"
          value={token}
          placeholder="X-Plex-Token"
          onChange={(event) => setToken(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          In Plex Web, open any movie → ⋯ → Get Info → View XML. The token is the value after{' '}
          <span className="text-foreground">X-Plex-Token=</span> in the address bar.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plex-url">Server address</Label>
        <Input
          id="plex-url"
          value={url}
          placeholder="Find it automatically, or paste it here"
          onChange={(event) => setUrl(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave this empty and Shelfmark will locate your server from the token.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" onClick={discover} disabled={working || !token}>
          {busy === 'find' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Find my server
        </Button>
        <Button onClick={connect} disabled={working || !url || !token}>
          {busy === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy === 'import' ? 'Importing…' : 'Connect & import library'}
        </Button>
      </div>

      <ConnectStatus status={status} progress={progress} config={config} />
    </div>
  );
}