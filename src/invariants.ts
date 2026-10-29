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
import { apartOf } from './bedfinds';
import type { Game } from './game';
import { fightFor, gearFor } from './fight';
import {
  FIGHT,
  FISHING,
  FISH_CAPACITY,
  GEAR,
  SPLASH_CAPACITY,
  KINDS,
  SWIM,
  type Kind,
  MOON,
  PHOTOS,
  WEATHER,
  awake,
  ROPE,
} from './lake';
import { weatherOf } from './calendar';
import { poseFish } from './swim';
import { REQUESTS } from './town/requests';
import { LAKES } from './lakes';

/**
 * The junk treasures' rules. The ids kept are known, each once, and no more than the pond has; the treasures found on the
 * bed are exactly the ones the save names; and each lies on the bed in the water, in the depths the content says and clear
 * of the shore, and apart from every drum. Nothing here is the cleaning's: that is the formula's alone.
 */
function treasureRules(game: Game, out: string[]) {
  const { found } = game.progress.entry(game.lake.id);
  const { treasures, drums, lake } = game;
  const { inside, bedDepth } = lake;
  const spec = lake.treasures;
  const known = new Set<string>(spec.list.map((t) => t.id));
  const seen = new Set<string>();
  if (!Array.isArray(found)) return void out.push('the save has no list of treasures found');
  for (const id of found) {
    if (!known.has(id)) out.push(`the save has a treasure not known: ${String(id)}`);
    else if (seen.has(id)) out.push(`the save has the treasure ${id} twice`);
    seen.add(id);
  }
  if (found.length > spec.count) out.push(`the save has ${found.length} treasures found, of ${spec.count} in the lake`);
  spec.list.forEach((t, i) => {
    if (treasures.found[i] && !seen.has(t.id)) out.push(`treasure ${t.id} is found, but the save does not say so`);
    if (!treasures.found[i] && seen.has(t.id)) out.push(`treasure ${t.id} is in the save, but it is still on the bed`);
    const [x, y] = [treasures.x[i], treasures.y[i]];
    const bed = bedDepth(x, y);
    const [least, most] = spec.where.depth;
    if (!inside(x, y, spec.where.margin) || !(bed >= least && bed <= most))
      out.push(`treasure ${i} is not on the bed under the water, at ${x}, ${y}`);
    for (let d = 0; d < drums.count; d++) {
      const gap = Math.hypot(x - drums.x[d], y - drums.y[d]);
      if (gap < apartOf(spec, i))
        out.push(`treasure ${i} lies ${gap.toFixed(2)} from drum ${d}, under the ${apartOf(spec, i)} apart`);
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
  const { journal, cured } = game.progress.entry(game.lake.id);
  const { fish, lake } = game;
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
  const whole = accounted >= Math.min(cured, lake.fishCount);
  KINDS.forEach((k, n) => {
    const wrong = whole ? curedOf[n] !== said[n] : curedOf[n] < said[n];
    if (wrong)
      out.push(
        `${k.id}: ${curedOf[n]} fish are cured, but the journal says ${journal[k.id]?.caught ?? 0} caught of ${slots[n]} slots`,
      );
  });
}

/**
 * The town's requests. Each id answered is one the town knows, kept once, and its request is met; and each request that
 * is met is answered, so a load that meets one has marked it. Nothing here asks the page.
 */
function requestRules(game: Game, out: string[]) {
  const { save } = game.progress;
  const seen = new Set<string>();
  for (const id of save.requests) {
    const request = REQUESTS.find((r) => r.id === id);
    if (!request) out.push(`request ${id} is not known`);
    else if (seen.has(id)) out.push(`request ${id} is answered twice`);
    else if (!request.met(save, LAKES)) out.push(`request ${id} is answered, but is not met`);
    seen.add(id);
  }
  for (const r of REQUESTS)
    if (!seen.has(r.id) && r.met(save, LAKES)) out.push(`request ${r.id} is met, but is not answered`);
}

/** The contests' tally (`docs/contests.md`): each figure a non-negative whole number, and a run no longer than the best. */
function tallyRules(game: Game, out: string[]) {
  const { tally } = game.progress.save;
  for (const key of ['rain', 'run', 'best'] as const)
    if (!Number.isSafeInteger(tally[key]) || tally[key] < 0)
      out.push(`the tally's ${key} is ${tally[key]}, not a whole number from nought`);
  if (tally.run > tally.best) out.push(`the tally's run, ${tally.run}, is longer than its best, ${tally.best}`);
}

/**
 * The album (`docs/photo.md`): no longer than it may be, and every photograph one the game could have taken: at a lake it
 * has, on a day from the first to today, at a time of the day, in a weather it has, from a view of finite numbers, of
 * kinds it knows each once, and lit or not.
 */
function photoRules(game: Game, out: string[]) {
  const { photos } = game.progress.save;
  if (!Array.isArray(photos)) return void out.push('the album is not a list');
  if (photos.length > PHOTOS.most) out.push(`the album holds ${photos.length} photographs, of ${PHOTOS.most}`);
  const known: string[] = KINDS.map((k) => k.id);
  photos.forEach((p, i) => {
    const at = `photograph ${i}`;
    if (!Object.hasOwn(LAKES, p.lake)) out.push(`${at} is of a lake, ${p.lake}, the game does not have`);
    if (!Number.isSafeInteger(p.day) || p.day < 1 || p.day > game.day)
      out.push(`${at} is of day ${p.day}, today being ${game.day}`);
    if (!(p.time >= 0 && p.time < 1)) out.push(`${at} was taken at ${p.time} of the day`);
    if (!(WEATHER.kinds as readonly string[]).includes(p.weather)) out.push(`${at} was taken in ${p.weather}`);
    for (const [k, v] of Object.entries(p.view))
      if (!Number.isFinite(v)) out.push(`${at} looks from a view with ${k} ${v}`);
    if (Object.keys(p.view).length !== 6)
      out.push(`${at} has a view of ${Object.keys(p.view).length} figures, not six`);
    const seen = new Set<string>();
    for (const id of p.kinds) {
      if (!known.includes(id)) out.push(`${at} has a kind, ${id}, the game does not know`);
      if (seen.has(id)) out.push(`${at} has the kind ${id} twice`);
      seen.add(id);
    }
    const lit: unknown = p.lit;
    if (typeof lit !== 'boolean') out.push(`${at} is lit ${String(lit)}`);
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

  const { fish, lake } = game;
  const { inside, bedDepth } = lake;
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
    // a fish is of a kind its lake lists: the Reservoir's kinds never turn up in the pond
    if (!game.lake.fishKinds.includes(fish.kind[i]))
      bent.push(
        `fish ${i} is a ${KINDS[fish.kind[i]]?.name ?? `kind ${fish.kind[i]}`}, which the ${game.lake.name} does not hold`,
      );
    poseFish(spine, SWIM, fish, i, bedDepth, KINDS[fish.kind[i]].scale, (KINDS[fish.kind[i]] as Kind).stretch ?? 1);
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
  else if (!(
    Math.hypot(lure.wind[0], lure.wind[1]) < 1e-9 ||
    Math.abs(Math.hypot(lure.wind[0], lure.wind[1]) - WEATHER.wind.push) < 1e-9
  ))
    out.push(`the lure's wind is ${lure.wind[0].toFixed(2)},${lure.wind[1].toFixed(2)}, neither none nor the push`);
  else if (
    lure.phase === 'flying' &&
    lure.at[2] < (inside(lure.at[0], lure.at[1]) ? 0 : lake.ground(lure.at[0], lure.at[1])) - 1e-3
  )
    out.push(`the lure is flying under what it flies over, ${where}`);
  else if (lure.phase === 'sinking') {
    if (!inside(lure.bobber[0], lure.bobber[1])) out.push(`the lure is sinking off the water, ${where}`);
    else if (lure.depth < 0 || lure.depth > bedDepth(lure.bobber[0], lure.bobber[1]))
      out.push(`the lure is under the bed, ${where}`);
  } else if (lure.phase === 'lying' && inside(lure.at[0], lure.at[1]))
    out.push(`the lure is lying on the water, ${where}`);

  // the line's rope: every point a number, the ends where the line is pinned, and none under the ground or the bed
  {
    const { points } = game.rope;
    const last = points.length - 3;
    const ropeWrong: string[] = [];
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i],
        y = points[i + 1],
        z = points[i + 2];
      if (![x, y, z].every(Number.isFinite)) {
        ropeWrong.push(`the rope's point ${i / 3} is not a number`);
        break;
      }
      const floor = (inside(x, y) ? -bedDepth(x, y) : lake.ground(x, y)) + ROPE.aboveGround;
      if (i > 0 && i < last && z < floor - 1e-6)
        ropeWrong.push(
          `the rope's point ${i / 3} is under the ground at ${x.toFixed(1)},${y.toFixed(1)}, ${z.toFixed(2)} against ${floor.toFixed(2)}`,
        );
    }
    for (const [name, at, ends] of [
      ['first', 0, game.lineStart],
      ['last', last, game.lineEnd],
    ] as const)
      for (let k = 0; k < 3; k++)
        if (points[at + k] !== ends[k]) {
          ropeWrong.push(`the rope's ${name} point is not where the line is pinned`);
          break;
        }
    report(ropeWrong);
  }

  out.push(...fishingRules(game));

  if (!(game.contamination >= 0 && game.contamination <= 1)) out.push(`the contamination is ${game.contamination}`);
  // it only ever goes down, the cure's doing: it rises only where the lever (the test API's, the fuzzer's start) was set
  const was = seen.get(game);
  if (was && was.levers === game.levers && game.contamination > was.contamination)
    out.push(`the contamination rose from ${was.contamination} to ${game.contamination}, and no lever was set`);
  // and unless the lever has set it, it is exactly what the formula says of the fish cured and the drums hauled
  if (game.levers === 0) {
    const { cured, drums } = game.progress.entry(game.lake.id);
    const truth = lake.contaminationAfter(cured, drums);
    if (Math.abs(game.contamination - truth) > 1e-9)
      out.push(`the contamination is ${game.contamination}, but ${cured} cured and ${drums} hauled make it ${truth}`);
  }
  // the water the page shows lies between the truth and sick, and like the truth it only falls but by the lever
  if (!(game.waterDirt >= 0 && game.waterDirt <= 1)) out.push(`the water's dirt is ${game.waterDirt}`);
  else if (game.waterDirt < game.contamination)
    out.push(`the water is cleaner than the lake: ${game.waterDirt} against ${game.contamination}`);
  if (was && was.levers === game.levers && game.waterDirt > was.waterDirt)
    out.push(`the water's dirt rose from ${was.waterDirt} to ${game.waterDirt}, and no lever was set`);
  // the weather is one of the kinds, and the day's own unless the lever set it
  if (!(WEATHER.kinds as readonly string[]).includes(game.weather)) out.push(`the weather is ${game.weather}`);
  else if (game.still && game.place === 'pond') {
    if (game.weather !== game.still.photo.weather)
      out.push(`the weather is ${game.weather}, but the photograph looked at was taken in ${game.still.photo.weather}`);
  } else if (game.levers === 0 && game.weather !== weatherOf(game.day))
    out.push(`the weather is ${game.weather}, but day ${game.day} is ${weatherOf(game.day)}, and no lever was set`);
  if (game.still) {
    const { index, photo, timeBefore } = game.still;
    const { photos } = game.progress.save;
    if (!(index >= 0 && index < photos.length))
      out.push(`the still is of photograph ${index}, of an album of ${photos.length}`);
    else if (photos[index].lake !== game.lake.id)
      out.push(`the still is of photograph ${index}, taken at ${photos[index].lake}, not ${game.lake.id}`);
    else if (photos[index] !== photo) out.push(`the still shows a photograph that is not the album's ${index}`);
    if (!(timeBefore >= 0 && timeBefore < 1)) out.push(`the still remembers the clock at ${timeBefore}`);
  }
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
  const { cured } = game.progress.entry(game.lake.id);
  if (!Number.isSafeInteger(cured) || cured < 0) out.push(`the lake has cured ${cured} fish`);
  else if (fish.curedCount() !== Math.min(cured, lake.fishCount))
    out.push(`${fish.curedCount()} fish are cured, but the save says ${cured}, of ${lake.fishCount} in the lake`);
  // the gifts in force are the ones the count has earned, and nothing else; the zone a fight plays is that gear's width
  // (a fight under way keeps its own, so only a line at rest is held to the gear in force)
  const total = game.progress.curedTotal();
  if (total < cured) out.push(`${cured} are cured here, but the lakes together say ${total}`);
  const gear = gearFor(total);
  for (const g of GEAR)
    if (game.gear[g.id] !== gear[g.id])
      out.push(`the ${g.id} is ${game.gear[g.id] ? 'held' : 'not held'}, but ${total} cured earns it ${gear[g.id]}`);
  if (game.bite.gear !== game.gear) out.push('the bite has not the gear the game holds');
  // the drums hauled are a count from none to the pond's, the save's, and each is gone from the bed for good
  const mine = game.progress.entry(game.lake.id);
  const hauled = game.drums.foundCount();
  if (!Number.isSafeInteger(mine.drums) || mine.drums < 0) out.push(`the save says ${mine.drums} drums hauled`);
  else if (hauled < 0 || hauled > lake.drums.count)
    out.push(`${hauled} drums are hauled, of ${lake.drums.count} in the lake`);
  else if (hauled !== mine.drums) out.push(`${hauled} drums are hauled, but the save says ${mine.drums}`);
  lakesRules(game, out);
  journalRules(game, out);
  treasureRules(game, out);
  requestRules(game, out);
  photoRules(game, out);
  tallyRules(game, out);
  if (!(game.timeOfDay >= 0 && game.timeOfDay < 1)) out.push(`the time of day is ${game.timeOfDay}`);
  return out;
}

/**
 * The save's lakes. The lake the player is at is one the game has, and
 * every entry is for a lake the game has and holds its counts: the cured a whole number, the drums within the lake's own
 * and the treasures known to it, each once and no more than it has. The game's own counts are checked against its entry
 * above, since the game writes no other.
 */
function lakesRules(game: Game, out: string[]) {
  const { save, lakes } = game.progress;
  if (!Object.hasOwn(lakes, save.lake)) out.push(`the save is at a lake not known: ${String(save.lake)}`);
  for (const [id, e] of Object.entries(save.lakes)) {
    if (!Object.hasOwn(lakes, id)) {
      out.push(`the save has an entry for a lake not known: ${id}`);
      continue;
    }
    const lake = lakes[id];
    if (!Number.isSafeInteger(e.cured) || e.cured < 0) out.push(`${id} has ${e.cured} cured`);
    if (!Number.isSafeInteger(e.drums) || e.drums < 0 || e.drums > lake.drums.count)
      out.push(`${id} has ${e.drums} drums hauled, of ${lake.drums.count}`);
    const known = new Set<string>(lake.treasures.list.map((t) => t.id));
    if (!Array.isArray(e.found) || new Set(e.found).size !== e.found.length || e.found.some((f) => !known.has(f)))
      out.push(`${id} has treasures found that are not its own, or twice`);
  }
}

/**
 * The day's end: the day a whole number from one, never back and the save's; the place one of four; the fade within
 * nought and one; and away from the pond, in the cabin, yawning and leaving, the lake held still (the time, the clock and every
 * fish where they were when the rules were last asked in the same place), the lure ready, no fish hooked or landed, and
 * (the clock held wherever the player walked in).
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
  // a yawn sleeps through a whole number of nights, one to a round of the moon, and is back to one once it is over
  if (!Number.isInteger(game.nights) || game.nights < 1 || game.nights > MOON.days)
    out.push(`the yawn sleeps through ${game.nights} nights`);
  else if (place !== 'yawning' && game.nights !== 1)
    out.push(`${game.nights} nights are kept, with the player ${place}`);
  const { time } = game.progress.save;
  const kept: string = game.progress.save.place;
  if (!(Number.isFinite(time) && time >= 0 && time < 1)) out.push(`the save says the time is ${time}`);
  if (kept !== 'pond' && kept !== 'cabin') out.push(`the save says the player is at ${String(kept)}`);
  if (!['pond', 'yawning', 'cabin', 'leaving'].includes(place)) return [...out, `the player is at ${String(place)}`];
  const fade = game.fade();
  if (!(fade >= 0 && fade <= 1)) out.push(`the fade is ${fade}`);
  if (place === 'pond') return out;
  if (game.lure.phase !== 'ready') out.push(`the lure is ${game.lure.phase}, with the player ${place}`);
  if (game.bite.phase === 'hooked' || game.bite.phase === 'landed')
    out.push(`a fish is ${game.bite.phase}, with the player ${place}`);
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
    // a kind with hours is not drawn to the lure outside them; a hooked or landed one is allowed, since the gate is the
    // bite's and a fight that runs past the hour is played out
    if (!awake(KINDS[fish.kind[i]], game.timeOfDay) && !(bite.phase === 'hooked' || bite.phase === 'landed'))
      out.push(`fish ${i} is asleep, but it is the bite's (${bite.phase})`);
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
