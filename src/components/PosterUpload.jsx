import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { ImagePlus, Loader2 } from 'lucide-react';

export default function PosterUpload({ onUploaded, label = 'Add poster', compact = false }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast({ variant: 'destructive', title: 'That file will not work', description: 'Choose a PNG or JPG image.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'That image is too large', description: 'Pick one under 10 MB.' });
      return;
    }

    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onUploaded(file_url);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not upload that poster', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={pick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-70"
      >
        {compact ? null : busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
        <span className={compact ? 'text-xs font-medium' : 'text-xs leading-tight'}>
          {busy ? 'Uploading' : label}
        </span>
      </button>
    </>
  );
}