/**
 * An angler who plays the lake as a careful player does, for the pace gate to time: it casts toward the middle of
 * the lake (a little either way, by its own chance), waits, strikes when the bobber dips and not before, plays a fish
 * on the line by the gauge (reels while the line is slack, lets go once it is tight), stows what it lands, and casts
 * again. A lure on the bank it reels in and casts again.
 *
 * Its chance is its own, so what it decides does not shift what the lake does, and the same seeds play the same day.
 * It does only what a player could: it calls the game's cast, strike, reel and stow, and reads what the page shows.
 */
import type { Game } from './game';
import type { Random } from './random';

/** The gauge's marks it plays by: it starts reeling below the first and lets go above the second. */
export const PLAY = { reelBelow: 0.45, letGoAbove: 0.75 } as const;
/** The cast it aims: due north from the shore at about the power that reaches the middle, and how far it varies either. */
const AIM = { angle: Math.PI / 2, power: 0.62, spread: 0.25, powerSpread: 0.08 } as const;

export class Angler {
  constructor(
    private readonly game: Game,
    private readonly random: Random,
  ) {}

  /** What the angler does this frame, then the lake on by `dt`. */
  step(dt: number) {
    const g = this.game;
    const { phase } = g.bite;
    if (phase === 'landed') g.stow();
    else if (phase === 'biting') g.strike();
    if (g.bite.phase === 'hooked') {
      const t = g.line.tension;
      if (t < PLAY.reelBelow) g.reel(true);
      else if (t > PLAY.letGoAbove) g.reel(false);
    } else g.reel(false);
    if (g.lure.phase === 'lying') g.reelIn();
    if (g.lure.phase === 'ready')
      g.cast(AIM.angle + (this.random() * 2 - 1) * AIM.spread, AIM.power + (this.random() * 2 - 1) * AIM.powerSpread);
    g.step(dt);
  }
}
