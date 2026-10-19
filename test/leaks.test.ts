/**
 * What must stay bounded over a long game, and the tool that watches it.
 * The run itself is too long for a unit test — `npm run leaks` does that —
 * so what is tested here is the measuring: that the sizes are read off the
 * game properly, and that the thing which decides what is growing says so
 * when it is, and holds its tongue when it is not.
 */
import { describe, expect, it } from 'vitest';
import { WATCH, grew, sizes, trouble } from '../scripts/leaks';
import { crowd } from '../scripts/phonemonkey';
import { seeded } from '../src/random';
import { newGame } from './helpers';

describe('what must stay bounded', () => {
  it('reads the sizes off a game, and has a ceiling for every one', () => {
    const { game } = newGame();
    const now = sizes(game);
    for (const key of ['fish', 'splashes', 'save bytes', 'journal kinds', 'drums hauled', 'heap MB']) {
      expect(Object.keys(now), `${key} measured`).toContain(key);
      expect(Number.isFinite(now[key])).toBe(true);
      expect(Object.keys(WATCH), `a ceiling for ${key}`).toContain(key);
    }
    expect(now['save bytes'], 'a fresh save is {"cured":0,"day":1,"drums":0,"journal":{}}, forty-two bytes').toBe(42);
  });

  it('holds the phone to its ceilings through a busy room of phones, strangers and noise', () => {
    const { game } = newGame();
    const room = crowd(() => game, seeded(3));
    let most = { holds: 0, peers: 0 };
    for (let f = 0; f < 60 * 600; f++) {
      room.tick(f);
      game.step(1 / 60);
      const now = sizes(game, room);
      most = { holds: Math.max(most.holds, now['gesture holds']), peers: Math.max(most.peers, now['session peers']) };
    }
    expect(most.peers, 'a phone was paired at some point').toBe(1);
    expect(most.holds, 'a phone reeled at some point').toBeGreaterThan(0);
    expect(most.holds).toBeLessThanOrEqual(WATCH['gesture holds']!.ceiling);
    expect(most.peers).toBeLessThanOrEqual(WATCH['session peers']!.ceiling);
    expect(room.session.reading().refused, 'the noise was refused, not kept').toBeGreaterThan(0);
  });

  it('knows a size that grows from one that wanders', () => {
    expect(grew([10, 10, 10, 10, 10, 10, 10, 10, 10])).toBe(false);
    expect(grew([10, 12, 9, 11, 10, 12, 9, 11, 10])).toBe(false);
    expect(grew([0, 20, 40, 60, 50, 50, 50, 50, 50]), 'filled up early and settled').toBe(false);
    expect(grew([10, 20, 30, 40, 50, 60, 70, 80, 90]), 'creeping all the way through').toBe(true);
    expect(grew([1, 2, 3]), 'too short to say').toBe(false);
  });

  it('reports a size over its ceiling, and a steady one still climbing', () => {
    expect(trouble({ 'save bytes': [10, 10, 10] })).toEqual([]);
    expect(trouble({ 'save bytes': [10, 10_000, 10] }).join('\n')).toMatch(/save bytes went to 10000/);
    expect(trouble({ 'heap MB': [10, 40, 70, 100, 130, 160, 190, 220, 250] }).join('\n')).toMatch(/grew all the way/);
    // a size that only ever climbs is held by its ceiling alone
    expect(trouble({ 'save bytes': [1, 2, 3, 4, 5, 6, 7, 8, 9] })).toEqual([]);
  });

  it('plays a room of phones on through a night: the game leaves the cabin and the save stays small', () => {
    const { game } = newGame(3);
    const room = crowd(() => game, seeded(3));
    // two minutes before midnight, played for five
    game.setTimeOfDay(1 - 120 / 720);
    for (let f = 0; f < 60 * 300; f++) {
      room.tick(f);
      game.step(1 / 60);
    }
    expect(game.day, 'a night was crossed').toBeGreaterThanOrEqual(2);
    expect(game.place).not.toBe('cabin');
    expect(sizes(game, room)['save bytes']).toBeLessThanOrEqual(WATCH['save bytes']!.ceiling);
  });
});
