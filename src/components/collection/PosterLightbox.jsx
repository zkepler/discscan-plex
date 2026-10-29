import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export default function PosterLightbox({ src, title }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="h-32 w-[86px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {src ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Enlarge ${title || 'poster'}`}
            className="block h-full w-full select-none"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none [&>button]:text-white/80 [&>button]:hover:text-white">
          <DialogTitle className="sr-only">{title ? `${title} poster` : 'Poster'}</DialogTitle>
          <img
            src={src}
            alt={title || ''}
            onClick={() => setOpen(false)}
            className="max-h-[86dvh] w-auto max-w-[92vw] rounded-lg border border-white/10 object-contain shadow-2xl"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}