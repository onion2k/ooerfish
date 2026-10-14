/**
 * The lake as it is drawn: its bed and banks, the stones along its shore, the
 * rocks and waterweed on its bed (which see-through water shows), and the
 * trees and clumps on its banks, which do not move. It is handed what it draws
 * from, the scenery kit when the page has loaded one, and never the renderer:
 * the page hands the groups on. The kit gives the pebbles and the bank's clumps;
 * the trees are the package's low-poly broadleaves and conifers (`trees.ts`),
 * whatever the kit holds. Without a kit it draws the old puffball trees and
 * ball stones, which the tests hold to the bit.
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
  BANK_TOP,
  BED_SHALLOWS,
  CABIN,
  CLIFF,
  NOTCHES,
  SCENERY,
  SHORE_RADIUS,
  STRETCH,
  bareGround,
  bedDepth,
  bowlDepthAt,
  cabinGap,
  groundUnder,
  inside,
  jettyGap,
  onFace,
  onFall,
  shoreRadius,
} from './lake';
import { place } from './matrix';
import { ball, box, sheet, splitBySlope } from './meshes';
import type { Mesh } from 'artshape-render/mesh/types';
import { PALETTE, mix, type Colour } from './palette';
import { boulderMeshes, cliffLumpMeshes } from './rocks';
import { seeded } from './random';
import { ROLE_COLOUR, type Kit, type KitModel, type SceneryRole } from './scenery';
import { TREE_COLOUR, TREE_ROUGHNESS, VARIANTS, treeBounds, treeFor, type TreeKind } from './trees';

/** How far out the banks are drawn, as a share of the shore's distance: past where the camera sees, so no edge shows. */
const BANKS_TO = 12;
/**
 * Where the banks' rings go, as stops of (from, to, how many rings): fine up the cliff's wall, where the ground rises
 * eighteen units in a few, then coarser behind it and packed outward to `BANKS_TO`. The sheet has enough segments round
 * that a fall's notch, two or three units wide, is a few of them.
 */
const BANK_STOPS: readonly [number, number, number][] = [
  [0.98, CLIFF.foot, 2],
  [CLIFF.foot, CLIFF.top + 0.04, 16],
  [CLIFF.top + 0.04, 1.6, 8],
];
const BANK_FAR_RINGS = 24;
const BANK_SEGMENTS = 360;

/** The rings the banks' sheet is laid out in. */
function bankRings(): number[] {
  const ks: number[] = [BANK_STOPS[0][0]];
  for (const [from, to, n] of BANK_STOPS) for (let i = 1; i <= n; i++) ks.push(from + (to - from) * (i / n));
  const last = BANK_STOPS[BANK_STOPS.length - 1][1];
  for (let i = 1; i <= BANK_FAR_RINGS; i++) ks.push(last + (BANKS_TO - last) * (i / BANK_FAR_RINGS) ** 1.5);
  return ks;
}

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
export const DRESSING_SEED = 4417;
/** How many tries a placement the cliff's face turned away gets to find a clear place on the plateau behind. */
const PLATEAU_TRIES = 200;
/** How far, in radians round the shore, a pebble slides at a time to get off the cabin's ground or the deck, and how many slides it gets. */
const SLIDE_STEP = 0.01;
const SLIDE_TRIES = 80;
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
export interface KitPlacement {
  model: KitModel;
  kind: 'pebble' | 'clump';
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

/** A tree set on the ground: which kind and which of its variants, where, turned how far, and how tall it stands. */
export interface TreePlacement {
  kind: 'tree';
  tree: TreeKind;
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  height: number;
}

export type Placement = KitPlacement | TreePlacement;

/** Where the old stones and trees stood, which the kit's pebbles and the package's trees keep. */
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

/** A band of the bed: from and to which shares of the shore's distance it reaches, and the colour it is drawn in. */
export interface BedCut {
  from: number;
  to: number;
  colour: Colour;
}

/** A band of the bed with the sheet it is drawn as. */
export interface BedBand extends BedCut {
  mesh: Mesh;
}

/** How many rings and segments the bed was drawn in as one sheet; the bands keep its rings and add one at each cut. */
const BED_RINGS = 28;
const BED_SEGMENTS = 160;

/** How far out from the middle, as a share of the shore's distance, the bowl is a depth deep: the bowl only shallows outward. */
function shareAtDepth(depth: number): number {
  let deep = 0,
    shallow = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (deep + shallow) / 2;
    if (bowlDepthAt(mid) > depth) deep = mid;
    else shallow = mid;
  }
  return (deep + shallow) / 2;
}

/**
 * Where the bed is cut into its bands and the colour of each: the slate out to where the water is the blend deeper
 * than the shallows' depth, the bands between cut evenly by radius from there to the shallows' depth, and the sand
 * from there out past the shore to the beach. Each takes the colour of the depth at its middle radius, so the
 * slate and the sand fall out of the same rule as the blend. Fewer than two bands could not hold both, and is refused.
 */
export function bedCuts(
  shallows: { depth: number; blend: number; bands: number; beach: number } = BED_SHALLOWS,
  sand: Colour = PALETTE.sand,
  slate: Colour = PALETTE.bed,
): BedCut[] {
  const { depth, blend, bands, beach } = shallows;
  if (!Number.isInteger(bands) || bands < 2) throw new Error(`the bed needs two bands at least, not ${bands}`);
  const deep = shareAtDepth(depth + blend),
    shallow = shareAtDepth(depth);
  const edges = [0, deep];
  for (let i = 1; i < bands - 2; i++) edges.push(deep + ((shallow - deep) * i) / (bands - 2));
  // with only the two, the slate meets the sand at the shallows' depth itself
  if (bands === 2) edges[1] = shallow;
  else edges.push(shallow);
  edges.push(beach);
  const cuts: BedCut[] = [];
  for (let i = 0; i < bands; i++) {
    const t = Math.min(1, Math.max(0, (bowlDepthAt((edges[i] + edges[i + 1]) / 2) - depth) / blend));
    cuts.push({ from: edges[i], to: edges[i + 1], colour: mix(sand, slate, t) });
  }
  return cuts;
}

let bands: BedBand[] | undefined;

/**
 * The bed's bands as sheets, made once: each the ground without the boulders between its radii, on the rings the one
 * sheet had and a ring at each cut, so the bed is the shape it was and neighbouring bands meet on the same ring.
 */
export function bedBands(): readonly BedBand[] {
  bands ??= bedCuts().map((cut) => {
    const { beach } = BED_SHALLOWS;
    const rings = [cut.from];
    for (let i = 1; i < BED_RINGS; i++) {
      // the one sheet's rings, packed toward the middle as `sheet` packs them
      const k = beach * (i / BED_RINGS) ** 1.5;
      if (k > cut.from && k < cut.to) rings.push(k);
    }
    rings.push(cut.to);
    return { ...cut, mesh: sheet(ring, groundUnder, 0, 0, rings, BED_SEGMENTS) };
  });
  return bands;
}

/**
 * A tree's height: picked between its kind's two by `u`, then held down (a hair under, so rounding cannot tip it over)
 * so the top stays under the sun's shadow whatever the range says, for a tree standing at height `z`. A variant is one
 * tall, so the height is also the scale it is drawn at.
 */
export function treeHeight(tree: TreeKind, z: number, u: number): number {
  return Math.min(lerp(SCENERY.trees[tree], u), (SHADOW_BOX.max[2] - z) * 0.999);
}

/** A tree stood at a place from the three draws it takes of the dressing stream, in order: its pick, its turn and its height. */
function treeAt(x: number, y: number, pick: number, turn: number, size: number): TreePlacement {
  const z = bareGround(x, y);
  const { tree, variant } = treeFor(pick);
  return { kind: 'tree', tree, variant, x, y, z, yaw: turn * Math.PI * 2, height: treeHeight(tree, z, size) };
}

/** A lump of rock embedded in the cliff: where it is, which way it is turned, and its half-widths along the wall, out from it and up. */
export interface CliffLump {
  where: 'crest' | 'foot' | 'face';
  x: number;
  y: number;
  z: number;
  yaw: number;
  rx: number;
  ry: number;
  rz: number;
}

/**
 * The lumps of rock along the cliff's crest and its foot, drawn from a seed of their own so nothing else moves: each
 * kind spread evenly across the part of the wall that stands whole, jittered, its middle on the ground (so the lower
 * half is sunk in the wall or the ledge), and slid along the wall from any fall's channel, which is left bare for the
 * water. The same every call.
 */
export function cliffLumps(): CliffLump[] {
  const random = seeded(CLIFF.seed);
  const reach = CLIFF.half - CLIFF.edge - 0.04;
  const out: CliffLump[] = [];
  for (const where of ['crest', 'foot', 'face'] as const) {
    const { count, k, size, spread } = CLIFF.lumps[where];
    for (let i = 0; i < count; i++) {
      const rx = lerp(size, random());
      const ry = rx * (where === 'crest' ? 0.5 + random() * 0.3 : 0.8 + random() * 0.4);
      const rz = rx * (where === 'crest' ? 0.9 + random() * 0.5 : 0.6 + random() * 0.4);
      const turn = (random() - 0.5) * 0.6;
      let angle = CLIFF.middle + reach * (((i + 0.5 + (random() - 0.5) * 0.5) / count) * 2 - 1);
      let [x, y] = ring(k + (random() - 0.5) * spread, angle);
      // slid along the wall, away from a channel it would stand in, until it clears it
      for (let step = 0; step < 60; step++) {
        const n = NOTCHES.find(
          (m) => Math.abs((x - m.x) * m.along[0] + (y - m.y) * m.along[1]) < m.width / 2 + Math.max(rx, ry) * 0.5 + 0.5,
        );
        if (!n) break;
        const side = (x - n.x) * n.along[0] + (y - n.y) * n.along[1] >= 0 ? 1 : -1;
        // along runs clockwise, so a positive side is further clockwise, a smaller angle
        angle -= side * 0.01;
        [x, y] = ring(k, angle);
      }
      let z = groundUnder(x, y);
      if (where === 'face') {
        // sunk two thirds into the wall: its middle a third of its depth back from the face, so a third of its width shows
        const l = Math.hypot(x, y);
        x += (x / l) * (ry / 3);
        y += (y / l) * (ry / 3);
        z = Math.min(z, groundUnder(x, y));
      }
      out.push({ where, x, y, z, yaw: Math.atan2(y, x) + Math.PI / 2 + turn, rx, ry, rz });
    }
  }
  return out;
}

export class Scene {
  /**
   * Everything the one seeded stream draws, in the order it always has: the stones, trees, bed rocks and weed (the
   * boulders are `rocks.ts`'s, from seeds of their own). The stones' and trees' spots are kept for the kit, which stands its own models on them.
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
      place(stones, i, x, y, bareGround(x, y) - size * 0.25, random() * Math.PI, size * 1.3, size, size * 0.7);
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
      const z = bareGround(x, y);
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
      place(rocks, i, x, y, bareGround(x, y) - size * 0.3, random() * Math.PI, size * 1.2, size, size * 0.7);
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
        place(blades, c * BLADES + b, x, y, bareGround(x, y), random() * Math.PI, 0.18, 0.5, tall);
      }
    }

    return { stones, trunks, puffs, rocks, blades, stoneSpots, treeSpots };
  }

  /**
   * What stands on the banks: a pebble at each old stone's place, a tree at each old tree's, and the bank clumps,
   * picked, turned and scaled from the dressing's own stream, and then the woodland. The trees take three draws each,
   * as the kit's did, so the pebbles and clumps are where they always were, and the woodland is drawn last and stands
   * last in the list, and the cliff turns away what it must. The same every call.
   */
  placements(kit: Kit): Placement[] {
    const { stoneSpots, treeSpots } = this.layout();
    const random = seeded(DRESSING_SEED);
    // by name, so the pick does not depend on the order the manifest happens to list the models in
    const named = [...kit.models.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    const pick = (models: KitModel[]) => models[Math.floor(random() * models.length)];
    const out: Placement[] = [];
    // the cliff's face is bare rock, and a placement the draws stood with a corner of its footprint on it is moved onto
    // the plateau behind, from a stream of the cliff's own, after the draws: every other is exactly where it would have
    // been, none is lost, and the counts are the content's
    // what the cabin or the deck turned away is moved from a stream of its own, so the cliff's are where they were
    const spareCliff = seeded(CLIFF.seed + 1);
    const spareForCabin = seeded(CLIFF.seed + 2);
    // a pebble the draws stood on the jetty's shore end slides along the shore to the nearest bank beside it, at the same
    // distance from the water: it is one pebble still, and the stream is not touched
    const alongShore = (make: (x: number, y: number) => KitPlacement, drawn: KitPlacement): KitPlacement => {
      const free = (p: KitPlacement) => footprint(p).every(([x, y]) => clearOfCabin(x, y));
      if (free(drawn)) return drawn;
      const angle = Math.atan2(drawn.y, drawn.x / STRETCH);
      const k = Math.hypot(drawn.x / STRETCH, drawn.y) / shoreRadius(angle);
      for (let n = 1; n <= SLIDE_TRIES; n++)
        for (const sign of [1, -1]) {
          const [x, y] = ring(k, angle + sign * n * SLIDE_STEP);
          const moved = make(x, y);
          if (free(moved)) return moved;
        }
      return drawn;
    };
    const onPlateau = (
      make: (x: number, y: number) => Placement,
      drawn: Placement,
      [lo, hi]: readonly [number, number],
      near = false,
    ) => {
      const offCliff = (p: Placement) => footprint(p).every(([x, y]) => !onFace(x, y) && !onFall(x, y));
      const clear = (p: Placement) => offCliff(p) && footprint(p).every(([x, y]) => clearOfCabin(x, y));
      if (clear(drawn)) return drawn;
      // the cliff's own turned away keep their stream; those only the cabin or the deck turned away take the other
      const spare = offCliff(drawn) ? spareForCabin : spareCliff;
      let moved = drawn;
      for (let tries = 0; tries < PLATEAU_TRIES; tries++) {
        const angle = CLIFF.middle + (spare() * 2 - 1) * (CLIFF.half - CLIFF.edge - 0.05);
        // further out as it goes, by a square root, as the woodland is, or nearer by a square, as the clumps are
        const u = spare();
        const from = Math.max(lo, CLIFF.top + 0.3);
        const [x, y] = ring(from + (hi - from) * (near ? u * u : Math.sqrt(u)), angle);
        moved = make(x, y);
        if (clear(moved)) break;
      }
      return moved;
    };

    const pebbles = named.filter((m) => m.kind === 'pebble');
    for (const { x, y } of stoneSpots) {
      const model = pick(pebbles);
      const yaw = random() * Math.PI * 2;
      const scale = lerp(SCENERY.pebbles.scale, random());
      const stone = (x: number, y: number): KitPlacement => ({
        model,
        kind: 'pebble',
        x,
        y,
        z: bareGround(x, y) - SCENERY.pebbles.sunk * model.bounds.max[2] * scale,
        yaw,
        scale,
      });
      out.push(alongShore(stone, stone(x, y)));
    }

    // a tree is three draws, a pick, a turn and a height, as the kit's were, so the clumps drawn after them are where
    // they always were; the pick is a draw of the tree's own and not its place in the list
    for (const { x, y } of treeSpots) {
      const pick = random(),
        turn = random(),
        size = random();
      out.push(onPlateau((x, y) => treeAt(x, y, pick, turn, size), treeAt(x, y, pick, turn, size), [1.5, 2.3]));
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
      const placed: Placement = { model, kind: 'clump', x, y, z: bareGround(x, y), yaw, scale };
      if (
        !footprint(placed).every(
          ([fx, fy]) => !inside(fx, fy, 0) && Math.hypot(fx - ANGLER.x, fy - ANGLER.y) >= SCENERY.clumps.clear,
        )
      )
        continue;
      out.push(onPlateau((x, y) => ({ ...placed, x, y, z: bareGround(x, y) }), placed, [1.5, 2.5], true));
      made++;
    }

    // the woodland: more trees in a band out from the banks, denser further out by a square root, the near south bank
    // kept clear; the top held under the sun's shadow as the spot trees' are
    const { count, band, southBand } = SCENERY.woodland;
    for (let i = 0; i < count; i++) {
      const draw = random();
      const angle = random() * Math.PI * 2;
      const u = Math.sqrt(random());
      const [lo, hi] = Math.sin(angle) < -0.55 ? southBand : band;
      const [x, y] = ring(lo + (hi - lo) * u, angle);
      const turn = random();
      const size = random();
      out.push(onPlateau((x, y) => treeAt(x, y, draw, turn, size), treeAt(x, y, draw, turn, size), [lo, hi]));
    }
    return out;
  }

  /** What does not move. With the kit, the banks wear it; without, the old stones and puffball trees. */
  static(kit?: Kit): GameGroup[] {
    const { stones, trunks, puffs, rocks, blades } = this.layout();
    // the bed and the banks, one height in sheets of their own colours, meeting under the water at the shore: the bed's
    // bands from the slate of the deep to the sand of the shallows, and the banks; the sheets are the ground without
    // the boulders, which are drawn on it as their own
    // the banks, cut by slope: the grass where the ground is gentle, the rock where it leans past the rock slope
    const { steep, gentle } = splitBySlope(sheet(ring, groundUnder, 0, 0, bankRings(), BANK_SEGMENTS), CLIFF.rockSlope);
    const one = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    const groups: GameGroup[] = [
      ...bedBands().map((band) => ({ mesh: band.mesh, matrices: one, albedo: band.colour, roughness: 0.95 })),
      // the boulders and the cliff's lumps are faceted rock with a painted edge, a group each at its own stretch
      ...boulderMeshes().map(({ mesh, matrix }) => ({
        mesh,
        matrices: matrix,
        albedo: PALETTE.boulder,
        roughness: 0.8,
      })),
      { mesh: ball(1, 3, 6), matrices: rocks, albedo: PALETTE.bedRock, roughness: 0.85 },
      { mesh: box(1, 1, 1), matrices: blades, albedo: PALETTE.weed, roughness: 0.8 },
      { mesh: gentle, matrices: one, albedo: PALETTE.grass, roughness: 0.9 },
      { mesh: steep, matrices: one, albedo: PALETTE.cliff, roughness: 0.92 },
      ...cliffLumpMeshes(cliffLumps()).map(({ mesh, matrix }) => ({
        mesh,
        matrices: matrix,
        albedo: PALETTE.cliff,
        roughness: 0.92,
      })),
    ];
    if (!kit) {
      groups.push(
        { mesh: ball(1, 4, 7), matrices: stones, albedo: PALETTE.stone, roughness: 0.8 },
        { mesh: box(0.7, 0.7, 1), matrices: trunks, albedo: PALETTE.trunk, roughness: 0.9 },
        { mesh: ball(3.2, 5, 9), matrices: puffs, albedo: PALETTE.leaves, roughness: 0.85 },
      );
      return groups;
    }

    // one group per part of each kit model that stands anywhere, its placements being that model's; the kit gives the
    // pebbles and the clumps, and the trees are drawn from the package's below
    const all = this.placements(kit);
    const by = new Map<string, KitPlacement[]>();
    for (const p of all) if (p.kind !== 'tree') by.set(p.model.name, [...(by.get(p.model.name) ?? []), p]);
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

    // one group per part of each variant that stands anywhere: the variant is one tall, so a tree's matrix scales it to
    // its height all round, and the parts of a variant share the matrices
    for (const tree of ['broadleaf', 'conifer'] as const)
      VARIANTS[tree].forEach((variant, v) => {
        const there = all.filter((p): p is TreePlacement => p.kind === 'tree' && p.tree === tree && p.variant === v);
        if (there.length === 0) return;
        const matrices = new Float32Array(there.length * 16);
        there.forEach((p, i) => place(matrices, i, p.x, p.y, p.z, p.yaw, p.height));
        for (const part of variant.parts)
          groups.push({
            mesh: part.mesh,
            matrices,
            albedo: PALETTE[TREE_COLOUR[tree][part.name]],
            roughness: TREE_ROUGHNESS[tree][part.name],
          });
      });
    return groups;
  }
}

/** What the kit puts on the banks, in figures: the test API's `scenery()`, and what a smoke stage holds the page to. */
export interface SceneryFigures {
  /** Kit models and tree variants stood at least once. */
  models: number;
  /** Placements of the kit's models and the trees, and of the rocks (a boulder or a cliff's lump, each its own mesh). */
  placements: number;
  /** Triangles drawn: each part's, once a placement, and the bed's bands'. */
  triangles: number;
  /** Groups drawn as cut cards. */
  cards: number;
}

/** The figures of a set of placements, worked out from them as `static` makes its groups from them. */
export function sceneryFigures(placements: Placement[]): SceneryFigures {
  const placed = new Set<KitModel>();
  const variants = new Set<string>();
  let triangles = 0;
  for (const p of placements) {
    if (p.kind === 'tree') {
      variants.add(`${p.tree}${p.variant}`);
      for (const part of VARIANTS[p.tree][p.variant].parts) triangles += part.mesh.indices.length / 3;
    } else {
      placed.add(p.model);
      for (const part of p.model.parts) triangles += part.mesh.indices.length / 3;
    }
  }
  let cards = 0;
  for (const model of placed) for (const part of model.parts) if (part.layer > 0) cards++;
  // the rocks, each a placement of a mesh of its own: the boulders in the water and the cliff's lumps
  const rocks = [...boulderMeshes(), ...cliffLumpMeshes(cliffLumps())];
  for (const rock of rocks) triangles += rock.mesh.indices.length / 3;
  // the bed's bands, drawn once each and counted with the rest, so a band given rings of its own shows in the figure
  for (const band of bedBands()) triangles += band.mesh.indices.length / 3;
  return { models: placed.size + variants.size, placements: placements.length + rocks.length, triangles, cards };
}

/** Whether a point is clear of the cabin's roof and the jetty's deck, and the keep-back round them. */
function clearOfCabin(x: number, y: number): boolean {
  return cabinGap(x, y) >= CABIN.clear && jettyGap(x, y) >= CABIN.clear;
}

/** The corners of a placement's footprint on the ground, after its yaw and scale, and its middle. */
export function footprint(p: Placement): [number, number][] {
  const { min, max } = p.kind === 'tree' ? treeBounds(p.tree, p.variant) : p.model.bounds;
  const scale = p.kind === 'tree' ? p.height : p.scale;
  const c = Math.cos(p.yaw),
    s = Math.sin(p.yaw);
  const at = (x: number, y: number): [number, number] => [p.x + (c * x - s * y) * scale, p.y + (s * x + c * y) * scale];
  return [at(0, 0), at(min[0], min[1]), at(max[0], min[1]), at(min[0], max[1]), at(max[0], max[1])];
}

/**
 * What the sun's shadow is fitted to: the lake and the banks round it, up to the tallest tree standing on the cliff's
 * plateau (the trees at true scale stand up to thirty-two tall, on a plateau twenty over the water), with a unit to
 * spare. It was forty before the cliff.
 */
export const SHADOW_BOX = {
  min: [-(SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH, -(SHORE_RADIUS * 1.5 + BANK_RISE), -8] as [number, number, number],
  max: [
    (SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH,
    SHORE_RADIUS * 1.5 + BANK_RISE,
    BANK_TOP + CLIFF.height + Math.max(...Object.values(SCENERY.trees).map((r) => r[1])) + 1,
  ] as [number, number, number],
};
