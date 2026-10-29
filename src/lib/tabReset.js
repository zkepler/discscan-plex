import { useEffect, useRef } from 'react';

const handlers = new Map();

export function reselectTab(path) {
  handlers.get(path)?.forEach((handler) => handler());
}

function subscribe(path, handler) {
  const set = handlers.get(path) || new Set();
  set.add(handler);
  handlers.set(path, set);
  return () => set.delete(handler);
}

// Runs the handler when the tab for `path` is tapped again while already active.
export function useTabReselect(path, handler) {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => subscribe(path, () => latest.current()), [path]);
}