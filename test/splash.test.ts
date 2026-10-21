/** Splashes: a pebble dropped on the water, where and when it landed, kept in a pool of fixed size. */
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { HOME } from '../src/lakes';
import { SPLASH_CAPACITY } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, settle } from './helpers';

const DECK = HOME.jetty!.deck;
const inside = HOME.inside;
const jettyGap = HOME.jetty!.gap;
const shoreRadius = HOME.shoreRadius;

/** A lake that keeps a note of every splash it tells of. */
function lake(seed = 1) {
  const told: string[] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: { splashed: (x, y, size) => told.push(`${x.toFixed(2)},${y.toFixed(2)} ${size}`) },
  });
  return { game, told };
}

describe('a pebble dropped on the water', () => {
  it('splashes where it lands, at the time it lands, and tells of it', () => {
    const { game, told } = lake();
    settle(game, 30);
    expect(game.drop(3, -4)).toBe(true);
    expect(game.splashes.count).toBe(1);
    expect(game.splashes.x[0]).toBe(3);
    expect(game.splashes.y[0]).toBe(-4);
    expect(game.splashes.at[0]).toBe(game.t);
    expect(game.splashes.size[0]).toBe(1);
    expect(told).toEqual(['3.00,-4.00 1']);
    game.step(DT);
    expect(game.splashes.age(0, game.t)).toBeCloseTo(DT, 10);
  });

  it('is refused off the water, or where it is not a number, and nothing is told', () => {
    const { game, told } = lake();
    const north = shoreRadius(Math.PI / 2);
    expect(inside(0, north + 2)).toBe(false);
    expect(game.drop(0, north + 2)).toBe(false);
    expect(game.drop(Number.NaN, 0)).toBe(false);
    expect(game.drop(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(game.drop(0, 0, Number.NaN)).toBe(false);
    expect(game.drop(0, 0, -1)).toBe(false);
    expect(game.splashes.count).toBe(0);
    expect(told).toEqual([]);
  });

  it('is refused on the jetty’s deck, and lands beside it', () => {
    const { game, told } = lake();
    // a point on the deck: a way in from its start along its middle line
    const x = DECK.x + DECK.inward[0] * 6,
      y = DECK.y + DECK.inward[1] * 6;
    expect(inside(x, y)).toBe(false);
    expect(game.drop(x, y)).toBe(false);
    expect(game.splashes.count).toBe(0);
    expect(told).toEqual([]);
    // and a drop somewhere near it finds the water, never the planks
    for (let k = 0; k < 40; k++) {
      expect(game.dropNear(x, y)).toBe(true);
      const i = (game.splashes.next + SPLASH_CAPACITY - 1) % SPLASH_CAPACITY;
      expect(jettyGap(game.splashes.x[i], game.splashes.y[i]), `splash ${k}`).toBeGreaterThan(0);
    }
  });

  it('lands on the water near a point when dropped somewhere, the same places from the same seed', () => {
    const places = (seed: number) => {
      const { game } = lake(seed);
      const out: string[] = [];
      for (let k = 0; k < 8; k++) {
        expect(game.dropNear(10, 5)).toBe(true);
        const i = (game.splashes.next + SPLASH_CAPACITY - 1) % SPLASH_CAPACITY;
        expect(inside(game.splashes.x[i], game.splashes.y[i])).toBe(true);
        expect(Math.hypot(game.splashes.x[i] - 10, game.splashes.y[i] - 5)).toBeLessThan(12);
        out.push(`${game.splashes.x[i]},${game.splashes.y[i]}`);
      }
      return out;
    };
    expect(places(3)).toEqual(places(3));
    expect(places(4)).not.toEqual(places(3));
  });

  it('lands on the water even when dropped near a point off it', () => {
    const { game } = lake();
    expect(game.dropNear(200, 0)).toBe(true);
    const i = game.splashes.next - 1;
    expect(inside(game.splashes.x[i], game.splashes.y[i])).toBe(true);
  });

  it('keeps no more splashes than the pool holds: the one after the last replaces the oldest', () => {
    const { game } = lake();
    for (let k = 0; k < SPLASH_CAPACITY; k++) {
      game.drop(k * 0.5, 0);
      game.step(DT);
    }
    expect(game.splashes.count).toBe(SPLASH_CAPACITY);
    const oldest = game.splashes.at[0];
    game.drop(-5, 2);
    expect(game.splashes.count).toBe(SPLASH_CAPACITY);
    expect(game.splashes.x[0], 'the oldest replaced').toBe(-5);
    expect(game.splashes.at[0]).toBeGreaterThan(oldest);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('what must always hold of the splashes', () => {
  it('reports one off the water, one from the future, and one that is not a number', () => {
    const { game } = lake();
    game.drop(1, 1);
    game.splashes.x[0] = 500;
    expect(checkInvariants(game).join('\n')).toMatch(/splash 0 is off the water/);
    game.splashes.x[0] = 1;
    game.splashes.at[0] = game.t + 5;
    expect(checkInvariants(game).join('\n')).toMatch(/splash 0 landed after now/);
    game.splashes.at[0] = Number.NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/splash 0 is not a number/);
    game.splashes.at[0] = 0;
    game.splashes.count = SPLASH_CAPACITY + 1;
    expect(checkInvariants(game).join('\n')).toMatch(/splashes/);
  });
});
