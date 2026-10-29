import { cn } from '@/lib/utils';
import { FORMATS } from '@/lib/constants';
import { formatBannerStyle } from '@/lib/mediaStyles';

// Multi-select chips: every format you own for one film.
export default function FormatPicker({ value = [], onChange, formats = FORMATS }) {
  const toggle = (format) =>
    onChange(value.includes(format) ? value.filter((item) => item !== format) : [...value, format]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((format) => {
        const selected = value.includes(format);
        return (
          <button
            key={format}
            type="button"
            onClick={() => toggle(format)}
            className={cn(
              'select-none rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] transition-colors',
              selected
                ? formatBannerStyle(format)
                : 'border border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {format}
          </button>
        );
      })}
    </div>
  );
}