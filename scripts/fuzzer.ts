/**
 * The lake played by a monkey: the real lake, without the picture, made to
 * do at random everything a player can make happen in it (for now, letting
 * time pass, pausing, the lab's two levers, dropping pebbles on the water and
 * off it, casting and reeling in, and saving and loading) and checked after every few
 * frames for anything that must always hold and does not (`invariants.ts`),
 * and for anything thrown.
 *
 * Only what a player could do. A monkey that did what no player can would
 * find bugs no player will. A new thing a player can do gets an action here.
 *
 * From a seed, so a failure can be played again exactly: `npm run fuzz --
 * --seed N` does, and prints what was done before it went wrong.
 */
import { careful } from '../src/angler';
import type { BedFinds } from '../src/bedfinds';
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { aimAt } from '../src/cast';
import { seasonOf } from '../src/calendar';
import { GEAR, KINDS, MOON, PHOTOS, WEATHER } from '../src/lake';
import { nearestTime } from '../src/look';
import type { Photo } from '../src/photo';
import { LAKES, lakeNamed } from '../src/lakes';
import { seeded } from '../src/random';
import { REQUESTS } from '../src/town/requests';
import { newCounts, phoneMonkey, type PhoneMonkey } from './phonemonkey';

const DT = 1 / 60;
/** How many frames between checks, when nothing has just been done; after anything done, the check is at once. */
const CHECK_EVERY = 10;
/** How many frames the monkey stays in the cabin, at most, before it goes down to the pond. */
const CABIN_STAY = 90;
/** How many of the last things done a failure reports. */
const LOG_TAIL = 25;

export interface FuzzFailure {
  seed: number;
  frame: number;
  problems: string[];
  /** The last things done before it, oldest first. */
  log: string[];
}

export interface FuzzResult {
  seed: number;
  frames: number;
  failure: FuzzFailure | null;
  /** How often each thing was done, and each event happened: to see that the monkey got about. */
  done: Record<string, number>;
  happened: Record<string, number>;
}

/** Play `frames` frames of the game at random from `seed`, in the lake `lakeId` names or, by default, the one the seed draws from a stream of its own. */
export function fuzz(seed: number, frames: number, lakeId?: string): FuzzResult {
  // the monkey's own chance, apart from the game's, so what it decides does not shift what the game does
  const random = seeded(seed * 7 + 1);
  const done: Record<string, number> = {};
  // every event the monkey can make happen, from nought, so one it never made shows as nought and not as missing
  const happened: Record<string, number> = {
    splashed: 0,
    nibbled: 0,
    bitten: 0,
    hooked: 0,
    missed: 0,
    slipped: 0,
    landed: 0,
    cured: 0,
    gifted: 0,
    yawned: 0,
    woke: 0,
    hauled: 0,
    found: 0,
  };
  // whether the player has gone to bed by choice and not yet woken, to tell a waking by bed from one at midnight
  const bed = { chosen: false };
  const count = (what: string) => () => {
    happened[what]++;
  };
  const events: GameEvents = {
    splashed: count('splashed'),
    nibbled: count('nibbled'),
    bitten: count('bitten'),
    hooked: count('hooked'),
    missed: count('missed'),
    slipped: count('slipped'),
    landed: count('landed'),
    cured: count('cured'),
    gifted: count('gifted'),
    yawned: count('yawned'),
    hauled: count('hauled'),
    found: count('found'),
    // a waking is counted by how it came: a bed chosen (the action sets `bed`), or midnight
    woke: () => {
      happened.woke++;
      done[bed.chosen ? 'woke from bed' : 'woke at midnight'] =
        (done[bed.chosen ? 'woke from bed' : 'woke at midnight'] ?? 0) + 1;
      bed.chosen = false;
    },
  };
  const log: string[] = [];
  let frame = 0;
  const fail = (problems: string[]): FuzzResult => ({
    seed,
    frames: frame,
    failure: { seed, frame, problems, log: log.slice(-LOG_TAIL) },
    done,
    happened,
  });

  // the lake the monkey plays in, drawn from a stream of its own (half the seeds at each) so none of the monkey's other
  // chance moves; its figures are those its saves are drawn from
  const lakeIds = Object.keys(LAKES);
  const lake = lakeNamed(lakeId ?? lakeIds[Math.floor(seeded(seed * 31 + 9)() * lakeIds.length)]);
  done[`lake ${lake.id}`] = 1;
  try {
    // a returning player loads a save with fish already cured, so the lake starts anywhere from none cured to clean.
    // The count is drawn from a stream of its own, so it moves none of the monkey's other chance: two in five seeds
    // start with none cured, one in five clean, one in five one to three short of it and the rest anywhere between
    const curedAtStart = (() => {
      const pick = seeded(seed * 13 + 5);
      const u = pick();
      if (u < 0.4) return 0;
      if (u < 0.6) return lake.fishCount;
      if (u < 0.8) return lake.fishCount - 1 - Math.floor(pick() * 3);
      return 1 + Math.floor(pick() * (lake.fishCount - 1));
    })();
    done['start cured'] = curedAtStart;
    // the gifts the part-cured start already holds, so some seeds fish with gear from the first frame
    done['start gifts'] = GEAR.filter((g) => curedAtStart >= g.at).length;
    // a returning player's drums and journal, from a stream of their own as well: every fish cured has its drums hauled, or all but one;
    // any other pond has none to every drum hauled; seven saves in ten keep a journal, which says
    // of some of the cured what kind each was, and the rest are an old save's, cured in slot order
    const { drumsAtStart, journalAtStart } = (() => {
      const pick = seeded(seed * 17 + 3);
      // every fish cured leaves the pond clean only if the drums are hauled too: half of those starts leave one on the bed
      const drums =
        curedAtStart === lake.fishCount
          ? lake.drums.count - (pick() < 0.5 ? 1 : 0)
          : Math.floor(pick() * (lake.drums.count + 1));
      const journal: Record<string, { caught: number; best: number; first: number }> = {};
      if (pick() < 0.7) {
        const room = KINDS.map((_, i) => lake.fishKinds.filter((f) => f === i).length);
        for (let n = 0; n < curedAtStart; n++) {
          const k = Math.floor(pick() * KINDS.length);
          if (room[k] < 1) continue;
          room[k]--;
          const [least, most] = KINDS[k].weight;
          const e = (journal[KINDS[k].id] ??= { caught: 0, best: least + pick() * (most - least), first: 1 });
          e.caught++;
        }
      }
      return { drumsAtStart: drums, journalAtStart: journal };
    })();
    done['start drums'] = drumsAtStart;
    done['start journal'] = Object.keys(journalAtStart).length;
    // the treasures a returning player has found and kept, from a stream of its own again: half the seeds none, the rest
    // some of the six, in an order of their own, so the shelves and the bed start in every mix
    const foundAtStart = (() => {
      const pick = seeded(seed * 19 + 11);
      if (pick() < 0.5) return [];
      const ids = lake.treasures.list.map((t) => t.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(pick() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, 1 + Math.floor(pick() * ids.length));
    })();
    done['start found'] = foundAtStart.length;
    // where in the day and where in the world a returning player starts, from a stream of its own again so no other draw
    // moves: a fifth of the seeds start in the cabin (at the time they say, held there), the rest are at the pond at any
    // time of day, midnight's edge included, and the cabin's start has to be left by the door as a wake is
    const { timeAtStart, placeAtStart } = (() => {
      const pick = seeded(seed * 23 + 5);
      const time = pick();
      // a lake with no cabin has no room to wake in, so a start there is at the pond
      return { timeAtStart: time, placeAtStart: pick() < 0.2 && lake.cabin ? ('cabin' as const) : ('pond' as const) };
    })();
    done['start in the cabin'] = placeAtStart === 'cabin' ? 1 : 0;
    // the day a returning player is on, across a year and a fortnight over so every season is played and the year comes
    // round, from a stream of its own drawn after the others so none of theirs moves
    const dayAtStart = 1 + Math.floor(seeded(seed * 29 + 7)() * 70);
    done[`start in ${seasonOf(dayAtStart)}`] = 1;
    const startSave = {
      lake: lake.id,
      lakes: {
        [lake.id]: { cured: curedAtStart, drums: drumsAtStart, journal: journalAtStart, found: foundAtStart },
      },
      time: timeAtStart,
      place: placeAtStart,
      day: dayAtStart,
    };
    // the town's requests a returning player has answered, from a stream of its own: two seeds in five start with a
    // prefix of the list marked, and only those the start save meets, so the rule that an answered request is met holds
    const requestsAtStart = (() => {
      const pick = seeded(seed * 41 + 13);
      if (pick() >= 0.4) return [];
      const met = new Progress(memoryStore(JSON.stringify(startSave)), LAKES).save;
      const prefix = REQUESTS.slice(0, Math.floor(pick() * (REQUESTS.length + 1)));
      return prefix.filter((r) => r.met(met, LAKES)).map((r) => r.id);
    })();
    done['start requests'] = requestsAtStart.length;
    // the album a returning player holds, from a stream of its own again: half the seeds none, a quarter full and the
    // rest part full, so a photograph is refused at the twelfth in some seeds and the album grows in the others
    const photosAtStart: Photo[] = (() => {
      const pick = seeded(seed * 47 + 3);
      const u = pick();
      if (u < 0.5) return [];
      const count = u < 0.75 ? PHOTOS.most : 1 + Math.floor(pick() * (PHOTOS.most - 1));
      const ids = lake.fishKinds.map((k) => KINDS[k].id);
      return Array.from({ length: count }, () => ({
        lake: lake.id,
        day: 1 + Math.floor(pick() * dayAtStart),
        time: pick() * 0.999,
        weather: WEATHER.kinds[Math.floor(pick() * WEATHER.kinds.length)],
        view: {
          x: pick() * 10 - 5,
          y: pick() * 10 - 5,
          z: pick() * 4,
          azimuth: pick() * 6,
          polar: 0.4 + pick(),
          radius: 20 + pick() * 40,
        },
        kinds: [...new Set(ids.filter(() => pick() < 0.3))],
        lit: pick() < 0.3,
      }));
    })();
    done['start photos'] = photosAtStart.length;
    let store = memoryStore(JSON.stringify({ ...startSave, requests: requestsAtStart, photos: photosAtStart }));
    let game = new Game(new Progress(store, LAKES), { lake, random: seeded(seed), events });
    // the lake starts as dirty as chance says, now and then a value no one should send (the test API's lever, which
    // the page hands on whatever it reads), and then only the cure lowers it: nothing raises it in play
    {
      const start = random() < 0.25 ? [NaN, -1, 2, Infinity][Math.floor(random() * 4)] : random();
      game.setContamination(start);
      done['dirt'] = 1;
    }
    // in an object, since the actions change it from inside closures the type checker cannot follow
    const page = { paused: false, watching: 0, careless: false, holding: false };
    // a phone at random over whichever game is current, new with each reload as a new page's would be
    const phoned = newCounts();
    const makePhone = () => phoneMonkey(() => game, random, phoned);
    let phone: PhoneMonkey = makePhone();
    let busy = 0;
    let snagged = false;
    let treasureSnagged = false;
    // the frames since the player woke in the cabin; one who stays too long goes down to the pond
    let inCabin = 0;
    const between = (a: number, b: number) => a + random() * (b - a);
    // what the clean pond saw, from nought so a monkey that never reached it shows as nought and not as missing
    done['clean frames'] = 0;
    done['clean casts'] = 0;
    for (const what of [
      'lie on the bed',
      'drum snagged',
      'pond cleaned by a haul',
      'lie by a treasure',
      'treasure snagged',
      'treasure kept',
      'treasure snagged in a clean pond',
    ])
      done[what] = 0;
    for (const what of ['photograph', 'photograph refused', 'discard', 'discard refused', 'look at', 'look at refused'])
      done[what] = 0;
    for (const k of KINDS) done[`caught ${k.id}`] = 0;
    done['bites in a clean pond'] = 0;
    done['most cured'] = 0;
    // the night, from nought so a monkey that never reached it shows as nought and not as missing
    for (const what of [
      'woke at midnight',
      'woke from bed',
      'bed refused',
      'into the cabin',
      'into the cabin refused',
      'slept through',
      'sleep through refused',
      'down to the pond',
      'frames in the cabin',
    ])
      done[what] = 0;
    /** A cast, counted when it is thrown into a pond with no uncured fish left. */
    const cast = (angle: number, power: number) => {
      const into = game.pondClean;
      if (game.cast(angle, power) && into) done['clean casts']++;
    };
    // which set a cast to the bed is aimed at is decided from a stream of its own, so the monkey's own chance is drawn
    // as it was before there were treasures: the same seeds still fish the same water, and a treasure aimed at only
    // changes where the lure lies
    const aiming = seeded(seed * 23 + 9);
    // the weather's lever is set from a stream of its own too, so the monkey's chance is drawn as it was before it
    const weathering = seeded(seed * 29 + 13);
    /**
     * A cast aimed at a drum or a treasure still on the bed (a spot of either, if every one is found) and left to sink and
     * lie there: nine times in ten at the drums, if any is left on the bed, and the rest at the treasures.
     */
    const castToBed = () => {
      const open = (set: BedFinds) => Array.from({ length: set.count }, (_, i) => i).filter((i) => !set.found[i]);
      const [drums, treasures] = [open(game.drums), open(game.treasures)];
      const toDrums = drums.length > 0 && (treasures.length === 0 || aiming() < 0.9);
      const set = toDrums || treasures.length === 0 ? game.drums : game.treasures;
      const pool = toDrums ? drums : treasures;
      const i = pool.length ? pool[Math.floor(random() * pool.length)] : Math.floor(random() * set.count);
      if (set === game.treasures) done['lie by a treasure']++;
      const { angle, power } = aimAt(set.x[i] + between(-1, 1), set.y[i] + between(-1, 1));
      cast(angle, power);
    };
    /** What is landed taken in: a fish stowed, counted by its kind, or a drum hauled; false when nothing was landed. */
    const land = (): boolean => {
      const i = game.bite.fish;
      const kind = i >= 0 ? KINDS[game.fish.kind[i]].id : '';
      if (game.stow()) {
        done[`caught ${kind}`] = (done[`caught ${kind}`] ?? 0) + 1;
        return true;
      }
      if (game.haul()) {
        if (game.pondClean) done['pond cleaned by a haul']++;
        return true;
      }
      if (!game.keep()) return false;
      done['treasure kept']++;
      return true;
    };
    const did = (what: string) => {
      done[what] = (done[what] ?? 0) + 1;
      log.push(`frame ${frame}: ${what}`);
    };
    /** Everything a player can make happen, each as often as it is weighted. */
    const actions: [number, () => void][] = [
      [
        6,
        () => {
          page.paused = false;
          busy = Math.floor(between(20, 240));
          did('wait');
        },
      ],
      [
        2,
        () => {
          // a paused lake is stepped no time at all, as the page does while it is paused
          page.paused = true;
          busy = Math.floor(between(10, 120));
          did('pause');
        },
      ],
      [
        2,
        () => {
          // one of the four times of day, or anywhere between, as the test API may say; the clock runs on from it
          // the test API refuses the clock away from the pond, where time is stopped, so the monkey does not set it there
          if (game.place !== 'pond') return did('time refused');
          // a fifth of the time just short of midnight, so the day's end is reached in a seed's few frames
          const u = random();
          game.setTimeOfDay(
            u < 0.2
              ? 1 - between(0.0005, 0.04)
              : u < 0.6
                ? [0, 0.25, 0.5, 0.75][Math.floor(random() * 4)]
                : random() * 1.2 - 0.1,
          );
          did('time');
        },
      ],
      [
        2,
        () => {
          // a tap anywhere on the screen lands anywhere, on the water or off it, or now and then at a point that is no number
          const odd = random() < 0.08;
          game.drop(odd ? NaN : between(-60, 60), between(-45, 45), odd ? 1 : between(0.5, 2));
          did('drop');
        },
      ],
      [
        3,
        () => {
          // a cast any way round at any power, a drag let go anywhere, or now and then a value that is no number
          const odd = random() < 0.05;
          cast(odd ? NaN : between(-Math.PI, Math.PI), odd ? 0.5 : between(0, 1.2));
          busy = Math.floor(between(30, 300));
          did('cast');
        },
      ],
      [
        2,
        () => {
          // a cast left to sink to the bed by a drum, where it may snag
          castToBed();
          busy = Math.floor(between(120, 600));
          did('lie on the bed');
        },
      ],
      [
        1,
        () => {
          game.reelIn();
          did('reel in');
        },
      ],
      [
        2,
        () => {
          // a tap at any moment: on a bite, a nibble, nothing at all, or the lure not even in the water
          game.strike();
          did('strike');
        },
      ],
      [
        2,
        () => {
          // the reel held or let go, at random, whatever is on the line
          game.reel(random() < 0.5);
          did('reel');
        },
      ],
      [
        1,
        () => {
          // a landed drum is hauled where a landed fish is stowed, so a drum snagged does not hold the rod for good
          land();
          did('stow');
        },
      ],
      [
        3,
        () => {
          // an angler who watches for a while, a few seconds to half a minute: every frame of it, strikes on the dip
          // and plays a fish on the line by the bar, carefully or not, as someone fishing does, and stows what is landed
          page.watching = Math.floor(between(300, 1800));
          // as careful a hand as the pace gate's, or a careless one that holds and lets go with no eye on the bar
          page.careless = random() < 0.5;
          did('angle');
        },
      ],
      [
        1,
        () => {
          // a pebble near wherever the camera looks
          game.dropNear(between(-40, 40), between(-30, 30));
          did('drop near');
        },
      ],
      [
        0.5,
        () => {
          // to bed early: from the pond or the cabin, and now and then in the middle of a fight, where it is refused and
          // must change nothing at all
          const fighting = game.bite.phase === 'hooked' || game.bite.phase === 'landed';
          const was = nightState(game);
          if (game.sleep()) bed.chosen = true;
          else if (fighting) {
            done['bed refused']++;
            if (nightState(game) !== was)
              throw new Error(`a bed refused mid-fight changed the game: ${was} then ${nightState(game)}`);
          }
          did('go to bed');
        },
      ],
      [
        0.5,
        () => {
          // sleeping through a few nights, refused as the bed is (mid-fight, yawning) and then to change nothing at all
          const fighting = game.bite.phase === 'hooked' || game.bite.phase === 'landed';
          const was = nightState(game);
          // the number of nights is the frame's, so as not to draw from the stream the other actions are chosen by
          const nights = 1 + (frame % MOON.days);
          if (game.sleepThrough(nights)) {
            bed.chosen = true;
            done['slept through']++;
          } else if (fighting) {
            done['sleep through refused']++;
            if (nightState(game) !== was)
              throw new Error(`a sleep through refused mid-fight changed the game: ${was} then ${nightState(game)}`);
          }
          did('sleep through');
        },
      ],
      [
        2,
        () => {
          // down from the cabin to the pond, or the door tried from the pond or mid-yawn, where it does nothing
          const was = nightState(game);
          const from = game.place;
          const went = game.out();
          if (went) done['down to the pond']++;
          else if (from !== 'cabin' && nightState(game) !== was)
            throw new Error(`the door changed the game from the ${from}`);
          did('down to the pond');
        },
      ],
      [
        1,
        () => {
          // saved, and loaded again into a new lake as a reload would: what was saved must be kept
          game.persist();
          const was = JSON.stringify(game.progress.save);
          const written = { place: game.progress.save.place, time: game.progress.save.time };
          store = memoryStore(store.json);
          game = new Game(new Progress(store, LAKES), { lake, random: seeded(seed + frame), events });
          const now = JSON.stringify(game.progress.save);
          if (now !== was) throw new Error(`the save was ${was} and loaded as ${now}`);
          // the lake opens where the save said, not where the game was: a reload mid-yawn gives the earlier place and
          // time by design
          if (game.place !== written.place)
            throw new Error(`the save said ${written.place} and the game opened in the ${game.place}`);
          if (game.timeOfDay !== written.time)
            throw new Error(`the save said ${written.time} o'clock and the game opened at ${game.timeOfDay}`);
          const reloaded = checkInvariants(game);
          if (reloaded.length) return fail(reloaded.map((p) => `after a reload: ${p}`));
          phone = makePhone();
          bed.chosen = false;
          inCabin = 0;
          did('reload');
        },
      ],
      [
        6,
        () => {
          // a phone's pad, tilt and flick, or a message a stranger might send, through the gesture rules
          const what = phone.start(frame);
          if (what) did(what);
        },
      ],
    ];
    /**
     * Into the cabin by day. Chosen from a stream of its own, in place of the action the main stream picked, at the
     * weight of the bed (a half), so that no other draw of the monkey moves and the coverage the other seeds reach holds.
     */
    const walkIn = () => {
      // into the cabin by day: from the pond, and now and then mid-fight, yawning or in the cabin already, where it
      // is refused as the bed is and must change nothing at all; the clock is held there and the door lets it out
      const fighting = game.bite.phase === 'hooked' || game.bite.phase === 'landed';
      const was = nightState(game);
      const clock = game.timeOfDay;
      const from = game.place;
      if (game.enter()) {
        done['into the cabin']++;
        inCabin = 0;
        if (game.timeOfDay !== clock) throw new Error(`walking in moved the clock from ${clock} to ${game.timeOfDay}`);
      } else {
        done['into the cabin refused']++;
        if (nightState(game) !== was)
          throw new Error(`walking in, refused ${fighting ? 'mid-fight' : `from the ${from}`}, changed the game`);
      }
      did('into the cabin');
    };
    /**
     * The weather's lever put to any of the five, or let go to the day's own: a player cannot, the pictures do, and the
     * rules must hold through it, at the pond and in the cabin alike. It stands outside the weighted list, picked by a
     * stream of its own at a weight of a half like the walk in, so the seeds that were played before it still play the same.
     */
    const setWeather = () => {
      const u = Math.floor(weathering() * (WEATHER.kinds.length + 1));
      game.setWeather(u < WEATHER.kinds.length ? WEATHER.kinds[u] : null);
      did('weather lever');
    };
    /**
     * A photograph taken, or one discarded, from a stream of its own at a weight of a half like the walk in, so the seeds
     * played before it play the same: the subjects are a view of finite numbers and kinds drawn at random from the lake's
     * own ids, lit when the clock's look is night. A discard is of any index, or the one past the end, which is refused.
     * A photograph refused at a full album must change nothing, and one taken must leave the album a place longer.
     */
    const snapping = seeded(seed * 43 + 19);
    const snap = () => {
      const was = JSON.stringify(game.progress.save.photos);
      const length = game.progress.save.photos.length;
      const ids = [...new Set(lake.fishKinds.map((k) => KINDS[k].id))];
      const view = {
        x: snapping() * 40 - 20,
        y: snapping() * 40 - 20,
        z: snapping() * 10,
        azimuth: snapping() * 6.3,
        polar: 0.3 + snapping(),
        radius: 5 + snapping() * 80,
      };
      const kinds = ids.filter(() => snapping() < 0.4);
      const lit = nearestTime(game.timeOfDay).name === 'night';
      if (game.photograph({ view, kinds, lit })) {
        done['photograph']++;
        if (game.progress.save.photos.length !== length + 1) throw new Error('a photograph did not join the album');
      } else {
        done['photograph refused']++;
        const away = game.place !== 'pond' && game.place !== 'cabin';
        if ((length >= PHOTOS.most || away) && JSON.stringify(game.progress.save.photos) !== was)
          throw new Error('a photograph refused changed the album');
        if (length < PHOTOS.most && !away) throw new Error('a photograph was refused with room in the album');
      }
      did('photograph');
    };
    const discard = () => {
      const length = game.progress.save.photos.length;
      const index = Math.floor(snapping() * (length + 1));
      if (game.discard(index)) {
        done['discard']++;
        if (game.progress.save.photos.length !== length - 1) throw new Error('a discard did not shorten the album');
      } else {
        done['discard refused']++;
        if (index < length) throw new Error(`a discard of ${index} was refused in an album of ${length}`);
        if (game.progress.save.photos.length !== length) throw new Error('a discard refused changed the album');
      }
      did('discard');
    };
    /**
     * A photograph looked at and put down again in the one action, from a stream of its own so the seeds played before
     * it play the same: of any index in the album or the one past its end. A look that is granted must leave the game
     * holding (a few frames stepped, the game's time and the clock unchanged) and a look away must give back the
     * clock; one refused must change neither the place, the time nor the clock.
     */
    const looking = seeded(seed * 59 + 23);
    const lookAtOne = () => {
      const index = Math.floor(looking() * (game.progress.save.photos.length + 1));
      const was = { t: game.t, clock: game.timeOfDay, place: game.place, day: game.day };
      if (game.lookAt(index)) {
        done['look at']++;
        if (game.still?.index !== index) throw new Error(`a look at ${index} left the still at ${game.still?.index}`);
        const looked = game.timeOfDay;
        for (let f = 0; f < 3; f++) game.step(DT);
        if (game.t !== was.t || game.timeOfDay !== looked)
          throw new Error('the game moved while a photograph was looked at');
        if (!game.lookAway() || (game as { still: unknown }).still !== null)
          throw new Error('a photograph looked at could not be put down');
        if (game.timeOfDay !== was.clock || game.place !== was.place || game.day !== was.day)
          throw new Error('looking at a photograph and away again changed the clock, the place or the day');
      } else {
        done['look at refused']++;
        if (game.still) throw new Error('a look refused left a still');
        if (game.t !== was.t || game.timeOfDay !== was.clock || game.place !== was.place)
          throw new Error('a look refused changed the game');
      }
      did('look at');
    };
    const walker = seeded(seed * 37 + 11);
    const chooser = seeded(seed * 53 + 7);
    const pickWeather = seeded(seed * 41 + 17);
    const total = actions.reduce((n, [w]) => n + w, 0);
    const act = () => {
      let pick = random() * total;
      if (walker() < 0.5 / (total + 0.5)) return walkIn();
      if (pickWeather() < 0.5 / (total + 0.5)) return setWeather();
      if (chooser() < 0.3 / (total + 0.3)) return snapping() < 0.7 ? snap() : discard();
      if (looking() < 0.3 / (total + 0.3)) return lookAtOne();
      for (const [w, go] of actions) {
        if ((pick -= w) < 0) return go();
      }
    };

    for (frame = 1; frame <= frames; frame++) {
      let acted = false;
      if (page.watching > 0) {
        page.watching--;
        if (game.bite.phase === 'biting') game.strike();
        if (game.bite.phase === 'hooked') {
          if (!page.careless)
            game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt, game.line.figures.width));
          else {
            if (random() < 0.05) page.holding = !page.holding;
            game.reel(page.holding);
          }
        }
        if (game.bite.phase === 'landed') land();
        if (game.lure.phase === 'ready' || game.lure.phase === 'lying') {
          // now and then the lure is thrown to lie by a drum, where the bed is reached; mostly out to the fish
          if (random() < 0.3) {
            castToBed();
            done['lie on the bed']++;
          } else cast(Math.PI / 2 + between(-0.4, 0.4), between(0.45, 0.8));
        }
      } else if (busy > 0) busy--;
      else {
        act();
        acted = true;
      }
      phone.tick(frame);
      // the player does not stay in the cabin for the rest of the game: after a moment the door is tried
      if (game.place === 'cabin') {
        done['frames in the cabin']++;
        if (++inCabin > CABIN_STAY) {
          game.out();
          done['down to the pond']++;
          did('leave the cabin');
          inCabin = 0;
        }
      } else inCabin = 0;
      game.step(page.paused ? 0 : DT);
      if (game.bite.drum >= 0 && !snagged) done['drum snagged']++;
      snagged = game.bite.drum >= 0;
      if (game.bite.treasure >= 0 && !treasureSnagged) {
        done['treasure snagged']++;
        if (game.pondClean) done['treasure snagged in a clean pond']++;
      }
      treasureSnagged = game.bite.treasure >= 0;
      done['most cured'] = Math.max(done['most cured'], game.fish.curedCount());
      if (game.pondClean) {
        done['clean frames']++;
        // no fish takes the bait in a clean pond: none is ever coming, nibbling, biting, hooked or landed there. A treasure
        // may be snagged there, which is counted apart, and so is no bite of a fish
        if (game.bite.phase !== 'none' && game.bite.fish >= 0) done['bites in a clean pond']++;
      }
      // after everything done, and every few frames between: a bad value set and set again at once is never seen
      if (acted || frame % CHECK_EVERY === 0) {
        const problems = checkInvariants(game);
        if (problems.length) return fail(problems);
      }
    }
    for (const what of ['cast', 'strike', 'reel', 'refused'] as const)
      if (phoned[what]) done[`phone ${what}`] = phoned[what];
    return { seed, frames, failure: null, done, happened };
  } catch (err) {
    return fail([`threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`]);
  }
}

/** What a refused bed or a door that opens nothing must leave alone, as one string to compare. */
function nightState(game: Game): string {
  return [game.place, game.day, game.t, game.timeOfDay, game.bite.phase, game.lure.phase, game.splashes.count].join(
    ' ',
  );
}
