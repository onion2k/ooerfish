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
import { Bite, type Strike } from './bite';
import { School, steerTo } from './fish';
import { Line } from './line';
import { DROP_NEAR, FIGHT, FISH_COUNT, PERCH, inside } from './lake';
import { Progress } from './progress';
import type { Random } from './random';
import { Lure } from './lure';
import { Splashes } from './splash';

/** What happens, for whoever shows it. Every one may be left out. */
export interface GameEvents {
  /** Something landed on the water at (x, y), of this size. */
  splashed?(x: number, y: number, size: number): void;
  /** A fish at the lure nibbled it (the bobber twitches), bit it (the bobber dips and the window opens), was hooked, or let go. */
  nibbled?(): void;
  bitten?(): void;
  hooked?(): void;
  missed?(): void;
  /** The line was held too tight and the fish slipped off, with nothing lost. */
  slipped?(): void;
  /** A fish was landed: what kind, and what it weighs, in kilograms. It waits by the rod to be stowed. */
  landed?(kind: string, weight: number): void;
}

/** How fast a hooked fish swims to keep to the line, how far it sways off its bearing and how fast, and how far either way of due north its bearing may be. */
const HOOKED = { speed: 6, sway: 0.35, swayRate: 0.9, wide: 1.1 } as const;

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
  readonly bite: Bite;
  readonly line = new Line();
  /** Whether the reel is held. */
  reeling = false;
  /** How many fish have been landed and stowed: the session's, not saved until the cure comes. */
  bucket = 0;
  /** The fish on the line or landed: what it weighs, the bearing it was hooked on from where it will be landed, and when. */
  catchWeight = 0;
  private bearing = 0;
  private hookedAt = 0;
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
    const e = this.events;
    this.bite = new Bite({
      nibbled: () => e.nibbled?.(),
      bitten: () => e.bitten?.(),
      hooked: () => e.hooked?.(),
      missed: () => e.missed?.(),
    });
    this.fish.fill(FISH_COUNT, () => this.random());
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    this.t += dt;
    this.fish.step(dt, this.random);
    // a lure landing on the water splashes, smaller than a pebble
    const landed = this.lure.step(this.t, dt);
    if (landed) this.drop(landed[0], landed[1], LURE_SPLASH);
    this.bite.step(this.t, dt, this.fish, this.lure, this.random);
    if (this.bite.phase === 'hooked') this.fight(dt);
  }

  /** The player strikes: a fish biting is hooked, one nibbling lets go, and with none at the lure it is twitched. */
  strike(): Strike {
    const did = this.bite.strike(this.t, this.fish, this.lure);
    if (did === 'hooked') {
      const i = this.bite.fish;
      const [lx, ly] = FIGHT.landAt;
      this.line.start(Math.hypot(this.fish.x[i] - lx, this.fish.y[i] - ly), this.random);
      this.bearing = Math.atan2(this.fish.y[i] - ly, this.fish.x[i] - lx);
      this.hookedAt = this.t;
      this.catchWeight =
        Math.round((PERCH.weight[0] + this.random() * (PERCH.weight[1] - PERCH.weight[0])) * 100) / 100;
      // the lure is in its mouth from the strike, not from the next step
      this.lure.phase = 'hooked';
      this.lure.at[0] = this.fish.x[i];
      this.lure.at[1] = this.fish.y[i];
      this.lure.at[2] = -this.fish.depth[i];
    }
    return did;
  }

  /** The reel held, or let go. */
  reel(on: boolean) {
    this.reeling = on === true;
  }

  /** The landed fish put in the bucket, and another let into the lake in its place; false with none landed. */
  stow(): boolean {
    if (this.bite.phase !== 'landed') return false;
    const i = this.bite.fish;
    this.bucket++;
    this.bite.stowed(this.fish);
    this.fish.respawn(i, this.random);
    this.lure.reelIn();
    return true;
  }

  /** The fight on by `dt`: the line, and the fish swimming to keep to it along its bearing, swaying, with the lure in its mouth. */
  private fight(dt: number) {
    const i = this.bite.fish;
    const was = this.line.step(dt, this.reeling, this.contamination, this.random);
    const [lx, ly] = FIGHT.landAt;
    const north = Math.PI / 2;
    const sway = HOOKED.sway * Math.sin((this.t - this.hookedAt) * HOOKED.swayRate);
    const b = Math.min(north + HOOKED.wide, Math.max(north - HOOKED.wide, this.bearing)) + sway;
    const depth = Math.min(2.5, 0.3 + this.line.out * 0.08);
    steerTo(this.fish, i, lx + Math.cos(b) * this.line.out, ly + Math.sin(b) * this.line.out, depth, HOOKED.speed, dt);
    this.lure.at[0] = this.fish.x[i];
    this.lure.at[1] = this.fish.y[i];
    this.lure.at[2] = -this.fish.depth[i];
    if (was === 'slipped') {
      // nothing is lost: the fish swims off, and the lure sinks on where it was
      this.bite.letGo(this.t, this.fish, this.lure, true);
      this.lure.freed(this.lure.at[0], this.lure.at[1], -this.lure.at[2]);
      this.reeling = false;
      this.events.slipped?.();
    } else if (was === 'landed') {
      this.bite.landed();
      this.reeling = false;
      this.events.landed?.(PERCH.name, this.catchWeight);
    }
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
    this.bite.splashed(this.t, x, y, this.fish, this.lure);
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
    // a fish on the line, or landed and waiting to be stowed, is seen to first
    if (this.bite.phase === 'hooked' || this.bite.phase === 'landed') return false;
    this.reelIn();
    this.lure.cast(angle, power, this.t);
    return true;
  }

  /** The lure brought back to the rod, ready to cast again. */
  reelIn() {
    if (this.bite.phase === 'hooked' || this.bite.phase === 'landed') return;
    if (this.bite.phase !== 'none') this.bite.letGo(this.t, this.fish, this.lure);
    this.lure.reelIn();
  }

  /** The save written now. */
  persist() {
    this.progress.persist();
  }
}
