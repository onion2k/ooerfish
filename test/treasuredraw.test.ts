/** The treasures as they are drawn: each model built once from primitives, painted, small, and on the bed or the shelf. */
import { describe, expect, it } from 'vitest';
import { BedFinds, places } from '../src/bedfinds';
import { TreasureDraw, bedSpot, shelfSpot, treasureParts } from '../src/treasuredraw';
import { HOME } from '../src/lakes';
import { PALETTE } from '../src/palette';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';

const ANGLER = HOME.angler;
const CABIN = HOME.cabin!.spec;
const CABIN_AT = HOME.cabin!.at;
const CABIN_FLOOR = HOME.cabin!.floor;
const CABIN_ROOM = HOME.cabin!.room;
const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };
const bedDepth = HOME.bedDepth;
const inside = HOME.inside;

const world = { inside, bedDepth, from: [ANGLER.x, ANGLER.y] as const };
const treasures = () => new BedFinds(places(TREASURES, world, places(DRUMS, world)));
const triangles = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;
const zs = (m: { positions: ArrayLike<number> }) =>
  Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + 2]);

describe('each treasure’s model', () => {
  it('is built the same each time, from parts that are painted or plain as they are made', () => {
    TREASURES.list.forEach((t, i) => {
      const a = treasureParts(i, HOME),
        b = treasureParts(i, HOME);
      expect(a.length, t.id).toBeGreaterThan(0);
      expect(a.length, t.id).toBe(b.length);
      a.forEach((p, k) => {
        expect(Array.from(p.mesh.positions), `${t.id} part ${k}`).toEqual(Array.from(b[k].mesh.positions));
        expect(Array.from(p.mesh.indices)).toEqual(Array.from(b[k].mesh.indices));
        expect(p.colour).toEqual(b[k].colour);
      });
    });
  });

  it('is painted on at least its main part', () => {
    for (let i = 0; i < TREASURES.count; i++)
      expect(
        treasureParts(i, HOME).some((p) => p.mesh.paint instanceof Float32Array),
        TREASURES.list[i].id,
      ).toBe(true);
  });

  it('is under sixty triangles all together, and the whole list under a ceiling of its own', () => {
    let all = 0;
    for (let i = 0; i < TREASURES.count; i++) {
      const n = treasureParts(i, HOME).reduce((sum, p) => sum + triangles(p.mesh), 0);
      expect(n, TREASURES.list[i].id).toBeGreaterThan(8);
      expect(n, TREASURES.list[i].id).toBeLessThan(60);
      all += n;
    }
    expect(all).toBeLessThan(450);
  });

  it('stands on the ground it is placed at and is the size the content says', () => {
    TREASURES.list.forEach((t, i) => {
      const parts = treasureParts(i, HOME);
      const z = parts.flatMap((p) => zs(p.mesh));
      expect(Math.min(...z), `${t.id} rests on z = 0`).toBeCloseTo(0, 5);
      expect(Math.max(...z), `${t.id} height`).toBeCloseTo(t.size.high, 1);
      const reach = Math.max(
        ...parts.flatMap((p) =>
          Array.from({ length: p.mesh.positions.length / 3 }, (_, k) =>
            Math.hypot(p.mesh.positions[k * 3], p.mesh.positions[k * 3 + 1]),
          ),
        ),
      );
      expect(reach, `${t.id} reach`).toBeLessThanOrEqual(t.size.radius * 1.05);
      expect(reach, `${t.id} is not tiny`).toBeGreaterThan(t.size.radius * 0.5);
    });
  });
});

describe('the treasures drawn', () => {
  const live = (g: ReturnType<TreasureDraw['groups']>[number]) => g.count;

  it('is a fixed pool of groups, a part each, one placement apiece, however many are found', () => {
    const t = treasures();
    const draw = new TreasureDraw(HOME);
    const none = draw.groups(t);
    const parts = Array.from({ length: TREASURES.count }, (_, i) => treasureParts(i, HOME).length).reduce(
      (a, b) => a + b,
    );
    expect(none).toHaveLength(parts);
    for (const g of none) {
      expect(live(g)).toBe(1);
      expect(g.matrices.length).toBe(16);
    }
    t.load([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const all = draw.groups(t);
    expect(all).toHaveLength(parts);
    all.forEach((g, i) => expect(g.mesh, 'the meshes are made once').toBe(none[i].mesh));
    all.forEach((g, i) => expect(g.matrices, 'the pools are sized once').toBe(none[i].matrices));
  });

  it('lays an unfound treasure on the bed where it lies, a little sunk, and a found one on its shelf', () => {
    const t = treasures();
    const draw = new TreasureDraw(HOME);
    const offsets: number[] = [];
    let n = 0;
    for (let i = 0; i < TREASURES.count; i++) {
      offsets.push(n);
      n += treasureParts(i, HOME).length;
    }
    const before = draw.groups(t);
    TREASURES.list.forEach((_, i) => {
      const m = before[offsets[i]].matrices;
      expect(m[12], `treasure ${i} x`).toBeCloseTo(t.x[i], 5);
      expect(m[13]).toBeCloseTo(t.y[i], 5);
      expect(m[14], 'on the bed under it').toBeLessThanOrEqual(-bedDepth(t.x[i], t.y[i]) + 0.1);
      expect(m[14]).toBeGreaterThan(-bedDepth(t.x[i], t.y[i]) - 0.5);
      expect(Array.from(bedSpot(t, i, HOME)).slice(0, 2)).toEqual([t.x[i], t.y[i]]);
    });
    t.find(4);
    const after = draw.groups(t);
    const m = after[offsets[4]].matrices;
    const [x, y, z] = shelfSpot(4, HOME);
    expect(m[12]).toBeCloseTo(x, 5);
    expect(m[13]).toBeCloseTo(y, 5);
    expect(m[14]).toBeCloseTo(z, 5);
    const m0 = after[offsets[0]].matrices;
    expect(m0[12], 'the others have not moved').toBeCloseTo(t.x[0], 5);
    // on the shelf it is a good deal smaller than on the bed, where it is drawn larger than life to be seen through the water
    expect(Math.hypot(m[0], m[1])).toBeCloseTo(TREASURES.shelfScale, 5);
    expect(Math.hypot(m0[0], m0[1])).toBeCloseTo(TREASURES.bedScale, 5);
  });
});

describe('a logbook page', () => {
  const first = TREASURES.list.findIndex((t) => t.page !== undefined);

  it('is a thin sheet with ruled lines on it, the pale of paper and the dark of ink', () => {
    const parts = treasureParts(first, HOME);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0].colour).toBe(PALETTE.page);
    expect(parts[parts.length - 1].colour).toBe(PALETTE.pageInk);
    expect(TREASURES.list[first].size.high, 'thin').toBeLessThan(0.2);
  });

  it('is drawn at no size, and not on a shelf, once it is found', () => {
    const t = treasures();
    const draw = new TreasureDraw(HOME);
    const offsets: number[] = [];
    let n = 0;
    for (let i = 0; i < TREASURES.count; i++) {
      offsets.push(n);
      n += treasureParts(i, HOME).length;
    }
    t.find(first);
    const g = draw.groups(t);
    for (let k = 0; k < treasureParts(first, HOME).length; k++)
      expect(Math.hypot(g[offsets[first] + k].matrices[0], g[offsets[first] + k].matrices[1])).toBe(0);
  });

  it('has no place on a shelf, and says so', () => {
    expect(() => shelfSpot(first, HOME)).toThrow(/no shelf/);
  });
});

describe('where a treasure stands on the shelf', () => {
  it('is in the room, on the lake wall, standing on the shelf’s top and at its own place along it', () => {
    // the room's lake wall, `across` from the middle
    const wall = CABIN.body.across / 2 - CABIN_ROOM.inset;
    const [ix, iy] = CABIN_AT.inward;
    const [ax, ay] = CABIN_AT.along;
    TREASURES.list.forEach((t, i) => {
      if (!t.shelf) return;
      const [x, y, z] = shelfSpot(i, HOME);
      const dx = x - CABIN_AT.x,
        dy = y - CABIN_AT.y;
      const along = dx * ax + dy * ay;
      const across = dx * ix + dy * iy;
      expect(along, `${t.id} along`).toBeCloseTo(t.shelf.along, 4);
      const sh = t.shelf.on === 'lower' ? CABIN_ROOM.furniture.shelf : CABIN_ROOM.furniture.shelfUpper;
      expect(z - CABIN_FLOOR, `${t.id} height`).toBeCloseTo(sh.high + sh.thick, 4);
      expect(across, `${t.id} over the shelf's depth`).toBeLessThan(wall);
      expect(across).toBeGreaterThan(wall - sh.deep);
    });
  });
});
