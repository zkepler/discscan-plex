import { ArrowDown, Loader2 } from 'lucide-react';

export default function PullIndicator({ pull, refreshing, threshold = 70 }) {
  if (!pull && !refreshing) return null;
  const progress = Math.min(1, pull / threshold);

  return (
    <div
      className="flex items-center justify-center overflow-hidden text-muted-foreground"
      style={{ height: `${pull}px`, willChange: 'height' }}
      aria-hidden="true"
    >
      {refreshing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowDown
          className="h-4 w-4"
          style={{ opacity: progress, transform: `rotate(${progress * 180}deg)` }}
        />
      )}
    </div>
  );
}