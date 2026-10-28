/**
 * A point on the screen carried out into the world to where it meets the water's surface: what a tap on the lake
 * means. Pure, handed the inverse of the camera's view and projection, so it is tested without a page.
 */
import type { Lake } from './lakes/lake';
import { tableBox } from './cabinroom';

/** The ray through the screen's point (`ndcX`, `ndcY`, from minus one to one, up positive): where it is on the near plane and on the far one. */
export function rayThrough(
  inverse: Float32Array,
  ndcX: number,
  ndcY: number,
): { near: [number, number, number]; far: [number, number, number] } {
  const at = (z: number): [number, number, number] => {
    const m = inverse;
    const x = m[0] * ndcX + m[4] * ndcY + m[8] * z + m[12],
      y = m[1] * ndcX + m[5] * ndcY + m[9] * z + m[13],
      zz = m[2] * ndcX + m[6] * ndcY + m[10] * z + m[14],
      w = m[3] * ndcX + m[7] * ndcY + m[11] * z + m[15];
    return [x / w, y / w, zz / w];
  };
  return { near: at(0), far: at(1) };
}

/** Where the screen's point (`ndcX`, `ndcY`, from minus one to one, up positive) meets the water; null if it never does. */
export function waterPoint(inverse: Float32Array, ndcX: number, ndcY: number): [number, number] | null {
  // the ray from the near plane to the far one, through the point
  const { near, far } = rayThrough(inverse, ndcX, ndcY);
  const dz = far[2] - near[2];
  // a ray that does not come down to the water, or meets it behind the camera, meets nothing
  if (dz >= 0 || near[2] <= 0) return null;
  const k = -near[2] / dz;
  if (k > 1) return null;
  return [near[0] + (far[0] - near[0]) * k, near[1] + (far[1] - near[1]) * k];
}

/**
 * Whether the screen's point (`ndcX`, `ndcY`, from minus one to one, up positive) falls on the cabin: the ray through it,
 * carried into the cabin's own frame, against the box of its walls and roof (the body's footprint grown by the roof's
 * overhang, from the floor to the ridge). A lake with no cabin has nothing to tap.
 */
export function cabinHit(ndcX: number, ndcY: number, inverse: Float32Array, lake: Lake): boolean {
  if (!lake.cabin) return false;
  const { spec, at, floor } = lake.cabin;
  const { near, far } = rayThrough(inverse, ndcX, ndcY);
  const toLocal = (p: [number, number, number]): [number, number, number] => {
    const dx = p[0] - at.x,
      dy = p[1] - at.y;
    return [dx * at.inward[0] + dy * at.inward[1], dx * at.along[0] + dy * at.along[1], p[2]];
  };
  const a = toLocal(near),
    b = toLocal(far);
  const ridge = (spec.body.across / 2 + spec.roof.overhang) * Math.tan(spec.roof.pitch);
  const lo = [-(spec.body.across / 2 + spec.roof.overhang), -(spec.body.along / 2 + spec.roof.overhang), floor];
  const hi = [
    spec.body.across / 2 + spec.roof.overhang,
    spec.body.along / 2 + spec.roof.overhang,
    floor + spec.body.high + ridge,
  ];
  // the slab test along the segment from the near plane (0) to the far (1)
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const d = b[axis] - a[axis];
    if (d === 0) {
      if (a[axis] < lo[axis] || a[axis] > hi[axis]) return false;
      continue;
    }
    const k1 = (lo[axis] - a[axis]) / d,
      k2 = (hi[axis] - a[axis]) / d;
    enter = Math.max(enter, Math.min(k1, k2));
    leave = Math.min(leave, Math.max(k1, k2));
    if (enter > leave) return false;
  }
  return true;
}

/**
 * Whether the screen's point falls on the table in the cabin: the ray through it carried into the cabin's frame, against
 * the table's box (its top and legs, which the post lies on). A lake with no cabin has no table.
 */
export function tableHit(ndcX: number, ndcY: number, inverse: Float32Array, lake: Lake): boolean {
  if (!lake.cabin) return false;
  const { at } = lake.cabin;
  const { lo, hi } = tableBox(lake);
  const { near, far } = rayThrough(inverse, ndcX, ndcY);
  const toLocal = (p: [number, number, number]): [number, number, number] => {
    const dx = p[0] - at.x,
      dy = p[1] - at.y;
    return [dx * at.inward[0] + dy * at.inward[1], dx * at.along[0] + dy * at.along[1], p[2]];
  };
  const a = toLocal(near),
    b = toLocal(far);
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const d = b[axis] - a[axis];
    if (d === 0) {
      if (a[axis] < lo[axis] || a[axis] > hi[axis]) return false;
      continue;
    }
    const k1 = (lo[axis] - a[axis]) / d,
      k2 = (hi[axis] - a[axis]) / d;
    enter = Math.max(enter, Math.min(k1, k2));
    leave = Math.min(leave, Math.max(k1, k2));
    if (enter > leave) return false;
  }
  return true;
}
