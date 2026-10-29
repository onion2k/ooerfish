import type { Lake, View, ViewName } from './lakes/lake';
import type { Colour } from './palette';

/**
 * The rules of the game, which hold in every lake: the clock, the fight, the fishing, the gear, the kinds, the seasons,
 * the cure's and the heal's shape, and the figures of the splash, the phone and the rung. What is one lake's (its shore,
 * bed, banks, boulders, dressing, fish, finds, views and cure counts) is in `lakes/`, as a `Lake` (`docs/lakes.md`).
 */

export type { Boulder, Notch, TreasureSpec, View, ViewName } from './lakes/lake';

/**
 * How a fish comes to the lure and bites, first guesses to be tuned by playing (and held by the pace gate once it is
 * back): how far off, in plan, a fish may notice a sunk lure, and how far from its own depth; the chance a second it
 * does, and how much a twitch adds to that and for how long; how fast it comes, and how long it may take before it
 * gives up; how near the lure its mouth is when it nibbles; how many nibbles, and the gaps between them; how long the
 * strike's window is; how big the rings a nibble and the bite make on the water; and how long a fish that let go
 * keeps away.
 */
export const FISHING = {
  // measured on 40 seeds of a cast to the middle: a bite in 11.7 s at the median and 23 s at the most; at a reach of
  // 12, a band of 3 and a chance of 0.3, a lake's six fish were too seldom near enough, and one seed in seven waited
  // over a minute; that band of 3 let any fish come to a lure at any depth, and 1.5 holds each kind to its own water,
  // so the sink is the player's choice of which kind to wait for
  reach: 18,
  band: 1.5,
  notice: 0.4,
  twitchBoost: 3,
  twitchLasts: 3,
  comeSpeed: 1.8,
  // twice the time to swim the whole reach: seed 36 had a fish loop by the east boulder for minutes, never reaching it
  comeLongest: 20,
  mouth: 0.6,
  nibbles: [1, 3] as const,
  nibbleGap: [0.7, 1.6] as const,
  window: 0.9,
  // the rings a nibble and the bite make at the bobber, against a pebble's one: the bite's is the lure's own splash
  nibbleRing: 0.3,
  biteRing: 0.6,
  wary: 8,
  // how far up the rain draws the fish, a share of the way to the surface: an estimate, to be tuned in play
  rainLift: 0.5,
} as const;

/**
 * The fight, kept in the zone (`docs/fight.md`): the zone's height on the bar, how hard holding pushes it up and how
 * hard it falls when let go, and the drag on it, a share of its speed kept a second; how fast the meter fills with the
 * fish in the zone and drains with it out, and how full it starts; where on the bar a fish is hooked; how fast a fish
 * darts, in bars a second, and how much faster the heaviest of its kind; the least of a dart, as a share of the bar,
 * the most it may take, and the lowest it darts to, a margin above the zone's top (`fightFor` adds the zone's width), so a zone let fall to the foot of the bar never holds it; how
 * long a fish rests between darts, and what share of its rest a sick lake's fish keeps; the line's strain with the
 * fish in the zone, and how far out of it the strain is at its most; the spool's length; and where in the shallows
 * below the angler a fish is landed, and how near it a landed fish is.
 */
export const FIGHT = {
  // measured on 40 seeds of the pace gate's angler (a quarter of a second late, letting go early as the zone speeds):
  // 120 fish landed of 120, in 20.3 s at the median, 7.9 at the least and 41.8 at the most; on the line alone, a hand
  // 0.4 s late landed every fish but took nearly twice as long, and never holding or always holding lost every fish
  // in 9 to 11 s. At the mock's push of 1.6, drag of 0.25, darts of 0.6 and a zone of 0.25, the late hand swung about
  // the fish and lost all forty
  width: 0.28,
  push: 3,
  fall: 2.4,
  drag: 0.02,
  fill: 0.079,
  drain: 0.118,
  meterStart: 0.3,
  hookedAt: [0.3, 0.7] as const,
  dart: 0.3,
  dartLeast: 0.15,
  dartLongest: 2,
  floor: 0.04,
  rest: [0.6, 1.8] as const,
  sickRest: 0.5,
  calm: 0.3,
  strainOver: 0.4,
  spool: 60,
  landWithin: 1.5,
} as const;

/**
 * How a fish's size shapes its fight (`docs/fight2.md`): each figure is its base in `FIGHT` times one plus the share
 * here times the fish's heft, from the lightest of its kind (0) to the heaviest (1), so a heavy fish darts faster and
 * further, rests less and fills the meter more slowly. Tuned with the balance tool (`npm run balance -- --print`) to
 * the no-gear targets of `docs/fight2.md`, together with `FIGHT.fill` and `FIGHT.drain`; the gear is tuned after.
 */
export const SIZE = {
  dart: 0.32,
  reach: 0.236,
  rest: -0.198,
  fill: -0.037,
} as const;

/**
 * A fish's temper, drawn when it is hooked, in the order calm, steady and feisty: its name, its odds (they sum to
 * one) and what it multiplies the dart's speed, the dart's reach (its least), the rest and the meter's fill by, on top
 * of the size. Feisty heavy fish are the hard ones, because the two multiply. Tuned with `SIZE` to the no-gear targets: calm
 * is clearly the easiest and feisty the hardest, but never hopeless for a heavy fish.
 */
export const TEMPERS = [
  { name: 'calm', odds: 0.25, dart: 0.879, reach: 0.87, rest: 1.183, fill: 1.02 },
  { name: 'steady', odds: 0.5, dart: 1, reach: 1, rest: 1, fill: 1 },
  { name: 'feisty', odds: 0.25, dart: 1.07, reach: 1.176, rest: 0.78, fill: 0.93 },
] as const;

/**
 * The gifts the pond gives as it is cured (`docs/fight2.md`), in the order they come: the cure count that earns each,
 * its id, its name and the words the toast says of it, and the one figure it eases, by a multiplier (`times`) or an
 * amount added (`plus`): the line drains the meter more slowly, the reel lifts the zone faster, the rod widens it, the
 * bobber holds the strike's window open longer and the bait makes fish notice the lure sooner. The gear is worked out
 * from the count cured, so the save holds nothing of it.
 *
 * Each does what its words say, at a size a player notices, as the user chose (`docs/fight2.md`, decision 1, option B
 * over a setting tuned to the balance tool's hand, which took a reel six times as fast and a rod that widened nothing):
 * the line drains the meter 8% slower, the reel lifts the zone a quarter faster, the rod widens it by 0.02 (the fish's
 * floor follows the width, as it always does). The balance tool cannot see the reel, since its careful hand reads the
 * zone's speed and lets go the earlier; a player's hand may. Each is one figure, to be tuned by how it feels in play.
 */
export const GEAR = [
  { id: 'line', at: 2, name: 'a stronger line', words: 'The meter drains more slowly.', figure: 'drain', times: 0.92 },
  { id: 'reel', at: 4, name: 'a faster reel', words: 'Your zone lifts faster.', figure: 'push', times: 1.25 },
  { id: 'rod', at: 6, name: 'a longer rod', words: 'Your zone is wider.', figure: 'width', plus: 0.02 },
  {
    id: 'bobber',
    at: 8,
    name: 'a bigger bobber',
    words: 'The strike window lasts longer.',
    figure: 'window',
    times: 1.4,
  },
  { id: 'bait', at: 10, name: 'tastier bait', words: 'Fish notice the lure sooner.', figure: 'notice', times: 1.5 },
] as const;

/** Who gives the gifts, as the toast names them: the power plant's mascot. */
export const GIFT_GIVER = 'the Sunny Atom';

/**
 * A kind of fish. The optional keys are the odd ones out: `hours`, the stretch of the day (as shares of it, from and to)
 * that the kind is about in, and asleep on the bed outside it; `stretch`, how much longer than the usual its joints are
 * spaced along the spine, the girth being the scale; and `bites`, how many windows it gives a strike, one if unsaid.
 */
export interface Kind {
  readonly id: string;
  readonly name: string;
  readonly weight: readonly [number, number];
  readonly keeps: readonly [number, number];
  readonly scale: number;
  readonly glow: string;
  /** The journal's silly fact, shown once the kind is caught. */
  readonly fact: string;
  readonly hours?: readonly [number, number];
  readonly stretch?: number;
  readonly bites?: number;
}

/**
 * The kinds of fish, in the order a kind is numbered by (`School.kind` is an index into this). Each has its name; the
 * least and most it weighs, in kilograms; the band of the water's depth it keeps to, as shares of the deepest it may
 * swim at its spot (a fish draws its own `keeps` within it); a body scale, one for the glowing perch's length; the name
 * of its glow in the palette, which `lake.ts` does not import; and a fact for the journal. The pond holds the first
 * three, the Reservoir all six. First guesses, tuned in play.
 */
export const KINDS = [
  {
    id: 'bream',
    name: 'sunny bream',
    weight: [0.2, 1] as const,
    keeps: [0.12, 0.3] as const,
    scale: 0.85,
    glow: 'glowBream',
    fact: 'Sunny by name. Sunny by nature. Not very bright.',
  },
  {
    id: 'perch',
    name: 'glowing perch',
    weight: [0.3, 2.4] as const,
    keeps: [0.3, 0.6] as const,
    scale: 1,
    glow: 'glow',
    fact: 'The first to glow and the proudest of it.',
  },
  {
    id: 'pike',
    name: 'pike',
    weight: [1.5, 5] as const,
    keeps: [0.7, 0.9] as const,
    scale: 1.35,
    glow: 'glowPike',
    fact: 'Has never once said sorry.',
  },
  {
    id: 'dawnfish',
    name: 'pink dawn fish',
    weight: [0.4, 1.6] as const,
    keeps: [0.2, 0.45] as const,
    scale: 0.95,
    glow: 'glowPink',
    // the dawn look's band of the day, a quarter of it centred on dawn, so the fish and the sky agree
    hours: [0.125, 0.375] as const,
    fact: 'Pink from blushing. It has never been seen by anyone who was not up early.',
  },
  {
    id: 'eel',
    name: 'lamp eel',
    weight: [0.8, 3] as const,
    keeps: [0.5, 0.8] as const,
    scale: 1.1,
    stretch: 1.7,
    glow: 'glowEel',
    fact: "Lights the postmistress's window at night. She has stopped paying for electricity.",
  },
  {
    id: 'trout',
    name: 'two-headed trout',
    weight: [0.6, 2.2] as const,
    keeps: [0.35, 0.65] as const,
    scale: 1.1,
    glow: 'glowTrout',
    bites: 2,
    fact: 'Two heads, one opinion. They both want the lure.',
  },
] as const satisfies readonly Kind[];

/** The kinds as an index into `KINDS`, by name. */
export const KIND_INDEX = { bream: 0, perch: 1, pike: 2, dawnfish: 3, eel: 4, trout: 5 } as const;

/** Whether a kind is about at that time of day: always, unless it keeps hours and the time is outside them. */
export function awake(kind: Kind, timeOfDay: number): boolean {
  if (!kind.hours) return true;
  return timeOfDay >= kind.hours[0] && timeOfDay <= kind.hours[1];
}

/**
 * A fish's body and its stroke, the chunky toy chosen from the mock sheet with the subtle stroke. The body, nose to
 * tail: each segment's length and its half-width and half-height at its back, after the nose's own; then the tail fin,
 * standing up at the end of the stalk (its length, its half-span, and how deep its fork is cut as a share of its
 * length); and the dorsal fin on the first body segment (from its front, its length and its height above the back).
 * Length and girth are `FISH_BODY`'s, 1.7 by 0.6 by 0.55, so the bite, the hang and the pictures frame it as before.
 * `top` is how far the dorsal fin's tip stands above the spine, which a fish drawn in the shallows is kept under.
 *
 * The stroke is a perch's, a carangiform wave: its swing at the tail a share of the length (`amp`), dying toward the
 * nose to `floor` of it; its wavelength in body lengths; how far a fish goes in a beat, in body lengths (`stride`), and
 * how often it beats standing still (`idle`, a second); how much of its turn it bends into (1 is the arc it swims);
 * the most it turns, in radians a second, and how fast its bend eases to the turn; how much it pitches nose down a unit
 * a second it sinks, and the most; how fast its rise and its pace are eased; how much harder a hooked fish beats while
 * it pulls, and how fast that eases; and how a landed fish flaps on the line, beats a second and the swing's share.
 */
export const SWIM = {
  nose: [0.1, 0.1] as const,
  segments: [
    [0.47, 0.3, 0.275],
    [0.35, 0.29, 0.265],
    [0.28, 0.2, 0.19],
    [0.19, 0.09, 0.1],
  ] as const,
  tail: { length: 0.41, span: 0.4, notch: 0.3 },
  dorsal: { from: 0.04, length: 0.28, height: 0.15 },
  top: 0.45,
  amp: 0.13,
  floor: 0.04,
  wavelength: 1,
  stride: 0.7,
  idle: 0.3,
  bend: 1,
  maxTurn: 3,
  turnEase: 5,
  pitch: 0.4,
  maxPitch: 0.3,
  ease: 3,
  hooked: 2.2,
  vigourEase: 3,
  flap: 1.2,
  flapAmp: 0.22,
  secondHead: 0.35,
} as const;

/**
 * The lamp eel's light (`docs/kinds.md`): at night each uncured eel is a point light at its place, lighting the bed round
 * it for `radius` world units and nothing far. First guesses, to be seen by eye.
 */
export const EEL_LIGHT = { radius: 9, intensity: 40 } as const;

/** The most fish a lake may ever hold, which fixes the pools. */
export const FISH_CAPACITY = 32;

/**
 * The year as the wall calendar shows it (`DESIGN.md`'s "The calendar"): four seasons of fourteen days, a square a day in
 * `rows` rows of `columns`. The days gone are darkened and today is marked, and day `days + 1` is the first square again.
 */
export const CALENDAR = { days: 56, rows: 4, columns: 14, seasonDays: 14 } as const;

/**
 * The moon (`docs/moon.md`): a round of eight days, so the year's 56 hold exactly seven and each season two full moons
 * and two new, and the calendar's moons are fixed squares. Day 1 is the full moon, the user's choice, since the night
 * as it was drawn is the full moon's and no night picture's light has to change by it; day 5 is the new. `darkest` is
 * the share of the full moon's light the new moon gives, an estimate. `names` run from the full moon, by phase.
 */
export const MOON = {
  days: 8,
  full: 0,
  new: 4,
  darkest: 0.35,
  /**
   * The disc in the sky: how far from the world's origin along the night's light, and its radius, which is four
   * degrees of sky at that distance (2 x atan(radius / distance)). The renderer's far plane is 1500 (`main.ts`) and
   * the furthest camera, the Reservoir's overhead view, is 176 from the origin, so the disc is at most 1076 from any eye.
   */
  distance: 900,
  radius: 31.4,
  /**
   * Where the disc lies, a unit vector from the origin. It is not the night's light, which is lowered to 25 degrees
   * and cannot be seen from the shore: that view looks 15 degrees down with a 40 degree lens, so its top edge is 4.5
   * degrees above the horizon and a cliff or a ridge fills the sky above the lake. This is the patch of sky that is
   * left, up in the corner over the west bank, at about 2.5 degrees up.
   */
  direction: [-0.4192, 0.9066, 0.048],
  names: [
    'full',
    'waning gibbous',
    'last quarter',
    'waning crescent',
    'new',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
  ],
} as const;

/** The five skies a day can have (`docs/weather.md`). */
export type Weather = (typeof WEATHER.kinds)[number];

/** A pair of numbers that cannot be written to, for the figures that are shared and read every frame. */
function frozenPair(a: number, b: number): readonly [number, number] {
  return Object.freeze([a, b]) as unknown as readonly [number, number];
}

/**
 * The weather (`docs/weather.md`): one of five skies, a pure function of the day as the season and the moon are. `odds`
 * are each season's chance of each kind, in the order of `kinds`, and each row sums to one; day one is always
 * `firstDay`, so the game as drawn before the weather is the first morning's. The later parts' figures (the rain's
 * lift, the fog, the wind, the rainbow) join this beside the odds.
 */
/**
 * The rain's drops (`docs/weather.md`, part 3): small blue-grey discs that fall fast and straight, and live only as long
 * as the fall from the emitters takes, so the pool holds many fewer of them than of a season's slow leaves. First
 * guesses, to be seen in the pictures; the sizes are held under `PARTICLE_POOL` by `test/falling.test.ts`.
 */
const RAIN_DROPS: Falling = {
  colour: [0.72, 0.82, 0.98],
  fade: [0.55, 0.68, 0.9],
  size: 0.13,
  growth: 0,
  life: 1.7,
  lifeSpread: 0.2,
  gravity: 0.85,
  count: 4,
  every: 6,
  drift: [0, 0, 0],
};

export const WEATHER = {
  kinds: ['sunny', 'rain', 'fog', 'shower', 'wind'],
  firstDay: 'sunny',
  odds: {
    summer: [0.55, 0.15, 0.05, 0.15, 0.1],
    autumn: [0.35, 0.25, 0.2, 0.05, 0.15],
    winter: [0.4, 0.15, 0.25, 0, 0.2],
    spring: [0.4, 0.25, 0.1, 0.15, 0.1],
  },
  wind: {
    // the grass's own breeze direction (`BREEZE` in `grass.ts`, which a test holds this to), normalised
    direction: [1 / Math.hypot(1, 0.3), 0.3 / Math.hypot(1, 0.3)] as readonly [number, number],
    // a constant push on a cast in world units a second each second, so a full cast, in the air 0.809 s at the Duck
    // Pond, lands about 4 units off its line: 8 / 0.809 squared is 12.2, taken as 12; an estimate, tuned on the picture
    push: 12,
    // the push as a vector, made once and frozen, since a cast and the page read it every frame
    vector: frozenPair(12 / Math.hypot(1, 0.3), (12 * 0.3) / Math.hypot(1, 0.3)),
    // the page's side (part 3), all estimates: the grass wind's strength is the season's times `gust`, the particles are
    // carried along the push at `drift` world units a second, and the swells' amplitudes are scaled by `waves`
    gust: 2.5,
    drift: 3,
    waves: 1.6,
  },
  /**
   * The sky of each wet weather (part 3): a tint mixed into each look's zenith and horizon (at the brightness of the
   * look it covers, so a grey night is no brighter than a night) by `mix`, the fill light scaled by `ambient`, and the
   * water's sparkles by `sparkle`. Wind and sunny change nothing. Estimates.
   */
  rain: {
    sky: { tint: [0.52, 0.53, 0.55] as Colour, mix: 0.55 },
    sun: 0.35,
    exposure: 0.78,
    ambient: 0.7,
    sparkle: 0.45,
    falling: RAIN_DROPS,
    // in winter rain is the season's snow, at this cadence in place of the season's: 2 every 40 frames is a little
    // heavier than winter's own (2 every 48) and still leaves the pool its room with the falls' mist
    snow: { count: 2, every: 40 },
    // a raindrop's ring on the water: its size beside a pebble's one, and the seconds of stepped time between them. With
    // `CLEAR.ringLife` 3.5 about six are live, half the twelve slots, so half stay the player's
    ring: 0.7,
    ringEvery: 0.6,
  },
  shower: {
    sky: { tint: [0.52, 0.53, 0.55] as Colour, mix: 0.2 },
    sun: 0.85,
    exposure: 0.95,
    ambient: 0.92,
    sparkle: 0.8,
    // the rain's drops at half the cadence: a sun-shower is light
    falling: { ...RAIN_DROPS, every: 12 },
  },
  /**
   * Fog over the whole lake (part 2), as the renderer's volumetric fog is asked for it, by every look: thick enough at
   * the water, and tall enough, to haze the far bank and the fish's glow under the surface; `nightColour` is the
   * colour it scatters at night, when it has little light to scatter. Estimates, to be seen in the pictures.
   */
  fog: {
    sky: { tint: [0.66, 0.67, 0.68] as Colour, mix: 0.6 },
    sun: 0.7,
    exposure: 0.95,
    ambient: 0.85,
    sparkle: 0.5,
    density: 0.008,
    height: 24,
    reach: 120,
    steps: 16,
    colour: [0.72, 0.77, 0.83] as Colour,
    nightColour: [0.04, 0.05, 0.08] as Colour,
    light: 0.9,
    anisotropy: 0,
  },
  /**
   * The sun-shower's rainbow (part 6): seven arcs in a plane facing the lake, centred on the sky `distance` out along
   * `direction` (18 degrees west of north, a little under the horizon, so the arch tops out at about six degrees
   * where the Shore view's frame ends at four and a half: its legs and the crown's edge are what is seen, an estimate to
   * be moved by the pictures), the red one `radius` out from the centre (ten degrees of sky, a diameter of twenty) and
   * each band `band` wide inwards. Seen in a shower at the looks named in `at`.
   */
  rainbow: {
    direction: [-0.25, 0.97, 0] as const,
    distance: 22,
    radius: 17,
    band: 1.2,
    at: ['dawn', 'day', 'dusk'] as const,
  },
} as const;

/** What a weather does to the sky and the water, or null for the two that do nothing (`sunny` and `wind`). */
export function skyOf(
  weather: Weather,
): { sky: { tint: Colour; mix: number }; sun: number; exposure: number; ambient: number; sparkle: number } | null {
  return weather === 'rain' || weather === 'fog' || weather === 'shower' ? WEATHER[weather] : null;
}

/**
 * The year's seasons in order, a row of the calendar each. The year starts in summer, chosen by the user, so the lake as
 * it was drawn before the seasons is summer's and day one is unchanged; then autumn, winter and spring, and the year
 * comes round to summer again.
 */
export const SEASONS = ['summer', 'autumn', 'winter', 'spring'] as const;

/** One of the year's seasons. */
export type Season = (typeof SEASONS)[number];

/**
 * The palette keys a season may move, so a key that is not the palette's is a type error where `season.ts` checks it.
 * The ground under the grass (`grass`) is not among them: it is worked out from the blades, so it cannot disagree.
 */
export type SeasonColour =
  'bladeBase' | 'bladeTip' | 'leaves' | 'crown' | 'pine' | 'flowers' | 'cabinRoof' | 'deck' | 'sand' | 'stone';

/**
 * The snow that lies on the rocks in winter (`docs/winter.md`), first guesses to be tuned by the pictures: a face is
 * snowed when its normal's z is over `facing`, and it lies above `from` of the rock's rise (so the foot stays bare),
 * and the cap is lifted `lift` along each face's normal so it sits clear of the rock and does not fight it in depth.
 */
export const SNOW = { facing: 0.72, from: 0.5, lift: 0.05 } as const;

/**
 * The lace of frost at a clean lake's edge in winter (`docs/winter.md`, part 2), first guesses to be tuned by the
 * pictures: a ring from `inner` to `outer` of the shore's distance, lifted `lift` above the bank, in `segments`
 * round and `rings` across, glowing a little (`glow`) so it reads as frost and not as a pale bank.
 */
export const FROST = { inner: 1.0, outer: 1.07, lift: 0.03, segments: 96, rings: 2, glow: 0.5 } as const;

/**
 * How each season dresses the lake (`docs/seasons.md`, part 2): the palette keys it moves and the colours it moves them
 * to, in linear light, and the height of the grass as a share of summer's. First guesses, tuned by the pictures.
 * Summer moves nothing, so it is the lake as it was drawn before the seasons; winter's white banks are its pale blades
 * and the ground derived from them, its snowy crowns the broadleaf's pale leaves (the pines keep their green).
 */
export interface SeasonDressing {
  palette: Partial<Record<SeasonColour, Colour>>;
  grassHeight: number;
  /** The sky: a tint mixed into each look's zenith, horizon and sun colour by `mix`, and the fill light scaled by `ambient`. */
  sky: { tint: Colour; mix: number };
  ambient: number;
  /** The water: the colours it lightens toward by the camera (clean) and on its crests where it is not the palette's, and the sparkles' brightness as a share of summer's. */
  water: { near?: Colour; crest?: Colour; sparkle: number };
  /** The grass wind's strength, and the swells' amplitude as a share of summer's. */
  breeze: number;
  waves: number;
  /** What falls through the air, or null where nothing does (summer), and the mist that lies on the water, or null where none does. */
  falling: Falling | null;
  mist: Mist | null;
  /** How brightly the fish glow, as a share of summer's: a material's figure and not a colour, so it is not a palette key. */
  glow: number;
}

export { WATER_LEVEL } from './rules';

/**
 * A low mist over the water (`docs/seasons.md`, part 5), as the renderer's volumetric fog is asked for it: the looks it
 * lies at, how thick it is at the water, how deep a layer (the height it is down to a third by), the colour it
 * scatters, the sky it takes, and the steps of the march, which is what it costs. The layer's base is the water's level
 * and is not set here.
 */
export interface Mist {
  at: readonly ('night' | 'dawn' | 'day' | 'dusk')[];
  density: number;
  height: number;
  colour: Colour;
  ambient: number;
  steps: number;
}

/**
 * One kind of falling thing, as the renderer's particles are asked for it (`docs/seasons.md`, part 4): the colour it
 * starts and the one it fades to, its size and growth, how long it lives and how much that varies, how much of
 * gravity it feels (little: it drifts), how many each emitter drops each time, how many game frames pass between one
 * emitter's drops, and the wind that carries it, in world units a second. Its shape is the renderer's: a leaf or a
 * petal tumbles as it falls, and a flake left as the disc is the soft round dot it was.
 */
export interface Falling {
  colour: Colour;
  fade?: Colour;
  shape?: 'leaf' | 'petal';
  size: number;
  growth: number;
  life: number;
  lifeSpread: number;
  gravity: number;
  count: number;
  every: number;
  drift: [number, number, number];
}

/**
 * Where the falling things start: how many emitters are spread over the lake (in a spiral of even
 * cover, `radius` shore radii out at the furthest), how high over the water each is, and how far each scatters its
 * drops. A drop falls at gravity's share to the water and dies there.
 */
export const FALLING = { emitters: 16, radius: 0.8, height: 12, spread: 8 } as const;

/**
 * How many particles the renderer's ring holds. A particle is overwritten when the ring comes round, so the pool must
 * outlast the longest life at the game's rate of emission: the falling things (40 a second, 416 over the longest life
 * of 10.4 s) and the falls' mist (two falls, 144 a second, about 1,500 over it) come to about 1,910, which the ring
 * holds. It is the size it was before the seasons, since a bigger ring moves the slot every droplet's chance is drawn
 * from and so nineteen pictures. A burst of many splashes on top can shorten a flake's last second; that is accepted,
 * since the droplets live under a second and a flake at the end of its fall is near the water.
 */
export const PARTICLE_POOL = 2048;

export const SEASON_DRESSING: Record<Season, SeasonDressing> = {
  summer: {
    palette: {},
    grassHeight: 1,
    sky: { tint: [0, 0, 0], mix: 0 },
    ambient: 1,
    water: { sparkle: 1 },
    breeze: 0.3,
    waves: 1,
    falling: null,
    mist: null,
    glow: 1,
  },
  autumn: {
    palette: {
      leaves: [0.3, 0.09, 0.02],
      crown: [0.55, 0.3, 0.04],
      bladeBase: [0.12, 0.09, 0.02],
      bladeTip: [0.38, 0.28, 0.05],
    },
    grassHeight: 1,
    sky: { tint: [0.98, 0.62, 0.3], mix: 0.38 },
    ambient: 1,
    water: { near: [0.16, 0.5, 0.48], crest: [0.92, 0.9, 0.8], sparkle: 0.85 },
    breeze: 0.5,
    waves: 1.2,
    // russet leaves darkening to brown as they go, tumbling on the stronger breeze
    falling: {
      shape: 'leaf',
      colour: [0.6, 0.24, 0.04],
      fade: [0.22, 0.1, 0.03],
      size: 0.35,
      growth: 0,
      life: 8,
      lifeSpread: 0.3,
      gravity: 0.035,
      count: 2,
      every: 48,
      drift: [0.8, 0.3, 0],
    },
    mist: { at: ['dawn'], density: 0.03, height: 3, colour: [0.9, 0.78, 0.62], ambient: 0.6, steps: 16 },
    glow: 1,
  },
  winter: {
    palette: {
      leaves: [0.6, 0.65, 0.7],
      crown: [0.8, 0.85, 0.9],
      bladeBase: [0.45, 0.5, 0.58],
      bladeTip: [0.8, 0.87, 0.95],
      cabinRoof: [0.85, 0.88, 0.92],
      deck: [0.7, 0.72, 0.75],
      // the beach frosted, the kit's pebbles (the `stone` role) a cold blue-grey, the clumps (`flowers`) a white-pink
      sand: [0.78, 0.76, 0.68],
      stone: [0.4, 0.45, 0.55],
      flowers: [0.96, 0.86, 0.9],
    },
    grassHeight: 0.7,
    sky: { tint: [0.68, 0.82, 1], mix: 0.5 },
    ambient: 1.1,
    water: { near: [0.06, 0.4, 0.7], crest: [0.92, 0.98, 1], sparkle: 1.15 },
    breeze: 0.2,
    waves: 0.8,
    // small white flakes, slower and lighter than the leaves, on a light breeze
    falling: {
      colour: [1, 1, 1],
      fade: [0.8, 0.9, 1],
      size: 0.14,
      growth: 0,
      life: 8,
      lifeSpread: 0.3,
      gravity: 0.028,
      count: 2,
      every: 48,
      drift: [0.25, 0.1, 0],
    },
    mist: { at: ['dawn', 'night'], density: 0.03, height: 3, colour: [0.8, 0.88, 1], ambient: 0.6, steps: 16 },
    // against the white the fish's glow is brought up a quarter, so it still reads
    glow: 1.25,
  },
  spring: {
    palette: {
      leaves: [0.1, 0.3, 0.05],
      crown: [0.85, 0.45, 0.55],
      flowers: [0.95, 0.55, 0.7],
      bladeBase: [0.05, 0.16, 0.03],
      bladeTip: [0.16, 0.42, 0.08],
    },
    grassHeight: 1,
    sky: { tint: [0.8, 0.95, 1], mix: 0.15 },
    ambient: 1.05,
    water: { near: [0.1, 0.68, 0.74], sparkle: 1.1 },
    breeze: 0.35,
    waves: 1,
    // pink petals, small, on a soft breeze
    falling: {
      shape: 'petal',
      colour: [0.95, 0.55, 0.7],
      fade: [0.85, 0.4, 0.55],
      size: 0.16,
      growth: 0,
      life: 8,
      lifeSpread: 0.3,
      gravity: 0.03,
      count: 2,
      every: 48,
      drift: [0.5, 0.2, 0],
    },
    mist: null,
    glow: 1,
  },
};

/**
 * Where the camera stands, in this lake, for a view on a screen of this aspect (width over height): the Shore view takes the phone's
 * framing on a screen taller than it is wide, which the lake's whole width needs, the cabin view its wider lens, and every other view stays as it is.
 * An aspect that is no positive number is not a tall screen.
 */
export function framingFor(lake: Lake, name: ViewName, aspect: number): View {
  const tall = aspect > 0 && aspect < 1;
  if (tall && name === 'shore') return lake.views.phone;
  if (tall && name === 'cabin') return lake.views.cabinTall;
  return lake.views[name];
}

export { DRUM_RULES, TREASURE_RULES } from './rules';

/**
 * How the water heals after a cure (first guesses): the seconds of game time it takes to catch up with the lake, and
 * the step the page draws it in, a part of the whole dirt from sick to clean so that a heal is a few dozen handovers
 * of the water and not one a frame. Said here once, for the game's sums and the page's drawing both.
 */
export const HEAL = { seconds: 30, step: 1 / 480 } as const;

/**
 * The day's clock: how long a day is, in seconds of game time (an estimate, `DESIGN.md` sizes a day at twelve to
 * fifteen minutes of play; tuned once it is played), and where in the day the game starts, at dawn. The clock runs on
 * from there round past midnight, with no end of day until the day has one.
 */
export const CLOCK = {
  daySeconds: 720,
  startsAt: 0.25,
  // how often the clock is saved at the pond, in seconds of game time: a first guess, about seventy writes a day of a
  // few dozen bytes, so a tab lost without a word loses at most this much of the day
  saveEvery: 10,
} as const;

/**
 * The day's end: how long the screen takes to fade to the night while the player yawns, and to fade in again on waking
 * in the cabin, in seconds of time stepped (never the wall clock, so a picture holds still). First guesses, soft and quick.
 */
export const NIGHT = { fadeOut: 1.5, fadeIn: 1 } as const;

/**
 * How many splashes may be live on a lake at once, which fixes the pool and what is drawn of it (how long one is seen
 * is the water's, `CLEAR.ringLife`); and how far from the point asked a pebble dropped somewhere may land.
 */
export const SPLASH_CAPACITY = 12;
export const DROP_NEAR = 8;

/**
 * Where a cured fish is let go: `distance` out from the angler toward the pond's middle, and if that is not on the
 * water (kept `margin` in from the shore, a boulder and the jetty) `step` further out at a time, `steps` times at the
 * most, so the search is bounded; and the size of the splash it makes there, a small one beside a pebble's. A first
 * guess, to be tuned by looking at it.
 */
export const RELEASE = { distance: 5, step: 1.5, steps: 12, margin: 1, splash: 0.4 } as const;

/**
 * A cast: how far it reaches at full power, over the water, in world units; how steeply it is thrown; how fast the
 * lure sinks, in units a second; how far below the bobber the line lets it go; and how far over the bed it stops.
 * First guesses, to be tuned by playing.
 */
export const CAST = {
  launch: (28 * Math.PI) / 180,
  sink: 1.2,
  lineDepth: 5,
  aboveBed: 0.3,
} as const;

/**
 * The frame, in milliseconds, past which the page steps down to the lean rung (no grass) at boot: the
 * frame budget itself. A machine that draws the full rung inside the budget keeps it.
 */
export const RUNG_DOWN_MS = 8;

/**
 * The phone as the rod, first guesses to be tuned on a real phone: how many times a second the screen sends the phone
 * its state; the phone's gamma, in degrees, at which the aim is full, and how far off the camera's heading that aim
 * turns the cast; and the flick's strength, in m/s² without gravity: the least that counts, the one that casts at full
 * power, and the rest in milliseconds after one in which the flick's own ringing is not another.
 */
export const PHONE = {
  stateHz: 30,
  tiltRange: 35,
  aimSpread: 60,
  flickMin: 15,
  flickFull: 35,
  flickRest: 400,
  /** The preview's power while the rod is raised: a guess, since a tilt has no pull to measure it by. */
  previewPower: 0.6,
  /** The weakest cast a flick makes, as a share of full power, for a flick at `flickMin`: a guess. */
  flickLeast: 0.25,
} as const;

/**
 * The photograph (`docs/photo.md`): how many the album holds, how near a fish must be to the camera to count as in frame,
 * and the fixed second the renderer's grain is held at when a photograph is looked at, so the still has the same grain
 * whenever it is drawn. All three are the user's or first guesses.
 */
export const PHOTOS = { most: 12, reach: 60, grain: 7 } as const;

/**
 * The contests (`docs/contests.md`): how many fish stowed in the rain the old fisherman asks for, and how long a run of
 * casts that each landed a fish, with none wasted between. Both are first guesses.
 */
export const CONTESTS = { rain: 3, run: 3 } as const;
