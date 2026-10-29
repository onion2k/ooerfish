import { describe, expect, it } from 'vitest';
import { DRIFT, PHYSICS } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import { Bodies, KIND, currentsOf, extent, newWorld, worldFor } from '../src/physics';
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

describe('the currents as belts (`docs/boat.md`, C3)', () => {
  const DT = 1 / 60;

  it('are one belt for each of the lake’s currents, made once and shared', () => {
    for (const lake of LAKE_LIST) {
      const made = currentsOf(lake);
      expect(made).toHaveLength(lake.currents.length);
      expect(currentsOf(lake)).toBe(made);
      expect(newWorld(lake).belts).toBe(made);
      lake.currents.forEach((c, i) => {
        expect(made[i]).toMatchObject({ cx: c.x, cy: c.y, half: c.length / 2, width: c.width, speed: c.speed });
        expect(made[i].dx).toBeCloseTo(Math.cos(c.heading), 12);
        expect(made[i].dy).toBeCloseTo(Math.sin(c.heading), 12);
      });
    }
  });

  it('lies where the pond’s current is: a bobber on it is carried along it, and one beside it is not', () => {
    const c = HOME.currents[0];
    const on = new Bodies(newWorld(HOME), HOME);
    on.drop(c.x, c.y + 3);
    for (let i = 0; i < 60; i++) on.step(DT);
    expect(on.y, 'carried south').toBeLessThan(c.y + 3 - 0.3);
    expect(Math.abs(on.x - c.x), 'and not across').toBeLessThan(0.05);
    const beside = new Bodies(newWorld(HOME), HOME);
    beside.drop(c.x - c.width / 2 - 2, c.y);
    for (let i = 0; i < 60; i++) beside.step(DT);
    expect(Math.hypot(beside.x - (c.x - c.width / 2 - 2), beside.y - c.y)).toBeLessThan(1e-4);
    expect(beside.asleep).toBe(true);
  });

  it('are handed the world’s tuning with the lowered sleepDrift', () => {
    expect((newWorld(HOME) as unknown as { tune: { sleepDrift: number } }).tune.sleepDrift).toBe(DRIFT.sleepDrift);
  });
});

describe('the wind on the bodies (`docs/boat.md`, C3)', () => {
  const DT = 1 / 60;
  /** What a steady push is divided by to give the drift it settles at, measured: the floor's 5.5 and the settling's. */
  const TEN = 10;
  const fresh = () => new Bodies(newWorld(HOME), HOME);

  it('moves a free body and not a carried one', () => {
    const bodies = fresh();
    bodies.blow(KIND.bobber, 2.2, 0, DT);
    bodies.step(DT);
    expect(bodies.x, 'carried, it is left be').toBeCloseTo(HOME.landAt[0], 5);
    expect(bodies.y).toBeCloseTo(HOME.landAt[1], 5);
    bodies.drop(0, 0);
    for (let i = 0; i < 60; i++) {
      bodies.blow(KIND.bobber, 2.2, 0, DT);
      bodies.step(DT);
    }
    expect(bodies.x).toBeGreaterThan(0.1);
    expect(Math.abs(bodies.y)).toBeLessThan(1e-4);
    // the boat is carried, so a blow on it does nothing until it is let go
    bodies.blow(KIND.boat, 1.4, 0, DT);
    bodies.step(DT);
    expect(bodies.boatX).toBeCloseTo(HOME.boat!.mooring.x, 4);
  });

  it('drifts at about the push over ten, the floor’s drag and the settling together, the bobber’s and the boat’s', () => {
    for (const [kind, push] of [
      [KIND.bobber, DRIFT.wind.bobber],
      [KIND.boat, DRIFT.wind.boat],
    ] as const) {
      const bodies = fresh();
      if (kind === KIND.bobber) bodies.drop(-10, 0);
      else {
        bodies.putBoat(-10, 0);
        bodies.letGoBoat();
      }
      for (let i = 0; i < 60 * 5; i++) {
        bodies.blow(kind, push, 0, DT);
        bodies.step(DT);
      }
      const at = kind === KIND.bobber ? bodies.x : bodies.boatX;
      const v = (at + 10) / 5;
      expect(v, `kind ${kind}`).toBeGreaterThan((push / TEN) * 0.7);
      expect(v, `kind ${kind}`).toBeLessThan((push / TEN) * 1.3);
    }
  });

  it('lets go the boat where it is, still and awake, and holds it again, still', () => {
    const bodies = fresh();
    expect(bodies.boatHeld).toBe(true);
    bodies.putBoat(-8, 3);
    bodies.letGoBoat();
    expect(bodies.boatHeld).toBe(false);
    expect([bodies.boatX, bodies.boatY]).toEqual([-8, 3]);
    expect(bodies.world.asleep[bodies.boat]).toBe(0);
    for (let i = 0; i < 30; i++) {
      bodies.blow(KIND.boat, 1.4, 0, DT);
      bodies.step(DT);
    }
    const went = bodies.boatX;
    expect(went).toBeGreaterThan(-8);
    bodies.holdBoat();
    expect(bodies.boatHeld).toBe(true);
    expect(bodies.world.vx[bodies.boat]).toBe(0);
    for (let i = 0; i < 30; i++) {
      bodies.blow(KIND.boat, 1.4, 0, DT);
      bodies.step(DT);
    }
    expect(bodies.boatX).toBe(went);
  });

  it('puts a body back where told and stops it', () => {
    const bodies = fresh();
    bodies.drop(0, 0);
    for (let i = 0; i < 30; i++) {
      bodies.blow(KIND.bobber, 2.2, 0, DT);
      bodies.step(DT);
    }
    bodies.still(-5, 2);
    expect([bodies.x, bodies.y]).toEqual([-5, 2]);
    expect(bodies.world.vx[bodies.bobber]).toBe(0);
    expect(bodies.held).toBe(false);
    bodies.putBoat(6, 6);
    bodies.letGoBoat();
    bodies.blow(KIND.boat, 1.4, 0, DT);
    bodies.step(DT);
    bodies.stillBoat(3, 4);
    expect([bodies.boatX, bodies.boatY]).toEqual([3, 4]);
    expect(bodies.world.vx[bodies.boat]).toBe(0);
    expect(bodies.boatHeld).toBe(false);
  });

  it('steps the world while only the boat is free', () => {
    const bodies = fresh();
    bodies.putBoat(-8, 3);
    bodies.letGoBoat();
    bodies.blow(KIND.boat, 1.4, 0, 1);
    bodies.step(DT);
    expect(bodies.boatX).toBeGreaterThan(-8);
  });

  it('still lets a body in a calm world go to sleep, with the lowered sleepDrift', () => {
    const bodies = fresh();
    bodies.drop(-5, 0);
    bodies.putBoat(5, 0);
    bodies.letGoBoat();
    for (let i = 0; i < 600; i++) bodies.step(DT);
    expect(bodies.asleep).toBe(true);
    expect(bodies.world.asleep[bodies.boat]).toBe(1);
    expect(Math.hypot(bodies.x + 5, bodies.y)).toBeLessThan(1e-4);
  });

  it('keeps a body on a slow current awake, which the package’s own sleepDrift would have put to sleep', () => {
    // 0.6 u/s over the window of forty substeps is 0.2, under the default 0.25 and over the lowered 0.05
    const c = HOME.currents[0];
    const bodies = fresh();
    bodies.drop(c.x, c.y + 4);
    for (let i = 0; i < 60 * 4; i++) bodies.step(DT);
    expect(bodies.asleep).toBe(false);
    const y = bodies.y;
    for (let i = 0; i < 60; i++) bodies.step(DT);
    expect(y - bodies.y, 'still being carried').toBeGreaterThan(0.3);
  });
});
