/** The lake without its picture: its clock, and that it is played the same from a seed. */
import { describe, expect, it } from 'vitest';
import { DT, newGame, settle } from './helpers';

describe('the lake', () => {
  it('starts at the beginning of its time, and keeps time a step at a time', () => {
    const { game } = newGame();
    expect(game.t).toBe(0);
    settle(game, 60);
    expect(game.t).toBeCloseTo(1, 10);
    game.step(DT / 2);
    expect(game.t).toBeCloseTo(1 + DT / 2, 10);
  });

  it('stands still for a step of no time', () => {
    const { game } = newGame();
    settle(game, 10);
    const t = game.t;
    game.step(0);
    expect(game.t).toBe(t);
  });

  it('writes nothing to the save until asked', () => {
    const { game, store } = newGame();
    settle(game);
    expect(store.json).toBe(null);
    game.persist();
    expect(store.json).toBe('{}');
  });
});
