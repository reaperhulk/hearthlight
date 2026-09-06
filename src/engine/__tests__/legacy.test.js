import { expect, it } from "vitest";
import * as old from "../legacy-v2/campaign.js";
import { advance, command, migrateGame, replayRound } from "../campaign.js";
it("resumes a pre-redesign battle and replays it under its original rules", () => {
 let s=old.startGame(old.freshGame(),"first",42);
 s=old.command(s,{type:"build",slot:"0-0",building:"wall"});
 s=old.command(s,{type:"start"});
 s=old.advance(s,9);
 const resumed=migrateGame(s);
 expect(resumed.round.paused).toBe(true);
 const active=command(resumed,{type:"pause"});
 const next=advance(active,3);
 expect(next).toEqual(old.advance(active,3));
 expect(replayRound(next.round).round).toEqual(next.round);
});
