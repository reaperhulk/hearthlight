// An original, scheduled folk motif with day/night arrangements and three mix buses.
// Audio is decorative: every warning also has a visible counterpart.
let ctx, buses, compressor, timer, noiseSource;
let nextBeat = 0,
  beat = 0,
  mood = "day",
  active = false,
  voices = 0;
let levels = { music: 0.35, effects: 0.65, ambience: 0.35 };
const roots = [48, 53, 57, 55];
const melody = [0, 7, 12, 7, 4, 2, 0, 7, 9, 7, 4, 2, 0, 4, 7, 12];
const freq = (note) => 440 * 2 ** ((note - 69) / 12);

function note(
  pitch,
  length,
  volume,
  bus = "music",
  type = "triangle",
  when = 0,
) {
  if (!ctx || ctx.state !== "running" || voices > 36) return;
  const start = Math.max(ctx.currentTime, when);
  const osc = ctx.createOscillator(),
    amp = ctx.createGain(),
    filter = ctx.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq(pitch);
  filter.type = "lowpass";
  filter.frequency.value = bus === "music" ? 1500 : 4000;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, length / 5));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(filter).connect(amp).connect(buses[bus]);
  osc.start(start);
  osc.stop(start + length + 0.03);
  voices++;
  osc.onended = () => {
    voices--;
    osc.disconnect();
    filter.disconnect();
    amp.disconnect();
  };
}

function schedule() {
  if (!ctx || ctx.state !== "running" || !active) return;
  while (nextBeat < ctx.currentTime + 0.15) {
    const root = roots[Math.floor(beat / 16) % roots.length];
    const n = beat % 16;
    note(
      root + 12 + melody[n],
      0.8,
      n % 4 === 0 ? 0.1 : 0.055,
      "music",
      "triangle",
      nextBeat,
    );
    if (n % 4 === 0) {
      note(root, 2.4, 0.08, "music", "sine", nextBeat);
      note(root + 7, 2.0, 0.035, "music", "sine", nextBeat + 0.025);
    }
    if (mood === "night" || mood === "danger") {
      if (n % 2 === 0)
        note(
          root - 12,
          0.22,
          mood === "danger" ? 0.13 : 0.075,
          "music",
          "triangle",
          nextBeat,
        );
      if (mood === "danger" && n % 4 === 2)
        note(root + 1, 0.65, 0.025, "music", "sine", nextBeat);
    }
    nextBeat += mood === "day" ? 0.48 : 0.42;
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
  levels = settings;
  if (ctx && buses)
    for (const id of ["music", "effects", "ambience"])
      buses[id].gain.setTargetAtTime(settings[id], ctx.currentTime, 0.12);
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
  ctx?.close();
  ctx = null;
}

export function soundEvent(event) {
  if (!active) return;
  switch (event.type) {
    case "build":
      note(45, 0.12, 0.18, "effects");
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
    case "hit":
      note(event.source === "tower" ? 83 : 67, 0.09, 0.025, "effects");
      break;
    case "banish":
      note(88, 0.22, 0.035, "effects", "sine");
      break;
    case "bite":
      note(35, 0.13, 0.055, "effects");
      break;
    case "burst":
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
    case "heart":
      note(28, 0.45, 0.18, "effects");
      break;
    case "fall":
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
