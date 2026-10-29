/**
 * Column-major 4×4 placements, as WebGPU reads them: element (row r, column
 * c) lives at c * 4 + r, so the translation is the last four floats.
 */

/** A turn about Z, a scale each way, and somewhere to put it. */
export function place(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sx = 1,
  sy = sx,
  sz = sx,
) {
  const o = i * 16;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  out[o] = c * sx;
  out[o + 1] = s * sx;
  out[o + 2] = 0;
  out[o + 3] = 0;
  out[o + 4] = -s * sy;
  out[o + 5] = c * sy;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = 0;
  out[o + 9] = 0;
  out[o + 10] = sz;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

/**
 * A placement with no stretch whose own X lies along (`fx`, `fy`, `fz`) and whose own Y lies as near (`lx`, `ly`,
 * `lz`) as is square to it, at (`px`, `py`, `pz`): a segment of a fish laid along its spine, its left to the fish's
 * left. Its own Z, the back, is X across Y.
 */
export function frame(
  out: Float32Array,
  i: number,
  px: number,
  py: number,
  pz: number,
  fx: number,
  fy: number,
  fz: number,
  lx: number,
  ly: number,
  lz: number,
) {
  const o = i * 16;
  const f = Math.hypot(fx, fy, fz) || 1;
  fx /= f;
  fy /= f;
  fz /= f;
  const d = lx * fx + ly * fy + lz * fz;
  let yx = lx - d * fx,
    yy = ly - d * fy,
    yz = lz - d * fz;
  const l = Math.hypot(yx, yy, yz) || 1;
  yx /= l;
  yy /= l;
  yz /= l;
  out[o] = fx;
  out[o + 1] = fy;
  out[o + 2] = fz;
  out[o + 3] = 0;
  out[o + 4] = yx;
  out[o + 5] = yy;
  out[o + 6] = yz;
  out[o + 7] = 0;
  out[o + 8] = fy * yz - fz * yy;
  out[o + 9] = fz * yx - fx * yz;
  out[o + 10] = fx * yy - fy * yx;
  out[o + 11] = 0;
  out[o + 12] = px;
  out[o + 13] = py;
  out[o + 14] = pz;
  out[o + 15] = 1;
}

/**
 * A placement turned about its own forward axis by `roll`, about its own left by `pitch` and about Z by `yaw`, in that
 * order (so yaw is applied last, to the pitched, rolled solid), at (`x`, `y`, `z`): a boat's heading with its sway. Its
 * own X is forward, Y left and Z up; with no pitch and no roll it is `place` at a scale of one.
 */
export function tilted(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  roll: number,
  scale = 1,
) {
  const o = i * 16;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  out[o] = cy * cp * scale;
  out[o + 1] = sy * cp * scale;
  out[o + 2] = -sp * scale;
  out[o + 3] = 0;
  out[o + 4] = (cy * sp * sr - sy * cr) * scale;
  out[o + 5] = (sy * sp * sr + cy * cr) * scale;
  out[o + 6] = cp * sr * scale;
  out[o + 7] = 0;
  out[o + 8] = (cy * sp * cr + sy * sr) * scale;
  out[o + 9] = (sy * sp * cr - cy * sr) * scale;
  out[o + 10] = cp * cr * scale;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}
