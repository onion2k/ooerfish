/** The ways of drawing the water, as data: each one's groups, and the contamination's colour through them. */
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { FLOW_RIPPLE, FLOW_WATER } from 'artshape-render/game/flow';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/palette';
import { STYLES, styleNamed, waterColour } from '../src/water/styles';

describe('the ways of drawing the water', () => {
  it('are named, labelled, and each found by its name', () => {
    expect(STYLES.map((s) => s.name)).toEqual(['open', 'ripple']);
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
    const kinds: Record<string, number> = { open: FLOW_WATER, ripple: FLOW_RIPPLE };
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
