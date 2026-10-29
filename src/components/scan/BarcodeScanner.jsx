import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { CameraOff } from 'lucide-react';
import CameraSelect from '@/components/scan/CameraSelect';

export default function BarcodeScanner({ onDetected, paused }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const pausedRef = useRef(paused);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  onDetectedRef.current = onDetected;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let controls = null;
    const reader = new BrowserMultiFormatReader();
    setError('');
    setReady(false);

    reader
      .decodeFromConstraints(
        {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: 'environment' } },
        },
        videoRef.current,
        (result) => {
          if (!result || pausedRef.current) return;
          onDetectedRef.current?.(result.getText());
        }
      )
      .then((scannerControls) => {
        if (cancelled) {
          scannerControls.stop();
          return;
        }
        controls = scannerControls;
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera, or type the barcode below.'
            : 'No camera available here. Type the barcode below instead.'
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [deviceId]);

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-8 text-center">
            <CameraOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-4/5 rounded-lg border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <p className="absolute inset-x-0 bottom-3 text-center text-[11px] uppercase tracking-[0.2em] text-white/70">
              {ready ? 'Hold the barcode inside the frame' : 'Starting camera…'}
            </p>
          </>
        )}
      </div>

      <CameraSelect value={deviceId} onChange={setDeviceId} />
    </div>
  );
}