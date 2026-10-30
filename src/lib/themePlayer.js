// One theme at a time: starting another title stops whatever was playing.
let current = null;
const listeners = new Set();

function emit() {
  const playingKey = current?.key || null;
  listeners.forEach((listener) => listener(playingKey));
}

export function subscribeThemePlaying(listener) {
  listeners.add(listener);
  listener(current?.key || null);
  return () => {
    listeners.delete(listener);
  };
}

export function stopTheme() {
  if (!current) return;
  const { audio } = current;
  current = null;
  audio.pause();
  emit();
}

export async function playThemeSong(key, url) {
  if (current?.key === key) {
    stopTheme();
    return;
  }
  stopTheme();

  const audio = new Audio(url);
  const entry = { key, audio };
  current = entry;
  audio.addEventListener('ended', () => {
    if (current === entry) stopTheme();
  });

  emit();
  try {
    await audio.play();
  } catch (error) {
    if (current === entry) stopTheme();
    throw error;
  }
}