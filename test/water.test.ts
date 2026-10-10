/** The ways of drawing the water, as data: each one's groups, and the contamination's colour through them. */
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { FLOW_CLEAR, FLOW_RIPPLE, FLOW_WATER } from 'artshape-render/game/flow';
import { describe, expect, it } from 'vitest';
import { timeNamed } from '../src/look';
import { PALETTE } from '../src/palette';
import { STYLES, styleNamed, waterColour } from '../src/water/styles';

describe('the ways of drawing the water', () => {
  it('are named, labelled, and each found by its name', () => {
    expect(STYLES.map((s) => s.name)).toEqual(['open', 'ripple', 'clear']);
    for (const s of STYLES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(styleNamed(s.name)).toBe(s);
    }
  });

  it('refuse a name they do not know, by giving the first', () => {
    expect(styleNamed('lava')).toBe(STYLES[0]);
    expect(styleNamed('')).toBe(STYLES[0]);
  });

  it('each give one water group, flowing in its own way, at any contamination', () => {
    const kinds: Record<string, number> = { open: FLOW_WATER, ripple: FLOW_RIPPLE, clear: FLOW_CLEAR };
    for (const s of STYLES)
      for (const dirt of [0, 0.5, 1]) {
        const groups = s.groups(dirt);
        expect(groups.length, s.name).toBe(1);
        const [water] = groups;
        expect(water.patterns?.length).toBe(PATTERN_STRIDE);
        expect(water.patterns?.[0], `${s.name}'s flow kind`).toBe(kinds[s.name]);
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
});

describe("the contamination's colour", () => {
  it('is sick green when dirty and clear blue when clean', () => {
    expect(waterColour(1)).toEqual(PALETTE.sick);
    expect(waterColour(0)).toEqual(PALETTE.clear);
    const [r, g, b] = waterColour(1);
    expect(g, 'green when dirty').toBeGreaterThan(b);
    expect(g).toBeGreaterThan(r);
    const [, g0, b0] = waterColour(0);
    expect(b0, 'blue when clean').toBeGreaterThan(g0);
  });

  it('moves steadily from one to the other, never past either', () => {
    let was = waterColour(0);
    for (let k = 1; k <= 20; k++) {
      const now = waterColour(k / 20);
      // blue only ever falls and green only ever rises as the lake gets dirtier
      expect(now[2]).toBeLessThanOrEqual(was[2] + 1e-12);
      expect(now[1]).toBeGreaterThanOrEqual(was[1] - 1e-12);
      was = now;
    }
    expect(waterColour(2)).toEqual(waterColour(1));
    expect(waterColour(-1)).toEqual(waterColour(0));
  });
});

describe('the see-through water', () => {
  const clear = styleNamed('clear');

  it('is seen through: it draws no glow on its surface, since the fish glow under it, and says how clear it is', () => {
    expect(clear.label).toBe('See-through');
    expect(clear.surfaceGlow).toBe(false);
    expect(styleNamed('open').surfaceGlow).toBe(true);
    expect(styleNamed('ripple').surfaceGlow).toBe(true);
    expect(clear.clear).toBeDefined();
    expect(styleNamed('open').clear).toBeUndefined();
  });

  it('is murkier the sicker the lake, and as clear as was chosen when clean', () => {
    const at = (dirt: number) => clear.clear!(dirt, true, timeNamed('day')).clarity!;
    expect(at(0)).toBeCloseTo(1.6, 10);
    let was = at(0);
    for (let k = 1; k <= 10; k++) {
      const now = at(k / 10);
      expect(now, `clarity at ${k / 10}`).toBeLessThan(was);
      was = now;
    }
    expect(at(1)).toBeGreaterThan(0);
  });

  it('has caustics when they are asked for, and none when they are not', () => {
    expect(clear.clear!(0.5, true, timeNamed('day')).caustics).toBeGreaterThan(0);
    expect(clear.clear!(0.5, false, timeNamed('day')).caustics).toBe(0);
  });

  it('sparkles by the time of day, in round stars and not the glitter: in the sun the most, and hardly at all by the moon', () => {
    const at = (t: string) => clear.clear!(0, true, timeNamed(t));
    for (const t of ['dawn', 'day', 'dusk', 'night']) expect(at(t).glitter, t).toBe(0);
    const bright = (t: string) => at(t).sparkleBright!;
    expect(bright('day')).toBeGreaterThan(bright('dawn'));
    expect(bright('dusk')).toBeGreaterThan(bright('night'));
    expect(bright('night')).toBeLessThan(bright('day') * 0.25);
    expect(at('day').sparkles).toBeGreaterThan(0);
  });

  it('swells, by the waves it says it has, and hands the same to the renderer', () => {
    expect(clear.waves?.length).toBe(4);
    expect(clear.clear!(0.3, true, timeNamed('day')).waves).toBe(clear.waves);
    expect(styleNamed('open').waves).toBeUndefined();
  });

  it('is lighter by the camera, toward a blue when clean and a green when sick, with crests and lines of foam', () => {
    const clean = clear.clear!(0, true, timeNamed('day')),
      sick = clear.clear!(1, true, timeNamed('day'));
    const [r0, g0, b0] = clean.near!;
    expect(b0).toBeGreaterThan(g0);
    expect(g0).toBeGreaterThan(r0);
    const [r1, g1, b1] = sick.near!;
    expect(g1).toBeGreaterThan(b1);
    expect(g1).toBeGreaterThan(r1);
    expect(clean.crestAmount).toBeGreaterThan(0);
    expect(clean.foamWidth2).toBeGreaterThan(0);
    expect(clean.foamGap).toBeGreaterThan(0);
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
