/**
 * See-through water: the renderer's clear water (`FLOW_CLEAR`, from v0.29.0), drawn after the rest of the lake so
 * what is under it shows through: the bed, its rocks and weeds, and the fish glowing among them. What is below is lost
 * to the deep colour with depth, there is foam where it is thin, glitter on the waves and caustics on the shallow bed.
 * The contamination is its colours and how far into it one can see: a sick lake is green and murky, and a clean one
 * clear blue-teal, as the sheets chosen from on 10 October 2026 had it at a clarity of 1.6.
 *
 * Its finish is v0.30.0's, as sheet D beside the target picture had it on 10 October 2026: a richer blue lightening
 * toward the camera, four gentle swells with lighter crests, round soft sparkles in place of the glitter's dashes, and
 * lines of foam round every shore and boulder from the lake's shore field, which the page hands the renderer.
 */
import { FLOW_CLEAR, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import type { GerstnerWave } from 'artshape-render/game/waves';
import { PALETTE, mix } from '../palette';
import type { WaterStyle } from './styles';
import { AT_ORIGIN, surface } from './surface';

/**
 * The waves (open water's, gentler, so the bed reads through them), how clear the water is when clean and how much of
 * that a sick lake keeps, the caustics' strength when clean and what share of it a sick lake keeps, and the foam's depth.
 */
export const CLEAR = {
  scale: 0.35,
  speed: 0.55,
  steepness: 0.12,
  clarity: 1.6,
  sickClarity: 0.25,
  caustics: 0.6,
  sickCaustics: 0.5,
  // with the shore field, the foam is a line this wide round every shore and boulder, a gap, and a second thinner line
  foamWidth: 0.35,
  foamGap: 0.4,
  foamWidth2: 0.2,
  // the near colour's reach from the camera, and how much of the crest colour the swells' tops take
  nearDistance: 18,
  crestAmount: 0.4,
  // the sparkles: all the lattice's cells may, how nearly a wave must catch the glint, how bright by day, and how big
  sparkles: 1,
  sparkleCut: 0.4,
  sparkleBright: 8,
  sparkleSize: 4,
  // a sick lake keeps this share of the sparkles' brightness
  sickSparkles: 0.5,
} as const;

/** The four gentle swells, a few centimetres high, from four ways, the longest the highest. */
export const CLEAR_WAVES: readonly GerstnerWave[] = [
  { direction: 1.2, wavelength: 9, amplitude: 0.09, steepness: 0.3 },
  { direction: 2.1, wavelength: 6, amplitude: 0.05, steepness: 0.25 },
  { direction: 0.6, wavelength: 4, amplitude: 0.03, steepness: 0.2 },
  { direction: 1.7, wavelength: 14, amplitude: 0.1, steepness: 0.15 },
];

const held = (v: number) => Math.min(1, Math.max(0, v));

export const clear: WaterStyle = {
  name: 'clear',
  label: 'See-through',
  surfaceGlow: false,
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
    };
  },
};
