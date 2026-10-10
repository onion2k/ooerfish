/**
 * The lake as it is drawn: its bed and banks, the stones along its shore and
 * the puffball trees on its banks, which do not move; and the water, drawn
 * whichever way the lab says. It is handed what it draws from, and never the
 * renderer: the page hands the groups on.
 *
 * Where the stones and trees stand is fixed, from a seed of its own and not
 * the game's, so the lake is the same lake every run and on every seed.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { BANK_RISE, SHORE_RADIUS, STRETCH, ground, shoreRadius } from './lake';
import { place } from './matrix';
import { ball, box, sheet } from './meshes';
import { PALETTE } from './palette';
import { seeded } from './random';

/** How far out the banks are drawn, as a share of the shore's distance: past where the camera sees, so no edge shows. */
const BANKS_TO = 12;
/** How many stones line the shore, and how many trees stand on the banks. */
const STONES = 70;
const TREES = 26;
/** The seed the stones and trees are placed from: the lake's own, so they stand still whatever the game's seed. */
const SCENERY_SEED = 1971;

/** Where a ring `k` of the way out from the middle is, at an angle, on the lake's own stretched shape. */
function ring(k: number, angle: number): [number, number] {
  const r = k * shoreRadius(angle);
  return [Math.cos(angle) * r * STRETCH, Math.sin(angle) * r];
}

export class Scene {
  /** What does not move. */
  static(): GameGroup[] {
    const random = seeded(SCENERY_SEED);
    // the bed and the banks, one height in two sheets of two colours, meeting under the water at the shore
    const bed = sheet(ring, ground, 0, 1.04, 28, 160);
    const banks = sheet(ring, ground, 0.98, BANKS_TO, 40, 160);
    const one = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    // stones along the water's edge, half sunk, of a few sizes
    const stones = new Float32Array(STONES * 16);
    for (let i = 0; i < STONES; i++) {
      const angle = ((i + random() * 0.6) / STONES) * Math.PI * 2;
      const [x, y] = ring(1.005 + random() * 0.02, angle);
      const size = 0.6 + random() * 0.7;
      place(stones, i, x, y, ground(x, y) - size * 0.25, random() * Math.PI, size * 1.3, size, size * 0.7);
    }

    // puffball trees on the banks, out of the way of the shore's view across the water
    const trunks = new Float32Array(TREES * 16),
      puffs = new Float32Array(TREES * 16);
    for (let i = 0; i < TREES; i++) {
      const angle = ((i + random() * 0.8) / TREES) * Math.PI * 2;
      // none on the near bank the camera stands on, south of the middle
      const along = Math.sin(angle) < -0.55 ? 2.6 + random() * 1.5 : 1.3 + random() * 0.9;
      const [x, y] = ring(along, angle);
      const z = ground(x, y);
      const tall = 3 + random() * 3;
      place(trunks, i, x, y, z, 0, 1, 1, tall);
      place(puffs, i, x, y, z + tall + 2.2, random() * Math.PI, 1, 1, 0.9);
    }

    return [
      { mesh: bed, matrices: one, albedo: PALETTE.bed, roughness: 0.95 },
      { mesh: banks, matrices: one, albedo: PALETTE.grass, roughness: 0.9 },
      { mesh: ball(1, 4, 7), matrices: stones, albedo: PALETTE.stone, roughness: 0.8 },
      { mesh: box(0.7, 0.7, 1), matrices: trunks, albedo: PALETTE.trunk, roughness: 0.9 },
      { mesh: ball(3.2, 5, 9), matrices: puffs, albedo: PALETTE.leaves, roughness: 0.85 },
    ];
  }
}

/** What the sun's shadow is fitted to: the lake and the banks round it, up to the tallest tree. */
export const SHADOW_BOX = {
  min: [-(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, -(SHORE_RADIUS * 1.5 + BANK_RISE), -8] as [number, number, number],
  max: [(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, SHORE_RADIUS * 1.5 + BANK_RISE, 16] as [number, number, number],
};
