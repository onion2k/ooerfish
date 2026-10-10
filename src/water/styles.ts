/**
 * The ways the lab draws the water, side by side, so they can be flipped
 * between on the same lake and judged by looking. Each is data: the groups
 * the water is drawn with, at a contamination, handed to the renderer by the
 * page. A new way is a file beside these and a line in `STYLES`, and the
 * look tests picture every one.
 *
 * The contamination's colour is one sum for all of them, `waterColour`, so a
 * lake half cleaned is the same green-blue whichever way it is drawn.
 */
import type { ClearWater } from 'artshape-render/game/clear';
import type { GameGroup } from 'artshape-render/game/renderer';
import type { GerstnerWave } from 'artshape-render/game/waves';
import type { TimeOfDay } from '../look';
import { PALETTE, mix, type Colour } from '../palette';
import { clear } from './clear';
import { open } from './open';
import { ripple } from './ripple';

export interface WaterStyle {
  /** What it is called in the address and the test API. */
  name: string;
  /** What it is called on the lab's panel. */
  label: string;
  /** The groups the water is drawn with, at a contamination from clear (0) to sick (1). */
  groups(contamination: number): GameGroup[];
  /**
   * Whether a fish's glow is drawn on the surface over it: for water that cannot be seen through. Water that can be
   * has the fish themselves glowing under it, and a glow on the surface too would be two.
   */
  surfaceGlow: boolean;
  /** The swells that move its surface, which what floats on it rides: none, and it lies still. */
  waves?: readonly GerstnerWave[];
  /** For water that is seen through, the renderer's `look.clear` at a contamination and a time of day, with caustics or without. */
  clear?: (contamination: number, caustics: boolean, time: TimeOfDay) => Partial<ClearWater>;
}

export const STYLES: readonly WaterStyle[] = [open, ripple, clear];

/** The style of that name; one not known is refused, and the first is drawn in its place. */
export function styleNamed(name: string): WaterStyle {
  return STYLES.find((s) => s.name === name) ?? STYLES[0];
}

/** The water's own colour at a contamination: clear blue at nought, sick green at one, held between. */
export function waterColour(contamination: number): Colour {
  return mix(PALETTE.clear, PALETTE.sick, Math.min(1, Math.max(0, contamination)));
}

/** The tint of the sky the water mirrors, at a contamination, as the water's own colour is. */
export function skyTint(contamination: number): Colour {
  return mix(PALETTE.clearSky, PALETTE.sickSky, Math.min(1, Math.max(0, contamination)));
}
