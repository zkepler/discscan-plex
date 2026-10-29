import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { loadConfig, saveConfig } from '@/lib/appSettings';
import { listMovieSections, normalizeBaseUrl } from '@/lib/plex';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setConfig(cfg);
      setUrl(cfg?.plex_url || '');
      setToken(cfg?.plex_token || '');
    })();
  }, []);

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const sections = await listMovieSections({ plex_url: url, plex_token: token.trim() });
      setStatus({
        ok: true,
        message: sections.length
          ? `Connected. Movie libraries: ${sections.map((section) => section.title).join(', ')}`
          : 'Connected, but no movie libraries were found on this server.',
      });
    } catch (error) {
      setStatus({ ok: false, message: error.message || 'Could not reach that server.' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const saved = await saveConfig({
      plex_url: normalizeBaseUrl(url),
      plex_token: token.trim(),
    });
    setConfig(saved);
    setSaving(false);
    toast({ title: 'Plex settings saved', description: 'Head to the Plex tab and run a sync.' });
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">One-time setup</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Connect Plex</h1>

      <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="plex-url">Plex server address</Label>
          <Input
            id="plex-url"
            value={url}
            placeholder="https://192-168-1-20.abc123.plex.direct:32400"
            onChange={(event) => setUrl(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Use the secure <span className="text-foreground">https://…plex.direct:32400</span> address shown in Plex
            under Settings → Remote Access. Browsers block plain http addresses from a secure page.
          </p>
        </div>

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
            In Plex Web, open any item → ⋯ → Get Info → View XML. The token is the value after{' '}
            <span className="text-foreground">X-Plex-Token=</span> in the address bar.
          </p>
        </div>

        {status ? (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              status.ok
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {status.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="outline" onClick={test} disabled={testing || !url || !token}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test connection
          </Button>
          <Button onClick={save} disabled={saving || !url || !token}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {config?.last_sync ? (
            <Link to="/plex" className="ml-auto text-xs uppercase tracking-widest text-primary hover:underline">
              Go sync
            </Link>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Your token is only used to read your library. Syncing runs in your browser, so it works whenever this page can
        reach the server — on your home network or through Plex Remote Access.
      </p>
    </div>
  );
}