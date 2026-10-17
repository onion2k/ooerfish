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
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { newCounts, phoneMonkey, type PhoneMonkey } from './phonemonkey';

const DT = 1 / 60;
/** How many frames between checks, when nothing has just been done; after anything done, the check is at once. */
const CHECK_EVERY = 10;
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

/** Play `frames` frames of the game at random from `seed`. */
export function fuzz(seed: number, frames: number): FuzzResult {
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
  };
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

  try {
    let store = memoryStore();
    let game = new Game(new Progress(store), { random: seeded(seed), events });
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
    const between = (a: number, b: number) => a + random() * (b - a);
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
          game.setTimeOfDay(random() < 0.5 ? [0, 0.25, 0.5, 0.75][Math.floor(random() * 4)] : random() * 1.2 - 0.1);
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
          game.cast(odd ? NaN : between(-Math.PI, Math.PI), odd ? 0.5 : between(0, 1.2));
          busy = Math.floor(between(30, 300));
          did('cast');
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
          game.stow();
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
        1,
        () => {
          // saved, and loaded again into a new lake as a reload would: what was saved must be kept
          game.persist();
          const was = JSON.stringify(game.progress.save);
          store = memoryStore(store.json);
          game = new Game(new Progress(store), { random: seeded(seed + frame), events });
          const now = JSON.stringify(game.progress.save);
          if (now !== was) throw new Error(`the save was ${was} and loaded as ${now}`);
          phone = makePhone();
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
    const total = actions.reduce((n, [w]) => n + w, 0);
    const act = () => {
      let pick = random() * total;
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
          if (!page.careless) game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt));
          else {
            if (random() < 0.05) page.holding = !page.holding;
            game.reel(page.holding);
          }
        }
        if (game.bite.phase === 'landed') game.stow();
        if (game.lure.phase === 'ready' || game.lure.phase === 'lying')
          game.cast(Math.PI / 2 + between(-0.4, 0.4), between(0.45, 0.8));
      } else if (busy > 0) busy--;
      else {
        act();
        acted = true;
      }
      phone.tick(frame);
      game.step(page.paused ? 0 : DT);
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
