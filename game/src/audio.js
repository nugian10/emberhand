// Synthesized sound for EMBERHAND: every effect is a small WebAudio phrase,
// no audio files are loaded and nothing is fetched. The context is created on
// the first user gesture; until then every call is a silent no-op.
let context = null;
let muted = false;

/** Create (or resume) the audio context. Call from a user gesture. */
export function ensureAudio() {
  try {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
  if (muted || !context) return;
  try {
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // Sound is decoration: a failure here never breaks the game.
  }
}

function noise(dur, gain, when = 0, lowpass = 1200) {
  if (muted || !context) return;
  try {
    const t0 = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter).connect(amp).connect(context.destination);
    source.start(t0);
  } catch {
    // Sound is decoration: a failure here never breaks the game.
  }
}

/** A soft click for hovering and selecting a card. */
export function soundClick() {
  tone(660, 0.06, 'triangle', 0.08);
}

/** A card leaving the hand: a quick rising chirp. */
export function soundPlayCard() {
  tone(420, 0.12, 'triangle', 0.14, 0, 840);
}

/** A hit landing: a thud plus a short noise burst. */
export function soundHit() {
  noise(0.16, 0.22, 0, 900);
  tone(140, 0.16, 'sine', 0.2, 0, 70);
}

/** Block absorbing a blow: a dull wooden knock. */
export function soundBlock() {
  tone(220, 0.1, 'square', 0.07, 0, 160);
}

/** The enemy acting: a low warning growl. */
export function soundEnemy() {
  tone(110, 0.22, 'sawtooth', 0.1, 0, 82);
}

/** A reward offered: three warm notes climbing. */
export function soundReward() {
  tone(523, 0.14, 'triangle', 0.12, 0);
  tone(659, 0.14, 'triangle', 0.12, 0.12);
  tone(784, 0.22, 'triangle', 0.12, 0.24);
}

/** Victory: a short rising fanfare. */
export function soundVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.14, i * 0.13));
}

/** Defeat: two low notes falling away. */
export function soundDefeat() {
  tone(330, 0.3, 'triangle', 0.12, 0, 220);
  tone(220, 0.5, 'triangle', 0.12, 0.28, 110);
}
