/**
 * The cast as it is drawn: the rod held out over the bank (the angler is the player, and is not drawn), the line from the rod's tip to the lure in the air
 * and to the bobber once it is in, sagging a little, the bobber bobbing by the game's clock, the lure, and while
 * aiming the preview of where it will go, a dotted arc and a ring where it lands, yellow over the water and red over
 * the bank. Every part is a pool sized once, written each frame from the game and the aim; nothing is made.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { pathPoints, rodTip } from './cast';
import type { Game } from './game';
import { ANGLER, ground } from './lake';
import { place } from './matrix';
import { ball, box } from './meshes';
import { PALETTE } from './palette';
import { STILL, type Surface } from './water/swell';

/** How many pieces the line is drawn with, how many dots the preview, and how many pieces its ring. */
export const LINE_PIECES = 24;
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
  line: number;
  dots: number;
  ringWater: number;
  ringBank: number;
  bobber: number;
  lure: number;
}

export class CastDraw {
  readonly rod = new Float32Array(16);
  readonly line = new Float32Array((LINE_PIECES + 1) * 16);
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

  constructor() {
    // the rod stands still, so is placed once: from the angler's hands to its tip
    const z = ground(ANGLER.x, ANGLER.y);
    piece(this.rod, 0, [ANGLER.x + 0.6, ANGLER.y + 0.5, z + 5], rodTip(), 0.16);
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
    return [
      g(unit, this.rod, PALETTE.rod),
      g(unit, this.line, PALETTE.line, 0, 0.5),
      g(ball(0.28, 4, 7), this.lure, PALETTE.lure, 0, 0.4),
      g(ball(0.38, 5, 8), this.bobber, PALETTE.bobber, 0, 0.35),
      g(ball(0.22, 3, 6), this.dots, PALETTE.aim, 0),
      g(unit, this.ringWater, PALETTE.aimWater, 0),
      g(unit, this.ringBank, PALETTE.aimBank, 0),
    ];
  }

  /** Everything where it is now, and the preview if a cast is being aimed. */
  write(game: Game, aim: Aim | null): Drawn {
    const { lure } = game;
    const tip = rodTip();
    const out: Drawn = { line: 0, dots: 0, ringWater: 0, ringBank: 0, bobber: 0, lure: 1 };
    // where the lure is: hanging from the tip when ready, or wherever its cast has it
    if (lure.phase === 'ready') this.end.set([tip[0], tip[1], tip[2] - DANGLE]);
    else this.end.set(lure.at);
    place(this.lure, 0, this.end[0], this.end[1], this.end[2]);

    // the line runs to the bobber once the lure is in the water, and down from it to the lure
    const to = this.b;
    if (lure.phase === 'sinking') {
      const z = this.surface(lure.bobber[0], lure.bobber[1], game.t) + BOB.height * Math.sin(game.t * BOB.rate);
      place(this.bobber, 0, lure.bobber[0], lure.bobber[1], z);
      out.bobber = 1;
      to.set([lure.bobber[0], lure.bobber[1], z]);
    } else to.set(this.end);
    const len = Math.hypot(to[0] - tip[0], to[1] - tip[1], to[2] - tip[2]);
    const at = (s: number, into: Float64Array) => {
      into[0] = tip[0] + (to[0] - tip[0]) * s;
      into[1] = tip[1] + (to[1] - tip[1]) * s;
      into[2] = tip[2] + (to[2] - tip[2]) * s - SAG * len * 4 * s * (1 - s);
    };
    for (let k = 0; k < LINE_PIECES; k++) {
      at(k / LINE_PIECES, this.a);
      at((k + 1) / LINE_PIECES, this.c);
      piece(this.line, k, this.a, this.c, LINE_WIDTH);
    }
    out.line = LINE_PIECES;
    if (lure.phase === 'sinking') {
      piece(this.line, LINE_PIECES, [lure.bobber[0], lure.bobber[1], to[2]], lure.at, LINE_WIDTH);
      out.line++;
    }

    if (aim) {
      const onWater = pathPoints(aim.angle, aim.power, PREVIEW_DOTS, this.path);
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
