/**
 * What must always be true of the lake, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The time is a number and not before the start. Every fish is a number,
 * in the water, below the surface and above the bed, and there are no more
 * than a lake holds. The levers are within nought and one.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { FISH_CAPACITY, bedDepth, inside } from './lake';

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

export function checkInvariants(game: Game): string[] {
  const out: string[] = [];
  const report = (found: string[]) => {
    out.push(...found.slice(0, EACH));
    if (found.length > EACH) out.push(`and ${found.length - EACH} more like it`);
  };
  if (!Number.isFinite(game.t) || game.t < 0) out.push(`the time is ${game.t}`);

  const { fish } = game;
  if (!Number.isInteger(fish.count) || fish.count < 0 || fish.count > FISH_CAPACITY)
    out.push(`the lake has ${fish.count} fish, where it holds ${FISH_CAPACITY}`);
  const wrong: string[] = [];
  for (let i = 0; i < Math.min(fish.count, FISH_CAPACITY); i++) {
    const x = fish.x[i],
      y = fish.y[i],
      depth = fish.depth[i];
    const at = `fish ${i} at ${x.toFixed(1)},${y.toFixed(1)}, ${depth.toFixed(2)} down`;
    if (![x, y, depth, fish.heading[i], fish.speed[i]].every(Number.isFinite))
      wrong.push(`${at}: fish ${i} is not a number`);
    else if (!inside(x, y) || depth <= 0) wrong.push(`${at}: fish ${i} is out of the water`);
    else if (depth >= bedDepth(x, y)) wrong.push(`${at}: fish ${i} is under the bed`);
  }
  report(wrong);

  if (!(game.contamination >= 0 && game.contamination <= 1)) out.push(`the contamination is ${game.contamination}`);
  if (!(game.timeOfDay >= 0 && game.timeOfDay <= 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}
