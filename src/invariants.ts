/**
 * What must always be true of the lake, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The time is a number and not before the start. Every fish is a number,
 * in the water, below the surface and above the bed, and there are no more
 * than a lake holds. The levers are within nought and one. There
 * are no more splashes than the pool holds, each on the water, none landed
 * after now, every number a number.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { FISH_CAPACITY, SPLASH_CAPACITY, bedDepth, ground, inside } from './lake';

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

  const { splashes } = game;
  if (!Number.isInteger(splashes.count) || splashes.count < 0 || splashes.count > SPLASH_CAPACITY)
    out.push(`the lake has ${splashes.count} splashes, where it holds ${SPLASH_CAPACITY}`);
  const splashed: string[] = [];
  for (let i = 0; i < Math.min(splashes.count, SPLASH_CAPACITY); i++) {
    const x = splashes.x[i],
      y = splashes.y[i],
      at = splashes.at[i];
    if (![x, y, at, splashes.size[i]].every(Number.isFinite)) splashed.push(`splash ${i} is not a number`);
    else if (!inside(x, y)) splashed.push(`splash ${i} is off the water at ${x.toFixed(1)},${y.toFixed(1)}`);
    else if (at > game.t)
      splashed.push(`splash ${i} landed after now, at ${at.toFixed(2)} with the time ${game.t.toFixed(2)}`);
  }
  report(splashed);

  const { lure } = game;
  const where = `at ${lure.at[0].toFixed(1)},${lure.at[1].toFixed(1)},${lure.at[2].toFixed(2)}`;
  if (!['ready', 'flying', 'sinking', 'lying'].includes(lure.phase)) out.push(`the lure is ${String(lure.phase)}`);
  else if (![...lure.at, lure.depth, lure.angle, lure.power].every(Number.isFinite))
    out.push('the lure is not a number');
  else if (
    lure.phase === 'flying' &&
    lure.at[2] < (inside(lure.at[0], lure.at[1]) ? 0 : ground(lure.at[0], lure.at[1])) - 1e-3
  )
    out.push(`the lure is flying under what it flies over, ${where}`);
  else if (lure.phase === 'sinking') {
    if (!inside(lure.bobber[0], lure.bobber[1])) out.push(`the lure is sinking off the water, ${where}`);
    else if (lure.depth < 0 || lure.depth > bedDepth(lure.bobber[0], lure.bobber[1]))
      out.push(`the lure is under the bed, ${where}`);
  } else if (lure.phase === 'lying' && inside(lure.at[0], lure.at[1]))
    out.push(`the lure is lying on the water, ${where}`);

  if (!(game.contamination >= 0 && game.contamination <= 1)) out.push(`the contamination is ${game.contamination}`);
  if (!(game.timeOfDay >= 0 && game.timeOfDay <= 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}
