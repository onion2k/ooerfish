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
import { FIGHT, FISHING, FISH_CAPACITY, SPLASH_CAPACITY, bedDepth, ground, inside } from './lake';

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
  if (!['ready', 'flying', 'sinking', 'lying', 'hooked'].includes(lure.phase))
    out.push(`the lure is ${String(lure.phase)}`);
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

  out.push(...fishingRules(game));

  if (!(game.contamination >= 0 && game.contamination <= 1)) out.push(`the contamination is ${game.contamination}`);
  if (!(game.timeOfDay >= 0 && game.timeOfDay <= 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}

/**
 * The fishing's rules: the bite in a phase it knows, with a fish when it has one and none when it has none, that
 * fish the one the school leaves to it; a fish nibbling or biting at the lure; a fish on the line or landed with the
 * lure in its mouth; the line's tension from nought to one and the line out no more than the spool; and the bucket a
 * count.
 */
function fishingRules(game: Game): string[] {
  const out: string[] = [];
  const { bite, fish, lure, line } = game;
  const phases = ['none', 'coming', 'nibbling', 'biting', 'hooked', 'landed'];
  if (!phases.includes(bite.phase)) return [`the bite is ${String(bite.phase)}`];
  if (bite.phase === 'none') {
    if (bite.fish !== -1) out.push(`no fish is at the lure, but the bite has fish ${bite.fish}`);
    if (fish.held !== -1) out.push(`no fish is at the lure, but the school holds fish ${fish.held}`);
  } else {
    if (!Number.isInteger(bite.fish) || bite.fish < 0 || bite.fish >= fish.count)
      return [...out, `the bite is ${bite.phase} with fish ${bite.fish}, of ${fish.count}`];
    if (fish.held !== bite.fish) out.push(`fish ${bite.fish} is ${bite.phase}, but the school holds fish ${fish.held}`);
    const i = bite.fish;
    const fromLure = Math.hypot(fish.x[i] - lure.at[0], fish.y[i] - lure.at[1]);
    if ((bite.phase === 'nibbling' || bite.phase === 'biting') && fromLure > FISHING.mouth + 0.5)
      out.push(`fish ${i} is ${bite.phase} ${fromLure.toFixed(2)} from the lure`);
    if (bite.phase === 'hooked' || bite.phase === 'landed') {
      if (lure.phase !== 'hooked') out.push(`fish ${i} is ${bite.phase}, but the lure is ${lure.phase}`);
      else if (fromLure > 1e-6)
        out.push(`fish ${i} is ${bite.phase} ${fromLure.toFixed(2)} from the lure in its mouth`);
    } else if (lure.phase !== 'sinking') out.push(`fish ${i} is ${bite.phase} at a lure that is ${lure.phase}`);
  }
  if (lure.phase === 'hooked' && bite.phase !== 'hooked' && bite.phase !== 'landed')
    out.push(`the lure is hooked with the bite ${bite.phase}`);
  if (!(line.tension >= 0 && line.tension <= 1)) out.push(`the line's tension is ${line.tension}`);
  if (!(line.out >= 0 && line.out <= FIGHT.spool))
    out.push(`the line out is ${line.out}, of a spool of ${FIGHT.spool}`);
  if (!Number.isInteger(game.bucket) || game.bucket < 0) out.push(`the bucket holds ${game.bucket}`);
  return out;
}
