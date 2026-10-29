/** The cabin's room as drawn: built the same each time, painted, inside the cabin's outer walls, and its walls facing in. */
import { describe, expect, it } from 'vitest';
import { PAINT_STRIDE } from 'artshape-render/mesh/paint';
import {
  BAND_PARTS,
  FURNITURE,
  MARK_PARTS,
  ROOM_PARTS,
  calendarGeometry,
  lampAt,
  mapGeometry,
  roomGroups,
} from '../src/cabinroom';
import { CalendarDraw } from '../src/calendardraw';
import { HOME, LAKES } from '../src/lakes';
import { TREASURE_RULES } from '../src/rules';
import { CALENDAR, MOON, SEASONS } from '../src/lake';
import { moonOf } from '../src/calendar';
import { ROOM_COLOURS } from '../src/palette';

const SHADOW_BOX = HOME.shadowBox;

const CABIN = HOME.cabin!.spec;
const CABIN_AT = HOME.cabin!.at;
const CABIN_FLOOR = HOME.cabin!.floor;
const CABIN_ROOM = HOME.cabin!.room;
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };
const WAKING_EYE = HOME.cabin!.wakingEye;
const bareGround = HOME.bareGround;

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
  const groups = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
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
    const again = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
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
    const [x, y, z] = lampAt(HOME);
    const [u, v] = inCabin(x, y, z);
    expect(Math.abs(u)).toBeLessThan(halfAlong - CABIN_ROOM.inset);
    expect(Math.abs(v)).toBeLessThan(halfAcross - CABIN_ROOM.inset);
    expect(z).toBeGreaterThan(CABIN_FLOOR + 1.8);
    expect(z).toBeLessThan(CABIN_FLOOR + CABIN_ROOM.high);
  });
});

describe('the cabin’s furniture', () => {
  const groups = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
  const hx = CABIN.body.across / 2 - CABIN_ROOM.inset,
    hy = CABIN.body.along / 2 - CABIN_ROOM.inset;
  const pieces = Object.keys(FURNITURE) as (keyof typeof FURNITURE)[];
  /** Every corner of a piece's parts, in the room's frame as (along, across, height over the floor). */
  const points = (piece: keyof typeof FURNITURE) =>
    FURNITURE[piece]
      .flatMap((name) => corners(part(groups, name)))
      .map(([u, v, z]) => [u, v, z - CABIN_FLOOR] as const);

  it('has the eight pieces, each of parts that are in the room and in a colour of their own', () => {
    expect(pieces.sort()).toEqual(['calendar', 'chest', 'coat', 'picture', 'rug', 'shelf', 'stove', 'table']);
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
    for (const piece of ['shelf', 'picture', 'coat', 'calendar'] as const) {
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
        // table below them, the mug standing further in on it, is clear. Above the frame the wall is free to hang
        // on, since the light comes through the opening and not the wall over it.
        if (hx - v < 0.2 && Math.abs(u - win.along) < win.width / 2 + win.frame && z > win.sill - win.frame)
          expect(z, `${piece} across the window`).toBeGreaterThanOrEqual(win.sill + win.high + win.frame - 1e-4);
      }
  });

  it('is under fifteen hundred triangles all together, and built the same each time', () => {
    const names = pieces.flatMap((p) => [...FURNITURE[p]]);
    const tris = names.reduce((n, name) => n + part(groups, name).mesh.indices.length / 3, 0);
    expect(tris).toBeLessThan(1500);
    const again = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
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
  const groups = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
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

  // a logbook page goes in the book, not on a shelf
  const shelved = TREASURES.list.filter(
    (t): t is typeof t & { shelf: NonNullable<typeof t.shelf> } => t.shelf !== null,
  );

  it('gives each treasure a place on a shelf: on its top, inside its length, clear of the books and the jar and of each other', () => {
    const books = fur.books.reduce((n, [thick]) => n + thick, 0);
    const bookFrom = fur.shelf.along + fur.shelf.wide / 2 - 0.08 - books;
    const bookTo = fur.shelf.along + fur.shelf.wide / 2 - 0.08;
    const jarFrom = fur.shelf.along - fur.shelf.wide / 2 + 0.25 - fur.jar.radius;
    const jarTo = fur.shelf.along - fur.shelf.wide / 2 + 0.25 + fur.jar.radius;
    for (const t of shelved) {
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
    for (const a of shelved)
      for (const b of shelved) {
        if (a === b || a.shelf.on !== b.shelf.on) continue;
        expect(Math.abs(a.shelf.along - b.shelf.along), `${a.id} and ${b.id}`).toBeGreaterThanOrEqual(
          (a.size.radius + b.size.radius) * TREASURES.shelfScale,
        );
      }
  });

  it('holds all the shelved, split between the shelves, and the room still under its triangle ceiling', () => {
    expect(shelved.filter((t) => t.shelf.on === 'lower').length).toBeGreaterThan(0);
    expect(shelved.filter((t) => t.shelf.on === 'upper').length).toBeGreaterThan(0);
    const names = Object.values(FURNITURE).flatMap((p) => [...p]);
    const tris = names.reduce((n, name) => n + part(groups, name).mesh.indices.length / 3, 0);
    expect(tris).toBeLessThan(1500);
  });
});

describe('the cabin’s wall calendar', () => {
  const groups = roomGroups(ROOM_COLOURS, HOME, Object.values(LAKES));
  const g = calendarGeometry(HOME);
  // the calendar hangs on the end wall, the stove's, so what is proud of it is measured along the shore, and its width runs across the room
  const hy = CABIN.body.along / 2 - CABIN_ROOM.inset;
  const draw = new CalendarDraw(HOME);
  const colours = { gone: ROOM_COLOURS.calendarGone, today: ROOM_COLOURS.calendarToday };
  /** The scale of slot `i` of a matrices array: nought for a square not shown. */
  const shownSlots = (m: Float32Array) =>
    Array.from({ length: m.length / 16 }, (_, i) => m[i * 16] !== 0 || m[i * 16 + 1] !== 0);
  const snapshot = (day: number) => draw.groups(day, colours).map((x) => Array.from(x.matrices));

  it('is a sheet and a timber bar, each painted with the wood’s edge and in a colour of its own', () => {
    for (const name of ['calendarSheet', 'calendarBar'] as const) {
      expect(part(groups, name).albedo).toBe(ROOM_COLOURS[name]);
      expect(part(groups, name).mesh.paint, name).toBeDefined();
    }
    const colourSet = new Set([...groups.map((x) => x.albedo), ROOM_COLOURS.calendarGone, ROOM_COLOURS.calendarToday]);
    expect(colourSet.size).toBe(groups.length + 2);
  });

  it('has a band a season, in the year’s order, each in a colour of its own and listed with the calendar', () => {
    expect(BAND_PARTS).toEqual(SEASONS.map((s) => `band${s[0].toUpperCase()}${s.slice(1)}`));
    for (const name of BAND_PARTS) {
      expect(FURNITURE.calendar, name).toContain(name);
      expect(part(groups, name).albedo).toBe(ROOM_COLOURS[name]);
      expect(part(groups, name).mesh.paint, name).toBeDefined();
    }
    expect(new Set(BAND_PARTS.map((n) => ROOM_COLOURS[n].join())).size).toBe(SEASONS.length);
  });

  it('lays each band at the sheet’s left edge, within it, proud of the paper, at the height of its row', () => {
    const left = (c: [number, number, number][]) => c.map(([, v]) => v);
    const sheet = corners(part(groups, 'calendarSheet'));
    const [sMin, sMax] = [Math.min(...left(sheet)), Math.max(...left(sheet))];
    const first = g.spot(0)[2] - CABIN_FLOOR;
    const rowsTop: number[] = [];
    for (const [r, name] of BAND_PARTS.entries()) {
      const c = corners(part(groups, name));
      const us = left(c),
        hs = c.map(([, , h]) => h - CABIN_FLOOR),
        vs = c.map(([u]) => u);
      // the reader's left is the lesser across-room coordinate when the row reads that way, the greater when it does not
      const edge = g.reads > 0 ? sMin : sMax;
      expect(Math.min(...us.map((u) => Math.abs(u - edge))), name).toBeLessThan(g.cal.margin);
      expect(Math.min(...us), name).toBeGreaterThanOrEqual(sMin - 1e-4);
      expect(Math.max(...us), name).toBeLessThanOrEqual(sMax + 1e-4);
      // clear of the squares, which start a margin in
      const squareEdge = g.cal.across + g.reads * (-g.cal.wide / 2 + g.cal.margin);
      for (const u of us) expect((u - squareEdge) * g.reads, name).toBeLessThanOrEqual(1e-4);
      // proud of the paper, but not past the marks
      expect(Math.min(...vs), name).toBeLessThan(hy - g.cal.depth);
      expect(Math.min(...vs), name).toBeGreaterThanOrEqual(hy - g.cal.depth - g.cal.proud - 1e-4);
      const top = first + g.cell / 2 - r * g.cell;
      expect(Math.max(...hs), name).toBeLessThanOrEqual(top + 1e-4);
      expect(Math.min(...hs), name).toBeGreaterThanOrEqual(top - g.cell - 1e-4);
      rowsTop.push((Math.max(...hs) + Math.min(...hs)) / 2);
    }
    // top row first: summer, then each below
    expect(rowsTop).toEqual([...rowsTop].sort((a, b) => b - a));
  });

  describe('the moons', () => {
    /** The square (row by row) a world point on the sheet lies in, or -1: read from the cell's measures, not `spot`. */
    const squareOf = (c: [number, number, number]) => {
      const col = Math.floor(((c[1] - g.cal.across) * g.reads + g.cal.wide / 2 - g.cal.margin) / g.cell);
      const top = g.cal.at + g.high - g.cal.bar - g.cal.margin;
      const row = Math.floor((top - (c[2] - CABIN_FLOOR)) / g.cell);
      return col < 0 || col >= CALENDAR.columns || row < 0 || row >= CALENDAR.rows ? -1 : row * CALENDAR.columns + col;
    };
    /** A part's dots as separate sets of corners: its vertices sorted into the squares they lie in. */
    const dots = (name: 'moonFull' | 'moonNew') => {
      const bySquare = new Map<number, [number, number, number][]>();
      for (const c of corners(part(groups, name))) {
        const i = squareOf(c);
        bySquare.set(i, [...(bySquare.get(i) ?? []), c]);
      }
      return [...bySquare.values()];
    };
    const centre = (d: [number, number, number][]) =>
      [0, 1, 2].map((k) => (Math.min(...d.map((p) => p[k])) + Math.max(...d.map((p) => p[k]))) / 2);
    const want = (phase: number) =>
      Array.from({ length: CALENDAR.days }, (_, i) => i).filter((i) => moonOf(i + 1) === phase);

    it('has a dot for each full and each new moon, seven of each, on exactly the squares moonOf says', () => {
      for (const [name, phase] of [
        ['moonFull', MOON.full],
        ['moonNew', MOON.new],
      ] as const) {
        const squares = dots(name).map((d) => squareOf(centre(d) as [number, number, number]));
        expect(squares.length, name).toBe(7);
        expect(
          squares.sort((a, b) => a - b),
          name,
        ).toEqual(want(phase));
        expect(FURNITURE.calendar, name).toContain(name);
      }
      expect(want(MOON.full)).toEqual([0, 8, 16, 24, 32, 40, 48]);
      expect(want(MOON.new)).toEqual([4, 12, 20, 28, 36, 44, 52]);
    });

    it('lays each dot in a corner of its square, clear of the mark’s centre, two fifths of a cell across', () => {
      for (const name of ['moonFull', 'moonNew'] as const)
        for (const d of dots(name)) {
          const [u, v, h] = centre(d);
          const i = squareOf([u, v, h]);
          const [sx, sy, sz] = g.spot(i);
          const [su, sv, sh] = inCabin(sx, sy, sz);
          const across = Math.max(...d.map((p) => p[1])) - Math.min(...d.map((p) => p[1]));
          expect(across, name).toBeCloseTo(g.cell * 0.4, 4);
          // wholly inside the cell
          for (const p of d) {
            expect(Math.abs(p[1] - sv), name).toBeLessThanOrEqual(g.cell / 2 + 1e-4);
            expect(Math.abs(p[2] - sh), name).toBeLessThanOrEqual(g.cell / 2 + 1e-4);
          }
          // the mark's centre is not under it
          expect(Math.hypot(v - sv, h - sh), name).toBeGreaterThan(g.cell / 3);
          // proud of the paper, behind the marks' plane
          const us = d.map((p) => p[0]);
          expect(Math.min(...us), name).toBeLessThan(hy - g.cal.depth);
          expect(Math.min(...us), name).toBeGreaterThanOrEqual(hy - g.cal.depth - g.cal.proud / 2 - 1e-4);
          expect(Math.min(...us), name).toBeGreaterThan(su);
        }
    });

    it('are two colours of their own, a pale one and a dark one, apart from every room colour', () => {
      const light = (c: readonly number[]) => c[0] + c[1] + c[2];
      expect(light(ROOM_COLOURS.moonFull)).toBeGreaterThan(light(ROOM_COLOURS.calendarSheet));
      expect(light(ROOM_COLOURS.moonNew)).toBeLessThan(0.6);
      for (const mine of ['moonFull', 'moonNew'] as const)
        for (const [other, c] of Object.entries(ROOM_COLOURS))
          if (other !== mine) expect(c.join(), `${mine} against ${other}`).not.toBe(ROOM_COLOURS[mine].join());
      expect(part(groups, 'moonFull').albedo).toBe(ROOM_COLOURS.moonFull);
      expect(part(groups, 'moonNew').albedo).toBe(ROOM_COLOURS.moonNew);
    });
  });

  it('keeps the marks off the static room, so they move with the day and not with the build', () => {
    expect(ROOM_PARTS).not.toContain('calendarGone');
    expect(ROOM_PARTS).not.toContain('calendarToday');
    expect(ROOM_PARTS).toContain('moonFull');
    expect(ROOM_PARTS).toContain('moonNew');
  });

  it('hangs on the end wall, not over the window: a metre and three tenths wide, over the bed’s headboard, short of the stovepipe, and its squares at least eight centimetres apart', () => {
    // the lake wall's widest free stretch, between the door's frame and the shelf, is about 1.2 across and had to be shared
    // with the coat: fourteen squares in it came to five pixels from the pillow, so the stove's wall it is
    const { stove } = CABIN_ROOM.furniture,
      { bed } = CABIN_ROOM;
    expect(g.wall).toBeCloseTo(hy, 6);
    expect(g.cal.wide).toBeGreaterThanOrEqual(1.3);
    expect(g.cal.at).toBeGreaterThanOrEqual(bed.headboard);
    expect(g.cal.across + g.cal.wide / 2, 'short of the pipe').toBeLessThan(stove.across - stove.pipe);
    expect(g.cal.across - g.cal.wide / 2, 'inside the room').toBeGreaterThan(
      -(CABIN.body.across / 2 - CABIN_ROOM.inset),
    );
    expect(g.cell).toBeGreaterThanOrEqual(0.08);
  });

  it('puts the sheet’s foot where it says and its top under the ceiling, a bar along the top', () => {
    const zs = corners(part(groups, 'calendarSheet')).map(([, , z]) => z - CABIN_FLOOR);
    expect(Math.min(...zs)).toBeCloseTo(g.cal.at, 4);
    const bar = corners(part(groups, 'calendarBar')).map(([, , z]) => z - CABIN_FLOOR);
    expect(Math.max(...bar)).toBeCloseTo(g.cal.at + g.high, 4);
    expect(Math.min(...bar)).toBeCloseTo(g.cal.at + g.high - g.cal.bar, 4);
  });

  it('is a few triangles: the sheet, bar and four bands six blocks’ worth and the fourteen moons a block each, the marks a quad each', () => {
    const tris = FURNITURE.calendar.reduce((n, name) => n + part(groups, name).mesh.indices.length / 3, 0);
    expect(tris).toBeLessThanOrEqual(6 * 12 + 14 * 12);
    const marks = draw.groups(1, colours);
    expect(marks[0].mesh.indices.length / 3).toBe(2);
    expect(marks[0].count).toBe(CALENDAR.days);
    expect(marks[1].count).toBe(1);
  });

  it('puts every square on the sheet, proud of the paper, within the sheet’s edges, in four rows of fourteen', () => {
    const rows = new Set<number>(),
      cols = new Set<number>();
    for (let i = 0; i < CALENDAR.days; i++) {
      const [x, y, z] = g.spot(i);
      const [u, v, h] = inCabin(x, y, z);
      expect(u, 'proud of the paper').toBeCloseTo(hy - g.cal.depth - g.cal.proud, 4);
      expect(Math.abs(v - g.cal.across) + g.size / 2).toBeLessThanOrEqual(g.cal.wide / 2 - g.cal.margin + 1e-4);
      expect(h - CABIN_FLOOR - g.size / 2).toBeGreaterThanOrEqual(g.cal.at);
      expect(h - CABIN_FLOOR + g.size / 2).toBeLessThanOrEqual(g.cal.at + g.high - g.cal.bar);
      rows.add(Math.round(h * 1000));
      cols.add(Math.round(v * 1000));
    }
    expect(rows.size).toBe(CALENDAR.rows);
    expect(cols.size).toBe(CALENDAR.columns);
  });

  it('reads left to right and top to bottom, so square 1 is to the right of square 0 as seen from the room', () => {
    const [x0, y0] = g.spot(0),
      [x1, y1] = g.spot(1);
    // facing the end wall, toward the shore's direction, the reader's right is (ay, -ax)
    const [ax, ay] = CABIN_AT.along;
    expect((x1 - x0) * ay + (y1 - y0) * -ax).toBeGreaterThan(0);
    expect(g.spot(CALENDAR.columns)[2]).toBeLessThan(g.spot(0)[2]);
  });

  it('shows no square gone and the first today on day one', () => {
    const [gone, today] = draw.groups(1, colours);
    expect(shownSlots(gone.matrices).filter(Boolean).length).toBe(0);
    expect(shownSlots(today.matrices)).toEqual([true]);
    expect(draw.shown()).toEqual({ gone: 0, today: 0 });
  });

  it('shows one gone and the second today on day two', () => {
    draw.groups(2, colours);
    expect(draw.shown()).toEqual({ gone: 1, today: 1 });
  });

  it('shows 55 gone and the last square today on day 56, and the same as day one on day 57', () => {
    draw.groups(56, colours);
    expect(draw.shown()).toEqual({ gone: 55, today: 55 });
    const one = snapshot(1);
    expect(snapshot(57)).toEqual(one);
    expect(snapshot(113)).toEqual(one);
  });

  it('gives the same matrices for the same day, and different ones for a different day', () => {
    expect(snapshot(5)).toEqual(snapshot(5));
    expect(snapshot(5)).not.toEqual(snapshot(6));
  });

  it('writes into matrices sized once: the same arrays on every call', () => {
    const a = draw.groups(3, colours),
      b = draw.groups(4, colours);
    expect(b[0].matrices).toBe(a[0].matrices);
    expect(b[1].matrices).toBe(a[1].matrices);
    expect(a[0].matrices.length).toBe(CALENDAR.days * 16);
  });

  it('keeps every square, shown or not, inside the room', () => {
    for (const day of [1, 30, 56]) {
      for (const grp of draw.groups(day, colours)) {
        const m = grp.matrices;
        for (let i = 0; i < (grp.count ?? 1); i++) {
          const [u, v, z] = inCabin(m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]);
          expect(Math.abs(v)).toBeLessThanOrEqual(CABIN.body.across / 2 - CABIN_ROOM.inset);
          expect(z - CABIN_FLOOR).toBeGreaterThan(0);
          expect(z - CABIN_FLOOR).toBeLessThan(CABIN_ROOM.high);
          expect(Math.abs(u)).toBeLessThan(CABIN.body.along / 2 - CABIN_ROOM.inset);
        }
      }
    }
  });

  it('faces the marks into the room, away from the end wall', () => {
    const m = draw.groups(1, colours)[1].matrices;
    // the mark’s own x, its normal, in the world is the matrix’s first column, scaled
    const [ax, ay] = CABIN_AT.along;
    expect(m[0] * ax + m[1] * ay).toBeLessThan(0);
  });
});

describe('the map on the lake wall', () => {
  const lakes = Object.values(LAKES);
  const groups = roomGroups(ROOM_COLOURS, HOME, lakes);
  const pic = CABIN_ROOM.furniture.picture;

  it('keeps the picture’s frame and canvas, and adds the lakes and the dam as parts of the picture', () => {
    expect(FURNITURE.picture).toEqual(['frame', 'canvas', 'mapWater', 'mapDam']);
    for (const name of ['mapWater', 'mapDam'] as const) {
      expect(ROOM_PARTS, name).toContain(name);
      expect(part(groups, name).mesh.indices.length, name).toBeGreaterThan(0);
      expect(part(groups, name).albedo).toBe(ROOM_COLOURS[name]);
    }
    expect(MARK_PARTS).toContain('mapPin');
  });

  it('gives the map’s three parts a colour apiece, apart from every other part of the room', () => {
    const mine = ['mapWater', 'mapDam', 'mapPin'] as const;
    const others = [...ROOM_PARTS, ...MARK_PARTS].filter((p) => !mine.includes(p as (typeof mine)[number]));
    const taken = new Set(others.map((p) => ROOM_COLOURS[p].join(',')));
    for (const name of mine) {
      expect(taken.has(ROOM_COLOURS[name].join(',')), name).toBe(false);
      taken.add(ROOM_COLOURS[name].join(','));
    }
    expect(taken.size).toBeGreaterThanOrEqual(others.length - 1 + mine.length);
  });

  it('lays the lakes side by side on the paper with a margin, the pond the smaller and at the left', () => {
    const map = mapGeometry(HOME, lakes);
    expect(map.blobs.map((b) => b.id)).toEqual(['duckpond', 'reservoir']);
    const [pond, reservoir] = map.blobs;
    expect(pond.right).toBeLessThan(reservoir.left);
    expect(pond.right - pond.left).toBeLessThan(reservoir.right - reservoir.left);
    for (const b of map.blobs) {
      expect(b.left, b.id).toBeGreaterThanOrEqual(-pic.wide / 2 + map.margin - 1e-9);
      expect(b.right, b.id).toBeLessThanOrEqual(pic.wide / 2 - map.margin + 1e-9);
      expect(b.bottom, b.id).toBeGreaterThanOrEqual(map.margin - 1e-9);
      expect(b.top, b.id).toBeLessThanOrEqual(pic.high - map.margin + 1e-9);
      expect(b.outline.length, b.id).toBe(32);
    }
  });

  it('draws one lake the same shape on the map as on the ground, scaled alike: the Reservoir is wider than the pond in the ratio of the shores', () => {
    const [pond, reservoir] = mapGeometry(HOME, lakes).blobs;
    const wide = (id: string) => {
      const l = LAKES[id];
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const x = Math.cos(a) * l.shoreRadius(a) * l.stretch;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      return hi - lo;
    };
    expect((reservoir.right - reservoir.left) / (pond.right - pond.left)).toBeCloseTo(
      wide('reservoir') / wide('duckpond'),
      6,
    );
  });

  it('puts the dam’s bar on the Reservoir’s north bank and on no other lake', () => {
    const map = mapGeometry(HOME, lakes);
    expect(map.dams.map((d) => d.id)).toEqual(['reservoir']);
    const [, reservoir] = map.blobs;
    const dam = map.dams[0];
    expect(dam.bottom).toBeGreaterThan(reservoir.top - (reservoir.top - reservoir.bottom) * 0.4);
    expect(dam.right - dam.left).toBeGreaterThan(0);
    expect(dam.left).toBeGreaterThanOrEqual(reservoir.left - 1e-9);
    expect(dam.right).toBeLessThanOrEqual(reservoir.right + 1e-9);
  });

  it('stands clear of the calendar below it, and lies on the paper, proud of it, inside the picture’s rectangle', () => {
    const { cal, high } = calendarGeometry(HOME);
    // the calendar hangs on the end wall, so it cannot overlap the picture on the lake wall; its top is under the ceiling
    expect(cal.at + high).toBeLessThan(CABIN_ROOM.high);
    const hx = CABIN.body.across / 2 - CABIN_ROOM.inset;
    for (const name of ['mapWater', 'mapDam'] as const)
      for (const [u, v, z] of corners(part(groups, name))) {
        // the canvas is 0.04 thick on the wall: the map is in front of it, by a hair and no more than a few millimetres
        expect(v, `${name} proud of the paper`).toBeLessThanOrEqual(hx - 0.04 + 1e-4);
        expect(v, `${name} close to the paper`).toBeGreaterThan(hx - 0.04 - 0.03);
        expect(Math.abs(u - pic.along), `${name} along`).toBeLessThanOrEqual(pic.wide / 2 + 1e-4);
        expect(z - CABIN_FLOOR, `${name} low`).toBeGreaterThanOrEqual(pic.at - 1e-4);
        expect(z - CABIN_FLOOR, `${name} high`).toBeLessThanOrEqual(pic.at + pic.high + 1e-4);
      }
  });

  it('is built the same each time', () => {
    const again = roomGroups(ROOM_COLOURS, HOME, lakes);
    for (const name of ['mapWater', 'mapDam'] as const) {
      expect(Array.from(part(again, name).mesh.positions)).toEqual(Array.from(part(groups, name).mesh.positions));
    }
  });
});
