/**
 * The shapes the lake is built from, where they are cut or laid out by a rule of the game's own: a sheet laid out in
 * rings that can be spaced as the caller says, and a mesh cut in two by how steeply its faces lean, which is what draws
 * the cliff's rock face apart from the grass on the bank. A cut that put a face in both, or neither, would draw the
 * wall twice or leave a hole in it.
 */
import { describe, expect, it } from 'vitest';
import { MeshBuilder } from 'artshape-render/mesh/types';
import { box, sheet, splitBySlope } from '../src/meshes';

const SLOPE = (50 * Math.PI) / 180;

/** The number of triangles in a mesh. */
const tris = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;

/** A flat quad lying on the ground, and a vertical one standing on it, in one mesh. */
function mixed() {
  const b = new MeshBuilder();
  const v = (x: number, y: number, z: number) => b.vertex(x, y, z, 0, 0, 1, 0, 0);
  const a = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)];
  b.quad(a[0], a[1], a[2], a[3]);
  const c = [v(5, 0, 0), v(6, 0, 0), v(6, 0, 1), v(5, 0, 1)];
  b.quad(c[0], c[1], c[2], c[3]);
  return b.build();
}

describe('a sheet laid out in rings', () => {
  const flat = () => 0;
  const point = (k: number, angle: number): [number, number] => [Math.cos(angle) * k, Math.sin(angle) * k];

  it('is as it was when handed a count of rings, packed toward its inner edge', () => {
    const m = sheet(point, flat, 1, 3, 4, 8);
    expect(m.positions.length / 3).toBe(5 * 9);
    expect(tris(m)).toBe(4 * 8 * 2);
    // the first ring of a packed sheet is 1.5 powers in, so the second is a fraction of the way
    expect(Math.hypot(m.positions[9 * 3], m.positions[9 * 3 + 1])).toBeCloseTo(1 + 2 * (1 / 4) ** 1.5, 6);
  });

  it('puts its rings exactly where it is told when handed a list of them', () => {
    const ks = [1, 1.1, 1.2, 1.5, 4];
    const m = sheet(point, flat, 0, 0, ks, 12);
    expect(m.positions.length / 3).toBe(5 * 13);
    expect(tris(m)).toBe(4 * 12 * 2);
    ks.forEach((k, i) => {
      const o = i * 13 * 3;
      expect(Math.hypot(m.positions[o], m.positions[o + 1])).toBeCloseTo(k, 6);
    });
  });
});

describe('a mesh split by slope', () => {
  it('puts a flat sheet wholly in the gentle half', () => {
    const { steep, gentle } = splitBySlope(
      sheet(
        (k, a) => [Math.cos(a) * k, Math.sin(a) * k],
        () => 0,
        1,
        3,
        3,
        8,
      ),
      SLOPE,
    );
    expect(tris(steep)).toBe(0);
    expect(tris(gentle)).toBe(3 * 8 * 2);
  });

  it('puts a vertical quad wholly in the steep half', () => {
    const { steep, gentle } = splitBySlope(box(1, 1, 1), SLOPE);
    // a box: four vertical sides (eight triangles) are steep, the top and bottom (four) are not
    expect(tris(steep)).toBe(8);
    expect(tris(gentle)).toBe(4);
  });

  it('puts every triangle in exactly one half, and keeps what the triangles hold', () => {
    const whole = mixed();
    const { steep, gentle } = splitBySlope(whole, SLOPE);
    expect(tris(steep) + tris(gentle)).toBe(tris(whole));
    expect(tris(steep)).toBe(2);
    expect(tris(gentle)).toBe(2);
    // the steep half is the vertical quad, and only its vertices come with it
    expect(steep.positions.length / 3).toBe(4);
    expect(Array.from(steep.positions).filter((_, i) => i % 3 === 0)).toEqual([5, 6, 6, 5]);
    expect(Array.from(gentle.positions).filter((_, i) => i % 3 === 0)).toEqual([0, 1, 1, 0]);
    // normals and uvs travel with their vertices
    expect(steep.normals.length).toBe(steep.positions.length);
    expect(steep.uvs.length).toBe((steep.positions.length / 3) * 2);
    for (const i of steep.indices) expect(i).toBeLessThan(steep.positions.length / 3);
  });

  it('cuts at the slope it is given: a face at forty degrees is gentle at fifty and steep at thirty', () => {
    const b = new MeshBuilder();
    const rise = Math.tan((40 * Math.PI) / 180);
    const i = [b.vertex(0, 0, 0, 0, 0, 1, 0, 0), b.vertex(1, 0, 0, 0, 0, 1, 0, 0), b.vertex(0, 1, rise, 0, 0, 1, 0, 0)];
    b.triangle(i[0], i[1], i[2]);
    const m = b.build();
    expect(tris(splitBySlope(m, (50 * Math.PI) / 180).gentle)).toBe(1);
    expect(tris(splitBySlope(m, (30 * Math.PI) / 180).steep)).toBe(1);
  });

  it('counts a face leaning either way the same, up or down', () => {
    const { steep } = splitBySlope(box(1, 1, 1), SLOPE);
    expect(tris(steep)).toBe(8);
  });
});
