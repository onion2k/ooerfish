/**
 * `window.game`: the game, for tests and for poking at from the console.
 * Everything a test needs to set a scene, play it exactly and read back
 * what happened, so no test waits on a clock or reaches into the game's
 * insides.
 *
 * Time is the test's to keep: `pause` stops the game where it is, and
 * `step` plays it on a frame at a time, exactly, drawing the last. `seed`
 * makes chance repeat. Anything that changes the game goes through here,
 * and `state`, `fish`, `settings` and `invariants` read it back. The lab's
 * four controls are here too, doing what the panel's do: `water`, `dirt`,
 * `time` and `view` each resolve once the frame they change is ready to draw.
 *
 * The types are shared with the smoke tests, so a test that calls something
 * that is not here does not compile.
 */
import type { Game } from './game';
import { flight } from './cast';
import { checkInvariants } from './invariants';
import { seeded } from './random';
import type { Settings } from './settings';

declare global {
  interface Window {
    game?: GameApi;
  }
}

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
  /** The lab's settings as they stand, as the address has them. */
  settings(): Settings;
  /** The names of the ways the water can be drawn. */
  styles(): string[];
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
  /** Where the cast being aimed will land, and whether on the water; null when none is aimed. */
  preview(): { x: number; y: number; z: number; onWater: boolean } | null;
  /** A pebble dropped on the water at (x, y); says whether it landed, which off the water it does not. */
  drop(x: number, y: number): boolean;
  /** A pebble dropped somewhere near what the camera looks at, as the panel's button does. */
  dropNear(): boolean;

  /** The water drawn the way of that name, as its button on the panel does. */
  water(name: string): Promise<void>;
  /** The lake made as dirty as that, from clear (0) to sick (1), as the slider does. */
  dirt(contamination: number): Promise<void>;
  /** The time of day of that name: night, dawn, day or dusk. */
  time(name: string): Promise<void>;
  /** The camera put at the view of that name: shore, boat, overhead or phone. */
  view(name: string): Promise<void>;
  /** See-through water's caustics, on or off. */
  caustics(on: 'on' | 'off'): Promise<void>;

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
  /** The point the camera looks at, where the panel's button drops near. */
  target(): [number, number];
  events: string[];
  measureFrame(warm?: number): Promise<number>;
  settings(): Settings;
  /** The settings changed as the panel would change them, resolving once the change is ready to draw. */
  change(next: Partial<Settings>): Promise<void>;
  styles(): string[];
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
    styles: () => host.styles(),
    invariants: () => checkInvariants(game),
    save() {
      game.persist();
      return JSON.stringify(game.progress.save);
    },

    cast: (angle, power) => game.cast(angle, power),
    aim: (to) => host.setAim(to),
    reelIn: () => game.reelIn(),
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
    water: (name) => host.change({ water: name }),
    dirt: (contamination) => host.change({ dirt: contamination }),
    time: (name) => host.change({ time: name as Settings['time'] }),
    view: (name) => host.change({ view: name as Settings['view'] }),
    caustics: (on) => host.change({ caustics: on }),

    look: (x, y, view = {}) => host.look(x, y, view),
    camera: () => host.camera(),
    project: (x, y, z) => host.project(x, y, z),
    measureFrame: (warm) => host.measureFrame(warm),
  };
}
