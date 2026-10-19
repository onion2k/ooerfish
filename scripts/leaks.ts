/**
 * A long game played through, watching the things that must not keep
 * growing: the fish, the splashes, the save, and the heap.
 *
 * A map that is added to and never emptied does not throw, break a rule, or
 * move any gate's figure. It shows up an hour into a game as a machine that
 * has slowed to a crawl, on somebody else's computer. Nothing else here would
 * ever see it: the fuzzer plays 4,000 frames.
 *
 * Every size is held two ways: under a ceiling that says what it could ever
 * reasonably be, and, where marked `steady`, not still climbing by the end —
 * the last third of the run against the middle third, so a size that fills
 * up early and settles is left alone, and one that creeps all the way
 * through is not. A new list, map or cache in the game gets a line in
 * `WATCH` and a reading in `sizes`.
 *
 * The scenery kit is not watched: it is loaded once, before the first frame, and
 * nothing in it grows, so there is no ceiling to name. Its download is held by
 * `sceneryBytes` in the perf gate. Nor is the banks' grass: its field is made once
 * (half-unit cells over the banks, a fixed size) and handed to the renderer, which
 * grows the blades again each frame from a hash into buffers sized once, so nothing
 * is added to over an hour; the trees, pebbles and clumps are a fixed set of placements
 * made once. The phone keeps two things, and both are watched: the gesture's holds (at most one for each of the four
 * sources that can hold the reel) and the session's peers (the one phone; a second is told the screen is busy and
 * forgotten, and the refusals are a count and the last reason, cut short). The leak run plays a busy room through the
 * real session and gesture, with a link that goes nowhere. Switching rung hands the renderer a grass field or none, and is the
 * page's, not the game's, and so not played here.
 */
import { Game } from '../src/game';
import { DRUMS, FISH_CAPACITY, KINDS, SPLASH_CAPACITY } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { collectionsKept, crowd, type Crowd } from './phonemonkey';

const DT = 1 / 60;

/**
 * What is watched, and how. Every size has a ceiling: what it could ever
 * reasonably be, not a guess at what the game does now, so tuning does not
 * move it and a leak cannot hide under it.
 */
export const WATCH: Partial<Record<string, { ceiling: number; steady?: boolean }>> = {
  fish: { ceiling: FISH_CAPACITY },
  splashes: { ceiling: SPLASH_CAPACITY },
  'save bytes': { ceiling: 2_000 },
  // the journal keeps an entry for each kind of fish and no more, and the save counts the drums hauled of those there are
  'journal kinds': { ceiling: KINDS.length },
  'drums hauled': { ceiling: DRUMS.count },
  // the sources that can hold the reel: the screen's pointer, the key, the button and the phone
  'gesture holds': { ceiling: 4 },
  // the one phone; a second or a stranger is never kept
  'session peers': { ceiling: 1 },
  // the catch-all for what is leaking and has no name here; noisy, so it is given a lot of room
  'heap MB': { ceiling: 300, steady: true },
};

/** Every size worth watching, read off a game as it stands. */
export function sizes(game: Game, room?: Crowd): Record<string, number> {
  return {
    // what the phone's gesture and session keep, counted by what their collections hold, so that one added later is seen
    'gesture holds': room ? collectionsKept(room.gesture) : 0,
    'session peers': room ? collectionsKept(room.session) + (room.session.reading().paired ? 1 : 0) : 0,
    fish: game.fish.count,
    splashes: game.splashes.count,
    'save bytes': JSON.stringify(game.progress.save).length,
    'journal kinds': Object.keys(game.progress.save.journal).length,
    'drums hauled': game.progress.save.drums,
    'heap MB': Math.round(process.memoryUsage().heapUsed / 1e5) / 10,
  };
}

/**
 * Whether a size is still climbing at the end: the last third of the run
 * against the middle third. `share` and `slack` are what it may drift by
 * without counting, as a share and as a number, so a small size wobbling by
 * one or two is not a leak.
 */
export function grew(series: number[], share = 0.15, slack = 3): boolean {
  if (series.length < 6) return false;
  const third = Math.floor(series.length / 3);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const middle = mean(series.slice(third, third * 2));
  const last = mean(series.slice(-third));
  return last > middle * (1 + share) + slack;
}

/** What is wrong with a run's sizes: over a ceiling, or still growing at the end. */
export function trouble(samples: Record<string, number[]>): string[] {
  const out: string[] = [];
  for (const [key, series] of Object.entries(samples)) {
    const watch = WATCH[key];
    const most = Math.max(...series);
    if (watch && most > watch.ceiling) out.push(`${key} went to ${most}, over its ceiling of ${watch.ceiling}`);
    else if (watch?.steady && grew(series, key === 'heap MB' ? 0.5 : 0.15, key === 'heap MB' ? 20 : 3)) {
      const third = Math.floor(series.length / 3);
      const at = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      out.push(
        `${key} grew all the way through: ${at(series.slice(0, third))} at the start, ${at(series.slice(third, third * 2))} in the middle, ${at(series.slice(-third))} by the end`,
      );
    }
  }
  return out;
}

export interface LeakOptions {
  seed: number;
  /** Game minutes to play. */
  minutes: number;
}

export interface LeakRun {
  seed: number;
  minutes: number;
  /** Every size, sampled once a game minute. */
  samples: Record<string, number[]>;
  problems: string[];
  /** The day the game ended on: above one, the run crossed a midnight, a yawn and a waking, which is what it must do. */
  days: number;
  /** Real seconds it took. */
  seconds: number;
}

/** Play a long game, sampling the sizes once a game minute, and say what would not stay bounded. */
export function leakRun({ seed, minutes }: LeakOptions): LeakRun {
  const started = performance.now();
  const samples: Record<string, number[]> = {};
  try {
    const game = new Game(new Progress(memoryStore()), { random: seeded(seed) });
    // a busy room for the whole run, from a chance of its own so the game plays as it did
    const room = crowd(() => game, seeded(seed * 13 + 5));
    for (let minute = 0; minute < minutes; minute++) {
      for (let f = 0; f < 3600; f++) {
        room.tick(minute * 3600 + f);
        game.step(DT);
      }
      for (const [key, n] of Object.entries(sizes(game, room))) (samples[key] ??= []).push(n);
    }
    return {
      seed,
      minutes,
      samples,
      problems: trouble(samples),
      days: game.day,
      seconds: (performance.now() - started) / 1000,
    };
  } catch (err) {
    return {
      seed,
      minutes,
      samples,
      days: 0,
      problems: [`seed ${seed}: threw ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`],
      seconds: (performance.now() - started) / 1000,
    };
  }
}
