const listeners = new Set();

export function subscribeDiscs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDisc(change) {
  listeners.forEach((listener) => listener(change));
}