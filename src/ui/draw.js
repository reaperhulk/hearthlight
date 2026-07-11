// All canvas rendering for the town map. Pure drawing — reads state, never
// mutates it. The engine stays headless; this file is the game's face.
import { HEART_MAX } from '../engine/round.js';
import { getNightForecast, HEART_SLOT } from '../engine/night.js';
import { RINGS } from '../engine/map.js';
import { STRUCTURES } from '../engine/structures.js';

export const CANVAS = 420;

export const STRUCTURE_COLORS = {
  farm: '#8fc97a',
  well: '#7ab8c9',
  lantern: '#e6c766',
  watchtower: '#d9985f',
  palisade: '#a08c78',
  shrine: '#c99ae0',
  granary: '#d9c97a',
  belltower: '#8f9fd9',
  emberKiln: '#e08a5a',
};

export function slotPixel(slot) {
  return { x: slot.x * CANVAS, y: slot.y * CANVAS };
}

// ── Ambient light ───────────────────────────────────────────────────────────
// Dusk and dawn arrive, they don't snap: darkness eases over ~2.5s.
const ease = t => t * t * (3 - 2 * t);

function getDarkness(round) {
  if (round.phase === 'fallen') return 1;
  const t = ease(Math.min(1, (round.time - round.phaseStart) / 2.5));
  return round.phase === 'night' ? t : 1 - t;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

const SKY_DAY_IN = [30, 36, 56];
const SKY_DAY_OUT = [13, 15, 26];
const SKY_NIGHT_IN = [20, 17, 34];
const SKY_NIGHT_OUT = [4, 3, 9];

// Deterministic hash for star placement — no Math.random in the paint loop.
const hash = n => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// ── Scene layers ────────────────────────────────────────────────────────────
function drawSky(ctx, darkness, animTime) {
  const inner = mix(SKY_DAY_IN, SKY_NIGHT_IN, darkness);
  const outer = mix(SKY_DAY_OUT, SKY_NIGHT_OUT, darkness);
  const bg = ctx.createRadialGradient(CANVAS / 2, CANVAS / 2, 20, CANVAS / 2, CANVAS / 2, CANVAS * 0.62);
  bg.addColorStop(0, rgb(inner));
  bg.addColorStop(1, rgb(outer));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS, CANVAS);

  // Stars wake as the light dies.
  if (darkness > 0.15) {
    for (let i = 0; i < 46; i++) {
      const x = hash(i + 1) * CANVAS;
      const y = hash(i + 101) * CANVAS;
      const twinkle = 0.5 + 0.5 * Math.sin(animTime * (0.8 + hash(i + 201)) + i);
      ctx.fillStyle = `rgba(205, 214, 228, ${(darkness - 0.15) * 0.5 * twinkle})`;
      ctx.fillRect(x, y, hash(i + 301) > 0.8 ? 1.6 : 1, hash(i + 401) > 0.8 ? 1.6 : 1);
    }
  }
}

function drawGround(ctx, round) {
  // The town's ground: faint orbit rings mark where a settlement may stand.
  const rings = new Set(round.slots.map(slot => slot.ring));
  for (const ringIndex of rings) {
    const { radius } = RINGS[ringIndex];
    ctx.strokeStyle = 'rgba(120, 126, 152, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CANVAS / 2, CANVAS / 2, radius * CANVAS, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRim(ctx, round, darkness, animTime) {
  // The rim the dark waits behind. By day it thickens with tonight's
  // count — the telegraph: night is triage, never ambush.
  const tonight = getNightForecast(round).count;
  const rimAlpha = darkness > 0.5 ? 0.5 : Math.min(0.55, 0.18 + tonight * 0.03);
  ctx.strokeStyle = `rgba(150, 90, 170, ${rimAlpha})`;
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = -animTime * 4;
  ctx.beginPath();
  ctx.arc(CANVAS / 2, CANVAS / 2, CANVAS * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // The gathering: one dim mote per shade due tonight, prowling the rim.
  if (round.phase === 'day') {
    for (let index = 0; index < tonight; index++) {
      const angle = (index / tonight) * Math.PI * 2 + animTime * 0.15;
      const wobble = Math.sin(animTime * 1.7 + index * 2.1) * 4;
      const radius = CANVAS * 0.485 + wobble;
      ctx.fillStyle = `rgba(176, 106, 208, ${0.35 + 0.15 * Math.sin(animTime * 2 + index)})`;
      ctx.beginPath();
      ctx.arc(CANVAS / 2 + Math.cos(angle) * radius, CANVAS / 2 + Math.sin(angle) * radius, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawVignette(ctx, round, animTime) {
  // Low light: the dark presses in from the edges.
  const dread = 1 - round.heart / (round.heartMax || HEART_MAX);
  if (dread <= 0.3) return;
  const vignette = ctx.createRadialGradient(CANVAS / 2, CANVAS / 2, CANVAS * 0.22, CANVAS / 2, CANVAS / 2, CANVAS * 0.62);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  const pulse = dread > 0.7 ? 0.06 * Math.sin(animTime * 5) : 0;
  vignette.addColorStop(1, `rgba(20, 4, 24, ${Math.min(0.75, (dread - 0.3) * 1.1 + pulse)})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS, CANVAS);
}

// A living flame: layered lobes that sway, over the ambient glow.
function drawHeart(ctx, round, animTime) {
  const cx = CANVAS / 2;
  const cy = CANVAS / 2;
  const light = round.heart / (round.heartMax || HEART_MAX);

  const heartGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60 + 80 * light);
  heartGlow.addColorStop(0, `rgba(255, 208, 130, ${0.5 + 0.35 * light})`);
  heartGlow.addColorStop(1, 'rgba(255, 208, 130, 0)');
  ctx.fillStyle = heartGlow;
  ctx.fillRect(0, 0, CANVAS, CANVAS);

  const size = 6 + 9 * light;
  const sway = Math.sin(animTime * 3.1) * size * 0.18;
  const breathe = 1 + Math.sin(animTime * 2.2) * 0.08;
  const lobe = (w, h, dx, color, alpha) => {
    ctx.fillStyle = rgb(color, alpha);
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + size * 0.9);
    ctx.bezierCurveTo(
      cx + dx - w, cy + size * 0.5,
      cx + dx - w * 0.5 + sway, cy - h * 0.6,
      cx + dx + sway, cy - h * breathe);
    ctx.bezierCurveTo(
      cx + dx + w * 0.5 + sway, cy - h * 0.6,
      cx + dx + w, cy + size * 0.5,
      cx + dx, cy + size * 0.9);
    ctx.fill();
  };
  lobe(size * 1.05, size * 1.9, 0, [255, 145, 70], 0.85);
  lobe(size * 0.7, size * 1.35, 0, [255, 208, 130], 0.95);
  lobe(size * 0.36, size * 0.8, 0, [255, 246, 224], 0.95);

  // Sparks drift up from the flame.
  for (let i = 0; i < 3; i++) {
    const cycle = (animTime * 0.45 + i / 3) % 1;
    const sparkAlpha = (1 - cycle) * 0.7 * light;
    if (sparkAlpha <= 0.02) continue;
    ctx.fillStyle = `rgba(255, 208, 130, ${sparkAlpha})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(animTime * 2 + i * 2.1) * 6, cy - size - cycle * 26, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShades(ctx, round, animTime) {
  for (const shade of round.shades) {
    const from = {
      x: CANVAS / 2 + Math.cos(shade.spawnAngle) * CANVAS * 0.46,
      y: CANVAS / 2 + Math.sin(shade.spawnAngle) * CANVAS * 0.46,
    };
    const targetSlot = shade.targetSlotId ? round.slots.find(slot => slot.id === shade.targetSlotId) : null;
    const to = targetSlot ? slotPixel(targetSlot) : { x: CANVAS / 2, y: CANVAS / 2 };
    let progress = 1;
    if (shade.phase === 'approach') {
      const span = Math.max(0.001, shade.arrivesAt - shade.spawnedAt);
      progress = Math.max(0, Math.min(1, (round.time - shade.spawnedAt) / span));
    }
    const headX = from.x + (to.x - from.x) * progress;
    const headY = from.y + (to.y - from.y) * progress;
    ctx.strokeStyle = 'rgba(176, 106, 208, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -animTime * 14;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Feeding shades visibly gnaw: they jitter against the structure and
    // pulse — damage is never silent.
    let radius = shade.phase === 'approach' ? 4 : 6;
    let drawX = headX;
    let drawY = headY;
    if (shade.phase === 'feeding') {
      drawX += Math.cos(animTime * 9 + shade.id * 2.7) * 2.5;
      drawY += Math.sin(animTime * 11 + shade.id * 1.9) * 2.5;
      radius = 6 + Math.sin(animTime * 8 + shade.id) * 1.5;
    }
    ctx.fillStyle = shade.phase === 'held' ? '#e6c766' : '#b06ad0';
    ctx.beginPath();
    ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSlots(ctx, round, selectedCard, inspectedId) {
  for (const slot of round.slots) {
    const { x, y } = slotPixel(slot);
    if (!slot.structure) {
      ctx.strokeStyle = selectedCard ? 'rgba(230, 199, 102, 0.8)' : 'rgba(140, 140, 170, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const def = STRUCTURES[slot.structure.type];
    ctx.fillStyle = STRUCTURE_COLORS[slot.structure.type] || '#aeb8c5';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0d16';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name[0], x, y + 0.5);
    // Level pips: one per level above 1.
    for (let pip = 0; pip < slot.structure.level - 1; pip++) {
      ctx.fillStyle = '#ffd082';
      ctx.beginPath();
      ctx.arc(x + 10 - pip * 7, y - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (slot.structure.hp > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '9px monospace';
      ctx.fillText(String(slot.structure.hp), x, y + 19);
    }
    if (slot.id === inspectedId) {
      ctx.strokeStyle = '#ffd082';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawWardens(ctx, round) {
  // Wardens (a warden may stand at the Heart itself)
  for (const warden of round.wardens) {
    if (!warden.slotId) continue;
    const slot = round.slots.find(candidate => candidate.id === warden.slotId);
    if (!slot && warden.slotId !== HEART_SLOT) continue;
    const { x, y } = slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 };
    ctx.strokeStyle = '#9ff2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawTown(ctx, state, selectedCard, animTime, inspectedId) {
  const round = state.round;
  const darkness = getDarkness(round);
  ctx.clearRect(0, 0, CANVAS, CANVAS);
  drawSky(ctx, darkness, animTime);
  drawGround(ctx, round);
  drawRim(ctx, round, darkness, animTime);
  drawVignette(ctx, round, animTime);
  drawHeart(ctx, round, animTime);
  drawShades(ctx, round, animTime);
  drawSlots(ctx, round, selectedCard, inspectedId);
  drawWardens(ctx, round);
}

// Transient hit feedback: bites, falls, and Heart strikes flash on the
// map the moment the engine registers them.
export function drawEffects(ctx, effects, animTime) {
  for (const effect of effects) {
    const age = animTime - effect.start;
    if (effect.type === 'bite' && age < 0.35) {
      const alpha = 0.8 * (1 - age / 0.35);
      ctx.strokeStyle = `rgba(224, 138, 90, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 13 + age * 14, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'fall' && age < 0.7) {
      const alpha = 0.7 * (1 - age / 0.7);
      ctx.strokeStyle = `rgba(224, 90, 90, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 12 + age * 46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'heartFlash' && age < 0.5) {
      const alpha = 0.6 * (1 - age / 0.5);
      ctx.strokeStyle = `rgba(224, 90, 90, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CANVAS / 2, CANVAS / 2, 16 + age * 60, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
