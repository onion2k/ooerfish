/**
 * The lake played by a monkey: the real lake, without the picture, made to
 * do at random everything a player can make happen in it (for now, letting
 * time pass, pausing, the lab's two levers, dropping pebbles on the water and
 * off it, and saving and loading) and checked after every few
 * frames for anything that must always hold and does not (`invariants.ts`),
 * and for anything thrown.
 *
 * Only what a player could do. A monkey that did what no player can would
 * find bugs no player will. A new thing a player can do gets an action here.
 *
 * From a seed, so a failure can be played again exactly: `npm run fuzz --
 * --seed N` does, and prints what was done before it went wrong.
 */
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

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
  const happened: Record<string, number> = { splashed: 0 };
  const events: GameEvents = {
    splashed: () => {
      happened.splashed++;
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

  try {
    let store = memoryStore();
    let game = new Game(new Progress(store), { random: seeded(seed), events });
    // in an object, since the actions change it from inside closures the type checker cannot follow
    const page = { paused: false };
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
          // the lab's slider can be dragged anywhere, and the page hands on whatever it reads, so anything is tried
          const v = random() < 0.25 ? [NaN, -1, 2, Infinity][Math.floor(random() * 4)] : random();
          game.setContamination(v);
          did('dirt');
        },
      ],
      [
        2,
        () => {
          // one of the lab's four times of day, or anywhere between, as the address may say
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
        1,
        () => {
          // the panel's button, near wherever the camera looks
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
          did('reload');
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
      if (busy > 0) busy--;
      else {
        act();
        acted = true;
      }
      game.step(page.paused ? 0 : DT);
      // after everything done, and every few frames between: a bad value set and set again at once is never seen
      if (acted || frame % CHECK_EVERY === 0) {
        const problems = checkInvariants(game);
        if (problems.length) return fail(problems);
      }
    }
    return { seed, frames, failure: null, done, happened };
  } catch (err) {
    return fail([`threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`]);
  }
}
