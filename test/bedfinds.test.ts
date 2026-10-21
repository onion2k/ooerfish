/** The things on the bed (the drums of waste, now): where they lie, from a seed of their own, and which are found. */
import { describe, expect, it } from 'vitest';
import { BedFinds, places as bedPlaces, type BedSpec } from '../src/bedfinds';
import { HOME } from '../src/lakes';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';

const ANGLER = HOME.angler;
const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };
const MAX_DEPTH = HOME.maxDepth;
const bedDepth = HOME.bedDepth;
const boulderGap = HOME.boulderGap;
const inside = HOME.inside;
const BOULDERS = HOME.boulders;

const world = { inside, bedDepth, from: [ANGLER.x, ANGLER.y] as const };
const places = () => bedPlaces(DRUMS, world);

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
      expect(places()).toEqual(bedPlaces(DRUMS, world));
    } finally {
      Math.random = saved;
    }
  });

  it('moves with its own seed, and one more drum moves none before it', () => {
    const other = bedPlaces({ ...DRUMS, seed: DRUMS.seed + 1 }, world);
    expect(other).not.toEqual(places());
    const more = bedPlaces({ ...DRUMS, count: DRUMS.count + 1 }, world);
    expect(more.slice(0, DRUMS.count)).toEqual(places());
  });

  it('throws when the content leaves a drum no place', () => {
    const none: BedSpec = { ...DRUMS, where: { ...DRUMS.where, depth: [50, 60] } };
    expect(() => bedPlaces(none, world)).toThrow(/no place/);
  });
});

describe('a set on the bed', () => {
  const drums = () =>
    new BedFinds([
      [0, 0],
      [10, 0],
    ]);

  it('starts with none found, and counts them as they are', () => {
    const d = drums();
    expect(d.foundCount()).toBe(0);
    d.find(1);
    expect(d.foundCount()).toBe(1);
    expect(d.found[1]).toBe(1);
  });

  it('loads the first n found, held to the things there are', () => {
    const d = drums();
    d.loadFirst(1);
    expect(Array.from(d.found)).toEqual([1, 0]);
    d.loadFirst(9);
    expect(Array.from(d.found)).toEqual([1, 1]);
    d.loadFirst(-3);
    expect(Array.from(d.found)).toEqual([0, 0]);
  });

  it('loads by ids, dropping an id there is no thing for', () => {
    const d = drums();
    d.loadFirst(2);
    d.load([1, 7, -1, 1.5]);
    expect(Array.from(d.found)).toEqual([0, 1]);
    d.load([]);
    expect(Array.from(d.found)).toEqual([0, 0]);
  });

  it('finds the nearest drum within reach, and never a found one', () => {
    const d = drums();
    expect(d.snagged(1, 0, 2)).toBe(0);
    expect(d.snagged(9, 0, 2)).toBe(1);
    expect(d.snagged(5, 0, 2), 'out of reach of both').toBe(-1);
    d.find(0);
    expect(d.snagged(0.1, 0, 2), 'the found one is gone however near').toBe(-1);
  });

  it('skips a drum that is wary until its time', () => {
    const d = drums();
    const wary = new Float64Array([5, 0]);
    expect(d.snagged(0, 0, 2, wary, 4)).toBe(-1);
    expect(d.snagged(0, 0, 2, wary, 5.5)).toBe(0);
  });
});

describe('where the treasures lie', () => {
  const drumsAt = () => bedPlaces(DRUMS, world);
  const treasures = () => bedPlaces(TREASURES, world, drumsAt());

  it('has six, each with an id, a name, a card line, a weight and a place on the shelves', () => {
    expect(TREASURES.count).toBe(6);
    expect(TREASURES.list).toHaveLength(TREASURES.count);
    expect(new Set(TREASURES.list.map((t) => t.id)).size, 'ids are their own').toBe(TREASURES.count);
    for (const t of TREASURES.list) {
      expect(t.name.length, t.id).toBeGreaterThan(0);
      expect(t.line.length, t.id).toBeGreaterThan(0);
      expect(t.weight, t.id).toBeGreaterThan(0);
      expect(['lower', 'upper'], t.id).toContain(t.shelf.on);
    }
    expect(
      TREASURES.list.filter((t) => t.note).map((t) => t.id),
      'only the bottle holds a note',
    ).toEqual(['bottle']);
    expect(TREASURES.list.map((t) => t.id)).toEqual(['lure', 'plush', 'lunchbox', 'badge', 'bottle', 'duck']);
  });

  it('gives as many places as there are treasures, each on the bed under the water, clear of the shore and the boulders', () => {
    const p = treasures();
    expect(p).toHaveLength(TREASURES.count);
    for (const [x, y] of p) {
      expect(inside(x, y, TREASURES.where.margin), 'in the water, clear of the shore').toBe(true);
      const bed = bedDepth(x, y);
      expect(bed).toBeGreaterThanOrEqual(TREASURES.where.depth[0]);
      expect(bed).toBeLessThanOrEqual(TREASURES.where.depth[1]);
      expect(bed, 'under the surface').toBeGreaterThan(0);
      expect(boulderGap(x, y)).toBeGreaterThan(TREASURES.where.margin);
      for (const b of BOULDERS) expect(Math.hypot(x - b.x, y - b.y)).toBeGreaterThan(b.radius + TREASURES.where.margin);
    }
  });

  it('keeps each clear of every drum by `apart`, and of each other', () => {
    const p = treasures();
    for (const [x, y] of p) {
      for (const [dx, dy] of drumsAt())
        expect(Math.hypot(x - dx, y - dy)).toBeGreaterThanOrEqual(TREASURES.where.apart);
    }
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++)
        expect(Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1])).toBeGreaterThanOrEqual(TREASURES.where.apart);
  });

  it('is the same every time, from a seed of its own, never the game’s chance', () => {
    expect(treasures()).toEqual(treasures());
    expect(bedPlaces({ ...TREASURES, seed: TREASURES.seed + 1 }, world, drumsAt())).not.toEqual(treasures());
    const saved = Math.random;
    Math.random = () => {
      throw new Error('the treasures reached for Math.random');
    };
    try {
      expect(treasures()).toEqual(bedPlaces(TREASURES, world, drumsAt()));
    } finally {
      Math.random = saved;
    }
  });

  it('keeps clear of whatever is handed in to avoid, and moves none of the drums', () => {
    const none = bedPlaces(TREASURES, world);
    expect(none, 'with nothing to avoid the places may differ').toHaveLength(TREASURES.count);
    expect(drumsAt()).toEqual(bedPlaces(DRUMS, world, []));
  });
});

describe('the treasures as a set on the bed', () => {
  const set = () => new BedFinds(bedPlaces(TREASURES, world, bedPlaces(DRUMS, world)));

  it('never snags one found, however near, and snags the nearest unfound', () => {
    const t = set();
    const [x, y] = [t.x[2], t.y[2]];
    expect(t.snagged(x, y, 1)).toBe(2);
    t.find(2);
    expect(t.snagged(x, y, 1), 'found, so gone from the bed').toBe(-1);
  });

  it('loads by the ids it is given and drops the ones it has no thing for', () => {
    const t = set();
    t.load([0, 5, 6, -1]);
    expect(Array.from(t.found)).toEqual([1, 0, 0, 0, 0, 1]);
    expect(t.foundCount()).toBe(2);
  });
});
