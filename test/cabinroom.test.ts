/** The cabin's room as drawn: built the same each time, painted, inside the cabin's outer walls, and its walls facing in. */
import { describe, expect, it } from 'vitest';
import { PAINT_STRIDE } from 'artshape-render/mesh/paint';
import { FURNITURE, ROOM_PARTS, lampAt, roomGroups } from '../src/cabinroom';
import { CABIN, CABIN_AT, CABIN_FLOOR, CABIN_ROOM, TREASURES, WAKING_EYE, bareGround } from '../src/lake';
import { ROOM_COLOURS } from '../src/palette';
import { SHADOW_BOX } from '../src/scene';

type Group = ReturnType<typeof roomGroups>[number];
const part = (groups: Group[], name: (typeof ROOM_PARTS)[number]) => groups[ROOM_PARTS.indexOf(name)];

/** A world point in the cabin's own frame: along the shore, in toward the lake, and up. */
const inCabin = (x: number, y: number, z: number): [number, number, number] => {
  const dx = x - CABIN_AT.x,
    dy = y - CABIN_AT.y;
  return [dx * CABIN_AT.along[0] + dy * CABIN_AT.along[1], dx * CABIN_AT.inward[0] + dy * CABIN_AT.inward[1], z];
};
function corners(g: Group): [number, number, number][] {
  const p = g.mesh.positions;
  return Array.from({ length: p.length / 3 }, (_, i) => inCabin(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
}

describe('the cabin’s room as drawn', () => {
  const groups = roomGroups(ROOM_COLOURS);
  const halfAlong = CABIN.body.along / 2,
    halfAcross = CABIN.body.across / 2;

  it('is a group a part, each in the colour it is handed, placed by the identity', () => {
    expect(groups.length).toBe(ROOM_PARTS.length);
    expect(new Set(groups.map((g) => g.albedo)).size).toBe(groups.length);
    for (const g of groups) {
      expect(Array.from(g.matrices)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      expect(g.mesh.indices.length / 3).toBeGreaterThan(0);
    }
    expect(part(groups, 'floor').albedo).toBe(ROOM_COLOURS.floor);
    expect(part(groups, 'door').albedo).toBe(ROOM_COLOURS.door);
  });

  it('has a floor, walls and ceiling, a bed, a window, a door and a lamp', () => {
    for (const name of ['floor', 'walls', 'ceiling', 'bed', 'bedding', 'window', 'glass', 'door', 'shade', 'bulb'])
      expect(ROOM_PARTS, name).toContain(name);
  });

  it('is built the same each time', () => {
    const again = roomGroups(ROOM_COLOURS);
    for (const [i, g] of groups.entries()) {
      expect(Array.from(again[i].mesh.positions), ROOM_PARTS[i]).toEqual(Array.from(g.mesh.positions));
      expect(Array.from(again[i].mesh.indices)).toEqual(Array.from(g.mesh.indices));
    }
  });

  it('carries the painted edge on its timber and not on its glass or its bulb', () => {
    for (const name of ROOM_PARTS) {
      const g = part(groups, name);
      if (name === 'glass' || name === 'bulb') expect(g.mesh.paint, name).toBeUndefined();
      else expect(g.mesh.paint?.length, name).toBe((g.mesh.positions.length / 3) * PAINT_STRIDE);
    }
  });

  it('stands wholly inside the cabin’s outer walls, so it is not seen from outside', () => {
    for (const name of ROOM_PARTS)
      for (const [u, v, z] of corners(part(groups, name))) {
        expect(Math.abs(u), `${name} along`).toBeLessThanOrEqual(halfAlong - CABIN_ROOM.inset + 1e-4);
        expect(Math.abs(v), `${name} across`).toBeLessThanOrEqual(halfAcross - CABIN_ROOM.inset + 1e-4);
        expect(z, `${name} high`).toBeGreaterThanOrEqual(CABIN_FLOOR - CABIN_ROOM.slab - 1e-4);
        expect(z, `${name} high`).toBeLessThanOrEqual(CABIN_FLOOR + CABIN_ROOM.high + 1e-4);
      }
  });

  it('keeps the ground out of the room: the floor is over the highest ground under the cabin', () => {
    for (const u of [-halfAlong, 0, halfAlong])
      for (const v of [-halfAcross, 0, halfAcross]) {
        const x = CABIN_AT.x + CABIN_AT.inward[0] * v + CABIN_AT.along[0] * u,
          y = CABIN_AT.y + CABIN_AT.inward[1] * v + CABIN_AT.along[1] * u;
        expect(bareGround(x, y)).toBeLessThan(CABIN_FLOOR);
      }
  });

  it('keeps the whole room under the roof and inside the sun’s shadow box', () => {
    expect(CABIN_FLOOR + CABIN_ROOM.high).toBeLessThan(bareGround(CABIN_AT.x, CABIN_AT.y) + CABIN.body.high);
    for (const g of groups) {
      const p = g.mesh.positions;
      for (let i = 0; i < p.length; i += 3) {
        expect(Math.abs(p[i])).toBeLessThanOrEqual(SHADOW_BOX.max[0]);
        expect(p[i + 2]).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      }
    }
  });

  it('faces its walls and ceiling in, by the way they are wound and by their normals', () => {
    // worked out in the world's own frame, where the winding means what the renderer takes it to mean
    const middle = [CABIN_AT.x, CABIN_AT.y, CABIN_FLOOR + CABIN_ROOM.high / 2];
    const dot = (x: number[], y: number[]) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    for (const name of ['walls', 'ceiling'] as const) {
      const g = part(groups, name);
      const p = g.mesh.positions,
        n = g.mesh.normals,
        idx = g.mesh.indices;
      const at = (i: number) => [p[idx[i] * 3], p[idx[i] * 3 + 1], p[idx[i] * 3 + 2]];
      for (let t = 0; t < idx.length; t += 3) {
        const a = [at(t), at(t + 1), at(t + 2)];
        const e1 = a[1].map((c, k) => c - a[0][k]),
          e2 = a[2].map((c, k) => c - a[0][k]);
        const wound = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const centre = [0, 1, 2].map((k) => (a[0][k] + a[1][k] + a[2][k]) / 3);
        const toMiddle = middle.map((c, k) => c - centre[k]);
        expect(dot(wound, toMiddle), `${name} triangle ${t / 3} wound`).toBeGreaterThan(0);
        const stored = [n[idx[t] * 3], n[idx[t] * 3 + 1], n[idx[t] * 3 + 2]];
        expect(dot(stored, toMiddle), `${name} triangle ${t / 3} normal`).toBeGreaterThan(0);
      }
    }
  });

  it('hangs its lamp inside the room, under the ceiling, over the floor', () => {
    const [x, y, z] = lampAt();
    const [u, v] = inCabin(x, y, z);
    expect(Math.abs(u)).toBeLessThan(halfAlong - CABIN_ROOM.inset);
    expect(Math.abs(v)).toBeLessThan(halfAcross - CABIN_ROOM.inset);
    expect(z).toBeGreaterThan(CABIN_FLOOR + 1.8);
    expect(z).toBeLessThan(CABIN_FLOOR + CABIN_ROOM.high);
  });
});

describe('the cabin’s furniture', () => {
  const groups = roomGroups(ROOM_COLOURS);
  const hx = CABIN.body.across / 2 - CABIN_ROOM.inset,
    hy = CABIN.body.along / 2 - CABIN_ROOM.inset;
  const pieces = Object.keys(FURNITURE) as (keyof typeof FURNITURE)[];
  /** Every corner of a piece's parts, in the room's frame as (along, across, height over the floor). */
  const points = (piece: keyof typeof FURNITURE) =>
    FURNITURE[piece]
      .flatMap((name) => corners(part(groups, name)))
      .map(([u, v, z]) => [u, v, z - CABIN_FLOOR] as const);

  it('has the seven pieces, each of parts that are in the room and in a colour of their own', () => {
    expect(pieces.sort()).toEqual(['chest', 'coat', 'picture', 'rug', 'shelf', 'stove', 'table']);
    const names = pieces.flatMap((p) => [...FURNITURE[p]]);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(ROOM_PARTS, name).toContain(name);
      expect(part(groups, name).mesh.indices.length, name).toBeGreaterThan(0);
      expect(part(groups, name).albedo).toBe(ROOM_COLOURS[name]);
    }
    expect(FURNITURE.table).toEqual(expect.arrayContaining(['table', 'chair', 'mug']));
    expect(FURNITURE.shelf).toEqual(expect.arrayContaining(['shelf', 'books', 'jar']));
  });

  it('keeps every vertex inside the cabin’s outer walls, and under its ceiling', () => {
    for (const piece of pieces)
      for (const [u, v, z] of points(piece)) {
        expect(Math.abs(u), `${piece} along`).toBeLessThanOrEqual(hy + 1e-4);
        expect(Math.abs(v), `${piece} across`).toBeLessThanOrEqual(hx + 1e-4);
        expect(z, `${piece} low`).toBeGreaterThanOrEqual(-1e-4);
        expect(z, `${piece} high`).toBeLessThanOrEqual(CABIN_ROOM.high + 1e-4);
      }
  });

  it('stands each piece on the floor or hangs it on a wall, so nothing floats', () => {
    for (const piece of pieces) {
      const p = points(piece);
      const standing = Math.min(...p.map(([, , z]) => z)) <= 0.01;
      const hung = p.some(([u, v]) => hy - Math.abs(u) <= 0.05 || hx - Math.abs(v) <= 0.05);
      expect(standing || hung, piece).toBe(true);
    }
    // the ones meant to hang do so, and the ones meant to stand do
    for (const piece of ['shelf', 'picture', 'coat'] as const) {
      expect(
        points(piece).some(([u, v]) => hy - Math.abs(u) <= 0.05 || hx - Math.abs(v) <= 0.05),
        piece,
      ).toBe(true);
    }
    for (const piece of ['table', 'stove', 'rug', 'chest'] as const)
      expect(Math.min(...points(piece).map(([, , z]) => z)), piece).toBeLessThanOrEqual(0.01);
  });

  it('keeps clear of the camera’s eye in the cabin view by at least 1.2', () => {
    const { along, across, high } = WAKING_EYE;
    for (const piece of pieces)
      for (const [u, v, z] of points(piece))
        expect(Math.hypot(u - along, v - across, z - high), piece).toBeGreaterThanOrEqual(1.2);
  });

  it('keeps out of the door’s way and the window’s opening on the lake wall', () => {
    const { door, window: win } = CABIN_ROOM;
    for (const piece of pieces)
      for (const [u, v, z] of points(piece)) {
        // a step of the door's plan, a metre deep: nothing stands in it higher than a rug lies
        if (hx - v < 1 && Math.abs(u - door.along) < door.width / 2 + door.frame)
          expect(z, `${piece} in the doorway`).toBeLessThanOrEqual(0.05);
        // the window's opening and its frame stand 0.14 proud of the wall: nothing is hung or stood across them, and the
        // table below them, the mug standing further in on it, is clear
        if (hx - v < 0.2 && Math.abs(u - win.along) < win.width / 2 + win.frame)
          expect(z, `${piece} across the window`).toBeLessThan(win.sill - win.frame);
      }
  });

  it('is under fifteen hundred triangles all together, and built the same each time', () => {
    const names = pieces.flatMap((p) => [...FURNITURE[p]]);
    const tris = names.reduce((n, name) => n + part(groups, name).mesh.indices.length / 3, 0);
    expect(tris).toBeLessThan(1500);
    const again = roomGroups(ROOM_COLOURS);
    for (const name of names) {
      expect(Array.from(part(again, name).mesh.positions), name).toEqual(Array.from(part(groups, name).mesh.positions));
      expect(Array.from(part(again, name).mesh.indices), name).toEqual(Array.from(part(groups, name).mesh.indices));
    }
  });

  it('runs the stovepipe up into the chimney’s footprint, and hangs the coat’s hem clear of the floor', () => {
    const c = CABIN.chimney;
    const pipe = points('stove').filter(([, , z]) => z >= CABIN_ROOM.high - 0.05);
    expect(pipe.length).toBeGreaterThan(0);
    for (const [u, v] of pipe) {
      expect(Math.abs(v), 'pipe across').toBeLessThanOrEqual(c.size / 2);
      expect(Math.abs(u - c.along), 'pipe along').toBeLessThanOrEqual(c.size / 2);
    }
    const hem = Math.min(...corners(part(groups, 'coat')).map(([, , z]) => z - CABIN_FLOOR));
    expect(hem).toBeGreaterThan(0.3);
    // the coat hangs by the peg, which is on the wall
    const wide = (name: 'coat') => corners(part(groups, name)).map(([u]) => u);
    expect(Math.max(...wide('coat')) - Math.min(...wide('coat'))).toBeGreaterThan(0.5);
  });
});

describe('the cabin’s two shelves', () => {
  const groups = roomGroups(ROOM_COLOURS);
  const fur = CABIN_ROOM.furniture;
  const hx = CABIN.body.across / 2 - CABIN_ROOM.inset,
    hy = CABIN.body.along / 2 - CABIN_ROOM.inset;
  const shelves = { lower: fur.shelf, upper: fur.shelfUpper };
  /** The shelf mesh's planks: its vertices as (along, across, height over the floor), per height of top. */
  const shelfPoints = corners(part(groups, 'shelf')).map(([u, v, z]) => [u, v, z - CABIN_FLOOR] as const);

  it('puts the second above the first on the lake wall, with room for what stands on the lower one', () => {
    expect(fur.shelfUpper.high).toBeGreaterThan(fur.shelf.high + fur.shelf.thick);
    const tallest = Math.max(...TREASURES.list.map((t) => t.size.high * TREASURES.shelfScale));
    expect(fur.shelfUpper.high - (fur.shelf.high + fur.shelf.thick), 'a treasure stands under it').toBeGreaterThan(
      tallest + 0.1,
    );
    expect(fur.shelfUpper.along).toBe(fur.shelf.along);
    expect(fur.shelfUpper.wide).toBeLessThanOrEqual(fur.shelf.wide);
  });

  it('draws both, each a plank flush to the lake wall inside the room and under the ceiling', () => {
    for (const [name, sh] of Object.entries(shelves)) {
      const plank = shelfPoints.filter(([, , z]) => Math.abs(z - (sh.high + sh.thick)) < 1e-4);
      expect(plank.length, `${name} shelf is drawn`).toBeGreaterThan(0);
      const along = plank.map(([u]) => u);
      expect(Math.min(...along), name).toBeCloseTo(sh.along - sh.wide / 2, 4);
      expect(Math.max(...along), name).toBeCloseTo(sh.along + sh.wide / 2, 4);
      for (const [u, v, z] of plank) {
        expect(Math.abs(u)).toBeLessThanOrEqual(hy + 1e-4);
        expect(v, 'flush to the wall').toBeLessThanOrEqual(hx + 1e-4);
        expect(z).toBeLessThan(CABIN_ROOM.high);
      }
    }
  });

  it('keeps both clear of the door’s frame and the coat on their own side of it', () => {
    const { door, furniture } = CABIN_ROOM;
    for (const sh of [fur.shelf, fur.shelfUpper]) {
      const [a, b] = [sh.along - sh.wide / 2, sh.along + sh.wide / 2];
      expect(b, 'short of the door’s frame').toBeLessThan(door.along - door.width / 2 - door.frame);
      expect(b, 'short of the coat').toBeLessThan(furniture.coat.along - furniture.coat.wide / 2);
      expect(a).toBeGreaterThan(-hy);
    }
  });

  it('gives each treasure a place on a shelf: on its top, inside its length, clear of the books and the jar and of each other', () => {
    const books = fur.books.reduce((n, [thick]) => n + thick, 0);
    const bookFrom = fur.shelf.along + fur.shelf.wide / 2 - 0.08 - books;
    const bookTo = fur.shelf.along + fur.shelf.wide / 2 - 0.08;
    const jarFrom = fur.shelf.along - fur.shelf.wide / 2 + 0.25 - fur.jar.radius;
    const jarTo = fur.shelf.along - fur.shelf.wide / 2 + 0.25 + fur.jar.radius;
    for (const t of TREASURES.list) {
      const sh = shelves[t.shelf.on];
      const r = t.size.radius * TREASURES.shelfScale;
      expect(t.shelf.along - r, `${t.id} inside the shelf's start`).toBeGreaterThanOrEqual(
        sh.along - sh.wide / 2 + 0.06,
      );
      expect(t.shelf.along + r, `${t.id} inside the shelf's end`).toBeLessThanOrEqual(sh.along + sh.wide / 2 - 0.06);
      expect(t.size.high * TREASURES.shelfScale, `${t.id} under the next shelf`).toBeLessThan(0.45);
      if (t.shelf.on === 'lower') {
        const clear = (a: number, b: number) => t.shelf.along + r <= a || t.shelf.along - r >= b;
        expect(clear(bookFrom, bookTo), `${t.id} clear of the books`).toBe(true);
        expect(clear(jarFrom, jarTo), `${t.id} clear of the jar`).toBe(true);
      }
    }
    for (const a of TREASURES.list)
      for (const b of TREASURES.list) {
        if (a === b || a.shelf.on !== b.shelf.on) continue;
        expect(Math.abs(a.shelf.along - b.shelf.along), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(
          (a.size.radius + b.size.radius) * TREASURES.shelfScale,
        );
      }
  });

  it('holds all six, split between the shelves, and the room still under its triangle ceiling', () => {
    expect(TREASURES.list.filter((t) => t.shelf.on === 'lower').length).toBeGreaterThan(0);
    expect(TREASURES.list.filter((t) => t.shelf.on === 'upper').length).toBeGreaterThan(0);
    const names = Object.values(FURNITURE).flatMap((p) => [...p]);
    const tris = names.reduce((n, name) => n + part(groups, name).mesh.indices.length / 3, 0);
    expect(tris).toBeLessThan(1500);
  });
});
