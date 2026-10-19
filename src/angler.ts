/**
 * An angler who plays the lake as a careful player does, for the pace gate to time: it casts toward the middle of
 * the lake (a little either way, by its own chance), waits, strikes when the bobber dips and not before, plays a fish
 * on the line by the bar (holds while its zone is below the fish, a reaction late, and lets go early as the zone
 * speeds), stows what it lands, and casts again. A lure on the bank it reels in and casts again.
 *
 * Its chance is its own, so what it decides does not shift what the lake does, and the same seeds play the same day.
 * A midnight yawns it into bed and it wakes in the cabin, from where it goes down to the pond at once, so a run that
 * crosses a night plays on. It does only what a player could: it calls the game's cast, strike, reel and stow, and reads what the page shows.
 */
import type { Game } from './game';
import type { Random } from './random';

/** How late the angler sees the fish on the bar, in frames of a sixtieth: a quarter of a second, a player's reaction. */
export const REACTION = 15;
/** How far ahead it reads the zone's speed: it lets go this many seconds early, so the zone does not swing past. */
const LEAD = 0.15;
/**
 * How long it leaves a sunk lure with no fish at it before reeling in to cast again, in seconds. Each kind keeps to a
 * depth of its own and the lure stops at the line's depth, so a lure left there for ever would wait for a kind that
 * is not in that water; a player lets the lure sink through the bands again, and so does this hand.
 */
export const PATIENCE = 12;
/** The cast it aims: due north from the shore at about the power that reaches the middle, and how far it varies either. */
const AIM = { angle: Math.PI / 2, power: 0.62, spread: 0.25, powerSpread: 0.08 } as const;

/**
 * What a careful hand does on the bar, for the zone at `zone` moving at `speed` and the fish seen at `fishAt`: it holds
 * while the zone's middle, where it will be a moment on, is below the fish. The zone's `width` is the line's own, which a rod
 * widens: centred on the wrong width, the hand would make a gift look like a loss. The fuzzer, the bench and the tests play by
 * it too, so a fight played anywhere is played the same way.
 */
export function careful(zone: number, speed: number, fishAt: number, width: number): boolean {
  return fishAt - (zone + width / 2) - LEAD * speed > 0;
}

export class Angler {
  /** Where the fish was on the bar at the start of each of the last frames of the fight, sized once. */
  private readonly seen = new Float64Array(REACTION + 1);
  private frames = 0;
  /** How long the lure has sunk with no fish at it, in seconds. */
  private waited = 0;

  constructor(
    private readonly game: Game,
    private readonly random: Random,
  ) {}

  /** What the angler does this frame, then the lake on by `dt`. */
  step(dt: number) {
    const g = this.game;
    // a night passed, the angler wakes in the cabin and goes straight down to the pond, as a player at the door would
    if (g.place === 'cabin') g.out();
    const { phase } = g.bite;
    if (phase === 'hooked') this.seen[this.frames++ % this.seen.length] = g.line.fishAt;
    else this.frames = 0;
    if (phase === 'landed') g.stow();
    else if (phase === 'biting') {
      // a heavy dip is a drum of waste snagged on the bed, which it is not fishing for: it reels in and casts again,
      // the pace being the minutes to land fish (a drum is hauled by whoever plays for the cleaning)
      if (g.bite.drum >= 0) g.reelIn();
      else g.strike();
    }
    if (g.bite.phase === 'hooked') {
      // until it has watched the fish for a reaction, it goes by where the fish is now
      const at = this.frames > REACTION ? this.seen[(this.frames - 1 - REACTION) % this.seen.length] : g.line.fishAt;
      g.reel(careful(g.line.zone, g.line.zoneSpeed, at, g.line.figures.width));
    } else g.reel(false);
    this.waited = g.lure.phase === 'sinking' && phase === 'none' ? this.waited + dt : 0;
    if (g.lure.phase === 'lying' || this.waited > PATIENCE) g.reelIn();
    if (g.lure.phase === 'ready')
      g.cast(AIM.angle + (this.random() * 2 - 1) * AIM.spread, AIM.power + (this.random() * 2 - 1) * AIM.powerSpread);
    g.step(dt);
  }
}
