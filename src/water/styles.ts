/**
 * The ways the lab draws the water. There is one, the water seen into, because the lake is seen into as it is
 * cleaned, which is what the game is about. Each is data: the groups the water is drawn with, at a contamination,
 * handed to the renderer by the page. Another way is a file beside these and a line in `STYLES`, and the look tests
 * picture it.
 */
import type { ClearWater } from 'artshape-render/game/clear';
import type { GameGroup } from 'artshape-render/game/renderer';
import type { GerstnerWave } from 'artshape-render/game/waves';
import type { Season } from '../lake';
import type { TimeOfDay } from '../look';
import { clear } from './clear';

export interface WaterStyle {
  /** What it is called in the test API and the pictures. */
  name: string;
  /** What it is called on the lab's panel. */
  label: string;
  /** The groups the water is drawn with, at a contamination from clear (0) to sick (1). */
  groups(contamination: number): GameGroup[];
  /** The swells that move its surface, which what floats on it rides: none, and it lies still. */
  waves?: readonly GerstnerWave[];
  /** The same swells in a season's amplitude, which the bobber must ride when the look is handed them. */
  wavesIn?(season: Season): readonly GerstnerWave[];
  /** The renderer's `look.clear` at a contamination and a time of day, with caustics or without, in a season (summer when none is given). */
  clear(contamination: number, caustics: boolean, time: TimeOfDay, season?: Season): Partial<ClearWater>;
}

export const STYLES: readonly WaterStyle[] = [clear];
