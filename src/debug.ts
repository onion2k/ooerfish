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
import { moonLight, moonName, moonOf, nextFull, nextNew, seasonOf } from './calendar';
import { CLOCK, KINDS, type Season, type Weather } from './lake';
import { LAKES } from './lakes';
import { logbookWords, type LogbookWords } from './town/logbook';
import type { Photo } from './photo';
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
export type Quarry =
  | 'drum'
  | 'bream'
  | 'perch'
  | 'pike'
  | 'dawnfish'
  | 'eel'
  | 'trout'
  | 'lure'
  | 'plush'
  | 'lunchbox'
  | 'badge'
  | 'bottle'
  | 'duck'
  | 'page1'
  | 'page2'
  | 'page3'
  | 'page4'
  | 'page5'
  | 'page6';

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
  /** Where it stands on its shelf once found: x, y and z in the world; null for a logbook page, which is kept in the book. */
  shelf: [number, number, number] | null;
}

/** A fish, where it is. */
export interface FishingState {
  phase: string;
  fish: number;
  /** The drum snagged, hooked or landed, or minus one. */
  drum: number;
  /** The junk treasure snagged, hooked or landed, or minus one. */
  treasure: number;
  /** A two-headed fish's second window, or the nibble before it. */
  second: boolean;
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
  /** Whether the frost at a clean lake's edge is on the bank (winter, and every drum hauled and fish cured). */
  frost: boolean;
  /** The snow caps appended to the static set at the last dress: one a rock in winter, none in another season. */
  caps: number;
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
  /** The lake being played: the id the save calls it and the name the page shows. */
  lake(): { id: string; name: string };
  /** The id of every lake the game has, in the order it names them. */
  lakes(): string[];
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
  /** The album as saved, a copy: each photograph's lake, day, time, weather, view, kinds in frame and whether it was lit. */
  photos(): Photo[];
  /** The contests' tally as saved, a copy: the fish stowed in rain, the run of casts landed with none wasted, and the longest run. */
  tally(): { rain: number; run: number; best: number };
  /** The photograph at this place in the album thrown away, as Discard does; false, and nothing changed, for a place with none. */
  discard(index: number): boolean;
  /** The journal's logbook section as the page shows it: the six pages in order over every lake, their words once found, and the count. */
  logbook(): LogbookWords;
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
  /** The season's share of the fish's glow when they were last handed to the renderer (1 in summer, winter's brighter). */
  drawnGlow(): number;
  /** The lamp eels' lights as last handed to the renderer: whether any is lit, and how many (night, at the pond, on the full rung). */
  eels(): { lit: boolean; count: number };
  /** The wall calendar's marks as last handed to the renderer: the squares gone, today's square (-1 before the first), and how many times they have been handed over since boot, which is once a day's change. */
  calendar(): { gone: number; today: number; handovers: number };
  /** What the cabin's radio says, as the page last wrote it: the forecast and the gossip, and whether the panel is shown (it is with the morning line, in the cabin). */
  radio(): { forecast: string; gossip: string; shown: boolean };
  /**
   * The moon on the game's day (`docs/moon.md`): its `phase` (0 full to 7), `name`, `light` (the share of the full
   * moon's the night gives), the nights to the `nextFull` and `nextNew` (one to eight), and how many times the sky's
   * discs have been handed over (`handovers`, once a change of the look's name or the phase, and the first of all) and
   * whether they are on the sky now (`shown`: the look is the night).
   */
  moon(): {
    phase: number;
    name: string;
    light: number;
    nextFull: number;
    nextNew: number;
    handovers: number;
    shown: boolean;
  };
  /**
   * The weather today (`docs/weather.md`): with no argument its `name`, the `lift` of the fish, the `wind`'s push, how many
   * times the rainbow has been `handovers`, the `fog`'s density as drawn now (nothing on the lean rung) and what
   * `falling` ('rain' where the rain's drops or snow fall, 'season' where the season's do, null where nothing does) and
   * whether the rainbow is `shown` on the sky;
   * with a name it sets the lever, a name not known refused (resolving false), and resolves true once the page has
   * dressed it and it is ready to draw. `null` gives the day's own back.
   */
  weather(): {
    name: Weather;
    lift: number;
    wind: number;
    handovers: number;
    fog: number;
    falling: 'rain' | 'season' | null;
    shown: boolean;
  };
  weather(name: string | null): Promise<boolean>;
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
   * Whether a page holds the clock: the menu's list, the journal, the post, the lakes page, the sleep page, the camera, a photograph looked at, the Start
   * again question or the pairing card is open. While one is, `step` moves nothing and no key, tap, button or phone gesture reaches the game.
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
  /**
   * Opens the post's page as the menu's Post item and a tap on the cabin's table do, resolving once it is shown, or
   * closes it again with `false`. It stops the game's step while open as every page does.
   */
  openPost(open?: boolean): Promise<void>;
  /**
   * Opens the lakes page as the menu's Lakes item, the map's tap and the morning's Somewhere else… do, resolving once it
   * is shown, or closes it again with `false`. It stops the game's step while open as every page does, and is not
   * opened away from the pond and the cabin (in a yawn or a journey's fade). A Go on it is a click on its button.
   */
  openLakes(open?: boolean): Promise<void>;
  /**
   * Opens the sleep page as the menu's Sleep through… item does, resolving once it is shown, or closes it again with
   * `false`. It stops the game's step while open as every page does, and is not opened away from the pond and the
   * cabin. A choice on it is a click on its button.
   */
  openSleep(open?: boolean): Promise<void>;
  /**
   * Opens the camera page as the menu's Camera item and the P key do, resolving once it is shown, or closes it again
   * with `false`. It holds the game as every page does while the lake draws on and a drag frames the view; it is
   * refused with a fish hooked or landed, while yawning or leaving, and with another page open.
   */
  openCamera(open?: boolean): Promise<void>;
  /** Whether the camera page is open. */
  cameraOpen(): boolean;
  /** The photograph of what the camera sees, as Take does; false, and the album unchanged, with the camera closed or the album full. */
  photograph(): boolean;
  /** A test lever: the camera put to look at the point (x, y, z), a little way off, while the camera page is open. */
  frame(x: number, y: number, z: number): void;
  /**
   * A photograph of the album looked at, as its Look button does: the camera, the clock and the weather put at its
   * own and the grain held. False, and nothing done, for a place with none, one taken at another lake or another page open.
   */
  lookAt(index: number): Promise<boolean>;
  /** Back from a photograph looked at: the camera, the clock, the weather lever, the orbit and the grain put back, and the journal opened again if it was. */
  lookAway(): Promise<void>;
  /** The still: whether the page shows one, the album place the page has, the album place the game holds (-1 for none), and the renderer's grain clock as the last frame left it. */
  still(): { shown: boolean; index: number; held: number; postClock: number };
  /**
   * The map on the cabin's wall: the id of the lake its pin was last handed over on (the lake the save names, which
   * is the home's whenever the player is in the cabin, but for the moment of a journey's fade), and how many times
   * the pin has been handed over since boot. Empty at a lake with no cabin.
   */
  map(): { pin: string; handovers: number };
  /** Where the map's paper is on the page, in CSS pixels, so a test can tap it; null at a lake with no cabin or behind the camera. */
  mapOnScreen(): { x: number; y: number } | null;
  /** Where the middle of the cabin's table top is on the page, in CSS pixels, so a test can tap it; null at a lake with no cabin. */
  tableOnScreen(): { x: number; y: number } | null;

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
  /**
   * Sleep through `nights` nights, as a choice on the sleep page does: the yawn as `sleep`'s, and the wake that many
   * days on, in the cabin at home. Says whether it began, which it does not with a fish hooked or landed, while
   * yawning or leaving, or for nights that are not a whole number from one to a round of the moon (eight).
   */
  sleepThrough(nights: number): Promise<boolean>;
  /**
   * Walk into the cabin by day, as the menu's Go to the cabin does at home: the clock held where it is, the camera at
   * the pillow in look mode. Resolves once the camera is ready, saying whether the player went in, which they do not
   * with a fish hooked or landed, while yawning or leaving, in the cabin already, or at a lake with no cabin.
   */
  enter(): Promise<boolean>;
  /** Where the cabin's middle is on the page, in CSS pixels, so a test can tap it; null at a lake with no cabin or behind the camera. */
  cabinOnScreen(): { x: number; y: number } | null;
  /** Go down to the pond from the cabin, as the button does, look mode at the Shore view and the clock running; resolves once the camera is ready, saying whether the player came out. */
  out(): Promise<boolean>;
  /**
   * Travel to the lake `id`, as choosing it does: the lure is reeled in, the save names the lake at the pond with the
   * clock as it is, and the screen fades out over `NIGHT.fadeOut` of stepped time before the page is loaded afresh
   * there. Resolves at once, saying whether the journey began; it is refused, and nothing changes, for a lake the game
   * does not know, with a fish hooked or landed, and while yawning or leaving. To the lake the player is at it goes out
   * from the cabin, as `out` does, and is nothing at the pond (true). A test waits for the reload with
   * `page.waitForEvent('load')`; on a paused page the fade is stepped to its end first.
   */
  travel(id: string): Promise<boolean>;
  /** The load's fade-in let go, so a page opens clear at the pond: what `start` in `smoke/game.ts` does unless asked to keep it. */
  arrived(): void;
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
  openPost(open: boolean): Promise<void>;
  openLakes(open: boolean): Promise<void>;
  openSleep(open: boolean): Promise<void>;
  openCamera(open: boolean): Promise<void>;
  cameraOpen(): boolean;
  photograph(): boolean;
  frameOn(x: number, y: number, z: number): void;
  lookAt(index: number): Promise<boolean>;
  lookAway(): Promise<void>;
  still(): { shown: boolean; index: number; postClock: number };
  map(): { pin: string; handovers: number };
  mapOnScreen(): { x: number; y: number } | null;
  tableOnScreen(): { x: number; y: number } | null;
  /** The caustics or the paint changed, resolving once the change is ready to draw. */
  setSettings(next: Partial<Settings>): Promise<void>;
  /** The lake made as dirty as that, the water drawn so. */
  setDirt(contamination: number): Promise<void>;
  drawnDirt(): number | null;
  waterHandovers(): number;
  drawnCured(): number;
  drawnGlow(): number;
  eels(): { lit: boolean; count: number };
  /** The wall calendar's marks as last handed to the renderer: the squares gone, today's square (-1 before the first), and how many times they have been handed over since boot, which is once a day's change. */
  calendar(): { gone: number; today: number; handovers: number };
  /** What the cabin's radio says, as the page last wrote it: the forecast and the gossip, and whether the panel is shown (it is with the morning line, in the cabin). */
  radio(): { forecast: string; gossip: string; shown: boolean };
  /** The sky's discs: how many times they were handed over, and whether they are drawn now. */
  moon(): { handovers: number; shown: boolean };
  /** The weather as the page has dressed it: the rainbow's handovers, the fog's density drawn, and what falls. */
  weather(): { handovers: number; fog: number; falling: 'rain' | 'season' | null; shown: boolean };
  /** The page dressed for the game's weather as it stands (the lever just moved), resolving once it is ready to draw. */
  showWeather(): Promise<void>;
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
  /** Into the cabin by day, the camera at the pillow. */
  enter(): Promise<boolean>;
  cabinOnScreen(): { x: number; y: number } | null;
  /** Travel to a lake: the game's journey, and the page's side of it. */
  travel(id: string): Promise<boolean>;
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
    lake: () => ({ id: game.lake.id, name: game.lake.name }),
    lakes: () => Object.keys(LAKES),
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
        bed: game.lake.bedDepth(drums.x[i], drums.y[i]),
        hauled: drums.found[i] === 1,
        // a lake with no cabin has no bank to stand a hauled drum on, and it is read as lying where it lay on the bed
        bank: game.lake.cabin
          ? (bankSpot(i, game.lake).slice(0, 3) as [number, number, number])
          : [drums.x[i], drums.y[i], -game.lake.bedDepth(drums.x[i], drums.y[i])],
      }));
    },
    treasures() {
      const { treasures } = game;
      return game.lake.treasures.list.map((t, i) => ({
        id: t.id,
        x: treasures.x[i],
        y: treasures.y[i],
        bed: game.lake.bedDepth(treasures.x[i], treasures.y[i]),
        found: treasures.found[i] === 1,
        shelf: t.shelf ? (shelfSpot(i, game.lake).slice(0, 3) as [number, number, number]) : null,
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
      kinds: JSON.parse(JSON.stringify(game.progress.entry(game.lake.id).journal)) as Journal,
      found: [...game.progress.entry(game.lake.id).found],
    }),
    photos: () => JSON.parse(JSON.stringify(game.progress.save.photos)) as Photo[],
    tally: () => ({ ...game.progress.save.tally }),
    discard: (index) => game.discard(index),
    logbook: () => logbookWords(LAKES, game.progress.save),
    gear: () => ({ ...game.gear }),
    fishing: () => ({
      phase: game.bite.phase,
      fish: game.bite.fish,
      drum: game.bite.drum,
      treasure: game.bite.treasure,
      second: game.bite.second,
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
      // the pink dawn fish is about only at dawn, so the clock is put there first, or it would never come to the lure
      if (quarry === 'dawnfish') game.setTimeOfDay(CLOCK.startsAt);
      const want = quarry === undefined || quarry === 'drum' ? -1 : KINDS.findIndex((k) => k.id === quarry);
      const treasure = game.lake.treasures.list.findIndex((t) => t.id === quarry);
      // a drum or a treasure is hauled, not played: the reel is held and the fight pictured a few seconds in
      const hauled = quarry === 'drum' || treasure >= 0;
      /**
       * Fished for where the nearest uncured fish that `wanted` lies, the lure left to sink through its water. A bite by a
       * fish that is not `wanted` is let go and the cast thrown again, since the sink is the player's choice and it
       * passes every kind's water on the way down.
       */
      const fishFor = (wanted: (i: number) => boolean): boolean => {
        const dist = (i: number) =>
          Math.hypot(game.fish.x[i] - game.lake.angler.x, game.fish.y[i] - game.lake.angler.y);
        for (let attempt = 0; attempt < 12; attempt++) {
          let near = -1;
          for (let i = 0; i < game.fish.count; i++) {
            if (!wanted(i) || game.fish.cured[i]) continue;
            if (near < 0 || dist(i) < dist(near)) near = i;
          }
          if (near < 0) return false;
          const { angle, power } = aimAt(game.fish.x[near], game.fish.y[near], game.lake, game.wind);
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
        const { angle, power } = aimAt(game.drums.x[i], game.drums.y[i], game.lake, game.wind);
        if (!game.cast(angle, power)) return false;
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) frame();
      } else if (treasure >= 0) {
        // the lure thrown to the treasure, if it is still on the bed, and left to lie there, where it is snagged
        if (game.treasures.found[treasure]) return false;
        const { angle, power } = aimAt(game.treasures.x[treasure], game.treasures.y[treasure], game.lake, game.wind);
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
      const f = flight(to.angle, to.power, game.lake, game.wind);
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
    drawnGlow: () => host.drawnGlow(),
    eels: () => host.eels(),
    calendar: () => host.calendar(),
    radio: () => host.radio(),
    moon: () => {
      const phase = moonOf(game.day);
      return {
        phase,
        name: moonName(phase),
        light: moonLight(phase),
        nextFull: nextFull(game.day),
        nextNew: nextNew(game.day),
        ...host.moon(),
      };
    },
    weather: ((name?: string | null) => {
      if (name !== undefined)
        return game.setWeather(name) ? host.showWeather().then(() => true) : Promise.resolve(false);
      return {
        name: game.weather,
        lift: game.lift,
        wind: Math.hypot(game.wind[0], game.wind[1]),
        ...host.weather(),
      };
    }) as GameApi['weather'],
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
    openPost: (open = true) => host.openPost(open),
    openLakes: (open = true) => host.openLakes(open),
    openSleep: (open = true) => host.openSleep(open),
    openCamera: (open = true) => host.openCamera(open),
    cameraOpen: () => host.cameraOpen(),
    photograph: () => host.photograph(),
    frame: (x, y, z) => host.frameOn(x, y, z),
    lookAt: (index) => host.lookAt(index),
    lookAway: () => host.lookAway(),
    still: () => ({ ...host.still(), held: game.still?.index ?? -1 }),
    map: () => host.map(),
    mapOnScreen: () => host.mapOnScreen(),
    tableOnScreen: () => host.tableOnScreen(),

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
    sleepThrough: (nights) => Promise.resolve(game.sleepThrough(nights)),
    out: () => host.out(),
    enter: () => host.enter(),
    cabinOnScreen: () => host.cabinOnScreen(),
    travel: (id) => host.travel(id),
    arrived: () => game.arrived(),
  };
}
