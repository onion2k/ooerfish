import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { newGame, settle } from './helpers';

describe('what must always hold', () => {
  it('holds of a new lake, and of one played a while', () => {
    const { game } = newGame();
    expect(checkInvariants(game)).toEqual([]);
    settle(game);
    expect(checkInvariants(game)).toEqual([]);
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
    expect(broken((g) => (g.bucket = -1))).toMatch(/the bucket holds -1/);
    // and with no fish at the lure, none held
    const { game } = newGame();
    game.fish.held = 2;
    expect(checkInvariants(game).join('\n')).toMatch(/no fish is at the lure, but the school holds fish 2/);
  });
});
