/**
 * The shapes the lake is made of. A box, a low-poly ball, a square and a disc
 * are built flat-shaded on purpose: cartoon things want hard edges, so their
 * faces do not share vertices and every normal is a face's. A sheet, the
 * ground and the water, is smooth, so a bank reads as a soft slope.
 *
 * Everything is in world units and Z is up, as the renderer has it.
 */
import { MeshBuilder, type Mesh } from 'artshape-render/mesh/types';

type V3 = [number, number, number];

/** One flat-shaded quad, wound counter-clockwise seen from the normal. */
function face(b: MeshBuilder, p0: V3, p1: V3, p2: V3, p3: V3) {
  const ux = p1[0] - p0[0],
    uy = p1[1] - p0[1],
    uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0],
    vy = p3[1] - p0[1],
    vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const a = b.vertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
  b.vertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0);
  b.vertex(p2[0], p2[1], p2[2], nx, ny, nz, 1, 1);
  b.vertex(p3[0], p3[1], p3[2], nx, ny, nz, 0, 1);
  b.quad(a, a + 1, a + 2, a + 3);
}

function tri(b: MeshBuilder, p0: V3, p1: V3, p2: V3) {
  const ux = p1[0] - p0[0],
    uy = p1[1] - p0[1],
    uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0],
    vy = p2[1] - p0[1],
    vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const a = b.vertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
  b.vertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0);
  b.vertex(p2[0], p2[1], p2[2], nx, ny, nz, 0.5, 1);
  b.triangle(a, a + 1, a + 2);
}

/** A box `w` along X, `d` along Y and `h` up Z, centred in X and Y and standing on z = 0, or centred in Z too. */
export function box(w: number, d: number, h: number, centred = false): Mesh {
  const b = new MeshBuilder();
  const x = w / 2,
    y = d / 2,
    z0 = centred ? -h / 2 : 0,
    z1 = z0 + h;
  face(b, [-x, -y, z1], [x, -y, z1], [x, y, z1], [-x, y, z1]);
  face(b, [-x, y, z0], [x, y, z0], [x, -y, z0], [-x, -y, z0]);
  face(b, [-x, -y, z0], [x, -y, z0], [x, -y, z1], [-x, -y, z1]);
  face(b, [x, y, z0], [-x, y, z0], [-x, y, z1], [x, y, z1]);
  face(b, [x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]);
  face(b, [-x, y, z0], [-x, -y, z0], [-x, -y, z1], [-x, y, z1]);
  return b.build();
}

/** A low-poly ball, centred. */
export function ball(radius: number, rings = 6, segments = 10): Mesh {
  const b = new MeshBuilder();
  const at = (i: number, j: number): V3 => {
    const phi = (i / rings) * Math.PI,
      th = (j / segments) * Math.PI * 2;
    return [Math.sin(phi) * Math.cos(th) * radius, Math.sin(phi) * Math.sin(th) * radius, Math.cos(phi) * radius];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      if (i === 0) tri(b, at(0, 0), at(1, j), at(1, j + 1));
      else if (i === rings - 1) tri(b, at(rings, 0), at(i, j + 1), at(i, j));
      else face(b, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  return b.build();
}

/** A flat unit square at z = 0, facing up, centred: stretched to size where it is placed. */
export function square(): Mesh {
  const b = new MeshBuilder();
  face(b, [-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]);
  return b.build();
}

/** A flat disc at z = 0, facing up. */
export function disc(radius: number, segments = 24): Mesh {
  const b = new MeshBuilder();
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2,
      a1 = ((i + 1) / segments) * Math.PI * 2;
    tri(
      b,
      [0, 0, 0],
      [Math.cos(a0) * radius, Math.sin(a0) * radius, 0],
      [Math.cos(a1) * radius, Math.sin(a1) * radius, 0],
    );
  }
  return b.build();
}

/**
 * A smooth sheet laid out in rings round the middle: `point(k, angle)` says
 * where the ring `k` of the way out is at an angle, and `height(x, y)` how
 * high the sheet is there. Rings run from `from` to `to`, so a sheet can be a
 * disc or a band. `rings` is either how many (packed toward the inner edge) or the rings' own distances, each of the
 * way out as `point` counts it, for a sheet that wants them fine in one place and coarse elsewhere; `segments` is
 * likewise how many, evenly round, or the angles' own list from nought to a whole turn, for a sheet that wants its
 * corners close together on one side only. Its normals are the height's own slope, taken across a
 * small step, so neighbouring sheets of the same height meet with no seam.
 */
export function sheet(
  point: (k: number, angle: number) => [number, number],
  height: (x: number, y: number) => number,
  from: number,
  to: number,
  rings: number | readonly number[],
  segments: number | readonly number[],
): Mesh {
  const b = new MeshBuilder();
  const e = 0.05;
  const count = typeof rings === 'number' ? rings : rings.length - 1;
  const round = typeof segments === 'number' ? segments : segments.length - 1;
  for (let i = 0; i <= count; i++) {
    // rings packed toward the inner edge, where a sheet bends most: the shore
    const k = typeof rings === 'number' ? from + (to - from) * (i / rings) ** 1.5 : rings[i];
    for (let j = 0; j <= round; j++) {
      const angle = typeof segments === 'number' ? (j / segments) * Math.PI * 2 : segments[j];
      const [x, y] = point(k, angle);
      const z = height(x, y);
      const dx = (height(x + e, y) - height(x - e, y)) / (2 * e),
        dy = (height(x, y + e) - height(x, y - e)) / (2 * e);
      const l = Math.hypot(dx, dy, 1);
      b.vertex(
        x,
        y,
        z,
        -dx / l,
        -dy / l,
        1 / l,
        typeof segments === 'number' ? j / segments : angle / (Math.PI * 2),
        k,
      );
    }
  }
  for (let i = 0; i < count; i++)
    for (let j = 0; j < round; j++) {
      const a = i * (round + 1) + j;
      b.quad(a, a + 1, a + round + 2, a + round + 1);
    }
  return b.build();
}

/**
 * A mesh cut in two by how steeply its triangles lean: `steep` the ones leaning more than `minSlope` (radians, from
 * level) either way, `gentle` the rest, every triangle in exactly one. Each half keeps only the vertices its triangles
 * use, with their normals and uvs, so the cliff's rock face and the bank's grass are two meshes cut from one sheet
 * that was drawn as one surface.
 */
export function splitBySlope(mesh: Mesh, minSlope: number): { steep: Mesh; gentle: Mesh } {
  const { positions: p, indices } = mesh;
  // a face leans past the slope when its normal's share of straight up is under the cosine of the cut
  const level = Math.cos(minSlope);
  const halves: [number[], number[]] = [[], []];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3,
      b = indices[t + 1] * 3,
      c = indices[t + 2] * 3;
    const ux = p[b] - p[a],
      uy = p[b + 1] - p[a + 1],
      uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a],
      vy = p[c + 1] - p[a + 1],
      vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const steep = Math.abs(nz) / (Math.hypot(nx, ny, nz) || 1) < level;
    halves[steep ? 0 : 1].push(indices[t], indices[t + 1], indices[t + 2]);
  }
  const cut = (ids: number[]): Mesh => {
    const renumbered = new Map<number, number>();
    for (const v of ids) if (!renumbered.has(v)) renumbered.set(v, renumbered.size);
    const out: Mesh = {
      positions: new Float32Array(renumbered.size * 3),
      normals: new Float32Array(renumbered.size * 3),
      uvs: new Float32Array(renumbered.size * 2),
      indices: Uint32Array.from(ids, (v) => renumbered.get(v)!),
    };
    for (const [v, i] of renumbered) {
      for (let a = 0; a < 3; a++) {
        out.positions[i * 3 + a] = mesh.positions[v * 3 + a];
        out.normals[i * 3 + a] = mesh.normals[v * 3 + a];
      }
      for (let a = 0; a < 2; a++) out.uvs[i * 2 + a] = mesh.uvs[v * 2 + a];
    }
    return out;
  };
  return { steep: cut(halves[0]), gentle: cut(halves[1]) };
}
