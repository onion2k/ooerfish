/** The cabin and the jetty as they are drawn: what groups they are, where they stand, and that they stay inside the sun's shadow. */
import { describe, expect, it } from 'vitest';
import { PAINT_STRIDE } from 'artshape-render/mesh/paint';
import { cabinGroups, jettyGroups, postSpots } from '../src/cabin';
import { CABIN, CABIN_AT, JETTY, bareGround, deckFrame, jettyGap } from '../src/lake';
import { PALETTE } from '../src/palette';
import { SHADOW_BOX } from '../src/scene';

/** Every vertex of a group's mesh, which is placed by the identity here. */
function vertices(g: { mesh: { positions: Float32Array } }): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < g.mesh.positions.length; i += 3)
    out.push([g.mesh.positions[i], g.mesh.positions[i + 1], g.mesh.positions[i + 2]]);
  return out;
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A point's place in the cabin's own frame: along the shore and in toward the lake from its middle. */
const inCabin = ([x, y]: number[]) => {
  const dx = x - CABIN_AT.x,
    dy = y - CABIN_AT.y;
  return [dx * CABIN_AT.along[0] + dy * CABIN_AT.along[1], dx * CABIN_AT.inward[0] + dy * CABIN_AT.inward[1]];
};

describe('the cabin as drawn', () => {
  const groups = cabinGroups();
  it('is five groups: the walls, the roof, the chimney, the door and the window, each in its own colour', () => {
    expect(groups.map((g) => g.albedo)).toEqual([
      PALETTE.cabinWall,
      PALETTE.cabinRoof,
      PALETTE.cabinChimney,
      PALETTE.cabinDoor,
      PALETTE.cabinWindow,
    ]);
    for (const g of groups) {
      expect(Array.from(g.matrices)).toEqual(IDENTITY);
      expect(g.mesh.indices.length / 3).toBeGreaterThan(0);
    }
  });

  it('has a body that is the cabin’s footprint, along the shore and toward the lake, standing the body’s height', () => {
    const body = vertices(groups[0]).map((p) => ({ uv: inCabin(p), z: p[2] }));
    const us = body.map((b) => b.uv[0]),
      vs = body.map((b) => b.uv[1]);
    expect(Math.min(...us)).toBeCloseTo(-CABIN.body.along / 2, 4);
    expect(Math.max(...us)).toBeCloseTo(CABIN.body.along / 2, 4);
    expect(Math.min(...vs)).toBeCloseTo(-CABIN.body.across / 2, 4);
    expect(Math.max(...vs)).toBeCloseTo(CABIN.body.across / 2, 4);
    // its walls rise the body's height over the door's sill, and the gable's apex over that
    const front = bareGround(
      CABIN_AT.x + CABIN_AT.inward[0] * (CABIN.body.across / 2),
      CABIN_AT.y + CABIN_AT.inward[1] * (CABIN.body.across / 2),
    );
    const eaves = front + CABIN.body.high;
    const walls = body.map((b) => b.z);
    expect(walls.some((z) => Math.abs(z - eaves) < 1e-4)).toBe(true);
    expect(Math.max(...walls)).toBeCloseTo(eaves + (CABIN.body.across / 2) * Math.tan(CABIN.roof.pitch), 4);
    // and its foot is no higher than the lowest ground under it, so it does not hang
    const feet = [-1, 0, 1].flatMap((a) =>
      [-1, 1].map((i) =>
        bareGround(
          CABIN_AT.x +
            CABIN_AT.along[0] * a * (CABIN.body.along / 2) +
            CABIN_AT.inward[0] * i * (CABIN.body.across / 2),
          CABIN_AT.y +
            CABIN_AT.along[1] * a * (CABIN.body.along / 2) +
            CABIN_AT.inward[1] * i * (CABIN.body.across / 2),
        ),
      ),
    );
    expect(Math.min(...walls)).toBeLessThanOrEqual(Math.min(...feet));
  });

  it('has a roof that overhangs the walls by the overhang all round and no more, over the eaves', () => {
    const roof = vertices(groups[1]).map((p) => ({ uv: inCabin(p), z: p[2] }));
    expect(Math.max(...roof.map((r) => r.uv[0]))).toBeCloseTo(CABIN.body.along / 2 + CABIN.roof.overhang, 4);
    expect(Math.min(...roof.map((r) => r.uv[0]))).toBeCloseTo(-(CABIN.body.along / 2 + CABIN.roof.overhang), 4);
    expect(Math.max(...roof.map((r) => r.uv[1]))).toBeCloseTo(CABIN.body.across / 2 + CABIN.roof.overhang, 4);
    expect(Math.min(...roof.map((r) => r.uv[1]))).toBeCloseTo(-(CABIN.body.across / 2 + CABIN.roof.overhang), 4);
  });

  it('puts the door in the lake-facing wall, and the window beside it, on the same wall', () => {
    for (const k of [3, 4]) {
      const vs = vertices(groups[k]).map((p) => inCabin(p)[1]);
      expect(Math.min(...vs), `group ${k}`).toBeGreaterThan(CABIN.body.across / 2 - 0.5);
      expect(Math.max(...vs), `group ${k}`).toBeLessThan(CABIN.body.across / 2 + 0.5);
    }
    const door = vertices(groups[3]).map((p) => inCabin(p)[0]);
    const win = vertices(groups[4]).map((p) => inCabin(p)[0]);
    expect(Math.max(...door) - Math.min(...door)).toBeCloseTo(CABIN.door.width, 4);
    expect((Math.max(...win) + Math.min(...win)) / 2).toBeCloseTo(CABIN.window.along, 4);
  });

  it('stands under the sun’s shadow box, every vertex of it', () => {
    for (const g of [...groups, ...jettyGroups()])
      for (const [x, y, z] of vertices(g)) {
        expect(x).toBeGreaterThan(SHADOW_BOX.min[0]);
        expect(x).toBeLessThan(SHADOW_BOX.max[0]);
        expect(y).toBeGreaterThan(SHADOW_BOX.min[1]);
        expect(y).toBeLessThan(SHADOW_BOX.max[1]);
        expect(z).toBeGreaterThan(SHADOW_BOX.min[2]);
        expect(z).toBeLessThan(SHADOW_BOX.max[2]);
      }
  });

  it('is made the same every call', () => {
    const again = cabinGroups();
    again.forEach((g, i) => expect(Array.from(g.mesh.positions)).toEqual(Array.from(groups[i].mesh.positions)));
  });
});

/** Whether every triangle of a convex mesh faces away from its middle, by the winding the index gives it. */
function facesOut(g: { mesh: { positions: Float32Array; indices: ArrayLike<number> } }): boolean {
  const v = vertices(g);
  const used = Array.from(g.mesh.indices, (i) => v[i]);
  const mid = [0, 1, 2].map((a) => used.reduce((n, p) => n + p[a], 0) / used.length);
  for (let t = 0; t < g.mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => v[g.mesh.indices[t + k]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const cen = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
    if (n[0] * (cen[0] - mid[0]) + n[1] * (cen[1] - mid[1]) + n[2] * (cen[2] - mid[2]) <= 0) return false;
  }
  return true;
}

describe('the faces', () => {
  it('of every convex part face outward, so the frame the cabin is built in is not mirrored', () => {
    const [, , chimney, door, window] = cabinGroups();
    const [deck] = jettyGroups();
    for (const [name, g] of Object.entries({ chimney, door, window, deck })) expect(facesOut(g), name).toBe(true);
    // and the roof’s two panels, each a convex prism of its own: the ridge sorts one from the other by the side it is on
    const roof = cabinGroups()[1];
    const half = roof.mesh.positions.length / 3 / 2;
    for (const side of [0, 1]) {
      const keep = (i: number) => i < half === (side === 0);
      const sub = {
        mesh: {
          positions: roof.mesh.positions,
          indices: Array.from(roof.mesh.indices).filter((_, k) => keep(roof.mesh.indices[Math.floor(k / 3) * 3])),
        },
      };
      expect(facesOut(sub), `roof panel ${side}`).toBe(true);
    }
  });
});

describe('the walls’ faces', () => {
  it('face away from the cabin: the sides outward in plan, the sloping gable up, the underside down', () => {
    const walls = cabinGroups()[0];
    const v = vertices(walls);
    const top = Math.max(...v.map((p) => p[2]));
    let sides = 0,
      slopes = 0,
      under = 0;
    for (let t = 0; t < walls.mesh.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => v[walls.mesh.indices[t + k]]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const cen = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
      if (Math.abs(n[2]) / Math.hypot(n[0], n[1], n[2]) < 1e-4) {
        sides++;
        expect(n[0] * (cen[0] - CABIN_AT.x) + n[1] * (cen[1] - CABIN_AT.y), 'a wall faces out').toBeGreaterThan(0);
      } else if (cen[2] > top - (CABIN.body.across / 2) * Math.tan(CABIN.roof.pitch) + 1e-3) {
        slopes++;
        expect(n[2], 'a gable slope faces up').toBeGreaterThan(0);
      } else if (cen[2] < top - CABIN.body.high - (CABIN.body.across / 2) * Math.tan(CABIN.roof.pitch) + 1) {
        under++;
        expect(n[2], 'the foot faces down').toBeLessThan(0);
      }
    }
    expect(sides).toBeGreaterThan(8);
    expect(slopes).toBeGreaterThan(0);
    expect(under).toBeGreaterThan(0);
  });
});

describe('the jetty as drawn', () => {
  const groups = jettyGroups();
  it('is two groups: the deck and the posts, in their colours', () => {
    expect(groups.map((g) => g.albedo)).toEqual([PALETTE.deck, PALETTE.post]);
  });

  it('has a deck that is the jetty’s rectangle, its top at the deck’s height and a plank thick', () => {
    const v = vertices(groups[0]);
    const fr = v.map((p) => deckFrame(p[0], p[1]));
    expect(Math.min(...fr.map((f) => f[0]))).toBeCloseTo(0, 4);
    expect(Math.max(...fr.map((f) => f[0]))).toBeCloseTo(JETTY.length, 4);
    expect(Math.max(...fr.map((f) => f[1]))).toBeCloseTo(JETTY.width / 2, 4);
    expect(Math.min(...fr.map((f) => f[1]))).toBeCloseTo(-JETTY.width / 2, 4);
    expect(Math.max(...v.map((p) => p[2]))).toBeCloseTo(JETTY.top, 6);
    expect(Math.min(...v.map((p) => p[2]))).toBeCloseTo(JETTY.top - JETTY.thick, 6);
    // every corner of it is on the edge of the gap the game keeps to
    for (const p of v) expect(Math.abs(jettyGap(p[0], p[1]))).toBeLessThan(1e-4);
  });

  it('has a pair of posts at each place along it, each from the bed to the deck’s underside, under the deck', () => {
    const spots = postSpots();
    expect(spots).toHaveLength(JETTY.posts.along.length * 2);
    for (const s of spots) {
      expect(s.foot, 'at the bed or the bank').toBe(bareGround(s.x, s.y));
      expect(s.top, 'to the deck’s underside').toBeCloseTo(JETTY.top - JETTY.thick, 9);
      expect(s.top).toBeGreaterThan(s.foot);
      expect(jettyGap(s.x, s.y), 'under the deck').toBeLessThan(0);
    }
    // the mesh has them all: its lowest point is the deepest foot and its highest the underside
    const v = vertices(groups[1]);
    expect(Math.min(...v.map((p) => p[2]))).toBeCloseTo(Math.min(...spots.map((s) => s.foot)), 5);
    expect(Math.max(...v.map((p) => p[2]))).toBeCloseTo(JETTY.top - JETTY.thick, 5);
    // each post is the posts' size square: some vertex lies at each of its corners
    for (const s of spots) {
      const near = v.filter((p) => Math.abs(p[0] - s.x) < JETTY.posts.size && Math.abs(p[1] - s.y) < JETTY.posts.size);
      expect(near.length, 'vertices at the post').toBeGreaterThan(8);
    }
  });
});

describe('the timber’s painted edge', () => {
  const cabin = cabinGroups(),
    jetty = jettyGroups();
  // the walls, roof, door, deck and posts are timber; the chimney is stone and the window is glass
  const timber = [cabin[0], cabin[1], cabin[3], jetty[0], jetty[1]];
  const plain = [cabin[2], cabin[4]];

  it('is on the walls, the roof, the door, the deck and the posts, on set one by the gate, each vertex with its own', () => {
    for (const g of timber) {
      expect(g.mesh.paint, 'carries paint').toBeDefined();
      const vertices = g.mesh.positions.length / 3;
      expect(g.mesh.paint!.length).toBe(PAINT_STRIDE * vertices);
      expect(g.mesh.indices.length).toBe(vertices);
      for (let v = 0; v < vertices; v++) expect(g.mesh.paint![v * PAINT_STRIDE + 11]).toBe(1);
    }
  });

  it('is not on the chimney or the window’s glass, which are drawn as they were', () => {
    for (const g of plain) expect(g.mesh.paint).toBeUndefined();
  });

  it('is split, so that no triangle shares an index', () => {
    for (const g of timber) expect(new Set(g.mesh.indices).size).toBe(g.mesh.indices.length);
  });

  it('is the same bytes every time it is built', () => {
    const again = [...cabinGroups(), ...jettyGroups()];
    [...cabin, ...jetty].forEach((g, i) => {
      expect(again[i].mesh.positions).toEqual(g.mesh.positions);
      expect(again[i].mesh.paint).toEqual(g.mesh.paint);
    });
  });
});
