/**
 * The fight, kept in the zone: a bar with the fish on it and the player's zone beside it, and a meter between them.
 * The fish rests, then darts to a new place on the bar, by the chance handed in, at the figures it is started with
 * (`fightFor`: its size and temper), and a sick lake's fish rests less, so it darts more often. Holding the reel pushes the zone up the bar, and letting go
 * lets it fall back, with a little weight to it. The meter fills while the fish is in the zone and drains while it is
 * out: full, the fish is landed; empty, it slips off, and nothing is lost.
 *
 * The line out follows the meter, so the fish is drawn in along it as the meter fills and swims back out as it
 * drains; its tension is how far the fish is out of the zone, which bends the rod and warms the line. Its own sums,
 * and nothing of where the fish is: `Game` steers the fish along the line at its length.
 */
import { fightFor, type FightFigures } from './fight';
import { FIGHT } from './lake';
import type { Random } from './random';

export type Fight = 'fighting' | 'slipped' | 'landed';

const within = (random: Random, [lo, hi]: readonly [number, number]) => lo + random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Line {
  /** How much line is out, in world units, from where the fish will be landed. */
  out = 0;
  /** How strained it is, from calm (the fish in the zone) to as strained as it goes (1). */
  tension = 0;
  /** Whether the fish is darting, and how long until it darts again, or gives up a dart it cannot finish. */
  pulling = false;
  timer = 0;
  /** The foot of the player's zone on the bar, from nought to one less its width, and how fast it is moving. */
  zone = 0;
  zoneSpeed = 0;
  /** Where the fish is on the bar, from nought to one, and where it is darting to. */
  fishAt = 0.5;
  target = 0.5;
  /** The meter, from slipped (0) to landed (1). */
  meter = 0;
  /** The figures this fight is played by, from `fightFor`; a steady fish of the lightest until one is hooked. */
  figures: FightFigures = fightFor(0, 'steady');
  /** How heavy the fish is for its kind, from the lightest (0) to the heaviest (1). */
  get heft() {
    return this.figures.heft;
  }
  /** How much line would be out with the meter empty, so the line hooked is out at the meter's start. */
  private reach = 0;

  /** A fish hooked `out` from where it will be landed, to be fought by `figures`: it darts first, as a hooked fish runs. */
  start(out: number, figures: FightFigures, random: Random) {
    this.figures = figures;
    this.reach = Math.max(0, out) / (1 - FIGHT.meterStart);
    this.meter = FIGHT.meterStart;
    this.out = Math.min(FIGHT.spool, Math.max(0, out));
    this.zone = 0;
    this.zoneSpeed = 0;
    this.fishAt = within(random, FIGHT.hookedAt);
    this.dart(random);
    this.strain();
  }

  /** On by `dt`, the reel held or not, in a lake as sick as `hot` (from nought to one). */
  step(dt: number, holding: boolean, hot: number, random: Random): Fight {
    // the fish: a dart to its target at its speed, and a rest once it is there or the dart has gone on too long
    this.timer -= dt;
    if (this.pulling) {
      const speed = this.figures.dart;
      const gap = this.target - this.fishAt;
      const by = speed * dt;
      this.fishAt = Math.abs(gap) <= by ? this.target : this.fishAt + Math.sign(gap) * by;
      if (this.fishAt === this.target || this.timer <= 0) {
        this.pulling = false;
        const sick = 1 - (1 - this.figures.sickRest) * clamp(hot, 0, 1);
        this.timer = within(random, this.figures.rest) * sick;
      }
    } else if (this.timer <= 0) this.dart(random);
    this.fishAt = clamp(this.fishAt, 0, 1);

    // the zone: pushed up while held, falling while not, slowed by its own drag and stopped at either end
    this.zoneSpeed += (holding ? this.figures.push : -this.figures.fall) * dt;
    this.zoneSpeed *= Math.pow(FIGHT.drag, dt);
    this.zone += this.zoneSpeed * dt;
    const top = 1 - this.figures.width;
    if (this.zone <= 0 || this.zone >= top) {
      this.zone = clamp(this.zone, 0, top);
      this.zoneSpeed = 0;
    }

    // the meter, and the line out and its strain from it
    this.meter = clamp(this.meter + (this.inZone() ? this.figures.fill : -this.figures.drain) * dt, 0, 1);
    this.out = Math.min(FIGHT.spool, this.reach * (1 - this.meter));
    this.strain();
    if (this.meter >= 1) return 'landed';
    if (this.meter <= 0) return 'slipped';
    return 'fighting';
  }

  /** Whether the fish is in the player's zone. */
  inZone(): boolean {
    return this.fishAt >= this.zone && this.fishAt <= this.zone + this.figures.width;
  }

  /** A new dart: somewhere else on the bar, at least a little way off, and how long it may take. */
  private dart(random: Random) {
    const away = this.figures.dartLeast + random() * (1 - this.figures.dartLeast);
    const up = this.fishAt + away <= 1 && (this.fishAt - away < 0 || random() < 0.5);
    this.target = clamp(up ? this.fishAt + away : this.fishAt - away, this.figures.floor, 1);
    this.pulling = true;
    this.timer = this.figures.dartLongest;
  }

  /** The strain: calm with the fish in the zone, and tighter the further out of it, to as tight as it goes. */
  private strain() {
    const off = Math.max(0, this.zone - this.fishAt, this.fishAt - (this.zone + this.figures.width));
    this.tension = FIGHT.calm + (1 - FIGHT.calm) * Math.min(1, off / FIGHT.strainOver);
  }
}
