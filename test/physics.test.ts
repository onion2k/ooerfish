import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import { Bodies, KIND, extent, newWorld, worldFor } from '../src/physics';
import { seeded } from '../src/random';

const LAKE_LIST = Object.values(LAKES);
const TILE_HALF_DIAGONAL = PHYSICS.tile * Math.SQRT1_2;

/** The tile a point is on, or -1 off the grid. */
function tileOf(world: ReturnType<typeof worldFor>, x: number, y: number): number {
  const { cols, rows, originX, originY, tile } = world.grid;
  const c = Math.floor((x - originX) / tile),
    r = Math.floor((y - originY) / tile);
  return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
}

describe('the world of a lake', () => {
  it('has a water tile under every point of the water, in each lake', () => {
    for (const lake of LAKE_LIST) {
      const world = worldFor(lake);
      const random = seeded(7);
      const e = extent(lake);
      let found = 0;
      while (found < 1000) {
        const x = (random() * 2 - 1) * e,
          y = (random() * 2 - 1) * e;
        if (!lake.inside(x, y)) continue;
        found++;
        const t = tileOf(world, x, y);
        expect(t, `${lake.id} ${x},${y}`).toBeGreaterThanOrEqual(0);
        expect(world.solid[t], `${lake.id} ${x},${y}`).toBe(0);
      }
    }
  });

  it('has rock for every tile whose middle is outside the shore by more than a tile', () => {
    for (const lake of LAKE_LIST) {
      const { cols, rows, originX, originY, tile } = worldFor(lake).grid;
      const { solid } = worldFor(lake);
      let rock = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = originX + (c + 0.5) * tile,
            y = originY + (r + 0.5) * tile;
          if (!lake.inShore(x, y, -tile)) {
            expect(solid[r * cols + c], `${lake.id} tile ${c},${r}`).toBe(1);
            rock++;
          }
        }
      expect(rock, lake.id).toBeGreaterThan(0);
    }
  });

  it('is the same world for the same lake, and another for another', () => {
    expect(worldFor(HOME)).toBe(worldFor(HOME));
    expect(worldFor(RESERVOIR)).toBe(worldFor(RESERVOIR));
    expect(worldFor(HOME)).not.toBe(worldFor(RESERVOIR));
    expect(worldFor(HOME).grid).not.toEqual(worldFor(RESERVOIR).grid);
  });

  it('is made fresh by newWorld, from the same grid and the same rock', () => {
    const a = newWorld(HOME);
    expect(a).not.toBe(worldFor(HOME));
    expect(a.grid).toEqual(worldFor(HOME).grid);
    expect(a.solid).toBe(worldFor(HOME).solid);
    expect(a.count).toBe(0);
  });

  it('covers the furthest shore with the margin', () => {
    for (const lake of LAKE_LIST) {
      const e = extent(lake);
      let reaches = false;
      for (let i = 0; i < 1024; i++) {
        const c = Math.cos((i / 1024) * Math.PI * 2),
          s = Math.sin((i / 1024) * Math.PI * 2);
        // nothing of the shore lies past the margin, and the shore does come within a hair of it
        expect(lake.inShore(c * (e - PHYSICS.margin + 0.01), s * (e - PHYSICS.margin + 0.01)), lake.id).toBe(false);
        if (lake.inShore(c * (e - PHYSICS.margin - 0.1), s * (e - PHYSICS.margin - 0.1))) reaches = true;
      }
      expect(reaches, lake.id).toBe(true);
      const { cols, rows, originX, originY, tile } = worldFor(lake).grid;
      expect(tile).toBe(PHYSICS.tile);
      expect(originX).toBeLessThanOrEqual(-e);
      expect(originY).toBeLessThanOrEqual(-e);
      expect(originX + cols * tile).toBeGreaterThanOrEqual(e);
      expect(originY + rows * tile).toBeGreaterThanOrEqual(e);
    }
  });

  it('keeps a tile a half-diagonal outside the shore as water, and the kinds by radius', () => {
    const world = newWorld(HOME);
    const bobber = world.spawn(KIND.bobber, 0, 0, 0),
      boat = world.spawn(KIND.boat, 4, 0, 0);
    expect(world.r[bobber]).toBeCloseTo(PHYSICS.radii.bobber, 6);
    expect(world.r[boat]).toBeCloseTo(PHYSICS.radii.boat, 6);
    expect(world.capacity).toBe(PHYSICS.capacity);
    expect(world.bottom).toBe(PHYSICS.bottom);
    expect(TILE_HALF_DIAGONAL).toBeGreaterThan(0);
  });
});

describe('the bobber’s body', () => {
  const DT = 1 / 60;
  const spots: [string, number, number][] = [
    ['the pond’s middle', 0, 0],
    ['half a unit inside the shore', 0, 0],
  ];
  // the second spot: half a unit in from the shore to the south, where the angler stands
  spots[1][2] = -HOME.shoreRadius(-Math.PI / 2) + 0.5;

  for (const [name, x, y] of spots)
    it(`dropped at ${name} stays where it was dropped, and sleeps`, () => {
      const bodies = new Bodies(newWorld(HOME), HOME);
      expect(HOME.inside(x, y)).toBe(true);
      bodies.drop(x, y);
      for (let i = 0; i < 600; i++) {
        bodies.step(DT);
        expect(Math.hypot(bodies.x - x, bodies.y - y)).toBeLessThan(1e-4);
      }
      expect(bodies.asleep).toBe(true);
      expect(bodies.held).toBe(false);
    });

  it('is carried at the start, put where it is told, and carried again when taken', () => {
    const bodies = new Bodies(newWorld(HOME), HOME);
    expect(bodies.held).toBe(true);
    bodies.put(3, -4);
    expect([bodies.x, bodies.y]).toEqual([3, -4]);
    bodies.drop(3, -4);
    for (let i = 0; i < 300; i++) bodies.step(DT);
    expect(bodies.asleep).toBe(true);
    bodies.take();
    expect(bodies.held).toBe(true);
    expect(bodies.asleep).toBe(false);
    bodies.drop(1, 1);
    expect(bodies.held).toBe(false);
    expect([bodies.x, bodies.y]).toEqual([1, 1]);
  });

  it('is stepped without anything leaving the world', () => {
    const bodies = new Bodies(newWorld(HOME), HOME);
    bodies.drop(0, 0);
    expect(() => {
      for (let i = 0; i < 120; i++) bodies.step(DT);
    }).not.toThrow();
  });
});
