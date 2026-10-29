import { NavLink, Outlet } from 'react-router-dom';
import { History as HistoryIcon, Library, ScanLine, Tv, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Collection', icon: Library },
  { to: '/scan', label: 'Scan', icon: ScanLine },
  { to: '/plex', label: 'Plex', icon: Tv },
  { to: '/history', label: 'Recently Added', short: 'Recent', icon: HistoryIcon },
  { to: '/settings', label: 'Setup', icon: Settings },
];

export default function AppLayout() {
  return (
    <div className="app-surface min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <NavLink to="/" className="flex items-baseline gap-3">
            <span className="font-display text-2xl leading-none tracking-tight text-foreground">Shelfmark</span>
            <span className="hidden text-[10px] uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Disc &amp; Plex archive
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex select-none items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 sm:pb-16">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, short, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex select-none flex-col items-center gap-1 px-1 py-2.5 text-center text-[10px] uppercase tracking-wider',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <Icon className="h-5 w-5" />
              {short || label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}