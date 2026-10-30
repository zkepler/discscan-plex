// Every live camera stream the app holds, kept in one place so it can be
// stopped the moment the scanner is not on screen.
const streams = new Set();

// The camera the app has already been given, plus the request that is still
// waiting on the browser's permission prompt. Both are shared, so the prompt is
// shown once: a scanner that mounts later reuses the open camera instead of
// asking again.
let sharedKey = '';
let sharedStream = null;
let pendingKey = '';
let pendingRequest = null;

const isLive = (stream) =>
  !!stream && stream.getTracks().some((track) => track.readyState === 'live');

export function trackCameraStream(stream) {
  if (stream) streams.add(stream);
}

// The open stream for this camera, when the app already has it running.
export function sharedCameraStream(key) {
  return sharedStream && sharedKey === key && isLive(sharedStream) ? sharedStream : null;
}

// Asks the browser for the camera — or hands back the request that is already
// answering the permission prompt for that same camera.
export function requestCameraStream(key, config) {
  const open = sharedCameraStream(key);
  if (open) return Promise.resolve(open);
  if (pendingRequest && pendingKey === key) return pendingRequest;

  const request = navigator.mediaDevices.getUserMedia(config);
  pendingKey = key;
  pendingRequest = request;
  request.then(
    (stream) => {
      sharedKey = key;
      sharedStream = stream;
      trackCameraStream(stream);
      if (pendingRequest === request) {
        pendingKey = '';
        pendingRequest = null;
      }
    },
    () => {
      if (pendingRequest === request) {
        pendingKey = '';
        pendingRequest = null;
      }
    }
  );
  return request;
}

// Hands a camera the scanner is already using to every scanner that follows it.
export function shareCameraStream(key, stream) {
  sharedKey = key;
  sharedStream = stream;
  trackCameraStream(stream);
}

export function stopAllCameraStreams() {
  streams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  streams.clear();
  sharedKey = '';
  sharedStream = null;
  pendingKey = '';
  pendingRequest = null;
}