import { ExternalLink } from 'lucide-react';

export default function DiscExternalLinks({ title, year }) {
  const query = [title, year].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const links = [
    {
      label: 'IMDb',
      href: `https://www.imdb.com/find/?q=${encodeURIComponent(query)}&s=tt&ttype=ft`,
    },
    {
      label: 'TMDb',
      href: `https://www.themoviedb.org/search?query=${encodeURIComponent(query)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Look up</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {link.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}