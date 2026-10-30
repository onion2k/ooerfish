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
import type { BedShallows, Lake } from './lakes/lake';
import { HOME } from './lakes';
import { place } from './matrix';
import { ball, box, sheet, splitBySlope } from './meshes';
import type { Mesh } from 'artshape-render/mesh/types';
import { PALETTE, mix, type Colour, type Palette } from './palette';
import { damMesh } from './dam';
import { boulderMeshes, cliffLumpMeshes, rockCaps } from './rocks';
import type { Season } from './lake';
import { seeded } from './random';
import { surface } from './water/surface';
import { ROLE_COLOUR, type Kit, type KitModel, type SceneryRole } from './scenery';
import { TREE_COLOUR, TREE_ROUGHNESS, VARIANTS, treeBounds, treeFor, type TreeKind } from './trees';

/** How many rings the far banks take beyond the stops, and how many segments the sheet has round. */
const BANK_FAR_RINGS = 24;
const BANK_SEGMENTS = 360;

/**
 * The rings the banks' sheet is laid out in: the lake's stops (`lake.scenery.banks`, fine up a cliff's wall where it has
 * one, then coarser and packed outward) and then out to how far the banks are drawn, past where the camera sees.
 */
function bankRings(lake: Lake): number[] {
  const { stops, to } = lake.scenery.banks;
  const ks: number[] = [stops[0][0]];
  for (const [from, end, n] of stops) for (let i = 1; i <= n; i++) ks.push(from + (end - from) * (i / n));
  const last = stops[stops.length - 1][1];
  for (let i = 1; i <= BANK_FAR_RINGS; i++) ks.push(last + (to - last) * (i / BANK_FAR_RINGS) ** 1.5);
  return ks;
}

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

/** Where a ring `k` of the way out from the middle is, at an angle, on a lake's own stretched shape. */
export function ringOn(lake: Lake): (k: number, angle: number) => [number, number] {
  return (k, angle) => {
    const r = k * lake.shoreRadius(angle);
    return [Math.cos(angle) * r * lake.stretch, Math.sin(angle) * r];
  };
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
function shareAtDepth(lake: Lake, depth: number): number {
  let deep = 0,
    shallow = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (deep + shallow) / 2;
    if (lake.bowlDepthAt(mid) > depth) deep = mid;
    else shallow = mid;
  }
  return (deep + shallow) / 2;
}

/**
 * Where the bed is cut into its bands and the colour of each: the slate out to where the water is the blend deeper
 * than the shallows' depth, the bands between cut evenly by radius from there to the shallows' depth, and the sand
 * from there out past the shore to the beach; where the blend reaches past the deepest point, the bands are cut evenly
 * from the middle and the deepest is a darkened sand. Each takes the colour of the depth at its middle radius, so the
 * slate and the sand fall out of the same rule as the blend. Fewer than two bands could not hold both, and is refused.
 */
export function bedCuts(
  lake: Lake,
  shallows?: BedShallows,
  sand: Colour = PALETTE.sand,
  slate: Colour = PALETTE.bed,
): BedCut[] {
  const { depth, blend, bands, beach } = shallows ?? lake.bedShallows;
  if (!Number.isInteger(bands) || bands < 2) throw new Error(`the bed needs two bands at least, not ${bands}`);
  const deep = shareAtDepth(lake, depth + blend),
    shallow = shareAtDepth(lake, depth);
  const edges = [0];
  // asked of the depth and not of the share, which at the deepest point comes out a hair over nought and not nought
  if (depth + blend < lake.maxDepth) {
    edges.push(deep);
    for (let i = 1; i < bands - 2; i++) edges.push(deep + ((shallow - deep) * i) / (bands - 2));
    // with only the two, the slate meets the sand at the shallows' depth itself
    if (bands === 2) edges[1] = shallow;
    else edges.push(shallow);
  } else {
    // the blend reaches past the deepest point, so no water is deep enough for the slate and its band would run from
    // the middle to the middle and draw nothing: the bands are cut evenly from the middle to the shallows' depth instead
    for (let i = 1; i < bands - 1; i++) edges.push((shallow * i) / (bands - 1));
    edges.push(shallow);
  }
  edges.push(beach);
  const cuts: BedCut[] = [];
  for (let i = 0; i < bands; i++) {
    const t = Math.min(1, Math.max(0, (lake.bowlDepthAt((edges[i] + edges[i + 1]) / 2) - depth) / blend));
    // the band that is all sand is the sand itself, not a mixed copy of it, so a season may recolour it by name
    cuts.push({ from: edges[i], to: edges[i + 1], colour: t === 0 ? sand : mix(sand, slate, t) });
  }
  return cuts;
}

const bands = new WeakMap<Lake, BedBand[]>();

/**
 * The bed's bands as sheets, made once for each lake: each the ground without the boulders between its radii, on the
 * rings the one sheet had and a ring at each cut, so the bed is the shape it was and neighbouring bands meet on the
 * same ring.
 */
export function bedBands(lake: Lake): readonly BedBand[] {
  let made = bands.get(lake);
  if (made) return made;
  const ring = ringOn(lake);
  made = bedCuts(lake, undefined, PALETTE.sand, PALETTE.bed).map((cut) => {
    const { beach } = lake.bedShallows;
    const rings = [cut.from];
    for (let i = 1; i < BED_RINGS; i++) {
      // the one sheet's rings, packed toward the middle as `sheet` packs them
      const k = beach * (i / BED_RINGS) ** 1.5;
      if (k > cut.from && k < cut.to) rings.push(k);
    }
    rings.push(cut.to);
    return { ...cut, mesh: sheet(ring, lake.groundUnder, 0, 0, rings, BED_SEGMENTS) };
  });
  bands.set(lake, made);
  return made;
}

/**
 * A tree's height: picked between its kind's two by `u`, then held down (a hair under, so rounding cannot tip it over)
 * so the top stays under the sun's shadow whatever the range says, for a tree standing at height `z`. A variant is one
 * tall, so the height is also the scale it is drawn at.
 */
export function treeHeight(tree: TreeKind, z: number, u: number, lake: Lake): number {
  return Math.min(lerp(lake.scenery.trees[tree], u), (lake.shadowBox.max[2] - z) * 0.999);
}

/** A tree stood at a place from the three draws it takes of the dressing stream, in order: its pick, its turn and its height. */
function treeAt(lake: Lake, x: number, y: number, pick: number, turn: number, size: number): TreePlacement {
  const z = lake.bareGround(x, y);
  const { tree, variant } = treeFor(pick);
  return { kind: 'tree', tree, variant, x, y, z, yaw: turn * Math.PI * 2, height: treeHeight(tree, z, size, lake) };
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
 * water. The same every call, and none for a lake with no cliff.
 */
export function cliffLumps(lake: Lake): CliffLump[] {
  if (!lake.cliff) return [];
  const { spec: cliff, notches } = lake.cliff;
  const ring = ringOn(lake);
  const { groundUnder } = lake;
  const random = seeded(cliff.seed);
  const reach = cliff.half - cliff.edge - 0.04;
  const out: CliffLump[] = [];
  for (const where of ['crest', 'foot', 'face'] as const) {
    const { count, k, size, spread } = cliff.lumps[where];
    for (let i = 0; i < count; i++) {
      const rx = lerp(size, random());
      const ry = rx * (where === 'crest' ? 0.5 + random() * 0.3 : 0.8 + random() * 0.4);
      const rz = rx * (where === 'crest' ? 0.9 + random() * 0.5 : 0.6 + random() * 0.4);
      const turn = (random() - 0.5) * 0.6;
      let angle = cliff.middle + reach * (((i + 0.5 + (random() - 0.5) * 0.5) / count) * 2 - 1);
      let [x, y] = ring(k + (random() - 0.5) * spread, angle);
      // slid along the wall, away from a channel it would stand in, until it clears it
      for (let step = 0; step < 60; step++) {
        const n = notches.find(
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

/** The key a palette colour is under, by the colour itself, so a group built in `PALETTE` can be recoloured by name. */
const PALETTE_KEYS = new Map<Colour, keyof Palette>(
  (Object.keys(PALETTE) as (keyof Palette)[]).map((k) => [PALETTE[k], k]),
);

/** How near round the lake an angle must be to the open band's (as the cosine of the turn between them) to be on the bank the camera looks from. */
const OPEN_BANK = 0.55;

/** Whether a ring angle is on the bank the camera looks from, which the lake's scenery keeps open: the south bank at the Reservoir, the jetty's at the Duck Pond. */
function onOpenBank(lake: Lake, angle: number): boolean {
  return Math.cos(angle - lake.scenery.woodland.openBand.angle) > OPEN_BANK;
}

/** Stands for no kit as a key of the memo. */
const NO_KIT = {};

export class Scene {
  /** The lake it draws: the pond unless one is handed in, and every figure and sum of the lake's is read from it. */
  constructor(private readonly lake: Lake = HOME) {}

  /**
   * Everything the one seeded stream draws, in the order it always has: the stones, trees, bed rocks and weed (the
   * boulders are `rocks.ts`'s, from seeds of their own). The stones' and trees' spots are kept for the kit, which stands its own models on them.
   */
  private layout() {
    const { lake } = this;
    const { counts } = lake.scenery;
    const { stones: STONES, trees: TREES, rocks: ROCKS, clumps: CLUMPS, blades: BLADES } = counts;
    const { bareGround, bedDepth } = lake;
    const ring = ringOn(lake);
    const random = seeded(lake.scenery.seeds.scene);

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
      // none on the near bank the camera stands on (the woodland's open bank), which is kept to the outer rings
      const along = onOpenBank(lake, angle) ? 2.6 + random() * 1.5 : 1.3 + random() * 0.9;
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
    const { lake } = this;
    const { scenery, bareGround, onFace, onFall } = lake;
    const { stoneSpots, treeSpots } = this.layout();
    const random = seeded(scenery.seeds.dressing);
    const ring = ringOn(lake);
    const cliff = lake.cliff?.spec;
    const clearOfCabin = (x: number, y: number) => !lake.onCabinOrDeck(x, y);
    // by name, so the pick does not depend on the order the manifest happens to list the models in
    const named = [...kit.models.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    const pick = (models: KitModel[]) => models[Math.floor(random() * models.length)];
    const out: Placement[] = [];
    // the cliff's face is bare rock, and a placement the draws stood with a corner of its footprint on it is moved onto
    // the plateau behind, from a stream of the cliff's own, after the draws: every other is exactly where it would have
    // been, none is lost, and the counts are the content's
    // what the cabin or the deck turned away is moved from a stream of its own, so the cliff's are where they were
    const spareCliff = seeded((cliff?.seed ?? 0) + 1);
    const spareForCabin = seeded((cliff?.seed ?? 0) + 2);
    // a pebble the draws stood on the jetty's shore end slides along the shore to the nearest bank beside it, at the same
    // distance from the water: it is one pebble still, and the stream is not touched
    const alongShore = (make: (x: number, y: number) => KitPlacement, drawn: KitPlacement): KitPlacement => {
      const free = (p: KitPlacement) => footprint(p).every(([x, y]) => clearOfCabin(x, y));
      if (free(drawn)) return drawn;
      const angle = Math.atan2(drawn.y, drawn.x / lake.stretch);
      const k = Math.hypot(drawn.x / lake.stretch, drawn.y) / lake.shoreRadius(angle);
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
      // a lake with no cliff has no plateau to move a placement onto, and leaves it where it was drawn
      if (clear(drawn) || !cliff) return drawn;
      // the cliff's own turned away keep their stream; those only the cabin or the deck turned away take the other
      const spare = offCliff(drawn) ? spareForCabin : spareCliff;
      let moved = drawn;
      for (let tries = 0; tries < PLATEAU_TRIES; tries++) {
        const angle = cliff.middle + (spare() * 2 - 1) * (cliff.half - cliff.edge - 0.05);
        // further out as it goes, by a square root, as the woodland is, or nearer by a square, as the clumps are
        const u = spare();
        const from = Math.max(lo, cliff.top + 0.3);
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
      const scale = lerp(scenery.pebbles.scale, random());
      const stone = (x: number, y: number): KitPlacement => ({
        model,
        kind: 'pebble',
        x,
        y,
        z: bareGround(x, y) - scenery.pebbles.sunk * model.bounds.max[2] * scale,
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
      out.push(
        onPlateau((x, y) => treeAt(lake, x, y, pick, turn, size), treeAt(lake, x, y, pick, turn, size), [1.5, 2.3]),
      );
    }

    // clumps: a kind by its weight, a model of it, a place nearer the water more often than far, and kept only if
    // dry to its corners and clear of the angler
    const kinds = Object.entries(scenery.clumps.kinds).filter(([k]) => named.some((m) => m.kind === k));
    const total = kinds.reduce((n, [, v]) => n + v.weight, 0);
    let made = 0;
    for (let tries = 0; made < scenery.clumps.count && tries < scenery.clumps.count * TRIES; tries++) {
      let at = random() * total;
      const [kind, spec] = kinds.find(([, v]) => (at -= v.weight) < 0) ?? kinds[kinds.length - 1];
      const model = pick(named.filter((m) => m.kind === kind));
      const angle = random() * Math.PI * 2;
      const u = random();
      const [x, y] = ring(1 + (scenery.clumps.reach - 1) * u * u, angle);
      const yaw = random() * Math.PI * 2;
      const scale = lerp(spec.scale, random());
      const placed: Placement = { model, kind: 'clump', x, y, z: bareGround(x, y), yaw, scale };
      if (
        !footprint(placed).every(
          ([fx, fy]) =>
            !lake.inside(fx, fy, 0) && Math.hypot(fx - lake.angler.x, fy - lake.angler.y) >= scenery.clumps.clear,
        )
      )
        continue;
      out.push(onPlateau((x, y) => ({ ...placed, x, y, z: bareGround(x, y) }), placed, [1.5, 2.5], true));
      made++;
    }

    // the woodland: more trees in a band out from the banks, denser further out by a square root, the bank the camera
    // looks from (`openBand`) kept clear; the top held under the sun's shadow as the spot trees' are
    const { count, band, openBand } = scenery.woodland;
    for (let i = 0; i < count; i++) {
      const draw = random();
      const angle = random() * Math.PI * 2;
      const u = Math.sqrt(random());
      const [lo, hi] = onOpenBank(lake, angle) ? openBand.band : band;
      const [x, y] = ring(lo + (hi - lo) * u, angle);
      const turn = random();
      const size = random();
      out.push(
        onPlateau((x, y) => treeAt(lake, x, y, draw, turn, size), treeAt(lake, x, y, draw, turn, size), [lo, hi]),
      );
    }
    return out;
  }

  /**
   * What does not move. With the kit, the banks wear it; without, the old stones and puffball trees. The colours are the
   * palette handed in, the season's (`seasonPalette`): only the albedo of a group differs between seasons, never a mesh.
   */
  static(kit?: Kit, palette: Palette = PALETTE, season: Season = 'summer'): GameGroup[] {
    // the shapes (the sheets, the slope's cut, the rocks, the trees) depend on no colour, so they are built once for a
    // kit and a season only swaps the albedo of the groups that wear a palette colour: a rebuild at the wake is cheap
    const key = kit ?? NO_KIT;
    let base = this.built.get(key);
    if (!base) this.built.set(key, (base = this.build(kit)));
    const groups = base.map((g) => {
      const named = PALETTE_KEYS.get(g.albedo as Colour);
      return named && palette[named] !== g.albedo ? { ...g, albedo: palette[named] } : { ...g };
    });
    // winter's snow lies on every rock, a cap each after everything else so that no other group's slot moves; the caps
    // are built with the rocks, once, and share their matrices
    if (season !== 'winter') return groups;
    return [
      ...groups,
      ...rockCaps(this.lake, cliffLumps(this.lake)).map(({ mesh, matrix }) => ({
        mesh,
        matrices: matrix,
        albedo: palette.snow,
        roughness: 0.8,
      })),
    ];
  }

  /** The static groups of a kit, in `PALETTE`'s colours, made once per kit by `static`. */
  private readonly built = new WeakMap<object, GameGroup[]>();

  private build(kit?: Kit): GameGroup[] {
    const palette = PALETTE;
    const { lake } = this;
    const ring = ringOn(lake);
    const { stones, trunks, puffs, rocks, blades } = this.layout();
    // the bed and the banks, one height in sheets of their own colours, meeting under the water at the shore: the bed's
    // bands from the slate of the deep to the sand of the shallows, and the banks; the sheets are the ground without
    // the boulders, which are drawn on it as their own
    // the banks, cut by slope: the grass where the ground is gentle, the rock where it leans past the rock slope
    // (a lake with no cliff has no rock slope, so all its banks are the grass's)
    const { steep, gentle } = splitBySlope(
      sheet(ring, lake.groundUnder, 0, 0, bankRings(lake), BANK_SEGMENTS),
      lake.cliff?.spec.rockSlope ?? Infinity,
    );
    const one = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    const dam = damMesh(lake);
    const groups: GameGroup[] = [
      ...bedBands(lake).map((band) => ({ mesh: band.mesh, matrices: one, albedo: band.colour, roughness: 0.95 })),
      // the boulders and the cliff's lumps are faceted rock with a painted edge, a group each at its own stretch
      ...boulderMeshes(lake).map(({ mesh, matrix }) => ({
        mesh,
        matrices: matrix,
        albedo: palette.boulder,
        roughness: 0.8,
      })),
      { mesh: ball(1, 3, 6), matrices: rocks, albedo: palette.bedRock, roughness: 0.85 },
      { mesh: box(1, 1, 1), matrices: blades, albedo: palette.weed, roughness: 0.8 },
      { mesh: gentle, matrices: one, albedo: palette.grass, roughness: 0.9 },
      ...(lake.cliff ? [{ mesh: steep, matrices: one, albedo: palette.cliff, roughness: 0.92 }] : []),
      ...cliffLumpMeshes(cliffLumps(lake), lake).map(({ mesh, matrix }) => ({
        mesh,
        matrices: matrix,
        albedo: palette.cliff,
        roughness: 0.92,
      })),
      // a lake with a dam has its wall, a painted solid of concrete grey like the bank's stones
      ...(dam ? [{ mesh: dam, matrices: one, albedo: palette.stone, roughness: 0.85 }] : []),
    ];
    if (!kit) {
      groups.push(
        { mesh: ball(1, 4, 7), matrices: stones, albedo: palette.stone, roughness: 0.8 },
        { mesh: box(0.7, 0.7, 1), matrices: trunks, albedo: palette.trunk, roughness: 0.9 },
        { mesh: ball(3.2, 5, 9), matrices: puffs, albedo: palette.leaves, roughness: 0.85 },
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
          albedo: palette[ROLE_COLOUR[part.role]],
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
            albedo: palette[TREE_COLOUR[tree][part.name]],
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
  /** Triangles drawn: each part's, once a placement, the bed's bands' and the water's surface's. */
  triangles: number;
  /** Groups drawn as cut cards. */
  cards: number;
}

/** The figures of a set of placements, worked out from them as `static` makes its groups from them. */
export function sceneryFigures(placements: Placement[], lake: Lake): SceneryFigures {
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
  const rocks = [...boulderMeshes(lake), ...cliffLumpMeshes(cliffLumps(lake), lake)];
  for (const rock of rocks) triangles += rock.mesh.indices.length / 3;
  // the dam's wall, one painted mesh, if the lake has one
  triangles += (damMesh(lake)?.indices.length ?? 0) / 3;
  // the bed's bands, drawn once each and counted with the rest, so a band given rings of its own shows in the figure
  for (const band of bedBands(lake)) triangles += band.mesh.indices.length / 3;
  // the water's surface, drawn once, so a sheet made finer shows in the figure and is held under its ceiling
  triangles += surface(lake).indices.length / 3;
  return { models: placed.size + variants.size, placements: placements.length + rocks.length, triangles, cards };
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
