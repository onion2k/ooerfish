/**
 * Lazy fishing's sums (`docs/boat.md`, C5): how far the bell swings after a bite, and where the propped rod rests. Pure,
 * and knowing nothing of the game or the page; the game keeps the time of the bite and the drawing reads these.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { at, built, frustum, rod } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import { BOAT, LAZY } from './lake';
import type { Lake, Stand } from './lakes/lake';
import { PALETTE } from './palette';

/** A point the propped rod rests on, and the way it points from there. */
export interface Rest {
  x: number;
  y: number;
  /** How high over the water the rest is. */
  z: number;
  /** The way the rod points, in radians round from east. */
  heading: number;
}

/** How far ahead of the stand the bank's forked rest is planted, and how high its fork stands over the ground. */
export const FORK = { ahead: 1, high: 1 } as const;

/**
 * The bell's swing, in radians, `age` seconds after a bite: a sine at the swing rate, its arc dying away linearly over the
 * ring. Nought before the bite (a negative age) and from the ring's end on.
 */
export function bellSwing(age: number): number {
  if (!(age >= 0) || age >= LAZY.ring) return 0;
  return LAZY.swing * Math.sin(2 * Math.PI * LAZY.swings * age) * (1 - age / LAZY.ring);
}

/**
 * Where the rod rests while propped, for the stand it is propped from. The lake's own stand at a lake with a jetty rests it
 * on the rail's lake end, on the right hand of the way the angler faces, at the rail's height; any other stand with a heading
 * is the boat's seat, and rests it on the gunwale ahead of the seat (the boat's middle, since the seat sits aft of it); a
 * lake without a jetty plants a forked rest in the bank `FORK.ahead` in front of the stand, toward the lake's middle when
 * the stand has no heading, with its fork `FORK.high` over the stand's base, or the ground. A new object each call: it is for a picture, not a frame.
 */
export function restFor(lake: Lake, stand: Stand): Rest {
  return restInto(lake, stand, { x: 0, y: 0, z: 0, heading: 0 });
}

/** `restFor` written into `out`, for the game, which asks it every step and makes nothing. */
export function restInto(lake: Lake, stand: Stand, out: Rest): Rest {
  const heading = stand.heading ?? Math.atan2(-stand.y, -stand.x);
  const [ux, uy] = [Math.cos(heading), Math.sin(heading)];
  out.heading = heading;
  if (stand !== lake.angler && stand.heading !== undefined) {
    // aboard: the seat's height is the water's plus `seat.up`, and the gunwale stands `freeboard` over the water
    const ahead = BOAT.hull.seat.aft;
    out.x = stand.x + ux * ahead;
    out.y = stand.y + uy * ahead;
    out.z = (stand.base ?? 0) - BOAT.hull.seat.up + BOAT.hull.freeboard;
    return out;
  }
  const jetty = lake.jetty;
  if (jetty && stand === lake.angler) {
    const { deck, spec } = jetty;
    const side = spec.width / 2;
    // the right hand of the heading: (sin, -cos)
    out.x = deck.x + deck.inward[0] * spec.length + Math.sin(heading) * side;
    out.y = deck.y + deck.inward[1] * spec.length - Math.cos(heading) * side;
    out.z = (stand.base ?? spec.top) + spec.rail.high;
    return out;
  }
  out.x = stand.x + ux * FORK.ahead;
  out.y = stand.y + uy * FORK.ahead;
  out.z = (stand.base ?? lake.ground(out.x, out.y)) + FORK.high;
  return out;
}

/** Where the propped rod's tip is, written into `out`: `LAZY.rod` from the rest, up at `LAZY.angle` along its heading. */
export function proppedTip<T extends number[] | Float64Array>(rest: Rest, out: T): T {
  const flat = Math.cos(LAZY.angle) * LAZY.rod;
  out[0] = rest.x + Math.cos(rest.heading) * flat;
  out[1] = rest.y + Math.sin(rest.heading) * flat;
  out[2] = rest.z + Math.sin(LAZY.angle) * LAZY.rod;
  return out;
}

/**
 * The bell's placement, written into `out` (one matrix): hung from `tip`, turned by `swing` about the heading's across (so
 * it swings along the rod and never sideways), `size` times the model. Nought for a size of nought, which is how it is
 * hidden in hand.
 */
export function bellMatrix(out: Float32Array, tip: ArrayLike<number>, heading: number, swing: number, size: number) {
  // the rotation about the unit axis (ax, ay, 0), by Rodrigues, columns scaled by the size
  const ax = -Math.sin(heading),
    ay = Math.cos(heading);
  const c = Math.cos(swing),
    s = Math.sin(swing),
    k = 1 - c;
  const column = (o: number, vx: number, vy: number, vz: number) => {
    const dot = ax * vx + ay * vy;
    out[o] = (vx * c + ay * vz * s + ax * dot * k) * size;
    out[o + 1] = (vy * c + -ax * vz * s + ay * dot * k) * size;
    out[o + 2] = (vz * c + (ax * vy - ay * vx) * s) * size;
    out[o + 3] = 0;
  };
  column(0, 1, 0, 0);
  column(4, 0, 1, 0);
  column(8, 0, 0, 1);
  out[12] = tip[0];
  out[13] = tip[1];
  out[14] = tip[2];
  out[15] = 1;
}

/** How wide the bell's model is across its mouth, in its own units: `LAZY.bell` is a share of it. */
export const BELL_UNIT = 8;

/**
 * The bell, built once: a brass cone hanging from its origin with a clapper under its mouth, a few dozen triangles, one
 * group over `matrices` (one placement, which `bellMatrix` writes).
 */
export function bellGroups(matrices: Float32Array): GameGroup[] {
  const mesh = built((b) => {
    frustum(b, at(0, 0, 0), 8, BELL_UNIT / 2, BELL_UNIT / 10, -BELL_UNIT * 0.6, 0);
    frustum(b, at(0, 0, 0), 4, BELL_UNIT / 12, BELL_UNIT / 12, -BELL_UNIT * 0.75, -BELL_UNIT * 0.5, { bottom: true });
  });
  return [{ mesh, matrices, albedo: PALETTE.bell, roughness: 0.35, count: 0 }];
}

/**
 * The forked rest planted in the bank, built once at its true size with its fork at the origin: a post going down past the
 * fork's height into the ground, and two prongs leaning out across the rod's way, painted with the wood's set. One group
 * over `matrices` (one placement, turned to the rod's heading).
 */
export function restGroups(matrices: Float32Array): GameGroup[] {
  const mesh = painted(
    split(
      built((b) => {
        rod(b, [0, 0, -FORK.high - 0.3], [0, 0, 0], 0.1, 4, true);
        for (const side of [-1, 1]) rod(b, [0, 0, -0.1], [0, side * 0.4, 0.45], 0.07, 4);
      }),
    ),
    { set: 1, choice: 'gate' },
  );
  return [{ mesh, matrices, albedo: PALETTE.rod, roughness: 0.8, count: 0 }];
}
