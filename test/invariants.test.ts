import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { depthRange } from '../src/fish';
import { DECK, bedDepth, inside } from '../src/lake';
import { newGame, settle } from './helpers';

describe('what must always hold', () => {
  it('holds of a new lake, and of one played a while', () => {
    const { game } = newGame();
    expect(checkInvariants(game)).toEqual([]);
    settle(game);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports a fish on the jetty’s deck as out of the water, with no rule of its own', () => {
    const { game } = newGame();
    game.fish.x[0] = DECK.x + DECK.inward[0] * 6;
    game.fish.y[0] = DECK.y + DECK.inward[1] * 6;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is out of the water/);
  });

  it('reports a time that is not a number, or before the start', () => {
    const { game } = newGame();
    game.t = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/the time is NaN/);
    game.t = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the time is -1/);
  });

  it('reports the fishing gone wrong: the bite, the fish it holds, the lure in its mouth, the line and the bucket', () => {
    // a lake with a fish just hooked, the lure in its mouth
    const hookedLake = () => {
      const { game } = newGame(1);
      game.cast(Math.PI / 2, 0.62);
      for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(1 / 60);
      expect(game.strike()).toBe('hooked');
      game.step(1 / 60);
      expect(checkInvariants(game)).toEqual([]);
      return game;
    };
    const broken = (meddle: (g: ReturnType<typeof hookedLake>) => void) => {
      const game = hookedLake();
      meddle(game);
      return checkInvariants(game).join('\n');
    };
    expect(broken((g) => (g.bite.phase = 'gnawing' as never))).toMatch(/the bite is gnawing/);
    expect(broken((g) => (g.fish.held = -1))).toMatch(/but the school holds fish -1/);
    expect(broken((g) => (g.bite.fish = 99))).toMatch(/with fish 99/);
    expect(broken((g) => (g.lure.at[0] += 3))).toMatch(/from the lure in its mouth/);
    expect(broken((g) => (g.lure.phase = 'sinking'))).toMatch(/but the lure is sinking/);
    expect(broken((g) => (g.line.tension = Number.NaN))).toMatch(/tension is NaN/);
    expect(broken((g) => (g.line.tension = -0.1))).toMatch(/tension is -0.1/);
    expect(broken((g) => (g.line.out = 1000))).toMatch(/line out is 1000/);
    expect(broken((g) => (g.line.zone = 0.9))).toMatch(/the zone is at 0.9/);
    expect(broken((g) => (g.line.zone = Number.NaN))).toMatch(/the zone is at NaN/);
    expect(broken((g) => (g.line.fishAt = 1.2))).toMatch(/the fish is at 1.2 on the bar/);
    expect(broken((g) => (g.line.meter = -0.1))).toMatch(/the meter is at -0.1/);
    expect(broken((g) => (g.bucket = -1))).toMatch(/the bucket holds -1/);
    // and with no fish at the lure, none held
    const { game } = newGame();
    game.fish.held = 2;
    expect(checkInvariants(game).join('\n')).toMatch(/no fish is at the lure, but the school holds fish 2/);
  });

  it('reports a fish whose body, as it is drawn, stays in the water however it pitches, and reports a stroke that is not a number', () => {
    const { game } = newGame();
    settle(game, 30);
    expect(checkInvariants(game)).toEqual([]);
    game.fish.phase[1] = Number.NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 1's stroke is not a number/);
    game.fish.phase[1] = 0;
    // a fish sinking fast in the shallows, where a pitch as steep as it may have in the deep would lift its tail out
    let x = 0;
    while (!(bedDepth(x, 0) < 0.5 && inside(x, 0))) x += 0.05;
    game.fish.x[0] = x;
    game.fish.y[0] = 0;
    game.fish.heading[0] = 0;
    game.fish.depth[0] = depthRange(x, 0)[0];
    game.fish.rise[0] = -10;
    expect(checkInvariants(game)).toEqual([]);
    game.fish.rise[0] = 10;
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports the cured fish not matching the save, and a cured fish that is the bite’s', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 3 }));
    expect(checkInvariants(game)).toEqual([]);
    game.fish.cured[5] = 1;
    expect(checkInvariants(game).join('\n')).toMatch(/4 fish are cured, but the save says 3/);
    game.fish.cured[5] = 0;
    game.fish.cured[0] = 0;
    expect(checkInvariants(game).join('\n')).toMatch(/2 fish are cured, but the save says 3/);
    game.fish.cured[0] = 1;
    expect(checkInvariants(game)).toEqual([]);
    // a save past the pond's size means all of them
    const full = newGame(1, JSON.stringify({ cured: 99 })).game;
    expect(checkInvariants(full)).toEqual([]);
    full.fish.cured[2] = 0;
    expect(checkInvariants(full).join('\n')).toMatch(/11 fish are cured, but the save says 99/);
    // and a cured fish coming to the lure
    const { game: g } = newGame(1, JSON.stringify({ cured: 1 }));
    g.lure.phase = 'sinking';
    g.bite.phase = 'coming';
    g.bite.fish = 0;
    g.fish.held = 0;
    expect(checkInvariants(g).join('\n')).toMatch(/fish 0 is cured, but it is the bite's \(coming\)/);
  });
});

describe('the water the page shows', () => {
  it('is within nought and one', () => {
    const { game } = newGame();
    game.waterDirt = 1.5;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt is 1.5/);
    game.waterDirt = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt is NaN/);
  });
  it('is never cleaner than the truth', () => {
    const { game } = newGame();
    game.contamination = 0.5;
    game.waterDirt = 0.4;
    expect(checkInvariants(game).join('\n')).toMatch(/the water is cleaner than the lake/);
  });
  it('never rises unless the lever was set', () => {
    const { game } = newGame();
    game.contamination = 0.2;
    game.waterDirt = 0.6;
    expect(checkInvariants(game)).toEqual([]);
    game.waterDirt = 0.7;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt rose from 0.6 to 0.7, and no lever was set/);
    game.setContamination(0.9);
    expect(checkInvariants(game)).toEqual([]);
  });
});
