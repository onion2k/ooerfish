/**
 * A fish's body posed along its spine, and its stroke kept by the school. The pose is pure sums, so the shape of a
 * swimming fish is held here headless: where it sits, that its segments join, that the wave runs back along it and
 * grows to the tail, and that it bends into a turn and tilts as it rises. Without these a fish could come apart at a
 * joint, swim backwards through its own wave, or flex as stiffly as the blob it was.
 */
import { describe, expect, it } from 'vitest';
import { School } from '../src/fish';
import { SWIM } from '../src/lake';
import { seeded } from '../src/random';
import { bodyLength, pose, poseFish } from '../src/swim';
import { DT, newGame, settle } from './helpers';

const N = SWIM.segments.length + 1;
const L = bodyLength(SWIM);
const ANCHOR = SWIM.segments[0][0];
const joints = () => new Float64Array(N * 3);
const at = (j: Float64Array, k: number): [number, number, number] => [j[k * 3], j[k * 3 + 1], j[k * 3 + 2]];

/** How far joint `k` lies to the fish's left of the line through the anchor along its heading. */
function left(j: Float64Array, k: number, x: number, y: number, heading: number) {
  return (j[k * 3] - x) * -Math.sin(heading) + (j[k * 3 + 1] - y) * Math.cos(heading);
}

describe("a fish's body, posed", () => {
  it('lies a scaled segment’s length from joint to joint when the fish is scaled, a pike long and a bream small', () => {
    for (const scale of [0.85, 1, 1.35]) {
      const j = joints();
      pose(j, SWIM, 0, 0, -2, 0.7, 0.1, 0.3, 1.1, SWIM.amp, ANCHOR * scale, scale);
      for (let k = 0; k < N - 1; k++) {
        const [ax, ay, az] = at(j, k),
          [bx, by, bz] = at(j, k + 1);
        expect(Math.hypot(ax - bx, ay - by, az - bz)).toBeCloseTo(SWIM.segments[k][0] * scale, 9);
      }
    }
  });

  it('poses a scaled fish’s whole spine scale times as far, nose to tail fin, straight and still', () => {
    const school = new School();
    school.fill(1, seeded(3));
    const long = joints(),
      one = joints();
    school.pace[0] = 0;
    school.turn[0] = 0;
    school.rise[0] = 0;
    school.vigour[0] = 1;
    school.phase[0] = 0;
    poseFish(one, SWIM, school, 0, () => 20, 1);
    poseFish(long, SWIM, school, 0, () => 20, 1.35);
    const span = (j: Float64Array) => Math.hypot(j[0] - j[(N - 1) * 3], j[1] - j[(N - 1) * 3 + 1]);
    expect(span(long) / span(one)).toBeCloseTo(1.35, 1);
  });

  it('is as long as FISH_BODY says, nose to tail', () => {
    expect(L).toBeCloseTo(1.7, 6);
  });

  it('lies straight along its heading, its head’s back where it is, with no stroke and no turn', () => {
    const j = joints();
    const h = 0.7;
    pose(j, SWIM, 3, -4, -1.2, h, 0, 0, 1.3, 0, ANCHOR);
    expect(at(j, 1)).toEqual([expect.closeTo(3, 9), expect.closeTo(-4, 9), expect.closeTo(-1.2, 9)]);
    let d = 0;
    for (let k = 0; k < N; k++) {
      const back = d - ANCHOR;
      expect(j[k * 3]).toBeCloseTo(3 - Math.cos(h) * back, 9);
      expect(j[k * 3 + 1]).toBeCloseTo(-4 - Math.sin(h) * back, 9);
      expect(j[k * 3 + 2]).toBeCloseTo(-1.2, 9);
      if (k < N - 1) d += SWIM.segments[k][0];
    }
  });

  it('keeps every segment joined to the next, its length apart, in any pose', () => {
    const r = seeded(9);
    const j = joints();
    for (let n = 0; n < 200; n++) {
      pose(j, SWIM, 0, 0, -2, r() * 7, (r() - 0.5) * 3.2, (r() - 0.5) * 2.4, r() * 7, r() * 0.4, r() * L);
      for (let k = 0; k < N - 1; k++) {
        const [ax, ay, az] = at(j, k),
          [bx, by, bz] = at(j, k + 1);
        expect(Math.hypot(ax - bx, ay - by, az - bz)).toBeCloseTo(SWIM.segments[k][0], 9);
      }
    }
  });

  it('carries its wave back along the body, swinging least at the head and most at the tail', () => {
    const j = joints();
    const steps = 256;
    const swing = new Array<number>(N).fill(0);
    const peak = new Array<number>(N).fill(0);
    for (let s = 0; s < steps; s++) {
      const phase = (s / steps) * Math.PI * 2;
      pose(j, SWIM, 0, 0, -2, 0, 0, 0, phase, SWIM.amp, ANCHOR);
      for (let k = 0; k < N; k++) {
        const side = left(j, k, 0, 0, 0);
        if (side > swing[k]) {
          swing[k] = side;
          peak[k] = phase;
        }
      }
    }
    expect(swing[1], 'the head’s back is where the fish is').toBeCloseTo(0, 9);
    for (let k = 2; k < N; k++)
      expect(swing[k], `joint ${k} swings more than the one before`).toBeGreaterThan(swing[k - 1]);
    expect(swing[N - 1]).toBeGreaterThan(swing[0]);
    // the tail reaches its crest later in the beat than the middle: the wave runs back, not forward
    const lag = Math.atan2(Math.sin(peak[N - 1] - peak[2]), Math.cos(peak[N - 1] - peak[2]));
    expect(lag).toBeGreaterThan(0.2);
  });

  it('bends into a turn, nose and tail to the inside of the arc it swims', () => {
    const j = joints();
    pose(j, SWIM, 0, 0, -2, 0, 0, 0.8, 0, 0, ANCHOR);
    expect(left(j, N - 1, 0, 0, 0), 'turning left, the tail lies left of the heading').toBeGreaterThan(0.1);
    expect(left(j, 0, 0, 0, 0)).toBeGreaterThan(0);
    pose(j, SWIM, 0, 0, -2, 0, 0, -0.8, 0, 0, ANCHOR);
    expect(left(j, N - 1, 0, 0, 0)).toBeLessThan(-0.1);
  });

  it('tilts its nose up as it pitches up, and hangs nose up when pitched a right angle', () => {
    const j = joints();
    pose(j, SWIM, 0, 0, -2, 0, 0.2, 0, 0, 0, ANCHOR);
    expect(j[2]).toBeGreaterThan(-2);
    expect(j[(N - 1) * 3 + 2]).toBeLessThan(-2);
    pose(j, SWIM, 1, 2, 3, 0.4, Math.PI / 2, 0, 0, 0, L / 2);
    expect(at(j, 0)).toEqual([expect.closeTo(1, 9), expect.closeTo(2, 9), expect.closeTo(3 + L / 2, 9)]);
  });
});

describe("a fish's stroke, kept by the school", () => {
  /** A school of two at rest where they were put, stroked once so its last places are its places. */
  function two() {
    const school = new School();
    school.fill(2, seeded(3));
    school.stroke(DT);
    return school;
  }

  it('beats faster the faster it goes', () => {
    const school = two();
    const p0 = [school.phase[0], school.phase[1]];
    school.x[0] += Math.cos(school.heading[0]) * 1 * DT;
    school.y[0] += Math.sin(school.heading[0]) * 1 * DT;
    school.x[1] += Math.cos(school.heading[1]) * 2 * DT;
    school.y[1] += Math.sin(school.heading[1]) * 2 * DT;
    school.stroke(DT);
    const idle = SWIM.idle * Math.PI * 2 * DT;
    const d0 = school.phase[0] - p0[0] - idle,
      d1 = school.phase[1] - p0[1] - idle;
    expect(d0).toBeGreaterThan(0);
    expect(d1 / d0).toBeCloseTo(2, 6);
  });

  it('eases its bend toward the way it is turning, and only so far', () => {
    const school = two();
    for (let f = 0; f < 120; f++) {
      school.heading[0] += 1.2 * DT;
      school.heading[1] -= 20 * DT;
      school.stroke(DT);
    }
    expect(school.turn[0]).toBeCloseTo(1.2, 2);
    expect(school.turn[1]).toBeCloseTo(-SWIM.maxTurn, 2);
  });

  it('is not moved by a step of no time, as a pause steps the game', () => {
    const school = two();
    school.x[0] += 0.1;
    const was = [school.phase[0], school.turn[0], school.pace[0]];
    school.stroke(0);
    expect([school.phase[0], school.turn[0], school.pace[0]]).toEqual(was);
    const { game } = newGame(1);
    game.step(0);
    for (let i = 0; i < game.fish.count; i++) expect(Number.isFinite(game.fish.pace[i])).toBe(true);
  });

  it('beats harder hooked and pulling, and eases back after', () => {
    const school = two();
    for (let f = 0; f < 240; f++) school.stroke(DT, 1, true);
    expect(school.vigour[1]).toBeCloseTo(SWIM.hooked, 2);
    expect(school.vigour[0]).toBe(1);
    for (let f = 0; f < 240; f++) school.stroke(DT);
    expect(school.vigour[1]).toBeCloseTo(1, 2);
  });

  it('starts afresh when a fish is let in again, with no leap counted from where the last one was', () => {
    const school = two();
    for (let f = 0; f < 60; f++) {
      school.heading[0] += 2 * DT;
      school.stroke(DT, 0, true);
    }
    school.respawn(0, seeded(4));
    school.stroke(DT);
    expect(school.turn[0]).toBe(0);
    expect(school.pace[0]).toBe(0);
    expect(school.vigour[0]).toBe(1);
  });

  it('a hooked fish swings wider than one swimming as fast', () => {
    const school = two();
    const j = joints();
    const widest = () => {
      let most = 0;
      for (let s = 0; s < 64; s++) {
        school.phase[0] = (s / 64) * Math.PI * 2;
        poseFish(j, SWIM, school, 0, () => 10);
        most = Math.max(most, Math.abs(left(j, N - 1, school.x[0], school.y[0], school.heading[0])));
      }
      return most;
    };
    school.pace[0] = 2;
    school.turn[0] = 0;
    const calm = widest();
    school.vigour[0] = SWIM.hooked;
    expect(widest()).toBeGreaterThan(calm * 1.3);
  });

  it('is played the same by the same seed, and differs between fish', () => {
    const a = newGame(5).game,
      b = newGame(5).game;
    settle(a, 600);
    settle(b, 600);
    for (let i = 0; i < a.fish.count; i++) {
      expect(a.fish.phase[i]).toBe(b.fish.phase[i]);
      expect(a.fish.turn[i]).toBe(b.fish.turn[i]);
      expect(Number.isFinite(a.fish.phase[i])).toBe(true);
    }
    expect(a.fish.phase[0]).not.toBe(a.fish.phase[1]);
  });

  it('keeps a fish in the shallows drawn under the surface, dorsal fin and all, where the water is deep enough', () => {
    const school = two();
    school.depth[0] = 0.4;
    const j = joints();
    poseFish(j, SWIM, school, 0, () => 3);
    expect(j[5], 'the spine sinks to keep the fin under').toBeLessThanOrEqual(-SWIM.top + 1e-9);
  });

  it('is drawn lifted clear where the bed rises under its body behind it, and never out of the water', () => {
    const school = two();
    school.x[0] = school.y[0] = school.heading[0] = 0;
    school.depth[0] = 2.5;
    // the bed shelving up behind a fish swimming out over the deep, as the fuzzer found on seed 1 by the north shore
    const bed = (x: number) => (x > 0 ? 3 : 3 + x);
    const j = joints();
    poseFish(j, SWIM, school, 0, bed);
    for (let k = 0; k < N; k++) {
      expect(-j[k * 3 + 2], `joint ${k} over the bed`).toBeLessThan(bed(j[k * 3]));
      expect(j[k * 3 + 2]).toBeLessThan(0);
    }
    expect(j[5], 'the body is lifted, not just the tail').toBeGreaterThan(-2.5);
  });

  it('is drawn in the water, over the sand and under the surface, on a beach only centimetres deep', () => {
    const school = two();
    school.x[0] = school.y[0] = school.heading[0] = 0;
    school.depth[0] = 0.2;
    // a fish in a hand's depth of water, swimming out, with the sand at the water's edge behind it
    const bed = (x: number) => (x < 0 ? 0.03 : 0.3);
    const j = joints();
    poseFish(j, SWIM, school, 0, bed);
    for (let k = 0; k < N; k++) {
      expect(j[k * 3 + 2], `joint ${k} under the surface`).toBeLessThan(0);
      expect(-j[k * 3 + 2], `joint ${k} over the sand`).toBeLessThan(bed(j[k * 3]));
    }
  });
});
