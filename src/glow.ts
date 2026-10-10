/**
 * A fish's glow, drawn on the water over it. Neither way the renderer draws
 * water yet shows what is under it, so the glow is drawn as a soft light on
 * the surface above each fish, brighter and wider the shallower it swims,
 * as `DESIGN.md`'s fallback has it. They are the renderer's effect layers:
 * additive, in the screen's own frame, so they are placed here by the
 * camera, every frame, into a pool sized once.
 *
 * An effect layer is drawn over everything, so a bank between the camera and
 * a fish does not hide its glow. From the lab's views the lake is in the open
 * and nothing stands between; a view along the ground would show it.
 */
import { EFFECT_STRIDE } from 'artshape-render/game/renderer';
import type { Camera } from 'artshape-render/gpu/camera';
import type { School } from './fish';
import { PALETTE } from './palette';

/** How wide a glow is on the water, in world units, over a fish at the surface; and how hard its edge falls off. */
const RADIUS = 2.6;
const SHARP = 1.6;
/** How fast the glow fades and narrows with depth: at this depth, half as bright. */
const HALF_DEPTH = 1.5;

/**
 * Writes the glow over every fish the camera can see into `out`, `EFFECT_STRIDE` floats each, and says how many.
 * `gain` is how bright the time of day makes them.
 */
export function glowQuads(out: Float32Array, fish: School, camera: Camera, gain: number): number {
  const m = camera.viewProjection;
  const focal = 1 / Math.tan((camera.fov * Math.PI) / 360);
  const room = Math.floor(out.length / EFFECT_STRIDE);
  let n = 0;
  for (let i = 0; i < fish.count && n < room; i++) {
    const x = fish.x[i],
      y = fish.y[i];
    // the surface over the fish, in the camera's clip space
    const cx = m[0] * x + m[4] * y + m[12],
      cy = m[1] * x + m[5] * y + m[13],
      w = m[3] * x + m[7] * y + m[15];
    if (w <= 0.1) continue;
    const near = 1 / (1 + fish.depth[i] / HALF_DEPTH);
    const o = n * EFFECT_STRIDE;
    out[o] = cx / w;
    out[o + 1] = cy / w;
    // a world size at a distance, in clip units of the screen's height; a deeper fish's glow spreads less
    out[o + 2] = (RADIUS * (0.6 + 0.4 * near) * focal) / w;
    out[o + 3] = gain * near;
    out[o + 4] = PALETTE.glow[0];
    out[o + 5] = PALETTE.glow[1];
    out[o + 6] = PALETTE.glow[2];
    out[o + 7] = SHARP;
    n++;
  }
  return n;
}
