/**
 * The room inside the cabin, as it is drawn: a plank floor, walls and a ceiling that face in, a bed in the back corner,
 * the window and the door in the lake-facing wall, and a lamp hung from the ceiling. The cabin's outer walls are the
 * solid blocks of `cabin.ts`, unchanged, so the room is wholly inside them and is never seen from outside; it is the
 * picture of waking, and the game knows nothing of it. Where everything stands and how big it is is the lake's
 * (`lake.cabin.room`), the colours are handed in, and each part is made once, in the world's own frame, and placed by the
 * identity, with the timber taking the wood's painted edge as the cabin's does.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import { block, built, frustum, prism } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import type { Mesh } from 'artshape-render/mesh/types';
import { placeAt } from './cabin';
import type { Cabin, Lake } from './lakes/lake';
import { CALENDAR } from './lake';
import type { Colour } from './palette';

/** The room's parts, in the order `roomGroups` makes them: a group, and a colour, each. */
export const ROOM_PARTS = [
  'floor',
  'walls',
  'ceiling',
  'bed',
  'bedding',
  'blanket',
  'window',
  'glass',
  'door',
  'shade',
  'bulb',
  'table',
  'chair',
  'mug',
  'stove',
  'shelf',
  'books',
  'jar',
  'rug',
  'chest',
  'frame',
  'canvas',
  'peg',
  'coat',
  'calendarSheet',
  'calendarBar',
  'bandSummer',
  'bandAutumn',
  'bandWinter',
  'bandSpring',
] as const;
/** The calendar's season bands in the year's order, a row each from the top, named from `SEASONS`. */
export const BAND_PARTS = ['bandSummer', 'bandAutumn', 'bandWinter', 'bandSpring'] as const;
export type RoomPart = (typeof ROOM_PARTS)[number];
/** The calendar's two moving parts, which are not in the static room but handed over by `CalendarDraw` as the day changes. */
export const MARK_PARTS = ['calendarGone', 'calendarToday'] as const;
export type MarkPart = (typeof MARK_PARTS)[number];
/** A colour for each part of the room and of the calendar's marks, handed in by the page. */
export type RoomColours = Record<RoomPart | MarkPart, Colour>;

/** The eight pieces of furniture and the parts each is made of, in `ROOM_PARTS`: a part has one colour, so a piece with two has two. */
export const FURNITURE = {
  table: ['table', 'chair', 'mug'],
  stove: ['stove'],
  shelf: ['shelf', 'books', 'jar'],
  rug: ['rug'],
  chest: ['chest'],
  picture: ['frame', 'canvas'],
  coat: ['peg', 'coat'],
  calendar: ['calendarSheet', 'calendarBar', ...BAND_PARTS],
} as const satisfies Record<string, readonly RoomPart[]>;

/** The paint set the timber takes, the wood's faint warm lip, as the cabin's own does. */
const WOOD = 1;
const ONE = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** How much the glass and the bulb glow from themselves, as the cabin's window does outside: lit, not only lit upon. */
const GLASS_GLOW = 0.85;
const BULB_GLOW = 1;
/** How wide a floor plank is, and how far every other one is sunk, so the boards are seen as boards. */
const PLANK = 0.7,
  GROOVE = 0.015;

/** A timber mesh with the painted edge: split, and painted on the wood's set. */
function timber(mesh: Mesh) {
  return painted(split(mesh), { set: WOOD, choice: 'gate' });
}

/** The cabin a room is in: a lake with none has no room, and what asks for one is refused by name. */
function cabinOf(lake: Lake): Cabin {
  if (!lake.cabin) throw new Error(`${lake.name} has no cabin, so no room`);
  return lake.cabin;
}

/**
 * The wall calendar's measures, worked out from `CABIN_ROOM.furniture.calendar` once: a square's cell, the sheet's
 * height, and where square `i` (row by row from the top left, as it is read) is in the world, on the sheet's face.
 */
export function calendarGeometry(lake: Lake) {
  const { spec: CABIN, at: CABIN_AT, room: CABIN_ROOM, floor: CABIN_FLOOR } = cabinOf(lake);
  const place = placeAt(CABIN_AT);
  const cal = CABIN_ROOM.furniture.calendar;
  const cell = (cal.wide - 2 * cal.margin) / CALENDAR.columns;
  const high = cal.bar + 2 * cal.margin + CALENDAR.rows * cell;
  const wall = CABIN.body.across / 2 - CABIN_ROOM.inset;
  // read from the room, facing the lake wall: whether the shore's direction runs to the reader's right decides which
  // way a row is read, so that the first square is always the top left
  const [ix, iy] = CABIN_AT.inward,
    [ax, ay] = CABIN_AT.along;
  const reads = ax * iy - ay * ix >= 0 ? 1 : -1;
  return {
    cal,
    cell,
    high,
    wall,
    /** Which way along the shore the reader's right is: 1 or -1. */
    reads,
    size: cell * cal.mark,
    /** Square `i`'s middle in the world, and the direction the wall faces into the room, as a turn about z. */
    spot: (i: number): [number, number, number] => {
      const row = Math.floor(i / CALENDAR.columns),
        col = i % CALENDAR.columns;
      const u = cal.along + reads * (-cal.wide / 2 + cal.margin + (col + 0.5) * cell);
      const z = CABIN_FLOOR + cal.at + high - cal.bar - cal.margin - (row + 0.5) * cell;
      const [x, y] = place([wall - cal.depth - cal.proud, u, 0]);
      return [x, y, z];
    },
    /** The turn that puts a mark's own x, its normal, along the wall's, out into the room. */
    yaw: Math.atan2(-iy, -ix),
  };
}

/** Where the lamp hangs, in the world: the bulb's middle. */
export function lampAt(lake: Lake): [number, number, number] {
  const { at: CABIN_AT, room: CABIN_ROOM, floor: CABIN_FLOOR } = cabinOf(lake);
  const [x, y] = placeAt(CABIN_AT)([CABIN_ROOM.lamp.across, CABIN_ROOM.lamp.along, 0]);
  return [x, y, CABIN_FLOOR + CABIN_ROOM.high - CABIN_ROOM.lamp.drop - 0.12];
}

/** The room's drawn parts, one group a part in `ROOM_PARTS`' order. */
export function roomGroups(colours: RoomColours, lake: Lake): GameGroup[] {
  if (!lake.cabin) return [];
  const { spec: CABIN, at: CABIN_AT, room: CABIN_ROOM, floor: CABIN_FLOOR } = lake.cabin;
  const place = placeAt(CABIN_AT);
  const { inset, high, slab, bed, window: win, door, lamp } = CABIN_ROOM;
  // the room's walls are `inset` inside the cabin's; local x runs across (toward the lake) and y along the shore
  const hx = CABIN.body.across / 2 - inset,
    hy = CABIN.body.along / 2 - inset;
  const floor = CABIN_FLOOR,
    ceiling = CABIN_FLOOR + high;
  // an outline wound clockwise from above, which a prism turns inside out: its sides and its top face in
  const inward: [number, number][] = [
    [-hx, -hy],
    [-hx, hy],
    [hx, hy],
    [hx, -hy],
  ];

  const planks = built((b) => {
    const count = Math.ceil((2 * hy) / PLANK);
    for (let i = 0; i < count; i++) {
      const y0 = -hy + (2 * hy * i) / count,
        y1 = -hy + (2 * hy * (i + 1)) / count;
      block(b, place, -hx, hx, y0, y1, floor - slab, floor - (i % 2 ? GROOVE : 0));
    }
  });
  const walls = built((b) => prism(b, place, inward, floor - slab, ceiling, { top: false }));
  // the ceiling is the cap of a thin slab turned inside out, so it faces down into the room
  const roof = built((b) => prism(b, place, inward, ceiling - 0.05, ceiling));

  // the bed lies in the back corner, its head to the back wall (the far side from the door) and its side to the end wall
  const u1 = hy,
    u0 = hy - bed.width,
    v0 = -hx,
    v1 = -hx + bed.length;
  const frameTop = floor + bed.legs + bed.base;
  const mattressTop = frameTop + bed.mattress;
  const post = 0.14;
  const frame = built((b) => {
    for (const [pu, pv] of [
      [u0, v0],
      [u1 - post, v0],
      [u0, v1 - post],
      [u1 - post, v1 - post],
    ])
      block(b, place, pv, pv + post, pu, pu + post, floor, floor + bed.legs);
    block(b, place, v0, v1, u0, u1, floor + bed.legs, frameTop);
    // the headboard stands at the back wall, and a low foot rail at the other end
    block(b, place, v0, v0 + 0.14, u0, u1, floor + bed.legs, floor + bed.headboard);
    block(b, place, v1 - 0.12, v1, u0, u1, floor + bed.legs, mattressTop + 0.12);
  });
  const bedding = built((b) => {
    block(b, place, v0 + 0.14, v1 - 0.12, u0 + 0.06, u1 - 0.06, frameTop, mattressTop);
    // a pillow at the head
    block(b, place, v0 + 0.2, v0 + 0.8, u0 + 0.25, u1 - 0.25, mattressTop, mattressTop + 0.2);
  });
  const blanket = built((b) =>
    block(b, place, v0 + 1.15, v1 - 0.12, u0 + 0.03, u1 - 0.03, frameTop + 0.04, mattressTop + 0.1),
  );

  // the window and the door are on the lake-facing wall, set proud of it into the room
  const wall = hx;
  const lit = (glow: number, colour: Colour) =>
    packFlow(new Float32Array(PATTERN_STRIDE), 0, { kind: FLOW_GLOW, scale: 0, speed: 0, glow, second: colour });
  const wy0 = win.along - win.width / 2,
    wy1 = win.along + win.width / 2,
    wz0 = floor + win.sill,
    wz1 = wz0 + win.high;
  const f = win.frame,
    depth = 0.14;
  const windowFrame = built((b) => {
    block(b, place, wall - depth, wall, wy0 - f, wy1 + f, wz0 - f, wz0);
    block(b, place, wall - depth, wall, wy0 - f, wy1 + f, wz1, wz1 + f);
    block(b, place, wall - depth, wall, wy0 - f, wy0, wz0, wz1);
    block(b, place, wall - depth, wall, wy1, wy1 + f, wz0, wz1);
    // a mullion and a transom make four panes of it
    block(b, place, wall - depth, wall, win.along - f / 4, win.along + f / 4, wz0, wz1);
    block(b, place, wall - depth, wall, wy0, wy1, (wz0 + wz1) / 2 - f / 4, (wz0 + wz1) / 2 + f / 4);
  });
  const glass = built((b) => block(b, place, wall - 0.05, wall, wy0, wy1, wz0, wz1));
  const dy0 = door.along - door.width / 2,
    dy1 = door.along + door.width / 2,
    dz1 = floor + door.high;
  const doorway = built((b) => {
    block(b, place, wall - 0.1, wall, dy0, dy1, floor, dz1);
    // the frame round it, and a knob on its warm side
    block(b, place, wall - depth, wall, dy0 - door.frame, dy0, floor, dz1 + door.frame);
    block(b, place, wall - depth, wall, dy1, dy1 + door.frame, floor, dz1 + door.frame);
    block(b, place, wall - depth, wall, dy0, dy1, dz1, dz1 + door.frame);
    block(b, place, wall - 0.2, wall - 0.1, dy1 - 0.3, dy1 - 0.2, floor + 1.1, floor + 1.2);
  });

  // the lamp: a cord from the ceiling, a shade, and the bulb glowing under it
  const [, , bulbZ] = lampAt(lake);
  const lampPlace = ([x, y, z]: [number, number, number]): [number, number, number] =>
    place([lamp.across + x, lamp.along + y, z]);
  const cord = 0.03;
  const shade = built((b) => {
    block(b, lampPlace, -cord, cord, -cord, cord, bulbZ + 0.28, ceiling - 0.05);
    frustum(b, lampPlace, 8, 0.42, 0.1, bulbZ - 0.04, bulbZ + 0.3);
  });
  const bulb = built((b) => frustum(b, lampPlace, 6, 0.14, 0.07, bulbZ - 0.12, bulbZ + 0.06));

  // the furniture: boxes and posts on the floor or hung on the lake wall, centred where `CABIN_ROOM.furniture` says
  const fur = CABIN_ROOM.furniture;
  /** A box centred at (`across`, `along`) of `wx` by `wy`, from height `z0` to `z1` over the floor. */
  const box = (
    b: Parameters<typeof block>[0],
    across: number,
    along: number,
    wx: number,
    wy: number,
    z0: number,
    z1: number,
  ) => block(b, place, across - wx / 2, across + wx / 2, along - wy / 2, along + wy / 2, floor + z0, floor + z1);
  /** The four posts at a box's corners, `leg` thick and `high` tall. */
  const legs = (
    b: Parameters<typeof block>[0],
    across: number,
    along: number,
    wx: number,
    wy: number,
    leg: number,
    high: number,
  ) => {
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        box(b, across + (sx * (wx - leg)) / 2, along + (sy * (wy - leg)) / 2, leg, leg, 0, high);
  };
  const { table: t, chair: c, mug: m } = fur;
  const tableTop = t.high;
  const tableMesh = built((b) => {
    legs(b, t.across, t.along, t.deep, t.wide, t.leg, tableTop - t.top);
    box(b, t.across, t.along, t.deep, t.wide, tableTop - t.top, tableTop);
  });
  const chairMesh = built((b) => {
    legs(b, c.across, c.along, c.size, c.size, c.leg, c.seat - 0.05);
    box(b, c.across, c.along, c.size, c.size, c.seat - 0.05, c.seat);
    // the back is on the room's side, away from the table
    box(b, c.across - (c.size - 0.06) / 2, c.along, 0.06, c.size, c.seat, c.back);
  });
  const mugMesh = built((b) =>
    frustum(
      b,
      ([x, y, z]) => place([m.across + x, m.along + y, z]),
      8,
      m.radius,
      m.radius * 0.9,
      floor + tableTop,
      floor + tableTop + m.high,
    ),
  );

  const { stove: s } = fur;
  const stoveMesh = built((b) => {
    legs(b, s.across, s.along, s.wide, s.deep, 0.08, s.legs);
    box(b, s.across, s.along, s.wide, s.deep, s.legs, s.high);
    // a lid a little proud of the body, a door on the room's side with its handle, and the pipe to the ceiling
    box(b, s.across, s.along, s.wide + 0.06, s.deep + 0.06, s.high, s.high + 0.04);
    const front = s.along - s.deep / 2;
    box(b, s.across, front - 0.02, s.wide * 0.55, 0.04, s.legs + 0.2, s.high - 0.2);
    box(b, s.across + s.wide * 0.2, front - 0.05, 0.04, 0.03, s.high / 2 - 0.05, s.high / 2 + 0.1);
    // the pipe rises, jogs across under the ceiling (along the shore, then across the room) and goes up into the chimney
    const pipeAt =
      (across: number, along: number) =>
      ([x, y, z]: [number, number, number]): [number, number, number] =>
        place([across + x, along + y, z]);
    const runLow = ceiling - s.run - s.pipe,
      runHigh = ceiling - s.run + s.pipe;
    frustum(b, pipeAt(s.across, s.along), 8, s.pipe, s.pipe, floor + s.high + 0.04, runHigh);
    const [a0, a1] = [Math.min(s.along, s.to.along), Math.max(s.along, s.to.along)];
    block(b, place, s.across - s.pipe, s.across + s.pipe, a0 - s.pipe, a1 + s.pipe, runLow, runHigh);
    const [c0, c1] = [Math.min(s.across, s.to.across), Math.max(s.across, s.to.across)];
    block(b, place, c0 - s.pipe, c1 + s.pipe, s.to.along - s.pipe, s.to.along + s.pipe, runLow, runHigh);
    frustum(b, pipeAt(s.to.across, s.to.along), 8, s.pipe, s.pipe, runHigh - 0.01, ceiling - 0.04);
  });

  // the shelf, the picture and the coat hang on the lake wall, flush to it
  const onWall = (b: Parameters<typeof block>[0], along: number, wy: number, depth: number, z0: number, z1: number) =>
    block(b, place, wall - depth, wall, along - wy / 2, along + wy / 2, floor + z0, floor + z1);
  const { shelf: sh, jar: jr } = fur;
  // two shelves, one above the other, a plank on a bracket at each end: the lower holds the books and the jar, and both the
  // junk treasures found, which are drawn by `treasuredraw.ts` standing on their tops
  const shelfMesh = built((b) => {
    for (const s of [sh, fur.shelfUpper]) {
      onWall(b, s.along, s.wide, s.deep, s.high, s.high + s.thick);
      for (const sy of [-1, 1])
        onWall(b, s.along + sy * (s.wide / 2 - 0.12), 0.04, s.deep - 0.04, s.high - 0.2, s.high);
    }
  });
  const shelfTop = sh.high + sh.thick;
  const booksMesh = built((b) => {
    let y = sh.along + sh.wide / 2 - 0.08;
    for (const [thick, tall] of fur.books) {
      y -= thick;
      block(
        b,
        place,
        wall - sh.deep + 0.04,
        wall - 0.02,
        y,
        y + thick - 0.005,
        floor + shelfTop,
        floor + shelfTop + tall,
      );
    }
  });
  const jarMesh = built((b) =>
    frustum(
      b,
      ([x, y, z]) => place([wall - sh.deep / 2 + x, sh.along - sh.wide / 2 + 0.25 + y, z]),
      8,
      jr.radius,
      jr.radius * 0.85,
      floor + shelfTop,
      floor + shelfTop + jr.high,
    ),
  );

  const { rug: r, chest: ch, picture: pic, coat: co } = fur;
  const rugMesh = built((b) => {
    box(b, r.across, r.along, r.wide, r.long, 0, r.thick);
    // an inner field a hair higher than the border, so the border is seen as one
    box(b, r.across, r.along, r.wide - 2 * r.border, r.long - 2 * r.border, 0, r.thick * 1.4);
  });
  const chestMesh = built((b) => {
    box(b, ch.across, ch.along, ch.wide, ch.long, 0, ch.high - ch.lid);
    box(b, ch.across, ch.along, ch.wide + 0.06, ch.long + 0.06, ch.high - ch.lid, ch.high);
  });

  const picZ = pic.at,
    pf = pic.frame;
  const frameMesh = built((b) => {
    onWall(b, pic.along, pic.wide + 2 * pf, 0.06, picZ - pf, picZ);
    onWall(b, pic.along, pic.wide + 2 * pf, 0.06, picZ + pic.high, picZ + pic.high + pf);
    for (const sy of [-1, 1]) onWall(b, pic.along + (sy * (pic.wide + pf)) / 2, pf, 0.06, picZ, picZ + pic.high);
  });
  const canvasMesh = built((b) => onWall(b, pic.along, pic.wide, 0.04, picZ, picZ + pic.high));

  const pegMesh = built((b) => onWall(b, co.along, 0.06, 0.16, co.peg - 0.03, co.peg + 0.03));
  const coatMesh = built((b) => {
    // a collar over the peg, shoulders the widest part, a body that narrows a little to the hem, and a sleeve apiece
    const top = co.peg + 0.1,
      hem = top - co.long,
      shoulder = top - 0.08 - 0.12,
      mid = (shoulder + hem) / 2,
      x = hx - 0.19;
    box(b, x, co.along, 0.12, co.wide * 0.4, top - 0.08, top);
    box(b, x, co.along, 0.12, co.wide, shoulder, top - 0.08);
    box(b, x, co.along, 0.11, co.wide * 0.92, mid, shoulder);
    box(b, x, co.along, 0.1, co.wide * 0.8, hem, mid);
    for (const sy of [-1, 1]) box(b, x, co.along + (sy * (co.wide + 0.08)) / 2, 0.08, 0.08, hem + 0.1, top - 0.1);
  });

  // the calendar: a thin sheet of paper on the wall under a timber bar along its top; the marks on it are `CalendarDraw`'s
  const { cal, high: calHigh } = calendarGeometry(lake);
  const sheetMesh = built((b) => {
    onWall(b, cal.along, cal.wide, cal.depth, cal.at, cal.at + calHigh - cal.bar);
  });
  const barMesh = built((b) =>
    onWall(b, cal.along, cal.wide + 0.04, cal.depth + 0.02, cal.at + calHigh - cal.bar, cal.at + calHigh),
  );

  // a thin strip of colour at the sheet's left edge for each season's row, in the margin clear of the squares and just
  // proud of the paper as the marks are, so the year's four rows can be told at a glance
  const { cell, cal: cc, reads } = calendarGeometry(lake);
  const bandMesh = (row: number) =>
    built((b) => {
      const edge = cc.along + reads * (-cc.wide / 2 + cc.margin / 2);
      const top = cc.at + calHigh - cc.bar - cc.margin - row * cell;
      onWall(b, edge, cc.margin * 0.5, cc.depth + cc.proud / 2, top - cell * 0.94, top - cell * 0.06);
    });

  const timbered = (mesh: Mesh, part: RoomPart, roughness: number): GameGroup => ({
    mesh: timber(mesh),
    matrices: ONE,
    albedo: colours[part],
    roughness,
  });
  const made: Record<RoomPart, GameGroup> = {
    floor: timbered(planks, 'floor', 0.9),
    walls: timbered(walls, 'walls', 0.95),
    ceiling: timbered(roof, 'ceiling', 0.9),
    bed: timbered(frame, 'bed', 0.9),
    bedding: timbered(bedding, 'bedding', 1),
    blanket: timbered(blanket, 'blanket', 1),
    window: timbered(windowFrame, 'window', 0.9),
    glass: {
      mesh: glass,
      matrices: ONE,
      albedo: colours.glass,
      roughness: 0.5,
      patterns: lit(GLASS_GLOW, colours.glass),
    },
    door: timbered(doorway, 'door', 0.9),
    shade: timbered(shade, 'shade', 0.9),
    table: timbered(tableMesh, 'table', 0.9),
    chair: timbered(chairMesh, 'chair', 0.9),
    mug: timbered(mugMesh, 'mug', 0.6),
    stove: timbered(stoveMesh, 'stove', 0.5),
    shelf: timbered(shelfMesh, 'shelf', 0.9),
    books: timbered(booksMesh, 'books', 0.9),
    jar: timbered(jarMesh, 'jar', 0.4),
    rug: timbered(rugMesh, 'rug', 1),
    chest: timbered(chestMesh, 'chest', 0.9),
    frame: timbered(frameMesh, 'frame', 0.9),
    canvas: timbered(canvasMesh, 'canvas', 0.9),
    peg: timbered(pegMesh, 'peg', 0.9),
    coat: timbered(coatMesh, 'coat', 1),
    calendarSheet: timbered(sheetMesh, 'calendarSheet', 1),
    calendarBar: timbered(barMesh, 'calendarBar', 0.9),
    bandSummer: timbered(bandMesh(0), 'bandSummer', 1),
    bandAutumn: timbered(bandMesh(1), 'bandAutumn', 1),
    bandWinter: timbered(bandMesh(2), 'bandWinter', 1),
    bandSpring: timbered(bandMesh(3), 'bandSpring', 1),
    bulb: { mesh: bulb, matrices: ONE, albedo: colours.bulb, roughness: 0.4, patterns: lit(BULB_GLOW, colours.bulb) },
  };
  return ROOM_PARTS.map((part) => made[part]);
}
