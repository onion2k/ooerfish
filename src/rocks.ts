/**
 * The lake's rocks as painted meshes: each boulder standing in the water and each lump of the cliff is a faceted lump
 * of its own, split so every triangle has its own vertices and painted, so the renderer's painted edge has ridges to
 * stroke. Each is its own mesh at its own stretch and is placed with a scale of one, because the painted build scales
 * a ridge's height by the placement's scale and would skew on a stretched instance. Without this the rocks would be
 * smooth balls and one stretched mesh, with no folds for the paint to find.
 *
 * Each is made from a seed of its own, by its place in the lake's content and never from the game's chance, so the
 * rocks are the same every run and one more rock moves no other. They are built once, the first time they are asked
 * for, and kept: a mesh is never built in a frame.
 */
import { painted, split, type PaintChoice } from 'artshape-render/mesh/paint';
import { at, built, lump } from 'artshape-render/mesh/lowpoly';
import type { Mesh } from 'artshape-render/mesh/types';
import { BOULDER_DOMES, ROCKS } from './lake';
import { place } from './matrix';
import { seeded } from './random';
import type { CliffLump } from './scene';

/** A painted rock and where it stands: its mesh, and the one matrix it is drawn at. */
export interface Rock {
  mesh: ReturnType<typeof painted>;
  matrix: Float32Array;
}

/** The seeds the rocks are cut from, by index: the boulders from one hundred and the cliff's lumps from two hundred. */
const BOULDER_SEED = 100;
const LUMP_SEED = 200;

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
  axes: [number, number, number],
  seed: number,
  choice: PaintChoice,
  budget: number,
  set: number,
  { floor = -Infinity, shape = (m) => m }: Shaping = {},
): Rock['mesh'] {
  const unit = built((b) =>
    lump(b, at(0, 0, 0), seeded(seed), ROCKS.rings, ROCKS.segments, axes, { give: ROCKS.give, floor }),
  );
  return painted(split(shape(unit)), {
    set,
    choice,
    ...(choice === 'ridge' ? { ridge: { budget, spacing: ROCKS.spacing } } : {}),
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

let boulders: Rock[] | undefined;

/**
 * One painted mesh to each boulder's dome, with its middle at the waterline and its waterline radius across, the upper
 * half stretched to how high it stands and the lower to how deep it is sunk, on the ridge choice with a budget by its
 * radius, and its matrix a scale of one at the dome's place and turn. The same meshes every call.
 */
export function boulderMeshes(): Rock[] {
  boulders ??= BOULDER_DOMES.map((d, i) => {
    const under = -d.base;
    const rise = d.tall - under;
    // where the dome meets the waterline, narrower than its foot
    const radius = d.wide * Math.sqrt(1 - (under / d.tall) ** 2);
    const mesh = rockMesh([radius, radius, 1], BOULDER_SEED + i, 'ridge', rockBudget(radius), 0, {
      shape: (m) => twoHalves(m, rise, under),
    });
    const matrix = new Float32Array(16);
    place(matrix, 0, d.x, d.y, 0, i * 1.3, 1);
    return { mesh, matrix };
  });
  return boulders;
}

let lumps: { key: string; rocks: Rock[] } | undefined;

/**
 * One painted mesh to each of the cliff's lumps (given, in their order), at the lump's own half-widths, on the gate's
 * choice and set two, its matrix a scale of one at the lump's place and yaw. Built once for the lumps first given, and
 * again only if they are not those.
 */
export function cliffLumpMeshes(of: readonly CliffLump[]): Rock[] {
  const key = of.map((l) => [l.x, l.y, l.z, l.yaw, l.rx, l.ry, l.rz].join()).join(';');
  if (lumps?.key === key) return lumps.rocks;
  const rocks = of.map((l, i) => {
    const matrix = new Float32Array(16);
    place(matrix, 0, l.x, l.y, l.z, l.yaw, 1);
    return { mesh: rockMesh([l.rx, l.ry, l.rz], LUMP_SEED + i, 'gate', 0, 2, { floor: ROCKS.floor * l.rz }), matrix };
  });
  lumps = { key, rocks };
  return rocks;
}
