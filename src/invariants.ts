/**
 * What must always be true of the lake, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The time is a number and not before the start. Every fish is a number,
 * in the water, below the surface and above the bed, and there are no more
 * than a lake holds; and every joint of its body as it is drawn is below the
 * surface and above the bed too. The contamination is within nought and one and never rises but by the lever, the count cured is a whole number, and the time of day is in [0, 1). There
 * are no more splashes than the pool holds, each on the water, none landed
 * after now, every number a number.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { fightFor, gearFor } from './fight';
import {
  FIGHT,
  FISHING,
  FISH_CAPACITY,
  FISH_COUNT,
  GEAR,
  SPLASH_CAPACITY,
  SWIM,
  bedDepth,
  ground,
  inside,
} from './lake';
import { poseFish } from './swim';

/** A fish's spine, posed to be checked: asked for only when the rules are, so it is made once here. */
const spine = new Float64Array((SWIM.segments.length + 1) * 3);

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

/** What each game's contamination was when the rules were last asked, and how many times the lever had been set: a rise with the lever unmoved is a fault. */
const seen = new WeakMap<Game, { contamination: number; waterDirt: number; levers: number }>();

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

  // every joint of a swimming fish's body as it is drawn, nose to tail, under the surface and over the bed
  const bent: string[] = [];
  for (let i = 0; i < Math.min(fish.count, FISH_CAPACITY); i++) {
    if (![fish.x[i], fish.y[i], fish.depth[i]].every(Number.isFinite)) continue;
    if (![fish.phase[i], fish.turn[i], fish.rise[i], fish.pace[i], fish.vigour[i]].every(Number.isFinite)) {
      bent.push(`fish ${i}'s stroke is not a number`);
      continue;
    }
    poseFish(spine, SWIM, fish, i, bedDepth);
    for (let k = 0; k < spine.length; k += 3) {
      const jx = spine[k],
        jy = spine[k + 1],
        jz = spine[k + 2];
      const where = `fish ${i}'s joint ${k / 3} at ${jx.toFixed(1)},${jy.toFixed(1)}, ${(-jz).toFixed(2)} down`;
      if (jz >= 0) bent.push(`${where}: out of the water`);
      else if (inside(jx, jy) && -jz >= bedDepth(jx, jy)) bent.push(`${where}: under the bed`);
      else continue;
      break;
    }
  }
  report(bent);

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
  // it only ever goes down, the cure's doing: it rises only where the lever (the test API's, the fuzzer's start) was set
  const was = seen.get(game);
  if (was && was.levers === game.levers && game.contamination > was.contamination)
    out.push(`the contamination rose from ${was.contamination} to ${game.contamination}, and no lever was set`);
  // the water the page shows lies between the truth and sick, and like the truth it only falls but by the lever
  if (!(game.waterDirt >= 0 && game.waterDirt <= 1)) out.push(`the water's dirt is ${game.waterDirt}`);
  else if (game.waterDirt < game.contamination)
    out.push(`the water is cleaner than the lake: ${game.waterDirt} against ${game.contamination}`);
  if (was && was.levers === game.levers && game.waterDirt > was.waterDirt)
    out.push(`the water's dirt rose from ${was.waterDirt} to ${game.waterDirt}, and no lever was set`);
  seen.set(game, { contamination: game.contamination, waterDirt: game.waterDirt, levers: game.levers });
  const { cured } = game.progress.save;
  if (!Number.isSafeInteger(cured) || cured < 0) out.push(`the lake has cured ${cured} fish`);
  else if (fish.curedCount() !== Math.min(cured, FISH_COUNT))
    out.push(`${fish.curedCount()} fish are cured, but the save says ${cured}, of ${FISH_COUNT} in the pond`);
  // the gifts in force are the ones the count has earned, and nothing else; the zone a fight plays is that gear's width
  // (a fight under way keeps its own, so only a line at rest is held to the gear in force)
  const gear = gearFor(cured);
  for (const g of GEAR)
    if (game.gear[g.id] !== gear[g.id])
      out.push(`the ${g.id} is ${game.gear[g.id] ? 'held' : 'not held'}, but ${cured} cured earns it ${gear[g.id]}`);
  if (game.bite.gear !== game.gear) out.push('the bite has not the gear the game holds');
  if (!(game.timeOfDay >= 0 && game.timeOfDay < 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}

/**
 * The fishing's rules: the bite in a phase it knows, with a fish when it has one and none when it has none, that
 * fish the one the school leaves to it; a fish nibbling or biting at the lure; a fish on the line or landed with the
 * lure in its mouth; the line's tension from nought to one and the line out no more than the spool; the zone, the
 * fish and the meter on the fight's bar; and the bucket a count.
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
    if (fish.cured[i]) out.push(`fish ${i} is cured, but it is the bite's (${bite.phase})`);
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
  // the gear changes only when a fish is stowed, never in a fight, so the zone a fish on the line is played in is the one
  // the gear in force gives
  if (bite.phase === 'hooked' || bite.phase === 'landed') {
    const width = fightFor(0, 'steady', game.gear).width;
    if (Math.abs(line.figures.width - width) > 1e-9)
      out.push(`the zone is ${line.figures.width} wide, the gear's is ${width}`);
  }
  if (!(line.zone >= 0 && line.zone <= 1 - line.figures.width)) out.push(`the zone is at ${line.zone}, off the bar`);
  if (!(line.fishAt >= 0 && line.fishAt <= 1)) out.push(`the fish is at ${line.fishAt} on the bar`);
  if (!(line.meter >= 0 && line.meter <= 1)) out.push(`the meter is at ${line.meter}`);
  if (!Number.isInteger(game.bucket) || game.bucket < 0) out.push(`the bucket holds ${game.bucket}`);
  return out;
}
