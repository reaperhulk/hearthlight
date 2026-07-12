// The fall screen: epitaph, the night-by-night sparkline, the Ember
// chronicle, and two ways forward (straight back in, or via the fire).
import { beginRound, collectEmbers, getEmberBreakdown } from '../engine/round.js';
import { allUpgradesKept, metaUnlocked, LONG_DAWN_NIGHTS, META_UPGRADES } from '../engine/meta.js';
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
  const affordable = (() => {
    const bank = state.embers + breakdown.total;
    return Object.values(META_UPGRADES).filter(upgrade =>
      !state.meta[upgrade.id] && metaUnlocked(state, upgrade.id) && bank >= upgrade.cost).length;
  })();
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
        Return to the Fire{affordable > 0 ? ` — ${affordable} upgrade${affordable === 1 ? '' : 's'} affordable` : ''}
      </button>
    </div>
  );
}
