// A short, soft two-note chime for a recognised barcode.
//
// iPhone and iPad block all audio until the page has had one real tap, and they
// also keep Web Audio silent when the ring/silent switch is on. So the chime is
// an actual audio element (which iOS plays regardless of the switch), unlocked
// on the first touch, with the Web Audio version kept as a fallback.

const SAMPLE_RATE = 22050;
const CHIME_SECONDS = 0.62;

const buildWav = () => {
  const total = Math.floor(SAMPLE_RATE * CHIME_SECONDS);
  const data = new Int16Array(total);
  const notes = [
    { freq: 880, start: 0, length: 0.26, peak: 0.16 },
    { freq: 1174.66, start: 0.1, length: 0.34, peak: 0.12 },
  ];

  notes.forEach(({ freq, start, length, peak }) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const to = Math.min(total, Math.floor((start + length) * SAMPLE_RATE));
    for (let i = from; i < to; i += 1) {
      const t = (i - from) / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.02);
      const fade = Math.exp(-t * 9);
      data[i] += Math.round(Math.sin(2 * Math.PI * freq * t) * peak * attack * fade * 32767);
    }
  });

  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, data.length * 2, true);

  for (let i = 0; i < data.length; i += 1) view.setInt16(44 + i * 2, data[i], true);
  return new Blob([buffer], { type: 'audio/wav' });
};

let element = null;
let unlocked = false;
let webContext = null;

const audioElement = () => {
  if (element) return element;
  const url = URL.createObjectURL(buildWav());
  element = new Audio(url);
  element.preload = 'auto';
  element.setAttribute('playsinline', '');
  element.style.display = 'none';
  document.body.appendChild(element);
  return element;
};

// iOS only lets a sound start from something the user tapped, so the very first
// tap anywhere on the page quietly claims the audio element for later scans.
export const primeScanSound = () => {
  if (unlocked) return;
  try {
    const el = audioElement();
    el.muted = true;
    const played = el.play();
    if (played && played.then) {
      played
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          unlocked = true;
        })
        .catch(() => {
          el.muted = false;
        });
    } else {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
    }
  } catch {
    unlocked = false;
  }
};

const webNote = (ctx, frequency, startAt, duration, peak) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
};

const playWebChime = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!webContext) webContext = new Ctx();
    if (webContext.state === 'suspended') webContext.resume();
    const now = webContext.currentTime;
    webNote(webContext, 880, now, 0.28, 0.06);
    webNote(webContext, 1174.66, now + 0.09, 0.34, 0.045);
  } catch {
    /* audio is a nicety, never a blocker */
  }
};

export const playScanChime = () => {
  try {
    const el = audioElement();
    el.muted = false;
    el.currentTime = 0;
    const played = el.play();
    if (played && played.catch) played.catch(() => playWebChime());
  } catch {
    playWebChime();
  }
};

if (typeof document !== 'undefined') {
  const unlock = () => primeScanSound();
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((event) => {
    window.addEventListener(event, unlock, { passive: true });
  });
}

export default playScanChime;