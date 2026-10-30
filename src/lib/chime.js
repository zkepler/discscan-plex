// A short, soft two-note chime for a recognised barcode. Generated with the
// Web Audio API so no sound file is needed.
let context = null;

const audioContext = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  return context;
};

const note = (ctx, frequency, startAt, duration, peak) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  // Soft attack and a long fade keep it gentle rather than a sharp beep.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
};

export const playScanChime = () => {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    note(ctx, 880, now, 0.28, 0.06);
    note(ctx, 1174.66, now + 0.09, 0.34, 0.045);
  } catch {
    /* audio is a nicety, never a blocker */
  }
};

export default playScanChime;