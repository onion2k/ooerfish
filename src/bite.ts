/**
 * A fish and the lure: a fish near a sunk lure notices it, comes to it, nibbles at it a time or two (the bobber
 * twitches), and bites (the bobber dips), and the player strikes inside the window or the fish lets go. One fish at a
 * time: the bite holds it, and the school's wander leaves it alone (`School.held`) while it is steered.
 *
 * A strike with no fish at the lure is a twitch of it, which draws fish in: for a while after one, a fish near it is
 * likelier to notice it. A strike while a fish only nibbles is too soon, and the fish lets go. A fish that let go
 * keeps away for a while, so the same one does not come straight back, and so does one that gives up coming, having
 * not found its way to the lure in time.
 *
 * Headless and stepped by `Game.step`, its chance handed in, so a seed plays the same bite every time.
 */
import { steerTo, type School } from './fish';
import { FISHING, FISH_CAPACITY } from './lake';
import type { Lure } from './lure';
import type { Random } from './random';

export type BitePhase = 'none' | 'coming' | 'nibbling' | 'biting' | 'hooked' | 'landed';

/** What a strike did: nothing (the lure is not in the water), a twitch, too soon, or hooked. */
export type Strike = 'none' | 'twitch' | 'spooked' | 'hooked';

/** What the bite tells, as it happens. */
export interface BiteEvents {
  nibbled?(): void;
  bitten?(): void;
  hooked?(): void;
  /** The fish let go: the window shut, it was struck too soon, the lure went, or it was scared off. */
  missed?(): void;
}

/** A whole number from `lo` to `hi`, by chance. */
const between = (random: Random, lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
const within = (random: Random, [lo, hi]: readonly [number, number]) => lo + random() * (hi - lo);

export class Bite {
  phase: BitePhase = 'none';
  /** The fish at the lure, or minus one. */
  fish = -1;
  /** How long until the next nibble or the bite, or how long the window has left. */
  timer = 0;
  /** How many nibbles are still to come before the bite. */
  nibblesLeft = 0;
  /** When the fish now coming set off for the lure, so one that cannot find its way gives up. */
  comingSince = 0;
  /** When the fish at the lure last nibbled it, which twitches the bobber; minus one for not since it came. */
  nibbledAt = -1;
  /** Until when a twitch is drawing fish in. */
  twitchUntil = -Infinity;
  /** Until when each fish keeps away, having let go. */
  readonly wary = new Float64Array(FISH_CAPACITY);

  constructor(private readonly events: BiteEvents = {}) {}

  /** On by `dt` to the time `t`. */
  step(t: number, dt: number, school: School, lure: Lure, random: Random) {
    // a fish on the line is the fight's, and one landed waits by the rod
    if (this.phase === 'hooked' || this.phase === 'landed') return;
    if (lure.phase !== 'sinking') {
      if (this.phase !== 'none') this.letGo(t, school, lure);
      return;
    }
    const [bx, by] = [lure.bobber[0], lure.bobber[1]];
    if (this.phase === 'none') {
      const rate = FISHING.notice * (t < this.twitchUntil ? FISHING.twitchBoost : 1);
      let chosen = -1,
        nearest = Infinity;
      for (let i = 0; i < school.count; i++) {
        if (this.wary[i] > t) continue;
        const d = Math.hypot(school.x[i] - bx, school.y[i] - by);
        if (d > FISHING.reach || Math.abs(school.depth[i] - lure.depth) > FISHING.band) continue;
        // each fish in reach notices it by a chance of its own, and the nearest that does comes
        if (random() < rate * dt && d < nearest) [chosen, nearest] = [i, d];
      }
      if (chosen >= 0) {
        this.nibbledAt = -1;
        this.phase = 'coming';
        this.comingSince = t;
        this.fish = chosen;
        school.held = chosen;
      }
      return;
    }
    // coming, it swims to the lure; at it, it holds there, edging back in if it has drifted
    const gap = Math.hypot(school.x[this.fish] - bx, school.y[this.fish] - by);
    const speed = this.phase === 'coming' ? FISHING.comeSpeed : gap > FISHING.mouth * 0.6 ? FISHING.comeSpeed * 0.4 : 0;
    const near = steerTo(school, this.fish, bx, by, lure.depth, speed, dt);
    if (this.phase === 'coming') {
      // steering has no way round a boulder or the jetty, and a fish caught behind one would hold the lure from
      // every other fish for ever, so one that has not reached it in time gives up, untold, as it never got there
      if (t - this.comingSince >= FISHING.comeLongest - 1e-9) {
        this.letGo(t, school, lure, true);
        return;
      }
      if (near < FISHING.mouth) {
        this.phase = 'nibbling';
        this.nibblesLeft = between(random, FISHING.nibbles[0], FISHING.nibbles[1]);
        this.timer = within(random, FISHING.nibbleGap);
      }
      return;
    }
    if (this.phase === 'nibbling') {
      this.timer -= dt;
      if (this.timer > 1e-9) return;
      if (this.nibblesLeft > 0) {
        this.nibblesLeft--;
        this.timer = within(random, FISHING.nibbleGap);
        this.nibbledAt = t;
        this.events.nibbled?.();
        return;
      }
      this.phase = 'biting';
      this.timer = FISHING.window;
      this.events.bitten?.();
      return;
    }
    // biting: the window runs down, and shut, the fish lets go
    this.timer -= dt;
    if (this.timer <= 1e-9) this.letGo(t, school, lure);
  }

  /** The player strikes at the time `t`. */
  strike(t: number, school: School, lure: Lure): Strike {
    if (lure.phase !== 'sinking' || this.phase === 'hooked' || this.phase === 'landed') return 'none';
    if (this.phase === 'biting') {
      this.phase = 'hooked';
      this.events.hooked?.();
      return 'hooked';
    }
    if (this.phase === 'nibbling') {
      this.letGo(t, school, lure);
      return 'spooked';
    }
    this.twitchUntil = t + FISHING.twitchLasts;
    return 'twitch';
  }

  /** A splash at (x, y): a fish coming to the lure, or at it, near enough to it is scared off. */
  splashed(t: number, x: number, y: number, school: School, lure: Lure) {
    if (this.phase === 'none' || this.phase === 'hooked' || this.phase === 'landed') return;
    if (Math.hypot(x - lure.bobber[0], y - lure.bobber[1]) < FISHING.reach) this.letGo(t, school, lure);
  }

  /** The fish at the lure, or on the line, lets go and swims off, wary of it for a while; told as missed unless `quiet`. */
  letGo(t: number, school: School, lure: Lure, quiet = false) {
    const i = this.fish;
    if (i >= 0) {
      this.wary[i] = t + FISHING.wary;
      school.heading[i] = Math.atan2(school.y[i] - lure.bobber[1], school.x[i] - lure.bobber[0]);
    }
    school.held = -1;
    this.fish = -1;
    this.phase = 'none';
    if (!quiet) this.events.missed?.();
  }

  /** The fish on the line is landed: it waits by the rod until it is stowed. */
  landed() {
    this.phase = 'landed';
  }

  /** The landed fish stowed: the bite is over, and the school has the fish back to steer. */
  stowed(school: School) {
    school.held = -1;
    this.fish = -1;
    this.phase = 'none';
  }
}
