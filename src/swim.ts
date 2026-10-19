/**
 * A fish's body posed along its spine: where each joint is, nose to the end of the tail's stalk, for a fish at a
 * place, heading and pitch, bent by its turn and flexed by its stroke. The renderer has no skinning, so a fish is a
 * chain of rigid segments, and this is what says where each one lies; the drawing and the invariants both read it,
 * so what is checked is what is drawn.
 *
 * The stroke is a wave travelling back along the body, its swing growing toward the tail, and the turn an arc the
 * body lies on. Each joint is a segment's length from the one before, however it is bent, so the segments always
 * join. Pure sums, from the figures handed in: nothing here is content, and nothing is made each call.
 */
import type { School } from './fish';

/** The figures a pose is made from, as `SWIM` in `lake.ts` has them. */
export interface SwimShape {
  readonly segments: readonly (readonly [number, number, number])[];
  readonly tail: { readonly length: number };
  readonly top: number;
  readonly amp: number;
  readonly floor: number;
  readonly wavelength: number;
  readonly bend: number;
  readonly pitch: number;
  readonly maxPitch: number;
}

/** The most joints a fish may have, which sizes the scratch once. */
const MOST = 16;
const along = new Float64Array(MOST);
const side = new Float64Array(MOST);

/** A fish's length, nose to the tip of its tail. */
export function bodyLength(shape: Pick<SwimShape, 'segments' | 'tail'>): number {
  let length = shape.tail.length;
  for (const s of shape.segments) length += s[0];
  return length;
}

/**
 * The spine of a fish into `out`, three floats a joint, nose first. The point `anchor` back from the nose along the
 * body is put at (`x`, `y`, `z`); the nose points along `heading`, tilted up by `pitch`; `curvature` bends it into
 * the arc of a turn (positive to its left), and the wave swings it by `amp` of its length at the tail at `phase`.
 * `scale` is the fish's size against the shape's: every segment is that much longer, so a pike's joints lie further
 * apart than a bream's, and `anchor` is in world units, already scaled.
 */
export function pose(
  out: Float64Array,
  shape: SwimShape,
  x: number,
  y: number,
  z: number,
  heading: number,
  pitch: number,
  curvature: number,
  phase: number,
  amp: number,
  anchor: number,
  scale = 1,
) {
  const segs = shape.segments;
  const n = segs.length + 1;
  const length = bodyLength(shape) * scale;
  // the chain laid out flat: how far back along the heading each joint is, and how far to the left
  along[0] = 0;
  side[0] = lateral(shape, 0, length, anchor, curvature, phase, amp);
  let d = 0;
  for (let k = 0; k < n - 1; k++) {
    const len = segs[k][0] * scale;
    d += len;
    // the swing a joint wants, held short of a segment's own length so a wild pose still has a segment to lie along
    const want = lateral(shape, d, length, anchor, curvature, phase, amp) - side[k];
    const dy = Math.max(-0.9 * len, Math.min(0.9 * len, want));
    side[k + 1] = side[k] + dy;
    along[k + 1] = along[k] + Math.sqrt(len * len - dy * dy);
  }
  // the anchor found along the chain, between the joints either side of it, so it can be put where the fish is
  let k = 0,
    from = 0;
  while (k < n - 2 && from + segs[k][0] * scale < anchor) from += segs[k++][0] * scale;
  const t = (anchor - from) / (segs[k][0] * scale);
  const a0 = along[k] + (along[k + 1] - along[k]) * t,
    s0 = side[k] + (side[k + 1] - side[k]) * t;
  const ch = Math.cos(heading),
    sh = Math.sin(heading),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const fx = ch * cp,
    fy = sh * cp,
    fz = sp;
  for (let j = 0; j < n; j++) {
    const back = along[j] - a0,
      left = side[j] - s0;
    out[j * 3] = x - fx * back - sh * left;
    out[j * 3 + 1] = y - fy * back + ch * left;
    out[j * 3 + 2] = z - fz * back;
  }
}

/** How far to the left a point `d` back from the nose wants to be: the wave's swing there, and the turn's arc. */
function lateral(
  shape: SwimShape,
  d: number,
  length: number,
  anchor: number,
  curvature: number,
  phase: number,
  amp: number,
): number {
  const u = d / length;
  const envelope = shape.floor + (1 - shape.floor) * u * u;
  const wave = amp * length * envelope * Math.sin(phase - (2 * Math.PI * u) / shape.wavelength);
  const off = d - anchor;
  return wave + (curvature * off * off) / 2;
}

/**
 * Fish `i` of the school posed as it swims, its head's back where the school has it, `bed(x, y)` deep being the water
 * at a point. A fish in the shallows is drawn deep enough to keep its dorsal fin under the surface where the water
 * under it allows; it pitches no further than keeps its nose and tail in the water; and where the bed rises under its
 * body, behind it or to the side as it bends, the whole of it is drawn lifted clear, never out of the water. Every
 * joint over the water is drawn in it, below the surface and above the bed. `scale` is the fish's kind's size, the
 * shape's lengths and its fin's depth all that much more.
 */
export function poseFish(
  out: Float64Array,
  shape: SwimShape,
  school: School,
  i: number,
  bed: (x: number, y: number) => number,
  scale = 1,
) {
  const anchor = shape.segments[0][0] * scale;
  const length = bodyLength(shape) * scale;
  const x = school.x[i],
    y = school.y[i];
  const under = bed(x, y);
  const depth = Math.max(school.depth[i], Math.min(shape.top * scale, under - 0.3));
  const pace = school.pace[i],
    vigour = school.vigour[i];
  // a fish standing still barely flexes, and a hooked one pulling flexes harder than it swims
  const amp = shape.amp * Math.min(1, 0.4 + pace / 1.5) * (1 + (vigour - 1) * 0.6);
  const curvature = Math.max(-1.2, Math.min(1.2, (shape.bend * school.turn[i]) / Math.max(pace, 0.8)));
  const room = Math.max(0, Math.min(depth, under - depth) - CLEAR);
  const most = Math.min(shape.maxPitch, Math.asin(Math.min(1, room / (length - anchor))));
  const pitch = Math.max(-most, Math.min(most, -shape.pitch * school.rise[i]));
  pose(out, shape, x, y, -depth, school.heading[i], pitch, curvature, school.phase[i], amp, anchor, scale);
  // the most any joint is into the bed under it, and the least any is under the surface: lifted by the one, held to the other
  let into = 0,
    below = Infinity;
  for (let k = 0; k < out.length; k += 3) {
    into = Math.max(into, -out[k + 2] - (bed(out[k], out[k + 1]) - CLEAR));
    below = Math.min(below, -out[k + 2] - CLEAR);
  }
  const lift = Math.max(0, Math.min(into, below));
  if (lift > 0) for (let k = 2; k < out.length; k += 3) out[k] += lift;
  // and where the water is too shallow for that, on a beach a few centimetres deep where a fish may still swim, each
  // joint is held in the water at its own point, at half its depth at the shallowest: the body bends a few centimetres
  // over the sand rather than through it
  for (let k = 0; k < out.length; k += 3) {
    const water = bed(out[k], out[k + 1]);
    if (!(water > 0)) continue;
    const top = Math.min(CLEAR, water / 2),
      bottom = Math.max(water - CLEAR, water / 2);
    out[k + 2] = -Math.min(bottom, Math.max(top, -out[k + 2]));
  }
}

/** How near the bed or the surface a fish's spine is drawn, at the nearest. */
const CLEAR = 0.05;
