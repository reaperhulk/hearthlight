// All canvas rendering for the town map. Pure drawing — reads state, never
// mutates it. The engine stays headless; this file is the game's face.
import { HEART_MAX } from '../engine/round.js';
import { getNightForecast, HEART_SLOT, SHADE_FEED_TIME } from '../engine/night.js';
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
    // A wisp, not a dot: a bright core inside a smoky body, with two
    // trailing lobes strung back along its path.
    const span = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const backX = (from.x - to.x) / span;
    const backY = (from.y - to.y) / span;
    const wave = Math.sin(animTime * 5 + shade.id * 1.7);
    const held = shade.phase === 'held';
    for (let lobe = 2; lobe >= 0; lobe--) {
      const drift = lobe * (5 + wave);
      const lx = drawX + backX * drift + backY * wave * lobe * 2;
      const ly = drawY + backY * drift - backX * wave * lobe * 2;
      const lr = radius * (1 - lobe * 0.28);
      ctx.fillStyle = held
        ? `rgba(230, 199, 102, ${0.75 - lobe * 0.22})`
        : `rgba(176, 106, 208, ${0.7 - lobe * 0.2})`;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Eyes of the dark: two pinpricks facing the prize.
    ctx.fillStyle = held ? '#fff6e0' : '#e8d6f5';
    ctx.beginPath();
    ctx.arc(drawX - backY * 2.2 - backX * 1.5, drawY + backX * 2.2 - backY * 1.5, 0.9, 0, Math.PI * 2);
    ctx.arc(drawX + backY * 2.2 - backX * 1.5, drawY - backX * 2.2 - backY * 1.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
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
      // With a card in hand, open ground beckons.
      const pulse = selectedCard ? 0.55 + 0.3 * Math.sin(animTime * 3.2 + slot.x * 7) : 0.4;
      ctx.strokeStyle = selectedCard ? `rgba(230, 199, 102, ${pulse})` : `rgba(140, 140, 170, ${pulse})`;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const color = STRUCTURE_COLORS[slot.structure.type] || '#aeb8c5';
    // Dark base disc with a colored ring, silhouette glyph inside.
    ctx.fillStyle = '#10121c';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.stroke();
    drawStructureGlyph(ctx, slot.structure.type, x, y, 8.5, color);
    // Level pips: one per level above 1.
    for (let pip = 0; pip < slot.structure.level - 1; pip++) {
      ctx.fillStyle = '#ffd082';
      ctx.beginPath();
      ctx.arc(x + 11 - pip * 7, y - 11, 3, 0, Math.PI * 2);
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
function drawThreats(ctx, round) {
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

// Inspecting a building lights up its actual relationships.
function drawInspectLinks(ctx, round, inspectedId, animTime) {
  if (!inspectedId) return;
  const slot = round.slots.find(candidate => candidate.id === inspectedId);
  if (!slot?.structure) return;
  const origin = slotPixel(slot);
  for (const neighbor of getAdjacentSlots(round.slots, inspectedId)) {
    if (!neighbor.structure) continue;
    drawLink(ctx, origin, slotPixel(neighbor), 'rgba(159, 242, 255, ALPHA)', 0.45, animTime);
  }
}

// The warden is a lantern-bearer, not a ring. Render-side smoothing walks
// them between posts; `visuals` persists across frames (UI-only state).
function drawWardens(ctx, round, animTime, visuals) {
  const dt = Math.min(0.1, Math.max(0.001, animTime - (visuals.lastTime ?? animTime)));
  visuals.lastTime = animTime;
  for (const warden of round.wardens) {
    if (!warden.slotId) continue;
    const slot = round.slots.find(candidate => candidate.id === warden.slotId);
    if (!slot && warden.slotId !== HEART_SLOT) continue;
    const target = slot ? slotPixel(slot) : { x: CANVAS / 2, y: CANVAS / 2 };
    let pos = visuals.wardens.get(warden.id);
    if (!pos) { pos = { ...target }; visuals.wardens.set(warden.id, pos); }
    pos.x += (target.x - pos.x) * Math.min(1, dt * 7);
    pos.y += (target.y - pos.y) * Math.min(1, dt * 7);
    const moving = Math.hypot(target.x - pos.x, target.y - pos.y) > 2;

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

    // On station: a faint watch-circle marks the guarded post.
    if (!moving) {
      ctx.strokeStyle = `rgba(159, 242, 255, ${0.35 + 0.15 * Math.sin(animTime * 3)})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = animTime * 6;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawTown(ctx, state, selectedCard, animTime, inspectedId, visuals = { wardens: new Map() }, hover = null) {
  const round = state.round;
  const darkness = getDarkness(round);
  ctx.clearRect(0, 0, CANVAS, CANVAS);
  drawSky(ctx, darkness, animTime);
  drawGround(ctx, round);
  drawRim(ctx, round, darkness, animTime);
  drawVignette(ctx, round, animTime);
  drawHeart(ctx, round, animTime);
  drawShades(ctx, round, animTime);
  drawSlots(ctx, round, selectedCard, inspectedId, animTime);
  drawThreats(ctx, round);
  drawInspectLinks(ctx, round, inspectedId, animTime);
  if (round.phase === 'day') drawPlacementPreview(ctx, round, selectedCard, hover, animTime);
  drawWardens(ctx, round, animTime, visuals);
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
    } else if (effect.type === 'sweep' && age < 0.9) {
      // Dusk rolls out from the Heart; dawn washes back in.
      const alpha = 0.5 * (1 - age / 0.9);
      ctx.strokeStyle = `${effect.color}${alpha})`;
      ctx.lineWidth = 14 * (1 - age / 0.9) + 2;
      ctx.beginPath();
      ctx.arc(CANVAS / 2, CANVAS / 2, 10 + (age / 0.9) * CANVAS * 0.52, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.type === 'banner' && age < 2.6) {
      // A title card for the night: fades in, holds, fades out.
      const fadeIn = Math.min(1, age / 0.35);
      const fadeOut = Math.max(0, 1 - Math.max(0, age - 2.0) / 0.6);
      const alpha = fadeIn * fadeOut;
      ctx.font = 'bold 19px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.shadowColor = effect.color ? `${effect.color}0.9)` : 'rgba(255, 208, 130, 0.9)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = `rgba(240, 240, 250, ${alpha})`;
      ctx.fillText(effect.text, CANVAS / 2, 56 - (1 - fadeIn) * 8);
      ctx.restore();
      if (effect.subtext) {
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = `rgba(190, 196, 212, ${alpha * 0.9})`;
        ctx.fillText(effect.subtext, CANVAS / 2, 78);
      }
    }
  }
}
