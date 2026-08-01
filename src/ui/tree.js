// The Ember tree's face: veins, medallions, and the flourishes that fire
// when a node kindles. Pure drawing — reads state, never mutates it.
import { LONG_DAWN_NIGHTS, LONG_DAWN_NODE, META_UPGRADES, metaMaxRank, metaNextCost, metaRank, metaStatus } from '../engine/meta.js';

export const TREE = 460;      // logical size; the canvas scales to fit
export const NODE_R = 23;

const BRANCH_COLORS = {
  stone: [206, 184, 142],  // sandstone — muted beside the other two, never grey
  watch: [159, 242, 255],
  ember: [255, 208, 130],
};

const rgb = (c, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function nodePoint(node) {
  return { x: node.at.x * TREE, y: node.at.y * TREE };
}

// Every node the tree draws, upgrades plus the crown.
export function treeNodes() {
  return Object.values(META_UPGRADES);
}

export function treeEdges() {
  const edges = [];
  for (const upgrade of Object.values(META_UPGRADES)) {
    for (const parent of upgrade.requires || []) {
      edges.push({ from: META_UPGRADES[parent], to: upgrade, branch: upgrade.branch });
    }
  }
  return edges;
}

// The pinnacles feed the crown: faint until every one of them is kept.
export function crownEdges() {
  return Object.values(META_UPGRADES)
    .filter(upgrade => upgrade.requiresBestNights)
    .map(upgrade => ({ from: upgrade, to: LONG_DAWN_NODE, branch: upgrade.branch }));
}

// ── Glyphs ──────────────────────────────────────────────────────────────────
// A mark, not a letter — the same doctrine the town map follows. Drawn
// inside radius 12 and scaled.
function glyph(ctx, id, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 12, r / 12);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (id) {
    case 'stoneFoundations': // courses of stone, the lowest widest
      ctx.rect(-7, 1, 14, 4);
      ctx.rect(-5, -4, 10, 4);
      ctx.rect(-3, -9, 6, 4);
      ctx.stroke();
      break;
    case 'morningStockpile': // a second pair of hands: two mallets crossed
      ctx.moveTo(-7, 7); ctx.lineTo(4, -4);
      ctx.moveTo(7, 7); ctx.lineTo(-4, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5, -6, 2.6, 0, Math.PI * 2);
      ctx.arc(-5, -6, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'deeperDrafts': // a fanned hand of cards
      for (let card = -1; card <= 1; card++) {
        ctx.save();
        ctx.rotate(card * 0.32);
        ctx.strokeRect(-3.5, -8, 7, 13);
        ctx.restore();
      }
      break;
    case 'ruinsRemember': // a broken arch that still holds a spark
      ctx.moveTo(-7, 8); ctx.lineTo(-7, -2);
      ctx.quadraticCurveTo(-7, -8, -1, -8);
      ctx.moveTo(7, 8); ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'swiftWarden': // a lantern leaning into its own speed lines
      ctx.moveTo(-1, -7); ctx.lineTo(4, -7); ctx.lineTo(5, 4); ctx.lineTo(0, 4); ctx.closePath();
      ctx.moveTo(-4, -3); ctx.lineTo(-8, -3);
      ctx.moveTo(-4, 1); ctx.lineTo(-9, 1);
      ctx.stroke();
      break;
    case 'secondWarden': // two keepers walking
      for (const dx of [-4, 4]) {
        ctx.moveTo(dx - 2.5, 8); ctx.lineTo(dx, -1); ctx.lineTo(dx + 2.5, 8);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-4, -5, 2.3, 0, Math.PI * 2);
      ctx.arc(4, -5, 2.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'beaconHeart': // a flame ringed by its own light
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-4, 1, -2, -2, 0, -5);
      ctx.bezierCurveTo(2, -2, 4, 1, 0, 4);
      ctx.fill();
      break;
    case 'emberChoir': // three sparks rising in voice
      for (let voice = -1; voice <= 1; voice++) {
        ctx.moveTo(voice * 5, 8);
        ctx.quadraticCurveTo(voice * 5 + 2, 1, voice * 5, -4 - Math.abs(voice) * -2);
      }
      ctx.stroke();
      break;
    case 'outerRing': // a ring beyond the ring
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([2.5, 2.5]);
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'heartstone': // a cut gem holding the light
      ctx.moveTo(0, -8); ctx.lineTo(7, -2); ctx.lineTo(4, 8); ctx.lineTo(-4, 8);
      ctx.lineTo(-7, -2); ctx.closePath();
      ctx.moveTo(-7, -2); ctx.lineTo(7, -2);
      ctx.moveTo(0, -8); ctx.lineTo(0, 8);
      ctx.stroke();
      break;
    case 'emberheart': // a flame that pays out in rays
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-5, 2, -3, -3, 0, -7);
      ctx.bezierCurveTo(3, -3, 5, 2, 0, 6);
      ctx.stroke();
      for (let ray = 0; ray < 4; ray++) {
        const angle = (ray / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 7.5, Math.sin(angle) * 7.5);
        ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
        ctx.stroke();
      }
      break;
    case 'longDawn': // a sun cresting the rim of the world
      ctx.moveTo(-9, 5); ctx.lineTo(9, 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 5, 6, Math.PI, 0);
      ctx.fill();
      for (let ray = 0; ray < 5; ray++) {
        const angle = Math.PI + (ray + 0.5) * (Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, 5 + Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * 11, 5 + Math.sin(angle) * 11);
        ctx.stroke();
      }
      break;
    default:
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}

// ── Veins ───────────────────────────────────────────────────────────────────
function drawVein(ctx, from, to, color, status, animTime) {
  const a = nodePoint(from);
  const b = nodePoint(to);
  // Stop the vein at each medallion's rim so it grows out of the node.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = Math.hypot(dx, dy) || 1;
  const ax = a.x + (dx / span) * NODE_R;
  const ay = a.y + (dy / span) * NODE_R;
  const bx = b.x - (dx / span) * NODE_R;
  const by = b.y - (dy / span) * NODE_R;

  if (status === 'flowing') {
    // Both ends kept: light runs between them.
    ctx.strokeStyle = rgb(color, 0.5);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = rgb(color, 0.95);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Motes carried along the vein, so a kept root is visibly alive.
    if (!REDUCED_MOTION) {
      for (let mote = 0; mote < 2; mote++) {
        const t = ((animTime * 0.35 + mote / 2 + ax * 0.01) % 1);
        ctx.fillStyle = rgb([255, 246, 224], 0.75 * Math.sin(t * Math.PI));
        ctx.beginPath();
        ctx.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  // Open (parent kept, the way ahead lit) or dormant.
  const open = status === 'open';
  ctx.strokeStyle = rgb(color, open ? 0.45 : 0.14);
  ctx.lineWidth = open ? 1.8 : 1.2;
  ctx.setLineDash(open ? [5, 5] : [3, 6]);
  ctx.lineDashOffset = open && !REDUCED_MOTION ? -animTime * 9 : 0;
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Medallions ──────────────────────────────────────────────────────────────
function drawMedallion(ctx, node, state, status, color, animTime, focused) {
  const { x, y } = nodePoint(node);
  const rank = metaRank(state, node.id);
  const maxRank = metaMaxRank(node.id);
  const kept = rank >= 1;
  const ready = status === 'ready';

  if (kept) {
    // Kept nodes burn: a pool of their branch's light beneath them.
    const halo = ctx.createRadialGradient(x, y, 2, x, y, NODE_R * 2.1);
    halo.addColorStop(0, rgb(color, 0.30));
    halo.addColorStop(1, rgb(color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - NODE_R * 2.1, y - NODE_R * 2.1, NODE_R * 4.2, NODE_R * 4.2);
  }

  // The seat.
  const seat = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, NODE_R);
  seat.addColorStop(0, kept ? '#2e2411' : '#232838');
  seat.addColorStop(1, kept ? '#160f06' : '#0c0e18');
  ctx.fillStyle = seat;
  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.fill();

  // The rim says the status at a glance.
  const pulse = REDUCED_MOTION ? 0.85 : 0.7 + 0.3 * Math.sin(animTime * 3);
  if (status === 'maxed') {
    ctx.strokeStyle = rgb(color, 1);
    ctx.lineWidth = 2.6;
  } else if (kept) {
    ctx.strokeStyle = rgb(color, 0.95);
    ctx.lineWidth = 2.2;
  } else if (ready) {
    ctx.strokeStyle = rgb(color, pulse);
    ctx.lineWidth = 2;
  } else if (status === 'costly') {
    ctx.strokeStyle = 'rgba(120, 130, 152, 0.7)';
    ctx.lineWidth = 1.4;
  } else {
    ctx.strokeStyle = status === 'sealed' ? 'rgba(150, 130, 90, 0.6)' : 'rgba(90, 99, 120, 0.5)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
  }
  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (ready) {
    // A ready node wears a second, breathing ring: Embers in hand.
    ctx.strokeStyle = rgb(color, (pulse - 0.55) * 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, NODE_R + 4 + (REDUCED_MOTION ? 0 : Math.sin(animTime * 3) * 1.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (focused) {
    ctx.strokeStyle = '#ffd082';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, NODE_R + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ranked nodes wear a gauge: one arc segment per rank, lit as poured.
  // At a glance the tree shows not just what is kept but how deep it runs.
  if (maxRank > 1) {
    const gap = 0.16;
    const span = (Math.PI * 2) / maxRank;
    for (let seat = 0; seat < maxRank; seat++) {
      const from = -Math.PI / 2 + seat * span + gap / 2;
      ctx.strokeStyle = seat < rank ? rgb(color, 0.95) : 'rgba(96, 106, 128, 0.5)';
      ctx.lineWidth = seat < rank ? 3 : 1.6;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + 6, from, from + span - gap);
      ctx.stroke();
    }
  }

  const ink = kept ? rgb(color, 1)
    : ready ? rgb(color, 0.9)
    : status === 'costly' ? 'rgba(150, 160, 180, 0.75)'
    : status === 'sealed' ? 'rgba(168, 150, 105, 0.7)'
    : 'rgba(110, 120, 140, 0.45)';
  glyph(ctx, node.id, x, y, 13, ink);

  // A sealed node wears the vigil it waits for; a priced one, its price.
  if (status === 'sealed') {
    label(ctx, `${node.requiresBestNights}n vigil`, x, y, 'rgba(190, 168, 115, 0.95)');
  } else if (status === 'maxed') {
    label(ctx, maxRank > 1 ? 'full' : 'kept', x, y, rgb(color, 0.8));
  } else if (status === 'ready' || status === 'costly') {
    label(ctx, `${metaNextCost(state, node.id)} ✦`, x, y,
      status === 'ready' ? rgb(color, 0.95) : 'rgba(130, 142, 164, 0.9)');
  }
}

// Labels sit where veins run, so they carry their own darkness with them.
function label(ctx, text, x, y, color) {
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(8, 9, 15, 0.92)';
  ctx.strokeText(text, x, y + NODE_R + 10);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + NODE_R + 10);
}

function drawCrown(ctx, state, animTime, focused) {
  const open = Object.keys(META_UPGRADES).every(id => metaRank(state, id) >= 1);
  const complete = open && state.bestNights >= LONG_DAWN_NIGHTS;
  const color = [255, 232, 176];
  const { x, y } = nodePoint(LONG_DAWN_NODE);
  if (complete || open) {
    const halo = ctx.createRadialGradient(x, y, 2, x, y, NODE_R * 2.6);
    halo.addColorStop(0, rgb(color, complete ? 0.42 : 0.18));
    halo.addColorStop(1, rgb(color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - NODE_R * 2.6, y - NODE_R * 2.6, NODE_R * 5.2, NODE_R * 5.2);
  }
  const seat = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, NODE_R);
  seat.addColorStop(0, complete ? '#3a2d12' : '#1a1726');
  seat.addColorStop(1, complete ? '#1a1206' : '#0c0e18');
  ctx.fillStyle = seat;
  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = complete ? rgb(color, 0.95) : open ? rgb(color, 0.6) : 'rgba(120, 108, 80, 0.45)';
  ctx.lineWidth = complete ? 2.4 : 1.4;
  if (!complete) ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (focused) {
    ctx.strokeStyle = '#ffd082';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, NODE_R + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  glyph(ctx, 'longDawn', x, y, 13,
    complete ? rgb(color, 1) : open ? rgb(color, 0.8) : 'rgba(130, 122, 100, 0.5)');
  label(ctx,
    complete ? 'the Long Dawn' : `${Math.min(state.bestNights, LONG_DAWN_NIGHTS)}/${LONG_DAWN_NIGHTS}n`,
    x, y, complete ? rgb(color, 0.95) : 'rgba(150, 140, 112, 0.85)');
}

// ── The frame ───────────────────────────────────────────────────────────────
export function drawTree(ctx, state, animTime, effects, focusedId) {
  ctx.clearRect(0, 0, TREE, TREE);
  const allKept = Object.keys(META_UPGRADES).every(id => metaRank(state, id) >= 1);

  for (const edge of crownEdges()) {
    drawVein(ctx, edge.from, edge.to, [255, 232, 176],
      allKept ? 'flowing' : metaRank(state, edge.from.id) >= 1 ? 'open' : 'dormant', animTime);
  }
  for (const edge of treeEdges()) {
    const color = BRANCH_COLORS[edge.branch];
    const status = metaRank(state, edge.to.id) >= 1 ? 'flowing'
      : metaRank(state, edge.from.id) >= 1 ? 'open' : 'dormant';
    drawVein(ctx, edge.from, edge.to, color, status, animTime);
  }
  drawCrown(ctx, state, animTime, focusedId === 'longDawn');
  for (const node of treeNodes()) {
    drawMedallion(ctx, node, state, metaStatus(state, node.id), BRANCH_COLORS[node.branch],
      animTime, focusedId === node.id);
  }
  drawTreeEffects(ctx, effects, animTime);
}

// ── Flourishes ──────────────────────────────────────────────────────────────
// What a kindling looks like: light runs up the vein that fed it, the
// medallion blooms, and the branch throws sparks.
export function kindleEffects(upgrade, animTime) {
  const born = [];
  for (const parent of upgrade.requires || []) {
    born.push({ type: 'ignite', from: META_UPGRADES[parent], to: upgrade, branch: upgrade.branch, start: animTime });
  }
  born.push({ type: 'bloom', node: upgrade, branch: upgrade.branch, start: animTime + 0.18 });
  for (let spark = 0; spark < 16; spark++) {
    born.push({
      type: 'spark',
      node: upgrade,
      branch: upgrade.branch,
      angle: (spark / 16) * Math.PI * 2,
      reach: 34 + (spark % 4) * 11,
      start: animTime + 0.18,
    });
  }
  return born;
}

// A whole root kept: light washes down every vein it owns.
export function branchWashEffect(branchId, animTime) {
  return { type: 'wash', branch: branchId, start: animTime };
}

export function pruneTreeEffects(effects, animTime) {
  let write = 0;
  for (let read = 0; read < effects.length; read += 1) {
    if (animTime - effects[read].start < 2.4) effects[write++] = effects[read];
  }
  effects.length = write;
}

function drawTreeEffects(ctx, effects, animTime) {
  for (const effect of effects) {
    const age = animTime - effect.start;
    if (age < 0) continue;
    const color = BRANCH_COLORS[effect.branch] || [255, 208, 130];
    if (effect.type === 'ignite' && age < 0.45) {
      // Light runs from the parent into the new node.
      const a = nodePoint(effect.from);
      const b = nodePoint(effect.to);
      const t = age / 0.45;
      const head = Math.min(1, t * 1.25);
      const tail = Math.max(0, t * 1.25 - 0.35);
      ctx.strokeStyle = rgb([255, 246, 224], 0.95 * (1 - t * 0.5));
      ctx.lineWidth = 4 * (1 - t) + 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
      ctx.lineTo(a.x + (b.x - a.x) * head, a.y + (b.y - a.y) * head);
      ctx.stroke();
    } else if (effect.type === 'bloom' && age < 0.85) {
      const t = age / 0.85;
      const { x, y } = nodePoint(effect.node);
      ctx.strokeStyle = rgb(color, 0.9 * (1 - t));
      ctx.lineWidth = 4 * (1 - t) + 0.8;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R + t * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 246, 224, ${0.55 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(x, y, NODE_R * (1 - t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'spark' && age < 1.1) {
      const t = age / 1.1;
      const { x, y } = nodePoint(effect.node);
      const out = effect.reach * (1 - Math.pow(1 - t, 2.2));
      // Sparks rise as they fade — embers, not shrapnel.
      const sx = x + Math.cos(effect.angle) * out;
      const sy = y + Math.sin(effect.angle) * out - t * t * 22;
      ctx.fillStyle = rgb(mixWhite(color, 0.4), 0.95 * (1 - t));
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6 * (1 - t) + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'wash' && age < 1.6) {
      // The root is finished: every vein in it floods at once.
      const t = age / 1.6;
      for (const edge of treeEdges().filter(candidate => candidate.branch === effect.branch)) {
        const a = nodePoint(edge.from);
        const b = nodePoint(edge.to);
        const at = Math.max(0, Math.min(1, t * 2 - 0.2));
        ctx.strokeStyle = rgb([255, 246, 224], 0.85 * (1 - t));
        ctx.lineWidth = 5 * (1 - t) + 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * at, a.y + (b.y - a.y) * at);
        ctx.stroke();
      }
    }
  }
}

const mixWhite = (c, amount) => c.map(value => Math.round(value + (255 - value) * amount));
