import { Check, CopyCheck, HelpCircle, Loader2, TriangleAlert } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

const STATUS = {
  saving: { icon: Loader2, className: 'text-muted-foreground', spin: true, label: 'Looking it up…' },
  saved: { icon: Check, className: 'text-emerald-500', label: 'Added to the shelf' },
  duplicate: { icon: CopyCheck, className: 'text-primary', label: 'Already on the shelf' },
  unknown: { icon: HelpCircle, className: 'text-muted-foreground', label: 'Not recognised' },
  failed: { icon: TriangleAlert, className: 'text-destructive', label: 'Could not save' },
};

// Running log of what the bulk scanner has just read, newest first.
export default function BulkScanLog({ rows }) {
  if (!rows.length) {
    return (
      <p className="py-1 text-sm text-muted-foreground">
        Nothing read yet. Hold a barcode in the frame and it lands here on its own.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {rows.map((row) => {
        const status = STATUS[row.status] || STATUS.saving;
        const Icon = status.icon;
        return (
          <li key={row.id} className="flex items-center gap-3 py-2">
            <div className="h-12 w-8 shrink-0 overflow-hidden rounded border border-border bg-muted">
              {row.cover_url ? <Image src={row.cover_url} alt="" className="h-full w-full" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{row.title || row.upc}</p>
              <p className={cn('truncate text-xs', status.className)}>
                {status.label}
                {row.year ? ` · ${row.year}` : ''}
                {row.format ? ` · ${row.format}` : ''}
              </p>
            </div>
            <Icon className={cn('h-4 w-4 shrink-0', status.className, status.spin && 'animate-spin')} />
          </li>
        );
      })}
    </ul>
  );
}