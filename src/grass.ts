/**
 * The banks' grass, as the renderer is handed it: a field over the banks saying where long grass grows and how high
 * the ground is under it, the one kind that grows, the rings it is thinned over and the breeze it bends in. The
 * renderer grows and draws the blades from this and never lists them, so a million of them cost no memory and no time
 * at boot. Without this the banks are a flat painted sheet, which is all they were before the grass came.
 *
 * The kind lives here and not in `lake.ts`, as ooergolf keeps its turf's kinds in its `turf.ts`: it is the grass's
 * own figures, drawn by the renderer, and not the lake's shape. Its colours are the palette's, and the ground painted
 * under the blades (`PALETTE.grass`) is held by a test to the colour they average to. The lake is read, never
 * written: the grass keeps off the water, off the angler's feet and off the boulders by asking the lake's own sums.
 */
import type { GrassField, GrassKind, GrassOptions, Wind } from 'artshape-render/game/grass';
import {
  ANGLER,
  BANK_RISE,
  BANK_TOP,
  CABIN,
  SHORE_RADIUS,
  STRETCH,
  cabinGap,
  groundUnder,
  inShore,
  jettyGap,
  onFace,
  onFall,
} from './lake';
import { PALETTE } from './palette';

/**
 * Long, lush bank grass: taller, wider and sparser blades than golf's turf, in the bank's own green from a dark root
 * to a lighter tip. Chosen from a sheet of mocks on 11 October 2026 (variant d): 1.4 tall and a third more or less, so
 * a bank reads as a meadow and a lake's edge is still seen over it, leaning a little at rest and giving to the wind.
 */
export const LUSH: GrassKind = {
  density: 45,
  height: 1.4,
  heightSpread: 0.35,
  width: 0.16,
  base: PALETTE.bladeBase,
  tip: PALETTE.bladeTip,
  variation: 0.25,
  roughness: 0.9,
  lean: 0.3,
  give: 0.9,
};

/** The seed the blades are grown from: the field's own, so the grass stands still whatever the game's seed. */
export const GRASS_SEED = 1971;
/** A cell is half a unit: fine enough to follow the shore and a boulder's foot, coarse enough that the field is a few hundred a side. */
const CELL = 0.5;
/** How far the grass keeps back from the waterline, so it never leans out over the water or the foam. */
const SHORE_GAP = 0.9;
/** How far the angler's feet are kept clear, as the clumps keep clear. */
const ANGLER_CLEAR = 4;

/**
 * The grass field: half-unit cells over the banks out to the sun's shadow box, grass wherever the ground is dry,
 * a gap from the waterline, and not at the angler's feet, on the cliff's face, under the cabin or on the jetty's shore end; beyond the grid the same grass carries on at the top of
 * the banks to the horizon. The heights are the ground without the boulders, which the banks' sheet is drawn from.
 */
export function bankField(kind: GrassKind = LUSH): GrassField {
  const halfW = (SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH;
  const halfH = SHORE_RADIUS * 1.5 + BANK_RISE;
  const cols = Math.ceil((2 * halfW) / CELL);
  const rows = Math.ceil((2 * halfH) / CELL);
  const mask = new Uint8Array(cols * rows);
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -halfW + (c + 0.5) * CELL;
      const y = -halfH + (r + 0.5) * CELL;
      const i = r * cols + c;
      heights[i] = groundUnder(x, y);
      const dry = !inShore(x, y, -SHORE_GAP);
      const clear = Math.hypot(x - ANGLER.x, y - ANGLER.y) > ANGLER_CLEAR;
      // none on the cliff's face, where the ground leans past the rock slope and the wall is bare rock, and none in a
      // fall's channel, where a blade at the lip would hang over the water
      // none under the cabin's roof or the keep-back round it, and none through the jetty's planks where it starts on the bank
      const built = cabinGap(x, y) < CABIN.clear || jettyGap(x, y) < CABIN.clear;
      mask[i] = dry && clear && !onFace(x, y) && !onFall(x, y) && !built ? 1 : 0;
    }
  return {
    origin: [-halfW, -halfH],
    cell: CELL,
    cols,
    rows,
    mask,
    heights,
    kinds: [kind],
    outside: { kind: 0, height: BANK_TOP },
    seed: GRASS_SEED,
  };
}

/**
 * Every blade inside 36 units, one triangle past 110, none past 300: ooergolf's rings, which were tuned on a
 * course the same size as this pond's banks and keep the blades a frame to what a phone's GPU can draw.
 */
export const GRASS_OPTIONS: GrassOptions = { near: 36, mid: 110, far: 300 };

/**
 * A slow breeze across the lake, a little north of east. The renderer's clock runs at the water's pace
 * (`WATER_PACE`, under one) so the gusts roll by slowly, which suits a calm lake; there is no second clock for the grass.
 */
export const BREEZE: Wind = { direction: [1, 0.3], strength: 0.3, gustSize: 20, gustSpeed: 4 };
