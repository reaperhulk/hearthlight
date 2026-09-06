import { maxHp } from "../engine/campaign.js";

// An original, scheduled folk motif with day/night arrangements and three mix buses.
// Audio is decorative: every warning also has a visible counterpart.
let ctx, buses, compressor, timer, noiseSource, noiseBuffer;
const waveforms = new Map();
let effectPan = 0;
let duckUntil = 0,
  variation = 0,
  generation = 0;
const lastSounds = new Map();
let nextBeat = 0,
  beat = 0,
  mood = "day",
  active = false,
  voices = 0;
let levels = { music: 0.35, effects: 0.65, ambience: 0.35 };
// Four paired 32-beat sentences with rests and a quiet interlude: about two minutes.
const roots = [48, 53, 57, 55, 48, 50, 53, 55];
const phrases = [
  [
    0,
    null,
    7,
    12,
    null,
    7,
    4,
    null,
    2,
    4,
    7,
    null,
    4,
    null,
    2,
    null,
    0,
    null,
    7,
    9,
    null,
    7,
    4,
    null,
    2,
    null,
    0,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    4,
    null,
    7,
    12,
    14,
    null,
    12,
    7,
    9,
    null,
    7,
    null,
    4,
    2,
    4,
    null,
    7,
    null,
    9,
    12,
    null,
    9,
    7,
    null,
    4,
    null,
    2,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    0,
    null,
    null,
    7,
    null,
    null,
    4,
    null,
    2,
    null,
    null,
    null,
    0,
    null,
    null,
    null,
    9,
    null,
    null,
    7,
    null,
    null,
    4,
    null,
    2,
    null,
    0,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    7,
    9,
    12,
    null,
    14,
    12,
    9,
    null,
    7,
    null,
    4,
    7,
    9,
    null,
    7,
    null,
    4,
    null,
    2,
    0,
    null,
    2,
    4,
    null,
    7,
    null,
    0,
    null,
    null,
    null,
    null,
    null,
  ],
];
const harmonics = {
  lute: [0, 1, 0.46, 0.25, 0.12, 0.06, 0.03],
  flute: [0, 1, 0.06, 0.19, 0.025, 0.035],
  cello: [0, 1, 0.42, 0.28, 0.17, 0.11, 0.08],
  bell: [0, 1, 0.08, 0.5, 0.03, 0.21, 0.01, 0.09],
};
function instrument(osc, name) {
  if (!harmonics[name]) {
    osc.type = name;
    return;
  }
  if (!waveforms.has(name))
    waveforms.set(
      name,
      ctx.createPeriodicWave(
        new Float32Array(harmonics[name].length),
        new Float32Array(harmonics[name]),
      ),
    );
  osc.setPeriodicWave(waveforms.get(name));
}
function connectSpatial(source, bus, pan) {
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  source.connect(panner).connect(buses[bus]);
  return panner;
}
const freq = (note) => 440 * 2 ** ((note - 69) / 12);

function note(
  pitch,
  length,
  volume,
  bus = "music",
  type = "triangle",
  when = 0,
  pan = bus === "effects" ? effectPan : 0,
) {
  if (
    !ctx ||
    ctx.state !== "running" ||
    voices >= (bus === "music" ? 24 : 36) ||
    levels[bus] === 0
  )
    return;
  const start = Math.max(ctx.currentTime, when);
  const osc = ctx.createOscillator(),
    amp = ctx.createGain(),
    filter = ctx.createBiquadFilter();
  instrument(osc, type);
  osc.frequency.value = freq(pitch);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(
    type === "lute"
      ? 3400
      : type === "cello"
        ? 900
        : bus === "music"
          ? 2100
          : 4000,
    start,
  );
  if (type === "lute")
    filter.frequency.exponentialRampToValueAtTime(650, start + length);
  const attack = type === "flute" || type === "cello" ? 0.12 : 0.012;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(
    volume,
    start + Math.min(attack, length / 5),
  );
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(filter).connect(amp);
  const panner = connectSpatial(amp, bus, pan);
  osc.start(start);
  osc.stop(start + length + 0.03);
  voices++;
  const ownGeneration = generation;
  osc.onended = () => {
    if (ownGeneration === generation) voices--;
    osc.disconnect();
    filter.disconnect();
    amp.disconnect();
    panner.disconnect();
  };
}

function schedule() {
  if (!ctx || ctx.state !== "running" || !active) return;
  if (mood === "lost") {
    nextBeat = ctx.currentTime + 0.5;
    return;
  }
  while (nextBeat < ctx.currentTime + 0.15) {
    const bar = Math.floor(beat / 8),
      root = roots[bar % roots.length],
      n = beat % 32;
    const section = Math.floor(beat / 64) % 4,
      melody = phrases[section][n];
    const night = mood === "night" || mood === "danger";
    if (melody !== null && !(night && n % 4 === 3))
      note(
        root + 12 + melody,
        n % 4 === 0 ? 1.1 : 0.65,
        n % 4 === 0 ? 0.065 : 0.04,
        "music",
        section === 1 ? "flute" : "lute",
        nextBeat,
        -0.18,
      );
    if (beat % 8 === 0) {
      note(root - 12, 3.4, 0.045, "music", "cello", nextBeat, 0.12);
      if (section !== 2)
        note(root + 7, 2.8, 0.018, "music", "flute", nextBeat + 0.03, 0.3);
    }
    // Spare answer phrase in the upper register, leaving the melody room.
    if (!night && section === 3 && [6, 14, 22].includes(n))
      note(
        root + 24 + [7, 4, 2][Math.floor(n / 8)],
        1.5,
        0.022,
        "music",
        "bell",
        nextBeat,
        0.35,
      );
    if (!night && section === 2 && n === 10) {
      note(root + 29, 0.13, 0.018, "ambience", "sine", nextBeat, -0.6);
      note(root + 31, 0.1, 0.012, "ambience", "sine", nextBeat + 0.18, -0.5);
    }
    if (night && beat % 4 === 0) {
      percussion(0.13, mood === "danger" ? 180 : 260, 0.22, "music", nextBeat);
      note(
        root - 12,
        0.3,
        mood === "danger" ? 0.08 : 0.045,
        "music",
        "cello",
        nextBeat,
        0,
      );
    }
    if (mood === "danger" && beat % 8 === 6)
      percussion(0.08, 1100, 0.12, "music", nextBeat);
    if (beat % 16 === 12) percussion(0.06, 900, 0.07, "ambience", nextBeat);
    nextBeat += mood === "day" ? 0.5 : 0.43;
    beat++;
  }
}

export function unlockScore() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    buses = Object.fromEntries(
      ["music", "effects", "ambience"].map((id) => {
        const gain = ctx.createGain();
        gain.gain.value = levels[id];
        gain.connect(compressor);
        return [id, gain];
      }),
    );
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const random = Math.sin(i * 73.137) * 4375.4;
      last = (last + ((random - Math.floor(random)) * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 0.35;
    }
    noiseBuffer = buffer;
    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 450;
    noiseSource.connect(filter).connect(buses.ambience);
    noiseSource.start();
    timer = setInterval(schedule, 100);
  }
  active = true;
  if (ctx.state === "suspended")
    ctx
      .resume()
      .then(() => {
        nextBeat = ctx.currentTime + 0.03;
      })
      .catch(() => {});
  if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.03;
}

export function setMix(settings) {
  for (const id of ["music", "effects", "ambience"]) {
    if (levels[id] === settings[id]) continue;
    levels[id] = settings[id];
    if (ctx && buses) {
      const param = buses[id].gain;
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(
        settings[id] *
          (id === "music" && ctx.currentTime < duckUntil ? 0.3 : 1),
        ctx.currentTime,
        0.06,
      );
      if (id === "music" && ctx.currentTime < duckUntil)
        param.setTargetAtTime(settings[id], duckUntil, 0.3);
    }
  }
}
export function scoreMood(r) {
  if (r?.phase === "lost") return "lost";
  if (!r || r.phase !== "night") return "day";
  const threatened = r.enemies.some(
    (e) =>
      e.progress > 0.72 ||
      e.raid ||
      e.warned ||
      r.slots.some(
        (s) =>
          s.building &&
          s.lane === e.lane &&
          Math.abs(s.progress - e.progress) < 0.015 &&
          s.building.hp < maxHp(s.building, r.kit) * 0.3,
      ),
  );
  return threatened ? "danger" : "night";
}

export function setMood(value) {
  mood = value;
}
export function suspendScore() {
  active = false;
  if (ctx?.state === "running") ctx.suspend().catch(() => {});
}
export function disposeScore() {
  clearInterval(timer);
  noiseSource?.stop();
  ctx?.close().catch(() => {});
  ctx = null;
  noiseSource = null;
  noiseBuffer = null;
  generation++;
  voices = 0;
  nextBeat = 0;
  beat = 0;
  duckUntil = 0;
  active = false;
  lastSounds.clear();
  waveforms.clear();
}

function percussion(
  length,
  cutoff,
  volume,
  bus = "effects",
  when = 0,
  pan = bus === "effects" ? effectPan : 0,
) {
  if (
    !ctx ||
    ctx.state !== "running" ||
    voices >= 36 ||
    !noiseBuffer ||
    levels[bus] === 0
  )
    return;
  const source = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    gain = ctx.createGain();
  const start = Math.max(ctx.currentTime, when),
    ownGeneration = generation;
  source.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 1.6;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain);
  const panner = connectSpatial(gain, bus, pan);
  source.start(start, (variation++ % 20) * 0.1, length);
  voices++;
  source.onended = () => {
    if (ownGeneration === generation) voices--;
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    panner.disconnect();
  };
}
function duck() {
  const t = ctx.currentTime,
    gain = buses.music.gain;
  duckUntil = t + 0.7;
  gain.cancelScheduledValues(t);
  gain.setTargetAtTime(levels.music * 0.3, t, 0.025);
  gain.setTargetAtTime(levels.music, duckUntil, 0.3);
}
export function soundEvent(event) {
  if (!active || !ctx || ctx.state !== "running" || levels.effects === 0)
    return;
  const gap =
    {
      approach: 6,
      raid: 1.2,
      windup: 1.1,
      shot: 0.07,
      arrive: 0.3,
      heart: 0.65,
      fall: 0.3,
      hit: 0.035,
      bite: 0.07,
      banish: 0.08,
    }[event.type] || 0;
  const key = `${event.type}:${["approach", "raid", "windup"].includes(event.type) ? event.lane : event.source || ""}`;
  if (ctx.currentTime - (lastSounds.get(key) ?? -Infinity) < gap) return;
  lastSounds.set(key, ctx.currentTime);
  const location = Number.isFinite(event.x) ? event.x : event.to?.x;
  effectPan = Number.isFinite(location)
    ? (location - 0.5) * 1.5
    : [0, 0.65, 0, -0.65][event.lane] || 0;
  const detune = ((variation++ % 5) - 2) * 0.14;
  if (["fall", "heart", "windup", "raid", "assault"].includes(event.type))
    duck();
  switch (event.type) {
    case "build":
      percussion(0.15, event.material === "tower" ? 1600 : 450, 0.8);
      note(45 + detune, 0.12, 0.18, "effects");
      note(
        52,
        0.1,
        0.09,
        "effects",
        "triangle",
        (ctx?.currentTime || 0) + 0.08,
      );
      break;
    case "repair":
      percussion(0.08, 600, 0.5);
      note(62, 0.12, 0.08, "effects");
      break;
    case "upgrade":
    case "blessing":
      [60, 64, 67].forEach((n, i) =>
        note(
          n,
          0.5,
          0.09,
          "effects",
          "triangle",
          (ctx?.currentTime || 0) + i * 0.08,
        ),
      );
      break;
    case "rally":
      note(74, 0.15, 0.035, "effects", "sine");
      break;
    case "arrive":
      note(79, 0.12, 0.035, "effects", "bell");
      break;
    case "raid":
      note(81, 0.13, 0.055, "effects", "bell");
      note(74, 0.2, 0.055, "effects", "bell", ctx.currentTime + 0.16);
      break;
    case "windup":
      note(38, 0.65, 0.1, "effects", "cello");
      percussion(0.15, 240, 0.45);
      break;
    case "interrupt":
      percussion(0.22, 2400, 0.4);
      note(86, 0.3, 0.06, "effects", "bell");
      break;
    case "enrage":
    case "assault":
      note(36, 1.2, 0.085, "effects", "cello");
      note(43, 1.0, 0.05, "effects", "cello", ctx.currentTime + 0.2);
      break;
    case "shot":
      percussion(0.09, 3800, 0.15);
      break;
    case "hit":
      percussion(0.07, event.source === "tower" ? 2800 : 1000, 0.3);
      note(
        (event.source === "tower" ? 83 : 67) + detune,
        0.09,
        0.025,
        "effects",
      );
      break;
    case "banish":
      note(88, 0.22, 0.035, "effects", "sine");
      break;
    case "bite":
      percussion(0.1, event.material === "tower" ? 1700 : 330, 0.5);
      note(35 + detune, 0.13, 0.055, "effects");
      break;
    case "burst":
      percussion(0.5, 2200, 0.5);
      [48, 60, 67, 72].forEach((n, i) =>
        note(
          n,
          0.6,
          0.065,
          "effects",
          "sine",
          (ctx?.currentTime || 0) + i * 0.025,
        ),
      );
      break;
    case "approach":
      note(
        event.enemyType === "king"
          ? 36
          : event.enemyType === "brute"
            ? 43
            : event.enemyType === "runner"
              ? 76
              : 55,
        0.45,
        0.04,
        "effects",
        event.enemyType === "runner" ? "bell" : "flute",
      );
      break;
    case "heart":
      note(40, 0.35, 0.1, "effects", "sine", ctx.currentTime + 0.15);
      note(28, 0.45, 0.18, "effects");
      break;
    case "fall":
      percussion(0.65, 350, 0.8);
      note(36, 0.6, 0.1, "effects");
      break;
    case "dusk":
      note(48, 0.9, 0.085, "effects", "sine");
      break;
    case "dawn":
      [60, 64, 67].forEach((n, i) =>
        note(
          n,
          0.7,
          0.065,
          "effects",
          "sine",
          (ctx?.currentTime || 0) + i * 0.12,
        ),
      );
      break;
    case "won":
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) =>
        note(
          n,
          1.5,
          0.09,
          "effects",
          "triangle",
          (ctx?.currentTime || 0) + i * 0.16,
        ),
      );
      break;
    case "lost":
      [48, 43, 36].forEach((n, i) =>
        note(
          n,
          1.6,
          0.08,
          "effects",
          "sine",
          (ctx?.currentTime || 0) + i * 0.3,
        ),
      );
      break;
    default:
      break;
  }
}
