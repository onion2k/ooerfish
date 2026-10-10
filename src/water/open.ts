/**
 * Open water: the renderer's own (`FLOW_WATER`), as ooergolf draws its lakes.
 * Twelve sine waves laid in the world, so the pond is one sea; the sky
 * mirrored in them by a Fresnel term, and a glint that is the camera's own.
 * The body is the contamination's colour, and the mirrored sky is tinted
 * with it. It is opaque, and takes no point light and no toon band: what is
 * under it does not show.
 */
import { FLOW_WATER, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { skyTint, waterColour, type WaterStyle } from './styles';
import { AT_ORIGIN, surface } from './surface';

/** The waves: cells of the biggest a world unit, how fast they go, and how steeply they tilt the surface. */
export const OPEN = { scale: 0.35, speed: 0.55, steepness: 0.25, roughness: 0.08 } as const;

export const open: WaterStyle = {
  name: 'open',
  label: 'Open water',
  surfaceGlow: true,
  groups(contamination) {
    const patterns = packFlow(new Float32Array(PATTERN_STRIDE), 0, {
      kind: FLOW_WATER,
      scale: OPEN.scale,
      speed: OPEN.speed,
      glow: OPEN.steepness,
      second: skyTint(contamination),
    });
    return [
      {
        mesh: surface(),
        matrices: AT_ORIGIN,
        albedo: waterColour(contamination),
        roughness: OPEN.roughness,
        patterns,
      },
    ];
  },
};
