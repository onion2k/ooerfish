/**
 * See-through water: the renderer's clear water (`FLOW_CLEAR`, from v0.29.0), drawn after the rest of the lake so
 * what is under it shows through: the bed, its rocks and weeds, and the fish glowing among them. What is below is lost
 * to the deep colour with depth, there is foam where it is thin, glints on the waves and caustics on the shallow bed.
 * The contamination is its colours and how far into it one can see: a sick lake is green and murky, and a clean one
 * a deep azure.
 *
 * Its finish is the calm painted pond's, tuned toward the reference picture on 11 October 2026: a fine, slow flow, a
 * deep blue that is the near water too right across the pond, swells too low and short to crest, one thin line of foam
 * round every shore and boulder from the lake's shore field (which the page hands the renderer), and a few big soft
 * glints. Because that blue is dark, the sky's mirror would be eased away by the camera and the water would read flat;
 * so, with renderer v0.32.0's mirror, the sky it shows is tinted a light cyan and a good share of it is kept near the
 * camera. The pace the water moves at is `WATER_PACE`'s, in `lake.ts`.
 */
import { FLOW_CLEAR, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import type { GerstnerWave } from 'artshape-render/game/waves';
import { PALETTE, mix } from '../palette';
import type { WaterStyle } from './styles';
import { AT_ORIGIN, surface } from './surface';

/**
 * The flow's scale (cells to a world unit), speed and tilt; how clear the water is when clean and how much of that a
 * sick lake keeps; the caustics' strength when clean and what share of it a sick lake keeps; and the foam's depth.
 */
export const CLEAR = {
  scale: 1.2,
  speed: 0.12,
  steepness: 0.8,
  clarity: 0.4,
  sickClarity: 0.25,
  caustics: 0.2,
  sickCaustics: 0.5,
  // with the shore field, the foam is a line this wide round every shore and boulder, a gap, and a second thinner line
  foamWidth: 0.3,
  foamGap: 0.35,
  foamWidth2: 0.1,
  // the near colour's reach from the camera, which is nearly all the pond, and how much of the crest colour the swells' tops take (none)
  nearDistance: 90,
  crestAmount: 0,
  // the sparkles: all the lattice's cells may, how nearly a wave must catch the glint, how bright by day, and how big
  sparkles: 1,
  sparkleCut: 0.3,
  sparkleBright: 16,
  sparkleSize: 5,
  // a sick lake keeps this share of the sparkles' brightness
  sickSparkles: 0.5,
  // the sky's mirror: the share of it the camera keeps near, and its strength against the renderer's own (its tint is `PALETTE.mirrorTint`)
  mirrorNear: 0.4,
  mirror: 1,
} as const;

/** The four short, low swells, a centimetre or so high, from four ways, the longest the highest: too small to crest. */
export const CLEAR_WAVES: readonly GerstnerWave[] = [
  { direction: 1.2, wavelength: 3, amplitude: 0.012, steepness: 0.2 },
  { direction: 2.1, wavelength: 2, amplitude: 0.008, steepness: 0.2 },
  { direction: 0.6, wavelength: 1.5, amplitude: 0.005, steepness: 0.15 },
  { direction: 1.7, wavelength: 4, amplitude: 0.012, steepness: 0.1 },
];

const held = (v: number) => Math.min(1, Math.max(0, v));

export const clear: WaterStyle = {
  name: 'clear',
  label: 'See-through',
  waves: CLEAR_WAVES,
  groups(contamination) {
    const k = held(contamination);
    const patterns = packFlow(new Float32Array(PATTERN_STRIDE), 0, {
      kind: FLOW_CLEAR,
      scale: CLEAR.scale,
      speed: CLEAR.speed,
      glow: CLEAR.steepness,
      second: mix(PALETTE.clearDeep, PALETTE.sickDeep, k),
    });
    return [
      {
        mesh: surface(),
        matrices: AT_ORIGIN,
        albedo: mix(PALETTE.clearShallow, PALETTE.sickShallow, k),
        roughness: 0.1,
        patterns,
      },
    ];
  },
  clear(contamination, caustics, time) {
    const k = held(contamination);
    return {
      clarity: CLEAR.clarity * (1 - (1 - CLEAR.sickClarity) * k),
      foamWidth: CLEAR.foamWidth,
      foamGap: CLEAR.foamGap,
      foamWidth2: CLEAR.foamWidth2,
      // the sparkles stand in for the glitter, by the time of day as it did
      glitter: 0,
      caustics: caustics ? CLEAR.caustics * (1 - (1 - CLEAR.sickCaustics) * k) : 0,
      waves: CLEAR_WAVES,
      near: mix(PALETTE.clearNear, PALETTE.sickNear, k),
      nearDistance: CLEAR.nearDistance,
      crest: PALETTE.crest,
      crestAmount: CLEAR.crestAmount,
      sparkles: CLEAR.sparkles,
      sparkleCut: CLEAR.sparkleCut,
      sparkleBright: CLEAR.sparkleBright * time.glitter * (1 - (1 - CLEAR.sickSparkles) * k),
      sparkleSize: CLEAR.sparkleSize,
      mirrorTint: PALETTE.mirrorTint,
      mirrorNear: CLEAR.mirrorNear,
      mirror: CLEAR.mirror,
    };
  },
};
