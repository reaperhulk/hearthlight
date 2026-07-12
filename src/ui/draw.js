// All canvas rendering for the town map. Pure drawing — reads state, never
// mutates it. The engine stays headless; this file is the game's face.
import { HEART_MAX } from '../engine/round.js';
import { getHoldTime, getNightForecast, getShadeCount, getWardenCooldown, HEART_SLOT, SHADE_FEED_TIME, STILL_DEBT } from '../engine/night.js';
import { getAdjacentSlots, RINGS } from '../engine/map.js';
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

const SKY_DAY_IN = [82, 84, 116];
const SKY_DAY_OUT = [32, 35, 54];
const SKY_NIGHT_IN = [20, 17, 34];
const SKY_NIGHT_OUT = [4, 3, 9];

// Deterministic hash for star placement — no Math.random in the paint loop.
const hash = n => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Users who prefer reduced motion get a stiller sky and no shake.
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The star field never changes — compute it once.
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: hash(i + 1) * CANVAS,
  y: hash(i + 101) * CANVAS,
  rate: 0.8 + hash(i + 201),
  w: hash(i + 301) > 0.8 ? 1.6 : 1,
  h: hash(i + 401) > 0.8 ? 1.6 : 1,
}));

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
    const wake = darkness - 0.15;
    for (let i = 0; i < STARS.length; i++) {
      const star = STARS[i];
      const twinkle = REDUCED_MOTION ? 0.7 : 0.5 + 0.5 * Math.sin(animTime * star.rate + i);
      ctx.fillStyle = `rgba(205, 214, 228, ${wake * 0.5 * twinkle})`;
      ctx.fillRect(star.x, star.y, star.w, star.h);
    }
    // A few named stars burn brighter, with a cross of light.
    for (let i = 0; i < 3; i++) {
      const x = hash(i + 501) * CANVAS;
      const y = hash(i + 601) * CANVAS * 0.5;
      const shine = wake * (0.5 + 0.4 * Math.sin(animTime * 1.3 + i * 2));
      ctx.strokeStyle = `rgba(220, 228, 244, ${shine * 0.6})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
      ctx.stroke();
      ctx.fillStyle = `rgba(235, 240, 250, ${shine})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Fog drifts once the dark settles.
    for (let i = 0; i < (REDUCED_MOTION ? 0 : 3); i++) {
      const fx = CANVAS / 2 + Math.cos(animTime * 0.07 + i * 2.1) * CANVAS * 0.3;
      const fy = CANVAS / 2 + Math.sin(animTime * 0.05 + i * 1.7) * CANVAS * 0.3;
      const fog = ctx.createRadialGradient(fx, fy, 8, fx, fy, 85);
      fog.addColorStop(0, `rgba(150, 120, 190, ${wake * 0.05})`);
      fog.addColorStop(1, 'rgba(150, 120, 190, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(fx - 85, fy - 85, 170, 170);
    }
  }
}

function drawGround(ctx, round, darkness) {
  // Earth beneath the town: warm by day, cold under the dark.
  const soil = ctx.createRadialGradient(CANVAS / 2, CANVAS / 2, 10, CANVAS / 2, CANVAS / 2, CANVAS * 0.46);
  soil.addColorStop(0, rgb(mix([98, 84, 60], [44, 40, 62], darkness), 0.17));
  soil.addColorStop(0.82, rgb(mix([72, 64, 50], [28, 26, 44], darkness), 0.10));
  soil.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = soil;
  ctx.fillRect(0, 0, CANVAS, CANVAS);

  // Faint orbit rings mark where a settlement may stand.
  const rings = new Set(round.slots.map(slot => slot.ring));
  for (const ringIndex of rings) {
    const { radius } = RINGS[ringIndex];
    ctx.strokeStyle = 'rgba(140, 146, 172, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CANVAS / 2, CANVAS / 2, radius * CANVAS, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stone pads: the buildable ground is always legible, occupied or not.
  for (const slot of round.slots) {
    const { x, y } = slotPixel(slot);
    const frontier = slot.ring > 0;
    ctx.fillStyle = frontier ? 'rgba(190, 160, 110, 0.07)' : 'rgba(150, 156, 180, 0.07)';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = frontier ? 'rgba(190, 160, 110, 0.14)' : 'rgba(150, 156, 180, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Beyond the rim, the world simply ends.
  const edge = ctx.createRadialGradient(CANVAS / 2, CANVAS / 2, CANVAS * 0.46, CANVAS / 2, CANVAS / 2, CANVAS * 0.74);
  edge.addColorStop(0, 'rgba(2, 2, 8, 0)');
  edge.addColorStop(1, `rgba(2, 2, 8, ${0.45 + 0.25 * darkness})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, CANVAS, CANVAS);
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

  // A Still Night: nothing attacks, but the held breath is visible —
  // tomorrow's swollen host masses on the rim and presses inward.
  if (round.phase === 'night' && round.stillDebt && round.shades.length === 0) {
    const tomorrow = getShadeCount(round.day + 1) + STILL_DEBT;
    for (let index = 0; index < tomorrow; index++) {
      const angle = (index / tomorrow) * Math.PI * 2 - animTime * 0.35;
      const press = Math.sin(animTime * 1.4 + index) * 10;
      const radius = CANVAS * 0.47 - Math.max(0, press);
      ctx.fillStyle = `rgba(176, 106, 208, ${0.5 + 0.2 * Math.sin(animTime * 3 + index)})`;
      ctx.beginPath();
      ctx.arc(CANVAS / 2 + Math.cos(angle) * radius, CANVAS / 2 + Math.sin(angle) * radius, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

// A living flame: hearth coals, additive glow, layered lobes that sway —
// and a gutter when the light runs low.
function drawHeart(ctx, round, animTime) {
  const cx = CANVAS / 2;
  const cy = CANVAS / 2;
  const light = round.heart / (round.heartMax || HEART_MAX);

  // The hearth itself: a stone bed with living coals.
  ctx.fillStyle = '#141019';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const coalX = cx + (i - 1.5) * 6.4;
    const glowPulse = 0.4 + 0.3 * Math.sin(animTime * 2.6 + i * 1.9);
    ctx.fillStyle = `rgba(255, 120, 60, ${(0.25 + glowPulse * 0.4) * (0.3 + 0.7 * light)})`;
    ctx.beginPath();
    ctx.arc(coalX, cy + 7 + Math.sin(i * 2.2) * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const heartGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60 + 80 * light);
  heartGlow.addColorStop(0, `rgba(255, 190, 110, ${0.30 + 0.25 * light})`);
  heartGlow.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = heartGlow;
  ctx.fillRect(0, 0, CANVAS, CANVAS);
  ctx.restore();

  // Below a third of its light, the flame gutters — irregular, anxious.
  const gutter = light < 0.35
    ? 0.75 + 0.25 * Math.sin(animTime * 13) * Math.sin(animTime * 7.3)
    : 1;
  const size = (6 + 9 * light) * gutter;
  const sway = Math.sin(animTime * 3.1) * size * 0.18 * (light < 0.35 ? 2 : 1);
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
    // Shades condense out of the rim rather than popping into being.
    ctx.globalAlpha = Math.min(1, Math.max(0.1, (round.time - shade.spawnedAt) / 0.8));
    ctx.strokeStyle = 'rgba(176, 106, 208, 0.55)';
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
    let radius = shade.phase === 'approach' ? 4.5 : 6;
    let drawX = headX;
    let drawY = headY;
    if (shade.phase === 'feeding') {
      drawX += Math.cos(animTime * 9 + shade.id * 2.7) * 2.5;
      drawY += Math.sin(animTime * 11 + shade.id * 1.9) * 2.5;
      radius = 6 + Math.sin(animTime * 8 + shade.id) * 1.5;
    }
    // A wisp, not a dot: a bright-cored smoky body trailing ghosts of
    // itself. Heartseekers burn crimson; held shades burn gold.
    const span = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const backX = (from.x - to.x) / span;
    const backY = (from.y - to.y) / span;
    const wave = Math.sin(animTime * 5 + shade.id * 1.7);
    const held = shade.phase === 'held';
    const seeker = shade.targetSlotId === null;
    const body = held ? [230, 199, 102] : seeker ? [226, 96, 118] : [176, 106, 208];
    // Ghosts of its own passage, strung back along the path.
    if (shade.phase === 'approach') {
      for (let ghost = 3; ghost >= 1; ghost--) {
        const gx = drawX + backX * ghost * 7 + backY * wave * ghost * 1.5;
        const gy = drawY + backY * ghost * 7 - backX * wave * ghost * 1.5;
        ctx.fillStyle = rgb(body, 0.28 - ghost * 0.07);
        ctx.beginPath();
        ctx.arc(gx, gy, radius * (1 - ghost * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let lobe = 2; lobe >= 0; lobe--) {
      const drift = lobe * (5 + wave);
      const lx = drawX + backX * drift + backY * wave * lobe * 2;
      const ly = drawY + backY * drift - backX * wave * lobe * 2;
      const lr = radius * (1 - lobe * 0.28);
      if (lobe === 0) {
        const core = ctx.createRadialGradient(lx - 1, ly - 1, 0.5, lx, ly, lr + 1.5);
        core.addColorStop(0, rgb(mix(body, [255, 255, 255], 0.55), 0.95));
        core.addColorStop(0.55, rgb(body, 0.8));
        core.addColorStop(1, rgb(body, 0));
        ctx.fillStyle = core;
      } else {
        ctx.fillStyle = rgb(body, 0.6 - lobe * 0.18);
      }
      ctx.beginPath();
      ctx.arc(lx, ly, lr + (lobe === 0 ? 1.5 : 0), 0, Math.PI * 2);
      ctx.fill();
    }
    // Eyes of the dark: two glowing pinpricks facing the prize.
    ctx.fillStyle = held ? '#fff6e0' : seeker ? '#ffd6dc' : '#f2e6fb';
    ctx.beginPath();
    ctx.arc(drawX - backY * 2.4 - backX * 1.8, drawY + backX * 2.4 - backY * 1.8, 1.15, 0, Math.PI * 2);
    ctx.arc(drawX + backY * 2.4 - backX * 1.8, drawY - backX * 2.4 - backY * 1.8, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── Structure glyphs ────────────────────────────────────────────────────────
// Every building has a silhouette, not a letter. Drawn within radius r.
export function drawStructureGlyph(ctx, type, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  const s = r / 12; // designed at r = 12
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (type) {
    case 'farm': // furrow rows
      ctx.moveTo(-7, -4); ctx.lineTo(7, -4);
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
      ctx.moveTo(-7, 4); ctx.lineTo(7, 4);
      ctx.stroke();
      break;
    case 'well': // ring with a bucket-beam
      ctx.arc(0, 1, 5, 0, Math.PI * 2);
      ctx.moveTo(-6, -5); ctx.lineTo(6, -5);
      ctx.moveTo(0, -5); ctx.lineTo(0, -1);
      ctx.stroke();
      break;
    case 'lantern': // diamond of light
      ctx.moveTo(0, -7); ctx.lineTo(5, 0); ctx.lineTo(0, 7); ctx.lineTo(-5, 0); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'watchtower': // tower with crenellated top
      ctx.moveTo(-4, 7); ctx.lineTo(-3, -3); ctx.lineTo(3, -3); ctx.lineTo(4, 7);
      ctx.moveTo(-5, -3); ctx.lineTo(-5, -7); ctx.lineTo(-1.5, -7); ctx.lineTo(-1.5, -5);
      ctx.lineTo(1.5, -5); ctx.lineTo(1.5, -7); ctx.lineTo(5, -7); ctx.lineTo(5, -3);
      ctx.stroke();
      break;
    case 'palisade': // three stakes
      ctx.moveTo(-5, 7); ctx.lineTo(-5, -4); ctx.lineTo(-3.6, -6.5); ctx.lineTo(-2.2, -4); ctx.lineTo(-2.2, 7);
      ctx.moveTo(-1.4, 7); ctx.lineTo(-1.4, -4); ctx.lineTo(0, -6.5); ctx.lineTo(1.4, -4); ctx.lineTo(1.4, 7);
      ctx.moveTo(2.2, 7); ctx.lineTo(2.2, -4); ctx.lineTo(3.6, -6.5); ctx.lineTo(5, -4); ctx.lineTo(5, 7);
      ctx.stroke();
      break;
    case 'granary': // barn with a full loft
      ctx.moveTo(-6, 7); ctx.lineTo(-6, -1); ctx.lineTo(0, -7); ctx.lineTo(6, -1); ctx.lineTo(6, 7); ctx.closePath();
      ctx.moveTo(-6, 2); ctx.lineTo(6, 2);
      ctx.stroke();
      break;
    case 'belltower': // the bell itself
      ctx.moveTo(-5, 3);
      ctx.quadraticCurveTo(-5, -6, 0, -6);
      ctx.quadraticCurveTo(5, -6, 5, 3);
      ctx.lineTo(-5, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 5.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'emberKiln': // dome with a burning mouth
      ctx.moveTo(-6, 6); ctx.lineTo(6, 6);
      ctx.moveTo(-6, 6);
      ctx.quadraticCurveTo(-6, -6, 0, -6);
      ctx.quadraticCurveTo(6, -6, 6, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 4, 2.2, Math.PI, 0);
      ctx.fill();
      break;
    case 'shrine': // torii arch
      ctx.moveTo(-6, -5); ctx.lineTo(6, -5);
      ctx.moveTo(-7, -7); ctx.lineTo(7, -7);
      ctx.moveTo(-4, -5); ctx.lineTo(-4, 7);
      ctx.moveTo(4, -5); ctx.lineTo(4, 7);
      ctx.stroke();
      break;
    default:
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}

function drawSlots(ctx, round, selectedCard, inspectedId, animTime) {
  for (const slot of round.slots) {
    const { x, y } = slotPixel(slot);
    if (!slot.structure) {
      if (slot.ruin) {
        // Ash where a building stood — a charred patch, embers, a spark.
        const char = ctx.createRadialGradient(x, y, 1, x, y, 12);
        char.addColorStop(0, 'rgba(30, 18, 16, 0.55)');
        char.addColorStop(1, 'rgba(30, 18, 16, 0)');
        ctx.fillStyle = char;
        ctx.fillRect(x - 12, y - 12, 24, 24);
        ctx.fillStyle = 'rgba(224, 138, 90, 0.4)';
        for (let ash = 0; ash < 3; ash++) {
          ctx.beginPath();
          ctx.arc(x + (ash - 1) * 4.5, y + 3 - (ash % 2) * 4, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        const rise = (animTime * 0.35 + slot.x * 3) % 1;
        ctx.fillStyle = `rgba(255, 150, 90, ${(1 - rise) * 0.5})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(animTime * 2 + slot.y * 9) * 3, y - rise * 14, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      // With a card in hand, open ground beckons — with a place marker.
      const pulse = selectedCard ? 0.6 + 0.3 * Math.sin(animTime * 3.2 + slot.x * 7) : 0.45;
      ctx.strokeStyle = selectedCard ? `rgba(230, 199, 102, ${pulse})` : `rgba(150, 156, 186, ${pulse})`;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (selectedCard) {
        ctx.strokeStyle = `rgba(230, 199, 102, ${pulse * 0.9})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
      continue;
    }
    const color = STRUCTURE_COLORS[slot.structure.type] || '#aeb8c5';
    // The lantern casts its pool of light beneath everything else.
    if (slot.structure.type === 'lantern') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pool = ctx.createRadialGradient(x, y, 4, x, y, 40);
      pool.addColorStop(0, 'rgba(255, 214, 140, 0.16)');
      pool.addColorStop(1, 'rgba(255, 214, 140, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(x - 40, y - 40, 80, 80);
      ctx.restore();
    }
    // Grounded: a soft shadow, then a shaded disc with a colored ring.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(x + 1.5, y + 13.5, 11, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const disc = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, 14);
    disc.addColorStop(0, '#232838');
    disc.addColorStop(1, '#0c0e18');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    // Veterans wear a second, golden ring.
    if (slot.structure.level >= 3) {
      ctx.strokeStyle = 'rgba(255, 208, 130, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 15.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // A palisade turns its rampart to the rim it holds against.
    if (slot.structure.type === 'palisade') {
      const facing = Math.atan2(y - CANVAS / 2, x - CANVAS / 2);
      ctx.strokeStyle = 'rgba(160, 140, 120, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 17, facing - 0.85, facing + 0.85);
      ctx.stroke();
    }
    const wounded = slot.structure.hp < (STRUCTURES[slot.structure.type].hp || 1);
    ctx.globalAlpha = wounded ? 0.8 : 1;
    drawStructureGlyph(ctx, slot.structure.type, x, y, 8.5, color);
    ctx.globalAlpha = 1;
    // Wounds show: cracks across a damaged building.
    if (wounded) {
      ctx.strokeStyle = 'rgba(10, 8, 14, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 5); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x - 6, y + 8);
      ctx.moveTo(x + 8, y - 8); ctx.lineTo(x + 4, y - 2);
      ctx.stroke();
    }
    // Level pips: a dot for level 2; veterans carry a golden star.
    if (slot.structure.level === 2) {
      ctx.fillStyle = '#ffd082';
      ctx.beginPath();
      ctx.arc(x + 11, y - 11, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (slot.structure.level >= 3) {
      ctx.fillStyle = '#ffd082';
      ctx.beginPath();
      const sx = x + 11.5;
      const sy = y - 11.5;
      for (let p = 0; p < 8; p++) {
        const angle = (p / 8) * Math.PI * 2 - Math.PI / 2;
        const radial = p % 2 === 0 ? 4.4 : 1.8;
        ctx[p === 0 ? 'moveTo' : 'lineTo'](sx + Math.cos(angle) * radial, sy + Math.sin(angle) * radial);
      }
      ctx.closePath();
      ctx.fill();
    }
    // Toughness pips: one dot per remaining bite it can take.
    const hpPips = Math.min(5, slot.structure.hp);
    for (let pip = 0; pip < hpPips; pip++) {
      ctx.fillStyle = 'rgba(230, 235, 245, 0.8)';
      ctx.beginPath();
      ctx.arc(x + (pip - (hpPips - 1) / 2) * 5, y + 18, 1.6, 0, Math.PI * 2);
      ctx.fill();
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

// ── Threat telegraphy ───────────────────────────────────────────────────────
// Every targeted position wears a countdown arc: purple shrinking while a
// shade approaches, red growing while one feeds. Towers show their bolts.
function drawThreats(ctx, round, holdTime) {
  if (round.phase !== 'night') {
    // By day, towers preview their full quiver.
    for (const slot of round.slots) {
      if (slot.structure?.type === 'watchtower') {
        drawTowerBolts(ctx, slot, STRUCTURES.watchtower.nightCharges + (slot.structure.level >= 3 ? 1 : 0));
      }
    }
    return;
  }
  const soonest = new Map(); // targetKey -> shade with the nearest deadline
  for (const shade of round.shades) {
    const key = shade.targetSlotId ?? HEART_SLOT;
    const deadline = shade.phase === 'approach' ? shade.arrivesAt : shade.phase === 'feeding' ? shade.feedsAt : null;
    if (deadline == null) continue;
    const current = soonest.get(key);
    if (!current || deadline < (current.phase === 'approach' ? current.arrivesAt : current.feedsAt)) {
      soonest.set(key, shade);
    }
  }
  for (const [key, shade] of soonest) {
    const slot = key === HEART_SLOT ? null : round.slots.find(candidate => candidate.id === key);
    const { x, y } = slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 };
    const radius = key === HEART_SLOT ? 24 : 17;
    let fraction;
    let color;
    if (shade.phase === 'approach') {
      const span = Math.max(0.001, shade.arrivesAt - shade.spawnedAt);
      fraction = Math.max(0, Math.min(1, (shade.arrivesAt - round.time) / span));
      color = 'rgba(176, 106, 208, 0.85)';
    } else {
      fraction = Math.max(0, Math.min(1, 1 - (shade.feedsAt - round.time) / SHADE_FEED_TIME));
      color = 'rgba(224, 90, 90, 0.9)';
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    ctx.stroke();
  }
  for (const slot of round.slots) {
    if (slot.structure?.type === 'watchtower') {
      drawTowerBolts(ctx, slot, round.towerCharges[slot.id] ?? 0);
    }
  }

  // Grappled shades wear a gold arc: banished when it closes.
  const posOf = key => {
    const slot = key === HEART_SLOT ? null : round.slots.find(candidate => candidate.id === key);
    return slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 };
  };
  for (const shade of round.shades) {
    if (shade.phase !== 'held' || shade.heldSince == null) continue;
    const key = shade.targetSlotId ?? HEART_SLOT;
    const { x, y } = posOf(key);
    const radius = key === HEART_SLOT ? 28 : 21;
    const fraction = Math.max(0, Math.min(1, (round.time - shade.heldSince) / holdTime));
    ctx.strokeStyle = 'rgba(230, 199, 102, 0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    ctx.stroke();
  }

  // Saturation: the warden grapples ONE — shades still chewing at a
  // guarded post are counted so overload is visible at a glance.
  const guarded = new Set(round.wardens.map(warden => warden.slotId).filter(Boolean));
  const queued = new Map();
  for (const shade of round.shades) {
    const key = shade.targetSlotId ?? HEART_SLOT;
    if (shade.phase === 'feeding' && guarded.has(key)) queued.set(key, (queued.get(key) || 0) + 1);
  }
  for (const [key, count] of queued) {
    const { x, y } = posOf(key);
    ctx.fillStyle = '#e08a8a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${count} feeding`, x, y + (key === HEART_SLOT ? 38 : 30));
  }
}

// Remaining tower bolts as little gold diamonds beside the tower.
function drawTowerBolts(ctx, slot, charges) {
  const { x, y } = slotPixel(slot);
  for (let bolt = 0; bolt < charges; bolt++) {
    const bx = x - 11;
    const by = y - 9 + bolt * 7;
    ctx.fillStyle = '#ffd082';
    ctx.beginPath();
    ctx.moveTo(bx, by - 2.6);
    ctx.lineTo(bx + 2, by);
    ctx.lineTo(bx, by + 2.6);
    ctx.lineTo(bx - 2, by);
    ctx.closePath();
    ctx.fill();
  }
}

// Which neighbors would a card placed here actually touch?
function affectedNeighbors(round, slotId, cardType) {
  const neighbors = getAdjacentSlots(round.slots, slotId).filter(neighbor => neighbor.structure);
  if (cardType === 'well') return neighbors.filter(neighbor => neighbor.structure.type === 'farm');
  if (cardType === 'farm') return neighbors.filter(neighbor => neighbor.structure.type === 'well');
  if (cardType === 'palisade') return neighbors.filter(neighbor => neighbor.structure.type !== 'palisade');
  if (cardType === 'watchtower' || cardType === 'lantern' || cardType === 'belltower') return neighbors;
  return [];
}

function drawLink(ctx, a, b, color, alpha, animTime) {
  ctx.strokeStyle = color.replace('ALPHA', String(alpha));
  ctx.lineWidth = 1.4;
  ctx.setLineDash([2, 4]);
  ctx.lineDashOffset = -animTime * 8;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Ghost preview: with a card in hand, the pointer shows the building where
// it would land — and glowing links show exactly who it would touch.
function drawPlacementPreview(ctx, round, selectedCard, hover, animTime) {
  if (!selectedCard || !hover) return;
  let nearest = null;
  let nearestDistance = 40;
  for (const slot of round.slots) {
    if (slot.structure) continue;
    const px = slotPixel(slot);
    const distance = Math.hypot(px.x - hover.x, px.y - hover.y);
    if (distance < nearestDistance) { nearestDistance = distance; nearest = slot; }
  }
  if (!nearest) return;
  const { x, y } = slotPixel(nearest);
  const color = STRUCTURE_COLORS[selectedCard] || '#aeb8c5';
  for (const neighbor of affectedNeighbors(round, nearest.id, selectedCard)) {
    drawLink(ctx, { x, y }, slotPixel(neighbor), `rgba(230, 199, 102, ALPHA)`, 0.7, animTime);
  }
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(animTime * 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  drawStructureGlyph(ctx, selectedCard, x, y, 8.5, color);
  ctx.globalAlpha = 1;
}

// Inspecting a building lights up its actual relationships. A watchtower
// additionally rings the neighbors its bolts cover — and never itself.
function drawInspectLinks(ctx, round, inspectedId, animTime) {
  if (!inspectedId) return;
  const slot = round.slots.find(candidate => candidate.id === inspectedId);
  if (!slot?.structure) return;
  const origin = slotPixel(slot);
  const isTower = slot.structure.type === 'watchtower';
  for (const neighbor of getAdjacentSlots(round.slots, inspectedId)) {
    if (!neighbor.structure) continue;
    const px = slotPixel(neighbor);
    drawLink(ctx, origin, px, 'rgba(159, 242, 255, ALPHA)', 0.45, animTime);
    if (isTower) {
      ctx.strokeStyle = 'rgba(255, 208, 130, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px.x, px.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// The warden is a lantern-bearer, not a ring. Render-side smoothing walks
// them between posts; `visuals` persists across frames (UI-only state).
function drawWardens(ctx, round, animTime, visuals, cooldown = 6) {
  const dt = Math.min(0.1, Math.max(0.001, animTime - (visuals.lastTime ?? animTime)));
  visuals.lastTime = animTime;
  for (const warden of round.wardens) {
    const slot = warden.slotId ? round.slots.find(candidate => candidate.id === warden.slotId) : null;
    if (warden.slotId && !slot && warden.slotId !== HEART_SLOT) continue;
    // Unposted wardens wait by the fire; posted ones stand a pace
    // rimward of their charge, facing the dark.
    let target;
    if (!warden.slotId) {
      target = { x: CANVAS / 2 + (warden.id === 1 ? 26 : -26), y: CANVAS / 2 + 14 };
    } else {
      const post = slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 };
      const outX = post.x - CANVAS / 2;
      const outY = post.y - CANVAS / 2;
      const away = Math.hypot(outX, outY) || 1;
      target = slot
        ? { x: post.x + (outX / away) * 21, y: post.y + (outY / away) * 21 }
        : { x: post.x + 4, y: post.y - 24 };
    }
    let pos = visuals.wardens.get(warden.id);
    if (!pos) { pos = { ...target }; visuals.wardens.set(warden.id, pos); }
    pos.x += (target.x - pos.x) * Math.min(1, dt * 7);
    pos.y += (target.y - pos.y) * Math.min(1, dt * 7);
    const moving = Math.hypot(target.x - pos.x, target.y - pos.y) > 2;
    const posted = Boolean(warden.slotId);
    const postPixel = !posted ? null
      : (slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 });
    // A gold tether binds the warden to the shade in his grip.
    if (posted && !moving) {
      const gripped = round.shades.find(shade =>
        shade.phase === 'held' && (shade.targetSlotId ?? HEART_SLOT) === warden.slotId);
      if (gripped) {
        ctx.strokeStyle = `rgba(230, 199, 102, ${0.55 + 0.2 * Math.sin(animTime * 6)})`;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pos.x + 5, pos.y - 8);
        ctx.lineTo(postPixel.x, postPixel.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Lantern light pools around the standing warden.
    const pool = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, 26);
    pool.addColorStop(0, 'rgba(159, 242, 255, 0.20)');
    pool.addColorStop(1, 'rgba(159, 242, 255, 0)');
    ctx.fillStyle = pool;
    ctx.fillRect(pos.x - 26, pos.y - 26, 52, 52);

    // The figure: hooded cloak, staff, and a burning lantern.
    const bob = moving ? Math.sin(animTime * 12) * 1.2 : Math.sin(animTime * 2.4) * 0.5;
    const fx = pos.x;
    const fy = pos.y + bob;
    ctx.strokeStyle = '#9ff2ff';
    ctx.fillStyle = '#9ff2ff';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); // cloak
    ctx.moveTo(fx - 4, fy + 7);
    ctx.lineTo(fx - 2.5, fy - 2);
    ctx.lineTo(fx + 2.5, fy - 2);
    ctx.lineTo(fx + 4, fy + 7);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); // head
    ctx.arc(fx, fy - 4.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // staff
    ctx.moveTo(fx + 5, fy + 7);
    ctx.lineTo(fx + 5, fy - 7);
    ctx.stroke();
    const flicker = 0.75 + 0.25 * Math.sin(animTime * 7 + warden.id);
    ctx.fillStyle = `rgba(255, 208, 130, ${flicker})`; // the lantern
    ctx.beginPath();
    ctx.arc(fx + 5, fy - 8.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Readiness on the figure itself: a cyan arc refills with the
    // cooldown; full circle means he can move again.
    if (round.phase === 'night') {
      const readiness = Math.min(1, (round.time - warden.movedAt) / cooldown);
      ctx.strokeStyle = readiness >= 1
        ? `rgba(159, 242, 255, ${0.8 + 0.2 * Math.sin(animTime * 5)})`
        : 'rgba(159, 242, 255, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(fx, fy, 11, -Math.PI / 2, -Math.PI / 2 + readiness * Math.PI * 2);
      ctx.stroke();
    }
    // On station: a faint watch-circle marks the guarded post — brighter
    // when the warden is free to answer a new call.
    if (!moving && posted) {
      const ready = round.time - warden.movedAt >= cooldown;
      ctx.strokeStyle = ready
        ? `rgba(159, 242, 255, ${0.5 + 0.25 * Math.sin(animTime * 3)})`
        : `rgba(159, 242, 255, 0.22)`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = animTime * 6;
      ctx.beginPath();
      ctx.arc(postPixel.x, postPixel.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawTown(ctx, state, selectedCard, animTime, inspectedId, visuals = { wardens: new Map() }, hover = null) {
  const round = state.round;
  const darkness = getDarkness(round);
  ctx.clearRect(0, 0, CANVAS, CANVAS);
  ctx.save();
  // A structure falling rattles the world, briefly.
  if (!REDUCED_MOTION && visuals.shakeUntil && animTime < visuals.shakeUntil) {
    const power = (visuals.shakeUntil - animTime) * 8;
    ctx.translate(Math.sin(animTime * 70) * power, Math.cos(animTime * 61) * power);
  }
  drawSky(ctx, darkness, animTime);
  drawGround(ctx, round, darkness);
  drawRim(ctx, round, darkness, animTime);
  drawVignette(ctx, round, animTime);
  drawHeart(ctx, round, animTime);
  drawShades(ctx, round, animTime);
  drawSlots(ctx, round, selectedCard, inspectedId, animTime);
  drawThreats(ctx, round, getHoldTime(state));
  drawInspectLinks(ctx, round, inspectedId, animTime);
  if (round.phase === 'day') drawPlacementPreview(ctx, round, selectedCard, hover, animTime);
  drawWardens(ctx, round, animTime, visuals, getWardenCooldown(state));
  drawVeil(ctx, round, darkness, animTime);
  ctx.restore();
}

// A Veiled Night is FELT: pale mist banks drift across the town while
// the towers stand blind.
function drawVeil(ctx, round, darkness, animTime) {
  const veiled = round.phase === 'night' && round.stats?.nights.at(-1)?.omen === 'veiled';
  if (!veiled) return;
  // A flat pall first, then three drifting banks — the mist must READ
  // as mist at a glance, not as a rendering accident.
  ctx.fillStyle = `rgba(186, 196, 216, ${0.10 * darkness})`;
  ctx.fillRect(0, 0, CANVAS, CANVAS);
  const alpha = 0.24 * darkness;
  for (let band = 0; band < 3; band++) {
    const drift = REDUCED_MOTION ? 0 : Math.sin(animTime * (0.12 + band * 0.05) + band * 2.1) * 70;
    const y = CANVAS * (0.22 + band * 0.28) + (REDUCED_MOTION ? 0 : Math.sin(animTime * 0.2 + band) * 12);
    const mist = ctx.createRadialGradient(
      CANVAS / 2 + drift, y, 30, CANVAS / 2 + drift, y, CANVAS * 0.6);
    mist.addColorStop(0, `rgba(200, 210, 228, ${alpha})`);
    mist.addColorStop(0.55, `rgba(196, 206, 224, ${alpha * 0.45})`);
    mist.addColorStop(1, 'rgba(196, 206, 224, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, CANVAS, CANVAS);
  }
}

// Transient hit feedback: bites, falls, and Heart strikes flash on the
// map the moment the engine registers them.
export function drawEffects(ctx, effects, animTime) {
  for (const effect of effects) {
    const age = animTime - effect.start;
    if (effect.type === 'banish' && age < 0.45) {
      // A shade unmade: the smoke collapses inward, gold at the last.
      const t = age / 0.45;
      ctx.strokeStyle = `rgba(176, 106, 208, ${0.8 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 14 * (1 - t) + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 232, 170, ${(1 - t) * 0.9})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'built' && age < 0.55) {
      // A new building settles: a gold ring blooms and fades.
      const alpha = 0.8 * (1 - age / 0.55);
      ctx.strokeStyle = `rgba(255, 208, 130, ${alpha})`;
      ctx.lineWidth = 2.4 * (1 - age / 0.55) + 0.6;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 12 + age * 26, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'bite' && age < 0.35) {
      const alpha = 0.8 * (1 - age / 0.35);
      ctx.strokeStyle = `rgba(224, 138, 90, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 13 + age * 14, 0, Math.PI * 2);
      ctx.stroke();
      // Splinters fly.
      ctx.strokeStyle = `rgba(230, 200, 170, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let s = 0; s < 4; s++) {
        const angle = s * 1.7 + 0.5;
        const reach = 8 + age * 30;
        ctx.moveTo(effect.x + Math.cos(angle) * reach, effect.y + Math.sin(angle) * reach);
        ctx.lineTo(effect.x + Math.cos(angle) * (reach + 3.5), effect.y + Math.sin(angle) * (reach + 3.5));
      }
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
    } else if (effect.type === 'bolt' && age < 0.28) {
      // A tower bolt: a bright lance from tower to victim, then gone.
      const alpha = 1 - age / 0.28;
      ctx.strokeStyle = `rgba(255, 208, 130, ${alpha})`;
      ctx.lineWidth = 2.5 * alpha + 0.5;
      ctx.beginPath();
      ctx.moveTo(effect.from.x, effect.from.y);
      ctx.lineTo(effect.to.x, effect.to.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 246, 224, ${alpha})`;
      ctx.beginPath();
      ctx.arc(effect.to.x, effect.to.y, 3 + age * 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'number' && age < 1.1) {
      // The cost, stated where it happened, drifting toward memory.
      const alpha = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.15) / 0.95);
      const heavy = Math.abs(parseInt(effect.text.replace(/[^0-9-]/g, ''), 10) || 0) >= 18;
      ctx.font = `bold ${heavy ? 18 : 14}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(10, 8, 14, ${alpha * 0.8})`;
      ctx.strokeText(effect.text, effect.x, effect.y - age * 18);
      ctx.fillStyle = `${effect.color || 'rgba(244, 150, 150, '}${alpha})`;
      ctx.fillText(effect.text, effect.x, effect.y - age * 18);
    } else if (effect.type === 'sated' && age < 0.6) {
      // A sated shade disperses: three motes drifting apart and fading.
      const alpha = 0.6 * (1 - age / 0.6);
      ctx.fillStyle = `rgba(176, 106, 208, ${alpha})`;
      for (let mote = 0; mote < 3; mote++) {
        const angle = mote * 2.1 + 0.7;
        ctx.beginPath();
        ctx.arc(
          effect.x + Math.cos(angle) * age * 26,
          effect.y + Math.sin(angle) * age * 26 - age * 10,
          3 * (1 - age / 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.type === 'vent' && age < 0.55) {
      // A shade that found only ash howls at the Heart: a jagged streak
      // from the ruin to the center — the loss has a visible cause.
      const t = age / 0.55;
      const alpha = 0.85 * (1 - t);
      const from = effect.from;
      const to = { x: CANVAS / 2, y: CANVAS / 2 };
      const reach = Math.min(1, t * 1.6);
      ctx.strokeStyle = `rgba(224, 90, 120, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      const segments = 5;
      for (let seg = 1; seg <= segments; seg++) {
        const p = (seg / segments) * reach;
        const jag = seg < segments ? Math.sin(seg * 9.7 + from.x) * 7 * (1 - p) : 0;
        const nx = from.x + (to.x - from.x) * p + jag;
        const ny = from.y + (to.y - from.y) * p - jag;
        ctx.lineTo(nx, ny);
      }
      ctx.stroke();
      // The howl's mouth: a burst where it began.
      ctx.fillStyle = `rgba(224, 90, 120, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(from.x, from.y, 5 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'sweep' && age < 0.9) {
      // Dusk rolls out from the Heart; dawn washes back in — eased, so
      // the wave leaps and then settles.
      const t = age / 0.9;
      const eased = 1 - Math.pow(1 - t, 3);
      const alpha = 0.5 * (1 - t);
      ctx.strokeStyle = `${effect.color}${alpha})`;
      ctx.lineWidth = 14 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(CANVAS / 2, CANVAS / 2, 10 + eased * CANVAS * 0.52, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'sparkle' && age < 0.7) {
      // Dawn thanks the survivors: a small gold glint.
      const alpha = 0.9 * (1 - age / 0.7);
      const reach = 3 + age * 8;
      ctx.strokeStyle = `rgba(255, 224, 150, ${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(effect.x - reach, effect.y); ctx.lineTo(effect.x + reach, effect.y);
      ctx.moveTo(effect.x, effect.y - reach); ctx.lineTo(effect.x, effect.y + reach);
      ctx.stroke();
    } else if (effect.type === 'banner' && age < 2.6) {
      // A title card for the night: fades in, holds, fades out.
      const fadeIn = Math.min(1, age / 0.35);
      const fadeOut = Math.max(0, 1 - Math.max(0, age - 2.0) / 0.6);
      const alpha = fadeIn * fadeOut;
      ctx.font = 'bold 21px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.shadowColor = effect.color ? `${effect.color}0.9)` : 'rgba(255, 208, 130, 0.9)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = `rgba(240, 240, 250, ${alpha})`;
      ctx.fillText(effect.text, CANVAS / 2, 56 - (1 - fadeIn) * 8);
      ctx.restore();
      // An ornament line beneath the title.
      ctx.strokeStyle = effect.color ? `${effect.color}${alpha * 0.7})` : `rgba(255, 208, 130, ${alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CANVAS / 2 - 52, 68);
      ctx.lineTo(CANVAS / 2 + 52, 68);
      ctx.stroke();
      if (effect.subtext) {
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = `rgba(190, 196, 212, ${alpha * 0.9})`;
        ctx.fillText(effect.subtext, CANVAS / 2, 78);
      }
    }
  }
}
