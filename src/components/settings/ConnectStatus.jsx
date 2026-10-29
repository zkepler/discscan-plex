import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function ConnectStatus({ status, progress, config }) {
  return (
    <div className="space-y-3">
      {progress ? (
        <p className="flex items-center gap-2 text-xs text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {progress}
        </p>
      ) : null}

      {status ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            status.ok
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {status.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{status.message}</span>
        </div>
      ) : null}

      {config?.last_sync ? (
        <p className="text-xs text-muted-foreground">
          Last imported {new Date(config.last_sync).toLocaleString()} ·{' '}
          <Link to="/plex" className="text-primary hover:underline">
            View your Plex library
          </Link>
        </p>
      ) : null}
    </div>
  );
}