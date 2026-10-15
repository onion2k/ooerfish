/**
 * A splash's ripples as the water is handed them: where each splash landed, how long ago and how big, written each
 * frame into an array sized once, for the renderer's clear water to carry out across the water as rings in its own
 * surface. Without it the water would not know where anything had landed, and a splash would be its droplets alone.
 * Pure, so what is handed over is tested without drawing it.
 */
import type { Splashes } from './splash';

/** How many floats a ripple is handed over in, as the renderer reads them: x, y, age and size. */
export const RIPPLE_FLOATS = 4;

/**
 * Every splash in the pool at time `t` whose ripples are not yet over, which they are at `life` seconds old, written
 * into `out` in the pool's order as x, y, age and size; says how many. Nothing past them is written or made.
 */
export function rippleData(splashes: Splashes, t: number, life: number, out: Float32Array): number {
  let n = 0;
  for (let i = 0; i < splashes.count; i++) {
    const age = splashes.age(i, t);
    if (!(age >= 0 && age < life)) continue;
    const o = n++ * RIPPLE_FLOATS;
    out[o] = splashes.x[i];
    out[o + 1] = splashes.y[i];
    out[o + 2] = age;
    out[o + 3] = splashes.size[i];
  }
  return n;
}
