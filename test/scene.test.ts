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
import {
  ANGLER,
  BANK_TOP,
  BED_SHALLOWS,
  BOULDER_DOMES,
  CABIN,
  CLIFF,
  MAX_DEPTH,
  NOTCHES,
  SCENERY,
  STRETCH,
  bareGround,
  cabinGap,
  groundUnder,
  inShore,
  inside,
  jettyGap,
  onFace,
  onFall,
  shoreRadius,
} from '../src/lake';
import { PALETTE } from '../src/palette';
import { seasonPalette } from '../src/season';
import { SCENERY_ROLES, ROLE_COLOUR, readKit, readManifest, type Kit } from '../src/scenery';
import {
  DRESSING_SEED,
  SHADOW_BOX,
  Scene,
  bedBands,
  bedCuts,
  cliffLumps,
  footprint,
  sceneryFigures,
  treeHeight,
  type Placement,
} from '../src/scene';
import { seeded } from '../src/random';
import { TREE_COLOUR, TREE_ROUGHNESS, VARIANTS, treeFor } from '../src/trees';
import { surface } from '../src/water/surface';
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

/** The boulders and the cliff's lumps, each its own painted group: one to a dome and one to a lump. */
const N_BOULDERS = BOULDER_DOMES.length;
const N_LUMPS = cliffLumps().length;
/** The bed's bands, a sheet and a group each, from the slate of the deep out to the sand of the shallows. */
const BANDS = BED_SHALLOWS.bands;
/** The ground's groups: the bed's bands, the boulders, the bed rocks, the weed, the banks, the cliff's face and its lumps. */
const GROUND = BANDS + N_BOULDERS + 4 + N_LUMPS;
/** Where the grassy banks are in them. */
const BANKS = BANDS + N_BOULDERS + 2;

describe('a scene without the kit', () => {
  it('is the scene as it was before the kit, every group, matrix and mesh (its colours those of the calm palette)', () => {
    // the hash holds the albedo, so it moved on 11 October 2026 with the palette's dark greens and greys, and again the same day with the bed, rocks and weed under the see-through water, and a third time with the bank painted the colour its blades average to (`PALETTE.grass`), and not with any shape; then on 13 October 2026 the boulders and the cliff's lumps became faceted painted meshes of their own, a group each (38 groups then), whose positions, normals and matrices it holds (the paint is held by test/rocks.test.ts); and on 13 October 2026 the boulders' and the cliff's albedo went darker, with no shape moved; and on 14 October 2026 the bed's one slate sheet became six bands from the slate to the sand (43 groups now), on the rings it had and one more at each cut; and on 15 October 2026 the sand reached under the whole lake (docs/crystal-2.md, part 4), so the bands were cut evenly from the middle and coloured from the sand to a darkened sand, and not the slate
    expect(hashGroups(new Scene().static())).toBe('43:1d2fc54');
  });
});

describe('a scene with the kit', () => {
  const plain = new Scene().static();
  const dressed = new Scene().static(kit);

  it('leaves the bed, boulders, rocks, weed, banks, face and lumps exactly as they were', () => {
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

/**
 * The most triangles the bed's bands may take together. The one sheet they replace was 28 rings of 160 segments, 8,960
 * triangles; each cut between two bands adds a ring of 320 at most, so six bands come to 10,560, and the ceiling is
 * set a little over that, where a band given rings of its own and not the sheet's would pass it.
 */
const BED_CEILING = 11_000;

describe('the bed', () => {
  const bands = bedBands();
  const sand = PALETTE.sand,
    slate = PALETTE.bed;
  /** How far a colour is from the slate toward the sand, channel by channel, nought the slate and one the sand. */
  const toward = (c: readonly number[]) => c.map((v, i) => (v - slate[i]) / (sand[i] - slate[i]));
  /** The bed's depth at a share of the way out to the shore, read off the ground the sheet is drawn from. */
  const depthAt = (k: number) => -groundUnder(k * shoreRadius(0) * STRETCH, 0);

  it('is cut into the bands content says, from the middle out past the shore to the beach, each from where the last ended', () => {
    expect(bands).toHaveLength(BANDS);
    expect(bands[0].from).toBe(0);
    expect(bands[BANDS - 1].to).toBe(BED_SHALLOWS.beach);
    expect(BED_SHALLOWS.beach, 'the sand reaches past the shore onto the bank').toBeGreaterThan(1);
    for (let i = 0; i < BANDS; i++) {
      expect(bands[i].to).toBeGreaterThan(bands[i].from);
      if (i > 0) expect(bands[i].from, `band ${i} starts where band ${i - 1} ended`).toBe(bands[i - 1].to);
    }
  });

  it('draws each band as a sheet from its inner radius to its outer, sharing its edge ring with its neighbour to the bit', () => {
    const ring = (b: (typeof bands)[number], k: number) => {
      const out: number[] = [];
      for (let v = 0; v < b.mesh.uvs.length / 2; v++)
        if (b.mesh.uvs[v * 2 + 1] === k) out.push(...b.mesh.positions.subarray(v * 3, v * 3 + 3));
      return out;
    };
    for (let i = 0; i < BANDS; i++) {
      const vs = Array.from({ length: bands[i].mesh.uvs.length / 2 }, (_, v) => bands[i].mesh.uvs[v * 2 + 1]);
      expect(Math.min(...vs)).toBe(Math.fround(bands[i].from));
      expect(Math.max(...vs)).toBe(Math.fround(bands[i].to));
      if (i > 0) {
        const edge = Math.fround(bands[i].from);
        const inner = ring(bands[i], edge);
        expect(inner.length, `band ${i} has its inner ring`).toBeGreaterThan(0);
        expect(inner, `no gap or overlap between bands ${i - 1} and ${i}`).toEqual(ring(bands[i - 1], edge));
      }
    }
  });

  it('is the sand in the shallowest band and darker toward the middle, the bands in order, and never the slate where the blend reaches past the deepest', () => {
    expect(bands[BANDS - 1].colour).toEqual(sand);
    // the sand reaches under the whole lake (part 4 of docs/crystal-2.md): the blend toward the slate ends past the
    // deepest point, so the middle is a darkened sand and the slate is not reached
    expect(BED_SHALLOWS.depth + BED_SHALLOWS.blend, 'the blend ends past the deepest').toBeGreaterThan(MAX_DEPTH);
    for (const t of toward(bands[0].colour)) expect(t, 'the middle is short of the slate').toBeGreaterThan(0.25);
    for (let i = 1; i < BANDS - 1; i++)
      for (const t of toward(bands[i].colour)) {
        expect(t, `band ${i} is past the slate`).toBeGreaterThan(0);
        expect(t, `band ${i} is short of the sand`).toBeLessThan(1);
      }
    for (let i = 1; i < BANDS; i++) {
      const [a, b] = [toward(bands[i - 1].colour), toward(bands[i].colour)];
      for (let c = 0; c < 3; c++) {
        expect(b[c], `band ${i} is sandier than band ${i - 1}`).toBeGreaterThan(a[c]);
        // a blend and not a step: no one edge carries much more than its share of the change, as the hack's one cut did
        expect(b[c] - a[c], `the step into band ${i}`).toBeLessThanOrEqual(1.5 / (BANDS - 1));
      }
    }
  });

  it('colours each band by the depth at its middle radius: sand shallower than the shallows’ depth, slate past the blend', () => {
    const { depth, blend } = BED_SHALLOWS;
    for (const b of bands) {
      const t = Math.min(1, Math.max(0, (depthAt((b.from + b.to) / 2) - depth) / blend));
      for (let c = 0; c < 3; c++) expect(b.colour[c]).toBeCloseTo(sand[c] + (slate[c] - sand[c]) * t, 6);
    }
    // the sand begins where the water is the shallows' depth
    expect(depthAt(bands[BANDS - 1].from)).toBeCloseTo(depth, 4);
  });

  it('cuts the bands evenly from the middle, none empty, when the blend reaches past the deepest, and from the slate’s edge when it does not', () => {
    // past the deepest there is no water deep enough for the slate, so the first cut is at the middle itself, and a
    // band from nought to nought would draw nothing: the bands are cut evenly from the middle to the shallows' depth
    const past = bedCuts({ ...BED_SHALLOWS, depth: 5.5, blend: 1.5 }, sand, slate);
    expect(past).toHaveLength(BED_SHALLOWS.bands);
    for (const b of past) expect(b.to, `${b.from} to ${b.to}`).toBeGreaterThan(b.from);
    const widths = past.slice(0, -1).map((b) => b.to - b.from);
    for (const w of widths) expect(w).toBeCloseTo(widths[0], 10);
    expect(depthAt(past[past.length - 1].from)).toBeCloseTo(5.5, 4);
    // short of the deepest, as the bed was before, the slate is the deepest band, ending where the blend does
    const short = bedCuts({ ...BED_SHALLOWS, depth: 2.625, blend: 1.5 }, sand, slate);
    expect(short[0].colour).toEqual(slate);
    expect(depthAt(short[0].to)).toBeCloseTo(4.125, 4);
    expect(depthAt(short[short.length - 1].from)).toBeCloseTo(2.625, 4);
  });

  it('cuts by depth whatever the figures: two bands are the sand and the slate meeting at the depth, and no more', () => {
    const two = bedCuts({ ...BED_SHALLOWS, depth: 2.625, bands: 2 }, sand, slate);
    expect(two.map((b) => b.colour)).toEqual([slate, sand]);
    expect(depthAt(two[0].to)).toBeCloseTo(2.625, 4);
    // one band could not hold both the sand and the slate, and a part of a band is no band
    for (const bands of [1, 0, 2.5]) expect(() => bedCuts({ ...BED_SHALLOWS, bands })).toThrow(/two bands at least/);
  });

  it('takes no more triangles than its ceiling, and no fewer than the one sheet it replaced', () => {
    const triangles = bands.reduce((n, b) => n + b.mesh.indices.length / 3, 0);
    expect(triangles).toBeLessThanOrEqual(BED_CEILING);
    expect(triangles).toBeGreaterThanOrEqual(8960);
  });

  it('is handed to the renderer as the first groups, a band each in its colour, the same on two builds whatever the seed', () => {
    const first = new Scene().static(kit);
    newGame(1);
    newGame(99);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the bed asked Math.random');
    });
    try {
      const again = new Scene().static(kit);
      for (let i = 0; i < BANDS; i++) {
        expect(first[i].mesh).toBe(bands[i].mesh);
        expect(first[i].albedo).toEqual(bands[i].colour);
        expect(again[i].mesh).toEqual(first[i].mesh);
        expect(again[i].albedo).toEqual(first[i].albedo);
      }
      expect(hashGroups(again.slice(0, BANDS))).toBe(hashGroups(first.slice(0, BANDS)));
      // the bands' sheets are made once, before the spy, so the cuts and colours are worked out again under it
      expect(bedCuts()).toEqual(bands.map(({ from, to, colour }) => ({ from, to, colour })));
    } finally {
      random.mockRestore();
    }
  });
});

/** The rocks, each its own mesh: four boulders and twenty-six lumps of 64 triangles (5 rings of 8 segments). */
const ROCK_TRIANGLES = (N_BOULDERS + N_LUMPS) * 64;
/** The bed's bands: the one sheet's 28 rings of 160 segments, and a ring more at each of the five cuts between six bands. */
const BED_TRIANGLES = (28 + BANDS - 1) * 160 * 2;
/**
 * The water's surface: the old coarse 24 rings by 128 segments, fine within reach of the Shore view's camera (85 rings by
 * 303 angles in all), built from `SURFACE` by `surfaceLayout`.
 */
const SURFACE_TRIANGLES = 85 * 303 * 2;
/**
 * The most triangles the water's surface may take. Fine all over it was 528,000 and cost 0.9 ms a frame; fine near the
 * camera it is 51,510 and cost 0.3 ms, and the ceiling is set a little over that, where a reach grown or a spacing made
 * finer would pass it and have its cost timed again.
 */
const SURFACE_CEILING = 60_000;
const FIGURES = {
  models: 30,
  placements: 396 + N_BOULDERS + N_LUMPS,
  triangles: 90951 + ROCK_TRIANGLES + BED_TRIANGLES + SURFACE_TRIANGLES,
  cards: 10,
};

type TreePlacement = Extract<Placement, { kind: 'tree' }>;
/** Whether a point is under the cliff's sector, in the lake's own frame. */
const underCliff = (x: number, y: number) => Math.abs(Math.atan2(y, x / STRETCH) - CLIFF.middle) <= CLIFF.half;
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
    // the ones outside the cliff's sector; the cliff turns some inside it away after the draws, and raises the rest
    const rows = placements
      .filter(
        (p): p is Exclude<Placement, TreePlacement> => !isTree(p) && !underCliff(p.x, p.y) && jettyGap(p.x, p.y) > 3,
      )
      .map((p) => [p.model.name, p.kind, p.x, p.y, p.z, p.yaw, p.scale]);
    // 121 as they were, less the two clumps the cabin turned away onto the plateau and the three pebbles near the deck
    // (two of them slid along the shore off its end): the dump of every placement before and after differs in those four
    // and no other
    expect(rows).toHaveLength(116);
    // pinned (sha256 of the JSON)
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '2639ff5385daea430551a48a9a7f1423114dc75c7adb2ae51ebd874ed1211958',
    );
  });

  it('keep the trees well clear of the cliff’s sector exactly where they were before it', () => {
    // a rad past the sector’s edge: a crown reaching onto the face from just outside it is moved, and that is the cliff’s
    const rows = trees
      .filter((p) => Math.abs(Math.atan2(p.y, p.x / STRETCH) - CLIFF.middle) > 1)
      .map((p) => [p.tree, p.variant, p.x, p.y, p.z, p.yaw, p.height]);
    expect(rows).toHaveLength(158);
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe(
      '89d0e1646716d200d480c6e3a88522258a8ae05672eb9e74502aa88181cb5c56',
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
      expect(p.z, label(p)).toBeGreaterThanOrEqual(bareGround(p.x, p.y) - sunk - 1e-9);
      expect(p.z, label(p)).toBeLessThanOrEqual(bareGround(p.x, p.y) + 1e-9);
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

  it('count the models and tree variants placed, the placements, the triangles drawn (the bed’s bands among them) and the card groups, from the placements', () => {
    expect(figures.placements).toBe(placements.length + N_BOULDERS + N_LUMPS);
    const kitModels = new Set(placements.flatMap((p) => ('model' in p ? [p.model.name] : [])));
    expect(figures.models).toBe(kitModels.size + stood.size);
    let triangles = 0,
      cards = 0;
    for (const p of placements) {
      if (isTree(p)) for (const part of VARIANTS[p.tree][p.variant].parts) triangles += part.mesh.indices.length / 3;
      else for (const part of p.model.parts) triangles += part.mesh.indices.length / 3;
    }
    for (const name of kitModels) for (const part of kit.models.get(name)!.parts) if (part.layer > 0) cards++;
    for (const band of bedBands()) triangles += band.mesh.indices.length / 3;
    triangles += surface().indices.length / 3;
    expect(figures.triangles).toBe(triangles + ROCK_TRIANGLES);
    expect(figures.cards).toBe(cards);
  });

  it("count the water's surface, which takes no more triangles than its ceiling and more than the old coarse sheet", () => {
    const water = surface().indices.length / 3;
    expect(water).toBe(SURFACE_TRIANGLES);
    expect(water).toBeLessThanOrEqual(SURFACE_CEILING);
    expect(water).toBeGreaterThan(24 * 128 * 2);
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
    expect(treeHeight('conifer', 22, 1)).toBeLessThan(SCENERY.trees.conifer[1]);
    expect(treeHeight('broadleaf', 0, 0)).toBe(SCENERY.trees.broadleaf[0]);
    expect(treeHeight('broadleaf', 0, 1)).toBe(SCENERY.trees.broadleaf[1]);
  });

  it('keeps clear of the water, the angler and the shadow box top, as the spot trees do', () => {
    for (const p of woodland) {
      for (const [x, y] of footprint(p)) expect(inside(x, y, 0), label(p)).toBe(false);
      for (const [x, y] of footprint(p)) expect(Math.hypot(x - ANGLER.x, y - ANGLER.y)).toBeGreaterThanOrEqual(5);
      expect(topOf(p)).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
      expect(p.z).toBe(bareGround(p.x, p.y));
    }
  });

  it('is at true scale: tall as the kit’s trees were, up to the shadow box', () => {
    // the plateau, and the tallest tree on it, and a unit to spare
    expect(SHADOW_BOX.max[2]).toBe(BANK_TOP + CLIFF.height + 32 + 1);
    for (const p of woodland)
      expect(p.height).toBeGreaterThanOrEqual(
        Math.min(SCENERY.trees[p.tree][0], (SHADOW_BOX.max[2] - p.z) * 0.999) - 1e-9,
      );
  });

  it('costs the few triangles of the package’s trees: well under the kit’s three thousand a tree', () => {
    const tris = (p: TreePlacement) =>
      VARIANTS[p.tree][p.variant].parts.reduce((n, q) => n + q.mesh.indices.length / 3, 0);
    const mean = woodland.reduce((n, p) => n + tris(p), 0) / woodland.length;
    expect(mean).toBeLessThan(250);
  });
});

describe('the cliff in the scene', () => {
  const groups = new Scene().static(kit);
  const rock = groups.filter((g) => g.albedo === PALETTE.cliff);
  const lumps = cliffLumps();
  const slopeOf = (m: { positions: Float32Array; indices: ArrayLike<number> }, t: number) => {
    const p = (k: number) => [0, 1, 2].map((a) => m.positions[m.indices[t * 3 + k] * 3 + a]);
    const [a, b, c] = [p(0), p(1), p(2)];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return Math.acos(Math.abs(n[2]) / Math.hypot(...n));
  };

  it('draws the wall in rock: a face of the steep faces and the lumps along it, both in the cliff’s colour', () => {
    expect(rock).toHaveLength(1 + N_LUMPS);
    expect(groups.slice(0, GROUND).filter((g) => g.albedo === PALETTE.cliff)).toHaveLength(1 + N_LUMPS);
    expect(PALETTE.cliff[2], 'a cool rock').toBeGreaterThan(PALETTE.cliff[0]);
    for (const c of PALETTE.cliff) expect(c).toBeLessThan(0.25);
  });

  it('cuts the banks by slope: no face of the grass is steeper than the rock slope, every face of the rock is', () => {
    const [face] = rock;
    const banks = groups[BANKS].mesh;
    expect(face.mesh.indices.length / 3).toBeGreaterThan(200);
    for (let t = 0; t < face.mesh.indices.length / 3; t++)
      expect(slopeOf(face.mesh, t)).toBeGreaterThan(CLIFF.rockSlope);
    for (let t = 0; t < banks.indices.length / 3; t++) expect(slopeOf(banks, t)).toBeLessThanOrEqual(CLIFF.rockSlope);
  });

  it('keeps the rock face to the cliff’s sector, and draws all the banks otherwise', () => {
    const face = rock[0].mesh;
    for (let i = 0; i < face.positions.length; i += 3)
      expect(Math.abs(Math.atan2(face.positions[i + 1], face.positions[i] / STRETCH) - CLIFF.middle)).toBeLessThan(
        CLIFF.half + 0.05,
      );
    expect(groups[BANKS].mesh.indices.length / 3).toBeGreaterThan(30_000);
  });

  it('stands the lumps along the crest and the foot, as many as content says, none across a fall’s channel', () => {
    expect(lumps.filter((l) => l.where === 'crest')).toHaveLength(CLIFF.lumps.crest.count);
    expect(lumps.filter((l) => l.where === 'foot')).toHaveLength(CLIFF.lumps.foot.count);
    expect(lumps.filter((l) => l.where === 'face')).toHaveLength(CLIFF.lumps.face.count);
    for (const l of lumps) {
      for (const n of NOTCHES) {
        const lateral = Math.abs((l.x - n.x) * n.along[0] + (l.y - n.y) * n.along[1]);
        expect(lateral, `${l.where} lump at ${l.x},${l.y}`).toBeGreaterThan(n.width / 2 + Math.max(l.rx, l.ry) * 0.5);
      }
      // half sunk: its middle on the ground, so the lower half is in it
      if (l.where !== 'face') expect(l.z).toBeCloseTo(groundUnder(l.x, l.y), 6);
    }
    expect(rock.slice(1)).toHaveLength(lumps.length);
    // one placement to a group, at its lump
    rock.slice(1).forEach((g, i) => {
      expect(g.matrices.length).toBe(16);
      expect([g.matrices[12], g.matrices[13], g.matrices[14]]).toEqual(
        [lumps[i].x, lumps[i].y, lumps[i].z].map(Math.fround),
      );
    });
  });

  it('stands the foot lumps by the water and not in it, and the crest lumps on the crest', () => {
    for (const l of lumps.filter((q) => q.where === 'foot')) expect(inShore(l.x, l.y, 0), `${l.x},${l.y}`).toBe(false);
    for (const l of lumps.filter((q) => q.where === 'crest'))
      expect(l.z, `${l.x},${l.y}`).toBeGreaterThan(CLIFF.height * CLIFF.dip - 1);
  });

  it('sets the face’s lumps at mid height, sunk into the wall so a third of each shows, and none out in the air', () => {
    for (const l of lumps.filter((q) => q.where === 'face')) {
      expect(l.z, `${l.x},${l.y}`).toBeGreaterThan(CLIFF.height * 0.1);
      expect(l.z, `${l.x},${l.y}`).toBeLessThan(CLIFF.height * 0.9);
      // its middle is on or behind the wall: the ground at its middle is no lower than the lump's middle less its sinking
      expect(groundUnder(l.x, l.y), `${l.x},${l.y}`).toBeGreaterThanOrEqual(l.z - 1e-6);
    }
  });

  it('makes the lumps the same every call', () => {
    expect(cliffLumps()).toEqual(lumps);
  });

  it('stands no tree and no clump on the face, any corner of its footprint included', () => {
    for (const p of [...trees, ...of('clump')])
      for (const [x, y] of footprint(p)) expect(onFace(x, y), label(p)).toBe(false);
  });

  it('keeps every clump and tree out of a fall’s channel, from the foot to where the notch fills in', () => {
    for (const p of [...trees, ...of('clump')])
      for (const [x, y] of footprint(p)) expect(onFall(x, y), label(p)).toBe(false);
  });

  it('stands trees on the plateau, at the plateau’s height, and some', () => {
    const up = trees.filter((p) => p.z > CLIFF.height - 1);
    expect(up.length).toBeGreaterThan(8);
    for (const p of up) {
      expect(p.z).toBe(bareGround(p.x, p.y));
      expect(p.z + p.height).toBeLessThanOrEqual(SHADOW_BOX.max[2]);
    }
  });

  it('moves what the draws stood on the face onto the plateau, none lost, and leaves every other where it was', () => {
    // the counts are content's (the tests above hold them), and the ones outside the sector are the fixtures'; what is
    // in the sector now stands clear, and the plateau is wooded
    const inSector = trees.filter((p) => underCliff(p.x, p.y));
    expect(inSector.length).toBeGreaterThan(30);
    for (const p of inSector) for (const [x, y] of footprint(p)) expect(onFace(x, y), label(p)).toBe(false);
    expect(of('clump').filter((p) => underCliff(p.x, p.y)).length).toBeGreaterThan(5);
  });
});

describe('the cabin and the jetty in the scene', () => {
  it('stand no tree, clump or pebble on the deck or within the cabin’s keep-back, any corner of its footprint included', () => {
    for (const p of placements)
      for (const [x, y] of footprint(p)) {
        expect(jettyGap(x, y), label(p)).toBeGreaterThanOrEqual(CABIN.clear);
        expect(cabinGap(x, y), label(p)).toBeGreaterThanOrEqual(CABIN.clear);
      }
  });

  it('lose none to it: the counts are content’s, and a pebble slid off the deck stays at its distance from the water', () => {
    expect(trees).toHaveLength(236);
    expect(of('clump')).toHaveLength(SCENERY.clumps.count);
    expect(of('pebble')).toHaveLength(70);
    for (const p of of('pebble')) {
      const a = Math.atan2(p.y, p.x / STRETCH);
      const k = Math.hypot(p.x / STRETCH, p.y) / shoreRadius(a);
      expect(k, label(p)).toBeGreaterThanOrEqual(1.005 - 1e-9);
      expect(k, label(p)).toBeLessThanOrEqual(1.025 + 1e-9);
    }
  });

  it('keep the deck’s shore end bare of the old stones too, which the kit’s pebbles stand in for', () => {
    for (const p of of('pebble')) expect(jettyGap(p.x, p.y), label(p)).toBeGreaterThanOrEqual(CABIN.clear);
  });
});

describe('a scene dressed for a season', () => {
  const scene = new Scene();
  const summer = scene.static(kit);
  const autumn = scene.static(kit, seasonPalette('autumn'));

  it('is the same groups with the same meshes and matrices, and only the albedo moved', () => {
    expect(autumn).toHaveLength(summer.length);
    let moved = 0;
    autumn.forEach((g, i) => {
      expect(g.mesh, `the mesh of group ${i} is the same object`).toBe(summer[i].mesh);
      expect(g.matrices).toBe(summer[i].matrices);
      expect(g.matrices).toEqual(summer[i].matrices);
      if (g.albedo !== summer[i].albedo) moved++;
    });
    expect(moved).toBeGreaterThan(0);
  });

  it('wears the season’s ground, leaves and crowns', () => {
    const p = seasonPalette('autumn');
    const albedos = autumn.map((g) => g.albedo);
    for (const k of ['grass', 'leaves', 'crown'] as const) expect(albedos).toContainEqual(p[k]);
  });
});
