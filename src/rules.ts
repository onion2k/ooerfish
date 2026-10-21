/**
 * The few rules a lake's content reads and `lake.ts` also holds: kept apart, and imported by both, so that a lake in
 * `lakes/` need not import `lake.ts`, whose types are the lake's own and whose rules the lakes sit beside. `lake.ts`
 * re-exports every name here, so no importer sees a difference.
 */

/** The water's level in the world, the height the falling things die at and the mist lies from. */
export const WATER_LEVEL = 0;

/**
 * The rule halves of the drums of waste (`docs/journal.md`): how many fish's worth of cleaning a hauled drum is, how
 * near the lure must lie on the bed to snag one and the chance a second that it does, how far a snag dips the bobber
 * (against a fish's bite) and rings the water, and how fast hauling fills the meter with the reel held. How many
 * drums there are and where they lie is the lake's.
 */
export const DRUM_RULES = { worth: 2, reach: 2.2, rate: 0.6, dip: 2.2, ring: 1.1, fill: 0.07 } as const;

/**
 * The rule halves of the junk treasures (`docs/junk.md`): a drum's own reach and rate, a lighter dip, a smaller ring, and
 * the drum's slow steady reel at three times its fill, since a treasure is a light thing.
 */
export const TREASURE_RULES = {
  reach: DRUM_RULES.reach,
  rate: DRUM_RULES.rate,
  dip: 1.4,
  ring: 0.8,
  fill: DRUM_RULES.fill * 3,
} as const;
