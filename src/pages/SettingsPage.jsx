import PlexConnectCard from '@/components/settings/PlexConnectCard';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">One-time setup</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-foreground sm:text-5xl">Connect Plex</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Paste your Plex token and Shelfmark finds your server, then pulls your whole movie library into the
        catalogue in one go.
      </p>

      <PlexConnectCard />

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Your token is stored with this app and only used to read your library. Importing runs from this browser, so
        it needs to be able to reach the server — on your home network or through Plex Remote Access. Run it again
        whenever you add titles to Plex.
      </p>
    </div>
  );
}