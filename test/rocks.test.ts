/** The lake's rocks as painted meshes: one to a boulder and one to a cliff lump, whole, sized, and the same every call. */
import { PAINT_STRIDE } from 'artshape-render/mesh/paint';
import { describe, expect, it } from 'vitest';
import { BOULDER_DOMES, BOULDERS, ROCKS } from '../src/lake';
import { boulderMeshes, cliffLumpMeshes, rockBudget } from '../src/rocks';
import { cliffLumps } from '../src/scene';

const boulders = boulderMeshes();
const lumps = cliffLumps();
const cliff = cliffLumpMeshes(lumps);

/** A mesh's reach in height and across, over all its vertices. */
function extent(positions: Float32Array) {
  let top = -Infinity,
    wide = 0;
  for (let i = 0; i < positions.length; i += 3) {
    top = Math.max(top, positions[i + 2]);
    wide = Math.max(wide, Math.hypot(positions[i], positions[i + 1]));
  }
  return { top, wide };
}

describe('the rock budget', () => {
  it('is one under a world radius of 1.5, two under 3, and three from there', () => {
    expect(rockBudget(0.5)).toBe(1);
    expect(rockBudget(1.49)).toBe(1);
    expect(rockBudget(1.5)).toBe(2);
    expect(rockBudget(2.99)).toBe(2);
    expect(rockBudget(3)).toBe(3);
    expect(rockBudget(8)).toBe(3);
  });
});

describe('the boulders as meshes', () => {
  it('are one to a dome, each placed at its dome with a scale of one', () => {
    expect(boulders).toHaveLength(BOULDER_DOMES.length);
    boulders.forEach(({ matrix }, i) => {
      expect(matrix).toHaveLength(16);
      // the middle at the waterline, standing where the dome does
      expect(matrix[12]).toBeCloseTo(BOULDER_DOMES[i].x, 5);
      expect(matrix[13]).toBeCloseTo(BOULDER_DOMES[i].y, 5);
      expect(matrix[14]).toBe(0);
      expect(Math.hypot(matrix[0], matrix[1])).toBeCloseTo(1, 5);
      expect(matrix[10]).toBe(1);
    });
  });

  it('carry a painted edge for every vertex, split so that no triangle shares an index, and closed', () => {
    for (const { mesh } of boulders) {
      expect(mesh.paint).toBeDefined();
      expect(mesh.paint.length).toBe(PAINT_STRIDE * (mesh.positions.length / 3));
      expect(new Set(mesh.indices).size).toBe(mesh.indices.length);
      expect(mesh.paintStats.edges.open).toBe(0);
    }
  });

  it('are painted on the ridge choice, the budget by the waterline radius, which every boulder’s lines can meet', () => {
    expect(boulders.map(({ mesh }) => mesh.paintStats.ridges!.chosen)).toEqual(
      BOULDERS.map((b) => rockBudget(b.radius)),
    );
    // the four waterlines (1.8, 1.6, 1.4, 0.9) are budgets 2, 2, 1 and 1
    expect(BOULDERS.map((b) => rockBudget(b.radius))).toEqual([2, 2, 1, 1]);
  });

  it('stand no higher than their domes and no wider than their waterlines', () => {
    boulders.forEach(({ mesh, matrix }, i) => {
      const d = BOULDER_DOMES[i];
      const { top, wide } = extent(mesh.positions);
      expect(matrix[14] + top, `boulder ${i} top`).toBeLessThanOrEqual(d.base + d.tall + 1e-4);
      // and not far short of it: a boulder that stood a hand lower would leave its dome showing
      expect(matrix[14] + top, `boulder ${i} top`).toBeGreaterThan(d.base + d.tall - 0.3);
      expect(wide, `boulder ${i} width`).toBeLessThanOrEqual(BOULDERS[i].radius + 1e-4);
      expect(wide, `boulder ${i} width`).toBeGreaterThan(BOULDERS[i].radius * 0.8);
    });
  });

  it('have sunk lower halves, under the waterline by no more than the dome is deep', () => {
    boulders.forEach(({ mesh }, i) => {
      let low = Infinity;
      for (let k = 2; k < mesh.positions.length; k += 3) low = Math.min(low, mesh.positions[k]);
      expect(low, `boulder ${i}`).toBeLessThan(0);
      expect(low, `boulder ${i}`).toBeGreaterThanOrEqual(BOULDER_DOMES[i].base - 1e-4);
    });
  });

  it('give normals that are the facets’, worked out from the stretched positions', () => {
    for (const { mesh } of boulders) {
      const p = mesh.positions,
        n = mesh.normals;
      for (let t = 0; t < p.length; t += 9) {
        const ax = p[t + 3] - p[t],
          ay = p[t + 4] - p[t + 1],
          az = p[t + 5] - p[t + 2];
        const bx = p[t + 6] - p[t],
          by = p[t + 7] - p[t + 1],
          bz = p[t + 8] - p[t + 2];
        const cx = ay * bz - az * by,
          cy = az * bx - ax * bz,
          cz = ax * by - ay * bx;
        const l = Math.hypot(cx, cy, cz);
        if (l < 1e-9) continue;
        expect(n[t] * cx + n[t + 1] * cy + n[t + 2] * cz).toBeGreaterThan(l * 0.999);
      }
    }
  });
});

describe('the cliff’s lumps as meshes', () => {
  it('are one to a lump, placed at the lump with a scale of one and its yaw', () => {
    expect(cliff).toHaveLength(lumps.length);
    expect(lumps.length).toBeGreaterThan(20);
    cliff.forEach(({ matrix }, i) => {
      const l = lumps[i];
      expect([matrix[12], matrix[13], matrix[14]]).toEqual([l.x, l.y, l.z].map(Math.fround));
      expect(Math.hypot(matrix[0], matrix[1])).toBeCloseTo(1, 5);
      expect(Math.atan2(matrix[1], matrix[0])).toBeCloseTo(Math.atan2(Math.sin(l.yaw), Math.cos(l.yaw)), 5);
    });
  });

  it('carry a painted edge, on set two by the gate, split and closed', () => {
    for (const { mesh } of cliff) {
      expect(mesh.paint.length).toBe(PAINT_STRIDE * (mesh.positions.length / 3));
      expect(new Set(mesh.indices).size).toBe(mesh.indices.length);
      expect(mesh.paintStats.edges.open).toBe(0);
      expect(mesh.paintStats.ridges).toBeUndefined();
      // the set a vertex reads is float 11 of its twenty
      for (let v = 0; v < mesh.positions.length / 3; v++) expect(mesh.paint[v * PAINT_STRIDE + 11]).toBe(2);
    }
  });

  it('are stretched by the lump’s own half-widths, not by the matrix', () => {
    cliff.forEach(({ mesh }, i) => {
      const l = lumps[i];
      const { wide } = extent(mesh.positions);
      expect(wide).toBeLessThanOrEqual(Math.max(l.rx, l.ry) + 1e-4);
      expect(extent(mesh.positions).top).toBeCloseTo(l.rz, 4);
    });
  });
});

describe('the rocks', () => {
  it('are the same bytes every call, and built once', () => {
    const again = boulderMeshes();
    expect(again).toHaveLength(boulders.length);
    again.forEach((b, i) => {
      expect(b.mesh.positions).toEqual(boulders[i].mesh.positions);
      expect(b.mesh.paint).toEqual(boulders[i].mesh.paint);
      expect(b.matrix).toEqual(boulders[i].matrix);
    });
    const lumpsAgain = cliffLumpMeshes(cliffLumps());
    lumpsAgain.forEach((b, i) => {
      expect(b.mesh.positions).toEqual(cliff[i].mesh.positions);
      expect(b.mesh.paint).toEqual(cliff[i].mesh.paint);
    });
    expect(boulderMeshes()[0].mesh).toBe(boulders[0].mesh);
  });

  it('differ from one another, each from a seed of its own by its place', () => {
    const tops = new Set(cliff.map(({ mesh }) => mesh.positions.slice(0, 9).join()));
    expect(tops.size).toBe(cliff.length);
  });

  it('are faceted as content says: a ball of its rings and segments, each triangle its own vertices', () => {
    // rings × segments quads' worth: the poles are fans of one triangle a segment, the rest two
    const triangles = ROCKS.segments * 2 + (ROCKS.rings - 2) * ROCKS.segments * 2;
    for (const { mesh } of [...boulders, ...cliff]) expect(mesh.indices.length / 3).toBe(triangles);
  });
});
