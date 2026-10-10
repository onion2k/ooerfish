/**
 * The water's surface, as a mesh: the lake's own shape, a little past the
 * shore so the bank rising out of it draws the water's edge, at the water's
 * level. Built once and shared by every way of drawing the water, since a
 * style is switched by handing the renderer its groups again, and the mesh
 * need not be made again with them.
 */
import type { Mesh } from 'artshape-render/mesh/types';
import { STRETCH, shoreRadius } from '../lake';
import { sheet } from '../meshes';

/** How far past the shore the surface reaches, as a share of the way out: under the bank, so no gap shows at the edge. */
const PAST_SHORE = 1.08;

let made: Mesh | null = null;

/** The surface, made the first time it is asked for. */
export function surface(): Mesh {
  made ??= sheet(
    (k, angle) => {
      const r = k * shoreRadius(angle);
      return [Math.cos(angle) * r * STRETCH, Math.sin(angle) * r];
    },
    () => 0,
    0,
    PAST_SHORE,
    24,
    128,
  );
  return made;
}

/** One placement where the mesh was built: the surface is laid out in the world's own units. */
export const AT_ORIGIN = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
