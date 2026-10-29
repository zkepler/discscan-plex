export default function DiscCard({ disc, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(disc)} className="group block w-full text-left">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted shadow-lg shadow-black/30">
        {disc.cover_url ? (
          <img
            src={disc.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,hsl(var(--muted)),hsl(var(--card)))]">
            <span className="font-display text-5xl text-muted-foreground/50">
              {(disc.title || '?').charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3 pt-10">
          <p className="line-clamp-2 text-sm font-medium leading-tight text-white">{disc.title}</p>
          <p className="mt-1 text-[11px] text-white/60">
            {[disc.year || null, disc.format || null].filter(Boolean).join(' · ')}
          </p>
        </div>

        {disc.plex_rating_key ? (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Plex
          </span>
        ) : null}
      </div>
    </button>
  );
}