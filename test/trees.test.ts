/**
 * The lake's trees, which are the package's low-poly generators coloured by the name of their parts: a few seeded
 * variants of each kind made once at a height of one, a pick of one from a draw, and the colour of each part. Without
 * these a variant could be picked by where a tree stands in a list, so adding one tree would change every tree after
 * it, and a part the palette had no colour for would be drawn in whatever the last one was.
 */
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/palette';
import { BROADLEAVES, CONIFERS, TREE_COLOUR, TREE_ROUGHNESS, VARIANTS, treeBounds, treeFor } from '../src/trees';

describe('the variants', () => {
  it('are four broadleaves and three conifers, made once', () => {
    expect(BROADLEAVES).toHaveLength(4);
    expect(CONIFERS).toHaveLength(3);
    expect(VARIANTS.broadleaf).toBe(BROADLEAVES);
    expect(VARIANTS.conifer).toBe(CONIFERS);
  });

  it('have the parts the palette colours, by name', () => {
    for (const t of BROADLEAVES) expect(t.parts.map((p) => p.name)).toEqual(['trunk', 'leaves', 'crown']);
    for (const t of CONIFERS) expect(t.parts.map((p) => p.name)).toEqual(['trunk', 'leaves']);
    for (const kind of ['broadleaf', 'conifer'] as const)
      for (const t of VARIANTS[kind])
        for (const part of t.parts) {
          expect(PALETTE[TREE_COLOUR[kind][part.name]], `${kind} ${part.name}`).toHaveLength(3);
          expect(TREE_ROUGHNESS[kind][part.name], `${kind} ${part.name}`).toBeGreaterThan(0);
        }
  });

  it('are different from each other, so a wood of them does not repeat itself', () => {
    const shape = (t: (typeof BROADLEAVES)[number]) => Array.from(t.parts[1].mesh.positions.slice(0, 12)).join();
    expect(new Set(BROADLEAVES.map(shape)).size).toBe(BROADLEAVES.length);
    expect(new Set(CONIFERS.map(shape)).size).toBe(CONIFERS.length);
  });

  it('stand on the ground at the origin and are one tall, to be scaled to any height', () => {
    for (const kind of ['broadleaf', 'conifer'] as const)
      VARIANTS[kind].forEach((t, v) => {
        const b = treeBounds(kind, v);
        expect(b.min[2], `${kind} ${v}`).toBeGreaterThanOrEqual(-1e-6);
        expect(b.max[2], `${kind} ${v}`).toBeCloseTo(1, 3);
        // every part's every vertex is inside the bounds, so the bounds are the tree's
        for (const part of t.parts)
          for (let i = 0; i < part.mesh.positions.length; i += 3)
            for (let a = 0; a < 3; a++) {
              expect(part.mesh.positions[i + a]).toBeLessThanOrEqual(b.max[a] + 1e-9);
              expect(part.mesh.positions[i + a]).toBeGreaterThanOrEqual(b.min[a] - 1e-9);
            }
      });
  });

  it('are cheap to draw: a broadleaf a few hundred triangles at most and a conifer under a hundred', () => {
    const tris = (t: (typeof BROADLEAVES)[number]) => t.parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0);
    for (const t of BROADLEAVES) expect(tris(t)).toBeLessThanOrEqual(300);
    for (const t of CONIFERS) expect(tris(t)).toBeLessThanOrEqual(100);
  });
});

describe('a variant picked from a draw', () => {
  it('is a function of the draw alone, the same whenever and in whatever order it is asked', () => {
    const draws = [0.01, 0.2, 0.49, 0.5, 0.77, 0.999, 0.3];
    const first = draws.map(treeFor);
    expect([...draws].reverse().map(treeFor).reverse()).toEqual(first);
    expect(draws.map(treeFor)).toEqual(first);
  });

  it('reaches every variant of both kinds, a half of the draws each kind, over an even grid', () => {
    const N = 7000;
    const seen = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const { tree, variant } = treeFor((i + 0.5) / N);
      seen.set(`${tree}${variant}`, (seen.get(`${tree}${variant}`) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(
      ['broadleaf0', 'broadleaf1', 'broadleaf2', 'broadleaf3', 'conifer0', 'conifer1', 'conifer2'].sort(),
    );
    const broad = [0, 1, 2, 3].reduce((n, v) => n + seen.get(`broadleaf${v}`)!, 0);
    expect(broad / N).toBeCloseTo(0.5, 2);
    for (const v of [0, 1, 2, 3]) expect(seen.get(`broadleaf${v}`)! / N).toBeCloseTo(1 / 8, 2);
    for (const v of [0, 1, 2]) expect(seen.get(`conifer${v}`)! / N).toBeCloseTo(1 / 6, 2);
  });

  it('never names a variant there is not, even at the ends of the draw', () => {
    for (const u of [0, 1e-12, 0.5 - 1e-12, 0.5, 1 - 1e-12]) {
      const { tree, variant } = treeFor(u);
      expect(Number.isInteger(variant)).toBe(true);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(VARIANTS[tree].length);
    }
  });
});

describe('the crown’s colour', () => {
  it('is the broadleaf’s leaves lightened by a third and a bit, as a canopy is lit from above', () => {
    expect(PALETTE.crown).toBeDefined();
    PALETTE.leaves.forEach((c, i) => expect(PALETTE.crown[i]).toBeCloseTo(c * 1.35, 5));
    expect(TREE_COLOUR.broadleaf.crown).toBe('crown');
    expect(TREE_COLOUR.broadleaf.leaves).toBe('leaves');
    expect(TREE_COLOUR.broadleaf.trunk).toBe('trunk');
    expect(TREE_COLOUR.conifer.leaves).toBe('pine');
    expect(TREE_COLOUR.conifer.trunk).toBe('trunk');
  });
});
