import { useEffect, useRef, useState } from 'react';

// Tracks a downward drag from the top of the page and fires onRefresh past the threshold.
export function usePullToRefresh(onRefresh, { threshold = 70, disabled = false } = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const handler = useRef(onRefresh);
  handler.current = onRefresh;

  const update = (value) => {
    pullRef.current = value;
    setPull(value);
  };

  useEffect(() => {
    if (disabled) return undefined;

    const onStart = (event) => {
      if (busyRef.current || event.touches.length !== 1 || window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0].clientY;
    };

    const onMove = (event) => {
      if (startY.current == null) return;
      if (window.scrollY > 0) {
        startY.current = null;
        update(0);
        return;
      }
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        update(0);
        return;
      }
      update(Math.min(threshold * 1.6, delta * 0.5));
    };

    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current < threshold) {
        update(0);
        return;
      }
      busyRef.current = true;
      setRefreshing(true);
      update(threshold);
      try {
        await handler.current?.();
      } finally {
        busyRef.current = false;
        setRefreshing(false);
        update(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled, threshold]);

  return { pull, refreshing, threshold };
}