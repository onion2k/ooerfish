/** The drums of waste on the bed: where they lie, from a seed of their own, and which are hauled. */
import { describe, expect, it } from 'vitest';
import { Drums, drumPlaces, type DrumSpec } from '../src/drums';
import { ANGLER, DRUMS, MAX_DEPTH, bedDepth, boulderGap, inside, BOULDERS } from '../src/lake';

const world = { inside, bedDepth, from: [ANGLER.x, ANGLER.y] as const };
const places = () => drumPlaces(DRUMS, world);

describe('where the drums lie', () => {
  it('gives as many places as there are drums', () => {
    expect(places()).toHaveLength(DRUMS.count);
  });

  it('puts each on the bed, in the water, at a depth the lure can reach the bed at', () => {
    for (const [x, y] of places()) {
      expect(inside(x, y, DRUMS.where.margin), 'in the water, clear of the shore').toBe(true);
      const bed = bedDepth(x, y);
      expect(bed).toBeGreaterThanOrEqual(DRUMS.where.depth[0]);
      expect(bed).toBeLessThanOrEqual(DRUMS.where.depth[1]);
      expect(bed, 'under the surface').toBeGreaterThan(0);
      expect(bed).toBeLessThanOrEqual(MAX_DEPTH);
    }
  });

  it('keeps them off the boulders and apart from each other', () => {
    const p = places();
    for (const [x, y] of p) {
      expect(boulderGap(x, y)).toBeGreaterThan(DRUMS.where.margin);
      for (const b of BOULDERS) expect(Math.hypot(x - b.x, y - b.y)).toBeGreaterThan(b.radius + DRUMS.where.margin);
    }
    expect(Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1])).toBeGreaterThanOrEqual(DRUMS.where.apart);
  });

  it('lies within a cast of the angler, toward the middle', () => {
    for (const [x, y] of places()) {
      const d = Math.hypot(x - ANGLER.x, y - ANGLER.y);
      expect(d).toBeGreaterThanOrEqual(DRUMS.where.distance[0]);
      expect(d).toBeLessThanOrEqual(DRUMS.where.distance[1]);
      expect(y).toBeGreaterThan(ANGLER.y);
    }
  });

  it('is the same every time, and never reads the game’s chance', () => {
    expect(places()).toEqual(places());
    const saved = Math.random;
    Math.random = () => {
      throw new Error('the drums reached for Math.random');
    };
    try {
      expect(places()).toEqual(drumPlaces(DRUMS, world));
    } finally {
      Math.random = saved;
    }
  });

  it('moves with its own seed, and one more drum moves none before it', () => {
    const other = drumPlaces({ ...DRUMS, seed: DRUMS.seed + 1 }, world);
    expect(other).not.toEqual(places());
    const more = drumPlaces({ ...DRUMS, count: DRUMS.count + 1 }, world);
    expect(more.slice(0, DRUMS.count)).toEqual(places());
  });

  it('throws when the content leaves a drum no place', () => {
    const none: DrumSpec = { ...DRUMS, where: { ...DRUMS.where, depth: [50, 60] } };
    expect(() => drumPlaces(none, world)).toThrow(/no place/);
  });
});

describe('the drums', () => {
  const drums = () =>
    new Drums([
      [0, 0],
      [10, 0],
    ]);

  it('starts with none hauled, and counts them as they are', () => {
    const d = drums();
    expect(d.hauledCount()).toBe(0);
    d.haul(1);
    expect(d.hauledCount()).toBe(1);
    expect(d.hauled[1]).toBe(1);
  });

  it('loads the first n hauled, held to the drums there are', () => {
    const d = drums();
    d.load(1);
    expect(Array.from(d.hauled)).toEqual([1, 0]);
    d.load(9);
    expect(Array.from(d.hauled)).toEqual([1, 1]);
    d.load(-3);
    expect(Array.from(d.hauled)).toEqual([0, 0]);
  });

  it('finds the nearest drum within reach, and never a hauled one', () => {
    const d = drums();
    expect(d.snagged(1, 0, 2)).toBe(0);
    expect(d.snagged(9, 0, 2)).toBe(1);
    expect(d.snagged(5, 0, 2), 'out of reach of both').toBe(-1);
    d.haul(0);
    expect(d.snagged(0.1, 0, 2), 'the hauled one is gone however near').toBe(-1);
  });

  it('skips a drum that is wary until its time', () => {
    const d = drums();
    const wary = new Float64Array([5, 0]);
    expect(d.snagged(0, 0, 2, wary, 4)).toBe(-1);
    expect(d.snagged(0, 0, 2, wary, 5.5)).toBe(0);
  });
});
