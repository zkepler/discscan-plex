import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { CameraOff } from 'lucide-react';
import CameraSelect from '@/components/scan/CameraSelect';
import { useTabActive } from '@/lib/tabActive';

// Continuity Camera (and other front-facing cameras) hand over a mirrored image.
const MIRRORED_CAMERA = /iphone|continuity|facetime|front/i;

export default function BarcodeScanner({ onDetected, paused }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const pausedRef = useRef(paused);
  const mirroredRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [mirrored, setMirrored] = useState(false);
  const [revision, setRevision] = useState(0);
  const tabActive = useTabActive();

  // iOS/iPadOS suspends the camera stream when Safari goes to the background,
  // so the preview is restarted once the app is visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRevision((count) => count + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  onDetectedRef.current = onDetected;
  pausedRef.current = paused;

  useEffect(() => {
    // Release the camera while another tab is showing.
    if (!tabActive) return undefined;

    let cancelled = false;
    let stream = null;
    let timer = null;
    const reader = new BrowserMultiFormatReader();
    const canvas = document.createElement('canvas');

    const drawFrame = (video, flip) => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (flip) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    const read = (video, flip) => {
      drawFrame(video, flip);
      try {
        const result = reader.decodeFromCanvas(canvas);
        return result ? result.getText() : '';
      } catch {
        return '';
      }
    };

    const start = async () => {
      setError('');
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('The camera needs a secure (https) connection. Type the barcode below.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: 'environment' } },
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera, or type the barcode below.'
            : 'No camera available here. Type the barcode below instead.'
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const flip = MIRRORED_CAMERA.test(stream.getVideoTracks()[0]?.label || '');
      mirroredRef.current = flip;
      setMirrored(flip);

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (cancelled) return;
      setReady(true);

      timer = setInterval(() => {
        const element = videoRef.current;
        if (pausedRef.current || !element || !element.videoWidth) return;
        // A mirrored frame hides the barcode, so read the flipped frame first.
        const passes = mirroredRef.current ? [true, false] : [false];
        for (const flipPass of passes) {
          const text = read(element, flipPass);
          if (text) {
            onDetectedRef.current?.(text);
            return;
          }
        }
      }, 250);
    };

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId, tabActive, revision]);

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
          autoPlay
          muted
          playsInline
        />

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
            <p className="absolute inset-x-0 bottom-3 text-center text-xs uppercase tracking-[0.2em] text-white/70">
              {ready ? 'Hold the barcode inside the frame' : 'Starting camera…'}
            </p>
          </>
        )}
      </div>

      <CameraSelect value={deviceId} onChange={setDeviceId} />
    </div>
  );
}