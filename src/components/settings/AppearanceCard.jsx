import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/ThemeProvider';

const OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-xl text-foreground">Appearance</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose how Shelfmark looks. System follows your device setting.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-border p-1">
        {OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            className={cn(
              'flex select-none items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs transition-colors',
              theme === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}