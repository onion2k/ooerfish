/** The ways of drawing the water, as data: each one's groups. There is one, the water seen into. */
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { FLOW_CLEAR } from 'artshape-render/game/flow';
import { describe, expect, it } from 'vitest';
import { timeNamed } from '../src/look';
import { PALETTE } from '../src/palette';
import { CLEAR, CLEAR_WAVES } from '../src/water/clear';
import { STYLES } from '../src/water/styles';

describe('the ways of drawing the water', () => {
  it('are one, the see-through water, named and labelled', () => {
    expect(STYLES.map((s) => s.name)).toEqual(['clear']);
    for (const s of STYLES) expect(s.label.length).toBeGreaterThan(0);
  });

  it('give one water group, flowing the clear way, at any contamination', () => {
    for (const s of STYLES)
      for (const dirt of [0, 0.5, 1]) {
        const groups = s.groups(dirt);
        expect(groups.length, s.name).toBe(1);
        const [water] = groups;
        expect(water.patterns?.length).toBe(PATTERN_STRIDE);
        expect(water.patterns?.[0], `${s.name}'s flow kind`).toBe(FLOW_CLEAR);
        expect(water.albedo?.every(Number.isFinite)).toBe(true);
        expect(water.mesh.indices.length).toBeGreaterThan(0);
      }
  });

  it('are the same twice for the same contamination, and a different colour for another', () => {
    for (const s of STYLES) {
      expect(s.groups(0.3)[0].albedo).toEqual(s.groups(0.3)[0].albedo);
      expect(s.groups(0.3)[0].albedo).not.toEqual(s.groups(0.7)[0].albedo);
    }
  });

  it('leave the palette nothing that only the opaque waters read', () => {
    for (const key of ['clear', 'sick', 'clearSky', 'sickSky']) expect(key in PALETTE, key).toBe(false);
  });
});

describe('the see-through water', () => {
  const clear = STYLES[0];

  it('is seen through: the fish glow under it, so it has no glow of its surface, and it says how clear it is', () => {
    expect(clear.label).toBe('See-through');
    expect('surfaceGlow' in clear).toBe(false);
    expect(typeof clear.clear).toBe('function');
  });

  it('is murkier the sicker the lake, and as clear as was chosen when clean', () => {
    const at = (dirt: number) => clear.clear(dirt, true, timeNamed('day')).clarity!;
    expect(at(0)).toBeCloseTo(CLEAR.clarity, 10);
    let was = at(0);
    for (let k = 1; k <= 10; k++) {
      const now = at(k / 10);
      expect(now, `clarity at ${k / 10}`).toBeLessThan(was);
      was = now;
    }
    expect(at(1)).toBeGreaterThan(0);
  });

  it('has caustics when they are asked for, and none when they are not', () => {
    expect(clear.clear(0.5, true, timeNamed('day')).caustics).toBeGreaterThan(0);
    expect(clear.clear(0.5, false, timeNamed('day')).caustics).toBe(0);
  });

  it('sparkles by the time of day, in round stars and not the glitter: in the sun the most, and hardly at all by the moon', () => {
    const at = (t: string) => clear.clear(0, true, timeNamed(t));
    for (const t of ['dawn', 'day', 'dusk', 'night']) expect(at(t).glitter, t).toBe(0);
    const bright = (t: string) => at(t).sparkleBright!;
    expect(bright('day')).toBeGreaterThan(bright('dawn'));
    expect(bright('dusk')).toBeGreaterThan(bright('night'));
    expect(bright('night')).toBeLessThan(bright('day') * 0.25);
    expect(at('day').sparkles).toBeGreaterThan(0);
  });

  it('swells, by the waves it says it has, and hands the same to the renderer', () => {
    expect(clear.waves?.length).toBe(4);
    expect(clear.clear(0.3, true, timeNamed('day')).waves).toBe(clear.waves);
  });

  it('is lighter by the camera, toward a blue when clean and a green when sick, with crests and lines of foam', () => {
    const clean = clear.clear(0, true, timeNamed('day')),
      sick = clear.clear(1, true, timeNamed('day'));
    const [r0, g0, b0] = clean.near!;
    expect(b0).toBeGreaterThan(g0);
    expect(g0).toBeGreaterThan(r0);
    const [r1, g1, b1] = sick.near!;
    expect(g1).toBeGreaterThan(b1);
    expect(g1).toBeGreaterThan(r1);
    expect(clean.crestAmount, 'a calm pond has no lighter crests').toBe(0);
    expect(clean.foamWidth2, 'one thin line of foam, no second').toBe(0);
    expect(clean.foamGap).toBeGreaterThan(0);
  });

  it('is the calm painted pond: faint soft ripples, a mirror tinted and kept by the camera, a flat saturated blue, and clear enough to see the bed', () => {
    for (const w of CLEAR_WAVES) {
      expect(w.amplitude, 'a swell under two centimetres').toBeLessThan(0.02);
      expect(w.wavelength, 'and under five metres long').toBeLessThan(5);
    }
    expect(CLEAR_WAVES.length).toBe(4);
    const look = clear.clear(0, true, timeNamed('day'));
    expect(look.mirrorTint).toEqual([0.35, 0.62, 0.92]);
    expect(look.mirrorNear).toBe(0.3);
    expect(look.mirror).toBe(1.2);
    expect(look.nearDistance).toBe(45);
    expect(look.clarity).toBe(0.8);
    expect(look.caustics).toBe(0.12);
    expect(look.crestAmount).toBe(0);
    expect(look.sparkleSize).toBe(9);
    expect(look.sparkles).toBe(0.3);
    expect(look.sparkleBright).toBe(24);
    // the flow is fine, slow and only faintly tilted: 1.2 cells, a tenth of a unit a second
    const [, scale, speed, steepness] = Array.from(clear.groups(0)[0].patterns!.subarray(0, 4));
    expect([scale, speed, steepness].map((v) => Math.round(v * 100) / 100)).toEqual([1.2, 0.12, 0.38]);
    // the water is a darker, richer blue than a turquoise: blue over green over red in the shallows, near and deep
    for (const c of [PALETTE.clearShallow, PALETTE.clearNear, PALETTE.clearDeep]) {
      expect(c[2]).toBeGreaterThan(c[1]);
      expect(c[1]).toBeGreaterThan(c[0]);
    }
    expect(PALETTE.clearDeep).toEqual([0.06, 0.26, 0.52]);
    expect(PALETTE.clearNear).toEqual([0.015, 0.09, 0.3]);
    expect(PALETTE.clearShallow).toEqual([0.08, 0.36, 0.7]);
    // and the bed is a dark slate, which keeps the shallows blue seen through them
    expect(PALETTE.bed).toEqual([0.035, 0.06, 0.11]);
  });

  it('is deep green when sick and deep blue-teal when clean', () => {
    const deep = (dirt: number) => Array.from(clear.groups(dirt)[0].patterns!.subarray(4, 7));
    const [r0, g0, b0] = deep(0);
    expect(b0, 'clean, blue the most').toBeGreaterThan(g0);
    expect(b0).toBeGreaterThan(r0);
    const [r1, g1, b1] = deep(1);
    expect(g1, 'sick, green the most').toBeGreaterThan(b1);
    expect(g1).toBeGreaterThan(r1);
  });
});
