/**
 * A lake's dam as a painted mesh (`docs/lakes.md`): the wall along a bank where the Duck Pond has its cliff, built from
 * `lowpoly`'s blocks, one for each bay of the wall with a rib on the face every few of them, a string course and a corbel along it, a parapet along the
 * water side of the walkway and a control hut on it, split so every triangle has its own vertices and painted on the
 * cliff's set (the rocks' way, `rocks.ts`), so the renderer's edge has ridges to stroke. It is one mesh at a scale of
 * one, built once for each lake the first time it is asked for and kept: a mesh is never built in a frame, and the same
 * lake gives the same mesh every time (nothing in it is drawn from chance).
 *
 * A bay stands as high as the highest the ground is anywhere in it, so the ground climbing the wall's stepped ends
 * never shows through it; it is sunk below the water under the face, where the bed is, and its back is the walkway's
 * depth behind the face, where the lawn behind it takes the ground on at the walkway's own height.
 */
import { at, block, built } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import type { Lake } from './lakes/lake';

/** The paint set the wall takes: the cliff's, the third of the look's sets. */
const CLIFF = 2;
/** How far the wall stands over the ground it ends in, so its top and the ground never fight. */
const PROUD = 0.05;

/** The wall's painted mesh, or nothing for a lake with no dam. */
const made = new WeakMap<Lake, ReturnType<typeof painted>>();

export function damMesh(lake: Lake): ReturnType<typeof painted> | null {
  const dam = lake.dam;
  if (!dam) return null;
  const kept = made.get(lake);
  if (kept) return kept;
  const { faceY, half, ends, top, crest, bay, footing, ribEvery, rib, parapet, hut } = dam.spec;
  const place = at(0, 0, 0);
  const reach = half + ends;
  const bays = Math.ceil(reach / bay);
  const mesh = built((b) => {
    for (let i = -bays; i < bays; i++) {
      const x0 = i * bay,
        x1 = x0 + bay;
      // the highest the wall stands in this bay: at the end of it nearer the middle
      const h = top * dam.height(Math.min(Math.abs(x0), Math.abs(x1)));
      if (h < PROUD * 2) continue;
      const z = h + PROUD;
      block(b, place, x0, x1, faceY, faceY + crest, -footing - 8, z);
      // the walkway's parapet along the water side, where the wall is high enough to walk on
      if (h > top * 0.5) block(b, place, x0, x1, faceY, faceY + parapet.thick, z, z + parapet.high);
      // a string course across the face a third of the way up and a corbel under the walkway, each standing out a little, so the face has horizontal lines for the edge to stroke
      if (h > top * 0.5) {
        block(b, place, x0, x1, faceY - 0.2, faceY, h * 0.33, h * 0.33 + 0.5);
        block(b, place, x0, x1, faceY - 0.35, faceY, z - 0.7, z);
      }
      // a rib up the face on every few of the bays, in the middle of the bay
      if (((i % ribEvery) + ribEvery) % ribEvery === 0) {
        const xc = x0 + bay / 2;
        block(b, place, xc - rib.wide / 2, xc + rib.wide / 2, faceY - rib.proud, faceY, -footing - 8, z - 0.6);
      }
    }
    // the control hut on the walkway, at the top of the wall's full height
    block(
      b,
      place,
      hut.x - hut.wide / 2,
      hut.x + hut.wide / 2,
      faceY + parapet.thick + 0.4,
      faceY + crest - 0.4,
      top + PROUD,
      top + PROUD + hut.high,
    );
  });
  const result = painted(split(mesh), { set: CLIFF, choice: 'gate' });
  made.set(lake, result);
  return result;
}
