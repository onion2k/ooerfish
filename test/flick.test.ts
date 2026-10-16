/** The flick detector, fed runs shaped like a hand's, at sixty samples a second. */
import { describe, expect, it } from 'vitest';
import { Flicks } from '../src/flick';

const OPTIONS = { min: 15, rest: 400 };
const DT = 1000 / 60;

/** A run of samples of a magnitude at each step, along one axis; the flicks found and when. */
function run(magnitudes: number[], flicks = new Flicks(OPTIONS), from = 0) {
  const found: { at: number; peak: number }[] = [];
  magnitudes.forEach((m, i) => {
    const t = from + i * DT;
    const f = flicks.sample(t, m, 0, 0);
    if (f) found.push({ at: t, peak: f.peak });
  });
  return found;
}

/** A bump to a peak and back over `n` samples, as a half sine. */
const bump = (peak: number, n = 12) => Array.from({ length: n }, (_, i) => Math.sin(((i + 0.5) / n) * Math.PI) * peak);
const still = (n: number) => Array.from({ length: n }, () => 0);

describe('the flick detector', () => {
  it('gives nothing for a held phone', () => {
    const noise = Array.from({ length: 600 }, (_, i) => 1.5 + 1.4 * Math.sin(i * 1.7));
    expect(run(noise)).toEqual([]);
  });

  it('gives nothing for a slow wave that peaks at ten', () => {
    expect(run([...still(10), ...bump(10, 90), ...still(10)])).toEqual([]);
  });

  it('gives one flick, with its peak, when the magnitude falls back', () => {
    const samples = [...still(10), ...bump(28), ...still(30)];
    const found = run(samples);
    expect(found).toHaveLength(1);
    expect(found[0].peak).toBeCloseTo(28, 0);
    expect(found[0].peak).toBeLessThanOrEqual(28);
    // reported on the fall, after the peak, not on the rise
    expect(found[0].at).toBeGreaterThan((10 + 6) * DT);
  });

  it('reports a flick once, not at every sample', () => {
    expect(run([...still(5), ...bump(40, 30), ...still(5)])).toHaveLength(1);
  });

  it('gives one for two flicks 200 ms apart, and two for 600 ms apart', () => {
    const gap = (ms: number) => still(Math.round(ms / DT));
    expect(run([...bump(28), ...gap(200), ...bump(28), ...gap(100)])).toHaveLength(1);
    expect(run([...bump(28), ...gap(600), ...bump(28), ...gap(100)])).toHaveLength(2);
  });

  it('uses the magnitude of all three axes', () => {
    const f = new Flicks(OPTIONS);
    const out: unknown[] = [];
    [0, 0, 12, 12, 12, 0, 0].forEach((v, i) => out.push(f.sample(i * DT, v, v, v)));
    // 12 on each axis is about 20.8
    const hit = out.find((o) => o !== null) as { peak: number };
    expect(hit.peak).toBeCloseTo(Math.hypot(12, 12, 12), 5);
  });

  it('is not changed by a sample that is not a number', () => {
    const samples = [...still(10), ...bump(28), ...still(30)];
    const clean = run(samples);
    const f = new Flicks(OPTIONS);
    const found: { at: number; peak: number }[] = [];
    samples.forEach((m, i) => {
      if (i === 15) {
        expect(f.sample(i * DT, NaN, 0, 0)).toBeNull();
        expect(f.sample(i * DT, 0, Infinity, 0)).toBeNull();
      }
      const r = f.sample(i * DT, m, 0, 0);
      if (r) found.push({ at: i * DT, peak: r.peak });
    });
    expect(found).toEqual(clean);
  });
});
