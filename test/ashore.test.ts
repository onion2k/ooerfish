/**
 * The game with the boat never used is the game as it was before there was a boat (`docs/boat.md`, C2): a seed played
 * for a minute and more, cast, struck, fought and stowed by the careful angler, hashed over everything the lake does
 * (the fish, the lure and the bobber's body, the rope, the line and the splashes, but not the save, which has a field
 * more), and held to the figures taken before the boat was written. A figure here moving means the shore's path moved.
 */
import { describe, expect, it } from 'vitest';
import { careful } from '../src/angler';
import { Game } from '../src/game';
import { HOME, LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import type { Lake } from '../src/lakes/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DT = 1 / 60;

/** The lake's state as one number in hex, FNV-1a over the bits of everything the fishing moves. */
function hashOf(game: Game): string {
  let h = 0x811c9dc5;
  const bits = new DataView(new ArrayBuffer(8));
  const eat = (n: number) => {
    bits.setFloat64(0, n);
    for (let b = 0; b < 8; b++) {
      h ^= bits.getUint8(b);
      h = Math.imul(h, 0x01000193);
    }
  };
  const { fish, lure, line, bite } = game;
  eat(game.t);
  for (let i = 0; i < fish.count; i++) {
    eat(fish.x[i]);
    eat(fish.y[i]);
    eat(fish.depth[i]);
    eat(fish.heading[i]);
    eat(fish.cured[i]);
    eat(fish.phase[i]);
  }
  for (const n of [...lure.at, ...lure.bobber, lure.depth, lure.angle, lure.power]) eat(n);
  eat(game.bodies.x);
  eat(game.bodies.y);
  eat(game.bodies.held ? 1 : 0);
  for (const n of game.rope.points) eat(n);
  for (const n of [line.out, line.tension, line.zone, line.meter, game.bucket, game.catchWeight, game.contamination])
    eat(n);
  eat(['none', 'coming', 'nibbling', 'biting', 'hooked', 'landed'].indexOf(bite.phase));
  eat(game.splashes.count);
  for (let i = 0; i < game.splashes.count; i++) {
    eat(game.splashes.x[i]);
    eat(game.splashes.y[i]);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A seed played `frames` frames by the careful angler on the shore, never touching a boat; the hash after each 300 and how many fish it stowed. */
function play(lake: Lake, seed: number, frames: number): { hashes: string[]; stowed: number } {
  const game = new Game(new Progress(memoryStore(), LAKES), { lake, random: seeded(seed) });
  const hashes: string[] = [];
  for (let f = 1; f <= frames; f++) {
    game.step(DT);
    if (f % 100 === 50 && game.lure.phase === 'ready')
      game.cast(lake.aim.angle + game.random() * 0.4 - 0.2, 0.4 + game.random() * 0.5);
    if (game.bite.phase === 'biting') game.strike();
    if (game.bite.phase === 'hooked')
      game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt, game.line.figures.width));
    if (game.bite.phase === 'landed') game.stow();
    if (f % 300 === 0) hashes.push(hashOf(game));
  }
  return { hashes, stowed: game.bucket };
}

/** What the game hashed to before the boat, taken from the tree as it stood at `bd118af`. */
const BEFORE: Record<string, { hashes: string[]; stowed: number }> = {
  'duckpond:1': {
    hashes: [
      '5639184e',
      '3d8cdaa4',
      '989d82eb',
      '484676a7',
      '06867e1a',
      '55eb874c',
      '016c2bd0',
      '9caa6944',
      'd92a26fb',
      '0d450e67',
      'f860c1f6',
      'e10cf4d7',
    ],
    stowed: 2,
  },
  'duckpond:2': {
    hashes: [
      '9ea6a762',
      '879a08cd',
      '21ed2c33',
      '2efac20c',
      'e0e882cb',
      '02fda59a',
      'ddffa27e',
      '323febad',
      '5b5c808a',
      'dfc4756e',
      '26d8e1d9',
      '078d4d21',
    ],
    stowed: 2,
  },
  'duckpond:3': {
    hashes: [
      '35d8ea40',
      '3c0ec375',
      '43aef6ac',
      '78cc8ffc',
      '52101354',
      'f74df710',
      '47a9b0d8',
      '0d65c719',
      '838361e7',
      'efd62c56',
      '55215488',
      'bd3e6eaf',
    ],
    stowed: 2,
  },
  'reservoir:1': {
    hashes: [
      '148e845d',
      '32e06d74',
      '45bec43b',
      '0cf561a1',
      'd2a7f541',
      '2730f29a',
      'c8bc787c',
      '97f8ecb1',
      '037dc25c',
      'ecd659bf',
      'd323bd68',
      'ef4aab3f',
    ],
    stowed: 1,
  },
  'reservoir:2': {
    hashes: [
      'd0097056',
      '605367a9',
      '1e7881ac',
      '466672b9',
      '8acf3709',
      'ba5504a3',
      'b9126e4b',
      '9cf4bf3d',
      '04acfead',
      '359aea25',
      'cb1c6c98',
      'e52a124d',
    ],
    stowed: 0,
  },
};

describe('the shore, with the boat never used', () => {
  for (const [lake, seeds] of [
    [HOME, [1, 2, 3]],
    [RESERVOIR, [1, 2]],
  ] as const)
    for (const seed of seeds)
      it(`plays ${lake.id} seed ${seed} as it was before the boat, to the bit`, () => {
        const got = play(lake, seed, 3600);
        expect(got, JSON.stringify(got)).toEqual(BEFORE[`${lake.id}:${seed}`]);
      });

  it('stows at least one fish in the seeds, so the fight is among what is held', () => {
    let stowed = 0;
    for (const v of Object.values(BEFORE)) stowed += v.stowed;
    expect(stowed).toBeGreaterThan(0);
  });
});
