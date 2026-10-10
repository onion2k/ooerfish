/**
 * The lit ripple: the renderer's ripple (`FLOW_RIPPLE`), a height field
 * travelling across the surface that turns its normal, so the sun, the toon
 * bands and any point light play on it as on everything else. Its crests
 * give out light of their own, the glow's green, as much as the lake is
 * dirty: the sickness shows in the water itself, and goes as it is cleaned.
 */
import { FLOW_RIPPLE, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { PALETTE, mix } from '../palette';
import { waterColour, type WaterStyle } from './styles';
import { AT_ORIGIN, surface } from './surface';

/**
 * The ripple: cells a world unit, how fast it travels along the world's x, how brightly the crests glow when the lake
 * is as sick as it gets and when it is clear, and how much lighter than the water its crests are.
 */
export const RIPPLE = {
  scale: 0.12,
  speed: 0.6,
  sickGlow: 0.18,
  clearGlow: 0.02,
  roughness: 0.55,
  lighter: 0.3,
} as const;

export const ripple: WaterStyle = {
  name: 'ripple',
  label: 'Lit ripple',
  surfaceGlow: true,
  groups(contamination) {
    const k = Math.min(1, Math.max(0, contamination));
    const patterns = packFlow(new Float32Array(PATTERN_STRIDE), 0, {
      kind: FLOW_RIPPLE,
      scale: RIPPLE.scale,
      speed: RIPPLE.speed,
      glow: RIPPLE.clearGlow + (RIPPLE.sickGlow - RIPPLE.clearGlow) * k,
      // the ripple's second colour is mixed into the water itself and lights its crests: a lighter shade of the water's
      // own, going over to the glow's green as the lake gets sicker
      second: mix(mix(waterColour(contamination), [1, 1, 1], RIPPLE.lighter), PALETTE.glow, k * 0.6),
    });
    return [
      {
        mesh: surface(),
        matrices: AT_ORIGIN,
        albedo: waterColour(contamination),
        roughness: RIPPLE.roughness,
        patterns,
      },
    ];
  },
};
