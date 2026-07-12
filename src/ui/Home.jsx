// The fire between vigils: records, the Keeper's Ledger, the Ember shop,
// and the way back into the dark.
import { useState } from 'react';
import { createInitialState, migrateState } from '../engine/state.js';
import { beginRound } from '../engine/round.js';
import { allUpgradesKept, buyMetaUpgrade, isVigilComplete, metaUnlocked, LONG_DAWN_NIGHTS, META_UPGRADES } from '../engine/meta.js';
import { unlockAudio } from './sound.js';
import { StructureIcon } from './StructureIcon.jsx';

const SHOP_TIERS = [
  { title: 'Sturdier days', ids: ['morningStockpile', 'stoneFoundations', 'deeperDrafts'] },
  { title: 'Go longer', ids: ['swiftWarden', 'heartstone', 'secondWarden'] },
  { title: 'Wider and richer', ids: ['outerRing', 'emberChoir'] },
  { title: 'Proven vigils', ids: ['beaconHeart', 'emberheart', 'ruinsRemember'] },
];

// A save string that survives chat apps and notebooks: base64 of the
// JSON, unicode-safe.
function encodeSave(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeSave(text) {
  const binary = atob(text.trim());
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function Home({ state, setState, confirming, setConfirming }) {
  const [carryText, setCarryText] = useState('');
  const [carryNote, setCarryNote] = useState(null);
  return (
    <div className="home">
      <h1 className={`title-emblem${isVigilComplete(state) ? ' gold' : ''}`}><StructureIcon type="lantern" size={26} /> Hearthlight</h1>
      <p className="lore">Something in the dark keeps eating the towns. Light the Heart. Last longer.</p>
      <p className="lore dim">The shades are the Forgetting. Every town they take becomes ruins — and the ruins remember every wall you raised.</p>
      {state.totalRounds === 0 && (
        <ul className="how-to">
          <li>By day: pick one structure and tap an empty slot. Build farms for Glow, walls and towers for the night.</li>
          <li>By night: shades creep from the rim and chew for five seconds before each bite — send the Warden in time and the building is saved.</li>
          <li>The Warden grapples one shade at a time and cannot be hurt; once rested he can be redirected anywhere — even mid-grapple, though a dropped shade bites almost at once. Every banish tempers him: his grip quickens with the work.</li>
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
      {state.history?.length > 1 && (
        <div className="history" aria-label="Nights survived, recent vigils">
          <span className="history-label">Past vigils</span>
          <div className="history-bars">
            {state.history.map((run, index) => (
              <i
                key={index}
                className={run.nights >= state.bestNights ? 'best' : ''}
                style={{ height: `${6 + (run.nights / Math.max(1, state.bestNights)) * 26}px` }}
                title={`${run.nights} night${run.nights === 1 ? '' : 's'}, ${run.embers} embers`}
              />
            ))}
          </div>
        </div>
      )}
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
      {allUpgradesKept(state) && (
        isVigilComplete(state) ? (
          <div className="capstone complete">
            <h3>The Long Dawn</h3>
            <p>
              Fifteen nights, and everything kept. The dark still won — the dark
              always wins — but somewhere far ahead a wanderer kneels in these
              stones, and the ruins remember every wall you raised.
            </p>
            <p className="dim">The vigil is complete. The fire is yours to tend as long as you like.</p>
          </div>
        ) : (
          <div className="capstone">
            <h3>The Long Dawn</h3>
            <p>
              Everything is kept. One vigil remains: hold the light for{' '}
              {LONG_DAWN_NIGHTS} nights. Best so far: {state.bestNights}.
            </p>
          </div>
        )
      )}
      <button className="begin" onClick={() => { unlockAudio(); setState(current => beginRound(current)); }}>
        Begin the Vigil
      </button>
      <details className="carry">
        <summary>Carry the fire (backup / move device)</summary>
        <p>The whole vigil — Embers, upgrades, records — as one string. Paste it on another device to carry the fire there.</p>
        <div className="carry-row">
          <button
            onClick={() => {
              const text = encodeSave(state);
              setCarryText(text);
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text)
                  .then(() => setCarryNote('Copied. Keep it somewhere the dark cannot reach.'))
                  .catch(() => setCarryNote('Copy failed — select the text below by hand.'));
              } else {
                setCarryNote('Select the text below and copy it by hand.');
              }
            }}
          >
            Write the ember-script
          </button>
          <button
            onClick={() => {
              try {
                const imported = migrateState(decodeSave(carryText));
                setState(imported);
                setCarryNote(`The fire is carried: ${imported.embers} Embers, best ${imported.bestNights} nights.`);
              } catch {
                setCarryNote('That script would not catch — check the whole string was pasted.');
              }
            }}
            disabled={carryText.trim().length === 0}
          >
            Kindle from a script
          </button>
        </div>
        <textarea
          value={carryText}
          onChange={event => { setCarryText(event.target.value); setCarryNote(null); }}
          placeholder="Paste an ember-script here to import it, or write yours above."
          rows={3}
          spellCheck={false}
          aria-label="Save transfer text"
        />
        {carryNote && <p className="carry-note">{carryNote}</p>}
      </details>
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
