/**
 * The lake's rocks as painted meshes: each boulder standing in the water and each lump of the cliff is a faceted lump
 * of its own, split so every triangle has its own vertices and painted, so the renderer's painted edge has ridges to
 * stroke. Each is its own mesh at its own stretch and is placed with a scale of one, because the painted build scales
 * a ridge's height by the placement's scale and would skew on a stretched instance. Without this the rocks would be
 * smooth balls and one stretched mesh, with no folds for the paint to find.
 *
 * Each is made from a seed of its own, by its place in the lake's content and never from the game's chance, so the
 * rocks are the same every run and one more rock moves no other. They are built once, the first time they are asked
 * for, and kept: a mesh is never built in a frame. They are kept for each lake, so a second lake builds its own and the
 * first's stay.
 */
import { painted, split, type PaintChoice } from 'artshape-render/mesh/paint';
import { at, built, lump } from 'artshape-render/mesh/lowpoly';
import type { Mesh } from 'artshape-render/mesh/types';
import { SNOW } from './lake';
import type { Lake, RockFigures } from './lakes/lake';
import { place } from './matrix';
import { seeded } from './random';
import type { CliffLump } from './scene';

/** A painted rock and where it stands: its mesh, and the one matrix it is drawn at. */
export interface Rock {
  mesh: ReturnType<typeof painted>;
  matrix: Float32Array;
}

/**
 * How many ridgelines a rock of a world radius carries: one for a pebble, two for a stone and three for a boulder.
 * The experiments' pebble had one and its boulder three, at a radius of one and two at forty times that; the lake's
 * own sizes are a boulder of 0.9 to 1.8 across its waterline and a lump of 2 to 5, so the cut is at 1.5 and 3.
 */
export function rockBudget(worldRadius: number): number {
  return worldRadius < 1.5 ? 1 : worldRadius < 3 ? 2 : 3;
}

/** What shapes a rock before it is split and painted: its floor, and a change to the built mesh. */
interface Shaping {
  floor?: number;
  shape?: (mesh: Mesh) => Mesh;
}

/** One rock's faceted mesh, split and painted: `axes` its half-widths, `seed` its cut, `choice` which ridges, `set` which paint. */
function rockMesh(
  rocks: RockFigures,
  axes: [number, number, number],
  seed: number,
  choice: PaintChoice,
  budget: number,
  set: number,
  { floor = -Infinity, shape = (m) => m }: Shaping = {},
): Rock['mesh'] {
  const unit = built((b) =>
    lump(b, at(0, 0, 0), seeded(seed), rocks.rings, rocks.segments, axes, { give: rocks.give, floor }),
  );
  return painted(split(shape(unit)), {
    set,
    choice,
    ...(choice === 'ridge' ? { ridge: { budget, spacing: rocks.spacing } } : {}),
  });
}

/**
 * A mesh built at a height of one, its upper half stretched to `up` and its lower to `down`, with every facet's normal
 * worked out again: the domes are sunk so deep that a lump at their own stretch would show only its pole's fan above the
 * water, and every boulder would be a pyramid.
 */
function twoHalves(mesh: Mesh, up: number, down: number): Mesh {
  const s = split(mesh);
  const p = s.positions;
  for (let i = 2; i < p.length; i += 3) p[i] *= p[i] > 0 ? up : down;
  const n = s.normals;
  for (let t = 0; t < p.length; t += 9) {
    const ax = p[t + 3] - p[t],
      ay = p[t + 4] - p[t + 1],
      az = p[t + 5] - p[t + 2];
    const bx = p[t + 6] - p[t],
      by = p[t + 7] - p[t + 1],
      bz = p[t + 8] - p[t + 2];
    let nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (let k = 0; k < 3; k++) {
      n[t + k * 3] = nx;
      n[t + k * 3 + 1] = ny;
      n[t + k * 3 + 2] = nz;
    }
  }
  return s;
}

const boulders = new WeakMap<Lake, Rock[]>();

/**
 * One painted mesh to each boulder's dome, with its middle at the waterline and its waterline radius across, the upper
 * half stretched to how high it stands and the lower to how deep it is sunk, on the ridge choice with a budget by its
 * radius, and its matrix a scale of one at the dome's place and turn. The same meshes every call. The seeds are the lake's
 * (`scenery.seeds`: the boulders count up from one, the cliff's lumps from another).
 */
export function boulderMeshes(lake: Lake): Rock[] {
  const kept = boulders.get(lake);
  if (kept) return kept;
  const made = lake.domes.map((d, i) => {
    const under = -d.base;
    const rise = d.tall - under;
    // where the dome meets the waterline, narrower than its foot
    const radius = d.wide * Math.sqrt(1 - (under / d.tall) ** 2);
    const mesh = rockMesh(
      lake.rocks,
      [radius, radius, 1],
      lake.scenery.seeds.boulder + i,
      'ridge',
      rockBudget(radius),
      0,
      {
        shape: (m) => twoHalves(m, rise, under),
      },
    );
    const matrix = new Float32Array(16);
    place(matrix, 0, d.x, d.y, 0, i * 1.3, 1);
    return { mesh, matrix };
  });
  boulders.set(lake, made);
  return made;
}

const lumps = new WeakMap<Lake, { key: string; rocks: Rock[] }>();

/**
 * One painted mesh to each of the cliff's lumps (given, in their order), at the lump's own half-widths, on the gate's
 * choice and set two, its matrix a scale of one at the lump's place and yaw. Built once for the lumps first given, and
 * again only if they are not those.
 */
export function cliffLumpMeshes(of: readonly CliffLump[], lake: Lake): Rock[] {
  const key = of.map((l) => [l.x, l.y, l.z, l.yaw, l.rx, l.ry, l.rz].join()).join(';');
  const kept = lumps.get(lake);
  if (kept?.key === key) return kept.rocks;
  const rocks = of.map((l, i) => {
    const matrix = new Float32Array(16);
    place(matrix, 0, l.x, l.y, l.z, l.yaw, 1);
    return {
      mesh: rockMesh(lake.rocks, [l.rx, l.ry, l.rz], lake.scenery.seeds.lump + i, 'gate', 0, 2, {
        floor: lake.rocks.floor * l.rz,
      }),
      matrix,
    };
  });
  lumps.set(lake, { key, rocks });
  return rocks;
}

/**
 * The snow on a split rock: the faces that look up (a normal's z over `SNOW.facing`) and sit above `SNOW.from` of the
 * rock's `rise` (by their middle, so the foot stays bare), each lifted `SNOW.lift` along its normal so the cap lies
 * clear of the rock and does not fight it in depth. A mesh of its own with every vertex its own and no paint, so the
 * snow has no ridges to stroke: it reads as a soft white cover and not as more stone. Pure, and the same every call.
 */
export function snowCap(rock: Mesh, rise: number): Mesh {
  const p = rock.positions,
    n = rock.normals;
  const keep: number[] = [];
  for (let t = 0; t < p.length; t += 9) {
    if (n[t + 2] > SNOW.facing && (p[t + 2] + p[t + 5] + p[t + 8]) / 3 > SNOW.from * rise) keep.push(t);
  }
  const positions = new Float32Array(keep.length * 9),
    normals = new Float32Array(keep.length * 9);
  keep.forEach((t, k) => {
    for (let v = 0; v < 9; v++) {
      normals[k * 9 + v] = n[t + v];
      positions[k * 9 + v] = p[t + v] + SNOW.lift * n[t + v];
    }
  });
  const vertices = keep.length * 3;
  return {
    positions,
    normals,
    uvs: new Float32Array(vertices * 2),
    indices: Uint32Array.from({ length: vertices }, (_, i) => i),
  };
}

/** A rock's snow cap and the matrix it shares with the rock. */
export interface Cap {
  mesh: Mesh;
  matrix: Float32Array;
}

const capped = new WeakMap<Lake, { boulders: Rock[]; lumps: Rock[]; caps: Cap[] }>();

/**
 * The snow cap of every rock of a lake, the boulders first and then the cliff's lumps (given, as `cliffLumpMeshes`
 * has them), in the order of the rocks' groups, each at the rock's own matrix object. A dome rises by its height over
 * the waterline, a lump by its z half-width. Built once, with the rocks, and again only if the rocks are not those.
 */
export function rockCaps(lake: Lake, of: readonly CliffLump[]): Cap[] {
  const domes = boulderMeshes(lake);
  const stones = cliffLumpMeshes(of, lake);
  const kept = capped.get(lake);
  if (kept && kept.boulders === domes && kept.lumps === stones) return kept.caps;
  const caps = [
    ...domes.map(({ mesh, matrix }, i) => ({ mesh: snowCap(mesh, lake.domes[i].tall + lake.domes[i].base), matrix })),
    ...stones.map(({ mesh, matrix }, i) => ({ mesh: snowCap(mesh, of[i].rz), matrix })),
  ];
  capped.set(lake, { boulders: domes, lumps: stones, caps });
  return caps;
}
