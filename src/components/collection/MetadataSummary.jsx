const ROWS = [
  { label: 'Director', key: 'directors' },
  { label: 'Studio', key: 'studio' },
  { label: 'Runtime', key: 'runtime', suffix: ' min' },
  { label: 'Rated', key: 'rating' },
  { label: 'Genres', key: 'genres' },
  { label: 'Cast', key: 'cast' },
  { label: 'Edition', key: 'edition' },
];

export default function MetadataSummary({ form }) {
  const rows = ROWS.map((row) => ({
    ...row,
    value: String(form[row.key] || '').trim(),
  })).filter((row) => row.value);
  const plot = String(form.plot || '').trim();

  if (!rows.length && !plot) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        No details saved for this copy yet. Pull them from Plex, or tap Edit to type them in.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="min-w-0">
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {row.label}
            </dt>
            <dd className="text-sm text-foreground">
              {row.value}
              {row.suffix || ''}
            </dd>
          </div>
        ))}
      </dl>

      {plot ? (
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Synopsis</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{plot}</p>
        </div>
      ) : null}
    </div>
  );
}