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
import { BedFinds, places } from './bedfinds';
import { School, steerTo } from './fish';
import { Line } from './line';
import { CLOCK, NIGHT, DROP_NEAR, HEAL, GEAR, FISHING, KINDS, RELEASE } from './lake';
import type { Lake } from './lakes/lake';
import { HOME } from './lakes';
import { DRUM_RULES, TREASURE_RULES } from './rules';
import { recorded } from './journal';
import { Progress } from './progress';
import { drawTemper, drumFight, fightFor, gearFor, treasureFight, type Gear, type Temper } from './fight';
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
  bitten?(heavy?: boolean, quarry?: 'drum' | 'treasure'): void;
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
  /** A drum of waste was hauled up by a tap on its card: how many are hauled, and how many there are. */
  hauled?(hauled: number, drums: number): void;
  /** A junk treasure was kept for the shelf by a tap on its card: its id. */
  found?(id: string): void;
  /** A fish was landed: what kind, and what it weighs, in kilograms. It waits by the rod to be stowed. */
  landed?(kind: string, weight: number, temper: Temper): void;
  /** The day's end began, at midnight or by choice: the player yawns and the screen starts to fade. */
  yawned?(): void;
  /** The player woke in the cabin, on this day. */
  woke?(day: number): void;
  /**
   * The screen is faded out on a journey to the lake `id`, which the save already names, at the pond, with the clock as
   * it was: the page loads afresh, told once.
   */
  left?(id: string): void;
}

/** How fast a hooked fish swims to keep to the line, how far it sways off its bearing and how fast, and how far either way of due north its bearing may be. */
const HOOKED = { speed: 6, sway: 0.35, swayRate: 0.9, wide: 1.1 } as const;

/**
 * Where the things on a lake's bed lie, worked out once for each lake and kept: the lake is the `BedWorld` that
 * `places` asks, and the places are the same for every game played in it, however many are made.
 */
interface BedPlaces {
  drums: [number, number][];
  treasures: [number, number][];
}
const BED_PLACES = new WeakMap<Lake, BedPlaces>();

/** The places of a lake's drums and treasures, the treasures clear of the drums. */
function bedPlacesOf(lake: Lake): BedPlaces {
  let made = BED_PLACES.get(lake);
  if (!made) {
    const drums = places(lake.drums, lake);
    made = { drums, treasures: places(lake.treasures, lake, drums) };
    BED_PLACES.set(lake, made);
  }
  return made;
}

/** How big a lure's splash is, against a pebble's one. */
const LURE_SPLASH = 0.6;

export interface GameOptions {
  /** The lake it is played in, the home's unless told otherwise (`docs/lakes.md`). */
  lake?: Lake;
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
  /** Whoever shows what happens. */
  events?: GameEvents;
  /**
   * Whether this is a load the page fades in from black, at the pond as the wake does in the cabin. Only the page says
   * so: every load fades in, which hides the boot as well as a journey, and a game made for a test or the fuzzer does not.
   */
  arrives?: boolean;
}

export class Game {
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  /** The lake it is played in: its shore, bed, fish, finds and cure all come from it. */
  readonly lake: Lake;
  readonly fish: School;
  /** The drums of waste on the bed, from a seed of their own and not the game's chance. */
  readonly drums: BedFinds;
  /** The junk treasures on the bed, from a seed of their own as well, clear of the drums; found ones are gone from it for good. */
  readonly treasures: BedFinds;
  readonly splashes = new Splashes();
  readonly lure: Lure;
  readonly bite: Bite;
  readonly line = new Line();
  /** Whether the reel is held, which pushes the zone up the fight's bar. */
  reeling = false;
  /** How many fish have been landed and stowed this session; the count cured, which the save keeps for each lake, is `progress.entry(lake.id).cured`. */
  bucket = 0;
  /** The fish on the line or landed: what it weighs, the bearing it was hooked on from where it will be landed, and when. */
  catchWeight = 0;
  /** The kind (an index into `KINDS`) of the fish on the line or landed, set when it was hooked. */
  catchKind = 0;
  /** Whether what is on the line or landed is a drum of waste and not a fish. */
  catchDrum = false;
  /** Which junk treasure is on the line or landed, or minus one when it is a fish or a drum. */
  catchTreasure = -1;
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
  /** Where the player is: at the pond, yawning at the day's end, in the cabin or leaving for another lake; only at the pond does the game run. */
  place: Place = 'pond';
  /** The seconds stepped since the yawn began, or since the player woke; the fade is worked out from it. */
  private fadeElapsed = 0;
  /** Midnight has passed with a fish still on the line or landed, and the yawn is waiting for the fight to be settled. */
  private midnightWaits = false;
  /** The seconds stepped at the pond since the save was last written for the clock's sake. */
  private sinceSaved = 0;
  /** The load is still fading in at the pond, over `NIGHT.fadeIn` of stepped time (the world runs on beneath it). */
  private arriving: boolean;
  /** The lake being left for, while the player is `leaving`, and whether the page has been told. */
  private destination = '';
  private told = false;

  constructor(
    readonly progress: Progress,
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.arriving = options.arrives === true;
    const lake = (this.lake = options.lake ?? HOME);
    const found = bedPlacesOf(lake);
    this.fish = new School(lake);
    this.drums = new BedFinds(found.drums);
    this.treasures = new BedFinds(found.treasures);
    this.lure = new Lure(lake);
    this.day = progress.save.day;
    // a cabin save is at dawn whatever its time says, since the clock is held there
    this.place = progress.save.place;
    this.timeOfDay = this.place === 'cabin' ? CLOCK.startsAt : progress.save.time;
    const mine = progress.entry(lake.id);
    this.contamination = lake.contaminationAfter(mine.cured, mine.drums);
    this.drums.loadFirst(mine.drums);
    this.treasures.load(mine.found.map((id) => lake.treasures.list.findIndex((t) => t.id === id)));
    this.waterDirt = this.healFrom = this.healTo = this.contamination;
    this.events = options.events ?? {};
    // the gear is the whole journey's, the fish cured at every lake, so going somewhere else takes none of it away
    this.gear = gearFor(progress.curedTotal());
    const e = this.events;
    // a nibble rings the water at the bobber, and the bite rings it bigger, so a bite is seen and not only read; the
    // rings are the water's own, through the splash pool, and unlike a pebble they do not scare the fish off
    this.bite = new Bite(
      {
        nibbled: () => {
          e.nibbled?.();
          this.ring(FISHING.nibbleRing);
        },
        bitten: (heavy, quarry) => {
          e.bitten?.(heavy, quarry);
          this.ring(
            quarry === 'drum' ? DRUM_RULES.ring : quarry === 'treasure' ? TREASURE_RULES.ring : FISHING.biteRing,
          );
        },
        hooked: () => e.hooked?.(),
        missed: () => e.missed?.(),
      },
      lake,
    );
    this.bite.gear = this.gear;
    this.fish.fill(lake.fishCount, () => this.random());
    // the cured are as many of each kind as the journal says were caught; a save without a journal, or with one that
    // accounts for fewer than were cured, has the rest cured in slot order, as every save once was
    const { cured, journal } = mine;
    this.fish.cureLoaded(
      KINDS.map((k) => journal[k.id]?.caught ?? 0),
      cured,
    );
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    // away from the pond only the fade moves: the clock, the fish, the lure and the water hold until the player is back
    if (this.place !== 'pond') return this.stepNight(dt);
    if (this.arriving) {
      this.fadeElapsed += dt;
      if (this.fadeElapsed >= NIGHT.fadeIn) this.arriving = false;
    }
    this.t += dt;
    this.sinceSaved += dt;
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
    // the clock is saved on a cadence; with midnight passed and a fight not yet settled the save keeps its earlier
    // time, since a clock just past midnight loaded at the pond would never come to the yawn it was owed
    if (this.sinceSaved >= CLOCK.saveEvery && !this.midnightWaits) {
      this.sinceSaved = 0;
      this.persist();
    }
    this.fish.step(dt, this.random);
    // a lure landing on the water splashes, smaller than a pebble
    const landed = this.lure.step(this.t, dt);
    if (landed) this.drop(landed[0], landed[1], LURE_SPLASH);
    this.bite.step(this.t, dt, this.fish, this.lure, this.random, this.drums, this.treasures);
    if (this.bite.phase === 'hooked') this.fight(dt);
    // the stroke last, once every fish has moved for the step however it was moved
    this.fish.stroke(dt, this.bite.phase === 'hooked' ? this.bite.fish : -1, this.line.pulling);
  }

  /** True with a fish hooked or landed, which the day's end waits for. */
  private get fighting(): boolean {
    return this.bite.phase === 'hooked' || this.bite.phase === 'landed';
  }

  /** How faded the screen is, from nought to one: the yawn's or the journey's fade out and the waking's or the load's fade in. */
  fade(): number {
    // a load at the pond comes up from black as a wake does in the cabin
    if (this.place === 'pond' && this.arriving) return fadeAt('cabin', this.fadeElapsed, NIGHT.fadeOut, NIGHT.fadeIn);
    return fadeAt(this.place, this.fadeElapsed, NIGHT.fadeOut, NIGHT.fadeIn);
  }

  /** The player goes to bed early, from the pond or the cabin; refused, and nothing changed, with a fish hooked or landed or while yawning or leaving. */
  sleep(): boolean {
    if (this.place === 'yawning' || this.place === 'leaving' || this.fighting) return false;
    this.yawn();
    return true;
  }

  /** The player goes down from the cabin to the pond, where the clock runs on from dawn; refused anywhere else, and while yawning. */
  out(): boolean {
    if (this.place !== 'cabin') return false;
    this.place = 'pond';
    this.arriving = false;
    this.fadeElapsed = 0;
    this.sinceSaved = 0;
    this.persist();
    return true;
  }

  /**
   * The player goes to the lake `id`: the lure is reeled in, the save is written naming that lake, at the pond, with
   * the clock as it is, and the screen starts to fade out; at the end of the fade the page is told (`left`) and loads
   * afresh at the new lake. At the lake the player is at it goes out from the cabin, as `out` does, and is nothing at
   * the pond. Refused, and nothing changed, for a lake the game does not know, with a fish hooked or landed, and while
   * yawning or already leaving.
   */
  travel(id: string): boolean {
    if (this.place === 'yawning' || this.place === 'leaving' || this.fighting) return false;
    if (!Object.hasOwn(this.progress.lakes, id)) return false;
    if (id === this.lake.id) return this.place === 'cabin' ? this.out() : true;
    this.reelIn();
    this.reeling = false;
    this.midnightWaits = false;
    this.progress.save.lake = id;
    this.destination = id;
    this.told = false;
    // the fade goes on from wherever it is, so a journey from a screen not yet faded in never jumps
    this.fadeElapsed = this.fade() * NIGHT.fadeOut;
    this.place = 'leaving';
    this.persist();
    return true;
  }

  /** The load's fade-in let go, for a test that wants the pond as it is and not as it comes up. */
  arrived() {
    this.arriving = false;
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
    else if (this.place === 'leaving' && this.fadeElapsed >= NIGHT.fadeOut && !this.told) {
      this.told = true;
      this.events.left?.(this.destination);
    }
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
    // waking is at home, where the cabin is: the save names the home, and the page loads afresh there if it is not
    this.progress.save.lake = HOME.id;
    this.persist();
    this.events.woke?.(this.day);
  }

  /** The player strikes: a fish biting is hooked, one nibbling lets go, and with none at the lure it is twitched. */
  strike(): Strike {
    const did = this.bite.strike(this.t, this.fish, this.lure);
    if (did !== 'none') this.events.struck?.(did);
    if (did === 'hooked' && this.bite.drum >= 0) this.hookDrum();
    else if (did === 'hooked' && this.bite.treasure >= 0) this.hookTreasure();
    else if (did === 'hooked') {
      this.catchDrum = false;
      this.catchTreasure = -1;
      const i = this.bite.fish;
      const [lx, ly] = this.lake.landAt;
      this.catchKind = this.fish.kind[i];
      const [least, most] = KINDS[this.catchKind].weight;
      this.catchWeight = Math.round((least + this.random() * (most - least)) * 100) / 100;
      // a heavier fish fights harder: its heft is where its weight lies between the least and most of its kind
      const heft = (this.catchWeight - least) / (most - least);
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

  /** A drum snagged and struck: hauled by its own profile, the lure at the drum, and no chance drawn for weight or temper. */
  private hookDrum() {
    const i = this.bite.drum;
    const [lx, ly] = this.lake.landAt;
    const [x, y] = [this.drums.x[i], this.drums.y[i]];
    this.catchDrum = true;
    this.catchTreasure = -1;
    this.catchWeight = this.lake.drums.weight;
    this.temper = 'steady';
    this.line.start(Math.hypot(x - lx, y - ly), drumFight(this.gear), this.random);
    this.bearing = Math.atan2(y - ly, x - lx);
    this.hookedAt = this.t;
    this.lure.phase = 'hooked';
    this.lure.at[0] = x;
    this.lure.at[1] = y;
    this.lure.at[2] = -Math.max(0, this.lake.bedDepth(x, y) - 0.3);
  }

  /** A treasure snagged and struck: hauled by its own profile, the lure at it, and no chance drawn for weight or temper. */
  private hookTreasure() {
    const i = this.bite.treasure;
    const [lx, ly] = this.lake.landAt;
    const [x, y] = [this.treasures.x[i], this.treasures.y[i]];
    this.catchDrum = false;
    this.catchTreasure = i;
    this.catchWeight = this.lake.treasures.list[i].weight;
    this.temper = 'steady';
    this.line.start(Math.hypot(x - lx, y - ly), treasureFight(this.gear), this.random);
    this.bearing = Math.atan2(y - ly, x - lx);
    this.hookedAt = this.t;
    this.lure.phase = 'hooked';
    this.lure.at[0] = x;
    this.lure.at[1] = y;
    this.lure.at[2] = -Math.max(0, this.lake.bedDepth(x, y) - 0.3);
  }

  /** The reel held, or let go. */
  reel(on: boolean) {
    this.reeling = on === true;
  }

  /** True when every fish in the pond is cured and every drum hauled: nothing is left to take the bait or to clean. */
  get pondClean(): boolean {
    return (
      this.fish.count > 0 && this.fish.curedCount() === this.fish.count && this.drums.foundCount() === this.drums.count
    );
  }

  /** The landed fish put in the bucket, cured, and let go in the pond near the angler with a splash; false with none landed. */
  stow(): boolean {
    if (this.bite.phase !== 'landed' || this.bite.drum >= 0 || this.bite.treasure >= 0) return false;
    const i = this.bite.fish;
    this.bucket++;
    this.bite.stowed(this.fish);
    this.lure.reelIn();
    this.release(i);
    // the cure: the fish is cured by being put in the bucket, the lake a step cleaner, and the count kept at once
    const save = this.progress.entry(this.lake.id);
    save.cured = Math.min(save.cured + 1, Number.MAX_SAFE_INTEGER);
    // and written in the journal under the fish's kind (the slot's own, the same as the kind it was hooked as)
    const id = KINDS[this.fish.kind[i]].id;
    save.journal[id] = recorded(save.journal[id], this.catchWeight, this.day);
    // never above where it is: a lake the lever has made cleaner than the count says is not made dirtier by a cure
    this.contamination = Math.min(this.contamination, this.lake.contaminationAfter(save.cured, save.drums));
    // the water follows, from where it is now and not from where it was, so two cures close together never jump
    this.healFrom = this.waterDirt;
    this.healTo = this.contamination;
    this.healElapsed = 0;
    this.persist();
    this.events.cured?.(save.cured, this.lake.toClean);
    // a gift is given on the cure that earns it, from the next fight, and told that once
    const had = this.gear;
    this.gear = this.bite.gear = gearFor(this.progress.curedTotal());
    for (const g of GEAR) if (this.gear[g.id] && !had[g.id]) this.events.gifted?.(g.name, g.words);
    return true;
  }

  /**
   * The landed drum of waste hauled up onto the bank, by a tap on its card: it is gone from the bed for good, the count
   * hauled is kept at once, and the contamination falls to what the formula says (never up, as a cure never raises it).
   * False with none landed, and with a fish landed, which is `stow`'s.
   */
  haul(): boolean {
    if (this.bite.phase !== 'landed' || this.bite.drum < 0) return false;
    const i = this.bite.drum;
    this.bite.stowed(this.fish);
    this.lure.reelIn();
    this.drums.find(i);
    const save = this.progress.entry(this.lake.id);
    save.drums = this.drums.foundCount();
    this.contamination = Math.min(this.contamination, this.lake.contaminationAfter(save.cured, save.drums));
    // the water heals to it from where it is, as after a cure
    this.healFrom = this.waterDirt;
    this.healTo = this.contamination;
    this.healElapsed = 0;
    this.persist();
    this.events.hauled?.(save.drums, this.lake.drums.count);
    return true;
  }

  /**
   * The landed junk treasure kept for the shelf, by a tap on its card: it is gone from the bed for good, its id is kept
   * at once and told. It cleans nothing: the contamination, the water and the cures are left as they were. False with
   * none landed, and with a fish or a drum landed, which are `stow`'s and `haul`'s.
   */
  keep(): boolean {
    if (this.bite.phase !== 'landed' || this.bite.treasure < 0) return false;
    const i = this.bite.treasure;
    this.bite.stowed(this.fish);
    this.lure.reelIn();
    this.treasures.find(i);
    const id = this.lake.treasures.list[i].id;
    const { found } = this.progress.entry(this.lake.id);
    if (!found.includes(id)) found.push(id);
    this.persist();
    this.events.found?.(id);
    return true;
  }

  /**
   * Fish `i` cured and let go in the pond, `RELEASE.distance` out from the angler toward the middle and facing away from
   * the shore, or further out a step at a time until that is on the water; if none of the tries is, it stays where the
   * fight left it, which was on the water. A small splash is told there.
   */
  private release(i: number) {
    const { lake } = this;
    const { angler } = lake;
    const heading = Math.atan2(-angler.y, -angler.x);
    const [dx, dy] = [Math.cos(heading), Math.sin(heading)];
    let x = this.fish.x[i],
      y = this.fish.y[i];
    for (let k = 0; k <= RELEASE.steps; k++) {
      const out = RELEASE.distance + k * RELEASE.step;
      const [px, py] = [angler.x + dx * out, angler.y + dy * out];
      if (lake.inside(px, py, RELEASE.margin)) {
        [x, y] = [px, py];
        break;
      }
    }
    this.fish.cure(i, x, y, heading);
    this.drop(x, y, RELEASE.splash);
  }

  /** The fight on by `dt`: the zone and the meter, and the fish swimming to keep to it along its bearing, swaying, with the lure in its mouth. */
  private fight(dt: number) {
    if (this.catchDrum || this.catchTreasure >= 0) return this.fightFind(dt);
    const i = this.bite.fish;
    const was = this.line.step(dt, this.reeling, this.contamination, this.random);
    const [lx, ly] = this.lake.landAt;
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
      this.events.landed?.(KINDS[this.catchKind].name, this.catchWeight, this.temper);
    }
  }

  /** A drum or a treasure hauled on by `dt`: the lure is drawn in along the line toward the landing, the thing on the bed beneath it staying put until it is hauled or kept. */
  private fightFind(dt: number) {
    const was = this.line.step(dt, this.reeling, this.contamination, this.random);
    const [lx, ly] = this.lake.landAt;
    const b = Math.min(Math.PI / 2 + HOOKED.wide, Math.max(Math.PI / 2 - HOOKED.wide, this.bearing));
    const [x, y] = [lx + Math.cos(b) * this.line.out, ly + Math.sin(b) * this.line.out];
    this.lure.at[0] = x;
    this.lure.at[1] = y;
    this.lure.at[2] = -Math.min(Math.max(0, this.lake.bedDepth(x, y) - 0.3), 0.3 + this.line.out * 0.08);
    // neither slips: it is landed when the meter is full, and waits otherwise
    if (was === 'landed') {
      this.bite.landed();
      this.reeling = false;
      this.events.landed?.(
        this.catchTreasure >= 0 ? this.lake.treasures.list[this.catchTreasure].name : 'drum of waste',
        this.catchWeight,
        this.temper,
      );
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
    if (![x, y, size].every(Number.isFinite) || size <= 0 || !this.lake.inside(x, y)) return false;
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
      if (this.lake.inside(px, py, 1)) return this.drop(px, py);
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
    // the yawn keeps what the save had: its clock is just past midnight and the day has not gone up, so a load from it
    // lands before the yawn, which comes again
    if (this.place !== 'yawning') {
      this.progress.save.time = this.timeOfDay;
      // leaving is for the pond of the lake the save names
      this.progress.save.place = this.place === 'leaving' ? 'pond' : this.place;
    }
    this.progress.persist();
  }
}
