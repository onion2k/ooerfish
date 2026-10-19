/** The treasures as they are drawn: each model built once from primitives, painted, small, and on the bed or the shelf. */
import { describe, expect, it } from 'vitest';
import { BedFinds, places } from '../src/bedfinds';
import { TreasureDraw, bedSpot, shelfSpot, treasureParts } from '../src/treasuredraw';
import { ANGLER, CABIN, CABIN_AT, CABIN_FLOOR, CABIN_ROOM, DRUMS, TREASURES, bedDepth, inside } from '../src/lake';

const world = { inside, bedDepth, from: [ANGLER.x, ANGLER.y] as const };
const treasures = () => new BedFinds(places(TREASURES, world, places(DRUMS, world)));
const triangles = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;
const zs = (m: { positions: ArrayLike<number> }) =>
  Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + 2]);

describe('each treasure’s model', () => {
  it('is built the same each time, from parts that are painted or plain as they are made', () => {
    TREASURES.list.forEach((t, i) => {
      const a = treasureParts(i),
        b = treasureParts(i);
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
        treasureParts(i).some((p) => p.mesh.paint instanceof Float32Array),
        TREASURES.list[i].id,
      ).toBe(true);
  });

  it('is under sixty triangles all together, and the six under a ceiling of their own', () => {
    let all = 0;
    for (let i = 0; i < TREASURES.count; i++) {
      const n = treasureParts(i).reduce((sum, p) => sum + triangles(p.mesh), 0);
      expect(n, TREASURES.list[i].id).toBeGreaterThan(8);
      expect(n, TREASURES.list[i].id).toBeLessThan(60);
      all += n;
    }
    expect(all).toBeLessThan(260);
  });

  it('stands on the ground it is placed at and is the size the content says', () => {
    TREASURES.list.forEach((t, i) => {
      const parts = treasureParts(i);
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
    const draw = new TreasureDraw();
    const none = draw.groups(t);
    const parts = Array.from({ length: TREASURES.count }, (_, i) => treasureParts(i).length).reduce((a, b) => a + b);
    expect(none).toHaveLength(parts);
    for (const g of none) {
      expect(live(g)).toBe(1);
      expect(g.matrices.length).toBe(16);
    }
    t.load([0, 1, 2, 3, 4, 5]);
    const all = draw.groups(t);
    expect(all).toHaveLength(parts);
    all.forEach((g, i) => expect(g.mesh, 'the meshes are made once').toBe(none[i].mesh));
    all.forEach((g, i) => expect(g.matrices, 'the pools are sized once').toBe(none[i].matrices));
  });

  it('lays an unfound treasure on the bed where it lies, a little sunk, and a found one on its shelf', () => {
    const t = treasures();
    const draw = new TreasureDraw();
    const offsets: number[] = [];
    let n = 0;
    for (let i = 0; i < TREASURES.count; i++) {
      offsets.push(n);
      n += treasureParts(i).length;
    }
    const before = draw.groups(t);
    TREASURES.list.forEach((_, i) => {
      const m = before[offsets[i]].matrices;
      expect(m[12], `treasure ${i} x`).toBeCloseTo(t.x[i], 5);
      expect(m[13]).toBeCloseTo(t.y[i], 5);
      expect(m[14], 'on the bed under it').toBeLessThanOrEqual(-bedDepth(t.x[i], t.y[i]) + 0.1);
      expect(m[14]).toBeGreaterThan(-bedDepth(t.x[i], t.y[i]) - 0.5);
      expect(Array.from(bedSpot(t, i)).slice(0, 2)).toEqual([t.x[i], t.y[i]]);
    });
    t.find(4);
    const after = draw.groups(t);
    const m = after[offsets[4]].matrices;
    const [x, y, z] = shelfSpot(4);
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

describe('where a treasure stands on the shelf', () => {
  it('is in the room, on the lake wall, standing on the shelf’s top and at its own place along it', () => {
    // the room's lake wall, `across` from the middle
    const wall = CABIN.body.across / 2 - CABIN_ROOM.inset;
    const [ix, iy] = CABIN_AT.inward;
    const [ax, ay] = CABIN_AT.along;
    TREASURES.list.forEach((t, i) => {
      const [x, y, z] = shelfSpot(i);
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
