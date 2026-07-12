// A tiny WebAudio synth — no assets, subtle by design. The engine stays
// pure; the UI diffs round telemetry and calls these.

let audio = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function unlockAudio() {
  if (!audio) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audio = new Ctor();
  }
  if (audio.state === 'suspended') audio.resume();
}

function tone({ freq, freqEnd, duration, type = 'sine', gain = 0.06, delay = 0 }) {
  if (muted || !audio || audio.state !== 'running') return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0005, start + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  // A structure settles into the earth.
  place() {
    tone({ freq: 140, freqEnd: 70, duration: 0.16, type: 'triangle', gain: 0.1 });
  },
  // The Warden banishes a shade.
  banish() {
    tone({ freq: 620, freqEnd: 1240, duration: 0.14, type: 'sine', gain: 0.05 });
    tone({ freq: 930, duration: 0.1, type: 'sine', gain: 0.03, delay: 0.05 });
  },
  // A watchtower burns a shade out of the dark.
  tower() {
    tone({ freq: 1400, freqEnd: 300, duration: 0.09, type: 'sawtooth', gain: 0.03 });
  },
  // Dusk falls.
  dusk() {
    tone({ freq: 220, freqEnd: 110, duration: 0.5, type: 'sine', gain: 0.05 });
  },
  // A Still Night: the dark inhales, and holds.
  still() {
    tone({ freq: 180, freqEnd: 90, duration: 0.8, type: 'sine', gain: 0.045 });
    tone({ freq: 90, freqEnd: 130, duration: 0.9, type: 'sine', gain: 0.035, delay: 0.8 });
  },
  // A grapple broken by choice: a low tearing note.
  release() {
    tone({ freq: 300, freqEnd: 80, duration: 0.22, type: 'sawtooth', gain: 0.05 });
  },
  // Fresh timber knocked into place: two quick woody taps.
  mend() {
    tone({ freq: 190, freqEnd: 160, duration: 0.07, type: 'square', gain: 0.05 });
    tone({ freq: 240, freqEnd: 200, duration: 0.08, type: 'square', gain: 0.05, delay: 0.09 });
  },
  // Dawn breaks.
  dawn() {
    tone({ freq: 330, freqEnd: 660, duration: 0.35, type: 'sine', gain: 0.04 });
  },
  // A structure falls to the dark.
  fall() {
    tone({ freq: 98, freqEnd: 49, duration: 0.6, type: 'triangle', gain: 0.12 });
  },
  // The Heart takes a direct strike.
  heartHit() {
    tone({ freq: 75, duration: 0.25, type: 'square', gain: 0.07 });
  },
  // A shade finds only ash and howls: a falling wail into the thud.
  vent() {
    tone({ freq: 520, freqEnd: 130, duration: 0.3, type: 'sawtooth', gain: 0.035 });
    tone({ freq: 75, duration: 0.2, type: 'square', gain: 0.06, delay: 0.18 });
  },
  // The town falls. A slow toll.
  toll() {
    tone({ freq: 110, freqEnd: 55, duration: 1.2, type: 'triangle', gain: 0.12 });
    tone({ freq: 82, freqEnd: 41, duration: 1.4, type: 'triangle', gain: 0.1, delay: 0.5 });
  },
};
