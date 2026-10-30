// Every live camera stream the app holds, kept in one place so it can be
// stopped the moment the scanner is not on screen.
const streams = new Set();

export function trackCameraStream(stream) {
  if (stream) streams.add(stream);
}

export function stopAllCameraStreams() {
  streams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  streams.clear();
}