export default function StatsRow({ discs, inPlex, missing, plexCounts }) {
  const items = [
    { label: 'Discs on shelf', value: discs },
    { label: 'In Plex', value: inPlex },
    { label: 'Missing from Plex', value: missing },
    { label: 'Plex movies', value: plexCounts.movies },
    { label: 'Plex TV shows', value: plexCounts.shows },
    { label: 'Plex 4K movies', value: plexCounts.fourK },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border/70 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-4 py-4">
          <p className="font-display text-3xl leading-none text-foreground">{item.value}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}