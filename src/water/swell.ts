/**
 * Where the water stands, for what floats on it: the bobber and a splash's rings ride the very swells the renderer
 * draws, by the renderer's own sum, at the water's clock (which the renderer is handed each frame, `waterClock` of the
 * game's). Without this they would lie on still water while the drawn surface rose over them and fell away under them,
 * and if the two clocks were worked out in two places they would drift apart the day one was changed.
 */
import { GRAVITY_MM, heightAt, type GerstnerWave } from 'artshape-render/game/waves';

/** The height of the water's surface at a point and a time, in world units over its still level. */
export type Surface = (x: number, y: number, t: number) => number;

/** Water that lies still, at nought everywhere. */
export const STILL: Surface = () => 0;

/**
 * The water's own time at a game time, which is the renderer's time: the game's clock at the water's pace, so that a
 * pond can be calm while everything else keeps its speed. Without a pace it is the game's.
 */
export function waterClock(t: number, pace = 1): number {
  return t * pace;
}

/**
 * The surface swells of a style make, in a world of `mmPerUnit` millimetres a unit, read at a game time and so at the
 * water's clock for that pace; still water where there are none.
 */
export function surfaceOf(waves: readonly GerstnerWave[] | undefined, mmPerUnit: number, pace = 1): Surface {
  if (!waves?.length) return STILL;
  const gravity = GRAVITY_MM / mmPerUnit;
  return (x, y, t) => heightAt(waves, x, y, waterClock(t, pace), gravity);
}
