/**
 * How the fishing paces, played by the angler: how many game minutes it takes to land and stow a few fish, over a
 * few seeds, held to a baseline both ways. Quicker is as much a change as slower: a fish that lands itself is a bug
 * the same as one that never bites.
 *
 * `pace-check.ts` runs it: `npm run pace` for the figures, `npm run pace:check` to hold them, `-- --update` to write
 * the baseline again.
 *
 * The figure is a median over the seeds, so one odd run does not move it, and the tolerance is a fifth: the medians
 * over four sets of eight seeds (1-8 to 25-32) lay from 2.13 to 2.26 minutes, within six hundredths of each other, and
 * a fishing with half the reel and half the chance of a fish noticing moved it from 2.13 to 7.39 and failed.
 */
import { Angler } from '../src/angler';
import { Game } from '../src/game';
import { HOME } from '../src/lakes';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DT = 1 / 60;
export const CHECK = { seeds: [1, 2, 3, 4, 5, 6, 7, 8], fish: 3, capMinutes: 10 };
/** How far the figure may move from the baseline, as a share of it, before the check fails. */
export const TOLERANCE = 0.2;

export interface PaceRun {
  seed: number;
  /** Game minutes to land and stow the fish, or the cap if it never did. */
  minutes: number;
  finished: boolean;
}

/** One lake from a seed, fished until the fish are in the bucket or the time is up. */
export function paceRun(seed: number, fish = CHECK.fish, capMinutes = CHECK.capMinutes): PaceRun {
  const game = new Game(new Progress(memoryStore(), { [HOME.id]: HOME }), { lake: HOME, random: seeded(seed) });
  // the angler's own chance, apart from the lake's
  const angler = new Angler(game, seeded(seed * 7 + 3));
  const frames = Math.round(capMinutes * 3600);
  for (let f = 0; f < frames; f++) {
    angler.step(DT);
    if (game.bucket >= fish) return { seed, minutes: round(game.t / 60), finished: true };
  }
  return { seed, minutes: capMinutes, finished: false };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/** Whether a figure has moved from its baseline beyond the tolerance, either way. */
export function moved(was: number, now: number, tolerance = TOLERANCE): boolean {
  return Math.abs(now - was) > Math.abs(was) * tolerance;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
