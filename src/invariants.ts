/**
 * What must always be true of the lake, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * The time is a number and not before the start. Every fish is a number,
 * in the water, below the surface and above the bed, and there are no more
 * than a lake holds; and every joint of its body as it is drawn is below the
 * surface and above the bed too. The contamination is within nought and one, never rises but by the lever, and is the formula's for the
 * fish cured and the drums hauled unless the lever has set it; the count cured is a whole number, the drums hauled are
 * from none to the pond's and the save's, and none of them is the bite's; the journal is in its kinds' ranges, no
 * later than today and no more than the fish cured; the junk treasures found are known ones, each once, no more than
 * the pond has, the save's, and none of them is the bite's, which is at most one thing, and the treasures that lie on the
 * bed lie in the water, clear of the drums; and the time of day is in [0, 1). There
 * are no more splashes than the pool holds, each on the water, none landed
 * after now, every number a number.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import type { Game } from './game';
import { fightFor, gearFor } from './fight';
import {
  CLOCK,
  DRUMS,
  FIGHT,
  FISHING,
  FISH_CAPACITY,
  FISH_COUNT,
  GEAR,
  SPLASH_CAPACITY,
  TREASURES,
  KINDS,
  SWIM,
  bedDepth,
  contaminationAfter,
  ground,
  inside,
} from './lake';
import { poseFish } from './swim';

/**
 * The junk treasures' rules. The ids kept are known, each once, and no more than the pond has; the treasures found on the
 * bed are exactly the ones the save names; and each lies on the bed in the water, in the depths the content says and clear
 * of the shore, and apart from every drum. Nothing here is the cleaning's: that is the formula's alone.
 */
function treasureRules(game: Game, out: string[]) {
  const { found } = game.progress.save;
  const { treasures, drums } = game;
  const known = new Set<string>(TREASURES.list.map((t) => t.id));
  const seen = new Set<string>();
  if (!Array.isArray(found)) return void out.push('the save has no list of treasures found');
  for (const id of found) {
    if (!known.has(id)) out.push(`the save has a treasure not known: ${String(id)}`);
    else if (seen.has(id)) out.push(`the save has the treasure ${id} twice`);
    seen.add(id);
  }
  if (found.length > TREASURES.count)
    out.push(`the save has ${found.length} treasures found, of ${TREASURES.count} in the pond`);
  TREASURES.list.forEach((t, i) => {
    if (treasures.found[i] && !seen.has(t.id)) out.push(`treasure ${t.id} is found, but the save does not say so`);
    if (!treasures.found[i] && seen.has(t.id)) out.push(`treasure ${t.id} is in the save, but it is still on the bed`);
    const [x, y] = [treasures.x[i], treasures.y[i]];
    const bed = bedDepth(x, y);
    const [least, most] = TREASURES.where.depth;
    if (!inside(x, y, TREASURES.where.margin) || !(bed >= least && bed <= most))
      out.push(`treasure ${i} is not on the bed under the water, at ${x}, ${y}`);
    for (let d = 0; d < drums.count; d++) {
      const gap = Math.hypot(x - drums.x[d], y - drums.y[d]);
      if (gap < TREASURES.where.apart)
        out.push(`treasure ${i} lies ${gap.toFixed(2)} from drum ${d}, under the ${TREASURES.where.apart} apart`);
    }
  });
}

/**
 * The journal's rules. Each entry is of a kind the game knows, a whole count of one or more, a best weight within its
 * kind's range (nought is none: a save could not vouch for it) and a first day that is a whole number up to today
 * (nought is none); and the counts together are at most the fish cured, since a catch cures a fish.
 *
 * The fish cured of each kind are the journal's count of it, at most the kind's slots, where the journal accounts for
 * every cure. It does not when it accounts for fewer than the pond has cured (`accounted` below the count cured, held
 * to the pond's twelve): that is an old save, whose leftover cures were made in slot order and may lie in any kind, so
 * a kind then holds at least what the journal says and no fewer. A stow cures a fish of one kind and counts it in that
 * kind, so the leftover is the same for the whole of play.
 */
function journalRules(game: Game, out: string[]) {
  const { journal, cured } = game.progress.save;
  const { fish } = game;
  const known = new Set<string>(KINDS.map((k) => k.id));
  let caught = 0;
  let sound = true;
  for (const [id, e] of Object.entries(journal)) {
    if (!e) continue;
    if (!known.has(id)) {
      out.push(`the journal has a kind not known: ${id}`);
      sound = false;
      continue;
    }
    const kind = KINDS.find((k) => k.id === id)!;
    if (!Number.isSafeInteger(e.caught) || e.caught < 1) {
      out.push(`the journal's ${id} has caught ${e.caught}`);
      sound = false;
      continue;
    }
    caught += e.caught;
    const [least, most] = kind.weight;
    if (!(e.best === 0 || (e.best >= least && e.best <= most)))
      out.push(`the journal's best ${id} is ${e.best} kg, outside ${least} to ${most}`);
    if (!Number.isSafeInteger(e.first) || e.first < 0)
      out.push(`the journal's ${id} was first caught on day ${e.first}`);
    else if (e.first > game.day)
      out.push(`the journal's ${id} was first caught on day ${e.first}, but it is day ${game.day}`);
  }
  if (caught > cured) out.push(`the journal counts ${caught} caught, but only ${cured} are cured`);
  if (!sound) return;
  const slots = KINDS.map(() => 0);
  const curedOf = KINDS.map(() => 0);
  for (let i = 0; i < fish.count; i++) {
    slots[fish.kind[i]]++;
    curedOf[fish.kind[i]] += fish.cured[i];
  }
  const said = KINDS.map((k, n) => Math.min(journal[k.id]?.caught ?? 0, slots[n]));
  const accounted = said.reduce((a, b) => a + b, 0);
  const whole = accounted >= Math.min(cured, FISH_COUNT);
  KINDS.forEach((k, n) => {
    const wrong = whole ? curedOf[n] !== said[n] : curedOf[n] < said[n];
    if (wrong)
      out.push(
        `${k.id}: ${curedOf[n]} fish are cured, but the journal says ${journal[k.id]?.caught ?? 0} caught of ${slots[n]} slots`,
      );
  });
}

/** A fish's spine, posed to be checked: asked for only when the rules are, so it is made once here. */
const spine = new Float64Array((SWIM.segments.length + 1) * 3);

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

/** What each game's contamination was when the rules were last asked, and how many times the lever had been set: a rise with the lever unmoved is a fault. */
const seen = new WeakMap<
  Game,
  {
    contamination: number;
    waterDirt: number;
    levers: number;
    day: number;
    place: string;
    t: number;
    timeOfDay: number;
    fish: Float64Array;
  }
>();

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
    poseFish(spine, SWIM, fish, i, bedDepth, KINDS[fish.kind[i]].scale);
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
  // and unless the lever has set it, it is exactly what the formula says of the fish cured and the drums hauled
  if (game.levers === 0) {
    const { cured, drums } = game.progress.save;
    const truth = contaminationAfter(cured, drums);
    if (Math.abs(game.contamination - truth) > 1e-9)
      out.push(`the contamination is ${game.contamination}, but ${cured} cured and ${drums} hauled make it ${truth}`);
  }
  // the water the page shows lies between the truth and sick, and like the truth it only falls but by the lever
  if (!(game.waterDirt >= 0 && game.waterDirt <= 1)) out.push(`the water's dirt is ${game.waterDirt}`);
  else if (game.waterDirt < game.contamination)
    out.push(`the water is cleaner than the lake: ${game.waterDirt} against ${game.contamination}`);
  if (was && was.levers === game.levers && game.waterDirt > was.waterDirt)
    out.push(`the water's dirt rose from ${was.waterDirt} to ${game.waterDirt}, and no lever was set`);
  out.push(...nightRules(game, was));
  const now = was ?? {
    contamination: 0,
    waterDirt: 0,
    levers: 0,
    day: 0,
    place: '',
    t: 0,
    timeOfDay: 0,
    fish: new Float64Array(FISH_CAPACITY * 3),
  };
  now.contamination = game.contamination;
  now.waterDirt = game.waterDirt;
  now.levers = game.levers;
  now.day = game.day;
  now.place = game.place;
  now.t = game.t;
  now.timeOfDay = game.timeOfDay;
  for (let i = 0; i < Math.min(fish.count, FISH_CAPACITY); i++) {
    now.fish[i * 3] = fish.x[i];
    now.fish[i * 3 + 1] = fish.y[i];
    now.fish[i * 3 + 2] = fish.depth[i];
  }
  seen.set(game, now);
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
  // the drums hauled are a count from none to the pond's, the save's, and each is gone from the bed for good
  const hauled = game.drums.foundCount();
  if (!Number.isSafeInteger(game.progress.save.drums) || game.progress.save.drums < 0)
    out.push(`the save says ${game.progress.save.drums} drums hauled`);
  else if (hauled < 0 || hauled > DRUMS.count) out.push(`${hauled} drums are hauled, of ${DRUMS.count} in the pond`);
  else if (hauled !== game.progress.save.drums)
    out.push(`${hauled} drums are hauled, but the save says ${game.progress.save.drums}`);
  journalRules(game, out);
  treasureRules(game, out);
  if (!(game.timeOfDay >= 0 && game.timeOfDay < 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}

/**
 * The day's end: the day a whole number from one, never back and the save's; the place one of three; the fade within
 * nought and one; and away from the pond, in the cabin and yawning, the lake held still (the time, the clock and every
 * fish where they were when the rules were last asked in the same place), the lure ready, no fish hooked or landed, and
 * in the cabin the clock at dawn.
 */
function nightRules(
  game: Game,
  was: { day: number; place: string; t: number; timeOfDay: number; fish: Float64Array } | undefined,
): string[] {
  const out: string[] = [];
  const { day, place } = game;
  if (!Number.isSafeInteger(day) || day < 1) out.push(`the day is ${day}`);
  else if (was && day < was.day) out.push(`the day went back from ${was.day} to ${day}`);
  if (game.progress.save.day !== day) out.push(`the day is ${day}, but the save says ${game.progress.save.day}`);
  if (!['pond', 'yawning', 'cabin'].includes(place)) return [...out, `the player is at ${String(place)}`];
  const fade = game.fade();
  if (!(fade >= 0 && fade <= 1)) out.push(`the fade is ${fade}`);
  if (place === 'pond') return out;
  if (game.lure.phase !== 'ready') out.push(`the lure is ${game.lure.phase}, with the player ${place}`);
  if (game.bite.phase === 'hooked' || game.bite.phase === 'landed')
    out.push(`a fish is ${game.bite.phase}, with the player ${place}`);
  if (place === 'cabin' && game.timeOfDay !== CLOCK.startsAt)
    out.push(`the clock is at ${game.timeOfDay} in the cabin, not at dawn`);
  // the lake holds still from one asking to the next while the player stays away from it
  if (was && was.place === place) {
    if (game.t !== was.t) out.push(`the time moved from ${was.t} to ${game.t}, with the player ${place}`);
    if (game.timeOfDay !== was.timeOfDay)
      out.push(`the clock moved from ${was.timeOfDay} to ${game.timeOfDay}, with the player ${place}`);
    for (let i = 0; i < Math.min(game.fish.count, FISH_CAPACITY); i++)
      if (
        game.fish.x[i] !== was.fish[i * 3] ||
        game.fish.y[i] !== was.fish[i * 3 + 1] ||
        game.fish.depth[i] !== was.fish[i * 3 + 2]
      ) {
        out.push(`fish ${i} moved, with the player ${place}`);
        break;
      }
  }
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
  // the quarry is a fish, a drum or a treasure, never two, and a hauled drum or a kept treasure is never the bite's
  if (!Number.isInteger(bite.drum) || bite.drum < -1 || bite.drum >= game.drums.count)
    return [`the bite has drum ${bite.drum}, of ${game.drums.count}`];
  if (!Number.isInteger(bite.treasure) || bite.treasure < -1 || bite.treasure >= game.treasures.count)
    return [`the bite has treasure ${bite.treasure}, of ${game.treasures.count}`];
  if (bite.drum >= 0 && game.drums.found[bite.drum]) out.push(`drum ${bite.drum} is hauled, but it is the bite's`);
  if (bite.treasure >= 0 && game.treasures.found[bite.treasure])
    out.push(`treasure ${bite.treasure} is found, but it is the bite's`);
  if (bite.phase === 'none') {
    if (bite.fish !== -1) out.push(`no fish is at the lure, but the bite has fish ${bite.fish}`);
    if (bite.drum !== -1) out.push(`no drum is at the lure, but the bite has drum ${bite.drum}`);
    if (bite.treasure !== -1) out.push(`no treasure is at the lure, but the bite has treasure ${bite.treasure}`);
    if (fish.held !== -1) out.push(`no fish is at the lure, but the school holds fish ${fish.held}`);
  } else if (bite.drum >= 0 || bite.treasure >= 0) {
    // a thing on the bed: neither comes, nibbles nor fights, so it is only ever biting, hooked or landed, at the lure
    const what = bite.drum >= 0 ? `drum ${bite.drum}` : `treasure ${bite.treasure}`;
    if (bite.drum >= 0 && bite.treasure >= 0)
      out.push(`the bite is ${bite.phase} with drum ${bite.drum} and treasure ${bite.treasure}`);
    if (bite.fish !== -1) out.push(`the bite is ${bite.phase} with ${what} and fish ${bite.fish}`);
    if (fish.held !== -1) out.push(`${what} is ${bite.phase}, but the school holds fish ${fish.held}`);
    if (!['biting', 'hooked', 'landed'].includes(bite.phase)) out.push(`${what} is ${bite.phase}`);
    if (bite.phase === 'hooked' || bite.phase === 'landed') {
      if (lure.phase !== 'hooked') out.push(`${what} is ${bite.phase}, but the lure is ${lure.phase}`);
    } else if (lure.phase !== 'sinking') out.push(`${what} is ${bite.phase} at a lure that is ${lure.phase}`);
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
