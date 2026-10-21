/**
 * The water's surface, as a mesh: the lake's own shape, a little past the
 * shore so the bank rising out of it draws the water's edge, at the water's
 * level. Built once and shared by every way of drawing the water, since a
 * style is switched by handing the renderer its groups again, and the mesh
 * need not be made again with them.
 *
 * The swells are worked out only at its corners, so a swell shorter than
 * about twice the distance between them is not seen travelling: the near
 * water pulses all together at its beat (docs/crystal.md, part 12's films).
 * A sheet that fine all over costs most of a millisecond a frame, so it is
 * fine only where the shore view looks closest, within `SURFACE.near` of the
 * camera's place on the ground, and as coarse as it was elsewhere. It stays
 * one sheet of rings and segments, the fine rings running all the way round
 * and the fine angles all the way in, so no corner sits in the middle of
 * another's edge and no crack opens where the swells move them apart.
 */
import type { Mesh } from 'artshape-render/mesh/types';
import type { Lake } from '../lakes/lake';
import { sheet } from '../meshes';

/** How far past the shore the surface reaches, as a share of the way out: under the bank, so no gap shows at the edge. */
const PAST_SHORE = 1.08;
/**
 * The side of a fine cell as a share of the spacing: the longest edge of a cell is its diagonal, so with sides a little
 * under one over the root of two of the spacing, no edge of a triangle is longer than the spacing.
 */
const SIDE = 0.68;
/** How finely the sheet is searched for where it comes near the camera, in steps of the way out and round. */
const SEARCH = { out: 400, round: 2048 } as const;
/**
 * How far past the reach the sheet is made fine, in world units: the widest of the old coarse cells, so an edge from a
 * corner within the reach never runs into a coarse cell beyond it.
 */
const MARGIN = 4.5;
/** Two angles this close are the same angle: the coarse ones are sums, and a sum can miss its mark by a hair. */
const SAME = 1e-9;

/** Where on a lake's sheet a share `k` of the way out at an angle is, in the world's own units. */
function atOn(lake: Lake): (k: number, angle: number) => [number, number] {
  return (k, angle) => {
    const r = k * lake.shoreRadius(angle);
    return [Math.cos(angle) * r * lake.stretch, Math.sin(angle) * r];
  };
}

/** The Shore view's camera's place on the ground, by the orbit's own sum (artshape-render's `gpu/camera.ts`). */
export function shoreCamera(lake: Lake): [number, number] {
  const v = lake.views.shore;
  const across = v.radius * Math.sin(v.polar);
  return [v.x + across * Math.cos(v.azimuth), v.y + across * Math.sin(v.azimuth)];
}

/** What the sheet's layout is made from: the lake's `surface` figures, unless a test hands it others. */
export type SurfaceFigures = { rings: number; segments: number; spacing: number; near: number };

/** The rings' distances out and the corners' angles round: coarse as the sheet always was, and fine near the camera. */
export function surfaceLayout(lake: Lake, given?: SurfaceFigures): { rings: number[]; angles: number[] } {
  const figures = given ?? lake.surface;
  const at = atOn(lake);
  const [cx, cy] = shoreCamera(lake);
  // where the sheet comes within reach: the least share of the way out, the angles either side, and how far apart a
  // step out and a step round put two corners there at the most, so the fine steps can be sized from it
  let kFrom = PAST_SHORE,
    aFrom = Infinity,
    aTo = -Infinity,
    perK = 0,
    perA = 0;
  const dk = PAST_SHORE / SEARCH.out,
    da = (Math.PI * 2) / SEARCH.round;
  for (let j = 0; j < SEARCH.round; j++) {
    const a = j * da;
    for (let i = 0; i <= SEARCH.out; i++) {
      const k = i * dk;
      const [x, y] = at(k, a);
      if (Math.hypot(x - cx, y - cy) > figures.near + MARGIN) continue;
      kFrom = Math.min(kFrom, k);
      aFrom = Math.min(aFrom, a);
      aTo = Math.max(aTo, a);
      const [xo, yo] = at(k + dk, a),
        [xr, yr] = at(k, a + da);
      perK = Math.max(perK, Math.hypot(xo - x, yo - y) / dk);
      perA = Math.max(perA, Math.hypot(xr - x, yr - y) / da);
    }
  }
  if (aTo < aFrom) throw new Error(`a near of ${figures.near} reaches none of the water from the Shore view's camera`);
  const side = figures.spacing * SIDE;
  // the rings: the coarse ones packed toward the middle as they always were, up to the last one short of the near
  // water (the middle, at the least, where the near water reaches it), then evenly at the fine step out to the edge
  const coarse = Array.from({ length: figures.rings + 1 }, (_, i) => PAST_SHORE * (i / figures.rings) ** 1.5);
  const rings = [0, ...coarse.slice(1).filter((k) => k < kFrom)];
  const start = rings.at(-1)!;
  const outSteps = Math.ceil(((PAST_SHORE - start) * perK) / side);
  for (let i = 1; i <= outSteps; i++) rings.push(start + ((PAST_SHORE - start) * i) / outSteps);
  // the angles: evenly round as they always were, and between the coarse ones either side of the near water evenly at
  // the fine step
  const step = (Math.PI * 2) / figures.segments;
  const lo = Math.floor(aFrom / step) * step,
    hi = Math.min(Math.ceil(aTo / step) * step, Math.PI * 2);
  const roundSteps = Math.ceil(((hi - lo) * perA) / side);
  const angles: number[] = [];
  for (let j = 0; j <= figures.segments; j++) {
    const a = (j / figures.segments) * Math.PI * 2;
    if (Math.abs(a - lo) < SAME) for (let i = 0; i < roundSteps; i++) angles.push(lo + ((hi - lo) * i) / roundSteps);
    else if (a < lo || a > hi - SAME) angles.push(a);
  }
  return { rings, angles };
}

const made = new WeakMap<Lake, Mesh>();

/** The surface of a lake, made the first time it is asked for and kept for that lake. */
export function surface(lake: Lake): Mesh {
  let kept = made.get(lake);
  if (kept) return kept;
  const { rings, angles } = surfaceLayout(lake, lake.surface);
  kept = sheet(atOn(lake), () => 0, 0, PAST_SHORE, rings, angles);
  made.set(lake, kept);
  return kept;
}

/** One placement where the mesh was built: the surface is laid out in the world's own units. */
export const AT_ORIGIN = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
