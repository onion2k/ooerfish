/**
 * The lake itself, without the picture or the page, a step at a time. For
 * now it is the lab's lake: its clock, its fish swimming, and the two levers
 * the lab gives whoever is looking at the water, how dirty the lake is and
 * the time of day. The lab moves the dirt both ways; the cure, when it
 * comes, will only ever lower it.
 *
 * Nothing here waits on anything the page does, so the same lake runs in the
 * page and in Node, and what the tests try is what is drawn.
 */
import { School } from './fish';
import { FISH_COUNT } from './lake';
import { Progress } from './progress';
import type { Random } from './random';

export interface GameOptions {
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
}

export class Game {
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  readonly fish = new School();
  /** How dirty the lake is, from clear (0) to as sick as it gets (1). */
  contamination = 1;
  /** Where the day is, from midnight (0) through noon (0.5) to midnight again (1). */
  timeOfDay = 0.5;

  constructor(
    readonly progress: Progress,
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.fish.fill(FISH_COUNT, () => this.random());
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    this.t += dt;
    this.fish.step(dt, this.random);
  }

  /** How dirty the lake is, held to nought and one; what is not a number is refused, and changes nothing. */
  setContamination(v: number) {
    if (!Number.isNaN(v)) this.contamination = Math.min(1, Math.max(0, v));
  }

  /** Where the day is, held to nought and one; what is not a finite number is refused, and changes nothing. */
  setTimeOfDay(v: number) {
    if (Number.isFinite(v)) this.timeOfDay = Math.min(1, Math.max(0, v));
  }

  /** The save written now. */
  persist() {
    this.progress.persist();
  }
}
