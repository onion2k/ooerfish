/**
 * The fish of a lake, a school of them in fixed arrays: where each is, how
 * deep, which way it is heading and how fast. Each wanders by the seeded
 * chance it is handed, turns back from the shore before it reaches it, and
 * keeps between the surface and the bed; and each keeps its stroke, how it
 * beats, bends and tilts, from how it moved, for the drawing to pose its body
 * by. No more than they are here: the bite, the lure and fleeing are the
 * fishing's, and come with it.
 *
 * Sized once, at the most a lake can hold, so nothing is made while it
 * swims, and a lake with more fish than that is told so by `fill`. The school swims in the lake it is handed (the
 * home's unless told otherwise, until the page hands one over), and reads its shore, bed, boulders and jetty from it.
 */
import { CLOCK, FISH_CAPACITY, KINDS, SWIM, awake } from './lake';
import type { Lake } from './lakes/lake';
import type { Random } from './random';

/** A whole turn, which a beat is and a heading wraps at. */
const TURN = Math.PI * 2;
/** A fish's length, nose to tail, which a beat's stride is counted in. */
const FISH_BODY_LENGTH = SWIM.tail.length + SWIM.segments.reduce((sum, s) => sum + s[0], 0);

/** How fast a fish swims, the least and the most, in world units a second. */
const SPEED: readonly [number, number] = [1.2, 2.8];
/** How hard a fish's heading wanders, in radians a second at the most. */
const WANDER = 1.6;
/** How far ahead a fish looks for the shore, and how fast it turns from it. */
const LOOK = 5;
const TURN_BACK = 2.5;
/** How near a boulder a fish's look ahead may come before it turns away from it, in world units from its waterline. */
const BOULDER_LOOK = 1.5;
/** And the same from the jetty's deck, whose edge a fish turns from as from a boulder's waterline. */
const JETTY_LOOK = 1.5;
/** How fast a fish eases to the depth it is after, a share of the gap a second. */
const SINK = 0.4;

export class School {
  constructor(readonly lake: Lake) {}

  readonly x = new Float64Array(FISH_CAPACITY);
  readonly y = new Float64Array(FISH_CAPACITY);
  /** How far under the surface. */
  readonly depth = new Float64Array(FISH_CAPACITY);
  readonly heading = new Float64Array(FISH_CAPACITY);
  readonly speed = new Float64Array(FISH_CAPACITY);
  /** The depth each is easing toward, as a share of the water under it, so a fish keeps to a depth of its own. */
  readonly keeps = new Float64Array(FISH_CAPACITY);
  /**
   * The stroke, which only the drawing reads: where each fish is in its beat, in radians; how fast it is turning,
   * eased, in radians a second; how fast it is rising, eased; how fast it is going, eased; and how hard it beats, one
   * for swimming. Kept from how each fish actually moved since the last stroke, from where it was then.
   */
  readonly phase = new Float64Array(FISH_CAPACITY);
  readonly turn = new Float64Array(FISH_CAPACITY);
  readonly rise = new Float64Array(FISH_CAPACITY);
  readonly pace = new Float64Array(FISH_CAPACITY);
  readonly vigour = new Float64Array(FISH_CAPACITY).fill(1);
  private readonly lastX = new Float64Array(FISH_CAPACITY);
  private readonly lastY = new Float64Array(FISH_CAPACITY);
  private readonly lastHeading = new Float64Array(FISH_CAPACITY);
  private readonly lastDepth = new Float64Array(FISH_CAPACITY);
  /** Which fish are cured, one for yes: kept in the pond, healthy, and never drawn to the lure. Sized once. */
  readonly cured = new Uint8Array(FISH_CAPACITY);
  /** Each fish's kind, an index into `KINDS`, fixed by its slot and kept when a fish is respawned. Sized once. */
  readonly kind = new Uint8Array(FISH_CAPACITY);
  count = 0;
  /** The fish the bite is steering, which the wander leaves alone; minus one for none. */
  held = -1;

  /**
   * The lake stocked with `n` fish at places in the water chosen by chance, as many as fit, the first `cured` of them
   * cured (a save's count, which may be more than the lake holds). The flags draw no chance, so a seed places the fish
   * where it did, and a refill sets every flag afresh rather than keep the last stocking's.
   */
  fill(n: number, random: Random, cured = 0) {
    this.count = Math.min(n, FISH_CAPACITY);
    for (let i = 0; i < this.count; i++) {
      this.kind[i] = this.lake.fishKinds[i % this.lake.fishKinds.length];
      this.place(i, random);
    }
    this.cured.fill(0);
    this.cured.fill(1, 0, Math.max(0, Math.min(cured, this.count)));
  }

  /**
   * The fish cured on a load, by kind: of each kind the first `perKind[k]` of its slots (a journal's count of what was
   * caught, which cannot cure more than the kind has), and then, if that is fewer than `total`, the rest in slot order,
   * as a save without a journal always was. No more than `total` are cured, and no chance is drawn.
   */
  cureLoaded(perKind: readonly number[], total: number) {
    this.cured.fill(0);
    const want = Math.min(total, this.count);
    const had = new Array<number>(perKind.length).fill(0);
    let n = 0;
    for (let i = 0; i < this.count && n < want; i++) {
      const k = this.kind[i];
      if (had[k] < (perKind[k] ?? 0)) {
        had[k]++;
        this.cured[i] = 1;
        n++;
      }
    }
    for (let i = 0; i < this.count && n < want; i++)
      if (!this.cured[i]) {
        this.cured[i] = 1;
        n++;
      }
  }

  /** Fish `i` let into the lake afresh, somewhere in it by chance: a landed fish's place taken by another, a new one that glows. */
  respawn(i: number, random: Random) {
    if (this.held === i) this.held = -1;
    this.place(i, random);
    this.cured[i] = 0;
  }

  /**
   * Fish `i` cured and put back in the water at (`x`, `y`) facing `heading`. It is not a respawn: its depth and stroke
   * are as they were where the new place allows, so it swims on from where it was let go, and the bite lets go of it if it was the one held.
   */
  cure(i: number, x: number, y: number, heading: number) {
    if (this.held === i) this.held = -1;
    this.cured[i] = 1;
    this.x[i] = x;
    this.y[i] = y;
    this.heading[i] = heading;
    // the new place may be shallower than the one it was landed from, so it is brought to within that place's depths
    const [least, most] = depthRange(x, y, this.lake);
    this.depth[i] = Math.min(most, Math.max(least, this.depth[i]));
  }

  /** How many of the live fish are cured. */
  curedCount(): number {
    let n = 0;
    for (let i = 0; i < this.count; i++) n += this.cured[i];
    return n;
  }

  private place(i: number, random: Random) {
    const { lake } = this;
    let x = 0,
      y = 0;
    // a point well in from the shore; a hundred tries is far more than a lake's shape needs
    for (let tries = 0; tries < 100; tries++) {
      x = (random() * 2 - 1) * lake.extent[0];
      y = (random() * 2 - 1) * lake.extent[1];
      if (lake.inside(x, y, lake.fishShore + 2)) break;
      x = y = 0;
    }
    this.x[i] = x;
    this.y[i] = y;
    this.heading[i] = random() * Math.PI * 2;
    this.speed[i] = SPEED[0] + random() * (SPEED[1] - SPEED[0]);
    // the same one draw as ever, put into the band of the fish's kind
    const [near, far] = KINDS[this.kind[i]].keeps;
    this.keeps[i] = near + random() * (far - near);
    this.depth[i] = depthRange(x, y, lake)[1] * this.keeps[i];
    // a beat of its own, by its place in the school and not by chance, so the stream the seed gives is not moved
    this.phase[i] = (i * 2.399963) % (Math.PI * 2);
    this.turn[i] = this.rise[i] = this.pace[i] = 0;
    this.vigour[i] = 1;
    this.lastX[i] = x;
    this.lastY[i] = y;
    this.lastHeading[i] = this.heading[i];
    this.lastDepth[i] = this.depth[i];
  }

  /**
   * Every fish's stroke on by `dt`, from how it moved since the last: after everything that moves a fish has had its
   * step, the wander, the bite and the fight alike. Fish `hooked`, while it is `pulling`, beats harder.
   */
  stroke(dt: number, hooked = -1, pulling = false) {
    // a step of no time, as a pause takes, moves nothing: a beat counted over it would be a division by nought
    if (!(dt > 0)) return;
    const ease = Math.min(1, SWIM.ease * dt),
      turnEase = Math.min(1, SWIM.turnEase * dt),
      vigourEase = Math.min(1, SWIM.vigourEase * dt);
    const length = FISH_BODY_LENGTH;
    for (let i = 0; i < this.count; i++) {
      const mx = this.x[i] - this.lastX[i],
        my = this.y[i] - this.lastY[i];
      const moved = Math.sqrt(mx * mx + my * my);
      // headings are kept within a half turn either way, so a change is brought back within one by a whole turn
      let dh = this.heading[i] - this.lastHeading[i];
      if (dh > Math.PI) dh -= TURN;
      else if (dh < -Math.PI) dh += TURN;
      // a turn about at the shore is a step's half turn: it is held to the most a fish bends to, not read as a spin
      const turning = Math.max(-SWIM.maxTurn, Math.min(SWIM.maxTurn, dh / dt));
      this.turn[i] += (turning - this.turn[i]) * turnEase;
      this.rise[i] += ((this.lastDepth[i] - this.depth[i]) / dt - this.rise[i]) * ease;
      this.pace[i] += (moved / dt - this.pace[i]) * ease;
      const want = i === hooked && pulling ? SWIM.hooked : 1;
      this.vigour[i] += (want - this.vigour[i]) * vigourEase;
      // a beat each stride's worth of water, and a slow one standing still, quicker the harder it beats
      const beats = (SWIM.idle + moved / dt / (SWIM.stride * length)) * this.vigour[i];
      const phase = this.phase[i] + beats * TURN * dt;
      this.phase[i] = phase >= TURN ? phase - TURN : phase;
      this.lastX[i] = this.x[i];
      this.lastY[i] = this.y[i];
      this.lastHeading[i] = this.heading[i];
      this.lastDepth[i] = this.depth[i];
    }
  }

  /**
   * Every fish on by `dt` seconds. A lift from nought to one raises the depth each eases toward by that share of the way
   * to the surface (the rain's, `docs/weather.md`); the draw each fish made at its place is untouched, so none is made.
   * A kind with hours (`awake`) outside them keeps to the bed whatever the lift, by the time of day handed in.
   */
  step(dt: number, random: Random, lift = 0, timeOfDay: number = CLOCK.startsAt) {
    const { lake } = this;
    const { jetty } = lake;
    for (let i = 0; i < this.count; i++) {
      if (i === this.held) continue;
      let heading = this.heading[i] + (random() * 2 - 1) * WANDER * dt;
      const x = this.x[i],
        y = this.y[i];
      // the shore ahead: turn toward the middle, the harder the nearer it is; a boulder ahead: turn away from its middle
      const ax = x + Math.cos(heading) * LOOK,
        ay = y + Math.sin(heading) * LOOK;
      let away = Number.NaN;
      if (!lake.inShore(ax, ay, lake.fishShore)) away = Math.atan2(-y, -x);
      else if (lake.boulderGap(ax, ay) < BOULDER_LOOK) {
        const b = lake.nearestBoulder(ax, ay);
        away = Math.atan2(y - b.y, x - b.x);
      } else if (jetty && jetty.gap(ax, ay) < JETTY_LOOK) {
        // from the nearest point of the deck, so a fish at its end turns off along it and one at its side turns off across
        const [dx, dy] = jetty.nearestOnDeck(ax, ay);
        away = Math.atan2(y - dy, x - dx);
      }
      if (!Number.isNaN(away)) {
        const off = Math.atan2(Math.sin(away - heading), Math.cos(away - heading));
        heading += Math.sign(off) * Math.min(Math.abs(off), TURN_BACK * dt);
      }
      const nx = x + Math.cos(heading) * this.speed[i] * dt,
        ny = y + Math.sin(heading) * this.speed[i] * dt;
      // a step that would come within half a unit of the shore or a boulder is not taken, and the fish turns about: a
      // turn too slow can never beach it. A step away from whichever it is near is, so long as it comes no nearer the
      // other, so a fish that has come that near swims out again
      if (lake.inside(nx, ny, 0.5) || awayFromLand(lake, x, y, nx, ny)) {
        this.x[i] = nx;
        this.y[i] = ny;
      } else heading += Math.PI;
      this.heading[i] = Math.atan2(Math.sin(heading), Math.cos(heading));
      const [lo, hi] = depthRange(this.x[i], this.y[i], lake);
      // a kind out of its hours sleeps on the bed, the lift of the rain ignored; the rest keep to their band
      const want = awake(KINDS[this.kind[i]], timeOfDay)
        ? Math.min(hi, Math.max(lo, hi * this.keeps[i] * (1 - lift)))
        : hi;
      const depth = this.depth[i] + (want - this.depth[i]) * Math.min(1, SINK * dt);
      // the bed rises under a fish swimming in toward the shore, faster than it eases up: it is kept off it
      this.depth[i] = Math.min(hi, Math.max(lo, depth));
    }
  }
}

/** How fast a fish turns toward where it is steered, in radians a second. */
const TURN_TO = 4;

/**
 * Fish `i` of the school swum toward (`tx`, `ty`) and eased toward `depth`, at `speed`, by the same rules that keep
 * every fish in the water and off the boulders: a step that would beach it is not taken, and it turns about. Says how
 * far it is from the point, in plan, after the step.
 */
export function steerTo(
  school: School,
  i: number,
  tx: number,
  ty: number,
  depth: number,
  speed: number,
  dt: number,
): number {
  const { lake } = school;
  const x = school.x[i],
    y = school.y[i];
  const want = Math.atan2(ty - y, tx - x);
  let heading = school.heading[i];
  const off = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
  heading += Math.sign(off) * Math.min(Math.abs(off), TURN_TO * dt);
  // no further than the point, so it stops there and does not swim round it
  const step = Math.min(speed * dt, Math.hypot(tx - x, ty - y));
  const nx = x + Math.cos(heading) * step,
    ny = y + Math.sin(heading) * step;
  if (lake.inside(nx, ny, 0.5) || awayFromLand(lake, x, y, nx, ny)) {
    school.x[i] = nx;
    school.y[i] = ny;
  } else heading += Math.PI;
  school.heading[i] = Math.atan2(Math.sin(heading), Math.cos(heading));
  const [lo, hi] = depthRange(school.x[i], school.y[i], lake);
  const eased = school.depth[i] + (depth - school.depth[i]) * Math.min(1, SINK * 4 * dt);
  school.depth[i] = Math.min(hi, Math.max(lo, eased));
  return Math.hypot(tx - school.x[i], ty - school.y[i]);
}

/**
 * Whether a step from (`x`, `y`) to (`nx`, `ny`), which comes within half a unit of the shore, a boulder or the deck, is still in
 * the water and goes away from whichever it is near without coming nearer the other. Only asked when the plain test
 * fails, which is seldom, so a step in open water pays for none of it.
 */
function awayFromLand(lake: Lake, x: number, y: number, nx: number, ny: number): boolean {
  if (!lake.inside(nx, ny)) return false;
  const gap = lake.boulderGap(nx, ny);
  const offBoulder = gap > 0.5 || gap > lake.boulderGap(x, y);
  // a lake with no jetty has no deck to keep off
  const deck = lake.jetty;
  const jetty = deck ? deck.gap(nx, ny) : Infinity;
  const offJetty = jetty > 0.5 || jetty > deck!.gap(x, y);
  return offBoulder && offJetty && (lake.inShore(nx, ny, 0.5) || lake.inward(nx, ny) > lake.inward(x, y));
}

/** How deep a fish may swim at a point: below the surface and above the bed, the gap halved where it is shallow. */
export function depthRange(x: number, y: number, lake: Lake): [number, number] {
  const bed = lake.bedDepth(x, y);
  return [Math.min(lake.fishShallowest, bed * 0.25), Math.max(bed * 0.5, bed - lake.fishAboveBed)];
}
