/**
 * The lamp eel's light (`docs/kinds.md`): at night each uncured eel is one of the renderer's point lights at its
 * position, in its glow's colour, and by day, on a lean machine, at the pond and once cured it is none. The pool is
 * written into and nothing is made after the lights are built.
 */
import { LightPool } from 'artshape-render/game/lights';
import { describe, expect, it } from 'vitest';
import { EelLights } from '../src/eellight';
import { Game } from '../src/game';
import { EEL_LIGHT, KIND_INDEX, KINDS } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import { PALETTE } from '../src/palette';
import { memoryStore, Progress } from '../src/progress';
import { seeded } from '../src/random';
import { settle } from './helpers';

const reservoir = () => {
  const game = new Game(new Progress(memoryStore(null), LAKES), { lake: RESERVOIR, random: seeded(6) });
  settle(game, 40);
  return game;
};
const eelSlots = RESERVOIR.fishKinds.flatMap((k, i) => (k === KIND_INDEX.eel ? [i] : []));

describe('the eels’ lights', () => {
  it('lights each uncured eel at night, at its place, in its glow’s colour, after the lamp’s slot', () => {
    const game = reservoir();
    const pool = new LightPool(16);
    const lights = new EelLights(RESERVOIR, 1);
    lights.write(game.fish, true, pool);
    expect(eelSlots.length).toBe(2);
    expect(lights.count).toBe(2);
    expect(lights.lit).toBe(true);
    expect(pool.count).toBe(3);
    eelSlots.forEach((slot, n) => {
      const light = pool.get(1 + n)!;
      const f = game.fish;
      expect(light.position[0]).toBeCloseTo(f.x[slot], 4);
      expect(light.position[1]).toBeCloseTo(f.y[slot], 4);
      expect(light.position[2]).toBeCloseTo(-f.depth[slot], 4);
      expect(light.radius).toBeCloseTo(EEL_LIGHT.radius, 5);
      expect(light.intensity).toBeCloseTo(EEL_LIGHT.intensity, 5);
      expect(light.colour.map((c) => Math.fround(c))).toEqual(PALETTE[KINDS[KIND_INDEX.eel].glow].map(Math.fround));
    });
  });

  it('keeps no light when it is not lit, by day or on the lean rung', () => {
    const game = reservoir();
    const pool = new LightPool(16);
    const lights = new EelLights(RESERVOIR, 1);
    lights.write(game.fish, true, pool);
    lights.write(game.fish, false, pool);
    expect(lights.count).toBe(0);
    expect(lights.lit).toBe(false);
    expect(pool.count).toBe(0);
  });

  it('lights no cured eel', () => {
    const game = reservoir();
    game.fish.cured[eelSlots[0]] = 1;
    const pool = new LightPool(16);
    const lights = new EelLights(RESERVOIR, 1);
    lights.write(game.fish, true, pool);
    expect(lights.count).toBe(1);
    expect(pool.get(1)!.position[0]).toBeCloseTo(game.fish.x[eelSlots[1]], 4);
  });

  it('lights nothing at the pond, which holds no eel', () => {
    const game = new Game(new Progress(memoryStore(null), LAKES), { lake: HOME, random: seeded(6) });
    const pool = new LightPool(16);
    const lights = new EelLights(HOME, 1);
    lights.write(game.fish, true, pool);
    expect(lights.count).toBe(0);
    expect(lights.lit).toBe(false);
  });

  it('writes again into the same objects, allocating nothing, and follows the eel', () => {
    const game = reservoir();
    const pool = new LightPool(16);
    const lights = new EelLights(RESERVOIR, 1);
    lights.write(game.fish, true, pool);
    const before = lights.objects();
    const first = before[0].position;
    const x = first[0];
    settle(game, 30);
    lights.write(game.fish, true, pool);
    const after = lights.objects();
    expect(after[0]).toBe(before[0]);
    expect(after[0].position).toBe(first);
    expect(after[0].position[0]).not.toBe(x);
  });

  it('leaves the lamp’s slot alone as a dark filler when only the eels are lit', () => {
    const game = reservoir();
    const pool = new LightPool(16);
    new EelLights(RESERVOIR, 1).write(game.fish, true, pool);
    expect(pool.get(0)!.intensity).toBe(0);
  });
});
