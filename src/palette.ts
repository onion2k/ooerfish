/**
 * Every colour the lake is drawn in, by name, in linear light. One place, so
 * a colour tuned here is the same wherever it is drawn, and a colour that
 * appears nowhere else cannot drift from its neighbours unseen.
 *
 * The look is a picture book's, painted toward a reference on 11 October 2026: deep azure water against dark,
 * quiet greens and greys on the banks, a pale sky, trees and flowers on its banks, and the glow a pretty sick green
 * rather than a frightening one.
 */
export type Colour = [number, number, number];

export const PALETTE = {
  /**
   * The grass of the banks, the ground painted under the blades: the colour they average to from root to tip
   * (`grassGround` of `LUSH`, which a test holds it to), so the gaps between them and the fade past the far distance
   * do not show. A deep, quiet green, dark against the bright water as in the reference.
   */
  grass: [0.06235, 0.18412, 0.03765] as Colour,
  /** The blades of the banks' grass, from the dark of the root, which darkens into the ground, to the lighter tip. */
  bladeBase: [0.03, 0.09, 0.02] as Colour,
  bladeTip: [0.085, 0.25, 0.05] as Colour,
  /** The lake's bed, under the water: a dark slate, so that the shallows seen through the water stay blue and not grey (a dark earth bed had greyed them). */
  bed: [0.035, 0.06, 0.11] as Colour,
  /**
   * The bed in the shallows, a pale sand where the slate gives way (`BED_SHALLOWS` in `lake.ts`): a pale rim under the
   * water that reads as clear shallows, from overhead most of all, and a strip of beach inside the foam line.
   */
  sand: [0.62, 0.56, 0.4] as Colour,
  /** The stones that line the shore, a dark neutral grey. */
  stone: [0.24, 0.24, 0.22] as Colour,
  /** The rocks on the lake's bed, cooler than the bank's stones for lying under blue water. */
  bedRock: [0.3, 0.33, 0.36] as Colour,
  /**
   * The boulders standing in the water, a cooler grey than the bank's stones and dark: a matte chalk lip needs a face
   * darker than it, and the experiments measured the old 0.22 lighting to about 200 of 255, which left the chalk no
   * room (13 October 2026, chosen by the user from the sheet).
   */
  boulder: [0.12, 0.12, 0.115] as Colour,
  /** The pale chalk the painted edge strokes a rock's ridges with: a warm stone, the package's own for rock. */
  chalk: [0.62, 0.55, 0.42] as Colour,
  /** The cliff's chalk, a quarter cooler than the boulders', so the wall's ridges read as the same stone in its shade. */
  chalkCool: [0.49, 0.55, 0.55] as Colour,
  /** The timber's lip, a warm faint tan, the lamplight on a cut edge of wood. */
  chalkWarm: [0.8, 0.66, 0.48] as Colour,
  /**
   * The cliff's rock, a cool dark grey-blue, so it stands behind the lake as a wall and does not glare, and dark for the
   * same reason as the boulders: the chalk of its ridges needs a face to stand against. The wall's steep face sheet
   * reads this colour too, so it darkens with the lumps, which the user saw and chose.
   */
  cliff: [0.11, 0.12, 0.145] as Colour,
  /**
   * The cabin on the north-east bank and the jetty before it, first guesses from the mock the user chose: cream walls, a
   * blue roof, a stone chimney, a brown door, a window lit warm (it glows), weathered planks and darker posts.
   */
  cabinWall: [0.82, 0.76, 0.62] as Colour,
  cabinRoof: [0.2, 0.42, 0.62] as Colour,
  cabinChimney: [0.5, 0.45, 0.42] as Colour,
  cabinDoor: [0.4, 0.26, 0.14] as Colour,
  cabinWindow: [1, 0.85, 0.45] as Colour,
  deck: [0.5, 0.36, 0.22] as Colour,
  post: [0.4, 0.3, 0.18] as Colour,
  /** The waterfalls' water, a pale blue-white, and the foam where it lands. */
  fallWater: [0.7, 0.86, 0.95] as Colour,
  foam: [0.96, 0.99, 1] as Colour,
  /** The waterweed growing up from the bed, muted because it is seen through clearer water. */
  weed: [0.05, 0.16, 0.07] as Colour,
  /** The trees: dark brown bark, and the broadleaf's deep green. */
  trunk: [0.07, 0.045, 0.03] as Colour,
  leaves: [0.04, 0.09, 0.03] as Colour,
  /** The top of a broadleaf's canopy, lit from above: its leaves a third and a bit lighter, as ooergolf's trees are. */
  crown: [0.054, 0.1215, 0.0405] as Colour,
  /** The pines' needles, a darker blue-green than the broadleaf, so a stand of both reads as two trees. */
  pine: [0.02, 0.07, 0.045] as Colour,
  /** The flowers of the banks, a soft warm pink and not a saturated one, as a picture book paints them. */
  flowers: [0.88, 0.5, 0.5] as Colour,
  /** The snow on the rocks in winter (`SNOW` in `lake.ts`): a cool white, a little blue. */
  snow: [0.86, 0.9, 0.96] as Colour,
  /** The frost at a clean lake's edge in winter (`FROST` in `lake.ts`): the snow's white with a little more blue. */
  frost: [0.8, 0.91, 1] as Colour,
  /** The mushrooms, a warm pale tan. */
  mushroom: [0.72, 0.55, 0.36] as Colour,

  /** The see-through water's shallows and deep, cured (a bright turquoise, over the sand, chosen 15 October 2026) and as sick as it gets. */
  clearShallow: [0.1, 0.62, 0.72] as Colour,
  clearDeep: [0.04, 0.42, 0.62] as Colour,
  sickShallow: [0.55, 0.82, 0.3] as Colour,
  sickDeep: [0.07, 0.22, 0.03] as Colour,
  /** What the see-through water lightens toward by the camera, clear (the shallows' own turquoise, so the water at the feet is not darkened) and sick, and toward on its swells' crests. */
  clearNear: [0.1, 0.62, 0.72] as Colour,
  sickNear: [0.4, 0.7, 0.2] as Colour,
  crest: [0.8, 0.97, 1] as Colour,
  /** What the see-through water multiplies the sky it mirrors by: a soft blue, so the reflection is the water's own colour lightened and not the sky's plain pale blue. */
  mirrorTint: [0.35, 0.62, 0.92] as Colour,
  /** The lighter blue the see-through water's fine waves lift its body toward by their slopes: the painted streaks of the reference, whatever the sky is. */
  rippleLight: [0.28, 0.52, 0.88] as Colour,
  /** A splash's droplets, clean and sick. */
  clearSplash: [0.93, 0.98, 1] as Colour,
  sickSplash: [0.86, 1, 0.68] as Colour,
  /** The rod and its line. */
  rod: [0.42, 0.26, 0.14] as Colour,
  line: [0.9, 0.9, 0.85] as Colour,
  /** The line as it tightens on a fish, from its own white through warm and orange to red, in four steps. */
  lineWarm: [1, 0.85, 0.55] as Colour,
  lineHot: [1, 0.55, 0.2] as Colour,
  lineRed: [0.95, 0.15, 0.1] as Colour,
  /** The lure, the bobber, and the preview's dots and ring, over the water and over the bank. */
  lure: [1, 0.45, 0.2] as Colour,
  bobber: [0.92, 0.15, 0.12] as Colour,
  aim: [1, 0.97, 0.88] as Colour,
  aimWater: [1, 0.86, 0.25] as Colour,
  aimBank: [0.92, 0.22, 0.15] as Colour,
  /** The glow of a fish that has eaten the waste. */
  glow: [0.55, 1, 0.3] as Colour,
  /** The sunny bream's glow, a warm yellow, and the pike's, a blue-green. */
  glowBream: [1, 0.85, 0.25] as Colour,
  glowPike: [0.2, 0.9, 0.8] as Colour,
  /** The pink dawn fish's glow, a blush; the lamp eel's, the brightest, a pale green; the two-headed trout's, a cold blue. */
  glowPink: [1, 0.55, 0.75] as Colour,
  glowEel: [0.6, 1, 0.8] as Colour,
  glowTrout: [0.8, 0.9, 1] as Colour,
  /** A drum of waste on the bed: a hazard yellow, the darker bands round it, and the black atom on its lid. */
  drum: [0.95, 0.6, 0.04] as Colour,
  drumBand: [0.5, 0.26, 0.02] as Colour,
  drumAtom: [0.02, 0.02, 0.025] as Colour,
  /** The junk treasures on the bed (`docs/junk.md`): a rusted lure with a bright blade, the yellow Sunny Atom plush with a dark face, a yellow tin lunchbox with a red band and a handle, a yellow badge with a red face, a pale green bottle with a cork, and a yellow duck with an orange bill. */
  lureBody: [0.55, 0.3, 0.15] as Colour,
  lureBlade: [0.82, 0.82, 0.86] as Colour,
  plush: [1, 0.9, 0.35] as Colour,
  plushFace: [0.12, 0.08, 0.08] as Colour,
  lunchbox: [0.98, 0.78, 0.12] as Colour,
  lunchboxBand: [0.9, 0.2, 0.12] as Colour,
  lunchboxHandle: [0.55, 0.55, 0.6] as Colour,
  badge: [0.98, 0.85, 0.2] as Colour,
  badgeFace: [0.9, 0.18, 0.12] as Colour,
  /** A logbook page: water-stained paper, and the ink of its ruled lines. */
  page: [0.9, 0.84, 0.62] as Colour,
  pageInk: [0.08, 0.06, 0.1] as Colour,
  bottle: [0.8, 0.98, 0.9] as Colour,
  bottleCork: [0.62, 0.42, 0.22] as Colour,
  duck: [1, 0.9, 0.12] as Colour,
  duckBill: [1, 0.5, 0.1] as Colour,
  /** A cured fish: a warm gold body, coral fins and the faint warm light they give off. */
  cured: [1, 0.7, 0.22] as Colour,
  curedFin: [1, 0.42, 0.38] as Colour,
  curedGlow: [1, 0.78, 0.42] as Colour,

  /** The sky, straight up and at the horizon, at each time of day. */
  nightZenith: [0.01, 0.015, 0.05] as Colour,
  nightHorizon: [0.05, 0.07, 0.17] as Colour,
  dawnZenith: [0.26, 0.38, 0.72] as Colour,
  dawnHorizon: [0.98, 0.66, 0.52] as Colour,
  dayZenith: [0.55, 0.7, 0.88] as Colour,
  dayHorizon: [0.85, 0.9, 0.95] as Colour,
  duskZenith: [0.2, 0.15, 0.42] as Colour,
  duskHorizon: [0.98, 0.5, 0.34] as Colour,

  /**
   * The sun's light at each time of day; the night's is the moon's. The day's was (2.6, 2.45, 2.2) and is now warmer, as
   * the experiments' light wants (2.9, 2.5, 1.9), which is each channel times 1.115, 1.020 and 0.864; the other times
   * moved by the same factors, so the dawn, the dusk and the moon are each as much warmer as the day.
   */
  moonlight: [0.3123, 0.3469, 0.475] as Colour,
  dawnlight: [2.4538, 1.6837, 1.0795] as Colour,
  daylight: [2.9, 2.5, 1.9] as Colour,
  dusklight: [2.4538, 1.3776, 0.8205] as Colour,
} as const;

/** The palette's shape, every key a colour: a season's palette is one, with the keys it moves written again. */
export type Palette = { readonly [K in keyof typeof PALETTE]: Colour };

/** A colour part of the way from one to another; at nought and one, exactly the one or the other. */
export function mix(a: Colour, b: Colour, k: number): Colour {
  const j = 1 - k;
  return [a[0] * j + b[0] * k, a[1] * j + b[1] * k, a[2] * j + b[2] * k];
}

/**
 * The room inside the cabin, a part to a colour (`ROOM_PARTS` in `cabinroom.ts`): warm timber and plaster, a
 * blue blanket on a white bed, and a lamp and a window that glow. First guesses, as the cabin's were.
 */
export const ROOM_COLOURS = {
  floor: [0.46, 0.31, 0.18] as Colour,
  walls: [0.74, 0.64, 0.47] as Colour,
  ceiling: [0.5, 0.37, 0.24] as Colour,
  bed: [0.38, 0.25, 0.14] as Colour,
  bedding: [0.9, 0.87, 0.8] as Colour,
  blanket: [0.22, 0.42, 0.6] as Colour,
  window: [0.34, 0.22, 0.12] as Colour,
  glass: [1, 0.86, 0.56] as Colour,
  door: [0.42, 0.27, 0.15] as Colour,
  shade: [0.78, 0.34, 0.2] as Colour,
  bulb: [1, 0.9, 0.62] as Colour,
  // the furniture: wood a shade apart, iron, cloth and the small bright things that make a room lived in
  table: [0.52, 0.36, 0.2] as Colour,
  chair: [0.45, 0.3, 0.16] as Colour,
  mug: [0.25, 0.55, 0.55] as Colour,
  stove: [0.16, 0.16, 0.18] as Colour,
  shelf: [0.4, 0.27, 0.15] as Colour,
  books: [0.55, 0.2, 0.18] as Colour,
  jar: [0.5, 0.75, 0.55] as Colour,
  rug: [0.3, 0.5, 0.62] as Colour,
  chest: [0.36, 0.22, 0.12] as Colour,
  frame: [0.3, 0.2, 0.1] as Colour,
  canvas: [0.85, 0.82, 0.7] as Colour,
  peg: [0.28, 0.19, 0.11] as Colour,
  coat: [0.7, 0.5, 0.2] as Colour,
  // the calendar: pale paper under a timber bar, the days gone in a dark ink and today in a warm red
  calendarSheet: [0.9, 0.86, 0.74] as Colour,
  calendarBar: [0.3, 0.2, 0.1] as Colour,
  calendarGone: [0.17, 0.14, 0.12] as Colour,
  calendarToday: [0.85, 0.2, 0.12] as Colour,
  // the map in the picture's frame: the lakes in a map's blue, the dam's bar in dark stone, and the pin in a red apart from the calendar's
  mapWater: [0.28, 0.58, 0.76] as Colour,
  mapDam: [0.13, 0.12, 0.14] as Colour,
  mapPin: [0.78, 0.06, 0.1] as Colour,
  // the season bands down the sheet's left edge, each the colour of its season's leaves or blossom (`SEASON_DRESSING`)
  bandSummer: [0.1, 0.4, 0.08] as Colour,
  bandAutumn: [0.55, 0.3, 0.04] as Colour,
  bandWinter: [0.7, 0.82, 0.95] as Colour,
  bandSpring: [0.85, 0.45, 0.55] as Colour,
  // the calendar's moons: a pale warm dot for a full moon's square and a dark blue-black one for a new moon's
  moonFull: [0.98, 0.94, 0.7] as Colour,
  moonNew: [0.08, 0.1, 0.22] as Colour,
};

/**
 * The sun-shower's rainbow (`docs/weather.md`, part 6), red outermost to violet: soft and picture-book, unlit in the
 * sky. A list apart from `PALETTE`, whose every key is a colour and is walked as one.
 */
export const RAINBOW_COLOURS: readonly Colour[] = [
  [0.9, 0.38, 0.38],
  [0.95, 0.6, 0.3],
  [0.97, 0.85, 0.4],
  [0.5, 0.8, 0.45],
  [0.4, 0.65, 0.9],
  [0.45, 0.45, 0.8],
  [0.65, 0.45, 0.78],
];

/** The moon's disc, a warm pale (`docs/moon.md`), unlit in the sky; at the file's end, apart from the room's colours. */
export const MOON_COLOUR: Colour = [0.95, 0.93, 0.8];
