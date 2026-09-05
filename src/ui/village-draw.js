import {
  BUILDINGS,
  ENEMIES,
  TOWNS,
  createMap,
  mapLanes,
  routePoint,
} from "../engine/content.js";
import { buildingRange, maxHp } from "../engine/campaign.js";

export const SIZE = 720;
const hash = (n) => {
  const v = Math.sin(n * 73.13 + 17.2) * 4327.2;
  return v - Math.floor(v);
};
const pt = (p) => ({ x: p.x * SIZE, y: p.y * SIZE });
const circle = (ctx, x, y, r, fill) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};
function path(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function tree(ctx, x, y, s, tone) {
  ctx.fillStyle = "#343c32";
  ctx.fillRect(x - s * 0.08, y, s * 0.16, s * 0.65);
  path(
    ctx,
    [
      [x, y - s],
      [x - s * 0.58, y + s * 0.3],
      [x + s * 0.58, y + s * 0.3],
    ],
    tone,
  );
  path(
    ctx,
    [
      [x, y - s],
      [x, y + s * 0.3],
      [x + s * 0.58, y + s * 0.3],
    ],
    "#132c29",
  );
}

export function paintGround(ctx, town, dark = false) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = dark ? "#142528" : "#263f36";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const ground = ctx.createRadialGradient(360, 360, 40, 360, 360, 355);
  ground.addColorStop(0, dark ? "#33423a" : "#718064");
  ground.addColorStop(0.65, dark ? "#223b33" : "#415f44");
  ground.addColorStop(1, dark ? "#12282b" : "#203c33");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (town === "marsh") {
    ctx.strokeStyle = dark ? "#1b454a" : "#49736b";
    ctx.lineWidth = 70;
    ctx.beginPath();
    ctx.moveTo(10, 480);
    ctx.bezierCurveTo(230, 160, 450, 650, 740, 210);
    ctx.stroke();
  }
  for (let i = 0; i < 100; i++) {
    const x = hash(i) * SIZE,
      y = hash(i + 100) * SIZE;
    circle(ctx, x, y, 0.7 + hash(i + 200) * 1.8, dark ? "#45615a" : "#85936b");
  }
  const { lanes, slots } = createMap(town);
  for (const lane of lanes) {
    for (const [width, color] of [
      [34, "#253b31"],
      [27, dark ? "#5a6250" : "#aa9b72"],
      [20, dark ? "#666b55" : "#c1b184"],
    ]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = pt(routePoint(lane, i / 30, town));
        if (!i) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const p = pt(routePoint(lane, i / 20, town));
      circle(
        ctx,
        p.x + hash(i + lane.id * 50) * 10 - 5,
        p.y + 3,
        1.8,
        "#746d52",
      );
    }
    const p = pt(routePoint(lane, 0.035, town));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(lane.angle + Math.PI);
    path(
      ctx,
      [
        [-7, -7],
        [4, 0],
        [-7, 7],
      ],
      null,
      "#ede0ad",
      2,
    );
    ctx.restore();
  }
  for (let i = 0; i < 74; i++) {
    const angle = hash(i + 300) * Math.PI * 2,
      radius = 285 + hash(i + 400) * 100;
    const x = 360 + Math.cos(angle) * radius,
      y = 360 + Math.sin(angle) * radius;
    const nearRoad = lanes.some((lane) => {
      const p = pt(routePoint(lane, 0.1, town));
      return Math.hypot(x - p.x, y - p.y) < 49;
    });
    if (!nearRoad)
      tree(
        ctx,
        x,
        y,
        20 + hash(i + 500) * 23,
        dark ? "#26443c" : town === "ridge" ? "#52604a" : "#365b42",
      );
  }
  for (const slot of slots) {
    const p = pt(slot);
    circle(ctx, p.x, p.y + 5, 24, "#152d2580");
    circle(ctx, p.x, p.y, 23, dark ? "#4b5b45" : "#85916c");
    ctx.strokeStyle = dark ? "#80907680" : "#b8c096";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  circle(ctx, 360, 360, 55, dark ? "#526353" : "#a2a580");
  circle(ctx, 360, 360, 47, dark ? "#344138" : "#6e7659");
  for (let i = 0; i < 15; i++) {
    const a = (i * Math.PI * 2) / 15;
    circle(ctx, 360 + Math.cos(a) * 50, 360 + Math.sin(a) * 50, 4, "#c0b590");
  }
  // A few permanent cottages make the central hearth a home.
  cottage(ctx, 323, 385, 0.55);
  cottage(ctx, 402, 374, 0.5);
  cottage(ctx, 365, 410, 0.48);
}

function cottage(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  path(
    ctx,
    [
      [-20, -6],
      [17, -6],
      [17, 21],
      [-20, 21],
    ],
    "#d7c08b",
    "#433e32",
    2,
  );
  path(
    ctx,
    [
      [-26, -5],
      [-2, -26],
      [25, -5],
    ],
    "#a96046",
    "#503c32",
    2,
  );
  ctx.fillStyle = "#553f33";
  ctx.fillRect(-3, 4, 9, 17);
  ctx.fillStyle = "#ffd88a";
  ctx.fillRect(-14, 3, 7, 8);
  ctx.fillRect(9, 1, 5, 7);
  ctx.restore();
}

export function drawBuilding(ctx, type, x, y, scale = 1, branch = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#13251d66";
  ctx.beginPath();
  ctx.ellipse(2, 16, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (type === "farm") {
    path(
      ctx,
      [
        [-25, -10],
        [21, -10],
        [25, 18],
        [-22, 18],
      ],
      "#594838",
      "#a39763",
      1,
    );
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5; col++) {
        const px = -18 + col * 8 + row,
          py = -5 + row * 8;
        ctx.strokeStyle = "#b4c776";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py + 4);
        ctx.lineTo(px, py - 4);
        ctx.stroke();
        path(
          ctx,
          [
            [px, py],
            [px - 4, py - 4],
            [px - 3, py + 1],
          ],
          branch === "harvest" ? "#e8c96e" : "#8bb16b",
        );
        path(
          ctx,
          [
            [px, py],
            [px + 4, py - 5],
            [px + 3, py + 1],
          ],
          "#b6cc7c",
        );
      }
    if (branch === "supplies") {
      ctx.fillStyle = "#d4be91";
      ctx.fillRect(13, 6, 15, 12);
      ctx.strokeStyle = "#86684c";
      ctx.strokeRect(13, 6, 15, 12);
    }
  } else if (type === "wall") {
    for (let i = 0; i < 6; i++) {
      const px = -25 + i * 9;
      path(
        ctx,
        [
          [px, 18],
          [px, -13],
          [px + 4, -20],
          [px + 8, -13],
          [px + 8, 18],
        ],
        branch === "stone" ? "#a1aaa1" : "#ad885a",
        "#544a36",
        1.5,
      );
    }
    ctx.fillStyle = branch === "stone" ? "#777f78" : "#705538";
    ctx.fillRect(-27, -2, 56, 5);
    ctx.fillRect(-27, 10, 56, 5);
    if (branch === "thorns")
      for (let i = 0; i < 5; i++)
        path(
          ctx,
          [
            [-24 + i * 12, 15],
            [-29 + i * 12, -5],
            [-17 + i * 12, 13],
          ],
          "#dae0bf",
          "#667255",
          1,
        );
  } else if (type === "tower") {
    path(
      ctx,
      [
        [-17, 20],
        [-12, -24],
        [13, -24],
        [19, 20],
      ],
      "#cbbd93",
      "#594f3e",
      2,
    );
    ctx.fillStyle = "#a09171";
    ctx.fillRect(-14, -8, 29, 5);
    ctx.fillRect(-16, 7, 33, 4);
    path(
      ctx,
      [
        [-23, -23],
        [0, -41],
        [24, -23],
      ],
      branch === "volley" ? "#678e85" : "#af6445",
      "#654d37",
      2,
    );
    ctx.fillStyle = "#344b45";
    ctx.fillRect(-5, -18, 10, 14);
    ctx.strokeStyle = "#efd193";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -23);
    ctx.lineTo(15, -33);
    ctx.stroke();
    if (branch === "pierce") {
      ctx.fillStyle = "#efd18a";
      ctx.fillRect(-2, -42, 4, 14);
    }
  } else {
    ctx.strokeStyle = "#675139";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(0, -26);
    ctx.lineTo(13, -26);
    ctx.stroke();
    path(
      ctx,
      [
        [8, -26],
        [18, -26],
        [21, -18],
        [16, -7],
        [9, -8],
        [6, -18],
      ],
      branch === "courage" ? "#91dece" : "#f2d182",
      "#755e3f",
      2,
    );
    circle(ctx, 13, -17, 4, "#fff5be");
    circle(ctx, 0, 20, 7, "#84947b");
  }
  if (branch) {
    circle(ctx, 21, 17, 5, "#e8cf8c");
    circle(ctx, 21, 17, 2, "#53694d");
  }
  ctx.restore();
}

export function paintBuildings(ctx, r, contrast = false) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (const slot of r.slots)
    if (slot.building) {
      const p = pt(slot);
      drawBuilding(ctx, slot.building.type, p.x, p.y, 1, slot.building.branch);
      const hp = slot.building.hp / maxHp(slot.building, r.kit);
      if (contrast) {
        ctx.strokeStyle = "#fff4c9";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 27, p.y - 26, 54, 51);
      }
      if (hp < 0.65) {
        path(ctx, [[p.x - 4, p.y - 18], [p.x + 2, p.y - 9], [p.x - 3, p.y], [p.x + 5, p.y + 14]], null, "#322d29", 3);
      }
      if (hp < 0.98) {
        ctx.fillStyle = "#182923";
        ctx.fillRect(p.x - 19, p.y + 25, 38, 4);
        ctx.fillStyle = hp < 0.3 ? "#e19174" : "#a5c29b";
        ctx.fillRect(p.x - 19, p.y + 25, 38 * hp, 4);
      }
    }
}

const sprites = new Map();
function enemySprite(type) {
  if (sprites.has(type)) return sprites.get(type);
  const canvas = document.createElement("canvas");
  canvas.width = 60;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  const size = type === "brute" ? 19 : type === "runner" ? 10 : 13;
  const x = 30,
    y = 34;
  circle(ctx, x, y, size + 7, `${ENEMIES[type].color}15`);
  path(
    ctx,
    [
      [x - size, y + size],
      [x - size * 0.8, y - 4],
      [x - size * 0.5, y - size],
      [x + size * 0.5, y - size],
      [x + size, y],
      [x + size * 0.8, y + size],
      [x + 4, y + size - 5],
      [x - 3, y + size + 3],
    ],
    ENEMIES[type].color,
    "#272b3b",
    2,
  );
  if (type === "brute") {
    path(
      ctx,
      [
        [x - 16, y - 8],
        [x - 24, y - 20],
        [x - 8, y - 16],
      ],
      "#dbb6b1",
    );
    path(
      ctx,
      [
        [x + 16, y - 8],
        [x + 24, y - 20],
        [x + 8, y - 16],
      ],
      "#dbb6b1",
    );
  }
  if (type === "mist") {
    ctx.strokeStyle = "#94dbda";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 23, 9, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  circle(ctx, x - 4, y - 3, 2, "#fff5d6");
  circle(ctx, x + 4, y - 3, 2, "#fff5d6");
  sprites.set(type, canvas);
  return canvas;
}

export function paintLiving(
  ctx,
  r,
  previous,
  mix,
  selected,
  motion,
  clock,
  effectTimes = null,
  intensity = 1,
  contrast = false,
) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  const lanes = mapLanes(r.town);
  const decorative = motion && intensity > 0;
  if (contrast) for (const lane of lanes) {
    ctx.strokeStyle = "#f4e8ba88"; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = pt(routePoint(lane, i / 24, r.town)); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }
  if (selected) {
    const slot = r.slots.find((s) => s.id === selected);
    if (slot) {
      const p = pt(slot);
      const range = slot.building && buildingRange(slot.building);
      if (range) {
        circle(ctx, p.x, p.y, range * SIZE, "#e4d7990c");
        ctx.strokeStyle = "#e4d79977";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, range * SIZE, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "#fff1bb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 29, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const slot of r.slots)
    if (slot.building?.type === "lantern") {
      const p = pt(slot);
      circle(ctx, p.x, p.y, buildingRange(slot.building) * SIZE, "#f4d9950b");
    }
  // A small bounded glow; terrain and town never repaint for flame motion.
  const glow = ctx.createRadialGradient(360, 348, 4, 360, 350, 66);
  glow.addColorStop(0, "#ffce8a44");
  glow.addColorStop(1, "#ffce8a00");
  ctx.fillStyle = glow;
  ctx.fillRect(294, 284, 132, 132);
  const flicker = decorative ? Math.sin(clock * 4) * 3 : 0;
  path(
    ctx,
    [
      [348, 362],
      [343, 350],
      [350, 332],
      [359, 318 + flicker],
      [365, 334],
      [374, 343],
      [372, 358],
      [363, 365],
    ],
    "#eaa45e",
  );
  path(
    ctx,
    [
      [353, 358],
      [353, 345],
      [360, 333 + flicker],
      [367, 351],
      [364, 361],
    ],
    "#ffe7a6",
  );
  const total = TOWNS[r.town].nights;
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / total;
    circle(
      ctx,
      360 + Math.cos(a) * 40,
      353 + Math.sin(a) * 40,
      4,
      i < r.completed ? "#ffda83" : "#a6aa7970",
    );
  }
  const previousEnemies = new Map(previous?.enemies.map(e => [e.id, e]) || []);
  for (const enemy of r.enemies) {
    const old = previousEnemies.get(enemy.id);
    const progress = old
      ? old.progress + (enemy.progress - old.progress) * mix
      : enemy.progress;
    const p = pt(routePoint(lanes[enemy.lane], progress, r.town));
    const bob =
      decorative && enemy.stun <= 0 ? Math.sin(clock * 5 + enemy.lane) * 2 : 0;
    ctx.drawImage(enemySprite(enemy.type), p.x - 30, p.y - 37 + bob);
    if (contrast) {
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, enemy.type === "brute" ? 25 : 19, 0, Math.PI * 2); ctx.stroke();
    }
    if (enemy.id === r.warden.targetEnemy) {
      ctx.strokeStyle = "#9ff5e0"; ctx.lineWidth = 3;
      path(ctx, [[p.x - 9, p.y - 34], [p.x, p.y - 29], [p.x + 9, p.y - 34]], null, "#9ff5e0", 3);
    }
    if (enemy.type === "mist" && enemy.stun <= 0) {
      ctx.strokeStyle = contrast ? "#e2ffff" : "#97dcd677"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.arc(p.x, p.y, 0.14 * SIZE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (enemy.hp < enemy.maxHp) {
      ctx.fillStyle = "#172729";
      ctx.fillRect(p.x - 12, p.y - 27, 24, 3);
      ctx.fillStyle = "#e5a199";
      ctx.fillRect(p.x - 12, p.y - 27, (24 * enemy.hp) / enemy.maxHp, 3);
    }
    if (enemy.stun > 0) {
      ctx.strokeStyle = "#b5ebda";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (enemy.windup < ENEMIES[enemy.type].interval - 0.05) {
      ctx.strokeStyle = "#f6b195";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        22,
        -Math.PI / 2,
        -Math.PI / 2 +
          (1 - enemy.windup / ENEMIES[enemy.type].interval) * Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  const old = previous?.warden ?? r.warden;
  const w = {
    x: (old.x + (r.warden.x - old.x) * mix) * SIZE,
    y: (old.y + (r.warden.y - old.y) * mix) * SIZE,
  };
  if (r.warden.deployed) {
    const target = pt({ x: r.warden.targetX, y: r.warden.targetY });
    ctx.strokeStyle = "#a1e7d8"; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#b6efdf"; ctx.fillRect(target.x, target.y - 17, 2, 18);
    path(ctx, [[target.x + 2, target.y - 17], [target.x + 13, target.y - 13], [target.x + 2, target.y - 8]], "#b6efdf");
    ctx.strokeStyle = contrast ? "#b6ffec" : "#a7ddd077";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 0.14 * SIZE, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (r.warden.deployed) {
    ctx.strokeStyle = "#9ff5e0"; ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(w.x, w.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - r.warden.cooldown / 1.1)); ctx.stroke();
  }
  circle(ctx, w.x, w.y + 9, 11, "#0c292b55");
  path(
    ctx,
    [
      [w.x - 10, w.y + 10],
      [w.x - 7, w.y - 6],
      [w.x, w.y - 12],
      [w.x + 8, w.y - 5],
      [w.x + 11, w.y + 11],
    ],
    "#87c7b8",
    "#e0efce",
    1.5,
  );
  circle(ctx, w.x, w.y - 12, 4, "#edc992");
  ctx.strokeStyle = "#d5b079";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w.x + 12, w.y + 10);
  ctx.lineTo(w.x + 12, w.y - 13);
  ctx.stroke();
  circle(ctx, w.x + 12, w.y - 12, 4, "#fff0aa");
  for (const e of r.events) {
    const age = effectTimes
      ? clock - (effectTimes.get(e.id) ?? clock)
      : r.time - e.time;
    if (age < 0 || age > 0.75) continue;
    ctx.globalAlpha = 1 - age / 0.75;
    if (e.type === "hit" && e.from && e.to) {
      const from = pt(e.from), to = pt(e.to), travel = e.source === "tower" ? 0.16 : 0.08;
      const f = motion ? Math.min(1, age / travel) : 1;
      const x = from.x + (to.x - from.x) * f, y = from.y + (to.y - from.y) * f;
      ctx.strokeStyle = e.source === "tower" ? "#ffe2a0" : "#bdeddb";
      ctx.lineWidth = e.source === "tower" ? 2 : 4;
      if (f < 1) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (to.x - from.x) * 0.13, y - (to.y - from.y) * 0.13); ctx.stroke();
        circle(ctx, x, y, 2.5, "#fff4c4");
      } else if (age < 0.45) {
        ctx.beginPath(); ctx.arc(to.x, to.y, 7 + (decorative ? (age - travel) * 22 : 0), 0, Math.PI * 2); ctx.stroke();
        if (!motion) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
      }
    }
    if (["bite", "fall"].includes(e.type) && Number.isFinite(e.x)) {
      const p = pt(e); ctx.strokeStyle = "#ffc0a4"; ctx.lineWidth = 3;
      ctx.strokeRect(p.x - 26, p.y - 24, 52, 48);
      if (e.type === "fall") path(ctx, [[p.x - 12, p.y - 10], [p.x + 12, p.y + 10], [p.x, p.y], [p.x + 12, p.y - 10], [p.x - 12, p.y + 10]], null, "#ffc0a4", 3);
    }
    if (e.type === "burst") {
      const p = pt(routePoint(lanes[e.lane], 0.55, r.town));
      ctx.strokeStyle = "#ffecb0";
      ctx.lineWidth = decorative ? 5 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 40 + (decorative ? age * 120 : 0), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (
      ["banish", "build", "repair", "upgrade"].includes(e.type) &&
      Number.isFinite(e.x)
    ) {
      ctx.strokeStyle = e.type === "banish" ? "#c5ede0" : "#f3de9e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        e.x * SIZE,
        e.y * SIZE,
        12 + (decorative ? age * 25 : 0),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (e.type === "heart") {
      ctx.strokeStyle = "#f4a58a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(360, 360, 58, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (["day", "won"].includes(r.phase) && decorative) {
    for (let i = 0; i < Math.ceil(intensity * 6); i++) {
      const f = (clock * 0.3 + i * 0.2) % 1;
      circle(ctx, 323 + Math.sin(i + f) * 6, 370 - f * 30, 2 + f * 4, `rgba(219,225,201,${(1 - f) * 0.14})`);
    }
  }
  if (r.phase === "won") {
    ctx.strokeStyle = "#ffe4a1"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(360, 353, 61, 0, Math.PI * 2); ctx.stroke();
    if (decorative) for (let i = 0; i < Math.ceil(24 * intensity); i++) {
      const a = i * 2.4, radius = 65 + ((clock * 18 + i * 9) % 90);
      circle(ctx, 360 + Math.cos(a) * radius, 353 + Math.sin(a) * radius, 1.5, "#ffe4a188");
    }
  }
  if (["day", "won"].includes(r.phase) && decorative)
    for (let i = 0; i < 3; i++) {
      const a = clock * 0.2 + i * 2;
      const x = 360 + Math.cos(a) * 68,
        y = 360 + Math.sin(a) * 58;
      circle(ctx, x, y, 3, "#e3cd9e");
      ctx.fillStyle = "#718c86";
      ctx.fillRect(x - 2, y + 2, 4, 5);
    }
}
