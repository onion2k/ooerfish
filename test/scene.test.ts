/**
 * The lake's scenery as it is drawn: what a scene without the kit holds to, byte for byte as it was before the
 * kit; and, with the kit, that the bed, the weed and the rocks are untouched and the banks wear it where they
 * should: nothing in the water, nothing on the angler, no tree past the sun's shadow, the near bank bare of trees,
 * every card on a layer the kit has. Without these a tree could stand in the lake and no picture-less gate would say.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { GameGroup } from 'artshape-render/game/renderer';
import { ANGLER, SCENERY, STRETCH, ground, inShore, inside, shoreRadius } from '../src/lake';
import { PALETTE } from '../src/palette';
import { SCENERY_ROLES, ROLE_COLOUR, readKit, readManifest, type Kit } from '../src/scenery';
import { SHADOW_BOX, Scene, cheapPick, footprint, sceneryFigures, treeScale, type Placement } from '../src/scene';
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

const placements: Placement[] = new Scene().placements(kit);
/** The same banks on the lean rung: no woodland. */
const lean: Placement[] = new Scene().placements(kit, { woodland: false });
/** The woodland alone: what the full rung has that the lean does not, which it adds last. */
const woodland: Placement[] = placements.slice(lean.length);
const of = (kind: Placement['kind']) => placements.filter((p) => p.kind === kind);

describe('the banks', () => {
  it('have the trees, the pebbles and the clumps content says', () => {
    expect(of('tree')).toHaveLength(26 + SCENERY.woodland.count);
    expect(of('pebble')).toHaveLength(70);
    expect(of('clump')).toHaveLength(SCENERY.clumps.count);
    expect(of('tree').every((p) => ['tree', 'pine'].includes(p.model.kind))).toBe(true);
    expect(of('pebble').every((p) => p.model.kind === 'pebble')).toBe(true);
  });

  it('keep every tree and clump out of the water, corners and all', () => {
    for (const p of [...of('tree'), ...of('clump')])
      for (const [x, y] of footprint(p)) expect(inside(x, y, 0), `${p.model.name} at ${p.x},${p.y}`).toBe(false);
  });

  it('keep every pebble by the water and not in it, at its middle', () => {
    for (const p of of('pebble')) expect(inShore(p.x, p.y, 0), `${p.model.name} at ${p.x},${p.y}`).toBe(false);
  });

  it("keep the angler's spot clear of every clump and tree, corners and all (the pebbles line the shore as the stones did)", () => {
    for (const p of placements.filter((q) => q.kind !== 'pebble'))
      for (const [x, y] of footprint(p)) expect(Math.hypot(x - ANGLER.x, y - ANGLER.y)).toBeGreaterThanOrEqual(5);
  });

  it("stand every tree's top under the sun's shadow", () => {
    for (const p of of('tree'))
      expect(p.z + p.scale * p.model.bounds.max[2], p.model.name).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
  });

  it('keep every placement on the ground, a pebble sunk by the share content allows and nothing else', () => {
    for (const p of placements) {
      const sunk = p.kind === 'pebble' ? SCENERY.pebbles.sunk * p.model.bounds.max[2] * p.scale : 0;
      expect(p.z, p.model.name).toBeGreaterThanOrEqual(ground(p.x, p.y) - sunk - 1e-9);
      expect(p.z, p.model.name).toBeLessThanOrEqual(ground(p.x, p.y) + 1e-9);
    }
  });

  it('are the same on two builds, whatever the game and whatever Math.random says', () => {
    const first = JSON.stringify(placements.map((p) => [p.model.name, p.kind, p.x, p.y, p.z, p.yaw, p.scale]));
    newGame(1);
    newGame(99);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the scenery asked Math.random');
    });
    try {
      const again = new Scene().placements(kit);
      expect(JSON.stringify(again.map((p) => [p.model.name, p.kind, p.x, p.y, p.z, p.yaw, p.scale]))).toBe(first);
      expect(hashGroups(new Scene().static(kit))).toBe(hashGroups(new Scene().static(kit)));
    } finally {
      random.mockRestore();
    }
  });

  it('have no tree on the near south bank, where the camera stands', () => {
    for (const p of of('tree')) {
      const angle = Math.atan2(p.y, p.x / STRETCH);
      if (Math.sin(angle) < -0.55)
        expect(Math.hypot(p.x / STRETCH, p.y) / shoreRadius(angle), p.model.name).toBeGreaterThanOrEqual(2.6);
    }
    // and there are some far trees to the south, so the rule was reached
    expect(of('tree').some((p) => Math.sin(Math.atan2(p.y, p.x / STRETCH)) < -0.55)).toBe(true);
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
  const groups = new Scene().static(kit).slice(GROUND);

  it('each hold whole matrices, and some', () => {
    for (const g of groups) {
      expect(g.matrices.length % 16).toBe(0);
      expect(g.matrices.length).toBeGreaterThan(0);
    }
  });

  it('name only layers the kit has masks for', () => {
    expect(kit.maskFiles.length).toBeGreaterThan(0);
    const cards = groups.filter((g) => g.card);
    expect(cards.length).toBeGreaterThan(0);
    for (const g of cards) {
      expect(Number.isInteger(g.card!.layer)).toBe(true);
      expect(g.card!.layer).toBeGreaterThanOrEqual(1);
      expect(g.card!.layer).toBeLessThanOrEqual(kit.maskFiles.length);
    }
  });

  it('are one a part of a model, with a colour from its role and no group for a model unplaced', () => {
    const used = new Set(placements.map((p) => p.model.name));
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
});

describe('the scenery figures the test API reports', () => {
  const placements = new Scene().placements(kit);
  const figures = sceneryFigures(placements);

  it('count the models placed, the placements, the triangles drawn and the card groups, from the placements', () => {
    expect(figures.placements).toBe(placements.length);
    expect(figures.models).toBe(new Set(placements.map((p) => p.model.name)).size);
    let triangles = 0,
      cards = 0;
    for (const p of placements) for (const part of p.model.parts) triangles += part.mesh.indices.length / 3;
    for (const name of new Set(placements.map((p) => p.model.name)))
      for (const part of kit.models.get(name)!.parts) if (part.layer > 0) cards++;
    expect(figures.triangles).toBe(triangles);
    expect(figures.cards).toBe(cards);
  });

  it('agree with the groups the scene hands the renderer, one group a card part of each model placed', () => {
    const groups = new Scene().static(kit).slice(GROUND);
    expect(figures.cards).toBe(groups.filter((g) => g.card).length);
  });

  it('are as the content says today (the smoke stage holds the same figures from the page)', () => {
    expect(figures).toEqual({ models: 33, placements: 246, triangles: 385769, cards: 20 });
  });
});

describe('the woodland', () => {
  const k = (p: Placement) => {
    const a = Math.atan2(p.y, p.x / STRETCH);
    return Math.hypot(p.x / STRETCH, p.y) / shoreRadius(a);
  };
  const south = (p: Placement) => Math.sin(Math.atan2(p.y, p.x / STRETCH)) < -0.55;

  it('is the sixty trees content says, all trees, added after everything else', () => {
    expect(woodland).toHaveLength(SCENERY.woodland.count);
    expect(woodland).toHaveLength(60);
    expect(woodland.every((p) => p.kind === 'tree' && ['tree', 'pine'].includes(p.model.kind))).toBe(true);
  });

  it('leaves every other placement exactly where the lean rung has it, so stepping down only takes trees away', () => {
    expect(lean).toHaveLength(246 - 60);
    expect(JSON.stringify(placements.slice(0, lean.length))).toBe(JSON.stringify(lean));
  });

  it('stands in its band of shore radii, further out on the south bank', () => {
    const { band, southBand } = SCENERY.woodland;
    for (const p of woodland) {
      const [lo, hi] = south(p) ? southBand : band;
      expect(k(p), `${p.model.name} at ${p.x},${p.y}`).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(k(p), `${p.model.name} at ${p.x},${p.y}`).toBeLessThanOrEqual(hi + 1e-9);
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

  const boxOf = (tall: number) => ({
    min: [0, 0, 0] as [number, number, number],
    max: [1, 1, tall] as [number, number, number],
  });

  it('is held down so no top passes the shadow box, whatever the scale and the model', () => {
    const tree = [...kit.models.values()].find((m) => m.kind === 'tree')!;
    const tall = { ...tree, bounds: boxOf(20) };
    for (const z of [0, 2.2]) {
      const scale = treeScale(tall, z, 1);
      expect(z + scale * 20).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      expect(scale).toBeLessThan(SCENERY.trees[tall.kind][1]);
    }
    // and where there is room it is the scale content picked
    const low = { ...tall, bounds: boxOf(5) };
    expect(treeScale(low, 0, 0)).toBe(SCENERY.trees[low.kind][0]);
  });

  it('keeps clear of the water, the angler and the shadow box top, as the spot trees do', () => {
    for (const p of woodland) {
      for (const [x, y] of footprint(p)) {
        expect(inside(x, y, 0), `${p.model.name} at ${p.x},${p.y}`).toBe(false);
        expect(Math.hypot(x - ANGLER.x, y - ANGLER.y)).toBeGreaterThanOrEqual(5);
      }
      expect(p.z + p.scale * p.model.bounds.max[2]).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      expect(p.z).toBe(ground(p.x, p.y));
    }
  });

  it('is at true scale: the trees about two and a half to three times the old, up to the shadow box', () => {
    expect(SCENERY.trees.tree).toEqual([2.4, 3.2]);
    expect(SCENERY.trees.pine).toEqual([2.4, 3.2]);
    expect(SHADOW_BOX.max[2]).toBe(40);
    for (const p of woodland) expect(p.scale).toBeGreaterThanOrEqual(2.4 - 1e-9);
  });

  it('picks its models by the weight of one over their triangles, so it costs fewer triangles a tree', () => {
    const models = [...kit.models.values()].filter((m) => m.kind === 'tree' || m.kind === 'pine');
    const tris = (m: (typeof models)[number]) => m.parts.reduce((n, part) => n + part.mesh.indices.length / 3, 0);
    expect(models.every((m) => m.triangles === tris(m))).toBe(true);
    // over an even grid of draws, each model is picked in proportion to 1 / triangles
    const N = 20_000,
      picked = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const m = cheapPick(models, (i + 0.5) / N);
      picked.set(m.name, (picked.get(m.name) ?? 0) + 1);
    }
    const sum = models.reduce((n, m) => n + 1 / m.triangles, 0);
    for (const m of models) expect((picked.get(m.name) ?? 0) / N, m.name).toBeCloseTo(1 / m.triangles / sum, 3);
    // and the woodland that was drawn costs less a tree than an even pick of the models would
    const even = models.reduce((n, m) => n + m.triangles, 0) / models.length;
    const cost = woodland.reduce((n, p) => n + p.model.triangles, 0) / woodland.length;
    expect(cost).toBeLessThan(even);
  });
});

describe('the lean rung', () => {
  it('has the woodland out of its groups and nothing else, in the same order', () => {
    const full = new Scene().static(kit);
    const thin = new Scene().static(kit, { woodland: false });
    expect(sceneryFigures(lean).placements).toBe(186);
    // a model that stood only in the woodland has no group; the rest hold fewer matrices or the same
    expect(thin.length).toBeLessThanOrEqual(full.length);
    const matrices = (gs: GameGroup[]) => gs.reduce((n, g) => n + g.matrices.length / 16, 0);
    expect(matrices(full) - matrices(thin)).toBeGreaterThanOrEqual(60);
    for (let i = 0; i < GROUND; i++) expect(thin[i].matrices).toEqual(full[i].matrices);
  });
});
