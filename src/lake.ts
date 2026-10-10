/**
 * The lake as content: the shape of its shore, the depth of its bed, the rise
 * of its banks, how many fish swim in it and where the camera may stand.
 * Fixed numbers and the sums on them, so the game, the scene and the tests
 * all ask the same lake the same questions, and nothing here knows of them.
 *
 * The lake lies round the world's origin with its surface at nought, and the
 * world's z is up. A lake's shape is not from chance: the same lake is the
 * same every run whatever the seed, so a picture of it holds.
 */

/** The shore's mean distance from the middle, in world units: a pond a player can cast across in a few throws. */
export const SHORE_RADIUS = 30;
/** How far the pond is drawn out east and west, against north and south, so it is not a circle. */
export const STRETCH = 1.35;
/** The deepest the bed goes, in the middle. */
export const MAX_DEPTH = 6;
/** How high the banks rise, at the most, and how far out from the shore they take to. */
export const BANK_TOP = 2.2;
export const BANK_RISE = 18;
/** How many points the shore is drawn with. */
export const SHORE_POINTS = 128;

/** The shore's wobbles: how much, how many round, and where each begins, so the pond has a cove and a point. */
const WOBBLES: readonly [amount: number, turns: number, phase: number][] = [
  [0.12, 2, 0.6],
  [0.08, 3, 2.1],
  [0.05, 5, 4.0],
];

/** How far the shore is from the middle, in the stretched frame, at an angle round from east. */
export function shoreRadius(angle: number): number {
  let r = 1;
  for (const [amount, turns, phase] of WOBBLES) r += amount * Math.cos(turns * angle - phase);
  return SHORE_RADIUS * r;
}

/** A point in the frame where the shore is a wobbled circle, and how far round it is. */
function polar(x: number, y: number): { distance: number; angle: number } {
  const sx = x / STRETCH;
  return { distance: Math.hypot(sx, y), angle: Math.atan2(y, sx) };
}

/** How far a point is in from the shore, as a share of the way to the middle: one in the middle, nought at the shore, below nought on land. */
export function inward(x: number, y: number): number {
  const { distance, angle } = polar(x, y);
  return 1 - distance / shoreRadius(angle);
}

/** Whether a point is inside the shore, at least `margin` world units in from it, whatever stands in the water there. */
export function inShore(x: number, y: number, margin = 0): boolean {
  const { distance, angle } = polar(x, y);
  return distance < shoreRadius(angle) - margin;
}

/**
 * The boulders standing in the lake, out of the water: where each is, how far its waterline is from its middle, and
 * how high its top stands over the water. Each is a dome rising off the bed, widest where it meets it, so under the
 * water its flank shallows the bed round it and the water shows its foot. They are bank in the water: no fish swims
 * into one, a cast landing on one lies there as on the bank, and the foam rings each. Kept off the casts the tests and
 * the pictures make, so those land on the water as they did.
 */
export const BOULDERS: readonly { x: number; y: number; radius: number; rise: number }[] = [
  // half out of the water at the shore's edge, on the near side the Shore view looks over
  { x: -13, y: -25.6, radius: 1.8, rise: 1 },
  // in the shallows to the east
  { x: 16, y: -12, radius: 1.6, rise: 1.2 },
  // a pair by the north cove
  { x: 14, y: 20, radius: 1.4, rise: 0.9 },
  { x: 16.6, y: 21.8, radius: 0.9, rise: 0.6 },
];

/** The bowl's depth under a point, as though nothing stood in it. */
function bowlDepth(x: number, y: number): number {
  const k = inward(x, y);
  if (k <= 0) return 0;
  // a bowl with a gentle shelf at the edge, so the shallows are wide enough to see
  return MAX_DEPTH * (1 - (1 - k) * (1 - k)) * Math.min(1, k * 4);
}

/** How far a boulder's dome goes into the bed under its middle, so its flank stands out of the bed all round on a slope. */
const BOULDER_SUNK = 1;

/**
 * Each boulder's dome, worked out once: the height of its middle (sunk into the bed under it), how high it stands from
 * there and how wide it is at its foot, so its waterline is its radius. The scene draws each as a ball so stretched.
 */
export const BOULDER_DOMES = BOULDERS.map((b) => {
  const under = bowlDepth(b.x, b.y) + BOULDER_SUNK;
  const tall = b.rise + under;
  return { x: b.x, y: b.y, base: -under, tall, wide: b.radius / Math.sqrt(1 - (under / tall) ** 2) };
});

/** How high the boulders stand at a point, the highest of them; minus infinity where none is. */
function boulderTop(x: number, y: number): number {
  let top = -Infinity;
  for (const d of BOULDER_DOMES) {
    const dx = x - d.x,
      dy = y - d.y;
    const k = Math.sqrt(dx * dx + dy * dy) / d.wide;
    if (k < 1) top = Math.max(top, d.base + d.tall * Math.sqrt(1 - k * k));
  }
  return top;
}

/** How far a point is from the nearest boulder's waterline: below nought inside one. */
export function boulderGap(x: number, y: number): number {
  let gap = Infinity;
  // asked by every fish several times a step, so the root is taken once, of the nearest by its square
  for (const b of BOULDERS) {
    const dx = x - b.x,
      dy = y - b.y;
    gap = Math.min(gap, Math.sqrt(dx * dx + dy * dy) - b.radius);
  }
  return gap;
}

/** Which boulder is nearest a point, by its waterline. */
export function nearestBoulder(x: number, y: number): (typeof BOULDERS)[number] {
  let best = BOULDERS[0],
    gap = Infinity;
  for (const b of BOULDERS) {
    const g = Math.hypot(x - b.x, y - b.y) - b.radius;
    if (g < gap) [best, gap] = [b, g];
  }
  return best;
}

/** Whether a point is in the water, at least `margin` world units in from the shore and from every boulder. */
export function inside(x: number, y: number, margin = 0): boolean {
  return inShore(x, y, margin) && boulderGap(x, y) > margin;
}

/** How deep the bed is under a point: the most in the middle, easing to nothing at the shore, shallower over a boulder's flank, nought on land. */
export function bedDepth(x: number, y: number): number {
  return Math.max(0, Math.min(bowlDepth(x, y), -boulderTop(x, y)));
}

/** How high the ground is at a point, boulders and all: the bed under the water, the bank and the boulders out of it. */
export function ground(x: number, y: number): number {
  return inward(x, y) > 0 ? Math.max(-bowlDepth(x, y), boulderTop(x, y)) : groundUnder(x, y);
}

/**
 * How high the ground is at a point without the boulders on it: the bed under the water, the bank rising out of it,
 * one surface with no step. The bed and the banks are drawn as a sheet from this, and the boulders on it as their own.
 */
export function groundUnder(x: number, y: number): number {
  const k = inward(x, y);
  if (k > 0) return -bowlDepth(x, y);
  // out of the water, the bank rises from nought at the shore to its top, easing in and out
  const { distance, angle } = polar(x, y);
  const out = Math.min(1, (distance - shoreRadius(angle)) / BANK_RISE);
  return BANK_TOP * out * out * (3 - 2 * out);
}

/** How many fish swim in the lab's lake, and the most a lake may ever hold, which fixes the pools. */
export const FISH_COUNT = 6;
export const FISH_CAPACITY = 32;
/** How near the shore a fish will swim, and how near the surface and the bed. */
export const FISH_SHORE = 4;
export const FISH_SHALLOWEST = 0.4;
export const FISH_ABOVE_BED = 0.4;

export interface View {
  /** What the camera looks at. */
  x: number;
  y: number;
  /** How far round from east, how far down from straight overhead, and how far away. */
  azimuth: number;
  polar: number;
  radius: number;
}

/**
 * Where the camera may stand: on the south bank at a player's eye, out in the
 * boat, high over the middle, and the shore again framed for a phone held
 * upright, which needs to stand further back to see across.
 */
export const VIEWS: Record<'shore' | 'boat' | 'overhead' | 'phone', View> = {
  shore: { x: 0, y: 4, azimuth: -1.57, polar: 1.3, radius: 62 },
  boat: { x: 8, y: 6, azimuth: -0.9, polar: 1.42, radius: 18 },
  overhead: { x: 0, y: 0, azimuth: -1.57, polar: 0.35, radius: 110 },
  phone: { x: 0, y: 6, azimuth: -1.57, polar: 1.2, radius: 105 },
};

export type ViewName = keyof typeof VIEWS;

/**
 * How many splashes may be live on a lake at once, which fixes the pool and what is drawn of it; how long one
 * lasts, in seconds; and how far from the point asked a pebble dropped somewhere may land.
 */
export const SPLASH_CAPACITY = 12;
export const SPLASH_LASTS = 2.2;
export const DROP_NEAR = 8;

/**
 * Where the angler stands, in the middle of the south bank: the player is the angler, and is not drawn, so the cast
 * comes from the middle of the Shore view; how high the rod's tip is held over the ground there, and how far out in
 * front of them, toward the water.
 */
export const ANGLER = { x: 0, y: -33.5, tipHeight: 8, tipReach: 4 } as const;

/**
 * A cast: how far it reaches at full power, over the water, in world units; how steeply it is thrown; how fast the
 * lure sinks, in units a second; how far below the bobber the line lets it go; and how far over the bed it stops.
 * First guesses, to be tuned by playing.
 */
export const CAST = { reach: 45, launch: (28 * Math.PI) / 180, sink: 1.2, lineDepth: 5, aboveBed: 0.3 } as const;
