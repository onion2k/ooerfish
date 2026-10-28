/**
 * The frost at a clean lake's edge in winter (`docs/winter.md`, part 2): a thin ring on the bank just outside the
 * waterline, never on the water, the same bytes each build, and shown only in winter once the lake is clean.
 */
import { describe, expect, it } from 'vitest';
import { FROST } from '../src/lake';
import { LAKES, HOME } from '../src/lakes';
import { FrostDraw, frostMesh } from '../src/frostdraw';
import { PALETTE } from '../src/palette';

const seasons = ['summer', 'autumn', 'winter', 'spring'] as const;

describe('the frost ring', () => {
  for (const lake of Object.values(LAKES)) {
    it(`lies on ${lake.id}'s bank, outside the waterline and within the outer share, just above the ground`, () => {
      const mesh = frostMesh(lake);
      const p = mesh.positions;
      expect(p.length).toBeGreaterThan(0);
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i],
          y = p[i + 1],
          z = p[i + 2];
        // the vertices are float32, so the ground read back at them differs a little from what they were built at
        const angle = Math.atan2(y, x / lake.stretch);
        const r = Math.hypot(x / lake.stretch, y);
        const share = r / lake.shoreRadius(angle);
        expect(share).toBeGreaterThanOrEqual(FROST.inner - 1e-6);
        expect(share).toBeLessThanOrEqual(FROST.outer + 1e-6);
        // the inner edge is the waterline itself, which counts as the shore; every other vertex is dry
        if (share > FROST.inner + 1e-4) expect(lake.inside(x, y)).toBe(false);
        expect(Math.abs(z - (lake.groundUnder(x, y) + FROST.lift))).toBeLessThan(1e-4);
      }
    });
    it(`is the same mesh object for ${lake.id} each time, and the same bytes when built afresh`, () => {
      expect(frostMesh(lake)).toBe(frostMesh(lake));
      const a = new FrostDraw(lake).groups()[0].mesh;
      const b = new FrostDraw(lake).groups()[0].mesh;
      expect(b).toBe(a);
      expect(Array.from(a.positions)).toEqual(Array.from(frostMesh(lake).positions));
    });
  }

  it('is one group in the frost colour, unlit and faintly glowing, with its matrix sized once', () => {
    const frost = new FrostDraw(HOME);
    const [g] = frost.groups();
    expect(frost.groups()).toHaveLength(1);
    expect(g.albedo).toBe(PALETTE.frost);
    expect(g.patterns).toBeDefined();
    expect(g.matrices).toBe(frost.groups()[0].matrices);
  });

  it('is shown in winter on a clean lake and nowhere else', () => {
    for (const season of seasons)
      for (const clean of [false, true]) {
        const frost = new FrostDraw(HOME);
        const m = frost.groups()[0].matrices;
        frost.show(season, clean);
        const on = season === 'winter' && clean;
        expect(frost.shown()).toBe(on);
        expect(m[0]).toBe(on ? 1 : 0);
        expect(m[5]).toBe(on ? 1 : 0);
        expect(m[10]).toBe(on ? 1 : 0);
        expect(m[15]).toBe(1);
      }
  });

  it('says it changed only when it did, and allocates nothing in showing', () => {
    const frost = new FrostDraw(HOME);
    const m = frost.groups()[0].matrices;
    expect(frost.show('summer', false)).toBe(false);
    expect(frost.show('winter', false)).toBe(false);
    expect(frost.show('winter', true)).toBe(true);
    expect(frost.show('winter', true)).toBe(false);
    expect(frost.show('autumn', true)).toBe(true);
    expect(frost.show('winter', true)).toBe(true);
    expect(frost.show('winter', false)).toBe(true);
    expect(frost.groups()[0].matrices).toBe(m);
  });

  it('counts its handovers', () => {
    const frost = new FrostDraw(HOME);
    expect(frost.handovers).toBe(0);
    frost.groups();
    frost.groups();
    expect(frost.handovers).toBe(2);
  });
});
