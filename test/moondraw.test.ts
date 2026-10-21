/** The moon in the sky: a bright disc and a sky-coloured one slid across it, along the night's light, at night only. */
import { describe, expect, it } from 'vitest';
import { MOON } from '../src/lake';
import { MoonDraw, shadowOffset } from '../src/moondraw';
import { MOON_COLOUR } from '../src/palette';
import { TIMES } from '../src/look';

const night = TIMES.find((t) => t.name === 'night')!;
const sky = { sky: night.horizon };
const R = MOON.radius;

const at = (m: Float32Array) => [m[12], m[13], m[14]];
const size = (m: Float32Array) => Math.hypot(m[0], m[1], m[2]);
const normal = (m: Float32Array) => [m[8] / size(m), m[9] / size(m), m[10] / size(m)];
const unit = (v: number[]) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

describe('the shadow’s offset', () => {
  it('is off the face at full, covering at new and half across at the quarters', () => {
    expect(Math.abs(shadowOffset(0, R))).toBeCloseTo(2 * R, 9);
    expect(shadowOffset(4, R)).toBeCloseTo(0, 9);
    expect(Math.abs(shadowOffset(2, R))).toBeCloseTo(R, 9);
    expect(Math.abs(shadowOffset(6, R))).toBeCloseTo(R, 9);
  });

  it('grows from new to full on either side, and the sides are opposite', () => {
    for (const side of [
      [4, 3, 2, 1, 0],
      [4, 5, 6, 7, 8],
    ]) {
      const offsets = side.map((p) => Math.abs(shadowOffset(p % 8, R)));
      for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
    for (const p of [1, 2, 3]) expect(shadowOffset(p, R)).toBeCloseTo(-shadowOffset(8 - p, R), 9);
  });
});

describe('the moon’s groups', () => {
  it('are two, a bright disc and a shadow in the night sky’s colour, a handful of triangles', () => {
    const draw = new MoonDraw();
    const [moon, shadow] = draw.groups('night', 2, sky);
    expect(moon.count).toBe(1);
    expect(shadow.count).toBe(1);
    expect(moon.mesh.indices.length / 3).toBeLessThan(40);
    expect(moon.patterns![4]).toBeCloseTo(MOON_COLOUR[0], 5);
    expect(shadow.patterns![5]).toBeCloseTo(sky.sky[1], 5);
  });

  it('lie along the moon’s direction at the moon’s distance from the origin, facing back toward the lake', () => {
    const [moon, shadow] = new MoonDraw().groups('night', 4, sky);
    const dir = unit([...MOON.direction]);
    for (const m of [moon.matrices, shadow.matrices]) {
      const p = at(m);
      // the shadow stands a unit nearer the lake than the moon
      expect(Math.abs(Math.hypot(...p) - MOON.distance)).toBeLessThanOrEqual(1.01);
      const d = unit(p);
      for (let i = 0; i < 3; i++) expect(d[i]).toBeCloseTo(dir[i], 2);
      const n = normal(m);
      for (let i = 0; i < 3; i++) expect(n[i]).toBeCloseTo(-dir[i], 5);
    }
    expect(size(moon.matrices)).toBeCloseTo(R, 5);
  });

  it('have the shadow a little nearer the lake than the moon, so it is the one seen', () => {
    const [moon, shadow] = new MoonDraw().groups('night', 4, sky);
    expect(Math.hypot(...at(shadow.matrices))).toBeLessThan(Math.hypot(...at(moon.matrices)));
  });

  it('slide the shadow across the face by the phase: gone at full, covering at new, half at a quarter', () => {
    const draw = new MoonDraw();
    const across = (phase: number) => {
      const [moon, shadow] = draw.groups('night', phase, sky);
      const a = at(moon.matrices),
        b = at(shadow.matrices);
      // along the sky's own line of sight the two differ by the nudge, the rest is the slide
      const n = normal(moon.matrices);
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const along = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      return {
        slide: Math.hypot(d[0] - along * n[0], d[1] - along * n[1], d[2] - along * n[2]),
        scale: size(shadow.matrices),
      };
    };
    expect(across(0).scale).toBe(0);
    expect(across(4).slide).toBeCloseTo(0, 3);
    expect(across(4).scale).toBeGreaterThanOrEqual(R);
    expect(across(2).slide).toBeCloseTo(R, 3);
    expect(across(6).slide).toBeCloseTo(R, 3);
  });

  it('are scaled to nothing at dawn, day and dusk, and the same discs are drawn at night again', () => {
    const draw = new MoonDraw();
    for (const name of ['dawn', 'day', 'dusk']) {
      const groups = draw.groups(name, 4, sky);
      for (const g of groups) expect(size(g.matrices)).toBe(0);
      expect(draw.shown()).toBe(false);
    }
    draw.groups('night', 4, sky);
    expect(draw.shown()).toBe(true);
  });

  it('give the same matrices for the same inputs and others for another phase, written into arrays made once', () => {
    const draw = new MoonDraw();
    const a = draw.groups('night', 6, sky);
    const copy = Array.from(a[1].matrices);
    const b = draw.groups('night', 6, sky);
    expect(Array.from(b[1].matrices)).toEqual(copy);
    expect(b[1].matrices).toBe(a[1].matrices);
    const c = draw.groups('night', 2, sky);
    expect(Array.from(c[1].matrices)).not.toEqual(copy);
  });

  it('count their handovers', () => {
    const draw = new MoonDraw();
    expect(draw.handovers).toBe(0);
    draw.groups('night', 0, sky);
    draw.groups('day', 0, sky);
    expect(draw.handovers).toBe(2);
  });
});
