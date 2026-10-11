/**
 * The lake's scenery as it is drawn: what a scene without the kit holds to, byte for byte as it was before the
 * kit; and, with the kit, that the bed, the weed and the rocks are untouched and the banks wear it where they
 * should: nothing in the water, nothing on the angler, no tree past the sun's shadow, the near bank bare of trees,
 * every card on a layer the kit has. The trees are not the kit's but the package's low-poly generators (`trees.ts`):
 * a variant picked by each tree's own draw, at the height the kit's trees had, and the pebbles and clumps keep the
 * draws they always had. Without these a tree could stand in the lake and no picture-less gate would say.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { GameGroup } from 'artshape-render/game/renderer';
import { ANGLER, SCENERY, STRETCH, ground, inShore, inside, shoreRadius } from '../src/lake';
import { PALETTE } from '../src/palette';
import { SCENERY_ROLES, ROLE_COLOUR, readKit, readManifest, type Kit } from '../src/scenery';
import { DRESSING_SEED, SHADOW_BOX, Scene, footprint, sceneryFigures, treeHeight, type Placement } from '../src/scene';
import { seeded } from '../src/random';
import { TREE_COLOUR, TREE_ROUGHNESS, VARIANTS, treeFor } from '../src/trees';
import { newGame } from './helpers';

const kit: Kit = readKit(
  readManifest(JSON.parse(readFileSync('public/scenery/scenery.json', 'utf8'))),
  (() => {
    const b = readFileSync('public/scenery/scenery.bin');
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  })(),
);

/** FNV-1a over every number a group holds, so a change to one matrix, vertex or colour changes the hash. */
function hashGroups(groups: GameGroup[]): string {
  let h = 0x811c9dc5;
  const feed = (a: ArrayLike<number> | undefined) => {
    if (!a) return;
    const bytes = new Uint8Array(Float64Array.from(Array.from(a)).buffer);
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619) >>> 0;
  };
  for (const g of groups) {
    feed(g.mesh.positions);
    feed(g.mesh.normals);
    feed(g.mesh.uvs);
    feed(g.mesh.indices);
    feed(g.matrices);
    feed(g.albedo);
    feed([g.roughness ?? -1, g.count ?? -1]);
  }
  return `${groups.length}:${h.toString(16)}`;
}

/** The first five groups: the bed, the boulders, the bed rocks, the weed and the banks. */
const GROUND = 5;

describe('a scene without the kit', () => {
  it('is the scene as it was before the kit, every group, matrix and mesh (its colours those of the calm palette)', () => {
    // the hash holds the albedo, so it moved on 11 October 2026 with the palette's dark greens and greys, and again the same day with the bed, rocks and weed under the see-through water, and a third time with the bank painted the colour its blades average to (`PALETTE.grass`), and not with any shape
    expect(hashGroups(new Scene().static())).toBe('8:68efd988');
  });
});

describe('a scene with the kit', () => {
  const plain = new Scene().static();
  const dressed = new Scene().static(kit);

  it('leaves the bed, boulders, rocks, weed and banks exactly as they were', () => {
    for (let i = 0; i < GROUND; i++) {
      expect(dressed[i].matrices).toEqual(plain[i].matrices);
      expect(dressed[i].mesh).toEqual(plain[i].mesh);
      expect(dressed[i].albedo).toEqual(plain[i].albedo);
      expect(dressed[i].roughness).toBe(plain[i].roughness);
    }
  });

  it('has the kit groups after those, and the old stones and puffball trees gone', () => {
    expect(dressed.length).toBeGreaterThan(GROUND);
    for (const old of plain.slice(GROUND)) expect(dressed.some((g) => g.matrices === old.matrices)).toBe(false);
    expect(dressed.every((g) => g.mesh !== plain[GROUND].mesh)).toBe(true);
  });
});

const FIGURES = { models: 30, placements: 396, triangles: 90951, cards: 10 };

type TreePlacement = Extract<Placement, { kind: 'tree' }>;
const isTree = (p: Placement): p is TreePlacement => p.kind === 'tree';
const label = (p: Placement) => (isTree(p) ? `${p.tree}${p.variant}` : p.model.name) + ` at ${p.x},${p.y}`;
/** How tall a placement stands: a tree its height, the kit's models their top at their scale. */
const topOf = (p: Placement) => p.z + (isTree(p) ? p.height : p.scale * p.model.bounds.max[2]);

const placements: Placement[] = new Scene().placements(kit);
const of = (kind: Placement['kind']) => placements.filter((p) => p.kind === kind);
const trees = placements.filter(isTree);
/** The woodland alone: the trees after the twenty-six by the water, which are drawn from the stream last. */
const woodland: TreePlacement[] = trees.slice(26);

/** The columns of a matrix that scale z: how tall a tree's group draws it. */
const heightsIn = (g: GameGroup) => Array.from({ length: g.matrices.length / 16 }, (_, i) => g.matrices[i * 16 + 10]);

describe('the banks', () => {
  it('have the trees, the pebbles and the clumps content says: 26 by the water and 210 in the woodland', () => {
    expect(trees).toHaveLength(26 + SCENERY.woodland.count);
    expect(trees).toHaveLength(236);
    expect(of('pebble')).toHaveLength(70);
    expect(of('clump')).toHaveLength(SCENERY.clumps.count);
    expect(of('pebble').every((p) => p.kind === 'pebble' && p.model.kind === 'pebble')).toBe(true);
  });

  it('wear no kit tree: every tree is a variant of the package’s broadleaf or conifer, and one there is', () => {
    for (const p of trees) {
      expect(['broadleaf', 'conifer'], label(p)).toContain(p.tree);
      expect(Number.isInteger(p.variant), label(p)).toBe(true);
      expect(p.variant, label(p)).toBeGreaterThanOrEqual(0);
      expect(p.variant, label(p)).toBeLessThan(VARIANTS[p.tree].length);
      expect('model' in p, label(p)).toBe(false);
    }
    // and both kinds, and every variant of each, are reached
    for (const kind of ['broadleaf', 'conifer'] as const)
      for (let v = 0; v < VARIANTS[kind].length; v++)
        expect(
          trees.some((p) => p.tree === kind && p.variant === v),
          `${kind} ${v}`,
        ).toBe(true);
  });

  it('keep the pebbles and the clumps exactly where the kit’s trees left them (the draws they come from are untouched)', () => {
    const rows = placements
      .filter((p) => p.kind !== 'tree')
      .map((p) => [p.model.name, p.kind, p.x, p.y, p.z, p.yaw, p.scale]);
    expect(rows).toHaveLength(160);
    // taken from the placements as they were with the kit's trees, before the trees changed (sha256 of the JSON)
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '6cc42708366c9a4fc89fbe99d1b340462af2898b4d69d700bb8c884b1f2ba201',
    );
  });

  it('pick each of the 26 spot trees’ variants from its own draw of the dressing stream, and not from its place in the list', () => {
    // the pebbles drew three each (a model, a turn, a size); then each spot tree draws its pick, its turn and its size
    const random = seeded(DRESSING_SEED);
    for (let i = 0; i < 70 * 3; i++) random();
    const spots = trees.slice(0, 26);
    for (const p of spots) {
      const u = random();
      random();
      random();
      expect({ tree: p.tree, variant: p.variant }, label(p)).toEqual(treeFor(u));
    }
  });

  it('stand every tree at a height of its kind’s range, the kit’s own heights, or lower where the shadow box holds it down', () => {
    expect(SCENERY.trees.broadleaf).toEqual([16, 29]);
    expect(SCENERY.trees.conifer).toEqual([17, 32]);
    for (const p of trees) {
      const [lo, hi] = SCENERY.trees[p.tree];
      expect(p.height, label(p)).toBeGreaterThanOrEqual(Math.min(lo, (SHADOW_BOX.max[2] - p.z) * 0.999) - 1e-9);
      expect(p.height, label(p)).toBeLessThanOrEqual(hi + 1e-9);
    }
    // and they use the range: the shortest are near its foot and the tallest near its head
    for (const kind of ['broadleaf', 'conifer'] as const) {
      const hs = trees.filter((p) => p.tree === kind).map((p) => p.height);
      const [lo, hi] = SCENERY.trees[kind];
      expect(Math.min(...hs), kind).toBeLessThan(lo + (hi - lo) * 0.1);
      expect(Math.max(...hs), kind).toBeGreaterThan(hi - (hi - lo) * 0.1);
    }
  });

  it('keep every tree and clump out of the water, canopy and corners and all', () => {
    for (const p of [...trees, ...of('clump')])
      for (const [x, y] of footprint(p)) expect(inside(x, y, 0), label(p)).toBe(false);
  });

  it('keep every pebble by the water and not in it, at its middle', () => {
    for (const p of of('pebble')) expect(inShore(p.x, p.y, 0), label(p)).toBe(false);
  });

  it("keep the angler's spot clear of every clump and tree, corners and all (the pebbles line the shore as the stones did)", () => {
    for (const p of placements.filter((q) => q.kind !== 'pebble'))
      for (const [x, y] of footprint(p)) expect(Math.hypot(x - ANGLER.x, y - ANGLER.y)).toBeGreaterThanOrEqual(5);
  });

  it("stand every tree's top under the sun's shadow", () => {
    for (const p of trees) expect(topOf(p), label(p)).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
  });

  it('keep every placement on the ground, a pebble sunk by the share content allows and nothing else', () => {
    for (const p of placements) {
      const sunk = p.kind === 'pebble' ? SCENERY.pebbles.sunk * p.model.bounds.max[2] * p.scale : 0;
      expect(p.z, label(p)).toBeGreaterThanOrEqual(ground(p.x, p.y) - sunk - 1e-9);
      expect(p.z, label(p)).toBeLessThanOrEqual(ground(p.x, p.y) + 1e-9);
    }
  });

  const rowsOf = (ps: Placement[]) =>
    JSON.stringify(
      ps.map((p) => [
        isTree(p) ? `${p.tree}${p.variant}` : p.model.name,
        p.kind,
        p.x,
        p.y,
        p.z,
        p.yaw,
        isTree(p) ? p.height : p.scale,
      ]),
    );

  it('are the same on two builds, whatever the game and whatever Math.random says', () => {
    const first = rowsOf(placements);
    newGame(1);
    newGame(99);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the scenery asked Math.random');
    });
    try {
      expect(rowsOf(new Scene().placements(kit))).toBe(first);
      expect(hashGroups(new Scene().static(kit))).toBe(hashGroups(new Scene().static(kit)));
    } finally {
      random.mockRestore();
    }
  });

  it('have no tree on the near south bank, where the camera stands', () => {
    for (const p of trees) {
      const angle = Math.atan2(p.y, p.x / STRETCH);
      if (Math.sin(angle) < -0.55)
        expect(Math.hypot(p.x / STRETCH, p.y) / shoreRadius(angle), label(p)).toBeGreaterThanOrEqual(2.6);
    }
    // and there are some far trees to the south, so the rule was reached
    expect(trees.some((p) => Math.sin(Math.atan2(p.y, p.x / STRETCH)) < -0.55)).toBe(true);
  });

  it('are denser near the water than far from it', () => {
    const k = (p: Placement) => {
      const a = Math.atan2(p.y, p.x / STRETCH);
      return Math.hypot(p.x / STRETCH, p.y) / shoreRadius(a);
    };
    const near = of('clump').filter((p) => k(p) < 1.75).length;
    expect(near).toBeGreaterThan(of('clump').length / 2);
  });
});

describe('the kit groups', () => {
  const all = new Scene().static(kit).slice(GROUND);
  const treeMeshes = new Set(Object.values(VARIANTS).flatMap((vs) => vs.flatMap((t) => t.parts.map((q) => q.mesh))));
  const groups = all.filter((g) => !treeMeshes.has(g.mesh));

  it('each hold whole matrices, and some', () => {
    for (const g of all) {
      expect(g.matrices.length % 16).toBe(0);
      expect(g.matrices.length).toBeGreaterThan(0);
    }
  });

  it('name only layers the kit has masks for', () => {
    expect(kit.maskFiles.length).toBeGreaterThan(0);
    const cards = all.filter((g) => g.card);
    expect(cards.length).toBeGreaterThan(0);
    for (const g of cards) {
      expect(Number.isInteger(g.card!.layer)).toBe(true);
      expect(g.card!.layer).toBeGreaterThanOrEqual(1);
      expect(g.card!.layer).toBeLessThanOrEqual(kit.maskFiles.length);
    }
  });

  it('are one a part of a kit model with a colour from its role and no group for a model unplaced', () => {
    const used = new Set(placements.flatMap((p) => ('model' in p ? [p.model.name] : [])));
    const parts = [...kit.models.values()].filter((m) => used.has(m.name)).reduce((n, m) => n + m.parts.length, 0);
    expect(groups).toHaveLength(parts);
    for (const g of groups) expect(g.albedo).toBeDefined();
  });

  it('colour every role of the kit from one palette key each', () => {
    for (const role of SCENERY_ROLES) {
      const key = ROLE_COLOUR[role];
      expect(PALETTE[key], role).toBeDefined();
      expect(PALETTE[key]).toHaveLength(3);
    }
  });

  it('draw the trees as one group a part of each variant stood, coloured by the part’s name, with no card and no kit model', () => {
    const stood = new Set(trees.map((p) => `${p.tree}${p.variant}`));
    const made = all.filter((g) => treeMeshes.has(g.mesh));
    let parts = 0;
    for (const kind of ['broadleaf', 'conifer'] as const)
      VARIANTS[kind].forEach((t, v) => {
        if (!stood.has(`${kind}${v}`)) return;
        const mine = trees.filter((p) => p.tree === kind && p.variant === v);
        for (const part of t.parts) {
          parts++;
          const g = made.filter((q) => q.mesh === part.mesh);
          expect(g, `${kind} ${v} ${part.name}`).toHaveLength(1);
          expect(g[0].albedo).toEqual(PALETTE[TREE_COLOUR[kind][part.name]]);
          expect(g[0].roughness).toBe(TREE_ROUGHNESS[kind][part.name]);
          expect(g[0].card).toBeUndefined();
          expect(g[0].matrices.length / 16).toBe(mine.length);
        }
      });
    expect(made).toHaveLength(parts);
    expect(stood.size).toBe(7);
  });

  it('scale each tree by its height all round, so a variant made at one stands as tall as its placement says', () => {
    const made = all.filter((g) => treeMeshes.has(g.mesh));
    const drawn = made.filter((g) => g.mesh === VARIANTS.broadleaf[0].parts[0].mesh);
    const mine = trees.filter((p) => p.tree === 'broadleaf' && p.variant === 0);
    expect(heightsIn(drawn[0])).toEqual(mine.map((p) => Math.fround(p.height)));
    // all three axes alike: the matrix is a scale and a turn about the vertical
    const m = drawn[0].matrices;
    for (let i = 0; i < mine.length; i++) {
      expect(Math.hypot(m[i * 16], m[i * 16 + 1])).toBeCloseTo(mine[i].height, 3);
      expect(Math.hypot(m[i * 16 + 4], m[i * 16 + 5])).toBeCloseTo(mine[i].height, 3);
    }
    const everyHeight = made
      .filter((g) => g.mesh === VARIANTS.conifer[0].parts[1].mesh || g.mesh === VARIANTS.broadleaf[0].parts[1].mesh)
      .flatMap(heightsIn);
    expect(everyHeight.length).toBeGreaterThan(0);
    for (const h of everyHeight) expect(h).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
  });
});

describe('the scenery figures the test API reports', () => {
  const figures = sceneryFigures(placements);
  const stood = new Set(trees.map((p) => `${p.tree}${p.variant}`));

  it('count the models and tree variants placed, the placements, the triangles drawn and the card groups, from the placements', () => {
    expect(figures.placements).toBe(placements.length);
    const kitModels = new Set(placements.flatMap((p) => ('model' in p ? [p.model.name] : [])));
    expect(figures.models).toBe(kitModels.size + stood.size);
    let triangles = 0,
      cards = 0;
    for (const p of placements) {
      if (isTree(p)) for (const part of VARIANTS[p.tree][p.variant].parts) triangles += part.mesh.indices.length / 3;
      else for (const part of p.model.parts) triangles += part.mesh.indices.length / 3;
    }
    for (const name of kitModels) for (const part of kit.models.get(name)!.parts) if (part.layer > 0) cards++;
    expect(figures.triangles).toBe(triangles);
    expect(figures.cards).toBe(cards);
  });

  it('agree with the groups the scene hands the renderer, one group a card part of each kit model placed', () => {
    const groups = new Scene().static(kit).slice(GROUND);
    expect(figures.cards).toBe(groups.filter((g) => g.card).length);
  });

  it('are as the content says today (the smoke stage holds the same figures from the page)', () => {
    expect(figures).toEqual(FIGURES);
  });
});

describe('the woodland', () => {
  const k = (p: Placement) => {
    const a = Math.atan2(p.y, p.x / STRETCH);
    return Math.hypot(p.x / STRETCH, p.y) / shoreRadius(a);
  };
  const south = (p: Placement) => Math.sin(Math.atan2(p.y, p.x / STRETCH)) < -0.55;

  it('is the two hundred and ten trees content says, all trees, added after everything else', () => {
    expect(woodland).toHaveLength(SCENERY.woodland.count);
    expect(woodland).toHaveLength(210);
  });

  it('is added after everything else, so the pebbles and clumps are where they were without it', () => {
    const last = placements.slice(-SCENERY.woodland.count);
    expect(last.every(isTree)).toBe(true);
    expect(last.map((p) => p.x)).toEqual(woodland.map((p) => p.x));
    expect(placements).toHaveLength(26 + 70 + 90 + SCENERY.woodland.count);
  });

  it('stands in its band of shore radii, further out on the south bank', () => {
    const { band, southBand } = SCENERY.woodland;
    for (const p of woodland) {
      const [lo, hi] = south(p) ? southBand : band;
      expect(k(p), label(p)).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(k(p), label(p)).toBeLessThanOrEqual(hi + 1e-9);
    }
    // and both bands were reached
    expect(woodland.some(south)).toBe(true);
    expect(woodland.some((p) => !south(p))).toBe(true);
  });

  it('thickens outward: three in four of it in the outer half of its band (a square root of the draw), not one in two', () => {
    const [lo, hi] = SCENERY.woodland.band;
    const open = woodland.filter((p) => !south(p));
    const outer = open.filter((p) => k(p) > (lo + hi) / 2).length;
    expect(outer / open.length).toBeGreaterThan(0.62);
  });

  it('is held down so no top passes the shadow box, whatever the range and the kind', () => {
    for (const kind of ['broadleaf', 'conifer'] as const)
      for (const z of [0, 2.2, 12]) {
        const h = treeHeight(kind, z, 1);
        expect(z + h, `${kind} at ${z}`).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
        expect(h).toBeLessThanOrEqual(SCENERY.trees[kind][1]);
      }
    // a bank so high that the range would pass the box is held down; where there is room it is the height content picked
    expect(treeHeight('conifer', 20, 1)).toBeLessThan(SCENERY.trees.conifer[1]);
    expect(treeHeight('broadleaf', 0, 0)).toBe(SCENERY.trees.broadleaf[0]);
    expect(treeHeight('broadleaf', 0, 1)).toBe(SCENERY.trees.broadleaf[1]);
  });

  it('keeps clear of the water, the angler and the shadow box top, as the spot trees do', () => {
    for (const p of woodland) {
      for (const [x, y] of footprint(p)) expect(inside(x, y, 0), label(p)).toBe(false);
      for (const [x, y] of footprint(p)) expect(Math.hypot(x - ANGLER.x, y - ANGLER.y)).toBeGreaterThanOrEqual(5);
      expect(topOf(p)).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      expect(p.z).toBe(ground(p.x, p.y));
    }
  });

  it('is at true scale: tall as the kit’s trees were, up to the shadow box', () => {
    expect(SHADOW_BOX.max[2]).toBe(40);
    for (const p of woodland)
      expect(p.height).toBeGreaterThanOrEqual(Math.min(SCENERY.trees[p.tree][0], (40 - p.z) * 0.999) - 1e-9);
  });

  it('costs the few triangles of the package’s trees: well under the kit’s three thousand a tree', () => {
    const tris = (p: TreePlacement) =>
      VARIANTS[p.tree][p.variant].parts.reduce((n, q) => n + q.mesh.indices.length / 3, 0);
    const mean = woodland.reduce((n, p) => n + tris(p), 0) / woodland.length;
    expect(mean).toBeLessThan(250);
  });
});
