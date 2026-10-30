/**
 * The water's surface as a mesh. The swells are worked out only at its corners, so how far apart they are decides the
 * shortest swell that can be seen travelling: part 12's films found every swell short enough to be seen was shorter
 * than the old sheet's corners were apart, and the near water pulsed all together instead.
 */
import { describe, expect, it } from 'vitest';
import { HOME } from '../src/lakes';
import { shoreCamera, surface, surfaceLayout } from '../src/water/surface';

const SURFACE = HOME.surface;

/** The old sheet's widest edge, 24 rings by 128 segments evenly round: the far east and west shore's diagonals. */
const OLD_WIDEST = 4.296;

/**
 * The greatest distance between two corners joined by an edge of a triangle, over every triangle of a mesh, or over
 * those edges only with a corner within `reach` of a point.
 */
function widestEdge(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  within?: { x: number; y: number; reach: number },
): number {
  let most = 0;
  const at = (i: number) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const near = ([x, y]: number[]) => !within || Math.hypot(x - within.x, y - within.y) <= within.reach;
  for (let t = 0; t < indices.length; t += 3)
    for (const [a, b] of [
      [indices[t], indices[t + 1]],
      [indices[t + 1], indices[t + 2]],
      [indices[t + 2], indices[t]],
    ]) {
      const pa = at(a),
        pb = at(b);
      if (!near(pa) && !near(pb)) continue;
      most = Math.max(most, Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]));
    }
  return most;
}

describe("the water's surface", () => {
  const mesh = surface(HOME);
  const [cx, cy] = shoreCamera(HOME);

  it('has no two neighbouring corners further apart than the spacing, anywhere within reach of the shore camera', () => {
    expect(SURFACE.spacing).toBe(0.5);
    const near = { x: cx, y: cy, reach: SURFACE.near };
    // the edges looked at are many, so the measure is not passing on nothing
    expect(widestEdge(mesh.positions, mesh.indices, near)).toBeGreaterThan(SURFACE.spacing * 0.5);
    expect(widestEdge(mesh.positions, mesh.indices, near)).toBeLessThan(SURFACE.spacing);
  });

  it('is nowhere coarser than the sheet it replaced', () => {
    expect(widestEdge(mesh.positions, mesh.indices)).toBeLessThanOrEqual(OLD_WIDEST);
  });

  it('reaches the near water of the Shore view: the water beside the deck and as far out along it, short of the middle', () => {
    // the camera stands back over the bank behind the jetty, and the reach is counted from where it stands
    expect(HOME.inShore(cx, cy)).toBe(false);
    expect(Math.hypot(0 - cx, 0 - cy)).toBeGreaterThan(SURFACE.near);
    // the nearest water is well within it, the deck's end is, and the middle and the water a good way past the deck are not
    const deck = HOME.jetty!.deck;
    const end = [deck.x + deck.inward[0] * HOME.jetty!.spec.length, deck.y + deck.inward[1] * HOME.jetty!.spec.length];
    expect(Math.hypot(end[0] - cx, end[1] - cy)).toBeLessThan(SURFACE.near);
    const beyond = [end[0] + deck.inward[0] * 10, end[1] + deck.inward[1] * 10];
    expect(HOME.inside(beyond[0], beyond[1])).toBe(true);
    expect(Math.hypot(beyond[0] - cx, beyond[1] - cy)).toBeGreaterThan(SURFACE.near);
  });

  it('is the rings and angles its layout says, built once', () => {
    const { rings, angles } = surfaceLayout(HOME);
    expect(mesh.indices.length / 3).toBe((rings.length - 1) * (angles.length - 1) * 2);
    expect(surface(HOME)).toBe(mesh);
  });

  it('runs its rings out from the middle and its angles once round, each further than the last', () => {
    const { rings, angles } = surfaceLayout(HOME);
    expect(rings[0]).toBe(0);
    expect(rings.at(-1)).toBeCloseTo(1.08, 12);
    expect(angles[0]).toBe(0);
    expect(angles.at(-1)).toBeCloseTo(Math.PI * 2, 12);
    for (let i = 1; i < rings.length; i++) expect(rings[i]).toBeGreaterThan(rings[i - 1]);
    for (let j = 1; j < angles.length; j++) expect(angles[j]).toBeGreaterThan(angles[j - 1]);
  });

  it('is the old coarse sheet where the reach finds nothing finer to do, and fine all over where it reaches everything', () => {
    // a reach just past the far bank's foot from the camera: most of the sheet is as coarse as it was
    const all = surfaceLayout(HOME, { ...SURFACE, near: 200 });
    expect(all.rings[0]).toBe(0);
    expect(all.angles.at(-1)).toBeCloseTo(Math.PI * 2, 12);
    expect(all.angles.length - 1).toBeGreaterThan(SURFACE.segments * 4);
    // and a camera so far from the water that the reach finds none of it is refused by name (the Shore view's stands over the
    // deck's root, two units from the water, so a reach of one finds some; the camera is put far off the lake to test it)
    const far = { ...HOME, views: { ...HOME.views, shore: { ...HOME.views.shore, x: 400, y: 400 } } };
    expect(() => surfaceLayout(far, { ...SURFACE, near: 1 })).toThrow(/a near of 1 reaches none of the water/);
  });
});
