import { useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// iPhone Safari does not always hand a live stream to a web app (in-app
// browsers, standalone home-screen apps and some permission states refuse it),
// so the phone's own camera is used through a photo capture instead.
const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);

export default function PhotoScanButton({ onDetected, onIdentified }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // A case with no barcode (or a sleeve the scanner cannot read) is identified
  // from the photo of the cover instead.
  const readCover = async (file) => {
    setNote('No barcode in that photo — reading the cover…');
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    const response = await base44.functions.invoke('identifyFromPhoto', { file_uri });
    const data = response.data || {};
    if (data.found && data.title) {
      setNote('');
      onIdentified?.(data);
      return;
    }
    setNote('Could not make out the cover — fill the frame with the front of the case and try again.');
  };

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
      await readCover(file).catch(() =>
        setNote('Could not read that photo — try again with the barcode or the cover in the frame.')
      );
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