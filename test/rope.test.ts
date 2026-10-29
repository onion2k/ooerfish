/** The line as a rope: pinned at both ends, the right length, sagging at calm, straight when strained, and the same each time. */
import { describe, expect, it } from 'vitest';
import { ROPE } from '../src/lake';
import { Rope } from '../src/rope';
import { seeded } from '../src/random';

const DT = 1 / 60;
const N = ROPE.points;
const A = [0, 0, 5];
const B = [40, 10, 0];
const CHORD = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
const GROUND = -3;
const keep = () => GROUND;

function settled(length: number, steps = 300, a = A, b = B) {
  const rope = new Rope();
  rope.reset(a, b);
  for (let s = 0; s < steps; s++) rope.step(DT, a, b, length, keep);
  return rope;
}

function segment(rope: Rope, i: number) {
  const p = rope.points;
  return Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1], p[i * 3 + 5] - p[i * 3 + 2]);
}

describe('the rope', () => {
  it('has its ends where they are pinned to the bit, and every segment its share of the length once settled', () => {
    const length = CHORD * (1 + ROPE.slack);
    const rope = settled(length);
    const p = rope.points;
    for (let k = 0; k < 3; k++) {
      expect(p[k]).toBe(A[k]);
      expect(p[(N - 1) * 3 + k]).toBe(B[k]);
    }
    for (let i = 0; i < N - 1; i++) expect(Math.abs(segment(rope, i) / (length / (N - 1)) - 1)).toBeLessThan(0.02);
  });

  it('sags below the chord at calm and stays above the keep-out, and is straight at full tension', () => {
    const calm = settled(CHORD * (1 + ROPE.slack));
    const m = Math.floor(N / 2);
    const middle = calm.points[m * 3 + 2];
    const chordMiddle = A[2] + ((B[2] - A[2]) * m) / (N - 1);
    expect(middle).toBeLessThan(chordMiddle - 0.1);
    for (let i = 0; i < N; i++) expect(calm.points[i * 3 + 2]).toBeGreaterThanOrEqual(GROUND);

    const taut = settled(CHORD);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      for (let k = 0; k < 3; k++)
        expect(Math.abs(taut.points[i * 3 + k] - (A[k] + (B[k] - A[k]) * s))).toBeLessThan(CHORD * 0.01);
    }
  });

  it('is held out of the ground when the ground is above the line', () => {
    const rope = new Rope();
    rope.reset(A, B);
    for (let s = 0; s < 300; s++) rope.step(DT, A, B, CHORD * 1.2, () => 2);
    for (let i = 1; i < N - 1; i++) expect(rope.points[i * 3 + 2]).toBeGreaterThanOrEqual(2);
  });

  it('gives the same points from the same inputs', () => {
    const run = () => {
      const rope = new Rope();
      rope.reset(A, B);
      for (let s = 0; s < 500; s++) rope.step(DT, [s * 0.01, 0, 5], B, CHORD * 1.1, keep);
      return Array.from(rope.points);
    };
    expect(run()).toEqual(run());
  });

  it('stays finite and within its length of each end when the ends are moved at random for ten thousand steps', () => {
    const random = seeded(7);
    const a = [0, 0, 5];
    const b = [30, 0, 0];
    const start = [a.slice(), b.slice()];
    const rope = new Rope();
    rope.reset(a, b);
    const length = 60;
    for (let s = 0; s < 10000; s++) {
      for (let k = 0; k < 3; k++) {
        // a walk that pulls back toward its start, so the ends are never further apart than the rope is long
        a[k] += (random() - 0.5) * 2 - (a[k] - start[0][k]) * 0.01;
        b[k] += (random() - 0.5) * 2 - (b[k] - start[1][k]) * 0.01;
      }
      rope.step(DT, a, b, length, keep);
      for (let i = 0; i < N; i++) {
        const x = rope.points[i * 3],
          y = rope.points[i * 3 + 1],
          z = rope.points[i * 3 + 2];
        expect(Number.isFinite(x + y + z)).toBe(true);
        // a hair over, since a few passes do not quite satisfy a rope pulled about
        expect(Math.hypot(x - a[0], y - a[1], z - a[2])).toBeLessThanOrEqual(length * 1.01);
        expect(Math.hypot(x - b[0], y - b[1], z - b[2])).toBeLessThanOrEqual(length * 1.01);
      }
    }
  });

  it('is laid straight again when an end jumps further than the whip', () => {
    const rope = settled(CHORD * 1.08);
    const far = [10, -35, 5];
    const length = Math.hypot(far[0] - B[0], far[1] - B[1], far[2] - B[2]);
    // a jump of more than half the new length, to a chord that is the length: straight, and so it stays
    rope.step(DT, far, B, length, keep);
    const p = rope.points;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      for (let k = 0; k < 3; k++) expect(Math.abs(p[i * 3 + k] - (far[k] + (B[k] - far[k]) * s))).toBeLessThan(0.3);
    }
    // and a small move does not reset it
    const calm = settled(CHORD * 1.08);
    const before = calm.points[(N >> 1) * 3 + 2];
    calm.step(DT, [A[0] + 0.1, A[1], A[2]], B, CHORD * 1.08, keep);
    expect(Math.abs(calm.points[(N >> 1) * 3 + 2] - before)).toBeLessThan(0.2);
  });

  it('makes nothing in a step', () => {
    const rope = settled(CHORD * 1.08, 10);
    const before = rope.points;
    rope.step(DT, A, B, CHORD, keep);
    expect(rope.points).toBe(before);
  });
});
