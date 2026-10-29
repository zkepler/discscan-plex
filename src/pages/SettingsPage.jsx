import PlexConnectCard from '@/components/settings/PlexConnectCard';
import AccountCard from '@/components/settings/AccountCard';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">One-time setup</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Connect Plex</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Paste your Plex token and Shelfmark finds your server, then pulls your movie, 4K and TV show libraries into
        the catalogue in one go.
      </p>

      <PlexConnectCard />

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Your token is stored with this app and only used to read your library. Shelfmark reaches the server through
        Plex Remote Access, so syncing works from anywhere — just turn Remote Access on in Plex → Settings, then run
        a sync whenever you add titles.
      </p>

      <AccountCard />
    </div>
  );
}