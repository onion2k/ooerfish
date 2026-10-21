/**
 * The falling things (`docs/seasons.md`, part 4): the emitters of a season, none in summer, each one above the water
 * with its floor at the water, the cadence they are emitted on, and the pool they all share with the splashes and the
 * falls' mist.
 */
import { describe, expect, it } from 'vitest';
import { MIST } from '../src/bursts';
import { FALLING, PARTICLE_POOL, SEASONS, SEASON_DRESSING, SHORE_RADIUS } from '../src/lake';
import { fallingDue, fallingEmits, particleWindow, steadyLive } from '../src/falling';
import { FALLS } from '../src/falls';

const world = { radius: SHORE_RADIUS, level: 0 };
const others = SEASONS.filter((s) => s !== 'summer');

describe('summer', () => {
  it('lets nothing fall', () => {
    expect(SEASON_DRESSING.summer.falling).toBeNull();
    expect(fallingEmits('summer', world)).toEqual([]);
    expect(steadyLive('summer')).toBe(0);
  });
});

describe.each(others)('%s', (s) => {
  const emits = fallingEmits(s, world);
  const f = SEASON_DRESSING[s].falling!;

  it('has one emit for each of the ring’s emitters, all above the water, over the lake and its near banks', () => {
    expect(emits).toHaveLength(FALLING.emitters);
    for (const e of emits) {
      expect(e.position[2]).toBeGreaterThan(world.level);
      expect(Math.hypot(e.position[0], e.position[1])).toBeLessThanOrEqual(world.radius * 1.2);
    }
    expect(new Set(emits.map((e) => e.position.join())).size, 'no two at one place').toBe(emits.length);
  });

  it('dies on the water: its floor is the water’s level', () => {
    for (const e of emits) expect(e.floor).toBe(world.level);
  });

  it('is drawn as the season’s shape: a leaf in autumn, a petal in spring, and the disc for snow', () => {
    const want = { autumn: 'leaf', winter: 'disc', spring: 'petal' }[s];
    for (const e of emits) expect(e.shape).toBe(want);
  });

  it('has colours in [0, 1], a gravity in [0, 1], and drifts down, not up', () => {
    for (const e of emits) {
      for (const c of [...e.colour, ...(e.fade ?? [])]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      expect(e.gravity!).toBeGreaterThan(0);
      expect(e.gravity!).toBeLessThanOrEqual(1);
      expect(e.count).toBe(f.count);
      expect(e.life).toBe(f.life);
    }
    expect(f.drift[2], 'the wind does not lift it').toBeLessThanOrEqual(0);
  });

  it('keeps about three hundred live at its steady state, well under the pool’s share', () => {
    const live = FALLING.emitters * f.count * f.life * (60 / f.every);
    expect(steadyLive(s)).toBe(live);
    expect(live).toBeGreaterThan(200);
    expect(live).toBeLessThan(450);
  });
});

describe('the cadence', () => {
  it('is due once in `every` frames for an emitter, and none is due on the same frame for all of them', () => {
    const every = 48;
    for (let i = 0; i < 4; i++) {
      let due = 0;
      for (let frame = 1; frame <= every * 5; frame++) if (fallingDue(frame, every, i)) due++;
      expect(due).toBe(5);
    }
    const together = Array.from({ length: FALLING.emitters }, (_, i) => i).filter((i) => fallingDue(100, 48, i));
    expect(together.length).toBeLessThan(FALLING.emitters);
  });

  it('is the same for the same frame, so a paused lake and a stepped one agree', () => {
    expect(fallingDue(77, 48, 3)).toBe(fallingDue(77, 48, 3));
  });
});

describe('the pool', () => {
  it('holds what the falling things and the falls’ mist emit in the longest life, and the ring is the size it was', () => {
    for (const s of others) {
      expect(particleWindow(s), s).toBeGreaterThan(steadyLive(s));
      expect(particleWindow(s), s).toBeLessThan(PARTICLE_POOL);
    }
    expect(Math.max(...others.map(particleWindow)), 'the sum in the pool’s comment').toBeGreaterThan(1800);
    expect(PARTICLE_POOL).toBe(2048);
  });

  it('lets no flake outlive the ring: its life is under the time the ring takes to come round at the full rate', () => {
    const perSecond = (s: (typeof others)[number]) => {
      const f = SEASON_DRESSING[s].falling!;
      return FALLING.emitters * f.count * (60 / f.every) + FALLS.length * MIST.count * (60 / MIST.every);
    };
    for (const s of others) {
      const f = SEASON_DRESSING[s].falling!;
      expect(f.life * (1 + f.lifeSpread), s).toBeLessThan(PARTICLE_POOL / perSecond(s));
    }
  });
});
