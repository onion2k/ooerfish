/**
 * The Reservoir (`docs/lakes.md`): the game's second lake, a big open water held in by a dam. An oval about one and a
 * half times the pond across and deeper, its north shore not a bank but the straight face of a concrete wall with a
 * walkway on its top, no cliff and no falls, no jetty and no cabin (home is the pond), two boulders of its own, sixteen
 * fish, three drums on the bed and no treasures yet. Every figure is a first guess, to be tuned by the pictures.
 *
 * It lies round the world's origin with its surface at nought, and the world's z is up. Its shape is not from chance:
 * the same lake is the same every run whatever the seed. The dam makes the water end on a line: `shoreRadius` is the
 * oval's, cut off by the dam's face, so everything built from the shore (the bed, the banks' sheet, the foam, the
 * surface, the fish's room) meets the wall without knowing there is one.
 */
import { DRUM_RULES, WATER_LEVEL } from '../rules';
import { DUCK_POND } from './duckpond';
import type { Dam, DamSpec, Lake, View, ViewName } from './lake';

/** The shore's mean distance from the middle: about one and six tenths of the pond's thirty. */
const SHORE_RADIUS = 48;
/** How far it is drawn out east and west, against north and south. */
const STRETCH = 1.35;
/** The deepest the bed goes, in the middle: a half as deep again as the pond's six. */
const MAX_DEPTH = 9;
/** How high the banks rise, at the most, and how far out from the shore they take to. */
const BANK_TOP = 2.2;
const BANK_RISE = 20;
/** How many points the shore is drawn with. */
const SHORE_POINTS = 192;

/** The shore's wobbles: how much, how many round, and where each begins, so the Reservoir has a bay and a point of its own. */
const WOBBLES: readonly [amount: number, turns: number, phase: number][] = [
  [0.1, 2, 1.9],
  [0.07, 3, 0.4],
  [0.04, 5, 3.3],
];

/** The oval's distance from the middle, in the stretched frame, at an angle round from east. */
function ovalRadius(angle: number): number {
  let r = 1;
  for (const [amount, turns, phase] of WOBBLES) r += amount * Math.cos(turns * angle - phase);
  return SHORE_RADIUS * r;
}

/** The dam's face stands on this line, north of the middle: the oval's north is further, so the wall cuts a chord off it. */
const FACE_Y = 34;

/** How far a point is from the middle in the lake's own polar frame (x unstretched), and round from east. */
function polar(x: number, y: number): { distance: number; angle: number } {
  const sx = x / STRETCH;
  return { distance: Math.hypot(sx, y), angle: Math.atan2(y, sx) };
}

/** How far the shore is from the middle, in the stretched frame, at an angle: the oval, cut off by the dam's face. */
function shoreRadius(angle: number): number {
  const s = Math.sin(angle);
  const oval = ovalRadius(angle);
  return s > 1e-6 ? Math.min(oval, FACE_Y / s) : oval;
}

/** How far along the face the wall runs from the middle: to where the oval's shore meets the face's line, on whichever side is further. */
const FACE_HALF = ((): number => {
  let half = 0;
  for (let side = 0; side < 2; side++)
    for (let a = Math.PI / 2; a > 0.02 && a < Math.PI - 0.02; a += side === 0 ? -0.0005 : 0.0005) {
      if (FACE_Y / Math.sin(a) >= ovalRadius(a)) {
        half = Math.max(half, Math.abs(Math.cos(a)) * (FACE_Y / Math.sin(a)) * STRETCH);
        break;
      }
    }
  return half;
})();

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
 * The boulders standing in the lake, out of the water (see the pond's): one in the near shallows, which the Shore view
 * looks over, and one off the east shore. Both stand where the bed is shallow, so their domes are not buried deep.
 */
const BOULDERS: readonly { x: number; y: number; radius: number; rise: number }[] = [
  { x: -24, y: -38, radius: 2.2, rise: 1.2 },
  { x: 42, y: -14, radius: 1.9, rise: 1 },
];

/** The bowl's depth at a share of the way out from the middle to the shore, the same all round: a shelf at the edge, as the pond's. */
function bowlDepthAt(out: number): number {
  const k = 1 - out;
  if (k <= 0) return 0;
  return MAX_DEPTH * (1 - (1 - k) * (1 - k)) * Math.min(1, k * 4);
}

/** The bowl's depth under a point, as though nothing stood in it. */
function bowlDepth(x: number, y: number): number {
  return bowlDepthAt(1 - inward(x, y));
}

/**
 * The bed's colour by its depth: sand all the way down, as the pond's is (docs/crystal-2.md, part 4), so the sand's
 * blend ends past the deepest nine and the slate is never reached.
 */
const BED_SHALLOWS = { depth: 8.5, blend: 2.5, bands: 6, beach: 1.04 } as const;

/** How far a boulder's dome goes into the bed under its middle. */
const BOULDER_SUNK = 1;

/** Each boulder's dome, worked out once: the height of its middle (sunk into the bed under it), how high it stands from there and how wide it is at its foot. */
const BOULDER_DOMES = BOULDERS.map((b) => {
  const under = bowlDepth(b.x, b.y) + BOULDER_SUNK;
  const tall = b.rise + under;
  return { x: b.x, y: b.y, base: -under, tall, wide: b.radius / Math.sqrt(1 - (under / tall) ** 2) };
});

/** The rocks' cut, as the pond's. */
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

/** Whether a point is in the water, at least `margin` world units in from the shore and from every boulder. */
function inside(x: number, y: number, margin = 0): boolean {
  return inShore(x, y, margin) && boulderGap(x, y) > margin;
}

/** How deep the bed is under a point: the most in the middle, easing to nothing at the shore, shallower over a boulder's flank, nought on land. */
function bedDepth(x: number, y: number): number {
  return Math.max(0, Math.min(bowlDepth(x, y), -boulderTop(x, y)));
}

/** The smooth step from nought at `a` to one at `b`. */
function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The dam, as content. Nine high over the water on a walkway five deep, the ground behind starting to climb a unit and a half
 * back of the face, the lawn behind holding the walkway's height for six more and falling away over twenty-eight to the banks.
 * Bays of six, a rib every second bay, a low parapet along the water side and a control hut on the walkway a little
 * east of the middle. First guesses, to be tuned by the pictures.
 */
const DAM_SPEC: DamSpec = {
  faceY: FACE_Y,
  half: FACE_HALF,
  ends: 12,
  top: 9,
  crest: 5,
  setBack: 1.5,
  batter: 0.8,
  hold: 6,
  fall: 28,
  bay: 6,
  footing: 0.6,
  ribEvery: 2,
  rib: { wide: 1.2, proud: 0.7 },
  parapet: { high: 0.7, thick: 0.4 },
  hut: { x: 14, wide: 6, high: 3.4 },
};

/** How much of the dam's height stands at an x along it. */
function damHeight(x: number): number {
  return 1 - smooth(DAM_SPEC.half, DAM_SPEC.half + DAM_SPEC.ends, Math.abs(x));
}

/** How much higher the dam makes the ground at a point than the bank alone would be. */
function damRise(x: number, y: number): number {
  const v = y - FACE_Y - DAM_SPEC.setBack;
  if (v <= 0) return 0;
  const h = damHeight(x);
  if (h <= 0) return 0;
  const { top, batter, crest, hold, fall } = DAM_SPEC;
  return top * h * smooth(0, batter, v) * (1 - smooth(crest + hold, crest + hold + fall, v));
}

const DAM: Dam = { spec: DAM_SPEC, rise: damRise, height: damHeight };

/**
 * How high the ground is at a point without the boulders on it: the bed under the water, the bank rising out of it, and
 * the dam standing on that, one surface with no step but the face's short batter.
 */
function groundUnder(x: number, y: number): number {
  if (inward(x, y) > 0) return -bowlDepth(x, y);
  const { distance, angle } = polar(x, y);
  const out = Math.min(1, (distance - shoreRadius(angle)) / BANK_RISE);
  return Math.max(BANK_TOP * out * out * (3 - 2 * out), damRise(x, y));
}

/** How high the ground is at a point with nothing built on it: the bed, the bank and the boulders out of it. */
function bareGround(x: number, y: number): number {
  return inward(x, y) > 0 ? Math.max(-bowlDepth(x, y), boulderTop(x, y)) : groundUnder(x, y);
}

/**
 * Whether a point is where the wall and its walkway stand, or within a half unit of them: no grass, tree or clump is. The
 * name is the Duck Pond's (the cabin and the deck), and means everything built the grass keeps off.
 */
function onWall(x: number, y: number): boolean {
  return Math.abs(x) < DAM_SPEC.half + DAM_SPEC.ends && y > FACE_Y - 0.5 && y < FACE_Y + DAM_SPEC.crest + 0.5;
}

/** The year-round dressing of the banks: more trees than the pond's, round a lake that is bigger. */
const DRESSING = {
  trees: { broadleaf: [16, 29], conifer: [17, 32] } as Record<'broadleaf' | 'conifer', readonly [number, number]>,
  woodland: { count: 330, band: [1.25, 3.1] as const, southBand: [2.3, 3.6] as const },
  pebbles: { scale: [3, 6] as const, sunk: 0.3 },
  clumps: {
    count: 130,
    reach: 2.5,
    clear: 6,
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

/** The seeds and counts the scenery is placed from: the Reservoir's own, so nothing of the pond's moves. */
const SCENERY_FIGURES = {
  seeds: { scene: 2203, dressing: 5531, grass: 2203, boulder: 300, lump: 400 },
  counts: { stones: 100, trees: 36, rocks: 60, clumps: 24, blades: 5 },
  // the banks' rings: fine up the dam's face (a ring at the face, one where the ground starts to climb and one where it has, each on the line y = k times the face's distance), then a few over the walkway and the lawn's fall, then coarser and packed outward
  banks: {
    stops: [
      [0.98, 1, 1],
      [1, 1 + DAM_SPEC.setBack / FACE_Y, 2],
      [1 + DAM_SPEC.setBack / FACE_Y, 1 + (DAM_SPEC.setBack + DAM_SPEC.batter) / FACE_Y, 2],
      [1 + (DAM_SPEC.setBack + DAM_SPEC.batter) / FACE_Y, 1.3, 4],
      [1.3, 2.2, 10],
    ] as readonly (readonly [number, number, number])[],
    to: 8,
  },
} as const;

/** How many fish swim in the Reservoir: sixteen cleans it, each cured in turn. */
const FISH_COUNT = 16;

/** The drums of waste on the bed: three, in the band a lure can reach from the angler's bank. First guesses. */
const DRUMS = {
  count: 3,
  weight: 42,
  seed: 5521,
  where: { distance: [14, 44] as const, bearing: 0.55, depth: [2, 3.6] as const, margin: 2, apart: 8 },
  radius: 1.1,
  height: 1.9,
  // a lake with no cabin has no bank by it to stand a hauled drum on, and draws it nowhere
  bank: [] as readonly { across: number; along: number }[],
} as const;

/** No treasures yet: the other lakes' sets are a later slice. */
const TREASURES = {
  count: 0,
  seed: 0,
  where: { distance: [8, 21] as const, bearing: 0.9, depth: [2, 3.6] as const, margin: 2, apart: 4 },
  bedScale: 1.8,
  shelfScale: 0.28,
  list: [],
} as const;

/** The south shore at the middle, where the angler stands behind. */
const SOUTH = -shoreRadius(-Math.PI / 2);

/** Where the angler stands, in the middle of the south bank. */
const ANGLER = { x: 0, y: SOUTH - 3.5, tipHeight: 8, tipReach: 4 } as const;

/** How far a cast reaches at full power: further than the pond's, since the middle is half as far again. */
const CAST_REACH = 66;

/** The sun's shadow is fitted to the lake and the banks round it, up to the tallest tree standing on the dam's lawn. */
const SHADOW_BOX = {
  min: [-(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, -(SHORE_RADIUS * 1.5 + BANK_RISE), -10] as [
    number,
    number,
    number,
  ],
  max: [
    (SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH,
    SHORE_RADIUS * 1.5 + BANK_RISE,
    DAM_SPEC.top + Math.max(...Object.values(DRESSING.trees).map((r) => r[1])) + 1,
  ] as [number, number, number],
};

/** The camera's places: the pond's, scaled up for a lake half as big again, and the cabin's two (the home's, since the Reservoir has no room of its own). */
const VIEWS: Record<ViewName, View> = {
  shore: { x: 0, y: 6, azimuth: -1.57, polar: 1.3, radius: 100 },
  boat: { x: 12, y: 9, azimuth: -0.9, polar: 1.42, radius: 28 },
  overhead: { x: 0, y: 0, azimuth: -1.57, polar: 0.35, radius: 176 },
  phone: { x: 0, y: 9, azimuth: -1.57, polar: 1.2, radius: 168 },
  cabin: DUCK_POND.views.cabin,
  cabinTall: DUCK_POND.views.cabinTall,
};

/** The cure's count: the fish, and the drums each worth `DRUM_RULES.worth` of them. */
const TOTAL = FISH_COUNT + DRUMS.count * DRUM_RULES.worth;

/** The Reservoir. */
export const RESERVOIR: Lake = {
  id: 'reservoir',
  name: 'the Reservoir',

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
  ground: bareGround,
  bareGround,
  groundUnder,
  // the wall is a built thing, not a rock slope: nothing is a cliff's face or a fall's line, and the grass keeps off the wall through `onCabinOrDeck`
  onFall: () => false,
  onFace: () => false,
  onCabinOrDeck: onWall,

  boulders: BOULDERS,
  domes: BOULDER_DOMES,
  rocks: ROCKS,
  boulderGap,
  nearestBoulder,

  cliff: null,
  jetty: null,
  cabin: null,
  dam: DAM,
  scenery: { ...DRESSING, ...SCENERY_FIGURES },
  shadowBox: SHADOW_BOX,

  fishCount: FISH_COUNT,
  /** Three bream, four perch, three pike, two dawn fish, two eels and two trout, mixed so the first cured are not all of one kind. */
  fishKinds: [1, 0, 2, 3, 1, 4, 0, 1, 5, 2, 0, 1, 3, 4, 2, 5],
  extent: [64, 48],
  fishShore: 4,
  fishShallowest: 0.4,
  fishAboveBed: 0.4,
  angler: ANGLER,
  from: [ANGLER.x, ANGLER.y],
  landAt: [0, SOUTH + 2],
  castReach: CAST_REACH,
  // the cast the pace angler aims: due north at about the power that puts the lure in the middle (the tip stands `tipReach` out from the angler)
  aim: {
    angle: Math.PI / 2,
    power: Math.round((-(ANGLER.y + ANGLER.tipReach) / CAST_REACH) * 100) / 100,
    spread: 0.25,
    powerSpread: 0.08,
  },
  // a bigger water is slower to move
  waterPace: 0.5,

  drums: DRUMS,
  treasures: TREASURES,

  views: VIEWS,
  surface: { rings: 30, segments: 160, spacing: 0.5, near: 48 },

  toClean: FISH_COUNT,
  total: TOTAL,
  contaminationAfter: (cured: number, drums: number): number =>
    Math.max(0, 1 - (cured + drums * DRUM_RULES.worth) / TOTAL),
};
