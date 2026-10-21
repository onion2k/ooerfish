/**
 * A point on the screen carried out into the world to where it meets the water's surface: what a tap on the lake
 * means. Pure, handed the inverse of the camera's view and projection, so it is tested without a page.
 */

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
