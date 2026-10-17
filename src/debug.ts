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
import { FIGHT } from './lake';
import { flight } from './cast';
import type { Mode } from './mode';
import type { PhoneReading } from './phone/session';
import type { Rung } from './rung';
import { checkInvariants } from './invariants';
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

/** A fish, where it is. */
export interface FishingState {
  phase: string;
  fish: number;
  tension: number;
  out: number;
  pulling: boolean;
  reeling: boolean;
  /** The fight's bar: the foot of the zone and its height, where the fish is on it, and the meter, each from nought to one. */
  zone: number;
  width: number;
  fishAt: number;
  meter: number;
  bucket: number;
  weight: number;
}

export interface Fish {
  x: number;
  y: number;
  depth: number;
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
  /** The landed fish put in the bucket, as a tap on its card does; false with none landed. */
  stow(): boolean;
  /** The fishing: the bite's phase and its fish, the line's strain and length, whether the fish darts, the bar, and the bucket. */
  fishing(): FishingState;
  /**
   * The lake played to a moment of the fishing, as a careful angler would: a cast to the middle and the bite; a fight
   * under way with the fish in the zone and the meter past half; or a fish landed and waiting by the rod. For the pictures, which want each moment
   * the same every run; says whether it got there.
   */
  fishTo(moment: 'bite' | 'fight' | 'landed'): boolean;
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
  time(name: string): Promise<void>;
  /**
   * The camera put at the view of that name (shore, boat, overhead or phone), look mode unless the page's mode put it
   * there. Without a name, says which view the camera was last put at.
   */
  view(): string;
  view(name: string): Promise<void>;
  /**
   * The clock put at a point of the day, from midnight (0) round to midnight again (1, which is nought), without
   * lighting the page: the look follows at the next step, as it does when the clock gets there by itself.
   */
  clock(at: number): void;
  /** How many of the four looks' environments are baked: all four once the first frame is up, so a step in play bakes none. */
  looksBaked(): number;
  /** The contamination the water was last drawn at, which follows the game's at once when a fish is cured; null before the first. */
  drawnDirt(): number | null;
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
  settings(): Settings;
  /** The phone's reading, and the overlay opened (on a fixed room for tests). */
  phone(): PhoneReading;
  pair(fixed?: { room: string; key: string; origin?: string }): Promise<void>;
  /** The caustics or the paint changed, resolving once the change is ready to draw. */
  setSettings(next: Partial<Settings>): Promise<void>;
  /** The lake made as dirty as that, the water drawn so. */
  setDirt(contamination: number): Promise<void>;
  drawnDirt(): number | null;
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
      timeOfDay: game.timeOfDay,
    }),
    fish() {
      const { fish } = game;
      return Array.from({ length: fish.count }, (_, i) => ({ x: fish.x[i], y: fish.y[i], depth: fish.depth[i] }));
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
    fishing: () => ({
      phase: game.bite.phase,
      fish: game.bite.fish,
      tension: game.line.tension,
      out: game.line.out,
      pulling: game.line.pulling,
      reeling: game.reeling,
      bucket: game.bucket,
      weight: game.catchWeight,
      zone: game.line.zone,
      width: FIGHT.width,
      fishAt: game.line.fishAt,
      meter: game.line.meter,
    }),
    fishTo(moment) {
      // each frame as the page's own step does it, the lake on and drawn, so what follows in the picture is the same
      const frame = () => {
        host.simulate(1 / 60);
        host.draw(1 / 60);
      };
      game.cast(Math.PI / 2 + 0.15, 0.55);
      for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) frame();
      if (moment === 'bite') return game.bite.phase === 'biting';
      game.strike();
      for (let f = 0; f < 7200 && game.bite.phase === 'hooked'; f++) {
        const { line } = game;
        // a fight is pictured a few seconds in, the fish in the zone and the meter past half
        if (moment === 'fight' && f > 300 && line.inZone() && line.meter > 0.5) break;
        game.reel(careful(line.zone, line.zoneSpeed, line.fishAt));
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
    time: ((name?: string) => (name === undefined ? host.time() : host.setTime(name))) as GameApi['time'],
    view: ((name?: string) => (name === undefined ? host.view() : host.setView(name))) as GameApi['view'],
    caustics: (on) => host.setSettings({ caustics: on }),
    paint: (value) => host.setSettings({ paint: value }),
    mode: ((to?: Mode) => (to === undefined ? host.mode() : host.setMode(to))) as GameApi['mode'],

    phone: () => host.phone(),
    pair: (fixed) => host.pair(fixed),

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
  };
}
