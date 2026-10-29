import { useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { Camera, Loader2 } from 'lucide-react';

// iPhone Safari does not always hand a live stream to a web app (in-app
// browsers, standalone home-screen apps and some permission states refuse it),
// so the phone's own camera is used through a photo capture instead.
const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);

export default function PhotoScanButton({ onDetected }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setNote('');
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromImageUrl(url);
      onDetected?.(result.getText());
    } catch {
      setNote('No barcode in that photo — fill the frame with the barcode and try again.');
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {busy ? 'Reading photo…' : 'Use the iPhone camera'}
      </button>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}