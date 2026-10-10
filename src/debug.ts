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
  /** Play `frames` frames of 1/60 s exactly, and draw the last. */
  step(frames?: number): void;
  /** Chance from a seed from now on. */
  seed(n: number): void;

  state(): GameState;
  fish(): Fish[];
  /** The lab's settings as they stand, as the address has them. */
  settings(): Settings;
  /** The names of the ways the water can be drawn. */
  styles(): string[];
  /** The rules that must always hold, broken; empty when all is well. */
  invariants(): string[];
  /** The save written now, and what it is. */
  save(): string;

  /** The water drawn the way of that name, as its button on the panel does. */
  water(name: string): Promise<void>;
  /** The lake made as dirty as that, from clear (0) to sick (1), as the slider does. */
  dirt(contamination: number): Promise<void>;
  /** The time of day of that name: night, dawn, day or dusk. */
  time(name: string): Promise<void>;
  /** The camera put at the view of that name: shore, boat, overhead or phone. */
  view(name: string): Promise<void>;

  /** The camera looking at a point, from `azimuth` round and `polar` down, `radius` away, at once. */
  look(x: number, y: number, view?: { azimuth?: number; polar?: number; radius?: number }): void;
  /** Where the camera is, and what it is looking at. */
  camera(): { position: number[]; target: number[] };
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
      for (let f = 0; f < frames; f++) host.simulate(1 / 60);
      host.draw(1 / 60);
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
    settings: () => host.settings(),
    styles: () => host.styles(),
    invariants: () => checkInvariants(game),
    save() {
      game.persist();
      return JSON.stringify(game.progress.save);
    },

    water: (name) => host.change({ water: name }),
    dirt: (contamination) => host.change({ dirt: contamination }),
    time: (name) => host.change({ time: name as Settings['time'] }),
    view: (name) => host.change({ view: name as Settings['view'] }),

    look: (x, y, view = {}) => host.look(x, y, view),
    camera: () => host.camera(),
    measureFrame: (warm) => host.measureFrame(warm),
  };
}
