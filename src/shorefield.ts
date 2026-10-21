/**
 * The lake's shore field: how far each point of the water is from the shore or a boulder, which see-through water's
 * foam is drawn from as lines of even width round every shore and rock. Without it the foam is cut by the depth, and
 * the lake's gently shelving shore wears it as a wide band while a boulder's steep side wears hardly any.
 *
 * Made once, at boot, from the lake's own shape: a grid marked where it is not water, and the exact distance from each
 * texel to the nearest marked one, by Felzenszwalb and Huttenlocher's two passes of the lower envelope of parabolas.
 */
import type { ShoreField } from 'artshape-render/game/shore';
import type { Lake } from './lakes/lake';

/** How many texels the field is along each side: a texel is about a third of a unit, finer than the foam's lines. */
export const SHORE_FIELD_SIZE = 256;

/**
 * The squared distance in one row from each place to the nearest whose `f` is nought, through the lower envelope of the
 * parabolas rooted at each place: `f` in, the squared distances written over it. `step` is the spacing of the places.
 * `v` and `z` are scratch, of the row's length and one more.
 */
function envelope(f: Float64Array, n: number, step: number, v: Int32Array, z: Float64Array, out: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  const s2 = step * step;
  for (let q = 1; q < n; q++) {
    if (f[q] === Infinity) continue;
    for (;;) {
      const p = v[k];
      if (f[p] === Infinity) {
        // nothing before it to meet: it starts the envelope
        v[k] = q;
        z[k] = -Infinity;
        z[k + 1] = Infinity;
        break;
      }
      const s = (f[q] + s2 * q * q - (f[p] + s2 * p * p)) / (2 * s2 * (q - p));
      if (s <= z[k]) {
        if (k === 0) {
          v[0] = q;
          z[0] = -Infinity;
          z[1] = Infinity;
          break;
        }
        k--;
        continue;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
      break;
    }
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    out[q] = f[p] === Infinity ? Infinity : s2 * (q - p) * (q - p) + f[p];
  }
}

/**
 * The distance from each texel of a `w` by `h` grid to the nearest `marked` one, texels `sx` wide and `sy` tall, row by
 * row from the first. Exact, in two passes: along each row, then down each column.
 */
export function distanceTransform(marked: Uint8Array, w: number, h: number, sx: number, sy: number): Float64Array {
  const grid = new Float64Array(w * h);
  const longest = Math.max(w, h);
  const f = new Float64Array(longest),
    out = new Float64Array(longest),
    z = new Float64Array(longest + 1);
  const v = new Int32Array(longest);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) f[i] = marked[j * w + i] ? 0 : Infinity;
    envelope(f, w, sx, v, z, out);
    for (let i = 0; i < w; i++) grid[j * w + i] = out[i];
  }
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) f[j] = grid[j * w + i];
    envelope(f, h, sy, v, z, out);
    for (let j = 0; j < h; j++) grid[j * w + i] = Math.sqrt(out[j]);
  }
  return grid;
}

/**
 * The lake's field over a rectangle round it, a little beyond the shore at its widest: nought on land and on the
 * boulders, and in the water the distance to the nearest of either, taken from texel middles to the edge of the land
 * texel, half a texel nearer than its middle.
 */
export function shoreField(size = SHORE_FIELD_SIZE, lake: Lake): ShoreField {
  const { inside } = lake;
  // the shore's wobbles reach at most a quarter out past its mean, and the field a bank's rise beyond that is plenty
  const halfX = lake.radius * lake.stretch * 1.25 + lake.bankRise * 0.2,
    halfY = lake.radius * 1.25 + lake.bankRise * 0.2;
  const min: [number, number] = [-halfX, -halfY],
    max: [number, number] = [halfX, halfY];
  const sx = (2 * halfX) / size,
    sy = (2 * halfY) / size;
  const land = new Uint8Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++)
      land[j * size + i] = inside(min[0] + (i + 0.5) * sx, min[1] + (j + 0.5) * sy) ? 0 : 1;
  const d = distanceTransform(land, size, size, sx, sy);
  const half = Math.min(sx, sy) / 2;
  const distances = new Float32Array(size * size);
  for (let k = 0; k < distances.length; k++) distances[k] = land[k] ? 0 : Math.max(0, d[k] - half);
  return { size, distances, min, max };
}
