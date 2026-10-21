/**
 * A lake as the game asks it (`docs/lakes.md`): everything that is one lake's and not the game's. Its shape (the shore,
 * the bed, the banks, the boulders), its dressing (a cliff with falls, a jetty and a cabin, or none of them, and the
 * counts and seeds the scenery is placed from), its fishing (how many fish, of what kinds, where the angler stands),
 * what lies on its bed, where the camera may stand, and how its cure is counted. The rules that hold in every lake stay
 * in `src/lake.ts`. A lake is plain data and sums on it, made once; a builder takes the lake it builds from as an
 * argument and does not import one, so a second lake moves nothing of the first.
 *
 * The lake lies round the world's origin with its surface at nought, and the world's z is up. Its shape is not from
 * chance: the same lake is the same every run whatever the seed, so a picture of it holds.
 */
import type { BedSpec } from '../bedfinds';

/** Where the camera stands and what it looks at. */
export interface View {
  /** What the camera looks at. */
  x: number;
  y: number;
  /** How high the target is, nought unless said: a room is looked at from a person's height, not from the ground. */
  z?: number;
  /** How far round from east, how far down from straight overhead, and how far away. */
  azimuth: number;
  polar: number;
  radius: number;
  /** The lens's vertical angle in degrees, the page's own unless said: a room has no further back to stand, so it opens wider. */
  fov?: number;
}

/** The views a lake names: the shore, the boat, over the middle, a phone's framing, and the cabin's two (the home's). */
export type ViewName = 'shore' | 'boat' | 'overhead' | 'phone' | 'cabin' | 'cabinTall';

/** A boulder standing in the lake: where it is, how far its waterline is from its middle, and how high it stands over the water. */
export interface Boulder {
  x: number;
  y: number;
  radius: number;
  rise: number;
}

/** A boulder's dome worked out once: the height of its middle, how high it stands from there, and how wide it is at its foot. */
export interface Dome {
  x: number;
  y: number;
  base: number;
  tall: number;
  wide: number;
}

/** How the rocks are cut (`rocks.ts`): the rings and segments of each ball, how far a point is pushed in, where a lump is cut off, and how far apart two ridgelines stay. */
export interface RockFigures {
  rings: number;
  segments: number;
  give: number;
  floor: number;
  spacing: number;
}

/** The bed's colour by its depth: where the sand ends, how far it blends, how many sheets, and how far the beach reaches past the shore. */
export interface BedShallows {
  depth: number;
  blend: number;
  bands: number;
  beach: number;
}

/** A point on a ring round the lake in its stretched frame, and the unit directions there in toward the middle and along the shore. */
export interface Frame {
  x: number;
  y: number;
  inward: [number, number];
  along: [number, number];
}

/** A notch in the crest: where its line meets the shore, the unit directions in toward the lake and along the shore, and its width. */
export interface Notch {
  angle: number;
  width: number;
  x: number;
  y: number;
  inward: readonly [number, number];
  along: readonly [number, number];
}

/** The rock wall behind a bank, as content (see the Duck Pond's). */
export interface CliffSpec {
  middle: number;
  half: number;
  edge: number;
  foot: number;
  top: number;
  height: number;
  dip: number;
  notchBack: readonly [number, number];
  notches: readonly { angle: number; width: number }[];
  rockSlope: number;
  seed: number;
  lumps: Record<
    'crest' | 'foot' | 'face',
    { count: number; k: number; spread: number; size: readonly [number, number] }
  >;
}

/** The jetty as content: where it starts, how long and wide it is, how high it stands, and its posts. */
export interface JettySpec {
  angle: number;
  k: number;
  length: number;
  width: number;
  top: number;
  thick: number;
  posts: { along: readonly number[]; side: number; size: number };
}

/** The cabin as content: where it stands, its body, roof, chimney, door and window, and how far the scenery keeps back. */
export interface CabinSpec {
  angle: number;
  k: number;
  body: { along: number; across: number; high: number };
  roof: { pitch: number; overhang: number; thick: number };
  chimney: { size: number; high: number; from: number; along: number };
  door: { width: number; high: number };
  window: { width: number; high: number; along: number; sill: number };
  clear: number;
}

/** The room inside the cabin, as content: its walls, bed, window, door, lamp, eye and the furniture (see the Duck Pond's). */
export interface CabinRoom {
  inset: number;
  high: number;
  slab: number;
  bed: { width: number; length: number; legs: number; base: number; mattress: number; headboard: number };
  window: { along: number; width: number; high: number; sill: number; frame: number };
  door: { along: number; width: number; high: number; frame: number };
  lamp: {
    along: number;
    across: number;
    drop: number;
    colour: [number, number, number];
    radius: number;
    intensity: number;
  };
  eye: number;
  furniture: {
    table: { across: number; along: number; deep: number; wide: number; high: number; top: number; leg: number };
    chair: { across: number; along: number; size: number; seat: number; back: number; leg: number };
    mug: { across: number; along: number; radius: number; high: number };
    stove: {
      across: number;
      along: number;
      wide: number;
      deep: number;
      high: number;
      legs: number;
      pipe: number;
      run: number;
      to: { across: number; along: number };
    };
    shelf: { along: number; wide: number; deep: number; high: number; thick: number };
    shelfUpper: { along: number; wide: number; deep: number; high: number; thick: number };
    books: readonly (readonly [number, number])[];
    jar: { radius: number; high: number };
    rug: { across: number; along: number; wide: number; long: number; thick: number; border: number };
    chest: { across: number; along: number; wide: number; long: number; high: number; lid: number };
    picture: { along: number; wide: number; high: number; at: number; frame: number };
    coat: { along: number; peg: number; wide: number; long: number };
    calendar: {
      across: number;
      wide: number;
      at: number;
      bar: number;
      margin: number;
      mark: number;
      depth: number;
      proud: number;
    };
  };
}

/** Where a sleeper's eyes are in the cabin's frame. */
export interface WakingEye {
  along: number;
  across: number;
  high: number;
}

/** What the content says of one junk treasure: see the Duck Pond's `treasures`. */
export interface TreasureSpec {
  id: string;
  /** What it is called on the card and in the journal, lower case, "a" put before it. */
  name: string;
  /** The line the card says of it, a placeholder until the story's words are decided. */
  line: string;
  /** What it weighs, in kilograms, for the card. */
  weight: number;
  /** How big its model is, at a scale of one: the radius it fits in and how tall it stands, in world units. */
  size: { radius: number; high: number };
  /** Where it stands in the cabin: on the lower or the upper shelf, `along` the shore from the room's middle. */
  shelf: { on: 'lower' | 'upper'; along: number };
  /** What a message in it says, if it holds one. */
  note?: string;
}

/** The content half of the drums of waste: what is placed on the bed (`BedSpec`), and what a drum is. */
export interface DrumContent extends BedSpec {
  /** What one weighs, in kilograms, for the card. */
  weight: number;
  radius: number;
  height: number;
  /** Where a hauled drum stands on the bank, in the cabin's frame (`across` toward the lake, `along` the shore). */
  bank: readonly { across: number; along: number }[];
}

/** The content half of the junk treasures: what is placed on the bed (`BedSpec`), how big the models are drawn, and the list. */
export interface TreasureContent extends BedSpec {
  bedScale: number;
  shelfScale: number;
  list: readonly TreasureSpec[];
}

/** The banks, the woodland and the clumps: counts, scales and kinds of what dresses the banks. */
export interface Dressing {
  trees: Record<'broadleaf' | 'conifer', readonly [number, number]>;
  woodland: { count: number; band: readonly [number, number]; southBand: readonly [number, number] };
  pebbles: { scale: readonly [number, number]; sunk: number };
  clumps: {
    count: number;
    reach: number;
    clear: number;
    kinds: Record<string, { weight: number; scale: readonly [number, number] }>;
  };
}

/** What the scenery is placed from: the dressing, the seeds and counts it is drawn by, and the banks' rings. */
export interface Scenery extends Dressing {
  seeds: {
    /** The stones and the old hand-made trees are placed from this one. */
    scene: number;
    /** The kit's dressing is drawn from a constant of its own, independent of the stream above and of the game. */
    dressing: number;
    grass: number;
    boulder: number;
    lump: number;
  };
  /** How many stones line the shore, trees stand on the banks, rocks lie on the bed, and clumps of weed (of how many blades) grow from it. */
  counts: { stones: number; trees: number; rocks: number; clumps: number; blades: number };
  /** The banks' rings as stops of (from, to, how many rings), and how far out the banks are drawn, in shore radii. */
  banks: { stops: readonly (readonly [number, number, number])[]; to: number };
}

/** The sun's shadow is fitted to this box of the lake and the banks round it. */
export interface ShadowBox {
  min: [number, number, number];
  max: [number, number, number];
}

/** The cliff, its notches and the speed of each fall; a lake with none has `cliff: null`. */
export interface Cliff {
  spec: CliffSpec;
  notches: readonly Notch[];
  /** How fast each fall runs, in world units a second, by notch. */
  fallSpeeds: readonly number[];
  /** How much a point is in a notch's channel: one across the notch's width, easing to nought a little past it. */
  channel: (x: number, y: number) => number;
  /** How much higher the cliff makes the ground at a point than the bank alone would be. */
  rise: (x: number, y: number) => number;
}

/**
 * A straight dam along a bank, as content: a wall whose water-side face stands on the line `faceY` (the shore there is
 * that line, so the water ends at the wall) from `half` either side of the middle, its ends stepping down into the
 * banks over `ends`. The ground behind it starts to climb `setBack` behind the face (past the last sheet that is drawn outside the wall, so no slope of a sheet shows in front of it) and climbs over `batter`; the crest, the walkway, is `crest` deep at `top` over the water;
 * behind it the ground holds the crest's height for `hold` more and then falls away over `fall` to the bank. The wall is
 * built in bays `bay` wide, with a rib standing `proud` from the face every `ribEvery` bays, a parapet on the water side
 * of the walkway and a hut on it at `hut`.
 */
export interface DamSpec {
  faceY: number;
  half: number;
  ends: number;
  top: number;
  crest: number;
  setBack: number;
  batter: number;
  hold: number;
  fall: number;
  bay: number;
  footing: number;
  ribEvery: number;
  rib: { wide: number; proud: number };
  parapet: { high: number; thick: number };
  hut: { x: number; wide: number; high: number };
}

/** The dam and the ground it makes; a lake with none has `dam: null` (or no `dam`). */
export interface Dam {
  spec: DamSpec;
  /** How much higher the dam makes the ground at a point than the bank alone would be: nought before its face. */
  rise: (x: number, y: number) => number;
  /** How much of the dam's height stands at an x along it: one along its length, easing to nought past its ends. */
  height: (x: number) => number;
}

/** The jetty and its deck; a lake with none has `jetty: null`. */
export interface Jetty {
  spec: JettySpec;
  /** Where the deck starts, and the unit directions in toward the lake's middle and along the shore. */
  deck: Frame;
  /** The circle that holds the whole deck. */
  round: { x: number; y: number; radius: number };
  /** How far past the deck's circle `gap` takes the trouble to be exact. */
  near: number;
  /** A point in the deck's own frame: how far in along it from its start, and how far across from its middle line. */
  frame: (x: number, y: number) => [along: number, across: number];
  /** How far a point is from the deck's edge in plan: below nought inside it. */
  gap: (x: number, y: number) => number;
  /** The point on the deck nearest a point, in plan. */
  nearestOnDeck: (x: number, y: number) => [number, number];
}

/** The cabin, its room and where a sleeper wakes; a lake with none has `cabin: null`. */
export interface Cabin {
  spec: CabinSpec;
  /** The cabin's middle on the bank, and the unit directions in toward the lake and along the shore. */
  at: Frame;
  /** How far a point is from the edge of the cabin's roof in plan: below nought under it. */
  gap: (x: number, y: number) => number;
  room: CabinRoom;
  /** How high the room's floor is. */
  floor: number;
  wakingEye: WakingEye;
}

/** A lake. */
export interface Lake {
  /** What the save calls it. */
  id: string;
  /** What it is called, on the glow gauge and in what is said when it is clean. */
  name: string;

  // The figures of its shape.
  /** The shore's mean distance from the middle, in world units (also the radius the falling things are spread over). */
  radius: number;
  /** How far it is drawn out east and west, against north and south. */
  stretch: number;
  /** The deepest the bed goes, in the middle. */
  maxDepth: number;
  /** How high the banks rise, at the most, and how far out from the shore they take to. */
  bankTop: number;
  bankRise: number;
  /** How many points the shore is drawn with. */
  shorePoints: number;
  /** The bed's colour by its depth. */
  bedShallows: BedShallows;
  /** The water's level in the world. */
  level: number;

  // Its geometry.
  /** How far the shore is from the middle, in the stretched frame, at an angle round from east. */
  shoreRadius: (angle: number) => number;
  /** How far a point is in from the shore, as a share of the way to the middle: one in the middle, nought at the shore, below nought on land. */
  inward: (x: number, y: number) => number;
  /** Whether a point is inside the shore, at least `margin` units in from it, whatever stands in the water there. */
  inShore: (x: number, y: number, margin?: number) => boolean;
  /** Whether a point is in the water, at least `margin` units in from the shore and from everything that stands in it. */
  inside: (x: number, y: number, margin?: number) => boolean;
  /** How deep the bed is under a point. */
  bedDepth: (x: number, y: number) => number;
  /** How deep the bowl is at a share of the way out from the middle to the shore, the same all round. */
  bowlDepthAt: (out: number) => number;
  /** How high the ground is at a point, boulders and the jetty's planks and all: what a cast lands on. */
  ground: (x: number, y: number) => number;
  /** How high the ground is with no deck laid on it. */
  bareGround: (x: number, y: number) => number;
  /** How high the ground is without the boulders on it. */
  groundUnder: (x: number, y: number) => number;
  /** Whether a point is on a fall's line, where no grass grows and nothing stands. */
  onFall: (x: number, y: number) => boolean;
  /** Whether the ground at a point leans past the rock slope: the cliff's face. */
  onFace: (x: number, y: number) => boolean;
  /** Whether a point is where the cabin and the jetty's shore end stand, or within the keep-back of them. */
  onCabinOrDeck: (x: number, y: number) => boolean;

  // Its boulders.
  boulders: readonly Boulder[];
  domes: readonly Dome[];
  rocks: RockFigures;
  /** How far a point is from the nearest boulder's waterline: below nought inside one. */
  boulderGap: (x: number, y: number) => number;
  /** Which boulder is nearest a point, by its waterline. */
  nearestBoulder: (x: number, y: number) => Boulder;

  // Its dressing: a lake with none of a thing has null.
  cliff: Cliff | null;
  jetty: Jetty | null;
  cabin: Cabin | null;
  /** A straight dam in place of a cliff (`src/dam.ts` draws it as a painted solid); optional, so a lake without one need not say so. */
  dam?: Dam | null;
  scenery: Scenery;
  shadowBox: ShadowBox;

  // Its fishing.
  /** How many fish swim in it. */
  fishCount: number;
  /** The kind of each slot, by index into `KINDS`; a slot past the list takes the kind of its place round again. */
  fishKinds: readonly number[];
  /** How far out from the middle, east-west and north-south, a fish may be placed. */
  extent: readonly [number, number];
  /** How near the shore a fish will swim, and how near the surface and the bed. */
  fishShore: number;
  fishShallowest: number;
  fishAboveBed: number;
  /** Where the angler stands, how high the rod's tip is held, and how far out in front. */
  angler: { x: number; y: number; tipHeight: number; tipReach: number };
  /** Where the angler stands, as the places on the bed are measured from. */
  from: readonly [number, number];
  /** Where in the shallows below the angler a fish is landed. */
  landAt: readonly [number, number];
  /** How far a cast reaches at full power, over the water. */
  castReach: number;
  /** The cast the pace angler aims. */
  aim: { angle: number; power: number; spread: number; powerSpread: number };
  /** The water's pace, against the game's clock. */
  waterPace: number;

  // What lies on its bed.
  drums: DrumContent;
  treasures: TreasureContent;

  // Where the camera may stand, and the water's surface.
  views: Record<ViewName, View>;
  surface: { rings: number; segments: number; spacing: number; near: number };

  // Its cure, from its own counts.
  /** How many fish put in the bucket it takes to clean the lake. */
  toClean: number;
  /** The cleaning the whole lake asks, in fish's worth. */
  total: number;
  /** How sick the lake is once `cured` fish have been cured and `drums` drums hauled. */
  contaminationAfter: (cured: number, drums: number) => number;
}
