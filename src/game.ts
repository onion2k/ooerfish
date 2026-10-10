/**
 * The lake itself, without the picture or the page, a step at a time. For
 * now it is the lab's lake: its clock, its fish swimming, and the two levers
 * the lab gives whoever is looking at the water, how dirty the lake is and
 * the time of day; and what is dropped on it, a splash where it lands, told of
 * to whoever shows it. The lab moves the dirt both ways; the cure, when it
 * comes, will only ever lower it.
 *
 * Nothing here waits on anything the page does, so the same lake runs in the
 * page and in Node, and what the tests try is what is drawn.
 */
import { School } from './fish';
import { DROP_NEAR, FISH_COUNT, inside } from './lake';
import { Progress } from './progress';
import type { Random } from './random';
import { Lure } from './lure';
import { Splashes } from './splash';

/** What happens, for whoever shows it. Every one may be left out. */
export interface GameEvents {
  /** Something landed on the water at (x, y), of this size. */
  splashed?(x: number, y: number, size: number): void;
}

/** How big a lure's splash is, against a pebble's one. */
const LURE_SPLASH = 0.6;

export interface GameOptions {
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
  /** Whoever shows what happens. */
  events?: GameEvents;
}

export class Game {
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  readonly fish = new School();
  readonly splashes = new Splashes();
  readonly lure = new Lure();
  private readonly events: GameEvents;
  /** How dirty the lake is, from clear (0) to as sick as it gets (1). */
  contamination = 1;
  /** Where the day is, from midnight (0) through noon (0.5) to midnight again (1). */
  timeOfDay = 0.5;

  constructor(
    readonly progress: Progress,
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.events = options.events ?? {};
    this.fish.fill(FISH_COUNT, () => this.random());
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    this.t += dt;
    this.fish.step(dt, this.random);
    // a lure landing on the water splashes, smaller than a pebble
    const landed = this.lure.step(this.t, dt);
    if (landed) this.drop(landed[0], landed[1], LURE_SPLASH);
  }

  /** How dirty the lake is, held to nought and one; what is not a number is refused, and changes nothing. */
  setContamination(v: number) {
    if (!Number.isNaN(v)) this.contamination = Math.min(1, Math.max(0, v));
  }

  /** Where the day is, held to nought and one; what is not a finite number is refused, and changes nothing. */
  setTimeOfDay(v: number) {
    if (Number.isFinite(v)) this.timeOfDay = Math.min(1, Math.max(0, v));
  }

  /**
   * Something dropped on the water at (x, y), of `size`: a splash there now, told of. Refused, and nothing recorded or
   * told, off the water, or where any of it is not a finite number, or of no size.
   */
  drop(x: number, y: number, size = 1): boolean {
    if (![x, y, size].every(Number.isFinite) || size <= 0 || !inside(x, y)) return false;
    this.splashes.add(x, y, this.t, size);
    this.events.splashed?.(x, y, size);
    return true;
  }

  /** A pebble dropped somewhere on the water near (x, y), by chance; on the water somewhere else if none is near. */
  dropNear(x: number, y: number): boolean {
    for (let tries = 0; tries < 40; tries++) {
      const a = this.random() * Math.PI * 2,
        r = Math.sqrt(this.random()) * DROP_NEAR;
      const px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      if (inside(px, py, 1)) return this.drop(px, py);
    }
    // nowhere near is on the water: the middle of the lake always is
    return this.drop(0, 0);
  }

  /** A cast thrown at `angle` round the compass and `power` from nought to one; one out already is reeled in first. Refused, and nothing changed, for what is not a finite number. */
  cast(angle: number, power: number): boolean {
    if (!Number.isFinite(angle) || !Number.isFinite(power)) return false;
    this.lure.reelIn();
    this.lure.cast(angle, power, this.t);
    return true;
  }

  /** The lure brought back to the rod, ready to cast again. */
  reelIn() {
    this.lure.reelIn();
  }

  /** The save written now. */
  persist() {
    this.progress.persist();
  }
}
