// The fire between vigils: records, the Keeper's Ledger, the Ember shop,
// and the way back into the dark.
import { createInitialState } from '../engine/state.js';
import { beginRound } from '../engine/round.js';
import { buyMetaUpgrade, metaUnlocked, META_UPGRADES } from '../engine/meta.js';
import { unlockAudio } from './sound.js';
import { StructureIcon } from './StructureIcon.jsx';

const SHOP_TIERS = [
  { title: 'Sturdier days', ids: ['morningStockpile', 'stoneFoundations', 'deeperDrafts'] },
  { title: 'Go longer', ids: ['swiftWarden', 'heartstone', 'secondWarden'] },
  { title: 'Wider and richer', ids: ['outerRing', 'emberChoir'] },
  { title: 'Proven vigils', ids: ['beaconHeart', 'emberheart', 'ruinsRemember'] },
];

export function Home({ state, setState, confirming, setConfirming }) {
  return (
    <div className="home">
      <h1 className="title-emblem"><StructureIcon type="lantern" size={26} /> Hearthlight</h1>
      <p className="lore">Something in the dark keeps eating the towns. Light the Heart. Last longer.</p>
      <p className="lore dim">The shades are the Forgetting. Every town they take becomes ruins — and the ruins remember every wall you raised.</p>
      {state.totalRounds === 0 && (
        <ul className="how-to">
          <li>By day: pick one structure and tap an empty slot. Build farms for Glow, walls and towers for the night.</li>
          <li>By night: shades creep from the rim and chew for five seconds before each bite — send the Warden in time and the building is saved.</li>
          <li>The Warden grapples one shade at a time and cannot be hurt; once rested he can be redirected anywhere — even mid-grapple, though a dropped shade bites almost at once.</li>
          <li>Watchtowers fire two bolts a night at shades reaching their neighbors — never at their own attackers.</li>
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
      {SHOP_TIERS.map(tier => (
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
