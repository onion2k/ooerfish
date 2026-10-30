/** Lazy fishing's sums (`docs/boat.md`, C5): the bell's swing and where the propped rod rests. */
import { describe, expect, it } from 'vitest';
import { anglerAboard, newBoat } from '../src/boat';
import { BOAT, LAZY } from '../src/lake';
import { FORK, bellGroups, bellMatrix, bellSwing, proppedTip, restFor, restGroups } from '../src/lazy';
import { PALETTE } from '../src/palette';
import { HOME, LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';

describe('the bell’s swing', () => {
  it('is nought before the bite and at the moment of it', () => {
    expect(bellSwing(-0.5)).toBe(0);
    expect(bellSwing(0)).toBe(0);
    expect(bellSwing(Number.NaN)).toBe(0);
  });

  it('swings, within the arc, and dies to nought by the ring’s end and stays there', () => {
    let peak = 0;
    for (let a = 0; a < LAZY.ring; a += 1 / 240) peak = Math.max(peak, Math.abs(bellSwing(a)));
    expect(peak).toBeGreaterThan(LAZY.swing * 0.5);
    expect(peak).toBeLessThanOrEqual(LAZY.swing);
    expect(bellSwing(LAZY.ring)).toBe(0);
    expect(bellSwing(LAZY.ring + 5)).toBe(0);
    expect(bellSwing(Infinity)).toBe(0);
  });

  it('is the swing times the sine times what is left of the ring', () => {
    const age = 0.1;
    expect(bellSwing(age)).toBeCloseTo(
      LAZY.swing * Math.sin(2 * Math.PI * LAZY.swings * age) * (1 - age / LAZY.ring),
      12,
    );
  });

  it('shrinks as it goes: the later peak is lower than the earlier', () => {
    const peak = (from: number, to: number) => {
      let p = 0;
      for (let a = from; a < to; a += 1 / 240) p = Math.max(p, Math.abs(bellSwing(a)));
      return p;
    };
    expect(peak(1.5, 2)).toBeLessThan(peak(0, 0.5));
  });
});

describe('where the propped rod rests', () => {
  it('is the rail’s lake end, at the rail’s height, to the right of the heading, at a lake with a jetty', () => {
    const jetty = HOME.jetty!;
    const r = restFor(HOME, HOME.angler);
    const h = HOME.angler.heading!;
    expect(r.heading).toBe(h);
    expect(r.z).toBeCloseTo(HOME.angler.base! + jetty.spec.rail.high, 9);
    // along the deck it is at its lake end, and across it half the width to the right
    const [along, across] = jetty.frame(r.x, r.y);
    expect(along).toBeCloseTo(jetty.spec.length, 6);
    expect(Math.abs(across)).toBeCloseTo(jetty.spec.width / 2, 6);
    const right = [Math.sin(h), -Math.cos(h)];
    const off = [
      r.x - (jetty.deck.x + jetty.deck.inward[0] * jetty.spec.length),
      r.y - (jetty.deck.y + jetty.deck.inward[1] * jetty.spec.length),
    ];
    expect(off[0] * right[0] + off[1] * right[1]).toBeGreaterThan(0);
  });

  it('is the gunwale ahead of the seat, at the freeboard over the water, aboard', () => {
    const boat = newBoat(HOME);
    boat.aboard = true;
    boat.x = 3;
    boat.y = -2;
    boat.heading = 0.6;
    const stand = anglerAboard(boat);
    const r = restFor(HOME, stand);
    expect(r.heading).toBeCloseTo(0.6, 12);
    expect(r.z).toBeCloseTo(BOAT.hull.freeboard, 9);
    const ahead = (r.x - stand.x) * Math.cos(0.6) + (r.y - stand.y) * Math.sin(0.6);
    expect(ahead).toBeGreaterThan(0);
    expect(Math.hypot(r.x - stand.x, r.y - stand.y)).toBeLessThan(BOAT.hull.length / 2);
  });

  it('is a forked rest in the bank, a unit ahead of the stand and a unit high, at a lake without a jetty', () => {
    expect(RESERVOIR.jetty).toBeNull();
    const a = RESERVOIR.angler;
    const r = restFor(RESERVOIR, a);
    expect(Math.hypot(r.x - a.x, r.y - a.y)).toBeCloseTo(1, 9);
    expect(r.z).toBeCloseTo((a.base ?? RESERVOIR.ground(r.x, r.y)) + 1, 9);
    // it points toward the lake’s middle when the stand has no heading of its own
    if (a.heading === undefined) expect(r.heading).toBeCloseTo(Math.atan2(-a.y, -a.x), 12);
  });

  it('is built the same each time, and a lake the registry names has one', () => {
    for (const lake of Object.values(LAKES)) expect(restFor(lake, lake.angler)).toEqual(restFor(lake, lake.angler));
  });
});

const triangles = (groups: { mesh: { indices: ArrayLike<number> } }[]) =>
  groups.reduce((sum, g) => sum + g.mesh.indices.length / 3, 0);
const same = (a: ReturnType<typeof bellGroups>, b: ReturnType<typeof bellGroups>) => {
  expect(a.length).toBe(b.length);
  a.forEach((g, k) => {
    expect(Array.from(g.mesh.positions)).toEqual(Array.from(b[k].mesh.positions));
    expect(Array.from(g.mesh.indices)).toEqual(Array.from(b[k].mesh.indices));
    expect(g.albedo).toEqual(b[k].albedo);
  });
};

describe('the bell and the rest as they are built', () => {
  it('are built the same each time', () => {
    same(bellGroups(new Float32Array(16)), bellGroups(new Float32Array(16)));
    same(restGroups(new Float32Array(16)), restGroups(new Float32Array(16)));
  });

  it('are under sixty and forty triangles, and the bell is in the bell’s colour', () => {
    const bell = bellGroups(new Float32Array(16));
    expect(triangles(bell)).toBeGreaterThan(0);
    expect(triangles(bell)).toBeLessThan(60);
    expect(bell[0].albedo).toEqual(PALETTE.bell);
    const rest = restGroups(new Float32Array(16));
    expect(triangles(rest)).toBeGreaterThan(0);
    expect(triangles(rest)).toBeLessThan(40);
  });

  it('hang the bell from its origin, down, and plant the rest’s post below its fork', () => {
    const zs = (g: { mesh: { positions: ArrayLike<number> } }) =>
      Array.from({ length: g.mesh.positions.length / 3 }, (_, i) => g.mesh.positions[i * 3 + 2]);
    expect(Math.max(...zs(bellGroups(new Float32Array(16))[0]))).toBeLessThanOrEqual(1e-9);
    expect(Math.min(...zs(bellGroups(new Float32Array(16))[0]))).toBeLessThan(0);
    const rest = zs(restGroups(new Float32Array(16))[0]);
    expect(Math.min(...rest)).toBeLessThan(-FORK.high);
    expect(Math.max(...rest)).toBeGreaterThan(0);
  });
});

describe('the bell’s matrix', () => {
  const m = new Float32Array(16);
  it('is the tip’s with the bell’s size when it hangs still, and nothing at all when hidden', () => {
    bellMatrix(m, [1, 2, 3], 0.7, 0, LAZY.bell);
    expect(Array.from(m.slice(12))).toEqual([1, 2, 3, 1].map((v) => Math.fround(v)));
    expect(m[0]).toBeCloseTo(LAZY.bell, 6);
    expect(m[5]).toBeCloseTo(LAZY.bell, 6);
    expect(m[10]).toBeCloseTo(LAZY.bell, 6);
    bellMatrix(m, [1, 2, 3], 0.7, 0, 0);
    expect(Array.from(m.slice(0, 11))).toEqual(new Array(11).fill(0));
  });

  it('swings the hanging bell along the heading and never across it', () => {
    const h = 0.7;
    bellMatrix(m, [0, 0, 0], h, 0.3, 1);
    // the bell hangs along its own -z: the third column's negative, carried
    const down = [-m[8], -m[9], -m[10]];
    const along = down[0] * Math.cos(h) + down[1] * Math.sin(h);
    const across = -down[0] * Math.sin(h) + down[1] * Math.cos(h);
    expect(Math.abs(along)).toBeCloseTo(Math.sin(0.3), 6);
    expect(across).toBeCloseTo(0, 6);
    expect(down[2]).toBeCloseTo(-Math.cos(0.3), 6);
  });
});

describe('where the propped rod’s tip is', () => {
  it('stands LAZY.angle up from the rest, LAZY.rod long, along its heading', () => {
    const r = restFor(HOME, HOME.angler);
    const tip = proppedTip(r, new Float64Array(3));
    expect(Math.hypot(tip[0] - r.x, tip[1] - r.y, tip[2] - r.z)).toBeCloseTo(LAZY.rod, 9);
    expect(tip[2] - r.z).toBeCloseTo(LAZY.rod * Math.sin(LAZY.angle), 9);
    expect(Math.atan2(tip[1] - r.y, tip[0] - r.x)).toBeCloseTo(r.heading, 9);
  });
});
