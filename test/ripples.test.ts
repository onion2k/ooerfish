/**
 * A splash's ripples as the water is handed them, and its droplets. The rings are drawn by the renderer's clear water,
 * in the water's own normal; the game hands it, each frame, where each splash landed, how long ago and how big. Without
 * this a splash could be handed over late or twice, live on past the ripples' life, or be lost when the pool is full.
 */
import { RING_FLOATS, RING_SLOTS } from 'artshape-render/game/clear';
import { describe, expect, it } from 'vitest';
import { splashBurst } from '../src/bursts';
import { SPLASH_CAPACITY } from '../src/lake';
import { RIPPLE_FLOATS, rippleData } from '../src/ripples';
import { Splashes } from '../src/splash';

const LIFE = 3.5;

describe("a splash's ripples, as the water is handed them", () => {
  it('fit the slots the renderer draws, four floats each as it reads them: the pool is no bigger than its slots', () => {
    expect(RIPPLE_FLOATS).toBe(RING_FLOATS);
    expect(SPLASH_CAPACITY).toBeLessThanOrEqual(RING_SLOTS);
  });

  it("are where each splash landed, how long ago and how big, in the pool's order", () => {
    const splashes = new Splashes();
    splashes.add(1, 2, 0, 1);
    splashes.add(-3, 4, 0.5, 0.6);
    const out = new Float32Array(SPLASH_CAPACITY * RIPPLE_FLOATS);
    expect(rippleData(splashes, 1, LIFE, out)).toBe(2);
    expect([...out.subarray(0, 8)]).toEqual([1, 2, 1, 1, -3, 4, 0.5, Math.fround(0.6)]);
  });

  it('leave out a splash whose ripples are over, and hand the next in its place', () => {
    const splashes = new Splashes();
    splashes.add(1, 1, 0, 1);
    splashes.add(2, 2, 3, 1);
    const out = new Float32Array(SPLASH_CAPACITY * RIPPLE_FLOATS);
    expect(rippleData(splashes, 3.4, LIFE, out), 'both live').toBe(2);
    expect(rippleData(splashes, LIFE, LIFE, out), 'the first over at its life').toBe(1);
    expect([...out.subarray(0, 4)]).toEqual([2, 2, Math.fround(LIFE - 3), 1]);
    expect(rippleData(splashes, 3 + LIFE + 0.01, LIFE, out), 'none once both are over').toBe(0);
  });

  it("are every splash of a full pool, the newest in the oldest's slot", () => {
    const splashes = new Splashes();
    for (let i = 0; i < SPLASH_CAPACITY + 1; i++) splashes.add(i, 0, i * 0.01, 1);
    const out = new Float32Array(SPLASH_CAPACITY * RIPPLE_FLOATS);
    const t = SPLASH_CAPACITY * 0.01 + 0.1;
    expect(rippleData(splashes, t, LIFE, out)).toBe(SPLASH_CAPACITY);
    const xs = Array.from({ length: SPLASH_CAPACITY }, (_, i) => out[i * RIPPLE_FLOATS]);
    expect(
      xs.sort((a, b) => a - b),
      'the first replaced by the thirteenth',
    ).toEqual(Array.from({ length: SPLASH_CAPACITY }, (_, i) => i + 1));
  });

  it('are written into the array they are handed, and nothing is made', () => {
    const splashes = new Splashes();
    splashes.add(0, 0, 0, 1);
    const out = new Float32Array(SPLASH_CAPACITY * RIPPLE_FLOATS).fill(9);
    rippleData(splashes, 0.25, LIFE, out);
    expect(out[2]).toBe(0.25);
    // what is past the count is not read, and is left alone
    expect(out[4]).toBe(9);
  });
});

describe("a splash's droplets", () => {
  it('jump up from where it landed, more for a bigger splash, in the contamination’s colour', () => {
    const clean = splashBurst(3, -2, 1, 0),
      sick = splashBurst(3, -2, 1, 1),
      big = splashBurst(3, -2, 2, 0);
    expect(clean.position.slice(0, 2)).toEqual([3, -2]);
    expect(clean.velocity[2]).toBeGreaterThan(0);
    expect(clean.gravity).toBeGreaterThan(0);
    expect(clean.count).toBeGreaterThan(0);
    expect(big.count).toBeGreaterThan(clean.count);
    expect(clean.colour[2], 'clean, blue').toBeGreaterThan(clean.colour[0]);
    expect(sick.colour[1], 'sick, green').toBeGreaterThan(sick.colour[2]);
    expect(clean.floor!, 'they die as they fall back into the water').toBeLessThanOrEqual(0);
  });
});
