/**
 * The cast as it is drawn: the rod held out over the bank (the angler is the player, and is not drawn), the line from the rod's tip to the lure in the air
 * and to the bobber once it is in, as the segments of the game's rope (`Game.rope`, which hangs and strains it), the
 * bobber where the game puts the line's end (bobbing by the game's clock), the lure, and while
 * aiming the preview of where it will go, a dotted arc and a ring where it lands, yellow over the water and red over
 * the bank. With a fish on the line, the rod bends toward it by the line's tension and the line warms from white to
 * red, and the bobber, dragged under, is gone; before that, it twitches at a nibble and dips under and shakes at the
 * bite. Every part is a pool sized once, written each frame from the game and the aim; nothing is made.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { bentTip, pathPoints, rodTip } from './cast';
import type { Game } from './game';
import { FISH_BODY } from './fishdraw';
import type { Lake, Stand } from './lakes/lake';
import { HOME } from './lakes';
import { LAZY, LINE_DRAW, ROPE, SNAG } from './lake';
import { bellGroups, bellMatrix, bellSwing, proppedTip, restGroups, restInto, type Rest } from './lazy';
import { place } from './matrix';
import { ball, box } from './meshes';
import { PALETTE } from './palette';

/** How many pieces the line is drawn with, how many dots the preview, and how many pieces its ring. */
export const LINE_PIECES = ROPE.points - 1;
/** How many pieces the rod is drawn with, so it can bend, and how many colours the line takes as it tightens. */
export const ROD_PIECES = 6;
export const LINE_COLOURS = 4;
/** A landed fish, shown off: how far below the rod tip the lure at its mouth hangs, how far it sways, and how fast. */
export const HANG = LINE_DRAW.hang;
/** How thick the line is with a fish on, so its colour reads from the shore. */
const LINE_WIDTH_ON = 0.12;
export const PREVIEW_DOTS = 24;
const RING_PIECES = 20;
/** How thick the line is. */
const LINE_WIDTH = 0.06;
/** The ring's radius and the thickness of its pieces. */
const RING = { radius: 1.4, width: 0.22 } as const;

/** Aboard the boat the rod is held this far ahead of the seat and this far over its base, since the rod rises from the lap. */
const HAND_AHEAD = 0.4;
const HAND_UP = 0.5;

/** What a cast is aimed at while it is being aimed. */
export interface Aim {
  angle: number;
  power: number;
}

/** A unit box placed as a piece from `a` to `b`, `width` thick: its own x along the way, flat to the ground across it. */
export function piece(out: Float32Array, i: number, a: ArrayLike<number>, b: ArrayLike<number>, width: number) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const ux = dx / len,
    uy = dy / len,
    uz = dz / len;
  // across: level with the ground, square to the way; straight up or down, east does instead
  let sx = -uy,
    sy = ux;
  const sl = Math.hypot(sx, sy);
  if (sl < 1e-6) {
    sx = 1;
    sy = 0;
  } else {
    sx /= sl;
    sy /= sl;
  }
  // and the third, square to both
  const tx = -uz * sy,
    ty = uz * sx,
    tz = ux * sy - uy * sx;
  const o = i * 16;
  out.set([ux * len, uy * len, uz * len, 0, sx * width, sy * width, 0, 0, tx * width, ty * width, tz * width, 0], o);
  out[o + 12] = (a[0] + b[0]) / 2;
  out[o + 13] = (a[1] + b[1]) / 2;
  out[o + 14] = (a[2] + b[2]) / 2;
  out[o + 15] = 1;
}

export interface Drawn {
  rod: number;
  /** Whether a landed fish hangs from the rod, at `hang`. */
  hung: number;
  /** How many pieces of the line are in each of its colours: all of it in one. */
  lines: number[];
  dots: number;
  ringWater: number;
  ringBank: number;
  bobber: number;
  lure: number;
  /** Whether the propped rod's bell hangs from its tip, and whether the forked rest stands in the bank. */
  bell: number;
  rest: number;
}

export class CastDraw {
  readonly rod = new Float32Array(ROD_PIECES * 16);
  /** The line's pools, one a colour, from white to red. */
  readonly lines = Array.from({ length: LINE_COLOURS }, () => new Float32Array((LINE_PIECES + 1) * 16));
  readonly lure = new Float32Array(16);
  readonly bobber = new Float32Array(16);
  readonly dots = new Float32Array(PREVIEW_DOTS * 16);
  readonly ringWater = new Float32Array(RING_PIECES * 16);
  readonly ringBank = new Float32Array(RING_PIECES * 16);
  /** The propped rod's bell and the bank's forked rest: a placement each, scaled to nothing when not shown. */
  readonly bell = new Float32Array(16);
  readonly restAt = new Float32Array(16);
  private readonly rest: Rest = { x: 0, y: 0, z: 0, heading: 0 };
  private readonly path = new Float32Array(PREVIEW_DOTS * 3);
  private readonly a = new Float64Array(3);
  private readonly b = new Float64Array(3);
  private readonly c = new Float64Array(3);
  private readonly end = new Float64Array(3);
  /** Where the rod is held, and where its tip is drawn this frame, bent or not. */
  private readonly hand: [number, number, number];
  /** The shore's hand, worked out once: ashore it is exactly this, so nothing ashore moves. */
  private readonly shoreHand: readonly [number, number, number];
  private readonly tip = new Float64Array(3);
  /** Where the middle of a landed fish hangs, when `hung` says one does. */
  readonly hang = new Float64Array(3);
  private readonly drawn: Drawn = {
    rod: 0,
    hung: 0,
    lines: new Array<number>(LINE_COLOURS).fill(0),
    dots: 0,
    ringWater: 0,
    ringBank: 0,
    bobber: 0,
    lure: 1,
    bell: 0,
    rest: 0,
  };

  /** The lake it draws the cast over: where its angler stands and holds the rod, and what its casts land on. */
  constructor(private readonly lake: Lake = HOME) {
    const { angler } = lake;
    const z = angler.base ?? lake.ground(angler.x, angler.y);
    // the hand is held half a unit ahead of the angler and six tenths to their right, whichever way they face (due north
    // when the stand has no heading, which is how the Reservoir's angler stands)
    const facing = angler.heading ?? Math.PI / 2;
    this.shoreHand = [
      angler.x + Math.cos(facing) * 0.5 + Math.sin(facing) * 0.6,
      angler.y + Math.sin(facing) * 0.5 - Math.cos(facing) * 0.6,
      z + 5,
    ];
    this.hand = [...this.shoreHand];
  }

  /**
   * The hand worked out from where the game has the angler: the shore's, ashore, held from the stand's own heading; aboard, just ahead of the
   * seat and a little over the thwart, since the rod rises from the lap toward its tip. Written into the hand, never made.
   */
  private holdAt(at: Stand) {
    const h = this.hand;
    if (at === this.lake.angler || at.heading === undefined) {
      h[0] = this.shoreHand[0];
      h[1] = this.shoreHand[1];
      h[2] = this.shoreHand[2];
      return;
    }
    h[0] = at.x + Math.cos(at.heading) * HAND_AHEAD;
    h[1] = at.y + Math.sin(at.heading) * HAND_AHEAD;
    h[2] = (at.base ?? 0) + HAND_UP;
  }

  /**
   * The rod from the hand to its tip, the tip drawn down and toward the fish by `bend` (nought to one): a curve whose
   * middle is where the straight rod's would be, so it is straight unbent and bows as it bends.
   */
  private writeRod(bend: number, toward: ArrayLike<number>, stand: Stand) {
    const t0 = rodTip(this.lake, stand);
    bentTip(this.lake, bend, toward, this.tip, stand);
    const h = this.hand;
    const at = (s: number, into: Float64Array) => {
      for (let k = 0; k < 3; k++) {
        const mid = (h[k] + t0[k]) / 2;
        into[k] = (1 - s) * (1 - s) * h[k] + 2 * s * (1 - s) * mid + s * s * this.tip[k];
      }
    };
    for (let k = 0; k < ROD_PIECES; k++) {
      at(k / ROD_PIECES, this.a);
      at((k + 1) / ROD_PIECES, this.c);
      piece(this.rod, k, this.a, this.c, 0.16 - 0.06 * (k / ROD_PIECES));
    }
  }

  /** The rod propped: straight from the rest to its tip, which is written into `tip`. */
  private writeProppedRod(rest: Rest) {
    proppedTip(rest, this.tip);
    const t = this.tip;
    for (let k = 0; k < ROD_PIECES; k++) {
      const u0 = k / ROD_PIECES,
        u1 = (k + 1) / ROD_PIECES;
      this.a[0] = rest.x + (t[0] - rest.x) * u0;
      this.a[1] = rest.y + (t[1] - rest.y) * u0;
      this.a[2] = rest.z + (t[2] - rest.z) * u0;
      this.c[0] = rest.x + (t[0] - rest.x) * u1;
      this.c[1] = rest.y + (t[1] - rest.y) * u1;
      this.c[2] = rest.z + (t[2] - rest.z) * u1;
      piece(this.rod, k, this.a, this.c, 0.16 - 0.06 * u0);
    }
  }

  /** The groups, handed to the renderer once, in this order; `write` says how many of each are live. */
  groups(): GameGroup[] {
    const g = (
      mesh: GameGroup['mesh'],
      matrices: Float32Array,
      albedo: [number, number, number],
      count?: number,
      roughness = 0.7,
    ) => ({
      mesh,
      matrices,
      albedo,
      roughness,
      ...(count === undefined ? {} : { count }),
    });
    const unit = box(1, 1, 1, true);
    const colours = [PALETTE.line, PALETTE.lineWarm, PALETTE.lineHot, PALETTE.lineRed];
    return [
      g(unit, this.rod, PALETTE.rod, ROD_PIECES),
      ...this.lines.map((pool, k) => g(unit, pool, colours[k], 0, 0.5)),
      g(ball(0.28, 4, 7), this.lure, PALETTE.lure, 0, 0.4),
      g(ball(0.38, 5, 8), this.bobber, PALETTE.bobber, 0, 0.35),
      g(ball(0.22, 3, 6), this.dots, PALETTE.aim, 0),
      g(unit, this.ringWater, PALETTE.aimWater, 0),
      g(unit, this.ringBank, PALETTE.aimBank, 0),
      // the bell and the rest last, so the slots of everything ahead of them are as they were
      ...bellGroups(this.bell),
      ...restGroups(this.restAt),
    ];
  }

  /** Everything where it is now, and the preview if a cast is being aimed. */
  write(game: Game, aim: Aim | null): Drawn {
    const { lure, bite, line } = game;
    // the rod is held from wherever the game has the angler: the shore's place, or the boat's seat
    const stand = game.anglerAt();
    this.holdAt(stand);
    const out = this.drawn;
    out.dots = out.ringWater = out.ringBank = out.bobber = out.hung = 0;
    out.lure = 1;
    out.lines.fill(0);
    // a snagged lure tugged at bends the rod and warms the line as a fish would, by the figure the game reads
    const tugged = lure.phase === 'snagged' && game.reeling;
    const on = bite.phase === 'hooked' || bite.phase === 'landed' || tugged;
    const tension = bite.phase === 'hooked' ? line.tension : tugged ? SNAG.tension : 0;
    // where the lure is: the line's end when it hangs from the tip, is landed, or is in the air or fish's mouth; the
    // game worked the end out, and the rope runs to it
    const end = game.lineEnd;
    if (lure.phase !== 'sinking' && lure.phase !== 'snagged') {
      this.end.set(end);
      if (bite.phase === 'landed') {
        // landed, it is lifted out and hangs from the tip by a short line, swaying, the lure at its mouth
        this.hang[0] = end[0];
        this.hang[1] = end[1];
        this.hang[2] = end[2] - FISH_BODY.length / 2;
        out.hung = 1;
      }
    } else this.end.set(lure.at);
    place(this.lure, 0, this.end[0], this.end[1], this.end[2]);
    // propped, the rod lies on its rest unbent with the bell at its tip, swinging for `LAZY.ring` after a bite; in hand the
    // bell is scaled to nothing, and so is the rest, which is shown only propped at a lake with no jetty to rest it on
    out.bell = out.rest = 0;
    if (game.propped) {
      const rest = restInto(this.lake, stand, this.rest);
      this.writeProppedRod(rest);
      bellMatrix(this.bell, this.tip, rest.heading, bellSwing(game.t - game.rang), LAZY.bell);
      out.bell = 1;
      if (!this.lake.jetty && stand === this.lake.angler) {
        place(this.restAt, 0, rest.x, rest.y, rest.z, rest.heading);
        out.rest = 1;
      }
    } else this.writeRod(tension, this.end, stand);
    if (!out.bell) this.bell.fill(0);
    if (!out.rest) this.restAt.fill(0);
    out.rod = ROD_PIECES;

    // with the lure in the water the line ends at the bobber, and runs on down from it to the lure; with a fish on, the
    // bobber is dragged under and gone
    if (lure.phase === 'sinking' || lure.phase === 'snagged') {
      // shaken while the window is open, so the bite is seen from the shore and not only read
      const shake = bite.phase === 'biting' ? LINE_DRAW.shake.reach * Math.sin(game.t * LINE_DRAW.shake.rate) : 0;
      place(this.bobber, 0, lure.bobber[0] + shake, lure.bobber[1], end[2]);
      out.bobber = 1;
    }
    const colour = on ? Math.min(LINE_COLOURS - 1, Math.floor(tension * LINE_COLOURS)) : 0;
    const pool = this.lines[colour];
    const width = on ? LINE_WIDTH_ON : LINE_WIDTH;
    const pts = game.rope.points;
    for (let k = 0; k < LINE_PIECES; k++) {
      const u = k * 3;
      this.a[0] = pts[u];
      this.a[1] = pts[u + 1];
      this.a[2] = pts[u + 2];
      this.c[0] = pts[u + 3];
      this.c[1] = pts[u + 4];
      this.c[2] = pts[u + 5];
      piece(pool, k, this.a, this.c, width);
    }
    out.lines[colour] = LINE_PIECES;
    if (lure.phase === 'sinking' || lure.phase === 'snagged') {
      this.b.set(end);
      piece(pool, LINE_PIECES, this.b, lure.at, LINE_WIDTH);
      out.lines[colour]++;
    }

    if (aim) {
      const onWater = pathPoints(aim.angle, aim.power, PREVIEW_DOTS, this.path, this.lake, game.wind, stand);
      for (let k = 0; k < PREVIEW_DOTS; k++)
        place(this.dots, k, this.path[k * 3], this.path[k * 3 + 1], this.path[k * 3 + 2]);
      out.dots = PREVIEW_DOTS;
      const lx = this.path[(PREVIEW_DOTS - 1) * 3],
        ly = this.path[(PREVIEW_DOTS - 1) * 3 + 1],
        lz = this.path[(PREVIEW_DOTS - 1) * 3 + 2] + 0.05;
      const ring = onWater ? this.ringWater : this.ringBank;
      const length = ((Math.PI * 2 * RING.radius) / RING_PIECES) * 1.15;
      for (let j = 0; j < RING_PIECES; j++) {
        const t = (j / RING_PIECES) * Math.PI * 2;
        place(
          ring,
          j,
          lx + Math.cos(t) * RING.radius,
          ly + Math.sin(t) * RING.radius,
          lz,
          t + Math.PI / 2,
          length,
          RING.width,
          0.04,
        );
      }
      if (onWater) out.ringWater = RING_PIECES;
      else out.ringBank = RING_PIECES;
    }
    return out;
  }
}
