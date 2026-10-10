/**
 * The fight: the line out to a hooked fish and how tight it is. Holding the reel winds line in and draws it tighter;
 * letting go eases it, and a pulling fish takes line. The fish pulls and rests in turns by the chance handed in, a
 * sick lake's fish resting less and so pulling more often. A line as tight as it goes for a moment does not snap and
 * lose anything: the fish slips off. Wound in to the shallows below the angler, the fish is landed.
 *
 * Its own sums, and nothing of where the fish is: `Game` steers the fish along the line at its length.
 */
import { FIGHT } from './lake';
import type { Random } from './random';

export type Fight = 'fighting' | 'slipped' | 'landed';

const within = (random: Random, [lo, hi]: readonly [number, number]) => lo + random() * (hi - lo);

export class Line {
  /** How much line is out, in world units, from where the fish will be landed. */
  out = 0;
  /** How tight it is, from slack (0) to as tight as it goes (1). */
  tension = 0;
  /** Whether the fish is pulling, and how long until it rests or pulls again. */
  pulling = false;
  timer = 0;
  /** How long it has been as tight as it goes. */
  over = 0;

  /** A fish hooked `out` from where it will be landed: it runs first, as a hooked fish does. */
  start(out: number, random: Random) {
    this.out = Math.min(FIGHT.spool, Math.max(0, out));
    this.tension = FIGHT.startTension;
    this.over = 0;
    this.pulling = true;
    this.timer = within(random, FIGHT.pull);
  }

  /** On by `dt`, reeling or not, in a lake as sick as `hot` (from nought to one). */
  step(dt: number, reeling: boolean, hot: number, random: Random): Fight {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.pulling = !this.pulling;
      const sick = 1 - (1 - FIGHT.sickRest) * Math.min(1, Math.max(0, hot));
      this.timer = this.pulling ? within(random, FIGHT.pull) : within(random, FIGHT.rest) * sick;
    }
    if (reeling) {
      this.tension += (FIGHT.reelTension + (this.pulling ? FIGHT.pullTension : 0)) * dt;
      this.out -= FIGHT.reel * (this.pulling ? FIGHT.reelPulling : 1) * dt;
    } else {
      this.tension -= (this.pulling ? FIGHT.easePulling : FIGHT.ease) * dt;
      if (this.pulling) this.out += FIGHT.run * dt;
    }
    this.tension = Math.min(1, Math.max(0, this.tension));
    this.out = Math.min(FIGHT.spool, Math.max(0, this.out));
    this.over = this.tension >= 1 ? this.over + dt : 0;
    if (this.over >= FIGHT.slip - 1e-9) return 'slipped';
    if (this.out <= FIGHT.landWithin) return 'landed';
    return 'fighting';
  }
}
