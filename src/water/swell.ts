/**
 * Where the water stands, for what floats on it: the bobber and a splash's rings ride the very swells the renderer
 * draws, by the renderer's own sum, at the game's clock (which the renderer is handed each frame). Without this they
 * would lie on still water while the drawn surface rose over them and fell away under them.
 */
import { GRAVITY_MM, heightAt, type GerstnerWave } from 'artshape-render/game/waves';

/** The height of the water's surface at a point and a time, in world units over its still level. */
export type Surface = (x: number, y: number, t: number) => number;

/** Water that lies still, at nought everywhere. */
export const STILL: Surface = () => 0;

/** The surface swells of a style make, in a world of `mmPerUnit` millimetres a unit; still water where there are none. */
export function surfaceOf(waves: readonly GerstnerWave[] | undefined, mmPerUnit: number): Surface {
  if (!waves?.length) return STILL;
  const gravity = GRAVITY_MM / mmPerUnit;
  return (x, y, t) => heightAt(waves, x, y, t, gravity);
}
