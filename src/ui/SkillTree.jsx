// The Ember tree: where Embers become a path instead of a shopping list.
// The canvas carries the art (veins, medallions, kindling flourishes);
// real buttons sit transparently over each node so the tree is still
// keyboard-reachable and speaks to a screen reader.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  branchKept, buyMetaUpgrade, metaMaxRank, metaNextCost, metaRank, metaStatus,
  LONG_DAWN_NIGHTS, LONG_DAWN_NODE, META_BRANCHES, META_UPGRADES,
} from '../engine/meta.js';
import { sfx, unlockAudio } from './sound.js';
import { branchWashEffect, drawTree, kindleEffects, pruneTreeEffects, treeNodes, TREE } from './tree.js';

const STATUS_WORD = {
  maxed: 'every rank poured',
  ready: 'ready to kindle',
  costly: 'not enough Embers yet',
  sealed: 'sealed until the vigil is deep enough',
  rooted: 'the path to it is not open',
};

// What the panel says when nothing is chosen: the nearest thing worth
// wanting, so the tree always answers "what now?".
function nextStep(state) {
  const open = treeNodes().filter(node => ['ready', 'costly'].includes(metaStatus(state, node.id)));
  if (open.length === 0) {
    const sealed = treeNodes().filter(node => metaStatus(state, node.id) === 'sealed');
    if (sealed.length > 0) {
      const nearest = sealed.reduce((best, node) =>
        node.requiresBestNights < best.requiresBestNights ? node : best);
      return `${nearest.name} waits on a ${nearest.requiresBestNights}-night vigil. Best so far: ${state.bestNights}.`;
    }
    return 'Every root is kept. One vigil remains.';
  }
  const ready = open.filter(node => metaStatus(state, node.id) === 'ready');
  if (ready.length > 0) {
    return `${ready.length} node${ready.length === 1 ? '' : 's'} ready to kindle. Tap one.`;
  }
  const cheapest = open.reduce((best, node) =>
    (metaNextCost(state, node.id) < metaNextCost(state, best.id) ? node : best));
  const short = metaNextCost(state, cheapest.id) - state.embers;
  return `${short} more Ember${short === 1 ? '' : 's'} ${metaRank(state, cheapest.id) >= 1 ? 'deepens' : 'opens'} ${cheapest.name}.`;
}

export function SkillTree({ state, setState }) {
  const [chosen, setChosen] = useState(null);
  const [kindled, setKindled] = useState(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const chosenRef = useRef(chosen);
  const effectsRef = useRef([]);
  useEffect(() => { stateRef.current = state; chosenRef.current = chosen; }, [state, chosen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let scale = 0;
    const resize = () => {
      const shown = canvas.getBoundingClientRect().width || TREE;
      const next = Math.max(1, Math.min(2, (shown * (window.devicePixelRatio || 1)) / TREE));
      if (next === scale) return;
      scale = next;
      canvas.width = Math.round(TREE * scale);
      canvas.height = Math.round(TREE * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = null;
    const paint = () => {
      const animTime = performance.now() / 1000;
      pruneTreeEffects(effectsRef.current, animTime);
      drawTree(ctx, stateRef.current, animTime, effectsRef.current, chosenRef.current);
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // The kindling: the vein lights, the medallion blooms, the root sings
  // if that was the last node in it.
  const kindle = useCallback(upgradeId => {
    unlockAudio();
    setState(current => {
      const bought = buyMetaUpgrade(current, upgradeId);
      if (!bought) return current;
      const now = performance.now() / 1000;
      effectsRef.current.push(...kindleEffects(META_UPGRADES[upgradeId], now));
      const branch = META_UPGRADES[upgradeId].branch;
      // A root only "completes" the first time every node in it is lit —
      // ranking one up later must not re-fire the celebration.
      const finishedRoot = branchKept(bought, branch) && !branchKept(current, branch);
      if (finishedRoot) effectsRef.current.push(branchWashEffect(branch, now + 0.5));
      sfx.kindle();
      if (finishedRoot) sfx.rootKept();
      navigator.vibrate?.(finishedRoot ? [10, 50, 18] : 10);
      setKindled({
        id: upgradeId,
        rank: metaRank(bought, upgradeId),
        root: finishedRoot ? META_BRANCHES[branch].name : null,
      });
      return bought;
    });
  }, [setState]);

  useEffect(() => {
    if (!kindled) return undefined;
    const timer = setTimeout(() => setKindled(null), 2600);
    return () => clearTimeout(timer);
  }, [kindled]);

  const detail = chosen === 'longDawn' ? null : chosen && META_UPGRADES[chosen];
  const status = detail ? metaStatus(state, detail.id) : null;

  return (
    <div className="tree-panel">
      <h3>The Ember Tree</h3>
      <div className="tree-legend">
        {Object.values(META_BRANCHES).map(branch => (
          <span key={branch.id} className={`root-${branch.id}${branchKept(state, branch.id) ? ' kept' : ''}`}>
            {branch.name}
          </span>
        ))}
      </div>
      <div className="tree-stage">
        <canvas ref={canvasRef} className="tree-canvas" aria-hidden="true" />
        {[...treeNodes(), LONG_DAWN_NODE].map(node => {
          const upgrade = META_UPGRADES[node.id];
          const nodeStatus = upgrade ? metaStatus(state, node.id) : 'crown';
          const label = upgrade
            ? `${upgrade.name}${metaMaxRank(node.id) > 1 ? `, rank ${metaRank(state, node.id)} of ${metaMaxRank(node.id)}` : ''}` +
              `${metaNextCost(state, node.id) == null ? '' : `, ${metaNextCost(state, node.id)} Embers`} — ${STATUS_WORD[nodeStatus]}`
            : `The Long Dawn — hold the light for ${LONG_DAWN_NIGHTS} nights. Best so far: ${state.bestNights}.`;
          return (
            <button
              key={node.id}
              type="button"
              className={`tree-node ${nodeStatus}${chosen === node.id ? ' chosen' : ''}${kindled?.id === node.id ? ' kindled' : ''}`}
              style={{ left: `${node.at.x * 100}%`, top: `${node.at.y * 100}%` }}
              aria-label={label}
              aria-pressed={chosen === node.id}
              onClick={() => setChosen(current => (current === node.id ? null : node.id))}
            />
          );
        })}
      </div>
      {kindled && (
        <p className="kindled-banner">
          {kindled.root
            ? `${kindled.root} is whole — the light runs the length of it.`
            : kindled.rank > 1
              ? `${META_UPGRADES[kindled.id].name} deepens — rank ${kindled.rank}.`
              : `${META_UPGRADES[kindled.id].name} kindles.`}
        </p>
      )}
      {chosen === 'longDawn' ? (
        <div className="tree-detail crown">
          <strong>The Long Dawn</strong>
          <p>
            The crown of the tree. With every node kept, one vigil remains:
            hold the light for {LONG_DAWN_NIGHTS} nights. Best so far: {state.bestNights}.
          </p>
        </div>
      ) : detail ? (
        <div className={`tree-detail ${status}`}>
          <strong>{detail.name}</strong>
          <em>{META_BRANCHES[detail.branch].name}</em>
          <p>{detail.description}</p>
          {metaMaxRank(detail.id) > 1 && (
            <span className="rank-gauge" aria-label={`Rank ${metaRank(state, detail.id)} of ${metaMaxRank(detail.id)}`}>
              {Array.from({ length: metaMaxRank(detail.id) }, (unused, seat) => (
                <i key={seat} className={seat < metaRank(state, detail.id) ? 'lit' : ''} />
              ))}
              <span>rank {metaRank(state, detail.id)} / {metaMaxRank(detail.id)}</span>
            </span>
          )}
          {metaMaxRank(detail.id) > 1 && metaRank(state, detail.id) >= 1 && status !== 'maxed' && (
            <span className="verdict">{detail.rankNote}</span>
          )}
          {status === 'maxed' && (
            <span className="verdict kept">
              {metaMaxRank(detail.id) > 1
                ? 'Every rank poured. It runs as deep as it goes.'
                : 'Kept. It burns in every vigil from here on.'}
            </span>
          )}
          {status === 'rooted' && (
            <span className="verdict">
              Grows from {detail.requires.map(id => META_UPGRADES[id].name).join(' and ')} — kindle that first.
            </span>
          )}
          {status === 'sealed' && (
            <span className="verdict sealed">
              Sealed. Keep a vigil of {detail.requiresBestNights} nights — your best is {state.bestNights}.
            </span>
          )}
          {status === 'costly' && (
            <span className="verdict">
              {metaNextCost(state, detail.id)} Embers. You hold {state.embers} —{' '}
              {metaNextCost(state, detail.id) - state.embers} more.
            </span>
          )}
          {status === 'ready' && (
            <button className="kindle" onClick={() => kindle(detail.id)}>
              {metaRank(state, detail.id) >= 1
                ? `Pour another rank — ${metaNextCost(state, detail.id)} ✦`
                : `Kindle it — ${metaNextCost(state, detail.id)} ✦`}
            </button>
          )}
        </div>
      ) : (
        <p className="tree-hint">{nextStep(state)}</p>
      )}
    </div>
  );
}
