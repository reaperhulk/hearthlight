import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, loadState, saveState } from '../engine/state.js';
import { abandonRound, beginRound, collectEmbers, getGlowRate, getEmberBreakdown, levelGlowMult, placeStructure, rerollDraft, REROLL_COST, DAWN_GLOW_PER_STRUCTURE, DAY_LENGTH, FRONTIER_YIELD, HEART_MAX, LEVEL_UP_NIGHTS, LEVEL_UP_NIGHTS_VETERAN } from '../engine/round.js';
import { getAdjacentSlots } from '../engine/map.js';
import { endDay, tick } from '../engine/tick.js';
import { getNightForecast, getWardenCooldown, moveWarden, HEART_SLOT, STILL_DEBT } from '../engine/night.js';
import { setMuted, sfx, unlockAudio } from './sound.js';
import { drawEffects, drawStructureGlyph, drawTown, slotPixel, CANVAS, STRUCTURE_COLORS } from './draw.js';
import { buyMetaUpgrade, metaUnlocked, META_UPGRADES } from '../engine/meta.js';
import { STRUCTURES } from '../engine/structures.js';

const HIT_RADIUS = 40;

// The same silhouette the map uses, as a DOM icon for cards and panels.
function StructureIcon({ type, size = 30 }) {
  const ref = useCallback(node => {
    if (!node) return;
    const dpr = 2;
    node.width = size * dpr;
    node.height = size * dpr;
    const ctx = node.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStructureGlyph(ctx, type, size / 2, size / 2, size * 0.38, STRUCTURE_COLORS[type] || '#aeb8c5');
  }, [type, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

// What one occupied slot is worth right now — the tap-to-inspect readout.
function describeSlot(round, slot) {
  const structure = slot.structure;
  const def = STRUCTURES[structure.type];
  const levelMult = levelGlowMult(structure.level) * (slot.ring > 0 ? FRONTIER_YIELD : 1);
  const neighbors = getAdjacentSlots(round.slots, slot.id).filter(neighbor => neighbor.structure);
  const rows = [];
  rows.push(['Toughness', `${structure.hp} bite${structure.hp === 1 ? '' : 's'}`]);
  if (def.glowPerSecond) rows.push(['Glow', `${(def.glowPerSecond * levelMult).toFixed(1)}/s`]);
  if (slot.ring > 0) rows.push(['Frontier', 'richer ground — the dark arrives sooner']);
  if (def.adjacencyBonus) {
    const boosted = neighbors.filter(neighbor => def.adjacencyBonus[neighbor.structure.type]);
    rows.push(['Boosting', boosted.length > 0
      ? boosted.map(neighbor => `${STRUCTURES[neighbor.structure.type].name} +${(def.adjacencyBonus[neighbor.structure.type] * levelMult).toFixed(1)}/s`).join(', ')
      : 'nothing adjacent yet']);
  }
  rows.push(['At dawn', `+${DAWN_GLOW_PER_STRUCTURE + (def.dawnGlow || 0)} Glow`]);
  if (def.slowsAdjacent) {
    rows.push(['Slows', `shades on lit neighbors ×${def.slowsAdjacent}`]);
    rows.push(['Lamplight', 'the Warden banishes 40% faster on lit ground']);
  }
  if (def.nightCharges) {
    rows.push(['Banishes', `${def.nightCharges + (structure.level >= 3 ? 1 : 0)} shades/night on neighbors`]);
    rows.push(['Blind spot', 'cannot save itself']);
  }
  if (def.nightDelay) rows.push(['Toll', `every shade +${def.nightDelay}s approach; Warden repositions 1s sooner`]);
  if (def.tauntWeight) rows.push(['Taunt', 'draws shades to itself']);
  rows.push(['Neighbors', neighbors.length > 0
    ? neighbors.map(neighbor => STRUCTURES[neighbor.structure.type].name).join(', ')
    : 'none']);
  const nightsTo = target => Math.max(0, target - structure.nightsSurvived);
  const levelLine = structure.level >= 3
    ? `Level 3 veteran — glow ×2, +2 toughness${structure.type === 'watchtower' ? ', +1 banish/night' : ''}`
    : structure.level >= 2
    ? `Level 2 — glow ×1.5; veteran in ${nightsTo(LEVEL_UP_NIGHTS_VETERAN)} night${nightsTo(LEVEL_UP_NIGHTS_VETERAN) === 1 ? '' : 's'}`
    : `Level 1 — levels up in ${nightsTo(LEVEL_UP_NIGHTS)} more night${nightsTo(LEVEL_UP_NIGHTS) === 1 ? '' : 's'}`;
  return { name: def.name, levelLine, rows };
}

export function App() {
  const [state, setState] = useState(() => loadState(window.localStorage));
  const [selectedCard, setSelectedCard] = useState(null);
  const [inspectedId, setInspectedId] = useState(null);
  const [sound, setSound] = useState(() => window.localStorage.getItem('hearthlight-sound') !== 'off');
  const [confirming, setConfirming] = useState(null); // 'abandon' | 'reset' | null
  const hasRound = state.round != null;
  const stateRef = useRef(state);
  const selectedRef = useRef(selectedCard);
  const inspectedRef = useRef(inspectedId);
  const canvasRef = useRef(null);
  useEffect(() => {
    stateRef.current = state;
    selectedRef.current = selectedCard;
    inspectedRef.current = inspectedId;
  }, [state, selectedCard, inspectedId]);

  // Persistence: save every 2s and whenever the tab hides.
  useEffect(() => {
    const save = () => saveState(window.localStorage, stateRef.current);
    const interval = setInterval(save, 2000);
    document.addEventListener('visibilitychange', save);
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', save);
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, []);

  useEffect(() => {
    setMuted(!sound);
    window.localStorage.setItem('hearthlight-sound', sound ? 'on' : 'off');
  }, [sound]);

  // Sound and hit feedback: diff the engine's telemetry between renders —
  // the engine stays pure; the UI voices and flashes what changed.
  const prevRoundRef = useRef(null);
  const effectsRef = useRef([]);
  const visualsRef = useRef({ wardens: new Map() });
  const hoverRef = useRef(null);
  useEffect(() => {
    const prev = prevRoundRef.current;
    const round = state.round;
    prevRoundRef.current = round;
    if (!prev || !round) return;
    const now = performance.now() / 1000;
    if (prev.phase === 'day' && round.phase === 'night') {
      const entry = round.stats?.nights.at(-1);
      if (entry?.spawned === 0) sfx.still(); else sfx.dusk();
      const omen = entry?.omen === 'hungry' ? 'A Hungry Night'
        : entry?.omen === 'still' ? `A Still Night — ${STILL_DEBT} more come tomorrow` : null;
      effectsRef.current.push({ type: 'sweep', color: 'rgba(150, 90, 170, ', start: now });
      effectsRef.current.push({
        type: 'banner',
        text: `Night ${round.day}`,
        subtext: omen ?? (entry?.spawned ? `${entry.spawned} shade${entry.spawned === 1 ? '' : 's'} come` : 'the dark holds its breath'),
        color: 'rgba(176, 106, 208, ',
        start: now,
      });
    }
    if (round.day > prev.day) {
      sfx.dawn();
      const omen = round.omen?.night === round.day
        ? (round.omen.type === 'hungry' ? 'omen: a Hungry Night comes' : 'omen: a Still Night comes')
        : null;
      effectsRef.current.push({ type: 'sweep', color: 'rgba(255, 208, 130, ', start: now });
      effectsRef.current.push({
        type: 'banner',
        text: `Day ${round.day}`,
        subtext: omen ?? `night ${prev.day} survived`,
        color: 'rgba(255, 208, 130, ',
        start: now,
      });
    }
    // Tower bolts: a charge spent mid-night draws a lance to the victim.
    if (prev.phase === 'night' && round.phase === 'night') {
      for (const [slotId, before] of Object.entries(prev.towerCharges || {})) {
        if ((round.towerCharges?.[slotId] ?? 0) >= before) continue;
        const tower = round.slots.find(candidate => candidate.id === slotId);
        if (!tower) continue;
        const victim = prev.shades.find(shade => shade.phase === 'approach' &&
          !round.shades.some(candidate => candidate.id === shade.id));
        const victimSlot = victim?.targetSlotId
          ? round.slots.find(candidate => candidate.id === victim.targetSlotId)
          : null;
        const to = victim
          ? (victimSlot ? slotPixel(victimSlot) : { x: CANVAS / 2, y: CANVAS / 2 })
          : slotPixel(tower);
        effectsRef.current.push({ type: 'bolt', from: slotPixel(tower), to, start: now });
      }
    }
    // Bites and falls flash where they land, the moment they land.
    for (const slot of round.slots) {
      const before = prev.slots.find(candidate => candidate.id === slot.id)?.structure;
      if (!before) continue;
      const { x, y } = slotPixel(slot);
      if (!slot.structure) {
        effectsRef.current.push({ type: 'fall', x, y, start: now });
        effectsRef.current.push({ type: 'number', text: '−18', x, y: y - 6, start: now });
      } else if (slot.structure.hp < before.hp) {
        effectsRef.current.push({ type: 'bite', x, y, start: now });
      }
    }
    // Sated shades dissolve where they finished eating — they left, they
    // didn't vanish mysteriously.
    for (const shade of prev.shades) {
      if (shade.phase !== 'feeding') continue;
      if (round.shades.some(candidate => candidate.id === shade.id)) continue;
      const slot = round.slots.find(candidate => candidate.id === shade.targetSlotId);
      if (!slot) continue;
      const { x, y } = slotPixel(slot);
      effectsRef.current.push({ type: 'sated', x, y, start: now });
    }
    const prevLoss = prev.stats?.heartLoss;
    const loss = round.stats?.heartLoss;
    if (prevLoss && loss) {
      if (loss.falls > prevLoss.falls) sfx.fall();
      else if (loss.heartHits > prevLoss.heartHits || loss.vents > prevLoss.vents) sfx.heartHit();
      const heartDelta = (loss.heartHits - prevLoss.heartHits) + (loss.vents - prevLoss.vents);
      if (heartDelta > 0) {
        effectsRef.current.push({ type: 'heartFlash', start: now });
        effectsRef.current.push({ type: 'number', text: `−${heartDelta}`, x: CANVAS / 2, y: CANVAS / 2 - 30, start: now });
      }
    }
    if (prev.phase !== 'fallen' && round.phase === 'fallen') { sfx.toll(); return; }
    const built = slots => slots.filter(slot => slot.structure).length;
    if (built(round.slots) > built(prev.slots) && round.phase === 'day') sfx.place();
    const nightSum = (stats, key) => (stats?.nights || []).reduce((sum, night) => sum + night[key], 0);
    if (nightSum(round.stats, 'banished') > nightSum(prev.stats, 'banished')) sfx.banish();
    if (nightSum(round.stats, 'towerKills') > nightSum(prev.stats, 'towerKills')) sfx.tower();
  }, [state]);

  // Destructive actions want a second tap; the intent expires on its own.
  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(null), 3500);
    return () => clearTimeout(timer);
  }, [confirming]);

  // Test handle: lets the browser smoke test (and manual DevTools poking)
  // drive the game without waiting out real time.
  useEffect(() => {
    window.__game = {
      getState: () => stateRef.current,
      setState: transform => setState(transform),
      // Advance in bounded one-second steps, like the engine's own slices.
      fastForward: seconds => setState(current => {
        let advanced = current;
        let remaining = seconds;
        while (remaining > 0 && advanced.round && advanced.round.phase !== 'fallen') {
          advanced = tick(advanced, 1);
          remaining -= 1;
        }
        return advanced;
      }),
    };
    return () => { delete window.__game; };
  }, []);

  // Game loop: engine ticks at wall-clock speed.
  useEffect(() => {
    let raf = null;
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      setState(current => (current.round && current.round.phase !== 'fallen' ? tick(current, dt) : current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Canvas paint loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    // Fixed 2x backing store: crisp on retina and on desktops where CSS
    // scales the map above its logical 420px.
    const dpr = 2;
    canvas.width = CANVAS * dpr;
    canvas.height = CANVAS * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = null;
    const draw = () => {
      const animTime = performance.now() / 1000;
      if (stateRef.current.round) {
        drawTown(ctx, stateRef.current, selectedRef.current, animTime, inspectedRef.current, visualsRef.current, hoverRef.current);
        effectsRef.current = effectsRef.current.filter(effect => animTime - effect.start < 3);
        drawEffects(ctx, effectsRef.current, animTime);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // Remount the paint loop when a round starts or ends.
  }, [hasRound]);

  const sendWarden = useCallback(slotId => {
    setState(current => {
      const round = current.round;
      if (!round || round.phase !== 'night') return current;
      const held = new Set(round.shades.filter(shade => shade.phase === 'held').map(shade => shade.targetSlotId ?? HEART_SLOT));
      const free = round.wardens.find(warden =>
        round.time - warden.movedAt >= getWardenCooldown(current) && !held.has(warden.slotId));
      if (!free) return current;
      return moveWarden(current, free.id, slotId) || current;
    });
  }, []);

  const handleCanvasMove = useCallback(event => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    hoverRef.current = {
      x: (event.clientX - rect.left) * (CANVAS / rect.width),
      y: (event.clientY - rect.top) * (CANVAS / rect.height),
    };
  }, []);
  const handleCanvasLeave = useCallback(() => { hoverRef.current = null; }, []);

  const handleCanvasClick = useCallback(event => {
    unlockAudio();
    const canvas = canvasRef.current;
    const current = stateRef.current;
    if (!canvas || !current.round) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (CANVAS / rect.width);
    const y = (event.clientY - rect.top) * (CANVAS / rect.height);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const slot of current.round.slots) {
      const px = slotPixel(slot);
      const distance = Math.hypot(px.x - x, px.y - y);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = slot; }
    }
    // At night the Heart itself is a post — tap the center to guard it.
    const heartDistance = Math.hypot(CANVAS / 2 - x, CANVAS / 2 - y);
    if (current.round.phase === 'night' && heartDistance < Math.min(HIT_RADIUS, nearestDistance)) {
      sendWarden(HEART_SLOT);
      return;
    }
    if (!nearest || nearestDistance > HIT_RADIUS) return;

    if (current.round.phase === 'day' && selectedRef.current) {
      setState(prev => placeStructure(prev, selectedRef.current, nearest.id) || prev);
      setSelectedCard(null);
      setInspectedId(null);
    } else if (current.round.phase === 'day') {
      setInspectedId(previous => (nearest.structure && previous !== nearest.id ? nearest.id : null));
    } else if (current.round.phase === 'night') {
      sendWarden(nearest.id);
    }
  }, [sendWarden]);

  const round = state.round;

  if (!round) {
    return (
      <div className="home">
        <h1>Hearthlight</h1>
        <p className="lore">Something in the dark keeps eating the towns. Light the Heart. Last longer.</p>
        <p className="lore dim">The shades are the Forgetting. Every town they take becomes ruins — and the ruins remember every wall you raised.</p>
        {state.totalRounds === 0 && (
          <ul className="how-to">
            <li>By day: pick one structure and tap an empty slot. Build farms for Glow, walls and towers for the night.</li>
            <li>By night: shades creep from the rim and chew for five seconds before each bite — send the Warden in time and the building is saved.</li>
            <li>The Warden grapples one shade at a time and cannot be hurt; watchtowers fire two bolts a night at shades reaching their neighbors — never at their own attackers.</li>
            <li>The dark always wins. Nights survived become Embers — spend them to last longer next time.</li>
          </ul>
        )}
        {state.lastRound && (
          <p className="last-round">
            The last town stood {state.lastRound.nights} night{state.lastRound.nights === 1 ? '' : 's'} and left {state.lastRound.embers} Embers.
          </p>
        )}
        <div className="records">
          <span>Embers: <strong>{state.embers}</strong></span>
          <span>Best: <strong>{state.bestNights} nights</strong></span>
          <span>Vigils: <strong>{state.totalRounds}</strong></span>
        </div>
        {state.lifetime?.nights > 0 && (
          <details className="ledger">
            <summary>The Keeper's Ledger</summary>
            <div><span>Nights withstood</span><strong>{state.lifetime.nights}</strong></div>
            <div><span>Embers gathered</span><strong>{state.lifetime.embers}</strong></div>
            <div><span>Shades banished by hand</span><strong>{state.lifetime.banished}</strong></div>
            <div><span>Bolts loosed from towers</span><strong>{state.lifetime.towerKills}</strong></div>
            <div><span>Buildings taken by the dark</span><strong>{state.lifetime.structuresLost}</strong></div>
          </details>
        )}
        {[
          { title: 'Start faster', ids: ['morningStockpile', 'stoneFoundations', 'deeperDrafts'] },
          { title: 'Go longer', ids: ['swiftWarden', 'heartstone', 'secondWarden'] },
          { title: 'Wider and richer', ids: ['outerRing', 'emberChoir'] },
          { title: 'Proven vigils', ids: ['beaconHeart', 'emberheart', 'ruinsRemember'] },
        ].map(tier => (
          <div key={tier.title} className="shop-tier">
            <h3>{tier.title}</h3>
            <div className="shop">
              {tier.ids.map(id => META_UPGRADES[id]).filter(Boolean).map(upgrade => {
                const unlocked = metaUnlocked(state, upgrade.id);
                return (
                  <button
                    key={upgrade.id}
                    className={state.meta[upgrade.id] ? 'owned' : !unlocked ? 'locked' : ''}
                    disabled={state.meta[upgrade.id] || !unlocked || state.embers < upgrade.cost}
                    onClick={() => setState(current => buyMetaUpgrade(current, upgrade.id) || current)}
                  >
                    <strong>{upgrade.name}</strong>
                    <span>{unlocked ? upgrade.description : `Sealed. Keep a vigil of ${upgrade.requiresBestNights} nights.`}</span>
                    <em>{state.meta[upgrade.id] ? '✓ Kept' : unlocked ? `${upgrade.cost} ✦` : `Best: ${state.bestNights} nights`}</em>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button className="begin" onClick={() => { unlockAudio(); setState(current => beginRound(current)); }}>
          Begin the Vigil
        </button>
        <details className="danger">
          <summary>Begin anew</summary>
          <p>Burn the ledger, the Embers, every upgrade, every record. There is no undo.</p>
          <button
            className={confirming === 'reset' ? 'confirming' : ''}
            onClick={() => {
              if (confirming !== 'reset') { setConfirming('reset'); return; }
              setConfirming(null);
              window.localStorage.removeItem('hearthlight-save');
              setState(createInitialState());
            }}
          >
            {confirming === 'reset' ? 'Tap again to burn it all' : 'Burn everything'}
          </button>
        </details>
      </div>
    );
  }

  const isDay = round.phase === 'day';
  const fallen = round.phase === 'fallen';
  const inspectedSlot = isDay && inspectedId
    ? round.slots.find(slot => slot.id === inspectedId && slot.structure)
    : null;
  const inspected = inspectedSlot ? describeSlot(round, inspectedSlot) : null;
  const dayRemaining = Math.max(0, DAY_LENGTH - (round.time - round.phaseStart));
  const threats = round.shades
    .filter(shade => shade.phase !== 'held' &&
      !round.wardens.some(warden => warden.slotId === (shade.targetSlotId ?? HEART_SLOT)))
    .sort((a, b) => (a.phase === 'approach' ? a.arrivesAt : a.feedsAt ?? 0) - (b.phase === 'approach' ? b.arrivesAt : b.feedsAt ?? 0))
    .slice(0, 3);

  return (
    <div className="game">
      <header>
        <div className="title-row">
          <h1>Hearthlight</h1>
          <button
            className="sound-toggle"
            aria-label={sound ? 'Mute sound' : 'Unmute sound'}
            onClick={() => { unlockAudio(); setSound(current => !current); }}
          >
            {sound ? '♪' : '∅'}
          </button>
        </div>
        <div className="chips">
          <span className={`chip phase ${round.phase}`}>
            {!fallen && isDay && (
              <i className="day-fill" style={{ width: `${(dayRemaining / DAY_LENGTH) * 100}%` }} />
            )}
            <span>{fallen ? 'Fallen' : isDay ? `☀ Day ${round.day} · ${Math.ceil(dayRemaining)}s` : `☾ Night ${round.day}`}</span>
          </span>
          {!fallen && isDay && (() => {
            const forecast = getNightForecast(round);
            const omenName = forecast.omen === 'hungry' ? 'Hungry Night · ' : forecast.omen === 'still' ? 'Still Night · ' : '';
            return (
              <span className={`chip forecast${forecast.omen ? ' omen' : ''}`} title="Shades due at dusk">
                {forecast.omen === 'still'
                  ? 'Still Night · the dark holds its breath'
                  : `${omenName}tonight: ${forecast.count}${forecast.heartseekers > 0 ? ` · ${forecast.heartseekers} seek the Heart` : ''}`}
              </span>
            );
          })()}
          <span className="chip stat">Glow <strong>{Math.floor(round.glow)}</strong> <em>+{getGlowRate(state).toFixed(1)}/s</em></span>
          <span className="chip stat">Embers <strong>{state.embers}</strong></span>
        </div>
      </header>

      <div className="heart-bar" role="meter" aria-valuemin={0} aria-valuemax={round.heartMax || HEART_MAX} aria-valuenow={Math.round(round.heart)} aria-label="Heart light">
        <div className="heart-fill" style={{ width: `${(round.heart / (round.heartMax || HEART_MAX)) * 100}%` }}>
          <i className="wick" />
        </div>
        {(() => {
          // Light already spoken for: feeds in progress whose bite fells
          // their target (18 each). The bar telegraphs the loss coming.
          const max = round.heartMax || HEART_MAX;
          const pending = Math.min(round.heart, round.shades
            .filter(shade => shade.phase === 'feeding' && shade.targetSlotId)
            .filter(shade => round.slots.find(slot => slot.id === shade.targetSlotId)?.structure?.hp === 1)
            .length * 18);
          if (pending <= 0) return null;
          return (
            <i
              className="pending"
              style={{ left: `${((round.heart - pending) / max) * 100}%`, width: `${(pending / max) * 100}%` }}
            />
          );
        })()}
        <span>{fallen ? 'The Heart is dark.' : `Heart ${Math.ceil(round.heart)} / ${round.heartMax || HEART_MAX}`}</span>
      </div>

      {fallen ? (
        <div className="fallen-panel">
          <h2>The town is memory now.</h2>
          <p className="epitaph">{[
            'What the dark takes, the ground keeps.',
            'The shades are the Forgetting. The ruins remember.',
            'Every wall you raised is a word in the stones’ story.',
            'The light failed. The remembering begins.',
            'No vigil is wasted. The ruins keep the shape of it.',
          ][(round.day + state.totalRounds) % 5]}</p>
          {(() => {
            const nights = round.day - 1;
            const breakdown = getEmberBreakdown(round, state.meta);
            const labels = [
              ['nights', `${breakdown.nights} night${breakdown.nights === 1 ? '' : 's'} withstood`],
              ['standing', 'still standing at the end'],
              ['shrines', 'shrines kept lit'],
              ['kiln', 'glow fed to the kiln'],
              ['choir', 'the choir sang'],
              ['emberheart', 'the Emberheart burned'],
              ['ruins', 'the ruins remember'],
            ];
            const peak = Math.max(1, ...round.stats.nights.map(night => night.heartLost));
            return (
              <>
                {nights > state.bestNights && <p className="record-line">A new record vigil.</p>}
                <div className="spark" aria-label="Heart lost per night">
                  {round.stats.nights.map(night => (
                    <i
                      key={night.night}
                      style={{ height: `${8 + (night.heartLost / peak) * 30}px` }}
                      className={night.heartLost > 0 ? 'lost' : 'calm'}
                      title={`Night ${night.night}: ${night.spawned} shades, -${night.heartLost} heart`}
                    />
                  ))}
                </div>
                <div className="chronicle">
                  {labels.filter(([key]) => breakdown[key] > 0).map(([key, label]) => (
                    <div key={key}><span>{label}</span><strong>+{breakdown[key]}</strong></div>
                  ))}
                  <div className="total"><span>Embers carried home</span><strong>{breakdown.total}</strong></div>
                </div>
              </>
            );
          })()}
          <button className="begin" onClick={() => { setState(current => collectEmbers(current)); setSelectedCard(null); }}>
            Return to the Fire
          </button>
        </div>
      ) : (
        <div className="playfield">
          <canvas
            className="town-map"
            ref={canvasRef}
            width={CANVAS}
            height={CANVAS}
            onClick={handleCanvasClick}
            onPointerMove={handleCanvasMove}
            onPointerLeave={handleCanvasLeave}
            role="img"
            aria-label={isDay ? 'Town map — pick a card, then tap an empty slot' : 'Night — tap a slot to send the Warden'}
          />
          <div className="side">
          {isDay ? (
            <div className="day-controls">
              <div className="draft">
                {round.draft.map(id => {
                  const def = STRUCTURES[id];
                  const affordable = round.glow >= def.cost && !round.placedToday;
                  const rate = getGlowRate(state);
                  const eta = Math.ceil((def.cost - round.glow) / Math.max(0.1, rate));
                  const etaLabel = round.placedToday ? null
                    : round.glow >= def.cost ? null
                    : eta <= Math.ceil(dayRemaining) ? `in ${eta}s` : 'not today';
                  return (
                    <button
                      key={id}
                      className={selectedCard === id ? 'selected' : ''}
                      disabled={!affordable}
                      onClick={() => setSelectedCard(selectedCard === id ? null : id)}
                    >
                      <span className="card-head">
                        <StructureIcon type={id} />
                        <strong>{def.name}</strong>
                        {etaLabel && <span className="eta">{etaLabel}</span>}
                        <em className="cost">{def.cost}</em>
                      </span>
                      <span>{def.description}</span>
                    </button>
                  );
                })}
              </div>
              {!round.placedToday && !round.rerolledToday && (
                <button
                  className="reroll"
                  disabled={round.glow < REROLL_COST}
                  onClick={() => setState(current => rerollDraft(current) || current)}
                >
                  New faces at the gate — reroll for {REROLL_COST} Glow
                </button>
              )}
              <button className="end-day" onClick={() => setState(current => endDay(current))}>
                {(() => {
                  const forecast = getNightForecast(round);
                  const brings = forecast.omen === 'still' ? 'a still night' : `${forecast.count} come`;
                  return round.placedToday ? `Call the Dusk — ${brings}` : `Skip the day — ${brings}`;
                })()}
              </button>
              {selectedCard && <p className="hint">Tap an empty slot to build the {STRUCTURES[selectedCard].name}.</p>}
              {!selectedCard && !inspected && <p className="hint">Tap a building to inspect it.</p>}
              {inspected && (
                <div className="inspect">
                  <div className="inspect-head">
                    <span className="card-head">
                      <StructureIcon type={inspectedSlot.structure.type} size={24} />
                      <strong>{inspected.name}</strong>
                    </span>
                    <button onClick={() => setInspectedId(null)} aria-label="Close inspector">×</button>
                  </div>
                  <em>{inspected.levelLine}</em>
                  {inspected.rows.map(([label, value]) => (
                    <div key={label} className="inspect-row"><span>{label}</span><span>{value}</span></div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="night-controls">
              <div className="warden-status">
                {round.wardens.map(warden => {
                  const wait = Math.ceil(getWardenCooldown(state) - (round.time - warden.movedAt));
                  return (
                    <span key={warden.id} className={wait > 0 ? 'cooling' : 'ready'}>
                      Warden {round.wardens.length > 1 ? warden.id : ''} {wait > 0 ? `moves in ${wait}s` : 'ready'}
                    </span>
                  );
                })}
              </div>
              {threats.length > 0 ? threats.map(shade => {
                const slot = round.slots.find(candidate => candidate.id === shade.targetSlotId);
                const name = !shade.targetSlotId ? 'the Heart'
                  : slot?.structure ? STRUCTURES[slot.structure.type].name : 'ruin';
                const seconds = Math.max(0, Math.ceil((shade.phase === 'approach' ? shade.arrivesAt : shade.feedsAt ?? round.time) - round.time));
                return (
                  <button key={shade.id} onClick={() => sendWarden(shade.targetSlotId ?? HEART_SLOT)}>
                    {shade.phase === 'feeding' ? `Save ${name === 'the Heart' ? name : `the ${name}`} — bites in ${seconds}s`
                      : `Warden → ${name} (${seconds}s)`}
                  </button>
                );
              }) : <span className="hint">The Warden watches. Hold the line.</span>}
            </div>
          )}

          <div className="log" role="log" aria-live="polite" aria-label="The night's tale">
            {round.log.slice(-4).map((entry, index, shown) => (
              <div key={`${round.log.length - shown.length + index}`} className={index === shown.length - 1 ? 'newest' : ''}>
                {entry.message}
              </div>
            ))}
          </div>
          <button
            className={`abandon${confirming === 'abandon' ? ' confirming' : ''}`}
            onClick={() => {
              if (confirming !== 'abandon') { setConfirming('abandon'); return; }
              setConfirming(null);
              setSelectedCard(null);
              setInspectedId(null);
              setState(current => abandonRound(current) || current);
            }}
          >
            {confirming === 'abandon' ? 'The dark takes it — tap again to walk away' : 'Abandon the vigil'}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
