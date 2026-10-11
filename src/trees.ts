/**
 * The lake's trees: the package's low-poly broadleaf and conifer, a few seeded variants of each made once at a height
 * of one so that a placement scales one to any height, and the colour of each part by its name (the generators give
 * none). A tree's variant is picked from a draw of its own, never from its place in a list, so adding or taking away
 * one tree does not change another. Without it each placement would need a mesh built for it, and the variants would
 * drift between the scene, the figures and the tests that all need to know which part is which.
 */
import { broadleaf, conifer, type Scenery } from 'artshape-render/parts/lowpoly';
import type { PALETTE } from './palette';

export type TreeKind = 'broadleaf' | 'conifer';

/** The seeds the variants are cut from: four broadleaves and three conifers, enough that a wood does not repeat itself. */
const BROADLEAF_SEEDS = [1, 2, 3, 4] as const;
const CONIFER_SEEDS = [1, 2, 3] as const;

export const BROADLEAVES: readonly Scenery[] = BROADLEAF_SEEDS.map((seed) => broadleaf({ height: 1, seed }));
export const CONIFERS: readonly Scenery[] = CONIFER_SEEDS.map((seed) => conifer({ height: 1, seed }));
export const VARIANTS: Record<TreeKind, readonly Scenery[]> = { broadleaf: BROADLEAVES, conifer: CONIFERS };

/**
 * The tree a draw `u` in [0, 1) picks: the lower half of the draws a broadleaf and the upper half a conifer (as the
 * kit's trees and pines were half and half), and the variant of that kind by the next share of the draw. Pure, so a
 * test can hold the shares over an even grid.
 */
export function treeFor(u: number): { tree: TreeKind; variant: number } {
  const tree: TreeKind = u < 0.5 ? 'broadleaf' : 'conifer';
  const within = u < 0.5 ? u * 2 : (u - 0.5) * 2;
  const n = VARIANTS[tree].length;
  return { tree, variant: Math.min(n - 1, Math.floor(within * n)) };
}

/** Which palette key each part of a kind is coloured from. The crown is the canopy's top, lit from above, so lighter. */
export const TREE_COLOUR: Record<TreeKind, Record<string, keyof typeof PALETTE>> = {
  broadleaf: { trunk: 'trunk', leaves: 'leaves', crown: 'crown' },
  conifer: { trunk: 'trunk', leaves: 'pine' },
};

/** How rough each part is drawn, as the kit's bark and leaves were: bark matte, leaves a little less. */
export const TREE_ROUGHNESS: Record<TreeKind, Record<string, number>> = {
  broadleaf: { trunk: 0.9, leaves: 0.85, crown: 0.85 },
  conifer: { trunk: 0.9, leaves: 0.85 },
};

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

const BOUNDS = new Map<string, Bounds>();

/** The box round some meshes' vertices. */
function boxOf(parts: { mesh: { positions: ArrayLike<number> } }[]): Bounds {
  const b: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const { mesh } of parts)
    for (let i = 0; i < mesh.positions.length; i++) {
      b.min[i % 3] = Math.min(b.min[i % 3], mesh.positions[i]);
      b.max[i % 3] = Math.max(b.max[i % 3], mesh.positions[i]);
    }
  return b;
}

/** The box a variant fits in at a height of one: scale it by a height, and it is the box that tree takes up. */
export function treeBounds(tree: TreeKind, variant: number): Bounds {
  const key = `${tree}${variant}`;
  let b = BOUNDS.get(key);
  if (!b) BOUNDS.set(key, (b = boxOf(VARIANTS[tree][variant].parts)));
  return b;
}
