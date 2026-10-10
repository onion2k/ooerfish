/**
 * The lake as it is drawn: its bed and banks, the stones along its shore, the
 * rocks and waterweed on its bed (which see-through water shows), and the
 * trees and clumps on its banks, which do not move. It is handed what it draws
 * from, the scenery kit when the page has loaded one, and never the renderer:
 * the page hands the groups on. Without a kit it draws the old puffball trees
 * and ball stones, which the tests hold to the bit.
 *
 * Where the stones and trees stand is fixed, from a seed of its own and not
 * the game's, so the lake is the same lake every run and on every seed. The
 * kit's dressing (which model, how it is turned and how big, and the clumps)
 * has a stream of its own, so the draws the bed's rocks and weed come from
 * are the ones they always had, and tuning the dressing never moves them.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import {
  ANGLER,
  BANK_RISE,
  BOULDER_DOMES,
  SCENERY,
  SHORE_RADIUS,
  STRETCH,
  bedDepth,
  ground,
  groundUnder,
  inside,
  shoreRadius,
} from './lake';
import { place } from './matrix';
import { ball, box, sheet } from './meshes';
import { PALETTE } from './palette';
import { seeded } from './random';
import { ROLE_COLOUR, type Kit, type KitModel, type SceneryRole } from './scenery';

/** How far out the banks are drawn, as a share of the shore's distance: past where the camera sees, so no edge shows. */
const BANKS_TO = 12;
/** How many stones line the shore, and how many trees stand on the banks. */
const STONES = 70;
const TREES = 26;
/** How many rocks lie on the bed, and how many clumps of weed grow from it, of how many blades each. */
const ROCKS = 36;
const CLUMPS = 14;
const BLADES = 5;
/** The seed the stones and trees are placed from: the lake's own, so they stand still whatever the game's seed. */
const SCENERY_SEED = 1971;
/** The seed the kit's dressing is drawn from: a constant of its own, so it is independent of the stream above and of the game. */
const DRESSING_SEED = 4417;
/** How many tries a clump gets to find a dry, clear place before the dressing gives up on it (the count is then short, and a test says so). */
const TRIES = 40;

/** How rough each role's part is drawn: bark and grass matte, leaves a little less, stones as the old ones were. */
const ROUGHNESS: Record<SceneryRole, number> = {
  bark: 0.9,
  leaves: 0.85,
  pine: 0.85,
  flowers: 0.85,
  grass: 0.9,
  stone: 0.8,
  mushroom: 0.85,
};

/** A model of the kit set on the ground: where, turned how far about the vertical, and how big all round. */
export interface Placement {
  model: KitModel;
  kind: 'tree' | 'pebble' | 'clump';
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

/** Where the old stones and trees stood, which the kit's pebbles and trees keep. */
interface Spot {
  x: number;
  y: number;
}

const lerp = (range: readonly [number, number], k: number) => range[0] + (range[1] - range[0]) * k;

/** Where a ring `k` of the way out from the middle is, at an angle, on the lake's own stretched shape. */
function ring(k: number, angle: number): [number, number] {
  const r = k * shoreRadius(angle);
  return [Math.cos(angle) * r * STRETCH, Math.sin(angle) * r];
}

export class Scene {
  /**
   * Everything the one seeded stream draws, in the order it always has: the stones, trees, bed rocks and weed, and
   * the boulders. The stones' and trees' spots are kept for the kit, which stands its own models on them.
   */
  private layout() {
    const random = seeded(SCENERY_SEED);

    // stones along the water's edge, half sunk, of a few sizes
    const stones = new Float32Array(STONES * 16);
    const stoneSpots: Spot[] = [];
    for (let i = 0; i < STONES; i++) {
      const angle = ((i + random() * 0.6) / STONES) * Math.PI * 2;
      const [x, y] = ring(1.005 + random() * 0.02, angle);
      const size = 0.6 + random() * 0.7;
      place(stones, i, x, y, ground(x, y) - size * 0.25, random() * Math.PI, size * 1.3, size, size * 0.7);
      stoneSpots.push({ x, y });
    }

    // puffball trees on the banks, out of the way of the shore's view across the water
    const trunks = new Float32Array(TREES * 16),
      puffs = new Float32Array(TREES * 16);
    const treeSpots: Spot[] = [];
    for (let i = 0; i < TREES; i++) {
      const angle = ((i + random() * 0.8) / TREES) * Math.PI * 2;
      // none on the near bank the camera stands on, south of the middle
      const along = Math.sin(angle) < -0.55 ? 2.6 + random() * 1.5 : 1.3 + random() * 0.9;
      const [x, y] = ring(along, angle);
      const z = ground(x, y);
      const tall = 3 + random() * 3;
      place(trunks, i, x, y, z, 0, 1, 1, tall);
      place(puffs, i, x, y, z + tall + 2.2, random() * Math.PI, 1, 1, 0.9);
      treeSpots.push({ x, y });
    }

    // rocks on the bed, half sunk in it, anywhere from the shallows to the deep
    const rocks = new Float32Array(ROCKS * 16);
    for (let i = 0; i < ROCKS; i++) {
      const angle = random() * Math.PI * 2;
      const [x, y] = ring(0.12 + random() * 0.8, angle);
      const size = 0.7 + random() * 1.6;
      place(rocks, i, x, y, ground(x, y) - size * 0.3, random() * Math.PI, size * 1.2, size, size * 0.7);
    }

    // clumps of weed in the shallows, every blade under the water, the tallest reaching to just below it
    const blades = new Float32Array(CLUMPS * BLADES * 16);
    for (let c = 0; c < CLUMPS; c++) {
      const angle = random() * Math.PI * 2;
      const [cx, cy] = ring(0.25 + random() * 0.45, angle);
      for (let b = 0; b < BLADES; b++) {
        const x = cx + (random() - 0.5) * 1.6,
          y = cy + (random() - 0.5) * 1.6;
        const room = bedDepth(x, y) - 0.25;
        const tall = Math.max(0, room * (0.5 + random() * 0.5));
        place(blades, c * BLADES + b, x, y, ground(x, y), random() * Math.PI, 0.18, 0.5, tall);
      }
    }

    // the boulders, each a ball stretched to its dome, its lower half in the bed: rings enough that the cap out of the
    // water, a few of them at the top of a tall dome, is round and not the pole's cone
    const boulders = new Float32Array(BOULDER_DOMES.length * 16);
    BOULDER_DOMES.forEach((d, i) => place(boulders, i, d.x, d.y, d.base, i * 1.3, d.wide, d.wide, d.tall));

    return { stones, trunks, puffs, rocks, blades, boulders, stoneSpots, treeSpots };
  }

  /**
   * What the kit stands on the banks: a pebble at each old stone's place, a tree at each old tree's, and the bank
   * clumps, picked, turned and scaled from the dressing's own stream. The same every call.
   */
  placements(kit: Kit): Placement[] {
    const { stoneSpots, treeSpots } = this.layout();
    const random = seeded(DRESSING_SEED);
    // by name, so the pick does not depend on the order the manifest happens to list the models in
    const named = [...kit.models.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    const pick = (models: KitModel[]) => models[Math.floor(random() * models.length)];
    const out: Placement[] = [];

    const pebbles = named.filter((m) => m.kind === 'pebble');
    for (const { x, y } of stoneSpots) {
      const model = pick(pebbles);
      const yaw = random() * Math.PI * 2;
      const scale = lerp(SCENERY.pebbles.scale, random());
      out.push({
        model,
        kind: 'pebble',
        x,
        y,
        z: ground(x, y) - SCENERY.pebbles.sunk * model.bounds.max[2] * scale,
        yaw,
        scale,
      });
    }

    const trees = named.filter((m) => m.kind === 'tree' || m.kind === 'pine');
    for (const { x, y } of treeSpots) {
      const model = pick(trees);
      const yaw = random() * Math.PI * 2;
      const z = ground(x, y);
      // held down (a hair under, so rounding cannot tip it over) so the top stays under the sun's shadow, whatever the range says
      const scale = Math.min(
        lerp(SCENERY.trees[model.kind], random()),
        ((SHADOW_BOX.max[2] - z) / model.bounds.max[2]) * 0.999,
      );
      out.push({ model, kind: 'tree', x, y, z, yaw, scale });
    }

    // clumps: a kind by its weight, a model of it, a place nearer the water more often than far, and kept only if
    // dry to its corners and clear of the angler
    const kinds = Object.entries(SCENERY.clumps.kinds).filter(([k]) => named.some((m) => m.kind === k));
    const total = kinds.reduce((n, [, v]) => n + v.weight, 0);
    let made = 0;
    for (let tries = 0; made < SCENERY.clumps.count && tries < SCENERY.clumps.count * TRIES; tries++) {
      let at = random() * total;
      const [kind, spec] = kinds.find(([, v]) => (at -= v.weight) < 0) ?? kinds[kinds.length - 1];
      const model = pick(named.filter((m) => m.kind === kind));
      const angle = random() * Math.PI * 2;
      const u = random();
      const [x, y] = ring(1 + (SCENERY.clumps.reach - 1) * u * u, angle);
      const yaw = random() * Math.PI * 2;
      const scale = lerp(spec.scale, random());
      const placed: Placement = { model, kind: 'clump', x, y, z: ground(x, y), yaw, scale };
      if (
        !footprint(placed).every(
          ([fx, fy]) => !inside(fx, fy, 0) && Math.hypot(fx - ANGLER.x, fy - ANGLER.y) >= SCENERY.clumps.clear,
        )
      )
        continue;
      out.push(placed);
      made++;
    }
    return out;
  }

  /** What does not move. With the kit, the banks wear it; without, the old stones and puffball trees. */
  static(kit?: Kit): GameGroup[] {
    const { stones, trunks, puffs, rocks, blades, boulders } = this.layout();
    // the bed and the banks, one height in two sheets of two colours, meeting under the water at the shore
    // the sheets are the ground without the boulders, which are drawn on it as their own
    const bed = sheet(ring, groundUnder, 0, 1.04, 28, 160);
    const banks = sheet(ring, groundUnder, 0.98, BANKS_TO, 40, 160);
    const one = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    const groups: GameGroup[] = [
      { mesh: bed, matrices: one, albedo: PALETTE.bed, roughness: 0.95 },
      { mesh: ball(1, 16, 12), matrices: boulders, albedo: PALETTE.boulder, roughness: 0.8 },
      { mesh: ball(1, 3, 6), matrices: rocks, albedo: PALETTE.bedRock, roughness: 0.85 },
      { mesh: box(1, 1, 1), matrices: blades, albedo: PALETTE.weed, roughness: 0.8 },
      { mesh: banks, matrices: one, albedo: PALETTE.grass, roughness: 0.9 },
    ];
    if (!kit) {
      groups.push(
        { mesh: ball(1, 4, 7), matrices: stones, albedo: PALETTE.stone, roughness: 0.8 },
        { mesh: box(0.7, 0.7, 1), matrices: trunks, albedo: PALETTE.trunk, roughness: 0.9 },
        { mesh: ball(3.2, 5, 9), matrices: puffs, albedo: PALETTE.leaves, roughness: 0.85 },
      );
      return groups;
    }

    // one group per part of each model that stands anywhere, its placements being that model's
    const by = new Map<string, Placement[]>();
    for (const p of this.placements(kit)) by.set(p.model.name, [...(by.get(p.model.name) ?? []), p]);
    for (const model of kit.models.values()) {
      const there = by.get(model.name);
      if (!there) continue;
      const matrices = new Float32Array(there.length * 16);
      there.forEach((p, i) => place(matrices, i, p.x, p.y, p.z, p.yaw, p.scale));
      for (const part of model.parts)
        groups.push({
          mesh: part.mesh,
          matrices,
          albedo: PALETTE[ROLE_COLOUR[part.role]],
          roughness: ROUGHNESS[part.role],
          ...(part.layer > 0 ? { card: { layer: part.layer } } : {}),
        });
    }
    return groups;
  }
}

/** What the kit puts on the banks, in figures: the test API's `scenery()`, and what a smoke stage holds the page to. */
export interface SceneryFigures {
  /** Models of the kit stood at least once. */
  models: number;
  placements: number;
  /** Triangles drawn: each part's, once a placement. */
  triangles: number;
  /** Groups drawn as cut cards. */
  cards: number;
}

/** The figures of a set of placements, worked out from them as `static` makes its groups from them. */
export function sceneryFigures(placements: Placement[]): SceneryFigures {
  const placed = new Set<KitModel>();
  let triangles = 0;
  for (const p of placements) {
    placed.add(p.model);
    for (const part of p.model.parts) triangles += part.mesh.indices.length / 3;
  }
  let cards = 0;
  for (const model of placed) for (const part of model.parts) if (part.layer > 0) cards++;
  return { models: placed.size, placements: placements.length, triangles, cards };
}

/** The corners of a placement's footprint on the ground, after its yaw and scale, and its middle. */
export function footprint(p: Placement): [number, number][] {
  const { min, max } = p.model.bounds;
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  const at = (x: number, y: number): [number, number] => [
    p.x + (c * x - s * y) * p.scale,
    p.y + (s * x + c * y) * p.scale,
  ];
  return [at(0, 0), at(min[0], min[1]), at(max[0], min[1]), at(min[0], max[1]), at(max[0], max[1])];
}

/** What the sun's shadow is fitted to: the lake and the banks round it, up to the tallest tree. */
export const SHADOW_BOX = {
  min: [-(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, -(SHORE_RADIUS * 1.5 + BANK_RISE), -8] as [number, number, number],
  max: [(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, SHORE_RADIUS * 1.5 + BANK_RISE, 16] as [number, number, number],
};
