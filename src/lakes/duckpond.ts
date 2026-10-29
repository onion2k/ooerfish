/**
 * The Duck Pond (`docs/lakes.md`): the game's first lake and its home, where the cabin is. Every figure and function
 * here was in `lake.ts` (or in `scene.ts`, `grass.ts`, `rocks.ts`, `fish.ts`, `angler.ts` and `falls.ts`, which kept a
 * pond number each) and none has changed, so every picture of the pond holds. `lake.ts` re-exports them from
 * `DUCK_POND` until each builder takes the lake it is handed.
 *
 * It lies round the world's origin with its surface at nought, and the world's z is up. Its shape is not from chance:
 * the same pond is the same every run whatever the seed.
 */
import { BOAT } from '../lake';
import { DRUM_RULES, WATER_LEVEL } from '../rules';
import type { Lake, Notch, TreasureSpec, View, ViewName, WakingEye } from './lake';

/** The shore's mean distance from the middle, in world units: a pond a player can cast across in a few throws. */
const SHORE_RADIUS = 30;
/** How far the pond is drawn out east and west, against north and south, so it is not a circle. */
const STRETCH = 1.35;
/** The deepest the bed goes, in the middle. */
const MAX_DEPTH = 6;
/** How high the banks rise, at the most, and how far out from the shore they take to. */
const BANK_TOP = 2.2;
const BANK_RISE = 18;
/** How many points the shore is drawn with. */
const SHORE_POINTS = 128;

/** The shore's wobbles: how much, how many round, and where each begins, so the pond has a cove and a point. */
const WOBBLES: readonly [amount: number, turns: number, phase: number][] = [
  [0.12, 2, 0.6],
  [0.08, 3, 2.1],
  [0.05, 5, 4.0],
];

/** How far the shore is from the middle, in the stretched frame, at an angle round from east. */
function shoreRadius(angle: number): number {
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
function inward(x: number, y: number): number {
  const { distance, angle } = polar(x, y);
  return 1 - distance / shoreRadius(angle);
}

/** Whether a point is inside the shore, at least `margin` world units in from it, whatever stands in the water there. */
function inShore(x: number, y: number, margin = 0): boolean {
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
const BOULDERS: readonly { x: number; y: number; radius: number; rise: number }[] = [
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
function bowlDepthAt(out: number): number {
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
const BED_SHALLOWS = { depth: 5.5, blend: 1.5, bands: 6, beach: 1.04 } as const;

/** How far a boulder's dome goes into the bed under its middle, so its flank stands out of the bed all round on a slope. */
const BOULDER_SUNK = 1;

/**
 * Each boulder's dome, worked out once: the height of its middle (sunk into the bed under it), how high it stands from
 * there and how wide it is at its foot, so its waterline is its radius. The scene draws each as a ball so stretched.
 */
const BOULDER_DOMES = BOULDERS.map((b) => {
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
const ROCKS = { rings: 5, segments: 8, give: 0.2, floor: -0.4, spacing: 0.4 } as const;

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
function boulderGap(x: number, y: number): number {
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
function nearestBoulder(x: number, y: number): (typeof BOULDERS)[number] {
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
const JETTY = {
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
const DECK = ringFrame(JETTY.k, JETTY.angle);

/** How far a point is outside a rectangle `halfU` by `halfV` about its middle, in plan, below nought inside it. */
function boxGap(u: number, v: number, halfU: number, halfV: number): number {
  const du = Math.abs(u) - halfU,
    dv = Math.abs(v) - halfV;
  return du > 0 || dv > 0 ? Math.hypot(Math.max(du, 0), Math.max(dv, 0)) : Math.max(du, dv);
}

/** A point in the deck's own frame: how far in along it from its start, and how far across from its middle line. */
function deckFrame(x: number, y: number): [along: number, across: number] {
  const dx = x - DECK.x,
    dy = y - DECK.y;
  return [dx * DECK.inward[0] + dy * DECK.inward[1], dx * DECK.along[0] + dy * DECK.along[1]];
}

/** The deck's middle, and how far its corners are from it: the circle that holds the whole deck. */
const DECK_ROUND = {
  x: DECK.x + (DECK.inward[0] * JETTY.length) / 2,
  y: DECK.y + (DECK.inward[1] * JETTY.length) / 2,
  radius: Math.hypot(JETTY.length / 2, JETTY.width / 2),
};
/**
 * How far past the deck's circle `jettyGap` takes the trouble to be exact. The widest margin anything asks `inside` for
 * is the six a fish is placed in from the shore, so beyond this the answer only has to be plainly more than that.
 */
const DECK_NEAR = 8;
const DECK_NEAR_SQUARED = (DECK_ROUND.radius + DECK_NEAR) ** 2;

/**
 * How far a point is from the deck's edge in plan: below nought inside it, as `boulderGap` is inside a boulder. Asked by
 * every fish several times a step, so a point far from the deck is answered with its distance from the deck's circle,
 * which the true gap can only exceed, and the rectangle's sums are done for those near it alone.
 */
function jettyGap(x: number, y: number): number {
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
function nearestOnDeck(x: number, y: number): [number, number] {
  const [u, v] = deckFrame(x, y);
  const cu = Math.min(JETTY.length, Math.max(0, u)),
    cv = Math.min(JETTY.width / 2, Math.max(-JETTY.width / 2, v));
  return [DECK.x + DECK.inward[0] * cu + DECK.along[0] * cv, DECK.y + DECK.inward[1] * cu + DECK.along[1] * cv];
}

/** Whether a point is in the water, at least `margin` world units in from the shore and from every boulder and the deck. */
function inside(x: number, y: number, margin = 0): boolean {
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
const CABIN = {
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
const CABIN_AT = ringFrame(CABIN.k, CABIN.angle);

/** How far a point is from the edge of the cabin's roof in plan: below nought under it. */
function cabinGap(x: number, y: number): number {
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
function onCabinOrDeck(x: number, y: number): boolean {
  return cabinGap(x, y) < CABIN.clear || jettyGap(x, y) < CABIN.clear;
}

/** How deep the bed is under a point: the most in the middle, easing to nothing at the shore, shallower over a boulder's flank, nought on land. */
function bedDepth(x: number, y: number): number {
  return Math.max(0, Math.min(bowlDepth(x, y), -boulderTop(x, y)));
}

/**
 * How high the ground is at a point with no deck laid on it: the bed under the water, the bank and the boulders out of
 * it. The scenery stands on this, so a stone or a weed under the deck is where the draws put it and not on the planks.
 */
function bareGround(x: number, y: number): number {
  return inward(x, y) > 0 ? Math.max(-bowlDepth(x, y), boulderTop(x, y)) : groundUnder(x, y);
}

/** How high the ground is at a point, boulders and the jetty's planks and all: what a cast lands on. */
function ground(x: number, y: number): number {
  const bare = bareGround(x, y);
  return jettyGap(x, y) < 0 ? Math.max(bare, JETTY.top) : bare;
}

/**
 * How high the ground is at a point without the boulders on it: the bed under the water, the bank rising out of it,
 * and the cliff behind the north bank standing on that, one surface with no step. The bed and the banks are drawn as a
 * sheet from this, and the boulders on it as their own.
 */
function groundUnder(x: number, y: number): number {
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
const CLIFF = {
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

/** The notches, worked out once: each one's line runs straight out from the lake's middle through the shore at its angle. */
const NOTCHES: readonly Notch[] = CLIFF.notches.map(({ angle, width }) => {
  const r = shoreRadius(angle);
  const x = Math.cos(angle) * r * STRETCH,
    y = Math.sin(angle) * r;
  const l = Math.hypot(x, y);
  const inward: [number, number] = [-x / l, -y / l];
  return { angle, width, x, y, inward, along: [-inward[1], inward[0]] };
});

/** How much a point is in a notch's channel: one across the notch's width, easing to nought a little past it, the most of any notch. */
function channel(x: number, y: number): number {
  let c = 0;
  for (const n of NOTCHES) {
    const side = Math.abs((x - n.x) * n.along[0] + (y - n.y) * n.along[1]);
    c = Math.max(c, 1 - smooth(n.width * 0.5, n.width * 1.1, side));
  }
  return c;
}

/** How much higher the cliff makes the ground at a point than the bank alone would be: nought outside its sector and before its foot. */
function cliffRise(x: number, y: number): number {
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
function onFall(x: number, y: number): boolean {
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
function onFace(x: number, y: number): boolean {
  const dx = (groundUnder(x + LEAN_STEP, y) - groundUnder(x - LEAN_STEP, y)) / (2 * LEAN_STEP),
    dy = (groundUnder(x, y + LEAN_STEP) - groundUnder(x, y - LEAN_STEP)) / (2 * LEAN_STEP);
  return Math.atan(Math.hypot(dx, dy)) > CLIFF.rockSlope;
}

/**
 * The room inside the cabin, as content, all relative to the cabin's own frame (`CABIN_AT`): `along` the shore from its
 * middle and `across` in toward the lake from it. The walls are `inset` thick inside the cabin's outer ones, so the room
 * is wholly in the solid block and is not seen from outside; it is `high` from the floor to the ceiling, the floor a
 * `slab` thick. The bed lies in the back corner on the far side from the door, its head to the back wall: `legs` high,
 * a `base` of boards, a `mattress`, and a `headboard` as high over the floor as it says. The window and the door are in
 * the lake-facing wall, `along` from the middle, the window's `sill` over the floor, and a `frame` wide round each. The
 * lamp hangs `drop` under the ceiling at a place, and lights `radius` round it in `colour`. `eye` is how high a
 * sleeper's eyes are over the floor. First guesses, as the cabin's were, to be tuned once it is seen.
 */
const CABIN_ROOM = {
  inset: 0.35,
  high: 3.1,
  slab: 0.12,
  bed: { width: 1.8, length: 3.1, legs: 0.35, base: 0.2, mattress: 0.3, headboard: 1.25 },
  window: { along: CABIN.window.along, width: 1.6, high: 1.3, sill: 0.9, frame: 0.14 },
  door: { along: 0, width: CABIN.door.width, high: 2.4, frame: 0.14 },
  lamp: {
    along: 2,
    across: 0.6,
    drop: 0.85,
    colour: [1, 0.78, 0.46] as [number, number, number],
    radius: 14,
    intensity: 22,
  },
  eye: 1.7,
  /**
   * The furniture, each piece in the room's frame (`across` toward the lake, `along` the shore, both from the middle) and
   * its heights over the floor. The table stands under the window on the lake wall with the chair pulled up on the
   * room's side and the mug on it. The stove stands against the end wall, the nearest wall to the chimney (which comes
   * down at 2.8 along, 1.35 from that wall), its pipe rising, jogging under the ceiling to `to`, inside the chimney's footprint, and going up into it. The chest is at the bed's foot
   * corner on its open side, where the camera over the bed's rail can see it, and the rug lies in front of the door. The
   * shelf and the coat hang on the lake wall beside the door, where the camera sees them, and the picture in the gap
   * between the door and the window. First guesses, to be tuned by the picture.
   */
  furniture: {
    table: { across: 2.65, along: 2.6, deep: 0.9, wide: 1.3, high: 0.74, top: 0.06, leg: 0.07 },
    chair: { across: 1.9, along: 2.6, size: 0.5, seat: 0.45, back: 0.95, leg: 0.05 },
    mug: { across: 2.6, along: 2.85, radius: 0.08, high: 0.13 },
    stove: {
      across: 1.3,
      along: 3.75,
      wide: 0.75,
      deep: 0.7,
      high: 0.9,
      legs: 0.12,
      pipe: 0.1,
      run: 0.3,
      to: { across: 0.3, along: 2.9 },
    },
    shelf: { along: -2.8, wide: 1.4, deep: 0.26, high: 1.5, thick: 0.05 },
    /** The second shelf, above the first on the same wall, where the junk treasures found stand with the lower one's free end. */
    shelfUpper: { along: -2.8, wide: 1.4, deep: 0.26, high: 2.0, thick: 0.05 },
    /** The books stand in a row at the shelf's far end, each a width and a height; the jar stands at the near end. */
    books: [
      [0.07, 0.3],
      [0.06, 0.26],
      [0.08, 0.32],
      [0.05, 0.24],
    ] as readonly (readonly [number, number])[],
    jar: { radius: 0.1, high: 0.26 },
    rug: { across: 2.0, along: 0, wide: 2.1, long: 1.8, thick: 0.025, border: 0.18 },
    chest: { across: 0.45, along: 1.6, wide: 0.7, long: 1.2, high: 0.55, lid: 0.1 },
    picture: { along: 1.28, wide: 0.5, high: 0.4, at: 1.55, frame: 0.05 },
    coat: { along: -1.3, peg: 1.95, wide: 0.5, long: 1.0 },
    /**
     * The wall calendar: a sheet `wide` along the end wall, the stove's, centred `across` the room with its foot `at` over
     * the floor, a timber bar `bar` high along its top, and a `margin` of paper round the squares; the sheet's height is
     * what the four rows of squares and those take, and each square is `mark` of its cell. It hangs on the end wall
     * because the lake wall has no stretch wide enough for fourteen squares a row to be read from the pillow: it is
     * seen at a slant there, the squares narrower than they are tall, but a metre and a third of paper over the bed's
     * side and short of the stovepipe is the widest the room has in the pillow's view. Its foot is over the headboard's height, so the bed's side is clear under it, and low enough that the glow gauge in the
     * screen's corner does not cover it; the lamp hangs well in front of the wall, off it.
     */
    calendar: {
      across: 0.53,
      wide: 1.3,
      at: 1.45,
      bar: 0.04,
      margin: 0.06,
      mark: 0.74,
      depth: 0.03,
      proud: 0.012,
    },
  },
} as const;

/**
 * How high the room's floor is: over the highest ground under the cabin, which slopes up toward the back bank, so no
 * ground shows through it. The door's sill outside is lower, a step down to the bank on the lake side.
 */
const CABIN_FLOOR = ((): number => {
  let top = -Infinity;
  const halfU = CABIN.body.along / 2,
    halfV = CABIN.body.across / 2;
  for (let i = 0; i <= 8; i++)
    for (let j = 0; j <= 8; j++) {
      const u = -halfU + (i / 8) * 2 * halfU,
        v = -halfV + (j / 8) * 2 * halfV;
      top = Math.max(
        top,
        bareGround(
          CABIN_AT.x + CABIN_AT.inward[0] * v + CABIN_AT.along[0] * u,
          CABIN_AT.y + CABIN_AT.inward[1] * v + CABIN_AT.along[1] * u,
        ),
      );
    }
  return top + 0.1;
})();

/**
 * A view from inside the room: the camera at an eye in the cabin's frame, looking toward a point of the floor's plan and
 * `down` radians below level, `fov` wide. The orbit keeps ten units from its target and no nearer, so the target is
 * put ten units out in front of the eye, through the wall, and the camera is what stands in the room.
 */
function roomView(eye: WakingEye, toward: [number, number], down: number, fov: number): View {
  const world = (u: number, v: number): [number, number] => [
    CABIN_AT.x + CABIN_AT.inward[0] * v + CABIN_AT.along[0] * u,
    CABIN_AT.y + CABIN_AT.inward[1] * v + CABIN_AT.along[1] * u,
  ];
  const [cx, cy] = world(eye.along, eye.across),
    [tx, ty] = world(...toward);
  const l = Math.hypot(tx - cx, ty - cy);
  const radius = 10;
  const flat = radius * Math.cos(down);
  const x = cx + ((tx - cx) / l) * flat,
    y = cy + ((ty - cy) / l) * flat;
  const z = CABIN_FLOOR + eye.high - radius * Math.sin(down);
  return { x, y, z, azimuth: Math.atan2(cy - y, cx - x), polar: Math.PI / 2 - down, radius, fov };
}

/** The sleeper's eyes: over the pillow, at the bed's head in the back corner away from the door. */
const WAKING_EYE = {
  along: CABIN.body.along / 2 - CABIN_ROOM.inset - CABIN_ROOM.bed.width / 2,
  across: -(CABIN.body.across / 2 - CABIN_ROOM.inset) + 0.7,
  high: CABIN_ROOM.eye,
};
/** Where the sleeper looks: across the room to the lake-facing wall between the door and the window. */
const WAKING_GAZE: [number, number] = [CABIN_ROOM.window.along / 2, CABIN.body.across / 2 - CABIN_ROOM.inset];

/**
 * Where the camera may stand: on the south bank at a player's eye, out in the
 * boat, high over the middle, the shore again framed for a phone held
 * upright, which needs to stand further back to see across, and, inside the
 * cabin, the bed's pillow looking at the door and the window, and the same
 * with a wider lens for a tall screen.
 */
const VIEWS: Record<ViewName, View> = {
  shore: { x: 0, y: 4, azimuth: -1.57, polar: 1.3, radius: 62 },
  boat: { x: 8, y: 6, azimuth: -0.9, polar: 1.42, radius: 18 },
  overhead: { x: 0, y: 0, azimuth: -1.57, polar: 0.35, radius: 110 },
  phone: { x: 0, y: 6, azimuth: -1.57, polar: 1.2, radius: 105 },
  cabin: roomView(WAKING_EYE, WAKING_GAZE, (10 * Math.PI) / 180, 60),
  cabinTall: roomView(WAKING_EYE, WAKING_GAZE, (10 * Math.PI) / 180, 85),
};

/** The year-round dressing of the banks: the trees, the woodland, the pebbles and the clumps. */
const DRESSING = {
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

/** The seeds and counts the scenery is placed from, which were each builder's own: the pond's, and no figure changed. */
const SCENERY_FIGURES = {
  seeds: {
    // the stones and the old trees: the lake's own, so they stand still whatever the game's seed
    scene: 1971,
    dressing: 4417,
    grass: 1971,
    // the rocks are cut from these by index: the boulders from one hundred and the cliff's lumps from two hundred
    boulder: 100,
    lump: 200,
  },
  // how many stones line the shore, trees stand on the banks, rocks lie on the bed and clumps of weed grow from it, of how many blades each
  counts: { stones: 70, trees: 26, rocks: 36, clumps: 14, blades: 5 },
  // the banks' rings: fine up the cliff's wall, where the ground rises eighteen units in a few, then coarser behind it and packed outward
  banks: {
    stops: [
      [0.98, CLIFF.foot, 2],
      [CLIFF.foot, CLIFF.top + 0.04, 16],
      [CLIFF.top + 0.04, 1.6, 8],
    ] as readonly (readonly [number, number, number])[],
    to: 12,
  },
} as const;

/**
 * The drums of waste on the pond's bed (`docs/journal.md`), the content half: how many lie there, what one weighs (in
 * kilograms, for the card), and the seed their places are cut from, so no draw of the game's chance is ever spent on
 * them. Their places are on the bed `bearing` either side of due north of the angler, between the two distances from
 * the angler, in water `depth` deep (a lure stops on the bed only where the bed is shallower than the line lets it
 * sink, so a drum in deeper water could never be reached), kept `margin` in from the shore and the boulders and `apart`
 * from each other. A drum is `radius` across and `height` tall. How near the lure must lie to snag one and the rest are
 * the rules' (`DRUM_RULES`). First guesses, to be tuned in play.
 */
const DRUMS = {
  count: 2,
  weight: 42,
  seed: 4177,
  where: { distance: [14, 30] as const, bearing: 0.6, depth: [2, 3.6] as const, margin: 2, apart: 7 },
  radius: 1.1,
  height: 1.9,
  /** Where a hauled drum stands on the bank, in the cabin's frame (`across` toward the lake, `along` the shore): in front of it, off the jetty's path. */
  bank: [
    { across: 6.4, along: 3.8 },
    { across: 6.4, along: 6.2 },
  ] as readonly { across: number; along: number }[],
} as const;

/**
 * The junk treasures on the Duck Pond's bed (`docs/junk.md`), the content half: six, which come up on the line and are
 * kept on the cabin's shelves. They lie where `seed` puts them (never the game's chance), in the band `where` says:
 * between two distances of the angler and `bearing` either side of due north, in water `depth` deep, `margin` in from
 * the shore and the boulders, `apart` from each other and from each drum. The band is nearer than the drums' and than
 * where the pace angler's lure lies, so the pace gate does not meet them. The models are drawn `bedScale` times their
 * size on the bed, so that they are seen through the water, and `shelfScale` times it on a shelf. None of them cleans
 * the pond. Each `size` is what its model in `treasuredraw.ts` measures, at a scale of one, held by a test. First
 * guesses, the lines and the note a placeholder.
 */
const TREASURES = {
  count: 9,
  seed: 6211,
  where: { distance: [8, 21] as const, bearing: 0.9, depth: [2, 3.6] as const, margin: 2, apart: 4 },
  // the three pages of the logbook were drawn after the six, in a band the six had crowded, so they keep less apart
  later: { from: 6, apart: 3 },
  bedScale: 1.8,
  shelfScale: 0.28,
  list: [
    {
      id: 'lure',
      name: 'old lure',
      line: 'A rusty spinner, still shiny where it counts.',
      weight: 0.1,
      size: { radius: 0.55, high: 0.17 },
      shelf: { on: 'lower', along: -2.95 },
    },
    {
      id: 'plush',
      name: 'Sunny Atom plush',
      line: 'The Sunny Atom, soggy but smiling.',
      weight: 0.4,
      size: { radius: 0.4, high: 0.74 },
      shelf: { on: 'upper', along: -3.3 },
    },
    {
      id: 'lunchbox',
      name: 'Sunny Atom lunchbox',
      line: 'Empty, thank goodness.',
      weight: 0.6,
      size: { radius: 0.41, high: 0.43 },
      shelf: { on: 'upper', along: -2.99 },
    },
    {
      id: 'badge',
      name: '"Safety First!" badge',
      line: "Safety First! (They weren't.)",
      weight: 0.05,
      size: { radius: 0.42, high: 0.08 },
      shelf: { on: 'lower', along: -2.66 },
    },
    {
      id: 'bottle',
      name: 'message bottle',
      line: 'Corked, and not empty.',
      weight: 0.3,
      size: { radius: 0.5, high: 0.23 },
      shelf: { on: 'upper', along: -2.68 },
      note: "If you're reading this, the fish are glowing again. Bring them home. — E.",
    },
    {
      id: 'duck',
      name: 'rubber duck',
      line: "The Duck Pond's own rubber duck.",
      weight: 0.2,
      size: { radius: 0.41, high: 0.56 },
      shelf: { on: 'upper', along: -2.38 },
    },
    {
      id: 'page1',
      name: 'logbook page',
      line: 'Water-stained, but it reads.',
      weight: 0.02,
      size: { radius: 0.5, high: 0.13 },
      shelf: null,
      page: 1,
      note: 'Cooling pond, 0600. Readings normal. Somebody has left a deckchair by the outflow. Removed it. W.F.',
    },
    {
      id: 'page2',
      name: 'logbook page',
      line: 'Water-stained, but it reads.',
      weight: 0.02,
      size: { radius: 0.5, high: 0.13 },
      shelf: null,
      page: 2,
      note: 'The deckchair is back, with a flask. Readings normal. Asked around. Nobody in the plant owns a deckchair. W.F.',
    },
    {
      id: 'page3',
      name: 'logbook page',
      line: 'Water-stained, but it reads.',
      weight: 0.02,
      size: { radius: 0.5, high: 0.13 },
      shelf: null,
      page: 3,
      note: 'Valve 3 found open a quarter turn this morning. Closed it. Not my department, but I closed it. W.F.',
    },
  ] as readonly TreasureSpec[],
} as const;

/** How many fish swim in the pond: as many as it takes to clean it, each cured in turn (twelve is an estimate, tuned once the game is played). */
const FISH_COUNT = 12;

/**
 * Where the angler stands, in the middle of the south bank: the player is the angler, and is not drawn, so the cast
 * comes from the middle of the Shore view; how high the rod's tip is held over the ground there, and how far out in
 * front of them, toward the water.
 */
const ANGLER = { x: 0, y: -33.5, tipHeight: 8, tipReach: 4 } as const;

/**
 * Where the boat lies (`docs/boat.md`, C2): off the lake end of the jetty, `BOAT.keepOff` and a little more past the
 * deck's end so its middle is a legal anchorage (`inside` with that margin holds it) and half the deck's width across, so
 * it lies beside the line the deck runs on and not on it; it points inward, down the deck's line toward the middle. And
 * the spot the pace angler rows to: two thirds of the way from the angler to the middle, short of it, where the water is
 * open. First guesses.
 */
const MOORING = {
  x: DECK.x + DECK.inward[0] * (JETTY.length + BOAT.keepOff + 0.5) + DECK.along[0] * (JETTY.width / 2),
  y: DECK.y + DECK.inward[1] * (JETTY.length + BOAT.keepOff + 0.5) + DECK.along[1] * (JETTY.width / 2),
  heading: Math.atan2(DECK.inward[1], DECK.inward[0]),
};
const BOAT_SPOT = [0, ANGLER.y / 3] as const;

/** The sun's shadow is fitted to the lake and the banks round it, up to the tallest tree standing on the cliff's plateau, with a unit to spare. */
const SHADOW_BOX = {
  min: [-(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, -(SHORE_RADIUS * 1.5 + BANK_RISE), -8] as [number, number, number],
  max: [
    (SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH,
    SHORE_RADIUS * 1.5 + BANK_RISE,
    BANK_TOP + CLIFF.height + Math.max(...Object.values(DRESSING.trees).map((r) => r[1])) + 1,
  ] as [number, number, number],
};

/** The cure's count: the fish, and the drums each worth `DRUM_RULES.worth` of them. */
const TOTAL = FISH_COUNT + DRUMS.count * DRUM_RULES.worth;

/** The pond. */
export const DUCK_POND: Lake = {
  id: 'duckpond',
  name: 'Duck Pond',

  radius: SHORE_RADIUS,
  stretch: STRETCH,
  maxDepth: MAX_DEPTH,
  bankTop: BANK_TOP,
  bankRise: BANK_RISE,
  shorePoints: SHORE_POINTS,
  bedShallows: BED_SHALLOWS,
  level: WATER_LEVEL,

  shoreRadius,
  inward,
  inShore,
  inside,
  bedDepth,
  bowlDepthAt,
  ground,
  bareGround,
  groundUnder,
  onFall,
  onFace,
  onCabinOrDeck,

  boulders: BOULDERS,
  domes: BOULDER_DOMES,
  rocks: ROCKS,
  boulderGap,
  nearestBoulder,

  cliff: {
    spec: CLIFF,
    notches: NOTCHES,
    // the two falls' speeds, in world units a second
    fallSpeeds: [7, 8.5],
    channel,
    rise: cliffRise,
  },
  jetty: {
    spec: JETTY,
    deck: DECK,
    round: DECK_ROUND,
    near: DECK_NEAR,
    frame: deckFrame,
    gap: jettyGap,
    nearestOnDeck,
  },
  cabin: {
    spec: CABIN,
    at: CABIN_AT,
    gap: cabinGap,
    room: CABIN_ROOM,
    floor: CABIN_FLOOR,
    wakingEye: WAKING_EYE,
  },
  boat: { mooring: MOORING, spot: BOAT_SPOT },
  // down the pond's east side, south toward the middle from the eastern fall's water. Off the axis, beyond where the
  // shore's casts land (to 8 east at the furthest) and the pace angler's boat casts do, so a game played from the shore
  // and the pace gate's are as they were, and a cast has to be thrown to it
  currents: [{ x: 11.5, y: 6, heading: -Math.PI / 2, length: 16, width: 5, speed: 0.6 }],
  scenery: { ...DRESSING, ...SCENERY_FIGURES },
  shadowBox: SHADOW_BOX,

  fishCount: FISH_COUNT,
  /**
   * The kind of each of the pond's twelve slots, fixed so the same seed gives the same school: four bream, five perch,
   * three pike, mixed so the first fish cured are not all of one kind. A slot past the twelve (a bigger stocking, as the
   * tests make) takes the kind of its place round again.
   */
  fishKinds: [1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1],
  // a point is drawn in this box, then kept if it is well in from the shore
  extent: [40, 30],
  fishShore: 4,
  fishShallowest: 0.4,
  fishAboveBed: 0.4,
  angler: ANGLER,
  from: [ANGLER.x, ANGLER.y],
  // where in the shallows below the angler a fish is landed
  landAt: [0, -shoreRadius(-Math.PI / 2) + 2],
  // how far a cast reaches at full power, over the water, in world units
  castReach: 45,
  // the cast the pace angler aims: due north from the shore at about the power that reaches the middle, and how far it varies either
  aim: { angle: Math.PI / 2, power: 0.62, spread: 0.25, powerSpread: 0.08 },
  /**
   * The water is drawn at this share of the game's clock, so a pond is calm: its swells, ripples, caustics, foam and
   * sparkles all move at it, and what floats on it (the bobber) is read at it too. It was 0.4, and filmed beside the
   * reference's water (docs/crystal.md, part 10) ours changed between frames a thirtieth as much; at 0.6 the pond is
   * still calm but is seen to move. The renderer's clock runs at it, so the breeze in the grass is quicker by as much;
   * the falls divide it back out and keep their own speed.
   */
  waterPace: 0.6,

  drums: DRUMS,
  treasures: TREASURES,

  views: VIEWS,
  /**
   * The water's surface as a mesh: rings out from the middle to a little past the shore and segments round, as coarse as
   * it is over most of the lake; the greatest distance in world units any two neighbouring corners may be apart within
   * `near` of the Shore view's camera's place on the ground; and that reach. A reach of 40 is the water from the south
   * shore to sixteen units in, and cost 0.3 ms (docs/crystal.md, part 12).
   */
  surface: { rings: 24, segments: 128, spacing: 0.5, near: 40 },

  toClean: FISH_COUNT,
  total: TOTAL,
  contaminationAfter: (cured: number, drums: number): number =>
    Math.max(0, 1 - (cured + drums * DRUM_RULES.worth) / TOTAL),
};
