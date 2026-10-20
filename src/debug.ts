/**
 * `window.game`: the game, for tests and for poking at from the console.
 * Everything a test needs to set a scene, play it exactly and read back
 * what happened, so no test waits on a clock or reaches into the game's
 * insides.
 *
 * Time is the test's to keep: `pause` stops the game where it is, and
 * `step` plays it on a frame at a time, exactly, drawing the last. `seed`
 * makes chance repeat. Anything that changes the game goes through here,
 * and `state`, `fish`, `settings` and `invariants` read it back. The
 * levers the lab's panel used to hold are here for the tests (`dirt`, `time`, `view`, `caustics`
 * and `paint`), and `mode` does what the page's look or cast button does; each
 * resolves once the frame it changes is ready to draw.
 *
 * The types are shared with the smoke tests, so a test that calls something
 * that is not here does not compile.
 */
import { careful } from './angler';
import type { Game } from './game';
import { aimAt, flight } from './cast';
import type { Layout } from './layout';
import type { Place } from './night';
import type { Mode } from './mode';
import type { PhoneReading } from './phone/session';
import type { Rung } from './rung';
import { checkInvariants } from './invariants';
import type { Journal } from './journal';
import { seasonOf } from './calendar';
import { ANGLER, KINDS, TREASURES, bedDepth, type Season } from './lake';
import { bankSpot } from './drumdraw';
import { shelfSpot } from './treasuredraw';
import { seeded } from './random';
import type { SceneryFigures } from './scene';
import type { Settings } from './settings';

declare global {
  interface Window {
    game?: GameApi;
  }
}

/** What the phone reads as before pairing has been opened: nobody is there and nothing has been said. */
export const NO_PHONE: PhoneReading = {
  paired: false,
  motion: false,
  lastKind: null,
  refused: 0,
  lastRefusal: null,
};

export interface GameState {
  /** Game time, in seconds. */
  t: number;
  frame: number;
  paused: boolean;
  contamination: number;
  /** The contamination the water shows, which heals toward `contamination` after a cure. */
  waterDirt: number;
  timeOfDay: number;
}

/** A splash on the water, where it landed and how long ago. */
export interface Splash {
  x: number;
  y: number;
  age: number;
}

/** The lure: what it is doing, where it is, how deep it has sunk, and where its bobber floats. */
export interface LureState {
  phase: string;
  x: number;
  y: number;
  z: number;
  depth: number;
  sunk: number;
  bobber: [number, number];
}

/** What `fishTo` fishes for: a drum on the bed, a junk treasure by its id, or a kind of fish by its id. */
export type Quarry = 'drum' | 'bream' | 'perch' | 'pike' | 'lure' | 'plush' | 'lunchbox' | 'badge' | 'bottle' | 'duck';

/** A drum of waste: where it lies on the bed, and whether it has been hauled up for good. */
export interface DrumState {
  x: number;
  y: number;
  /** How deep the bed is under it. */
  bed: number;
  hauled: boolean;
  /** Where it stands on the bank by the cabin once hauled: x, y and z in the world. */
  bank: [number, number, number];
}

/** A junk treasure: where it lies on the bed, whether it is found and kept, and where it stands on the cabin's shelf. */
export interface TreasureState {
  id: string;
  x: number;
  y: number;
  /** How deep the bed is under it. */
  bed: number;
  found: boolean;
  /** Where it stands on its shelf once found: x, y and z in the world. */
  shelf: [number, number, number];
}

/** A fish, where it is. */
export interface FishingState {
  phase: string;
  fish: number;
  /** The drum snagged, hooked or landed, or minus one. */
  drum: number;
  /** The junk treasure snagged, hooked or landed, or minus one. */
  treasure: number;
  tension: number;
  out: number;
  pulling: boolean;
  reeling: boolean;
  /** The fight's bar: the foot of the zone and its height, where the fish is on it, and the meter, each from nought to one. */
  zone: number;
  width: number;
  fishAt: number;
  meter: number;
  /** The temper of the fish on the line or landed: calm, steady or feisty. */
  temper: string;
  bucket: number;
  weight: number;
}

export interface Fish {
  x: number;
  y: number;
  depth: number;
  /** Cured: gold, let go in the pond, and never drawn to the lure. */
  cured: boolean;
  /** Its kind: an index into `KINDS`. */
  kind: number;
}

/** The season and what the page has dressed of it, as `game.season()` reads. */
export interface SeasonReading {
  name: Season;
  dressed: Season | null;
  statics: number;
  falling: number;
  mist: boolean;
  /** How long the last dressing took, in milliseconds: the colours built and handed over, as the page measured it. */
  dressMs: number;
  /** How long the last bake of a season's four looks took at a wake, in milliseconds (nought before one). */
  bakeMs: number;
}

export interface GameApi {
  readonly version: 1;
  /** Booted, and the frame loop running. */
  readonly ready: boolean;
  /** How long the boot took, from the page's start to ready, in milliseconds; 0 until it has. */
  readonly bootMs: number;

  pause(): void;
  resume(): void;
  /** Play `frames` frames of 1/60 s exactly, each drawn. */
  step(frames?: number): void;
  /** Chance from a seed from now on. */
  seed(n: number): void;

  state(): GameState;
  fish(): Fish[];
  /** Each drum of waste on the bed, where it lies and whether it is hauled. */
  drums(): DrumState[];
  /** Each junk treasure on the bed, where it lies, whether it is found and where it stands on the shelf once it is. */
  treasures(): TreasureState[];
  /** Every splash in the pool, live or over. */
  splashes(): Splash[];
  /** What has happened since this was last asked, a line each: "splashed 3.0,-4.0". */
  events(): string[];
  /** What the address holds as it stands: the water's caustics and the rocks' paint. */
  settings(): Settings;
  /** The rules that must always hold, broken; empty when all is well. */
  invariants(): string[];
  /** The save written now, and what it is. */
  save(): string;

  /** A cast thrown at `angle` round the compass (nought east, a quarter turn north) and `power` from nought to one. */
  cast(angle: number, power: number): boolean;
  /** A cast aimed but not yet thrown, its preview drawn, as a drag does; null for none. */
  aim(to: { angle: number; power: number } | null): void;
  reelIn(): void;
  lure(): LureState;
  /** The player strikes, as a tap does: says whether it hooked a fish biting, spooked one nibbling, twitched the lure, or did nothing. */
  strike(): string;
  /** The reel held or let go, as holding the screen, the Reel button or space does. */
  reel(on: boolean): void;
  /** The save's journal: for each kind caught, by its id, how many, the best weight and the day of the first; and the ids of the treasures found. */
  journal(): { kinds: Journal; found: string[] };
  /** The landed fish put in the bucket, as a tap on its card does; false with none landed. */
  stow(): boolean;
  /** The landed drum of waste hauled up onto the bank, as a tap on its card does; false with none landed. */
  haul(): boolean;
  /** The landed junk treasure kept for the shelf, as a tap on its card does; false with none landed. */
  keep(): boolean;
  /** The gifts in force, a flag for each (line, reel, rod, bobber, bait): what the cure count earns, from the next fight. */
  gear(): Record<string, boolean>;
  /** The fishing: the bite's phase and its fish, the line's strain and length, whether the fish darts, the bar, and the bucket. */
  fishing(): FishingState;
  /**
   * The lake played to a moment of the fishing, as a careful angler would: a cast to the middle and the bite; a fight
   * under way with the fish in the zone and the meter past half; or a fish landed and waiting by the rod. For the pictures, which want each moment
   * the same every run; says whether it got there.
   */
  fishTo(moment: 'bite' | 'fight' | 'landed', quarry?: Quarry): boolean;
  /** Where the cast being aimed will land, and whether on the water; null when none is aimed. */
  preview(): { x: number; y: number; z: number; onWater: boolean } | null;
  /** A pebble dropped on the water at (x, y); says whether it landed, which off the water it does not. */
  drop(x: number, y: number): boolean;
  /** A pebble dropped somewhere near what the camera looks at. */
  dropNear(): boolean;

  /** The lake made as dirty as that, from clear (0) to sick (1), as the cure does; a number it is not is refused. */
  dirt(contamination: number): Promise<void>;
  /**
   * The clock put at the time of day of that name (night, dawn, day or dusk), which it runs on from; one not known is
   * refused. Without a name, says which look the page is lit with now.
   */
  time(): string;
  /** Refused, and nothing changed, away from the pond: time is stopped in the cabin and while yawning. */
  time(name: string): Promise<void>;
  /**
   * The camera put at the view of that name (shore, boat, overhead or phone), look mode unless the page's mode put it
   * there. Without a name, says which view the camera was last put at.
   */
  view(): string;
  /** Says `cabin` inside. A view picked is refused, and nothing changed, away from the pond (yawning, or in the cabin). */
  view(name: string): Promise<void>;
  /**
   * The clock put at a point of the day, from midnight (0) round to midnight again (1, which is nought), without
   * lighting the page: the look follows at the next step, as it does when the clock gets there by itself.
   */
  clock(at: number): void;
  /** How many of the four looks' environments are baked: all four once the first frame is up, so a step in play bakes none. */
  looksBaked(): number;
  /** The contamination the water was last handed over at, in whole `HEAL.step`s, which follows the game's `waterDirt` as it heals after a cure; null before the first. */
  drawnDirt(): number | null;
  /** How many times the water's groups have been handed over since boot. */
  waterHandovers(): number;
  /** How many fish were cured when the fish were last handed to the renderer, which follows the school's at once when one is cured; -1 before the first. */
  drawnCured(): number;
  /** The wall calendar's marks as last handed to the renderer: the squares gone, today's square (-1 before the first), and how many times they have been handed over since boot, which is once a day's change. */
  calendar(): { gone: number; today: number; handovers: number };
  /**
   * The season the day is in, and what the page has dressed of it: `name` is the day's, `dressed` the season last
   * handed to the renderer (null before the dressing exists), `statics` how many times the static set was handed over for
   * a season, `falling` the falling things emitted, and `mist` whether the fog is on, and `dressMs` how long the last
   * dressing took. The colours are real (part 2); `falling` and `mist` are placeholders until the later parts fill them.
   */
  season(): SeasonReading;
  /** The water's caustics, on or off. */
  caustics(on: 'on' | 'off'): Promise<void>;
  /** The rocks' painted edge, on or off: with it off the same rocks are drawn plain. */
  paint(value: 'on' | 'off'): Promise<void>;

  /**
   * The page's mode: `look`, where a drag turns the camera in every view, or `cast`, where the camera is held at the
   * Shore view and a drag back aims a cast. With a mode, puts the page in it as the button does, resolving once it is
   * ready to draw; without, says which it is in.
   */
  mode(): Mode;
  mode(to: Mode): Promise<void>;

  /**
   * The phone, as the screen has it: whether one is paired and said it has motion sensors, the kind of the last good
   * message, and how many were refused and why the last was. Reads nothing until pairing has been opened.
   */
  phone(): PhoneReading;
  /**
   * Opens the pairing overlay as Pair a phone does, resolving once the QR code is drawn. `fixed` names the room and key,
   * for tests and the look pictures only, so that a picture of the code holds still; a player's press never has one. `origin`
   * likewise names the address the code carries, so a picture does not depend on the port the smoke is served on.
   */
  pair(fixed?: { room: string; key: string; origin?: string }): Promise<void>;
  /**
   * Whether a page holds the clock: the menu's list, the journal, the Start again question or the pairing card is
   * open. While one is, `step` moves nothing and no key, tap, button or phone gesture reaches the game.
   */
  pagesOpen(): boolean;
  /**
   * Opens the question before Start again as the menu's item does, resolving once it is shown, for the pictures. There
   * is no way to answer it here: the answer is tested by pressing its buttons, as a player does.
   */
  startAgain(): Promise<void>;
  /**
   * Opens the journal's page as the menu's item does, resolving once it is shown, or closes it again with `false`. While
   * it is open the page does not step the game, whether a frame of its own or a step the test asks for.
   */
  openJournal(open?: boolean): Promise<void>;

  /** The camera looking at a point, from `azimuth` round and `polar` down, `radius` away, at once. */
  look(x: number, y: number, view?: { azimuth?: number; polar?: number; radius?: number }): void;
  /** Where the camera is, and what it is looking at. */
  camera(): { position: number[]; target: number[] };
  /** Where a point of the world is on the page, in CSS pixels from its top left; null behind the camera. */
  project(x: number, y: number, z: number): { x: number; y: number } | null;
  /**
   * What drawing a frame of the scene as it stands costs, in milliseconds, once the GPU has been kept drawing for
   * `warm` of them: a quarter of a second unless told otherwise, which is what one that sat idle while the page
   * booted needs. A test that measures scene after scene may ask for less after the first.
   */
  measureFrame(warm?: number): Promise<number>;
  /** What stands on the banks, in figures: the kit models and tree variants placed, the placements, the triangles drawn (the bed’s bands among them) and the cards. */
  scenery(): SceneryFigures;
  /**
   * The rung the page is drawn on: `full`, with the banks' grass, or `lean`, without it. With a
   * rung, puts the page on it as the governor does at boot, resolving once it is ready to draw; without, says which
   * it is on.
   */
  rung(): Rung;
  rung(to: Rung): Promise<void>;
  /** The blades of grass the last frame drew, near and far, read back from the GPU: none on the lean rung. */
  grass(): Promise<{ near: number; far: number }>;
  /**
   * The splashes' ripples the last frame drawn handed to the water, where each landed, how long ago and how big: none
   * once a splash's ripples are over, and none until a frame has been drawn since it landed.
   */
  ripples(): { x: number; y: number; age: number; size: number }[];
  /**
   * Fish `i`'s spine as the last frame drawn posed it, nose to the end of its tail's stalk, a point a joint: how its
   * body is bent by its stroke and its turn. Empty for a fish the lake does not have.
   */
  fishPose(i: number): [number, number, number][];
  /**
   * Where the things the fight must not cover are on the page, in CSS pixels: the bobber, the line's end at the lure
   * and the hooked fish's head, each null when it is not there to be seen (no bobber out of the water, no fish unless
   * one is hooked).
   */
  onScreen(): { bobber: Point | null; line: Point | null; fish: Point | null };
  /** Which layout the page is in (portrait, sideways or desk), as `layoutFor` says of the screen's shape. */
  layout(): Layout;

  /** Which day of play it is, from one. */
  day(): number;
  /** Where the player is: at the `pond`, `yawning` at the day's end, or in the `cabin`. */
  place(): Place;
  /** How faded the screen is to the night, from nought (clear) to one (black): the game's own, stepped with it. */
  fade(): number;
  /** Go to bed, as the menu's item does, from the pond or the cabin; says whether it began the night, which it does not with a fish hooked or landed or while yawning. */
  sleep(): Promise<boolean>;
  /** Go down to the pond from the cabin, as the button does, look mode at the Shore view and the clock running; resolves once the camera is ready, saying whether the player came out. */
  out(): Promise<boolean>;
}

/** A point on the page. */
export interface Point {
  x: number;
  y: number;
}

/** What the page gives the API that is not the game's: time, the camera and the renderer. */
export interface DebugHost {
  game: Game;
  ready(): boolean;
  bootMs(): number;
  paused(): boolean;
  setPaused(paused: boolean): void;
  /** Play one frame of `dt`, without drawing. */
  simulate(dt: number): void;
  draw(dt: number): void;
  frame(): number;
  look(x: number, y: number, view: { azimuth?: number; polar?: number; radius?: number }): void;
  camera(): { position: number[]; target: number[] };
  project(x: number, y: number, z: number): { x: number; y: number } | null;
  /** The cast being aimed, and setting it. */
  aiming(): { angle: number; power: number } | null;
  setAim(to: { angle: number; power: number } | null): void;
  /** The point the camera looks at, which a pebble dropped near is dropped near. */
  target(): [number, number];
  events: string[];
  measureFrame(warm?: number): Promise<number>;
  scenery(): SceneryFigures;
  rung(): Rung;
  setRung(to: Rung): Promise<void>;
  grass(): Promise<{ near: number; far: number }>;
  /** The ripples the last frame handed the water, four floats each. */
  ripples(): Float32Array;
  /** Fish `i`'s spine as the last frame posed it, three floats a joint; empty for none. */
  fishPose(i: number): Float64Array;
  /** The bobber, the line's end and the hooked fish's head on the page, each null when not there. */
  onScreen(): { bobber: Point | null; line: Point | null; fish: Point | null };
  /** The layout the page set on the document. */
  layout(): Layout;
  settings(): Settings;
  /** The phone's reading, and the overlay opened (on a fixed room for tests). */
  phone(): PhoneReading;
  pair(fixed?: { room: string; key: string; origin?: string }): Promise<void>;
  pagesOpen(): boolean;
  startAgain(): Promise<void>;
  openJournal(open: boolean): Promise<void>;
  /** The caustics or the paint changed, resolving once the change is ready to draw. */
  setSettings(next: Partial<Settings>): Promise<void>;
  /** The lake made as dirty as that, the water drawn so. */
  setDirt(contamination: number): Promise<void>;
  drawnDirt(): number | null;
  waterHandovers(): number;
  drawnCured(): number;
  /** The wall calendar's marks as last handed to the renderer: the squares gone, today's square (-1 before the first), and how many times they have been handed over since boot, which is once a day's change. */
  calendar(): { gone: number; today: number; handovers: number };
  /** What the page has dressed of the season, which the API joins to the day's name. */
  season(): Omit<SeasonReading, 'name'>;
  /** The clock put at the time of that name, and the page lit as it, a name not known refused; and the look the page is lit with. */
  setTime(name: string): Promise<void>;
  time(): string;
  looksBaked(): number;
  /** The camera put at a view, and the view it was last put at. */
  setView(name: string): Promise<void>;
  view(): string;
  /** The page's mode, and putting the page in one as its button does. */
  mode(): Mode;
  setMode(to: Mode): Promise<void>;
  /** Down from the cabin to the pond, the camera at the shore. */
  out(): Promise<boolean>;
}

export function createApi(host: DebugHost): GameApi {
  const { game } = host;
  return {
    version: 1,
    get ready() {
      return host.ready();
    },
    get bootMs() {
      return host.bootMs();
    },
    pause: () => host.setPaused(true),
    resume: () => host.setPaused(false),
    step(frames = 1) {
      // every frame drawn, not only the last: the renderer moves its particles by each drawn frame's time, and a
      // splash stepped by drawing only the last frame threw its droplets for a sixtieth of a second whatever the steps
      for (let f = 0; f < frames; f++) {
        host.simulate(1 / 60);
        host.draw(1 / 60);
      }
      if (frames <= 0) host.draw(1 / 60);
    },
    seed(n) {
      game.random = seeded(n);
    },

    state: () => ({
      t: game.t,
      frame: host.frame(),
      paused: host.paused(),
      contamination: game.contamination,
      waterDirt: game.waterDirt,
      timeOfDay: game.timeOfDay,
    }),
    fish() {
      const { fish } = game;
      return Array.from({ length: fish.count }, (_, i) => ({
        x: fish.x[i],
        y: fish.y[i],
        depth: fish.depth[i],
        cured: fish.cured[i] === 1,
        kind: fish.kind[i],
      }));
    },
    drums() {
      const { drums } = game;
      return Array.from({ length: drums.count }, (_, i) => ({
        x: drums.x[i],
        y: drums.y[i],
        bed: bedDepth(drums.x[i], drums.y[i]),
        hauled: drums.found[i] === 1,
        bank: bankSpot(i).slice(0, 3) as [number, number, number],
      }));
    },
    treasures() {
      const { treasures } = game;
      return TREASURES.list.map((t, i) => ({
        id: t.id,
        x: treasures.x[i],
        y: treasures.y[i],
        bed: bedDepth(treasures.x[i], treasures.y[i]),
        found: treasures.found[i] === 1,
        shelf: shelfSpot(i).slice(0, 3) as [number, number, number],
      }));
    },
    splashes() {
      const { splashes } = game;
      return Array.from({ length: splashes.count }, (_, i) => ({
        x: splashes.x[i],
        y: splashes.y[i],
        age: splashes.age(i, game.t),
      }));
    },
    events: () => host.events.splice(0),
    settings: () => host.settings(),
    invariants: () => checkInvariants(game),
    save() {
      game.persist();
      return JSON.stringify(game.progress.save);
    },

    cast: (angle, power) => game.cast(angle, power),
    aim: (to) => host.setAim(to),
    reelIn: () => game.reelIn(),
    strike: () => game.strike(),
    reel: (on) => game.reel(on),
    stow: () => game.stow(),
    haul: () => game.haul(),
    keep: () => game.keep(),
    journal: () => ({
      kinds: JSON.parse(JSON.stringify(game.progress.save.journal)) as Journal,
      found: [...game.progress.save.found],
    }),
    gear: () => ({ ...game.gear }),
    fishing: () => ({
      phase: game.bite.phase,
      fish: game.bite.fish,
      drum: game.bite.drum,
      treasure: game.bite.treasure,
      tension: game.line.tension,
      out: game.line.out,
      pulling: game.line.pulling,
      reeling: game.reeling,
      bucket: game.bucket,
      weight: game.catchWeight,
      zone: game.line.zone,
      width: game.line.figures.width,
      temper: game.temper,
      fishAt: game.line.fishAt,
      meter: game.line.meter,
    }),
    fishTo(moment, quarry) {
      // each frame as the page's own step does it, the lake on and drawn, so what follows in the picture is the same
      const frame = () => {
        host.simulate(1 / 60);
        host.draw(1 / 60);
      };
      const want = quarry === undefined || quarry === 'drum' ? -1 : KINDS.findIndex((k) => k.id === quarry);
      const treasure = TREASURES.list.findIndex((t) => t.id === quarry);
      // a drum or a treasure is hauled, not played: the reel is held and the fight pictured a few seconds in
      const hauled = quarry === 'drum' || treasure >= 0;
      /**
       * Fished for where the nearest uncured fish that `wanted` lies, the lure left to sink through its water. A bite by a
       * fish that is not `wanted` is let go and the cast thrown again, since the sink is the player's choice and it
       * passes every kind's water on the way down.
       */
      const fishFor = (wanted: (i: number) => boolean): boolean => {
        const dist = (i: number) => Math.hypot(game.fish.x[i] - ANGLER.x, game.fish.y[i] - ANGLER.y);
        for (let attempt = 0; attempt < 12; attempt++) {
          let near = -1;
          for (let i = 0; i < game.fish.count; i++) {
            if (!wanted(i) || game.fish.cured[i]) continue;
            if (near < 0 || dist(i) < dist(near)) near = i;
          }
          if (near < 0) return false;
          const { angle, power } = aimAt(game.fish.x[near], game.fish.y[near]);
          if (!game.cast(angle, power)) return false;
          for (let f = 0; f < 2400 && game.bite.phase !== 'biting'; f++) {
            frame();
            if (game.bite.fish >= 0 && game.bite.phase !== 'none' && !wanted(game.bite.fish)) break;
          }
          if (game.bite.phase === 'biting' && wanted(game.bite.fish)) return true;
          game.reelIn();
        }
        return false;
      };
      if (quarry === 'drum') {
        // the lure thrown to the first drum still on the bed and left to lie there, where it is snagged
        const i = game.drums.found.indexOf(0);
        if (i < 0) return false;
        const { angle, power } = aimAt(game.drums.x[i], game.drums.y[i]);
        if (!game.cast(angle, power)) return false;
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) frame();
      } else if (treasure >= 0) {
        // the lure thrown to the treasure, if it is still on the bed, and left to lie there, where it is snagged
        if (game.treasures.found[treasure]) return false;
        const { angle, power } = aimAt(game.treasures.x[treasure], game.treasures.y[treasure]);
        if (!game.cast(angle, power)) return false;
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) frame();
      } else if (want >= 0) {
        if (!fishFor((i) => game.fish.kind[i] === want)) return false;
      } else {
        // the middle of the lake first, as it always was; and, with a bite never coming in the water that is in the
        // band, where the nearest uncured fish lies, since the fish keep to depths and a cast to the middle may find none
        game.cast(Math.PI / 2 + 0.15, 0.55);
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) frame();
        if (game.bite.phase !== 'biting') {
          game.reelIn();
          fishFor(() => true);
        }
      }
      if (moment === 'bite') return game.bite.phase === 'biting';
      game.strike();
      for (let f = 0; f < 7200 && game.bite.phase === 'hooked'; f++) {
        const { line } = game;
        if (hauled) {
          // a drum or a treasure has no zone to keep: it is hauled by holding the reel, and the fight is pictured a few seconds in
          if (moment === 'fight' && f > 300 && line.meter > 0.5) break;
          game.reel(true);
          frame();
          continue;
        }
        // a fight is pictured a few seconds in, the fish in the zone and the meter past half
        if (moment === 'fight' && f > 300 && line.inZone() && line.meter > 0.5) break;
        game.reel(careful(line.zone, line.zoneSpeed, line.fishAt, line.figures.width));
        frame();
      }
      game.reel(false);
      return moment === 'fight' ? game.bite.phase === 'hooked' : game.bite.phase === 'landed';
    },
    lure() {
      const { lure } = game;
      return {
        phase: lure.phase,
        x: lure.at[0],
        y: lure.at[1],
        z: lure.at[2],
        depth: lure.depth,
        sunk: lure.sunk,
        bobber: [lure.bobber[0], lure.bobber[1]],
      };
    },
    preview() {
      const to = host.aiming();
      if (!to) return null;
      const f = flight(to.angle, to.power);
      return { x: f.landing[0], y: f.landing[1], z: f.landing[2], onWater: f.onWater };
    },
    drop: (x, y) => game.drop(x, y),
    dropNear: () => game.dropNear(...host.target()),
    dirt: (contamination) => host.setDirt(contamination),
    clock: (at) => game.setTimeOfDay(at),
    looksBaked: () => host.looksBaked(),
    drawnDirt: () => host.drawnDirt(),
    waterHandovers: () => host.waterHandovers(),
    drawnCured: () => host.drawnCured(),
    calendar: () => host.calendar(),
    season: () => ({ name: seasonOf(game.day), ...host.season() }),
    // time is stopped away from the pond, and the cabin's view is the one place to look from there: both let go unanswered
    time: ((name?: string) =>
      name === undefined
        ? host.time()
        : game.place === 'pond'
          ? host.setTime(name)
          : Promise.resolve()) as GameApi['time'],
    view: ((name?: string) =>
      name === undefined
        ? host.view()
        : game.place === 'pond'
          ? host.setView(name)
          : Promise.resolve()) as GameApi['view'],
    caustics: (on) => host.setSettings({ caustics: on }),
    paint: (value) => host.setSettings({ paint: value }),
    mode: ((to?: Mode) => (to === undefined ? host.mode() : host.setMode(to))) as GameApi['mode'],

    phone: () => host.phone(),
    pagesOpen: () => host.pagesOpen(),
    pair: (fixed) => host.pair(fixed),
    startAgain: () => host.startAgain(),
    openJournal: (open = true) => host.openJournal(open),

    look: (x, y, view = {}) => host.look(x, y, view),
    camera: () => host.camera(),
    project: (x, y, z) => host.project(x, y, z),
    measureFrame: (warm) => host.measureFrame(warm),
    scenery: () => host.scenery(),
    rung: ((to?: Rung) => (to === undefined ? host.rung() : host.setRung(to))) as GameApi['rung'],
    grass: () => host.grass(),
    ripples() {
      const d = host.ripples();
      return Array.from({ length: d.length / 4 }, (_, i) => ({
        x: d[i * 4],
        y: d[i * 4 + 1],
        age: d[i * 4 + 2],
        size: d[i * 4 + 3],
      }));
    },
    fishPose(i) {
      const d = host.fishPose(i);
      return Array.from({ length: d.length / 3 }, (_, k) => [d[k * 3], d[k * 3 + 1], d[k * 3 + 2]]);
    },
    onScreen: () => host.onScreen(),
    layout: () => host.layout(),

    day: () => game.day,
    place: () => game.place,
    fade: () => game.fade(),
    sleep: () => Promise.resolve(game.sleep()),
    out: () => host.out(),
  };
}
