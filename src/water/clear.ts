/**
 * See-through water: the renderer's clear water (`FLOW_CLEAR`, from v0.29.0), drawn after the rest of the lake so
 * what is under it shows through: the bed, its rocks and weeds, and the fish glowing among them. What is below is lost
 * to the deep colour with depth, there is foam where it is thin, glints on the waves and caustics on the shallow bed.
 * The contamination is its colours and how far into it one can see: a sick lake is green and murky, and a clean one
 * a deep azure.
 *
 * Its finish is the pond tuned against the user's reference (an Unreal cartoon water) on 11 October 2026: a flat,
 * saturated blue near the camera with faint, soft ripples on it, a lighter blue far off, swells too low and short to
 * crest, one thin line of foam round every shore and boulder from the lake's shore field (which the page hands the
 * renderer), and three or so big soft glints. The water is clear (a clarity of 0.8, so the deep middle reads a purer blue from above), so the bed, the weed and the fish glowing
 * among them are seen in it. The sky it mirrors is tinted (renderer v0.32.0) but no longer kept near the camera: the flow is finer and gentler (2.4 cells, a tilt of 0.3), and its detail is painted into the body, the
 * fine waves' slopes lifting the water toward a lighter blue (v0.33.0's ripple colour) as the reference's streaks are,
 * and not shown through the mirror. The pace the water moves at is `WATER_PACE`'s, in `lake.ts`.
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
  scale: 2.4,
  speed: 0.12,
  steepness: 0.3,
  clarity: 0.8,
  sickClarity: 0.25,
  caustics: 0.12,
  sickCaustics: 0.5,
  // with the shore field, the foam is one bold line this wide round every shore and boulder (the second line is none),
  // and its edge is crisp, a fiftieth of its width, as an ink line is; the renderer's soft default read as a haze. The
  // renderer can also ring things standing in the water (foamEverywhere), which the lake will want when there is a
  // boat; it is off because the bobber is too small to ring and a full-width band muddies a gently sloping shore.
  foamWidth: 0.3,
  foamSoft: 0.02,
  foamGap: 0.35,
  foamWidth2: 0,
  // the near colour's reach from the camera, so the far water is lighter than the near, and how much of the crest colour the swells' tops take (none)
  nearDistance: 45,
  crestAmount: 0,
  // the sparkles: three in ten of the lattice's cells may (from above that is three big soft stars and not a lattice of hard dots), how nearly a wave must catch the glint, how bright by day, and how big
  sparkles: 0.3,
  sparkleCut: 0.45,
  sparkleBright: 24,
  sparkleSize: 9,
  // a sick lake keeps this share of the sparkles' brightness
  sickSparkles: 0.5,
  // the sky's mirror: the share of it the camera keeps near, and its strength against the renderer's own (its tint is `PALETTE.mirrorTint`)
  mirrorNear: 0,
  mirror: 1.2,
  // the fine waves' lightening of the body: how much, and how steep a slope must be before it takes any (its colour is `PALETTE.rippleLight`)
  rippleAmount: 0.3,
  rippleCut: 0.4,
  // the scene in the mirror (renderer v0.39.0): the falls, the rocks, the jetty and the cliff in the water as well as
  // the sky, chosen from the sheets of 13 October 2026 (docs/crystal.md); the surface lies at nought, so the plane is the
  // renderer's own, and the swells shift what is seen by this share of the screen, the figure those sheets were taken at
  mirrorDistort: 0.08,
} as const;

/** The four short, low swells, a centimetre or so high, from four ways, the longest the highest: too small to crest. */
export const CLEAR_WAVES: readonly GerstnerWave[] = [
  { direction: 1.2, wavelength: 3, amplitude: 0.012, steepness: 0.38 },
  { direction: 2.1, wavelength: 2, amplitude: 0.008, steepness: 0.38 },
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
      foamSoft: CLEAR.foamSoft,
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
      mirrorScene: true,
      mirrorDistort: CLEAR.mirrorDistort,
      ripple: PALETTE.rippleLight,
      rippleAmount: CLEAR.rippleAmount,
      rippleCut: CLEAR.rippleCut,
    };
  },
};
