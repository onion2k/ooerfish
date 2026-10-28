/**
 * The cast as it is drawn: the rod held out over the bank (the angler is the player, and is not drawn), the line from the rod's tip to the lure in the air
 * and to the bobber once it is in, sagging a little, the bobber bobbing by the game's clock, the lure, and while
 * aiming the preview of where it will go, a dotted arc and a ring where it lands, yellow over the water and red over
 * the bank. With a fish on the line, the rod bends toward it by the line's tension and the line warms from white to
 * red, and the bobber, dragged under, is gone; before that, it twitches at a nibble and dips under and shakes at the
 * bite. Every part is a pool sized once, written each frame from the game and the aim; nothing is made.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { pathPoints, rodTip } from './cast';
import type { Game } from './game';
import { FISH_BODY } from './fishdraw';
import type { Lake } from './lakes/lake';
import { HOME } from './lakes';
import { DRUM_RULES, TREASURE_RULES } from './rules';
import { place } from './matrix';
import { ball, box } from './meshes';
import { PALETTE } from './palette';
import { STILL, type Surface } from './water/swell';

/** How many pieces the line is drawn with, how many dots the preview, and how many pieces its ring. */
export const LINE_PIECES = 24;
/** How many pieces the rod is drawn with, so it can bend, and how many colours the line takes as it tightens. */
export const ROD_PIECES = 6;
export const LINE_COLOURS = 4;
/** How far the rod's tip is drawn down, and toward the fish, at the tightest. */
const BEND = { down: 2.4, toward: 1.2 } as const;
/** A landed fish, shown off: how far below the rod tip the lure at its mouth hangs, how far it sways, and how fast. */
export const HANG = { drop: 1.6, sway: 0.2, rate: 1.7 } as const;
/** How thick the line is with a fish on, so its colour reads from the shore. */
const LINE_WIDTH_ON = 0.12;
/** How far the bobber dips under at a bite, and twitches at a nibble, and how long the twitch lasts. */
const DIP = 0.35;
const TWITCH = { depth: 0.16, lasts: 0.3 } as const;
/** How far the bobber shakes from side to side while the strike's window is open, and how fast, by the game's clock. */
const SHAKE = { reach: 0.12, rate: 38 } as const;
export const PREVIEW_DOTS = 24;
const RING_PIECES = 20;
/** How thick the line is; how far it sags, a share of its length; how far the lure hangs from the tip when ready. */
const LINE_WIDTH = 0.06;
const SAG = 0.06;
const DANGLE = 1.6;
/** The ring's radius and the thickness of its pieces; how far the bobber bobs, and how fast. */
const RING = { radius: 1.4, width: 0.22 } as const;
const BOB = { height: 0.07, rate: 2.3 } as const;

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
}

export class CastDraw {
  readonly rod = new Float32Array(ROD_PIECES * 16);
  /** The line's pools, one a colour, from white to red. */
  readonly lines = Array.from({ length: LINE_COLOURS }, () => new Float32Array((LINE_PIECES + 1) * 16));
  readonly lure = new Float32Array(16);
  readonly bobber = new Float32Array(16);
  /** Where the water stands, which the bobber rides: still water unless the page says the water swells. */
  surface: Surface = STILL;
  readonly dots = new Float32Array(PREVIEW_DOTS * 16);
  readonly ringWater = new Float32Array(RING_PIECES * 16);
  readonly ringBank = new Float32Array(RING_PIECES * 16);
  private readonly path = new Float32Array(PREVIEW_DOTS * 3);
  private readonly a = new Float64Array(3);
  private readonly b = new Float64Array(3);
  private readonly c = new Float64Array(3);
  private readonly end = new Float64Array(3);
  /** Where the rod is held, and where its tip is drawn this frame, bent or not. */
  private readonly hand: [number, number, number];
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
  };

  /** The lake it draws the cast over: where its angler stands and holds the rod, and what its casts land on. */
  constructor(private readonly lake: Lake = HOME) {
    const { angler } = lake;
    const z = lake.ground(angler.x, angler.y);
    this.hand = [angler.x + 0.6, angler.y + 0.5, z + 5];
  }

  /**
   * The rod from the hand to its tip, the tip drawn down and toward the fish by `bend` (nought to one): a curve whose
   * middle is where the straight rod's would be, so it is straight unbent and bows as it bends.
   */
  private writeRod(bend: number, toward: ArrayLike<number>) {
    const t0 = rodTip(this.lake);
    const dx = toward[0] - t0[0],
      dy = toward[1] - t0[1];
    const flat = Math.hypot(dx, dy) || 1;
    this.tip[0] = t0[0] + (dx / flat) * BEND.toward * bend;
    this.tip[1] = t0[1] + (dy / flat) * BEND.toward * bend;
    this.tip[2] = t0[2] - BEND.down * bend;
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
    ];
  }

  /** Everything where it is now, and the preview if a cast is being aimed. */
  write(game: Game, aim: Aim | null): Drawn {
    const { lure, bite, line } = game;
    const out = this.drawn;
    out.dots = out.ringWater = out.ringBank = out.bobber = out.hung = 0;
    out.lure = 1;
    out.lines.fill(0);
    const on = bite.phase === 'hooked' || bite.phase === 'landed';
    const tension = bite.phase === 'hooked' ? line.tension : 0;
    // where the lure is: hanging from the tip when ready, or wherever its cast, or the fish in whose mouth it is, has it
    const t0 = rodTip(this.lake);
    if (lure.phase === 'ready') {
      this.end[0] = t0[0];
      this.end[1] = t0[1];
      this.end[2] = t0[2] - DANGLE;
    } else if (bite.phase === 'landed') {
      // landed, it is lifted out and hangs from the tip by a short line, swaying, the lure at its mouth
      const sway = HANG.sway * Math.sin(game.t * HANG.rate);
      this.end[0] = t0[0] + sway;
      this.end[1] = t0[1];
      this.end[2] = t0[2] - HANG.drop;
      this.hang[0] = this.end[0];
      this.hang[1] = this.end[1];
      this.hang[2] = this.end[2] - FISH_BODY.length / 2;
      out.hung = 1;
    } else this.end.set(lure.at);
    place(this.lure, 0, this.end[0], this.end[1], this.end[2]);
    this.writeRod(tension, this.end);
    out.rod = ROD_PIECES;
    const tip = this.tip;

    // the line runs to the bobber once the lure is in the water, and down from it to the lure; with a fish on, the
    // bobber is dragged under and gone, and the line runs straight to the fish, the less slack the tighter it is
    const to = this.b;
    if (lure.phase === 'sinking') {
      let z = this.surface(lure.bobber[0], lure.bobber[1], game.t) + BOB.height * Math.sin(game.t * BOB.rate);
      // a drum pulls the bobber under harder than a fish does, and a treasure a little harder
      if (bite.phase === 'biting')
        z -= DIP * (bite.drum >= 0 ? DRUM_RULES.dip : bite.treasure >= 0 ? TREASURE_RULES.dip : 1);
      else if (bite.phase === 'nibbling' && bite.nibbledAt >= 0 && game.t - bite.nibbledAt < TWITCH.lasts)
        z -= TWITCH.depth * Math.sin((Math.PI * (game.t - bite.nibbledAt)) / TWITCH.lasts);
      // shaken while the window is open, so the bite is seen from the shore and not only read
      const shake = bite.phase === 'biting' ? SHAKE.reach * Math.sin(game.t * SHAKE.rate) : 0;
      place(this.bobber, 0, lure.bobber[0] + shake, lure.bobber[1], z);
      out.bobber = 1;
      to[0] = lure.bobber[0];
      to[1] = lure.bobber[1];
      to[2] = z;
    } else to.set(this.end);
    const colour = on ? Math.min(LINE_COLOURS - 1, Math.floor(tension * LINE_COLOURS)) : 0;
    const pool = this.lines[colour];
    const sag = SAG * (1 - 0.85 * tension);
    const width = on ? LINE_WIDTH_ON : LINE_WIDTH;
    const len = Math.hypot(to[0] - tip[0], to[1] - tip[1], to[2] - tip[2]);
    const at = (s: number, into: Float64Array) => {
      into[0] = tip[0] + (to[0] - tip[0]) * s;
      into[1] = tip[1] + (to[1] - tip[1]) * s;
      into[2] = tip[2] + (to[2] - tip[2]) * s - sag * len * 4 * s * (1 - s);
    };
    for (let k = 0; k < LINE_PIECES; k++) {
      at(k / LINE_PIECES, this.a);
      at((k + 1) / LINE_PIECES, this.c);
      piece(pool, k, this.a, this.c, width);
    }
    out.lines[colour] = LINE_PIECES;
    if (lure.phase === 'sinking') {
      piece(pool, LINE_PIECES, to, lure.at, LINE_WIDTH);
      out.lines[colour]++;
    }

    if (aim) {
      const onWater = pathPoints(aim.angle, aim.power, PREVIEW_DOTS, this.path, this.lake, game.wind);
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
