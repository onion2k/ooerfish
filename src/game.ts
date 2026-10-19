/**
 * The lake itself, without the picture or the page, a step at a time. For
 * now it is the lake: its clock, running the day round from dawn, its fish
 * swimming, and how dirty the lake is; and what is dropped on it, a splash where it lands, told of
 * to whoever shows it. The cure only ever lowers the dirt: each fish stowed
 * is one more cured, kept in the save, and the lake as dirty as that says.
 *
 * Nothing here waits on anything the page does, so the same lake runs in the
 * page and in Node, and what the tests try is what is drawn.
 */
import { healToward } from './heal';
import { Bite, type Strike } from './bite';
import { School, steerTo } from './fish';
import { Line } from './line';
import {
  CLOCK,
  NIGHT,
  DROP_NEAR,
  contaminationAfter,
  HEAL,
  CURE,
  GEAR,
  FIGHT,
  FISHING,
  FISH_COUNT,
  PERCH,
  RELEASE,
  ANGLER,
  inside,
} from './lake';
import { Progress } from './progress';
import { drawTemper, fightFor, gearFor, type Gear, type Temper } from './fight';
import type { Random } from './random';
import { Lure } from './lure';
import { Splashes } from './splash';
import { fadeAt, pastMidnight, type Place } from './night';

/** What happens, for whoever shows it. Every one may be left out. */
export interface GameEvents {
  /** Something landed on the water at (x, y), of this size. */
  splashed?(x: number, y: number, size: number): void;
  /** A fish at the lure nibbled it (the bobber twitches), bit it (the bobber dips and the window opens), was hooked, or let go. */
  nibbled?(): void;
  bitten?(): void;
  hooked?(): void;
  missed?(): void;
  /** The player struck, and what it did: a twitch of the lure with no fish there, too soon at a nibble, or hooked. */
  struck?(did: Strike): void;
  /** The fish was let out of the zone until the meter emptied, and slipped off with nothing lost. */
  slipped?(): void;
  /** A fish was cured by being stowed: how many have been cured, and how many it takes to clean the lake. */
  cured?(cured: number, toClean: number): void;
  /**
   * The cure earned a gift, told once, on that cure only and after `cured`: what it is called and what it does, in the
   * words of `GEAR`. A load that has the gift already tells nothing.
   */
  gifted?(name: string, words: string): void;
  /** A fish was landed: what kind, and what it weighs, in kilograms. It waits by the rod to be stowed. */
  landed?(kind: string, weight: number, temper: Temper): void;
  /** The day's end began, at midnight or by choice: the player yawns and the screen starts to fade. */
  yawned?(): void;
  /** The player woke in the cabin, on this day. */
  woke?(day: number): void;
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
  /** Whether the reel is held, which pushes the zone up the fight's bar. */
  reeling = false;
  /** How many fish have been landed and stowed this session; the count cured, which the save keeps, is `progress.save.cured`. */
  bucket = 0;
  /** The fish on the line or landed: what it weighs, the bearing it was hooked on from where it will be landed, and when. */
  catchWeight = 0;
  /** The temper of the fish on the line or landed, drawn when it was hooked. */
  temper: Temper = 'steady';
  /** The gifts the cure count has earned, in force from the next fight (and the bite's next window); a load has its own, untold. */
  gear: Gear;
  private bearing = 0;
  private hookedAt = 0;
  private readonly events: GameEvents;
  /** How dirty the lake is, from clear (0) to as sick as it gets (1): worked out from the fish cured, and only the cure lowers it. */
  contamination: number;
  /**
   * The contamination the water shows: it follows `contamination` down over `HEAL.seconds` of game time after a cure,
   * and is set at once by the lever and on a load. The fight reads the truth, `contamination`, never this.
   */
  waterDirt: number;
  /** Where the water's heal began, what it heals to, and the game time it has run: a cure starts a new one from `waterDirt`. */
  healFrom: number;
  healTo: number;
  healElapsed = 0;
  /** How many times the lever has set the contamination, which the invariants read to tell a rise by the lever from one by any other road. */
  levers = 0;
  /** Where the day is, from midnight (0) through noon (0.5), up to but not reaching midnight again: one is nought. */
  timeOfDay: number = CLOCK.startsAt;
  /** Which day of play it is, from one: the save's, and up by one on each waking. */
  day: number;
  /** Where the player is: at the pond, yawning at the day's end, or in the cabin; only at the pond does the game run. */
  place: Place = 'pond';
  /** The seconds stepped since the yawn began, or since the player woke; the fade is worked out from it. */
  private fadeElapsed = 0;
  /** Midnight has passed with a fish still on the line or landed, and the yawn is waiting for the fight to be settled. */
  private midnightWaits = false;

  constructor(
    readonly progress: Progress,
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.day = progress.save.day;
    this.contamination = contaminationAfter(progress.save.cured);
    this.waterDirt = this.healFrom = this.healTo = this.contamination;
    this.events = options.events ?? {};
    this.gear = gearFor(progress.save.cured);
    const e = this.events;
    // a nibble rings the water at the bobber, and the bite rings it bigger, so a bite is seen and not only read; the
    // rings are the water's own, through the splash pool, and unlike a pebble they do not scare the fish off
    this.bite = new Bite({
      nibbled: () => {
        e.nibbled?.();
        this.ring(FISHING.nibbleRing);
      },
      bitten: () => {
        e.bitten?.();
        this.ring(FISHING.biteRing);
      },
      hooked: () => e.hooked?.(),
      missed: () => e.missed?.(),
    });
    this.bite.gear = this.gear;
    this.fish.fill(FISH_COUNT, () => this.random(), progress.save.cured);
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    // away from the pond only the fade moves: the clock, the fish, the lure and the water hold until the player is back
    if (this.place !== 'pond') return this.stepNight(dt);
    this.t += dt;
    this.healElapsed += dt;
    this.waterDirt = healToward(this.healFrom, this.healTo, this.healElapsed, HEAL.seconds);
    const before = this.timeOfDay;
    this.setTimeOfDay(before + dt / CLOCK.daySeconds);
    // only a step carries the clock across midnight, so the lever (`setTimeOfDay`) never makes one; a fish on the line
    // or landed holds the yawn off, the clock running on, and it comes on the first step after the fight is settled
    if (pastMidnight(before, this.timeOfDay)) this.midnightWaits = true;
    if (this.midnightWaits && !this.fighting) {
      this.yawn();
      return;
    }
    this.fish.step(dt, this.random);
    // a lure landing on the water splashes, smaller than a pebble
    const landed = this.lure.step(this.t, dt);
    if (landed) this.drop(landed[0], landed[1], LURE_SPLASH);
    this.bite.step(this.t, dt, this.fish, this.lure, this.random);
    if (this.bite.phase === 'hooked') this.fight(dt);
    // the stroke last, once every fish has moved for the step however it was moved
    this.fish.stroke(dt, this.bite.phase === 'hooked' ? this.bite.fish : -1, this.line.pulling);
  }

  /** True with a fish hooked or landed, which the day's end waits for. */
  private get fighting(): boolean {
    return this.bite.phase === 'hooked' || this.bite.phase === 'landed';
  }

  /** How faded the screen is, from nought to one: the yawn's fade out and the waking's fade in. */
  fade(): number {
    return fadeAt(this.place, this.fadeElapsed, NIGHT.fadeOut, NIGHT.fadeIn);
  }

  /** The player goes to bed early, from the pond or the cabin; refused, and nothing changed, with a fish hooked or landed or while yawning. */
  sleep(): boolean {
    if (this.place === 'yawning' || this.fighting) return false;
    this.yawn();
    return true;
  }

  /** The player goes down from the cabin to the pond, where the clock runs on from dawn; refused anywhere else, and while yawning. */
  out(): boolean {
    if (this.place !== 'cabin') return false;
    this.place = 'pond';
    this.fadeElapsed = 0;
    return true;
  }

  /** The yawn begins: the lure is reeled in (a coming or nibbling fish lets go), the reel let go, and the fade starts. */
  private yawn() {
    this.midnightWaits = false;
    this.reelIn();
    this.reeling = false;
    this.place = 'yawning';
    this.fadeElapsed = 0;
    this.events.yawned?.();
  }

  /** A step away from the pond: the fade, and at the end of the yawn the waking. */
  private stepNight(dt: number) {
    this.fadeElapsed += dt;
    if (this.place === 'yawning' && this.fadeElapsed >= NIGHT.fadeOut) this.wake();
  }

  /** Morning at the cabin on the next day, saved: dawn, the water as clean as the lake is, the splashes gone. */
  private wake() {
    this.day = Math.min(this.day + 1, Number.MAX_SAFE_INTEGER);
    this.progress.save.day = this.day;
    this.timeOfDay = CLOCK.startsAt;
    // the night has passed, so a heal still running is over
    this.waterDirt = this.healFrom = this.healTo = this.contamination;
    this.healElapsed = 0;
    this.splashes.clear();
    this.place = 'cabin';
    this.fadeElapsed = 0;
    this.persist();
    this.events.woke?.(this.day);
  }

  /** The player strikes: a fish biting is hooked, one nibbling lets go, and with none at the lure it is twitched. */
  strike(): Strike {
    const did = this.bite.strike(this.t, this.fish, this.lure);
    if (did !== 'none') this.events.struck?.(did);
    if (did === 'hooked') {
      const i = this.bite.fish;
      const [lx, ly] = FIGHT.landAt;
      this.catchWeight =
        Math.round((PERCH.weight[0] + this.random() * (PERCH.weight[1] - PERCH.weight[0])) * 100) / 100;
      // a heavier fish fights harder: its heft is where its weight lies between the least and most of its kind
      const heft = (this.catchWeight - PERCH.weight[0]) / (PERCH.weight[1] - PERCH.weight[0]);
      // the temper is drawn next, one draw after the weight and before the line's own (where the fish first darts)
      this.temper = drawTemper(this.random);
      this.line.start(
        Math.hypot(this.fish.x[i] - lx, this.fish.y[i] - ly),
        fightFor(heft, this.temper, this.gear),
        this.random,
      );
      this.bearing = Math.atan2(this.fish.y[i] - ly, this.fish.x[i] - lx);
      this.hookedAt = this.t;
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

  /** True when every fish in the pond is cured: nothing is left to take the bait. */
  get pondClean(): boolean {
    return this.fish.count > 0 && this.fish.curedCount() === this.fish.count;
  }

  /** The landed fish put in the bucket, cured, and let go in the pond near the angler with a splash; false with none landed. */
  stow(): boolean {
    if (this.bite.phase !== 'landed') return false;
    const i = this.bite.fish;
    this.bucket++;
    this.bite.stowed(this.fish);
    this.lure.reelIn();
    this.release(i);
    // the cure: the fish is cured by being put in the bucket, the lake a step cleaner, and the count kept at once
    const save = this.progress.save;
    save.cured = Math.min(save.cured + 1, Number.MAX_SAFE_INTEGER);
    // never above where it is: a lake the lever has made cleaner than the count says is not made dirtier by a cure
    this.contamination = Math.min(this.contamination, contaminationAfter(save.cured));
    // the water follows, from where it is now and not from where it was, so two cures close together never jump
    this.healFrom = this.waterDirt;
    this.healTo = this.contamination;
    this.healElapsed = 0;
    this.persist();
    this.events.cured?.(save.cured, CURE.toClean);
    // a gift is given on the cure that earns it, from the next fight, and told that once
    const had = this.gear;
    this.gear = this.bite.gear = gearFor(save.cured);
    for (const g of GEAR) if (this.gear[g.id] && !had[g.id]) this.events.gifted?.(g.name, g.words);
    return true;
  }

  /**
   * Fish `i` cured and let go in the pond, `RELEASE.distance` out from the angler toward the middle and facing away from
   * the shore, or further out a step at a time until that is on the water; if none of the tries is, it stays where the
   * fight left it, which was on the water. A small splash is told there.
   */
  private release(i: number) {
    const heading = Math.atan2(-ANGLER.y, -ANGLER.x);
    const [dx, dy] = [Math.cos(heading), Math.sin(heading)];
    let x = this.fish.x[i],
      y = this.fish.y[i];
    for (let k = 0; k <= RELEASE.steps; k++) {
      const out = RELEASE.distance + k * RELEASE.step;
      const [px, py] = [ANGLER.x + dx * out, ANGLER.y + dy * out];
      if (inside(px, py, RELEASE.margin)) {
        [x, y] = [px, py];
        break;
      }
    }
    this.fish.cure(i, x, y, heading);
    this.drop(x, y, RELEASE.splash);
  }

  /** The fight on by `dt`: the zone and the meter, and the fish swimming to keep to it along its bearing, swaying, with the lure in its mouth. */
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
      this.events.landed?.(PERCH.name, this.catchWeight, this.temper);
    }
  }

  /** A ring of `size` on the water at the bobber, told as a splash: the bite's, which the fish does not flee. */
  private ring(size: number) {
    const [x, y] = this.lure.bobber;
    this.splashes.add(x, y, this.t, size);
    this.events.splashed?.(x, y, size);
  }

  /**
   * How dirty the lake is, held to nought and one; what is not a number is refused, and changes nothing. A lever for
   * the tests and the fuzzer's start, not the cure: it may raise the contamination, which nothing in the game does.
   */
  setContamination(v: number) {
    if (Number.isNaN(v)) return;
    this.contamination = Math.min(1, Math.max(0, v));
    // the water is set with it and any heal is over: the lever is for looking, and wants the picture now
    this.waterDirt = this.healFrom = this.healTo = this.contamination;
    this.healElapsed = 0;
    this.levers++;
  }

  /** Where the day is, round the clock (one is midnight again, nought); what is not a finite number is refused, and changes nothing. */
  setTimeOfDay(v: number) {
    if (!Number.isFinite(v)) return;
    const at = v - Math.floor(v);
    // a value a hair under a whole number can round to one in the subtraction, and a day never reaches it
    this.timeOfDay = at < 1 ? at : 0;
  }

  /**
   * Something dropped on the water at (x, y), of `size`: a splash there now, told of. Refused, and nothing recorded or
   * told, away from the pond, off the water, or where any of it is not a finite number, or of no size.
   */
  drop(x: number, y: number, size = 1): boolean {
    // the cabin and the yawn have no water to drop anything on, and a splash made there would hang unmoving till morning
    if (this.place !== 'pond') return false;
    if (![x, y, size].every(Number.isFinite) || size <= 0 || !inside(x, y)) return false;
    this.splashes.add(x, y, this.t, size);
    this.events.splashed?.(x, y, size);
    this.bite.splashed(this.t, x, y, this.fish, this.lure);
    return true;
  }

  /** A pebble dropped somewhere on the water near (x, y), by chance; on the water somewhere else if none is near. */
  dropNear(x: number, y: number): boolean {
    // refused before any chance is drawn, so a refusal away from the pond moves nothing
    if (this.place !== 'pond') return false;
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

  /** A cast thrown at `angle` round the compass and `power` from nought to one; one out already is reeled in first. Refused, and nothing changed, for what is not a finite number, and away from the pond. */
  cast(angle: number, power: number): boolean {
    if (!Number.isFinite(angle) || !Number.isFinite(power)) return false;
    // there is no casting from the cabin or while yawning: the lure was brought in for the night and stays in
    if (this.place !== 'pond') return false;
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
