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
  /** The grass of the banks: a deep, quiet green, dark against the bright water as in the reference. */
  grass: [0.045, 0.135, 0.03] as Colour,
  /** The lake's bed, under the water: a near-black mud, so the water over it reads as deep. */
  bed: [0.05, 0.04, 0.035] as Colour,
  /** The stones that line the shore, a dark neutral grey. */
  stone: [0.24, 0.24, 0.22] as Colour,
  /** The rocks on the lake's bed, and the waterweed growing up from it. */
  bedRock: [0.4, 0.4, 0.38] as Colour,
  /** The boulders standing in the water, a cooler grey than the bank's stones. */
  boulder: [0.22, 0.22, 0.21] as Colour,
  weed: [0.16, 0.45, 0.14] as Colour,
  /** The trees: dark brown bark, and the broadleaf's deep green. */
  trunk: [0.07, 0.045, 0.03] as Colour,
  leaves: [0.04, 0.09, 0.03] as Colour,
  /** The pines' needles, a darker blue-green than the broadleaf, so a stand of both reads as two trees. */
  pine: [0.02, 0.07, 0.045] as Colour,
  /** The flowers of the banks, a soft warm pink and not a saturated one, as a picture book paints them. */
  flowers: [0.88, 0.5, 0.5] as Colour,
  /** The mushrooms, a warm pale tan. */
  mushroom: [0.72, 0.55, 0.36] as Colour,

  /**
   * The body colour of the opaque waters (open and lit ripple), as sick as it gets and as clear as it gets: the
   * contamination runs between them. Clear is a deep, dark azure, to sit with the see-through water's.
   */
  sick: [0.16, 0.42, 0.06] as Colour,
  clear: [0, 0.085, 0.21] as Colour,
  /**
   * The sky the open water mirrors is tinted toward these, sick and clear. The sky is pale now, so the clear tint is a
   * deep blue: a pale one would mirror it back and the pond would read white.
   */
  sickSky: [0.7, 0.95, 0.45] as Colour,
  clearSky: [0.02, 0.28, 0.58] as Colour,
  /** The see-through water's shallows and deep, clear (a deep azure) and as sick as it gets. */
  clearShallow: [0.08, 0.36, 0.7] as Colour,
  clearDeep: [0, 0.1, 0.34] as Colour,
  sickShallow: [0.55, 0.82, 0.3] as Colour,
  sickDeep: [0.07, 0.22, 0.03] as Colour,
  /** What the see-through water lightens toward by the camera, clear and sick, and toward on its swells' crests. */
  clearNear: [0.02, 0.12, 0.33] as Colour,
  sickNear: [0.4, 0.7, 0.2] as Colour,
  crest: [0.8, 0.97, 1] as Colour,
  /** What the see-through water multiplies the sky it mirrors by: a light cyan, so the reflection is not the sky's plain pale blue. */
  mirrorTint: [0.5, 0.95, 1.1] as Colour,
  /** A ripple's ring on the water, and a splash's droplets, clean and sick. */
  ripple: [0.82, 0.94, 1] as Colour,
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

  /** The sky, straight up and at the horizon, at each time of day. */
  nightZenith: [0.01, 0.015, 0.05] as Colour,
  nightHorizon: [0.05, 0.07, 0.17] as Colour,
  dawnZenith: [0.26, 0.38, 0.72] as Colour,
  dawnHorizon: [0.98, 0.66, 0.52] as Colour,
  dayZenith: [0.55, 0.7, 0.88] as Colour,
  dayHorizon: [0.85, 0.9, 0.95] as Colour,
  duskZenith: [0.2, 0.15, 0.42] as Colour,
  duskHorizon: [0.98, 0.5, 0.34] as Colour,

  /** The sun's light at each time of day; the night's is the moon's. */
  moonlight: [0.28, 0.34, 0.55] as Colour,
  dawnlight: [2.2, 1.65, 1.25] as Colour,
  daylight: [2.6, 2.45, 2.2] as Colour,
  dusklight: [2.2, 1.35, 0.95] as Colour,
} as const;

/** A colour part of the way from one to another; at nought and one, exactly the one or the other. */
export function mix(a: Colour, b: Colour, k: number): Colour {
  const j = 1 - k;
  return [a[0] * j + b[0] * k, a[1] * j + b[1] * k, a[2] * j + b[2] * k];
}
