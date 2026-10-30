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
import { NO_GEAR, noticeFor, windowFor, type Gear } from './fight';
import type { BedFinds } from './bedfinds';
import { CLOCK, FISHING, FISH_CAPACITY, KINDS, SNAG, awake, type Kind } from './lake';
import type { Lake } from './lakes/lake';
import { DRUM_RULES, TREASURE_RULES } from './rules';
import type { Lure } from './lure';
import { snagNear } from './snags';
import type { Random } from './random';

export type BitePhase = 'none' | 'coming' | 'nibbling' | 'biting' | 'hooked' | 'landed';

/** What a strike did: nothing (the lure is not in the water), a twitch, too soon, or hooked. */
export type Strike = 'none' | 'twitch' | 'spooked' | 'hooked';

/** What the bite tells, as it happens. */
export interface BiteEvents {
  nibbled?(): void;
  /**
   * The bobber dips; `heavy` when it is a drum of waste and not a fish that has taken the lure, and `quarry` says which
   * thing on the bed it was when it was one (a fish says nothing).
   */
  bitten?(heavy?: boolean, quarry?: 'drum' | 'treasure'): void;
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
  /** The drum snagged, or minus one: the quarry is a fish, a drum or a treasure, never two of them. */
  drum = -1;
  /** The junk treasure snagged, or minus one. */
  treasure = -1;
  /** Until when each drum keeps from the lure, having let go, and each treasure. */
  readonly drumWary: Float64Array;
  readonly treasureWary: Float64Array;
  /** Windows the fish at the lure has still to give after this one: a kind that bites twice has one left at its first. */
  bitesLeft = 0;
  /** Whether the window now open, or the nibble before it, is a two-headed fish's second. */
  second = false;
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
  /** The gifts held, which the game hands over when it has them: the bobber's window and the bait's notice. */
  gear: Gear = NO_GEAR;

  /** The bite's rules are the game's; how many drums and treasures lie on the bed is the lake's, so it is the lake that is handed in. */
  constructor(
    private readonly events: BiteEvents = {},
    private readonly lake: Lake,
  ) {
    this.drumWary = new Float64Array(lake.drums.count);
    this.treasureWary = new Float64Array(lake.treasures.count);
  }

  /**
   * On by `dt` to the time `t`. The `drums` and the `treasures` on the bed are snagged by a lure lying on it within reach,
   * the nearer of the two when both are, when no fish has taken the lure first; a draw of chance is made only while one
   * is within reach of the lure, so the fish's draws are the same with them on the bed or without. A kind that keeps
   * hours is passed over outside them, as a cured fish is and before any draw, so no other fish's chance moves; one
   * already at the lure when its hours end lets go, untold, as one that never found its way does.
   */
  step(
    t: number,
    dt: number,
    school: School,
    lure: Lure,
    random: Random,
    timeOfDay: number = CLOCK.startsAt,
    drums?: BedFinds,
    treasures?: BedFinds,
  ) {
    // a fish on the line is the fight's, and one landed waits by the rod
    if (this.phase === 'hooked' || this.phase === 'landed') return;
    if (lure.phase !== 'sinking') {
      if (this.phase !== 'none') this.letGo(t, school, lure);
      return;
    }
    const [bx, by] = [lure.bobber[0], lure.bobber[1]];
    if (this.phase === 'none') {
      // a lure by the reeds is noticed by more fish sooner (`docs/boat.md`, C4): the multiple scales the rate and no draw is added
      const rate =
        noticeFor(this.gear) *
        (t < this.twitchUntil ? FISHING.twitchBoost : 1) *
        (snagNear(this.lake, bx, by, SNAG.lureReach) >= 0 ? SNAG.notice : 1);
      let chosen = -1,
        nearest = Infinity;
      for (let i = 0; i < school.count; i++) {
        // a cured fish never comes to the bait, and costs no draw of chance, so curing one moves no other fish's luck
        if (school.cured[i] || this.wary[i] > t) continue;
        // a fish asleep on the bed is not drawn to the lure, and is passed over before its draw for the same reason
        if (!awake(KINDS[school.kind[i]], timeOfDay)) continue;
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
        return;
      }
      // no fish has come: a lure lying on the bed by a drum or a treasure may snag the nearer, and a snag dips the bobber
      // at once (heavily for a drum, lightly for a treasure)
      if ((drums || treasures) && lure.onBed) {
        const d = drums ? drums.snagged(bx, by, DRUM_RULES.reach, this.drumWary, t) : -1;
        const k = treasures ? treasures.snagged(bx, by, TREASURE_RULES.reach, this.treasureWary, t) : -1;
        const dd = d >= 0 ? Math.hypot(drums!.x[d] - bx, drums!.y[d] - by) : Infinity;
        const kd = k >= 0 ? Math.hypot(treasures!.x[k] - bx, treasures!.y[k] - by) : Infinity;
        const drum = dd <= kd;
        if ((d >= 0 || k >= 0) && random() < (drum ? DRUM_RULES.rate : TREASURE_RULES.rate) * dt) {
          if (drum) this.drum = d;
          else this.treasure = k;
          this.phase = 'biting';
          this.timer = windowFor(this.gear);
          if (drum) this.events.bitten?.(true, 'drum');
          else this.events.bitten?.(false, 'treasure');
        }
      }
      return;
    }
    // a drum or a treasure snagged does not come, nibble or fight the lure: it holds the bobber under until the window shuts
    if (this.drum >= 0 || this.treasure >= 0) {
      this.timer -= dt;
      if (this.timer <= 1e-9) this.letGo(t, school, lure);
      return;
    }
    // a fish whose hours have ended goes back to sleep, wherever it has got to
    if (!awake(KINDS[school.kind[this.fish]], timeOfDay)) {
      this.letGo(t, school, lure, true);
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
      this.timer = windowFor(this.gear);
      // the first window of a fish that bites more than once says how many windows it has still to give
      if (!this.second) this.bitesLeft = (KINDS[school.kind[this.fish]] as Kind).bites ?? 1;
      this.events.bitten?.();
      return;
    }
    // biting: the window runs down, and shut, the fish lets go; one of two heads nibbles once more first, untold as a miss
    this.timer -= dt;
    if (this.timer > 1e-9) return;
    if (this.bitesLeft > 1) {
      this.bitesLeft--;
      this.second = true;
      this.phase = 'nibbling';
      this.nibblesLeft = 1;
      this.timer = within(random, FISHING.nibbleGap);
      return;
    }
    this.letGo(t, school, lure);
  }

  /** The player strikes at the time `t`. */
  strike(t: number, school: School, lure: Lure): Strike {
    if (lure.phase !== 'sinking' || this.phase === 'hooked' || this.phase === 'landed') return 'none';
    if (this.phase === 'biting') {
      this.phase = 'hooked';
      this.second = false;
      this.bitesLeft = 0;
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
    this.second = false;
    this.bitesLeft = 0;
    if (this.drum >= 0) {
      // a drum cannot swim off: it is wary of the lure for a while and then snags it again, if it lies there still
      this.drumWary[this.drum] = t + FISHING.wary;
      this.drum = -1;
      this.phase = 'none';
      if (!quiet) this.events.missed?.();
      return;
    }
    if (this.treasure >= 0) {
      // nor can a treasure: wary a while, and snagged again if the lure lies there still
      this.treasureWary[this.treasure] = t + FISHING.wary;
      this.treasure = -1;
      this.phase = 'none';
      if (!quiet) this.events.missed?.();
      return;
    }
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

  /** The landed fish stowed, the landed drum hauled or the landed treasure kept: the bite is over, and the school has the fish back to steer. */
  stowed(school: School) {
    this.second = false;
    this.bitesLeft = 0;
    school.held = -1;
    this.fish = -1;
    this.drum = -1;
    this.treasure = -1;
    this.phase = 'none';
  }
}
