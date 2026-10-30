/** The angler and a snag (`docs/boat.md`, C4): it tugs for the give and lets go, so a snag cannot stall the pace gate. */
import { describe, expect, it } from 'vitest';
import { Angler } from '../src/angler';
import { Game } from '../src/game';
import { SNAG } from '../src/lake';
import { checkInvariants } from '../src/invariants';
import { LAKES } from '../src/lakes';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT } from './helpers';

describe('the angler given a snagged lure', () => {
  it('holds the reel for the tug and a little over, lets go, and so frees it', () => {
    // every fish cured, so nothing bites and only the reeds are at work
    const save = JSON.stringify({
      cured: 12,
      journal: {
        bream: { caught: 4, best: 0.85, first: 1 },
        perch: { caught: 5, best: 1.9, first: 1 },
        pike: { caught: 3, best: 3.1, first: 1 },
      },
    });
    const game = new Game(new Progress(memoryStore(save), LAKES), { random: seeded(1) });
    const angler = new Angler(game, seeded(101));
    // a lure sinking beside the first bed, then caught as the game would catch it
    const s = game.lake.snags[0];
    game.cast(Math.PI / 2, 0.5);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    game.lure.snag(0, s.x + s.radius + SNAG.reach / 2, s.y);
    game.bodies.take();
    expect(game.lure.phase).toBe('snagged');
    let held = 0;
    let freedAt = -1;
    for (let f = 0; f < 60 * 5 && freedAt < 0; f++) {
      angler.step(DT);
      if (game.lure.phase === 'snagged' && game.reeling) held++;
      if (game.lure.phase !== 'snagged') freedAt = f;
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
    expect(freedAt, 'it freed the lure').toBeGreaterThan(0);
    // it held the reel for the tug and a quarter second more, give or take a frame
    expect(held * DT).toBeGreaterThanOrEqual(SNAG.tug);
    expect(held * DT).toBeLessThan(SNAG.tug + 0.25 + 3 * DT);
  });
});
