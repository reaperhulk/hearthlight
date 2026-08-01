// The fall screen: epitaph, the night-by-night sparkline, the Ember
// chronicle, and two ways forward (straight back in, or via the fire).
import { beginRound, collectEmbers, getEmberBreakdown } from '../engine/round.js';
import { allUpgradesKept, metaNextCost, metaRank, metaUnlocked, LONG_DAWN_NIGHTS, META_UPGRADES } from '../engine/meta.js';
import { unlockAudio } from './sound.js';

const EPITAPHS = [
  'What the dark takes, the ground keeps.',
  'The shades are the Forgetting. The ruins remember.',
  'Every wall you raised is a word in the stones’ story.',
  'The light failed. The remembering begins.',
  'No vigil is wasted. The ruins keep the shape of it.',
];

const LEDGER_LABELS = [
  ['nights', nights => `${nights} night${nights === 1 ? '' : 's'} withstood`],
  ['standing', () => 'still standing at the end'],
  ['shrines', () => 'shrines kept lit'],
  ['kiln', () => 'glow fed to the kiln'],
  ['choir', () => 'the choir sang'],
  ['emberheart', () => 'the Emberheart burned'],
  ['ruins', () => 'the ruins remember'],
];

export function FallenPanel({ state, setState, clearSelection }) {
  const round = state.round;
  const nights = round.day - 1;
  const breakdown = getEmberBreakdown(round, state.meta);
  const peak = Math.max(1, ...round.stats.nights.map(night => night.heartLost));
  // What this fall bought on the tree: nodes now reachable, and whether
  // the record just opened a path that Embers alone could not.
  const bank = state.embers + breakdown.total;
  const proven = { ...state, bestNights: Math.max(state.bestNights, nights) };
  // Ranks count too: a node you can pour another course into is just as
  // much a reason to walk back to the fire as one you have never lit.
  const affordable = Object.values(META_UPGRADES).filter(upgrade => {
    const price = metaNextCost(state, upgrade.id);
    if (price == null || bank < price) return false;
    return metaRank(state, upgrade.id) >= 1 || metaUnlocked(proven, upgrade.id);
  }).length;
  const unsealed = Object.values(META_UPGRADES).filter(upgrade =>
    metaRank(state, upgrade.id) === 0 && upgrade.requiresBestNights &&
    !metaUnlocked(state, upgrade.id) && metaUnlocked(proven, upgrade.id)).length;
  return (
    <div className="fallen-panel">
      <h2>The town is memory now.</h2>
      <p className="epitaph">{EPITAPHS[(round.day + state.totalRounds) % EPITAPHS.length]}</p>
      {nights >= LONG_DAWN_NIGHTS && allUpgradesKept(state) && state.bestNights < LONG_DAWN_NIGHTS
        ? <p className="record-line gold">The Long Dawn. The ruins will never forget this one.</p>
        : nights > state.bestNights && <p className="record-line">A new record vigil.</p>}
      {round.log.length > 1 && (
        <p className="final-moments">{round.log.at(-2)?.message}</p>
      )}
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
        {LEDGER_LABELS.filter(([key]) => breakdown[key] > 0).map(([key, label]) => (
          <div key={key}><span>{label(breakdown[key])}</span><strong>+{breakdown[key]}</strong></div>
        ))}
        <div className="total"><span>Embers carried home</span><strong>{breakdown.total}</strong></div>
      </div>
      <button
        className="begin"
        autoFocus
        onClick={() => {
          unlockAudio();
          clearSelection();
          setState(current => beginRound(collectEmbers(current)));
        }}
      >
        Begin the next vigil
      </button>
      <button
        className="to-the-fire"
        onClick={() => { setState(current => collectEmbers(current)); clearSelection(); }}
      >
        {unsealed > 0
          ? `Return to the Fire — this vigil breaks ${unsealed} seal${unsealed === 1 ? '' : 's'}`
          : `Return to the Fire${affordable > 0 ? ` — ${affordable} node${affordable === 1 ? '' : 's'} ready to kindle` : ''}`}
      </button>
    </div>
  );
}
