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
  return bowlDepthAt(1 - inward(x, y));
}

/**
 * How deep the bowl is at a share of the way out from the middle to the shore, the same all round: nought on the shore
 * and past it. The bed is coloured by its depth, and its bands are cut by radius, so the scene asks this of a radius.
 */
export function bowlDepthAt(out: number): number {
  const k = 1 - out;
  if (k <= 0) return 0;
  // a bowl with a gentle shelf at the edge, so the shallows are wide enough to see
  return MAX_DEPTH * (1 - (1 - k) * (1 - k)) * Math.min(1, k * 4);
}

/**
 * The bed's colour by its depth, as content: the sand where the water is shallower than `depth` (world units), the
 * slate where it is deeper than `depth + blend`, and mixed between. The renderer gives a group one colour, so the bed
 * is drawn in `bands` sheets cut by radius, the slate of the deep the first and the sand the last, each mixed by the
 * depth at its middle; the bands between them blend the edge that a single cut showed as a hard line from overhead.
 * `depth` is the bed's at three quarters of the way out, where the pictured sand ring began, and the sand reaches on
 * past the shore to `beach` (a share of the shore's distance), so a strip of beach shows inside the foam line.
 */
// the sand under the whole lake, as the clear water wants (docs/crystal-2.md, part 4): the blend toward the slate would
// end at 7, past the deepest 6, so the middle is a darkened sand and the slate is never reached; it was 2.625, with
// the slate under the deep half, which read as dark, opaque water even through clear water
export const BED_SHALLOWS = { depth: 5.5, blend: 1.5, bands: 6, beach: 1.04 } as const;

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

/**
 * The lake's rocks, the boulders and the cliff's lumps, as the faceted meshes the painted edge needs (`rocks.ts`).
 * `rings` and `segments` cut each ball into 64 triangles, facets broad enough that one ridge is a stroke across a few
 * of them and few enough that a boulder reads as a handful of cut planes; `give` is how far a point is pushed in at
 * random, a fifth of its radius, so no two facets lie alike and the ridges have something to choose between;
 * `floor` is a lump's bottom cut off at that share of its depth, so one sunk to its middle does not hang out of a steep
 * wall (as the cliff's lumps always did); `spacing` is how far apart two chosen ridgelines stay, a share of the rock's
 * radius, the package's own and the experiments' (a boulder's two or three lines do not crowd). First guesses, from the
 * experiments' sheet, and to be tuned by looking.
 */
export const ROCKS = { rings: 5, segments: 8, give: 0.2, floor: -0.4, spacing: 0.4 } as const;

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

/**
 * The jetty, as content: a deck of planks out from the north-east bank over the water, on posts standing from the bed.
 * It starts where the line from the lake's middle through the shore at `angle` is `k` shore radii out, and runs `length`
 * toward the lake's middle, `width` across and standing `top` over the surface. Like a boulder it is a bit of bank in
 * the water: no fish swims under it, a cast landing on it lies there on the planks, and the foam rings it. The posts,
 * `size` square, stand under the deck at these distances along it, a pair at each, `side` either side of its middle, so
 * they need nothing of their own. The bed and the water run on under it as they were.
 */
export const JETTY = {
  angle: 0.74,
  k: 1.04,
  length: 13,
  width: 2.6,
  top: 0.45,
  // the deck is this thick, under its top
  thick: 0.3,
  posts: { along: [1.5, 5, 8.5, 12] as readonly number[], side: 1.1, size: 0.4 },
} as const;

/** The ring point `k` shore radii out at an angle, in the lake's stretched frame, and the unit directions there in toward the lake's middle and along the shore. */
function ringFrame(k: number, angle: number) {
  const r = k * shoreRadius(angle);
  const x = Math.cos(angle) * r * STRETCH,
    y = Math.sin(angle) * r;
  const l = Math.hypot(x, y);
  const inward: [number, number] = [-x / l, -y / l];
  return { x, y, inward, along: [-inward[1], inward[0]] as [number, number] };
}

/** The jetty's deck worked out once: where it starts, the unit directions in toward the lake's middle and along the shore. */
export const DECK = ringFrame(JETTY.k, JETTY.angle);

/** How far a point is outside a rectangle `halfU` by `halfV` about its middle, in plan, below nought inside it. */
function boxGap(u: number, v: number, halfU: number, halfV: number): number {
  const du = Math.abs(u) - halfU,
    dv = Math.abs(v) - halfV;
  return du > 0 || dv > 0 ? Math.hypot(Math.max(du, 0), Math.max(dv, 0)) : Math.max(du, dv);
}

/** A point in the deck's own frame: how far in along it from its start, and how far across from its middle line. */
export function deckFrame(x: number, y: number): [along: number, across: number] {
  const dx = x - DECK.x,
    dy = y - DECK.y;
  return [dx * DECK.inward[0] + dy * DECK.inward[1], dx * DECK.along[0] + dy * DECK.along[1]];
}

/** The deck's middle, and how far its corners are from it: the circle that holds the whole deck. */
export const DECK_ROUND = {
  x: DECK.x + (DECK.inward[0] * JETTY.length) / 2,
  y: DECK.y + (DECK.inward[1] * JETTY.length) / 2,
  radius: Math.hypot(JETTY.length / 2, JETTY.width / 2),
};
/**
 * How far past the deck's circle `jettyGap` takes the trouble to be exact. The widest margin anything asks `inside` for
 * is the six a fish is placed in from the shore, so beyond this the answer only has to be plainly more than that.
 */
export const DECK_NEAR = 8;
const DECK_NEAR_SQUARED = (DECK_ROUND.radius + DECK_NEAR) ** 2;

/**
 * How far a point is from the deck's edge in plan: below nought inside it, as `boulderGap` is inside a boulder. Asked by
 * every fish several times a step, so a point far from the deck is answered with its distance from the deck's circle,
 * which the true gap can only exceed, and the rectangle's sums are done for those near it alone.
 */
export function jettyGap(x: number, y: number): number {
  const mx = x - DECK_ROUND.x,
    my = y - DECK_ROUND.y;
  const far = mx * mx + my * my;
  if (far > DECK_NEAR_SQUARED) return Math.sqrt(far) - DECK_ROUND.radius;
  const dx = x - DECK.x,
    dy = y - DECK.y;
  return boxGap(
    dx * DECK.inward[0] + dy * DECK.inward[1] - JETTY.length / 2,
    dx * DECK.along[0] + dy * DECK.along[1],
    JETTY.length / 2,
    JETTY.width / 2,
  );
}

/** The point on the deck nearest a point, in plan: where a fish swimming at it should be turned from. */
export function nearestOnDeck(x: number, y: number): [number, number] {
  const [u, v] = deckFrame(x, y);
  const cu = Math.min(JETTY.length, Math.max(0, u)),
    cv = Math.min(JETTY.width / 2, Math.max(-JETTY.width / 2, v));
  return [DECK.x + DECK.inward[0] * cu + DECK.along[0] * cv, DECK.y + DECK.inward[1] * cu + DECK.along[1] * cv];
}

/** Whether a point is in the water, at least `margin` world units in from the shore and from every boulder and the deck. */
export function inside(x: number, y: number, margin = 0): boolean {
  return inShore(x, y, margin) && boulderGap(x, y) > margin && jettyGap(x, y) > margin;
}

/**
 * The cabin on the bank behind the jetty, as content: it stands `k` shore radii out at the jetty's angle, its door to
 * the lake. Its body is `along` the shore by `across` toward the lake and `high`; its roof is two panels leaning at
 * `pitch` from a ridge along the shore, overhanging the walls by `overhang`; the chimney is `size` square and `high`, standing `from` over the
 * eaves, `along` from the middle on the ridge; the door is in the lake-facing wall, and the window `along` from the middle
 * and `sill` over the ground. It has no rules: it is drawn on the bank only, and what is cast onto it lies on the ground.
 * `clear` is how far the grass, the trees and the clumps keep back from the roof's edge. First guesses, from the mock the
 * user chose.
 */
export const CABIN = {
  angle: JETTY.angle,
  k: 1.32,
  body: { along: 9, across: 7, high: 4.6 },
  roof: { pitch: (35 * Math.PI) / 180, overhang: 0.7, thick: 0.45 },
  chimney: { size: 1.1, high: 2.4, from: 1.6, along: 2.8 },
  door: { width: 1.5, high: 2.6 },
  window: { width: 1.6, high: 1.3, along: 2.6, sill: 1.8 },
  clear: 0.5,
} as const;

/** The cabin's middle on the bank, and the unit directions in toward the lake and along the shore, worked out once. */
export const CABIN_AT = ringFrame(CABIN.k, CABIN.angle);

/** How far a point is from the edge of the cabin's roof in plan: below nought under it. */
export function cabinGap(x: number, y: number): number {
  const dx = x - CABIN_AT.x,
    dy = y - CABIN_AT.y;
  return boxGap(
    dx * CABIN_AT.along[0] + dy * CABIN_AT.along[1],
    dx * CABIN_AT.inward[0] + dy * CABIN_AT.inward[1],
    CABIN.body.along / 2 + CABIN.roof.overhang,
    CABIN.body.across / 2 + CABIN.roof.overhang,
  );
}

/** Whether a point is where the cabin and the jetty's shore end stand, or within the keep-back of them: no grass, tree or clump is. */
export function onCabinOrDeck(x: number, y: number): boolean {
  return cabinGap(x, y) < CABIN.clear || jettyGap(x, y) < CABIN.clear;
}

/** How deep the bed is under a point: the most in the middle, easing to nothing at the shore, shallower over a boulder's flank, nought on land. */
export function bedDepth(x: number, y: number): number {
  return Math.max(0, Math.min(bowlDepth(x, y), -boulderTop(x, y)));
}

/**
 * How high the ground is at a point with no deck laid on it: the bed under the water, the bank and the boulders out of
 * it. The scenery stands on this, so a stone or a weed under the deck is where the draws put it and not on the planks.
 */
export function bareGround(x: number, y: number): number {
  return inward(x, y) > 0 ? Math.max(-bowlDepth(x, y), boulderTop(x, y)) : groundUnder(x, y);
}

/** How high the ground is at a point, boulders and the jetty's planks and all: what a cast lands on. */
export function ground(x: number, y: number): number {
  const bare = bareGround(x, y);
  return jettyGap(x, y) < 0 ? Math.max(bare, JETTY.top) : bare;
}

/**
 * How high the ground is at a point without the boulders on it: the bed under the water, the bank rising out of it,
 * and the cliff behind the north bank standing on that, one surface with no step. The bed and the banks are drawn as a
 * sheet from this, and the boulders on it as their own.
 */
export function groundUnder(x: number, y: number): number {
  const k = inward(x, y);
  if (k > 0) return -bowlDepth(x, y);
  // out of the water, the bank rises from nought at the shore to its top, easing in and out
  const { distance, angle } = polar(x, y);
  const out = Math.min(1, (distance - shoreRadius(angle)) / BANK_RISE);
  return BANK_TOP * out * out * (3 - 2 * out) + cliffRise(x, y);
}

/** The smooth step from nought at `a` to one at `b`. */
function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The rock wall behind the north bank, as content: a sector round due north (`middle`, in the lake's own polar frame)
 * that is `half` either side of it and eases to nothing over the last `edge`, so its ends blend into the banks. The
 * bank is as it is to `foot` (in shore radii, a thin ledge at the water), then the wall rises to `top`, where the
 * plateau stands `height` over the bank, and goes on behind it. A notch in the crest lets each fall down: the crest
 * dips there to the share `dip` of itself, over the notch's `width` and a little beyond, for a short way back from
 * the lip (so the notch is a bay in the crest and not a trench into the woods), and the wall in its channel is a
 * straight chute so a strip of water lies on it. Faces leaning past `rockSlope` (radians, from level) are rock: no
 * grass grows on them and nothing stands on them. The lumps are faceted rock embedded along the crest and the foot,
 * `count` of each, `size` between their least and most half-width, so the wall is not a smooth ramp. First guesses, to
 * be tuned by looking at the mock the user chose from.
 */
export const CLIFF = {
  middle: Math.PI / 2,
  half: 0.7,
  edge: 0.15,
  foot: 1.03,
  top: 1.22,
  height: 18,
  dip: 0.6,
  // the notch dips whole to this far past the lip (in shore radii) and has filled in again at this
  notchBack: [0.04, 0.2] as const,
  // the two falls, round from east and how wide each is in world units
  notches: [
    { angle: Math.PI / 2 - 0.22, width: 3.2 },
    { angle: Math.PI / 2 + 0.3, width: 2.2 },
  ] as const,
  rockSlope: (50 * Math.PI) / 180,
  seed: 4242,
  lumps: {
    // the crest's lumps stand on the plateau a little back of the lip, so their tops show over it and they do not hang from the face
    crest: { count: 10, k: 1.32, spread: 0.03, size: [3.5, 5.5] as const },
    foot: { count: 8, k: 1.06, spread: 0.03, size: [2.2, 3.6] as const },
    // the face's own lumps, at mid height and sunk two thirds into the wall so only their facets show, which break up what
    // would otherwise be one smooth ramp from the crest to the foot
    face: { count: 8, k: 1.12, spread: 0.1, size: [2.5, 4] as const },
  },
} as const;

/** A notch in the crest: where its line meets the shore, the unit directions in toward the lake and along the shore, and its width. */
export interface Notch {
  angle: number;
  width: number;
  x: number;
  y: number;
  inward: readonly [number, number];
  along: readonly [number, number];
}

/** The notches, worked out once: each one's line runs straight out from the lake's middle through the shore at its angle. */
export const NOTCHES: readonly Notch[] = CLIFF.notches.map(({ angle, width }) => {
  const r = shoreRadius(angle);
  const x = Math.cos(angle) * r * STRETCH,
    y = Math.sin(angle) * r;
  const l = Math.hypot(x, y);
  const inward: [number, number] = [-x / l, -y / l];
  return { angle, width, x, y, inward, along: [-inward[1], inward[0]] };
});

/** How much a point is in a notch's channel: one across the notch's width, easing to nought a little past it, the most of any notch. */
export function channel(x: number, y: number): number {
  let c = 0;
  for (const n of NOTCHES) {
    const side = Math.abs((x - n.x) * n.along[0] + (y - n.y) * n.along[1]);
    c = Math.max(c, 1 - smooth(n.width * 0.5, n.width * 1.1, side));
  }
  return c;
}

/** How much higher the cliff makes the ground at a point than the bank alone would be: nought outside its sector and before its foot. */
export function cliffRise(x: number, y: number): number {
  const { distance, angle } = polar(x, y);
  const d = Math.abs(Math.atan2(Math.sin(angle - CLIFF.middle), Math.cos(angle - CLIFF.middle)));
  if (d >= CLIFF.half) return 0;
  const k = distance / shoreRadius(angle);
  if (k <= CLIFF.foot) return 0;
  const sector = 1 - smooth(CLIFF.half - CLIFF.edge, CLIFF.half, d);
  const t = Math.min(1, (k - CLIFF.foot) / (CLIFF.top - CLIFF.foot));
  const c = channel(x, y);
  // in the channel the wall is a straight chute and the crest is dipped, back only a little way from the lip
  const dipped = c * (1 - smooth(CLIFF.top + CLIFF.notchBack[0], CLIFF.top + CLIFF.notchBack[1], k));
  const profile = (1 - c) * (t * t * (3 - 2 * t)) + c * t;
  return sector * CLIFF.height * (1 - (1 - CLIFF.dip) * dipped) * profile;
}

/**
 * Whether a point is on a fall's line, in a channel's width and from the wall's foot to where the notch has filled in
 * behind the lip: the water's own place, where no grass grows and nothing stands. A blade at the lip would hang over the fall.
 */
export function onFall(x: number, y: number): boolean {
  const k = 1 - inward(x, y);
  if (k < CLIFF.foot || k > CLIFF.top + CLIFF.notchBack[1]) return false;
  // on the cliff's side of the shore along the notch's line, and not on some other bank at the same distance across
  return NOTCHES.some(
    (n) =>
      (x - n.x) * -n.inward[0] + (y - n.y) * -n.inward[1] > 0 &&
      Math.abs((x - n.x) * n.along[0] + (y - n.y) * n.along[1]) < n.width / 2 + FALL_MARGIN,
  );
}

/** How far past a fall's own width the grass and the clumps keep back. */
const FALL_MARGIN = 0.6;

/** How far across a step the ground's lean is taken for `onFace`. */
const LEAN_STEP = 0.25;

/** Whether the ground at a point leans past the rock slope: the cliff's face, which has no grass and nothing standing on it. */
export function onFace(x: number, y: number): boolean {
  const dx = (groundUnder(x + LEAN_STEP, y) - groundUnder(x - LEAN_STEP, y)) / (2 * LEAN_STEP),
    dy = (groundUnder(x, y + LEAN_STEP) - groundUnder(x, y - LEAN_STEP)) / (2 * LEAN_STEP);
  return Math.atan(Math.hypot(dx, dy)) > CLIFF.rockSlope;
}

/**
 * How a fish comes to the lure and bites, first guesses to be tuned by playing (and held by the pace gate once it is
 * back): how far off, in plan, a fish may notice a sunk lure, and how far from its own depth; the chance a second it
 * does, and how much a twitch adds to that and for how long; how fast it comes; how near the lure its mouth is when it
 * nibbles; how many nibbles, and the gaps between them; how long the strike's window is; and how long a fish that let
 * go keeps away.
 */
export const FISHING = {
  // measured on 40 seeds of a cast to the middle: a bite in 11.7 s at the median and 23 s at the most; at a reach of
  // 12, a band of 3 and a chance of 0.3, a lake's six fish were too seldom near enough, and one seed in seven waited
  // over a minute
  reach: 18,
  band: 5,
  notice: 0.4,
  twitchBoost: 3,
  twitchLasts: 3,
  comeSpeed: 1.8,
  mouth: 0.6,
  nibbles: [1, 3] as const,
  nibbleGap: [0.7, 1.6] as const,
  window: 0.9,
  wary: 8,
} as const;

/**
 * The fight, first guesses to be tuned by playing and held by the pace gate: how fast the reel winds line in, and
 * what share of that it manages against a pulling fish; how fast the reel draws the line tighter, and how much more a
 * pull adds; how fast letting go eases it, resting and pulling; how fast a pulling fish takes line off a reel let go;
 * how long a pull and a rest last, and what share of its rest a sick lake's fish keeps (so it pulls more often); how
 * tight the line is when the fish is hooked; how long it may be as tight as it goes before the fish slips; the spool's
 * length; and where in the shallows below the angler a fish is landed, and how near it the line must be wound.
 */
export const FIGHT = {
  // at a reel of 3, a reel's tension of 0.22, an easing of 0.45 and a run of 2, a careful hand took over two minutes
  // to wind in a fish hooked in the middle of the lake, the fish taking back most of what the reel won
  reel: 4,
  reelPulling: 0.25,
  reelTension: 0.15,
  pullTension: 0.7,
  ease: 0.6,
  easePulling: 0.15,
  run: 1.2,
  pull: [0.8, 2.2] as const,
  rest: [1.5, 3.5] as const,
  sickRest: 0.5,
  startTension: 0.2,
  slip: 0.3,
  spool: 60,
  landAt: [0, -shoreRadius(-Math.PI / 2) + 2] as const,
  landWithin: 1.5,
} as const;

/** The lab's one kind of fish, its name and the least and most it weighs, in kilograms. */
export const PERCH = { name: 'glowing perch', weight: [0.3, 2.4] as const } as const;

/**
 * The water's surface as a mesh: rings out from the middle to a little past the shore and segments round, as coarse as
 * it is over most of the lake; the greatest distance in world units any two neighbouring corners may be apart within
 * `near` of the Shore view's camera's place on the ground; and that reach. The swells are worked out only at the
 * corners, so a swell shorter than about twice their spacing is not drawn travelling: the near water brightens and
 * darkens all together at its beat instead (docs/crystal.md, part 12's films). At half a unit, a swell of a metre has
 * two corners a crest. The whole sheet that fine cost 0.9 ms a frame at the standard scene, timed in turn with the
 * coarse one, and the budget's rule for that is a sheet fine only near the camera: a reach of 40 is the water from the
 * south shore to sixteen units in, and cost 0.3 ms.
 */
export const SURFACE = { rings: 24, segments: 128, spacing: 0.5, near: 40 } as const;

/**
 * The water is drawn at this share of the game's clock, so a pond is calm: its swells, ripples, caustics, foam and
 * sparkles all move at it, and what floats on it (the bobber, a splash's rings) is read at it too. It is content, with
 * the lake's other figures, and `main.ts` is what hands it to the renderer and to `surfaceOf`. It was 0.4, and filmed
 * beside the reference's water (docs/crystal.md, part 10) ours changed between frames a thirtieth as much; at 0.6 the
 * pond is still calm but is seen to move. The renderer's clock runs at it, so the breeze in the grass is quicker by as
 * much; the falls divide it back out and keep their own speed.
 */
export const WATER_PACE = 0.6;

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

/**
 * How the banks are dressed, as content. The trees are the package's low-poly broadleaves and conifers, each placement
 * a variant scaled to a height picked between its kind's two, then held down so its top stays under the sun's shadow.
 * The heights are those the kit's trees stood at (the kit's models were seven to ten metres as they come, scaled two
 * and a half to three times, against a pond thirty across), and the user chose them against the reference. Pebbles are
 * tiny as they come, so they are scaled up to the old stones' size, and sunk by a share of their own height. The clumps
 * are a count of them, how far out they go in shore radii (denser near the water, by a square), how far from the
 * angler's spot they keep, and which kinds grow, in what proportion and at what scale (the fern comes nine wide, so it
 * is scaled right down). First guesses, to be tuned by looking.
 */
export const SCENERY = {
  trees: { broadleaf: [16, 29], conifer: [17, 32] } as Record<'broadleaf' | 'conifer', readonly [number, number]>,
  /**
   * The woodland round the lake: more trees than the twenty-six that stand by the water, in a band of shore radii
   * (further out on the south bank, which the camera looks from, so the near bank stays open), denser outward by a
   * square root. A tree is a few hundred triangles at most (the kit's were three to six thousand), so two hundred and
   * ten of them cost less than sixty of the kit's did.
   */
  woodland: { count: 210, band: [1.3, 3.3] as const, southBand: [2.8, 4.2] as const },
  pebbles: { scale: [3, 6] as const, sunk: 0.3 },
  clumps: {
    count: 90,
    reach: 2.5,
    clear: 5,
    kinds: {
      grass: { weight: 4, scale: [1.2, 2.2] },
      fern: { weight: 2, scale: [0.25, 0.4] },
      clover: { weight: 2, scale: [2, 3.5] },
      flowers: { weight: 2, scale: [1.2, 2] },
      bush: { weight: 2, scale: [1.2, 2.2] },
      mushroom: { weight: 1, scale: [2, 3.5] },
    } as Record<string, { weight: number; scale: readonly [number, number] }>,
  },
} as const;

/**
 * The frame, in milliseconds, past which the page steps down to the lean rung (no grass) at boot: the
 * frame budget itself. A machine that draws the full rung inside the budget keeps it.
 */
export const RUNG_DOWN_MS = 8;
