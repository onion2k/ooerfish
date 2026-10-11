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
    // the hash holds the albedo, so it moved on 11 October 2026 with the palette's dark greens and greys, and again the same day with the bed, rocks and weed under the see-through water, and not with any shape
    expect(hashGroups(new Scene().static())).toBe('8:4b372d74');
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
const of = (kind: Placement['kind']) => placements.filter((p) => p.kind === kind);

describe('the banks', () => {
  it('have the trees, the pebbles and the clumps content says', () => {
    expect(of('tree')).toHaveLength(26);
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
    expect(figures).toEqual({ models: 31, placements: 186, triangles: 164595, cards: 18 });
  });
});

describe("a tree's scale and a model's pick", () => {
  const boxOf = (tall: number) => ({
    min: [0, 0, 0] as [number, number, number],
    max: [1, 1, tall] as [number, number, number],
  });

  it('holds a tree down so no top passes the shadow box, whatever the scale and the model', () => {
    const tree = [...kit.models.values()].find((m) => m.kind === 'tree')!;
    const tall = { ...tree, bounds: boxOf(40) };
    for (const z of [0, 2.2]) {
      const scale = treeScale(tall, z, 1);
      expect(z + scale * 40).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      expect(scale).toBeLessThan(SCENERY.trees[tall.kind][1]);
    }
    // and where there is room it is the scale content picked
    const low = { ...tall, bounds: boxOf(5) };
    expect(treeScale(low, 0, 0)).toBe(SCENERY.trees[low.kind][0]);
  });

  it('picks models in proportion to one over their triangles', () => {
    const models = [...kit.models.values()].filter((m) => m.kind === 'tree' || m.kind === 'pine');
    const N = 20_000,
      picked = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const m = cheapPick(models, (i + 0.5) / N);
      picked.set(m.name, (picked.get(m.name) ?? 0) + 1);
    }
    const sum = models.reduce((n, m) => n + 1 / m.triangles, 0);
    for (const m of models) expect((picked.get(m.name) ?? 0) / N, m.name).toBeCloseTo(1 / m.triangles / sum, 3);
  });
});
