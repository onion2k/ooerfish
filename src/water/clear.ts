/**
 * See-through water: the renderer's clear water (`FLOW_CLEAR`, from v0.29.0), drawn after the rest of the lake so
 * what is under it shows through: the bed, its rocks and weeds, and the fish glowing among them. What is below is lost
 * to the deep colour with depth, there is foam where it is thin, glitter on the waves and caustics on the shallow bed.
 * The contamination is its colours and how far into it one can see: a sick lake is green and murky, and a clean one
 * clear blue-teal, as the sheets chosen from on 10 October 2026 had it at a clarity of 1.6.
 */
import { FLOW_CLEAR, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
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
  // the lake's shallows shelve gently, so a third of the renderer's default depth of foam is the same thin line
  foamWidth: 0.1,
} as const;

const held = (v: number) => Math.min(1, Math.max(0, v));

export const clear: WaterStyle = {
  name: 'clear',
  label: 'See-through',
  surfaceGlow: false,
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
      glitter: time.glitter,
      caustics: caustics ? CLEAR.caustics * (1 - (1 - CLEAR.sickCaustics) * k) : 0,
    };
  },
};
