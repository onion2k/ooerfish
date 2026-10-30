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
import {
  BOAT,
  CLOCK,
  DRIFT,
  LINE_DRAW,
  NIGHT,
  ROPE,
  PHOTOS,
  DROP_NEAR,
  HEAL,
  GEAR,
  FISHING,
  KINDS,
  RELEASE,
  SNAG,
  MOON,
  WEATHER,
  type Weather,
} from './lake';
import { weatherOf } from './calendar';
import { rainSpot } from './rain';
import { NO_WIND, bentTip, rodTip } from './cast';
import { proppedTip, restInto, type Rest } from './lazy';
import { Rope } from './rope';
import { Bodies, KIND, newWorld } from './physics';
import type { Lake, Stand } from './lakes/lake';
import { HOME, LAKES } from './lakes';
import { anglerAboard, landingAboard, newBoat, rowAt, rowPath, type BoatState } from './boat';
import { DRUM_RULES, TREASURE_RULES } from './rules';
import { recorded } from './journal';
import { Progress } from './progress';
import type { Photo } from './photo';
import { REQUESTS } from './town/requests';
import { drawTemper, drumFight, fightFor, gearFor, treasureFight, type Gear, type Temper } from './fight';
import type { Random } from './random';
import { Lure } from './lure';
import { freedPoint, snagNear } from './snags';
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
  /** A request of the town was answered, in play and not at a load: its id. */
  answered?(id: string): void;
  /** A photograph was kept, at this place in the album. */
  photographed?(index: number): void;
  /** The photograph at this place in the album was discarded; the ones after it move up. */
  discarded?(index: number): void;
  /** A fish was landed: what kind, and what it weighs, in kilograms. It waits by the rod to be stowed. */
  landed?(kind: string, weight: number, temper: Temper): void;
  /** The day's end began, at midnight or by choice: the player yawns and the screen starts to fade. */
  yawned?(): void;
  /** The player woke in the cabin, on this day. */
  woke?(day: number): void;
  /** The player walked into the cabin by day, the clock held where it was. */
  entered?(): void;
  /**
   * The screen is faded out on a journey to the lake `id`, which the save already names, at the pond, with the clock as
   * it was: the page loads afresh, told once.
   */
  left?(id: string): void;
  /** The boat began a row, boarding first if the player was ashore, to this point on the water (a landing is a row to the mooring). */
  rowed?(x: number, y: number): void;
  /** A row ended at this anchorage, or the anchor was dropped here, the player aboard and the save written there. */
  anchored?(x: number, y: number): void;
  /** The anchor was weighed: the boat is free to drift on the wind and the currents (`docs/boat.md`, C3). */
  adrift?(): void;
  /** The boat reached its mooring and the player stepped off: the boat is ashore, and the save says so. */
  ashore?(): void;
  /** The lure sinking beside bed `i` of reeds was caught in it: it holds until a tug and a give free it (`docs/boat.md`, C4). */
  snagged?(i: number): void;
  /** A give after a tug freed the lure from bed `i`: it sinks on from beside the reeds. */
  freed?(i: number): void;
  /** The rod was propped (`on`) or taken up (`docs/boat.md`, C5): told once for each change, whichever call made it. */
  propped?(on: boolean): void;
}

/** How fast a hooked fish swims to keep to the line, how far it sways off its bearing and how fast, and how far either way of straight ahead of the angler its bearing may be. */
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
  /** The bodies the physics steps: the bobber, carried by the game while the lure is not on the water (`docs/boat.md`, C1). */
  readonly bodies: Bodies;
  /**
   * The boat (`docs/boat.md`, C2): ashore at the lake's mooring until a row boards it, then wherever it was rowed, the
   * player aboard with the rod held from the seat; one object written into, never made again. A lake with no boat has
   * one that is never used.
   */
  readonly boat: BoatState;
  readonly bite: Bite;
  readonly line = new Line();
  /** The fishing line as a rope from the rod's tip to the line's end, stepped with the game (`docs/boat.md`, C0). */
  readonly rope = new Rope();
  /** Where the rope is pinned: the rod's tip, bent by the fight's tension, and what is on the line's end. */
  readonly lineStart = new Float64Array(3);
  readonly lineEnd = new Float64Array(3);
  /** Where the propped rod rests, written each step it is asked: a scratch, so nothing is made. */
  private readonly restAt: Rest = { x: 0, y: 0, z: 0, heading: 0 };
  /** The height of the water at a point and a time, which the bobber rides: the page hands in the water's own; still until then. */
  surface: (x: number, y: number, t: number) => number = () => 0;
  /** The lowest a point of the rope may be at an x and y: the ground off the water, the bed on it, and a little over; made once. */
  private readonly keepOut: (x: number, y: number, z: number) => number;
  /** Whether the reel is held, which pushes the zone up the fight's bar. */
  reeling = false;
  /**
   * How long the reel has been held on a snagged lure, in seconds: a give (the reel let go) after `SNAG.tug` frees it, a
   * shorter tug is forgotten (`docs/boat.md`, C4). Nought unless the lure is snagged and the reel is held.
   */
  tugging = 0;
  /**
   * The rod is propped (`docs/boat.md`, C5): the lure sinking, the reel let go, the player left to read or look about.
   * Only `prop` sets it, and anything that takes the lure or the fish in hand takes it up again (`takeUp`).
   */
  propped = false;
  /** The game time of the last bite while the rod was propped, or minus infinity for none: the bell swings from it. */
  rang = -Infinity;
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
  /**
   * Whether the last cast ended with a fish stowed, true at the start so the first cast wastes nothing (`docs/contests.md`).
   * A cast sets it false and `stow` true; the next cast finding it false knows that cast was wasted (a lure reeled in
   * empty, a slip, a drum or treasure instead, the bank, a yawn) and ends the run before counting its own.
   */
  private castStowed = true;
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
  /**
   * The photograph being looked at, if one is (`docs/photo.md`): its place in the album, the photograph itself and the
   * clock before the look. While it is, the clock and (at the pond) the weather are the photograph's, the page draws
   * them, and `step` holds the game still.
   */
  still: { index: number; photo: Photo; timeBefore: number } | null = null;
  /** The weather the lever set, or null for the day's own; cleared by a wake, since the day moved. */
  private weatherLever: Weather | null = null;
  /** The day's own weather and the day it was worked out for, since the page reads it every frame and `weatherOf` makes a generator. */
  private dayWeather: Weather = WEATHER.firstDay;
  private dayWeatherFor = 1;
  /** Seconds of stepped time since the last raindrop's ring, and how many have come, which is the hash of the next one's place. */
  private rainClock = 0;
  rainRings = 0;
  private readonly rainSpotAt: [number, number] = [0, 0];
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
  /** How many nights the yawn in train will sleep through, one to `MOON.days`; one whenever the player is not yawning. */
  nights = 1;
  /** The lake being left for, while the player is `leaving`, and whether the page has been told. */
  private destination = '';
  /** Where the player lands at the lake being left for: the pond, or the cabin at home. */
  private arrival: 'pond' | 'cabin' = 'pond';
  private told = false;
  /** The row in train is a landing, to the mooring, and not a row to an anchorage. */
  private landingIn = false;
  /** Where the angler is while aboard and where a fish is landed, written into when asked and never made again. */
  private readonly stand: Stand = { x: 0, y: 0, tipHeight: 0, tipReach: 0 };
  private readonly landingPoint: [number, number] = [0, 0];
  private readonly rowPoint: [number, number] = [0, 0];
  private readonly freePoint: [number, number] = [0, 0];

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
    // the clock is held in the cabin wherever it stood, so a cabin save keeps its time
    this.place = progress.save.place;
    this.timeOfDay = progress.save.time;
    const mine = progress.entry(lake.id);
    // the boat lies at its mooring, unless the save left the player aboard at an anchorage at the pond: one that is not on
    // the water by `keepOff` (a lake since changed, a hand-written save), or at a lake with no boat, is read as ashore
    this.boat = newBoat(lake);
    const saved = mine.boat;
    if (saved && lake.boat && this.place === 'pond' && lake.inside(saved.x, saved.y, BOAT.keepOff)) {
      this.boat.x = saved.x;
      this.boat.y = saved.y;
      this.boat.heading = saved.heading;
      this.boat.aboard = true;
      this.boat.anchored = saved.anchored;
    } else if (saved) mine.boat = null;
    this.bodies = new Bodies(newWorld(lake), lake, this.landing(), lake.boat ? [this.boat.x, this.boat.y] : null);
    // a boat saved adrift drifts on from where it was
    if (!this.boat.anchored) this.bodies.letGoBoat();
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
          if (this.propped) this.rang = this.t;
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
    // a point over the water and above its surface is above the bed, so only the shore's lookup is paid for it
    this.keepOut = (x, y, z) =>
      lake.inside(x, y)
        ? z >= ROPE.aboveGround
          ? z
          : -lake.bedDepth(x, y) + ROPE.aboveGround
        : lake.ground(x, y) + ROPE.aboveGround;
    this.fish.fill(lake.fishCount, () => this.random());
    // the cured are as many of each kind as the journal says were caught; a save without a journal, or with one that
    // accounts for fewer than were cured, has the rest cured in slot order, as every save once was
    const { cured, journal } = mine;
    this.fish.cureLoaded(
      KINDS.map((k) => journal[k.id]?.caught ?? 0),
      cured,
    );
    // what the save already meets is marked without a word, since nothing happened to tell
    this.answer(false);
    this.layRope();
  }

  /**
   * Every request of the town that the save now meets and has not yet answered is answered, in the order of the list:
   * kept at once, and told as `answered` when `told` (a thing that happened in play), never at a load, which marks
   * in memory and silently, and writes nothing. Nothing is ever taken back, so a request once answered stays answered.
   */
  answer(told = true) {
    const save = this.progress.save;
    const added: string[] = [];
    for (const r of REQUESTS)
      if (!save.requests.includes(r.id) && r.met(save, LAKES)) {
        save.requests.push(r.id);
        added.push(r.id);
      }
    if (added.length === 0) return;
    // a load marks in memory and writes nothing (loading alone never does); the next write carries it
    if (!told) return;
    this.persist();
    for (const id of added) this.events.answered?.(id);
  }

  /** One frame of `dt` seconds. */
  step(dt: number) {
    // a photograph looked at holds the game, as every page does, so the clock and the fish stay where the look found them
    if (this.still) return;
    // away from the pond only the fade moves: the clock, the fish, the lure and the water hold until the player is back
    if (this.place !== 'pond') return this.stepNight(dt);
    if (this.arriving) {
      this.fadeElapsed += dt;
      if (this.fadeElapsed >= NIGHT.fadeIn) this.arriving = false;
    }
    this.t += dt;
    if (this.boat.rowing) this.stepRow();
    this.sinceSaved += dt;
    this.healElapsed += dt;
    this.waterDirt = healToward(this.healFrom, this.healTo, this.healElapsed, HEAL.seconds);
    const before = this.timeOfDay;
    this.setTimeOfDay(before + dt / CLOCK.daySeconds);
    // only a step carries the clock across midnight, so the lever (`setTimeOfDay`) never makes one; a fish on the line
    // or landed holds the yawn off, the clock running on, and it comes on the first step after the fight is settled
    if (pastMidnight(before, this.timeOfDay)) this.midnightWaits = true;
    // the yawn waits for a row as it waits for a fish: it comes at the anchoring
    if (this.midnightWaits && !this.fighting && !this.boat.rowing) {
      this.yawn();
      return;
    }
    // the clock is saved on a cadence; with midnight passed and a fight not yet settled the save keeps its earlier
    // time, since a clock just past midnight loaded at the pond would never come to the yawn it was owed
    if (this.sinceSaved >= CLOCK.saveEvery && !this.midnightWaits) {
      this.sinceSaved = 0;
      this.persist();
    }
    this.fish.step(dt, this.random, this.lift, this.timeOfDay);
    this.rain(dt);
    // a lure landing on the water splashes, smaller than a pebble
    const landed = this.lure.step(this.t, dt);
    if (landed) {
      this.drop(landed[0], landed[1], LURE_SPLASH);
      this.bodies.drop(landed[0], landed[1]);
    }
    // a lure sinking beside the reeds (just landed, drifting or freed) is caught; one already caught is tugged and given
    if (this.lure.phase === 'sinking') {
      const bed = snagNear(this.lake, this.lure.bobber[0], this.lure.bobber[1], SNAG.reach);
      if (bed >= 0) this.snagLure(bed);
    } else if (this.lure.phase === 'snagged') this.tug(dt);
    this.bite.step(this.t, dt, this.fish, this.lure, this.random, this.timeOfDay, this.drums, this.treasures);
    this.blow(dt);
    this.stepBodies(dt);
    if (this.bite.phase === 'hooked') this.fight(dt);
    // the stroke last, once every fish has moved for the step however it was moved
    this.fish.stroke(dt, this.bite.phase === 'hooked' ? this.bite.fish : -1, this.line.pulling);
    this.stepRope(dt);
  }

  /**
   * The world of bodies on by `dt`, and the bobber read back from its body while the lure sinks, so that what the
   * physics does to it (nothing yet on a flat water; from the belts and the wind, something) is what the line and the
   * water see. A body's arrays are 32-bit, so the lure's place is written back only when the body has genuinely moved
   * from it: one that has not is the lure's own place rounded, and writing that would round the lure for nothing.
   */
  private stepBodies(dt: number) {
    const { bodies, lure, boat, lake } = this;
    bodies.step(dt);
    // a boat adrift is read back from its body, unless that is off the water by the keep-off: then it is put back where
    // it was and stopped, so it is held at the last of the water and never aground; the heading holds
    if (boat.aboard && !boat.anchored && !boat.rowing) {
      const bx = bodies.boatX,
        by = bodies.boatY;
      if (bx !== Math.fround(boat.x) || by !== Math.fround(boat.y)) {
        if (lake.inside(bx, by, BOAT.keepOff)) {
          boat.x = bx;
          boat.y = by;
        } else bodies.stillBoat(boat.x, boat.y);
      }
    }
    if (lure.phase !== 'sinking') return;
    if (bodies.x !== Math.fround(lure.bobber[0]) || bodies.y !== Math.fround(lure.bobber[1])) {
      // likewise the bobber against the margin of the bank, so a lure is never blown onto the grass
      if (lake.inside(bodies.x, bodies.y, DRIFT.bank)) {
        lure.bobber[0] = bodies.x;
        lure.bobber[1] = bodies.y;
      } else bodies.still(lure.bobber[0], lure.bobber[1]);
    }
    lure.at[0] = lure.bobber[0];
    lure.at[1] = lure.bobber[1];
  }

  /**
   * The lure caught in bed `i` of reeds (`docs/boat.md`, C4): a fish coming, nibbling or biting lets go as a reel-in makes
   * it, the lure holds at its bobber on the surface, the bobber's body is taken so the physics leaves it be, and it is told.
   */
  private snagLure(i: number) {
    const { lure, bite } = this;
    this.takeUp();
    if (bite.phase !== 'none') bite.letGo(this.t, this.fish, lure);
    lure.snag(i, lure.bobber[0], lure.bobber[1]);
    this.bodies.take();
    this.tugging = 0;
    this.events.snagged?.(i);
  }

  /**
   * A step of a snagged lure: the reel held is a tug and counts, and let go after the tug is long enough it is a give
   * that frees the lure; let go sooner, the tug is forgotten.
   */
  private tug(dt: number) {
    if (this.reeling) this.tugging += dt;
  }

  /**
   * The give: the reel let go on a snagged lure. A tug of `SNAG.tug` or more frees it; a shorter one is forgotten. Done
   * at the let-go itself and not on the next step, so no frame holds a tug with the reel let go, whichever way the reel
   * was let go.
   */
  private give() {
    if (this.tugging >= SNAG.tug) this.freeLure();
    this.tugging = 0;
  }

  /**
   * The snagged lure freed: it sinks on from `SNAG.drop` out from the bed's edge, where its body is let go, with a splash
   * of the lure's size, as a landing makes one. Nothing is lost.
   */
  private freeLure() {
    const { lure, freePoint } = this;
    const bed = lure.snagged;
    freedPoint(this.lake, bed, lure.bobber[0], lure.bobber[1], freePoint);
    lure.freed(freePoint[0], freePoint[1], 0);
    this.bodies.drop(freePoint[0], freePoint[1]);
    this.drop(freePoint[0], freePoint[1], LURE_SPLASH);
    this.tugging = 0;
    this.events.freed?.(bed);
  }

  /** The wind's push on the free bodies for a step: the bobber and the boat adrift, in the wind weather and no other. */
  private blow(dt: number) {
    if (this.weather !== 'wind') return;
    const [dx, dy] = WEATHER.wind.direction;
    const { bobber, boat } = DRIFT.wind;
    this.bodies.blow(KIND.bobber, bobber * dx, bobber * dy, dt);
    this.bodies.blow(KIND.boat, boat * dx, boat * dy, dt);
  }

  /**
   * Where the line starts and ends now, in `lineStart` and `lineEnd`, and the tension it is under. The end is where the
   * lure hangs from the tip when ready; the landed fish's hang, swaying; the bobber on the water (bobbing, dipped at a
   * bite, twitched at a nibble, and heavier for a drum or a treasure) while the lure sinks; and otherwise the lure, which
   * is the fish's mouth when one is on. The start is the tip bent toward the end by the tension, which only a fish on the
   * line gives. The drawing reads these and decides nothing.
   */
  private lineEnds(): number {
    const { lure, bite, lineEnd } = this;
    // the fight's tension with a fish on, and the snag's while the reel is held on a snagged lure (the rod bends, the line warms)
    const tension =
      bite.phase === 'hooked' ? this.line.tension : lure.phase === 'snagged' && this.reeling ? SNAG.tension : 0;
    if (lure.phase === 'ready') {
      const t0 = rodTip(this.lake, this.anglerAt());
      lineEnd[0] = t0[0];
      lineEnd[1] = t0[1];
      lineEnd[2] = t0[2] - LINE_DRAW.dangle;
    } else if (bite.phase === 'landed') {
      const t0 = rodTip(this.lake, this.anglerAt());
      lineEnd[0] = t0[0] + LINE_DRAW.hang.sway * Math.sin(this.t * LINE_DRAW.hang.rate);
      lineEnd[1] = t0[1];
      lineEnd[2] = t0[2] - LINE_DRAW.hang.drop;
    } else if (lure.phase === 'sinking' || lure.phase === 'snagged') {
      let z =
        this.surface(lure.bobber[0], lure.bobber[1], this.t) +
        LINE_DRAW.bob.height * Math.sin(this.t * LINE_DRAW.bob.rate);
      const { dip, twitch } = LINE_DRAW;
      if (bite.phase === 'biting')
        z -= dip * (bite.drum >= 0 ? DRUM_RULES.dip : bite.treasure >= 0 ? TREASURE_RULES.dip : 1);
      else if (bite.phase === 'nibbling' && bite.nibbledAt >= 0 && this.t - bite.nibbledAt < twitch.lasts)
        z -= twitch.depth * Math.sin((Math.PI * (this.t - bite.nibbledAt)) / twitch.lasts);
      lineEnd[0] = lure.bobber[0];
      lineEnd[1] = lure.bobber[1];
      lineEnd[2] = z;
    } else lineEnd.set(lure.at);
    // propped, the line hangs from the rest's rod, unbent (a propped rod holds no fish); in hand it is the tip bent by the tension
    if (this.propped) proppedTip(restInto(this.lake, this.anglerAt(), this.restAt), this.lineStart);
    else bentTip(this.lake, tension, lineEnd, this.lineStart, this.anglerAt());
    return tension;
  }

  /** The rope length: the chord and the slack a line has to spare, none when strained to the tension of one. */
  private ropeLength(tension: number): number {
    const a = this.lineStart,
      b = this.lineEnd;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * (1 + ROPE.slack * (1 - tension));
  }

  /** One step of the rope, pinned to the ends of the line as they are now. */
  private stepRope(dt: number) {
    // a ready line hangs straight under the tip with nothing to move it: laid once, it is not stepped, which keeps the
    // rope off the cost of every frame the player is not fishing
    if (this.lure.phase === 'ready') return this.layRope();
    const tension = this.lineEnds();
    this.rope.step(dt, this.lineStart, this.lineEnd, this.ropeLength(tension), this.keepOut);
  }

  /** The rope laid straight from the tip to the line's end, as a ready line is at the start and when the player is back at the pond. */
  private layRope() {
    this.lineEnds();
    this.rope.reset(this.lineStart, this.lineEnd);
  }

  /**
   * The rain's rings (`docs/weather.md`, part 3): in rain and in a shower, a small splash every `WEATHER.rain.ringEvery`
   * seconds of stepped time, at a point from a hash of the drop's number (`rainSpot`, never `this.random`). They go into
   * the pool directly and are not told as splashes: a raindrop throws no droplets and startles no fish, which `drop`'s
   * `splashed` event and the bite's hearing of it would make it do twice a second. Out of the rain the clock is held at nought.
   */
  private rain(dt: number) {
    const w = this.weather;
    if (w !== 'rain' && w !== 'shower') {
      this.rainClock = 0;
      return;
    }
    this.rainClock += dt;
    while (this.rainClock >= WEATHER.rain.ringEvery) {
      this.rainClock -= WEATHER.rain.ringEvery;
      rainSpot(this.rainRings++, this.lake, this.rainSpotAt);
      this.splashes.add(this.rainSpotAt[0], this.rainSpotAt[1], this.t, WEATHER.rain.ring);
    }
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
    return this.sleepThrough(1);
  }

  /**
   * The player goes to bed and sleeps `nights` nights, the wake that ends the yawn being that many days on: the yawn is
   * as `sleep`'s. Refused, and nothing changed, with a fish hooked or landed, while yawning or leaving, and for a
   * number of nights that is not a whole number from one to a round of the moon.
   */
  sleepThrough(nights: number): boolean {
    // bed is reached from the shore, not the boat: land first
    if (this.place === 'yawning' || this.place === 'leaving' || this.fighting || this.still || this.boat.aboard)
      return false;
    if (!Number.isInteger(nights) || nights < 1 || nights > MOON.days) return false;
    this.nights = nights;
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
    this.layRope();
    this.persist();
    return true;
  }

  /**
   * The player walks into the cabin by day, from the pond: the lure is reeled in and the reel let go, as the yawn does,
   * and the screen comes up from black over `NIGHT.fadeIn`, as a wake does, with the clock, the day, the fish, the heal
   * and the splashes held exactly where they are. Saved as the cabin at that time, so a load lands there and `out`
   * resumes it. Refused, and nothing changed, with a fish hooked or landed (or the yawn owed for a midnight passed
   * mid-fight), while yawning or leaving, in the cabin already, and at a lake with no cabin; and aboard the boat, rowing
   * or anchored, since the cabin is reached from the shore: land first.
   */
  enter(): boolean {
    if (this.place !== 'pond' || this.fighting || this.midnightWaits || !this.lake.cabin || this.boat.aboard)
      return false;
    this.reelInForce();
    this.reeling = false;
    this.place = 'cabin';
    this.arriving = false;
    this.fadeElapsed = 0;
    this.persist();
    this.events.entered?.();
    return true;
  }

  /**
   * The player goes to the lake `id`: the lure is reeled in, the save is written naming that lake, at the pond, with
   * the clock as it is, and the screen starts to fade out; at the end of the fade the page is told (`left`) and loads
   * afresh at the new lake. At the lake the player is at it goes out from the cabin, as `out` does, and is nothing at
   * the pond. Refused, and nothing changed, for a lake the game does not know, with a fish hooked or landed, and while
   * yawning or already leaving, and aboard the boat, rowing or anchored: a journey starts from the shore, so land first.
   */
  travel(id: string, into: 'pond' | 'cabin' = 'pond'): boolean {
    if (this.place === 'yawning' || this.place === 'leaving' || this.fighting || this.still || this.boat.aboard)
      return false;
    if (!Object.hasOwn(this.progress.lakes, id)) return false;
    // the cabin is at home only: a journey into it anywhere else is refused
    if (into === 'cabin' && id !== HOME.id) return false;
    if (id === this.lake.id) {
      if (into === 'cabin') return this.place === 'cabin' || this.enter();
      return this.place === 'cabin' ? this.out() : true;
    }
    this.reelInForce();
    this.reeling = false;
    this.midnightWaits = false;
    this.progress.save.lake = id;
    this.destination = id;
    this.arrival = into;
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
    this.reelInForce();
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

  /** Morning at the cabin `nights` days on, saved: dawn, the water as clean as the lake is, the splashes gone. */
  private wake(nights = this.nights) {
    this.nights = 1;
    this.day = Math.min(this.day + nights, Number.MAX_SAFE_INTEGER);
    this.progress.save.day = this.day;
    // the lever was for the day that has gone
    this.weatherLever = null;
    this.timeOfDay = CLOCK.startsAt;
    // the night has passed, so a heal still running is over
    this.waterDirt = this.healFrom = this.healTo = this.contamination;
    this.healElapsed = 0;
    this.splashes.clear();
    // the player walks down from the cabin to the mooring in the morning, so the boat is ashore and the save says so
    this.stowBoat();
    this.place = 'cabin';
    this.fadeElapsed = 0;
    // waking is at home, where the cabin is: the save names the home, and the page loads afresh there if it is not
    this.progress.save.lake = HOME.id;
    this.persist();
    this.events.woke?.(this.day);
  }

  /** The player strikes: a fish biting is hooked, one nibbling lets go, and with none at the lure it is twitched. */
  strike(): Strike {
    // the lure is in, and a strike with a rod in a boat being rowed is no strike
    if (this.boat.rowing) return 'none';
    // a lure snagged in the reeds is tugged and given, not struck
    if (this.lure.phase === 'snagged') return 'none';
    // a strike takes the rod up and strikes in the one call, so a fish biting is hooked as it is in the hand
    this.takeUp();
    const did = this.bite.strike(this.t, this.fish, this.lure);
    if (did !== 'none') this.events.struck?.(did);
    if (did === 'hooked' && this.bite.drum >= 0) this.hookDrum();
    else if (did === 'hooked' && this.bite.treasure >= 0) this.hookTreasure();
    else if (did === 'hooked') {
      this.catchDrum = false;
      this.catchTreasure = -1;
      const i = this.bite.fish;
      const [lx, ly] = this.landing();
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
      this.bodies.take();
      this.lure.at[0] = this.fish.x[i];
      this.lure.at[1] = this.fish.y[i];
      this.lure.at[2] = -this.fish.depth[i];
    }
    return did;
  }

  /** A drum snagged and struck: hauled by its own profile, the lure at the drum, and no chance drawn for weight or temper. */
  private hookDrum() {
    const i = this.bite.drum;
    const [lx, ly] = this.landing();
    const [x, y] = [this.drums.x[i], this.drums.y[i]];
    this.catchDrum = true;
    this.catchTreasure = -1;
    this.catchWeight = this.lake.drums.weight;
    this.temper = 'steady';
    this.line.start(Math.hypot(x - lx, y - ly), drumFight(this.gear), this.random);
    this.bearing = Math.atan2(y - ly, x - lx);
    this.hookedAt = this.t;
    this.lure.phase = 'hooked';
    this.bodies.take();
    this.lure.at[0] = x;
    this.lure.at[1] = y;
    this.lure.at[2] = -Math.max(0, this.lake.bedDepth(x, y) - 0.3);
  }

  /** A treasure snagged and struck: hauled by its own profile, the lure at it, and no chance drawn for weight or temper. */
  private hookTreasure() {
    const i = this.bite.treasure;
    const [lx, ly] = this.landing();
    const [x, y] = [this.treasures.x[i], this.treasures.y[i]];
    this.catchDrum = false;
    this.catchTreasure = i;
    this.catchWeight = this.lake.treasures.list[i].weight;
    this.temper = 'steady';
    this.line.start(Math.hypot(x - lx, y - ly), treasureFight(this.gear), this.random);
    this.bearing = Math.atan2(y - ly, x - lx);
    this.hookedAt = this.t;
    this.lure.phase = 'hooked';
    this.bodies.take();
    this.lure.at[0] = x;
    this.lure.at[1] = y;
    this.lure.at[2] = -Math.max(0, this.lake.bedDepth(x, y) - 0.3);
  }

  /** The reel held, or let go. */
  reel(on: boolean) {
    const was = this.reeling;
    if (on === true) this.takeUp();
    this.reeling = on === true;
    if (was && !this.reeling && this.lure.phase === 'snagged') this.give();
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
    // the contests: this cast landed its fish, and a stow in the rain (not a shower) counts for the rain's
    this.castStowed = true;
    const tally = this.progress.save.tally;
    tally.run = Math.min(tally.run + 1, Number.MAX_SAFE_INTEGER);
    tally.best = Math.max(tally.best, tally.run);
    if (this.weather === 'rain') tally.rain = Math.min(tally.rain + 1, Number.MAX_SAFE_INTEGER);
    this.persist();
    this.events.cured?.(save.cured, this.lake.toClean);
    // a gift is given on the cure that earns it, from the next fight, and told that once
    const had = this.gear;
    this.gear = this.bite.gear = gearFor(this.progress.curedTotal());
    for (const g of GEAR) if (this.gear[g.id] && !had[g.id]) this.events.gifted?.(g.name, g.words);
    this.answer(true);
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
    this.answer(true);
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
    // a find can meet a request too (the logbook's last page), so the town is asked as it is after a stow or a haul
    this.answer(true);
    return true;
  }

  /**
   * A photograph kept at the end of the album: the lake, day, clock and weather as the game has them now (the weather
   * the lever set, if it did, since a photograph keeps what was shown) and the camera and the kinds in frame as the page
   * works them out, which `Game` knows nothing of. A kind the lake cannot give is dropped and each is kept once. False,
   * and nothing changed, with the album full or while yawning or leaving. A photograph can meet a request, so the town
   * is asked as it is after a stow.
   */
  photograph(subjects: { view: Photo['view']; kinds: string[]; lit: boolean }): boolean {
    if (this.place !== 'pond' && this.place !== 'cabin') return false;
    const { photos } = this.progress.save;
    if (photos.length >= PHOTOS.most) return false;
    const possible = new Set<string>(this.lake.fishKinds.map((k) => KINDS[k].id));
    photos.push({
      lake: this.lake.id,
      day: this.day,
      time: this.timeOfDay,
      weather: this.weather,
      view: { ...subjects.view },
      kinds: [...new Set(subjects.kinds)].filter((id) => possible.has(id)),
      lit: subjects.lit,
    });
    this.persist();
    this.events.photographed?.(photos.length - 1);
    this.answer(true);
    return true;
  }

  /** The photograph at `index` thrown away, the later ones moving up; false, and nothing changed, for a place with none. */
  discard(index: number): boolean {
    const { photos } = this.progress.save;
    if (!Number.isInteger(index) || index < 0 || index >= photos.length) return false;
    photos.splice(index, 1);
    this.persist();
    this.events.discarded?.(index);
    return true;
  }

  /**
   * Fish `i` cured and let go in the pond, `RELEASE.distance` out from the angler (the shore's, or the boat's seat aboard)
   * toward the middle and facing away from the shore, or further out a step at a time until that is on the water; if none of the tries is, it stays where the
   * fight left it, which was on the water. A small splash is told there.
   */
  private release(i: number) {
    const { lake } = this;
    const angler = this.anglerAt();
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

  /**
   * Which way is ahead of the angler for a fight: the way the boat points aboard, the lake's angler's heading ashore (down
   * the jetty's deck), and due north from a stand with none (the Reservoir's bank).
   */
  private ahead(): number {
    return this.boat.aboard ? this.boat.heading : (this.lake.angler.heading ?? Math.PI / 2);
  }

  /**
   * The fish's bearing from the landing, kept within `HOOKED.wide` either side of `ahead`. Due north is clamped on the
   * raw bearing, as it always was, so a game played from a north-facing bank keeps its sums to the bit; any other way is
   * clamped on the bearing's turn from it, so a bearing either side of the compass's seam is not thrown across to the
   * far limit.
   */
  private fanned(ahead: number): number {
    if (ahead === Math.PI / 2) return Math.min(ahead + HOOKED.wide, Math.max(ahead - HOOKED.wide, this.bearing));
    let off = Math.atan2(Math.sin(this.bearing - ahead), Math.cos(this.bearing - ahead));
    off = Math.min(HOOKED.wide, Math.max(-HOOKED.wide, off));
    return ahead + off;
  }

  /** The fight on by `dt`: the zone and the meter, and the fish swimming to keep to it along its bearing, swaying, with the lure in its mouth. */
  private fight(dt: number) {
    if (this.catchDrum || this.catchTreasure >= 0) return this.fightFind(dt);
    const i = this.bite.fish;
    const was = this.line.step(dt, this.reeling, this.contamination, this.random);
    const [lx, ly] = this.landing();
    const ahead = this.ahead();
    const sway = HOOKED.sway * Math.sin((this.t - this.hookedAt) * HOOKED.swayRate);
    const b = this.fanned(ahead) + sway;
    const depth = Math.min(2.5, 0.3 + this.line.out * 0.08);
    steerTo(this.fish, i, lx + Math.cos(b) * this.line.out, ly + Math.sin(b) * this.line.out, depth, HOOKED.speed, dt);
    this.lure.at[0] = this.fish.x[i];
    this.lure.at[1] = this.fish.y[i];
    this.lure.at[2] = -this.fish.depth[i];
    if (was === 'slipped') {
      // nothing is lost: the fish swims off, and the lure sinks on where it was
      this.bite.letGo(this.t, this.fish, this.lure, true);
      this.lure.freed(this.lure.at[0], this.lure.at[1], -this.lure.at[2]);
      this.bodies.drop(this.lure.bobber[0], this.lure.bobber[1]);
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
    const [lx, ly] = this.landing();
    const b = this.fanned(this.ahead());
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

  /** The sky today: the lever's if it was set, else the day's own (`weatherOf`). */
  get weather(): Weather {
    // a photograph looked at at the pond shows the weather it was taken in, whatever the lever or the day say
    if (this.still && this.place === 'pond') return this.still.photo.weather;
    if (this.weatherLever) return this.weatherLever;
    if (this.dayWeatherFor !== this.day) {
      this.dayWeather = weatherOf(this.day);
      this.dayWeatherFor = this.day;
    }
    return this.dayWeather;
  }

  /** How far the rain draws the fish up: `FISHING.rainLift` in rain and in a shower, else nothing. */
  get lift(): number {
    return this.weather === 'rain' || this.weather === 'shower' ? FISHING.rainLift : 0;
  }

  /** The wind's push on a cast as a vector: the shared one in the wind weather, else the shared nothing; nothing is made. */
  get wind(): readonly [number, number] {
    return this.weather === 'wind' ? WEATHER.wind.vector : NO_WIND;
  }

  /**
   * Forces the weather, a lever for the tests and the pictures as the contamination's is, counted with it; null gives
   * the day's back. A name that is none of the kinds is refused, returns false and changes nothing.
   */
  setWeather(name: string | null): boolean {
    if (name !== null && !(WEATHER.kinds as readonly string[]).includes(name)) return false;
    this.weatherLever = name as Weather | null;
    this.levers++;
    return true;
  }

  /**
   * A photograph of the album looked at: the clock is put to the one it was taken at, at the pond (the cabin's holds),
   * and the weather becomes its own through the `weather` getter, neither counted as a lever. Refused, and nothing
   * changed, for a place with no photograph, one of another lake, a still already, a fish hooked or landed, and
   * anywhere but the pond and the cabin.
   */
  lookAt(index: number): boolean {
    const photo = Number.isInteger(index) ? this.progress.save.photos[index] : undefined;
    if (!photo || photo.lake !== this.lake.id || this.still || this.fighting) return false;
    if (this.place !== 'pond' && this.place !== 'cabin') return false;
    this.still = { index, photo, timeBefore: this.timeOfDay };
    if (this.place === 'pond') this.setTimeOfDay(photo.time);
    return true;
  }

  /** The photograph put down: the clock back to where it was at the pond. False, and nothing changed, with none looked at. */
  lookAway(): boolean {
    if (!this.still) return false;
    if (this.place === 'pond') this.setTimeOfDay(this.still.timeBefore);
    this.still = null;
    return true;
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
    // nor while the boat is rowed: a pebble thrown from a moving boat is not a game anyone has asked for
    if (this.place !== 'pond' || this.boat.rowing) return false;
    if (![x, y, size].every(Number.isFinite) || size <= 0 || !this.lake.inside(x, y)) return false;
    this.splashes.add(x, y, this.t, size);
    this.events.splashed?.(x, y, size);
    this.bite.splashed(this.t, x, y, this.fish, this.lure);
    return true;
  }

  /** A pebble dropped somewhere on the water near (x, y), by chance; on the water somewhere else if none is near. */
  dropNear(x: number, y: number): boolean {
    // refused before any chance is drawn, so a refusal away from the pond, or while rowing, moves nothing
    if (this.place !== 'pond' || this.boat.rowing) return false;
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

  /** A cast thrown at `angle` round the compass and `power` from nought to one, from the rod's tip wherever the angler is (the shore, or the boat's seat); one out already is reeled in first. Refused, and nothing changed, for what is not a finite number, away from the pond, and while the boat is rowed. */
  cast(angle: number, power: number): boolean {
    if (!Number.isFinite(angle) || !Number.isFinite(power)) return false;
    // there is no casting from the cabin or while yawning: the lure was brought in for the night and stays in
    if (this.place !== 'pond') return false;
    // a lure snagged in the reeds is held fast: it is tugged free, not cast over
    if (this.lure.phase === 'snagged') return false;
    // a fish on the line, or landed and waiting to be stowed, is seen to first, and the oars are shipped before a rod is cast
    if (this.bite.phase === 'hooked' || this.bite.phase === 'landed' || this.boat.rowing) return false;
    this.reelIn();
    this.lure.cast(angle, power, this.t, this.wind, this.anglerAt());
    this.bodies.take();
    // the cast before this one ended with no fish stowed, so the run of casts that each landed one is broken
    if (!this.castStowed) this.progress.save.tally.run = 0;
    this.castStowed = false;
    return true;
  }

  /**
   * The lure put snagged in bed `i` of reeds, `SNAG.reach` / 2 out from its edge toward the lake's middle, whatever it was
   * doing (reeled in by force first): the test API's lever for a picture or a test that wants the snag without a cast.
   * Refused, and nothing changed, for a bed the lake has not, away from the pond, with a fish hooked or landed, while the
   * boat is rowed, and where that point is not on the water.
   */
  snagAt(i: number): boolean {
    const s = Number.isInteger(i) ? this.lake.snags[i] : undefined;
    if (!s || this.place !== 'pond' || this.boat.rowing || this.bite.phase === 'hooked' || this.bite.phase === 'landed')
      return false;
    let d = Math.hypot(s.x, s.y);
    const [ux, uy] = d > 1e-9 ? [-s.x / d, -s.y / d] : [1, 0];
    d = s.radius + SNAG.reach / 2;
    const [x, y] = [s.x + ux * d, s.y + uy * d];
    if (!this.lake.inside(x, y)) return false;
    this.reelInForce();
    this.lure.snag(i, x, y);
    this.bodies.take();
    this.events.snagged?.(i);
    return true;
  }

  /**
   * The lure brought back to the rod, ready to cast again. Refused, and nothing changed, with a fish hooked or landed and
   * with the lure snagged in the reeds, which only a tug and a give free (`docs/boat.md`, C4); says whether it was done.
   */
  reelIn(): boolean {
    if (this.bite.phase === 'hooked' || this.bite.phase === 'landed' || this.lure.phase === 'snagged') return false;
    this.reelInForce();
    return true;
  }

  /**
   * The lure brought in whatever holds it, a snag included: what the yawn, a row, a journey and the cabin do, and nothing
   * is lost by it. A fish hooked or landed is still the fight's, and the lure stays in its mouth.
   */
  private reelInForce() {
    this.takeUp();
    if (this.bite.phase === 'hooked' || this.bite.phase === 'landed') return;
    if (this.bite.phase !== 'none') this.bite.letGo(this.t, this.fish, this.lure);
    this.lure.reelIn();
    this.bodies.take();
    this.tugging = 0;
  }

  /**
   * The rod propped on its rest, or taken up again (`docs/boat.md`, C5): propped, the bobber is left to sit, the reel is let
   * go and a bite waits `LAZY.window` for the strike, with the bell to say so. Refused (false, nothing changed) unless the
   * lure is sinking, with no fish hooked or landed and the boat not being rowed, at the pond, and when the rod is already
   * so. Told as `propped`.
   */
  prop(on: boolean): boolean {
    if (typeof on !== 'boolean' || on === this.propped) return false;
    if (!on) {
      this.takeUp();
      return true;
    }
    if (this.place !== 'pond' || this.boat.rowing || this.lure.phase !== 'sinking' || this.fighting) return false;
    this.reeling = false;
    this.propped = true;
    this.bite.propped = true;
    this.events.propped?.(true);
    return true;
  }

  /** The rod taken up, if it was propped: told once, and the bite's window is the hand's again. Every call that handles the lure or the fish does this first. */
  private takeUp() {
    if (!this.propped) return;
    this.propped = false;
    this.bite.propped = false;
    this.events.propped?.(false);
  }

  /** The save written now. */
  persist() {
    // the yawn keeps what the save had: its clock is just past midnight and the day has not gone up, so a load from it
    // lands before the yawn, which comes again
    if (this.place !== 'yawning') {
      // a photograph looked at has the clock at its own time: the save keeps play's, so a load lands where play was
      this.progress.save.time = this.still ? this.still.timeBefore : this.timeOfDay;
      // leaving is for the lake the save names, at its pond or, at home, its cabin
      this.progress.save.place = this.place === 'leaving' ? this.arrival : this.place;
    }
    // the boat is saved where it lies at an anchorage, and as ashore otherwise; a row under way is not saved, so a load
    // lands at the last anchorage (or the mooring, for a row from the shore)
    if (!this.boat.rowing) {
      const mine = this.progress.entry(this.lake.id);
      if (!this.boat.aboard) mine.boat = null;
      else if (mine.boat) {
        mine.boat.x = this.boat.x;
        mine.boat.y = this.boat.y;
        mine.boat.heading = this.boat.heading;
        mine.boat.anchored = this.boat.anchored;
      } else {
        mine.boat = { x: this.boat.x, y: this.boat.y, heading: this.boat.heading, anchored: this.boat.anchored };
      }
    }
    this.progress.persist();
  }

  /**
   * Where the angler is: the lake's own place on the shore, and the boat's seat aboard, with the rod held from there
   * (`BOAT.tip`). Every reader of where the angler stands asks this and not the lake; the grass, the scenery and the bed
   * finds keep the shore's. Aboard it is one object written into, so keep what is needed of it rather than the object.
   */
  anglerAt(): Stand {
    return this.boat.aboard ? anglerAboard(this.boat, this.stand) : this.lake.angler;
  }

  /** Where a fish is landed: the lake's `landAt` on the shore, `BOAT.landAt` beside the seat aboard. Aboard it is one array written into. */
  landing(): readonly [number, number] {
    return this.boat.aboard ? (landingAboard(this.boat, this.landingPoint) as [number, number]) : this.lake.landAt;
  }

  /**
   * The boat rowed to (x, y), straight and at `BOAT.speed`, the player boarding first if ashore (the boat starts from
   * where it lies, the mooring). The lure is reeled in as the yawn does it (a coming or nibbling fish lets go), the reel
   * let go, and the boat's heading is the line's. At the end it is anchored there, the save written and `anchored` told.
   * Refused, and nothing changed, at a lake with no boat, away from the pond (the cabin, the yawn, a journey), with a fish
   * hooked or landed, while a photograph is looked at, while rowing already, for a point that is not a finite number, and
   * for a point or a line that the boat keeps off: the end must be on the water `BOAT.keepOff` in from the shore, every
   * boulder and the jetty, and so must every half unit of the straight line from where the boat is.
   */
  row(x: number, y: number): boolean {
    if (!this.mayRow() || !rowPath(this.lake, this.boat.x, this.boat.y, x, y)) return false;
    this.setOff(x, y, false);
    return true;
  }

  /**
   * The boat rowed home to its mooring and the player stepped off: refused as `row` is, and when ashore already, and when
   * the straight line home crosses ground the boat keeps off (row to open water first). At the end the boat lies at its
   * mooring, `aboard` is false, the save says ashore and `ashore` is told.
   */
  land(): boolean {
    const mooring = this.lake.boat?.mooring;
    if (!mooring || !this.boat.aboard || !this.mayRow()) return false;
    if (!rowPath(this.lake, this.boat.x, this.boat.y, mooring.x, mooring.y)) return false;
    this.setOff(mooring.x, mooring.y, true);
    return true;
  }

  /**
   * The anchor weighed (`down` false) or dropped (true), docs/boat.md C3: weighed, the boat's body is let go where it
   * lies and drifts on the wind and the currents, told as `adrift`; dropped, it is held where it has got to, told as
   * `anchored`. Either way the save is written. Refused, and nothing changed, at a lake with no boat, ashore, while
   * rowing, away from the pond, while a photograph is looked at, and when the anchor is so already. A fight neither
   * refuses it nor is refused by it, and the seat goes with the boat.
   */
  anchor(down: boolean): boolean {
    const { boat } = this;
    if (typeof down !== 'boolean') return false;
    if (!this.lake.boat || !boat.aboard || boat.rowing || this.place !== 'pond' || this.still) return false;
    if (boat.anchored === down) return false;
    boat.anchored = down;
    if (down) {
      this.bodies.holdBoat();
      this.persist();
      this.events.anchored?.(boat.x, boat.y);
    } else {
      this.bodies.letGoBoat();
      this.persist();
      this.events.adrift?.();
    }
    return true;
  }

  /** Whether a row or a landing may begin now, apart from where it goes. */
  private mayRow(): boolean {
    return !(!this.lake.boat || this.place !== 'pond' || this.fighting || this.boat.rowing || this.still);
  }

  /** The row begun: the lure in, the player aboard, the line from here to (x, y) laid out from now. */
  private setOff(x: number, y: number, home: boolean) {
    const { boat } = this;
    this.reelInForce();
    this.reeling = false;
    boat.fromX = boat.x;
    boat.fromY = boat.y;
    boat.toX = x;
    boat.toY = y;
    boat.rowedAt = this.t;
    if (Math.hypot(x - boat.x, y - boat.y) > 0) boat.heading = Math.atan2(y - boat.y, x - boat.x);
    boat.aboard = true;
    boat.rowing = true;
    // a row carries the boat, whether it was adrift or at anchor
    boat.anchored = true;
    this.bodies.holdBoat();
    this.landingIn = home;
    this.events.rowed?.(x, y);
  }

  /** The row on to now: the boat where its line has it, and at the end anchored, or, home, the player stepped off. */
  private stepRow() {
    const { boat } = this;
    rowAt(boat, this.t, this.rowPoint);
    boat.x = this.rowPoint[0];
    boat.y = this.rowPoint[1];
    this.bodies.putBoat(boat.x, boat.y);
    if ((this.t - boat.rowedAt) * BOAT.speed < Math.hypot(boat.toX - boat.fromX, boat.toY - boat.fromY)) return;
    boat.rowing = false;
    if (this.landingIn) {
      this.landingIn = false;
      this.stowBoat();
      this.persist();
      this.events.ashore?.();
    } else {
      this.persist();
      this.events.anchored?.(boat.x, boat.y);
    }
  }

  /** The boat put ashore at its mooring with nobody aboard, in the game and in the save's memory (written by the next `persist`). */
  private stowBoat() {
    const { boat } = this;
    const m = this.lake.boat?.mooring;
    boat.aboard = false;
    boat.rowing = false;
    boat.anchored = true;
    this.bodies.holdBoat();
    this.landingIn = false;
    if (m) {
      boat.x = boat.fromX = boat.toX = m.x;
      boat.y = boat.fromY = boat.toY = m.y;
      boat.heading = m.heading;
      this.bodies.putBoat(m.x, m.y);
    }
    this.progress.entry(this.lake.id).boat = null;
  }
}
