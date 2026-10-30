import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { CameraOff, FlipHorizontal2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CameraSelect from '@/components/scan/CameraSelect';
import PhotoScanButton from '@/components/scan/PhotoScanButton';
import { useTabActive } from '@/lib/tabActive';
import { trackCameraStream } from '@/lib/cameraStreams';

// Continuity Camera (and other front-facing cameras) hand over a mirrored image.
const MIRRORED_CAMERA = /iphone|continuity|facetime|front/i;
const ROTATE_KEY = 'shelfmark-scanner-rotated';
const MIRROR_KEY = 'shelfmark-scanner-mirrored';

// Stopping the tracks alone leaves Safari holding the camera while the video
// element still references the stream, so the element is cleared as well.
const releaseCamera = (element, stream) => {
  stream?.getTracks().forEach((track) => track.stop());
  if (!element) return;
  try {
    element.pause();
  } catch {
    /* ignore */
  }
  if (element.srcObject) element.srcObject = null;
};

// null means "let the camera label decide".
const storedMirrorPref = () => {
  try {
    const value = localStorage.getItem(MIRROR_KEY);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
};
// iPads hand over large frames; decoding a downscaled copy keeps scanning snappy.
const MAX_DECODE_WIDTH = 1280;

// iPadOS keeps the camera busied for a moment after a stream is released, and
// only some iPads accept an exact rear-camera request — so constraints are
// tried in turn instead of failing on the first refusal.
const cameraAttempts = (deviceId) =>
  deviceId
    ? [{ deviceId: { exact: deviceId } }, { deviceId }, { facingMode: { ideal: 'environment' } }]
    : [
        { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { facingMode: { ideal: 'environment' } },
        true,
      ];

export default function BarcodeScanner({ onDetected, paused }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const pausedRef = useRef(paused);
  const mirrorOverrideRef = useRef(storedMirrorPref());
  const mirroredRef = useRef(false);
  const rotatedRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [mirrored, setMirrored] = useState(false);
  const [rotated, setRotated] = useState(() => {
    try {
      return localStorage.getItem(ROTATE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [cameraOn, setCameraOn] = useState(true);
  const tabActive = useTabActive();
  const liveRef = useRef({ stream: null, video: null });
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');

  // Switching to another tab, or leaving the app, releases the camera at once.
  useEffect(() => {
    if (tabActive && !hidden) return;
    releaseCamera(liveRef.current.video, liveRef.current.stream);
    liveRef.current = { stream: null, video: null };
  }, [tabActive, hidden]);

  // Front-facing cameras hand over a flipped image; this reverses it either way.
  const toggleMirror = () => {
    const next = !mirroredRef.current;
    mirroredRef.current = next;
    mirrorOverrideRef.current = next;
    setMirrored(next);
    try {
      localStorage.setItem(MIRROR_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  // Some iPhone camera streams (notably in desktop-site mode) arrive upside down.
  const toggleRotation = () => {
    const next = !rotatedRef.current;
    rotatedRef.current = next;
    setRotated(next);
    try {
      localStorage.setItem(ROTATE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  // iOS/iPadOS suspends the camera stream when Safari goes to the background;
  // the camera is released there and started again once the app is visible.
  useEffect(() => {
    const onVisible = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  onDetectedRef.current = onDetected;
  pausedRef.current = paused;
  rotatedRef.current = rotated;

  useEffect(() => {
    // Release the camera while another tab is showing, the app is in the
    // background, or the camera is switched off.
    if (!tabActive || !cameraOn || hidden) return undefined;

    let cancelled = false;
    let stream = null;
    let videoEl = null;
    let timer = null;
    let lastError = null;
    const reader = new BrowserMultiFormatReader();
    const canvas = document.createElement('canvas');

    const drawFrame = (video, flip) => {
      const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (rotatedRef.current) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate(Math.PI);
      }
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
        for (const video of cameraAttempts(deviceId)) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video });
              break;
            } catch (err) {
              lastError = err;
              // A blocked permission is final; a busy camera just needs a breather.
              if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') throw err;
              if (err?.name !== 'NotReadableError' && err?.name !== 'AbortError') break;
              await new Promise((resolve) => setTimeout(resolve, 350));
            }
          }
          if (stream || cancelled) break;
        }
        if (!stream) throw lastError;
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera, or type the barcode below.'
            : err?.name === 'NotReadableError'
              ? 'The camera is in use by another app. Close it and try again, or type the barcode below.'
              : 'No camera available here. Type the barcode below instead.'
        );
        return;
      }

      if (cancelled) {
        releaseCamera(videoRef.current, stream);
        return;
      }
      liveRef.current = { stream, video: videoRef.current };
      trackCameraStream(stream);

      const detected = MIRRORED_CAMERA.test(stream.getVideoTracks()[0]?.label || '');
      const flip = mirrorOverrideRef.current ?? detected;
      mirroredRef.current = flip;
      setMirrored(flip);

      const video = videoRef.current;
      if (!video) {
        releaseCamera(null, stream);
        return;
      }
      videoEl = video;
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
      // Leaving the tab (or the page) releases the camera completely.
      releaseCamera(videoEl || liveRef.current.video || videoRef.current, liveRef.current.stream || stream);
      liveRef.current = { stream: null, video: null };
    };
  }, [deviceId, tabActive, cameraOn, hidden]);

  // Nothing keeps a camera preview alive while another tab is showing.
  if (!tabActive) return null;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{
            transform: `rotate(${rotated ? 180 : 0}deg) scaleX(${mirrored ? -1 : 1})`,
          }}
          autoPlay
          muted
          playsInline
        />

        {cameraOn ? (
          <button
            type="button"
            onClick={() => setCameraOn(false)}
            aria-label="Turn camera off"
            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
          >
            <CameraOff className="h-4 w-4" />
          </button>
        ) : null}

        {!cameraOn ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-8 text-center">
            <CameraOff className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Camera is off.</p>
            <Button size="sm" variant="secondary" onClick={() => setCameraOn(true)}>
              Turn camera on
            </Button>
          </div>
        ) : error ? (
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
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMirror}
                className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
                Flip
              </button>
              <button
                type="button"
                onClick={toggleRotation}
                className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rotate
              </button>
            </div>
          </>
        )}
      </div>

      <CameraSelect value={deviceId} onChange={setDeviceId} refreshKey={ready} />
      <PhotoScanButton onDetected={onDetected} />
    </div>
  );
}