/** The sun-shower's rainbow: seven arcs in the sky opposite the sun, seen in a shower by dawn, day and dusk only. */
import { describe, expect, it } from 'vitest';
import { WEATHER } from '../src/lake';
import { RAINBOW_COLOURS } from '../src/palette';
import { RainbowDraw } from '../src/rainbowdraw';

const size = (m: Float32Array) => Math.hypot(m[0], m[1], m[2]);
const middle = (m: Float32Array) => [m[12], m[13], m[14]];

describe('the rainbow’s groups', () => {
  it('are seven, a colour each in the palette’s order, unlit, with a handful of triangles each', () => {
    const draw = new RainbowDraw();
    const groups = draw.groups('day', 'shower');
    expect(groups).toHaveLength(7);
    expect(RAINBOW_COLOURS).toHaveLength(7);
    groups.forEach((g, i) => {
      expect(g.albedo).toEqual(RAINBOW_COLOURS[i]);
      expect(g.count).toBe(1);
      expect(g.patterns![4]).toBeCloseTo(RAINBOW_COLOURS[i][0], 5);
      expect(g.mesh.indices.length / 3).toBeLessThan(120);
    });
  });

  it('are shown in a shower by dawn, day and dusk, and scaled to nothing at night and in every other weather', () => {
    const draw = new RainbowDraw();
    for (const time of ['dawn', 'day', 'dusk']) {
      for (const g of draw.groups(time, 'shower')) expect(size(g.matrices), time).toBeGreaterThan(0);
      expect(draw.shown(), time).toBe(true);
    }
    for (const [time, weather] of [
      ['night', 'shower'],
      ['day', 'rain'],
      ['day', 'sunny'],
      ['day', 'fog'],
      ['day', 'wind'],
    ] as const) {
      for (const g of draw.groups(time, weather)) expect(size(g.matrices), `${time} ${weather}`).toBe(0);
      expect(draw.shown(), `${time} ${weather}`).toBe(false);
    }
  });

  it('lie far along the rainbow’s direction, at its distance, and face back toward the lake', () => {
    const draw = new RainbowDraw();
    const [d0, d1, d2] = WEATHER.rainbow.direction;
    const l = Math.hypot(d0, d1, d2);
    for (const g of draw.groups('day', 'shower')) {
      const o = middle(g.matrices);
      expect(Math.hypot(...o)).toBeCloseTo(WEATHER.rainbow.distance, 3);
      expect((o[0] * d0 + o[1] * d1 + o[2] * d2) / l / WEATHER.rainbow.distance).toBeCloseTo(1, 5);
      const m = g.matrices;
      expect(m[8] * d0 + m[9] * d1 + m[10] * d2, 'facing the lake').toBeLessThan(0);
    }
  });

  it('are the same matrices for the same inputs, written into the same arrays, so a move allocates none', () => {
    const draw = new RainbowDraw();
    const first = draw.groups('day', 'shower');
    const copy = first.map((g) => [...g.matrices]);
    const again = draw.groups('day', 'shower');
    again.forEach((g, i) => {
      expect(g.matrices).toBe(first[i].matrices);
      expect(g.patterns).toBe(first[i].patterns);
      expect([...g.matrices]).toEqual(copy[i]);
    });
    draw.groups('night', 'shower');
    expect(draw.groups('day', 'shower')[0].matrices).toBe(first[0].matrices);
  });

  it('count their handovers', () => {
    const draw = new RainbowDraw();
    expect(draw.handovers).toBe(0);
    draw.groups('day', 'shower');
    draw.groups('night', 'shower');
    expect(draw.handovers).toBe(2);
  });
});
