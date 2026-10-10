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
});
