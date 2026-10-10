/**
 * The lure: ready on the rod, flying a cast's arc, then sinking under its bobber on the water or lying on the bank,
 * until it is reeled in; or in a hooked fish's mouth, where the game puts it. Its flight is the cast's sums (`cast.ts`), so where it is in the air is a time since the
 * cast and nothing kept; on the water it sinks by the step until the line or the bed stops it.
 */
import { flightAt, landingTime } from './cast';
import { CAST, bedDepth, inside } from './lake';

export type LurePhase = 'ready' | 'flying' | 'sinking' | 'lying' | 'hooked';

export class Lure {
  phase: LurePhase = 'ready';
  /** The cast it is on: round the compass, how hard, and when it was thrown. */
  angle = 0;
  power = 0;
  castAt = 0;
  /** How long its flight lasts. */
  flies = 0;
  /** Where it is now, and where its bobber floats once it has landed on the water. */
  readonly at = new Float64Array(3);
  readonly bobber = new Float64Array(2);
  /** How far under the bobber it has sunk, and for how long it has been sinking. */
  depth = 0;
  sunk = 0;

  /** Thrown, from the rod's tip, at the time `t`. */
  cast(angle: number, power: number, t: number) {
    this.phase = 'flying';
    this.angle = angle;
    this.power = Math.min(1, Math.max(0, power));
    this.castAt = t;
    this.flies = landingTime(angle, this.power);
    this.depth = 0;
    this.sunk = 0;
    flightAt(angle, this.power, 0, this.at);
  }

  /** Brought back to the rod, ready to cast again. */
  reelIn() {
    this.phase = 'ready';
    this.depth = 0;
    this.sunk = 0;
  }

  /** On to the time `t`, `dt` after the last; says where it landed this step, if it landed on the water. */
  step(t: number, dt: number): [number, number] | null {
    if (this.phase === 'flying') {
      const since = t - this.castAt;
      flightAt(this.angle, this.power, Math.min(since, this.flies), this.at);
      if (since < this.flies) return null;
      if (inside(this.at[0], this.at[1])) {
        this.phase = 'sinking';
        this.bobber[0] = this.at[0];
        this.bobber[1] = this.at[1];
        this.at[2] = 0;
        // what is left of the step after it landed is spent sinking
        this.sink(since - this.flies);
        return [this.at[0], this.at[1]];
      }
      this.phase = 'lying';
      return null;
    }
    if (this.phase === 'sinking') this.sink(dt);
    return null;
  }

  /** A fish that slipped off lets it go at (x, y), as deep as it was: it sinks on from there under its bobber. */
  freed(x: number, y: number, depth: number) {
    this.phase = 'sinking';
    this.bobber[0] = x;
    this.bobber[1] = y;
    this.depth = Math.max(0, depth);
    this.sink(0);
  }

  /** Sunk on by `dt`, until the line or the bed stops it. */
  private sink(dt: number) {
    const stop = Math.max(0, Math.min(CAST.lineDepth, bedDepth(this.bobber[0], this.bobber[1]) - CAST.aboveBed));
    this.depth = Math.min(stop, this.depth + CAST.sink * dt);
    this.at[0] = this.bobber[0];
    this.at[1] = this.bobber[1];
    this.sunk += dt;
    this.at[2] = -this.depth;
  }
}
