const listeners = new Set();

// Each screen registers a reload handler. The header sync button runs them all,
// so every screen pulls the latest data the account has on the server.
export function subscribeSync(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function runSync() {
  return Promise.all(Array.from(listeners).map((handler) => handler()));
}