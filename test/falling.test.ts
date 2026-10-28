/**
 * The falling things (`docs/seasons.md`, part 4): the emitters of a season, none in summer, each one above the water
 * with its floor at the water, the cadence they are emitted on, and the pool they all share with the splashes and the
 * falls' mist.
 */
import { describe, expect, it } from 'vitest';
import { MIST } from '../src/bursts';
import { HOME } from '../src/lakes';
import { FALLING, PARTICLE_POOL, SEASONS, SEASON_DRESSING, WEATHER } from '../src/lake';
import { LAKES } from '../src/lakes';
import {
  fallingDue,
  fallingEmits,
  fallingKind,
  fallingOf,
  particleWindow,
  steadyLive,
  windDrift,
} from '../src/falling';
import { fallsOf } from '../src/falls';

const SHORE_RADIUS = HOME.radius;

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
      expect(particleWindow(s, HOME), s).toBeGreaterThan(steadyLive(s));
      expect(particleWindow(s, HOME), s).toBeLessThan(PARTICLE_POOL);
    }
    expect(Math.max(...others.map((s) => particleWindow(s, HOME))), 'the sum in the pool’s comment').toBeGreaterThan(
      1800,
    );
    expect(PARTICLE_POOL).toBe(2048);
  });

  it('lets no flake outlive the ring: its life is under the time the ring takes to come round at the full rate', () => {
    const perSecond = (s: (typeof others)[number]) => {
      const f = SEASON_DRESSING[s].falling!;
      return FALLING.emitters * f.count * (60 / f.every) + fallsOf(HOME).length * MIST.count * (60 / MIST.every);
    };
    for (const s of others) {
      const f = SEASON_DRESSING[s].falling!;
      expect(f.life * (1 + f.lifeSpread), s).toBeLessThan(PARTICLE_POOL / perSecond(s));
    }
  });
});

describe('the rain’s drops', () => {
  const lakes = Object.values(LAKES);
  const wet = ['rain', 'shower'] as const;

  it('are small blue-grey discs that fall fast and straight and die quickly', () => {
    const f = WEATHER.rain.falling;
    expect(f.shape).toBeUndefined();
    expect(f.drift).toEqual([0, 0, 0]);
    expect(f.gravity).toBeGreaterThan(SEASON_DRESSING.autumn.falling!.gravity * 10);
    expect(f.life * (1 + f.lifeSpread)).toBeLessThan(3);
    expect(f.size).toBeLessThan(SEASON_DRESSING.winter.falling!.size);
    expect(f.colour[2], 'blue-grey').toBeGreaterThan(f.colour[0]);
  });

  it('replace the season’s leaves and petals in rain and in a shower, and snow keeps its flakes at the rain’s cadence', () => {
    for (const w of wet)
      for (const s of ['summer', 'autumn', 'spring'] as const)
        expect(fallingOf(s, w), `${s} ${w}`).toBe(w === 'rain' ? WEATHER.rain.falling : WEATHER.shower.falling);
    const snow = fallingOf('winter', 'rain')!;
    expect(snow.shape).toBeUndefined();
    expect(snow.colour).toEqual(SEASON_DRESSING.winter.falling!.colour);
    expect(snow.count).toBe(WEATHER.rain.snow.count);
    expect(snow.every).toBe(WEATHER.rain.snow.every);
  });

  it('leave the season’s own falling in every other weather', () => {
    for (const w of ['sunny', 'fog', 'wind'] as const)
      for (const s of SEASONS) expect(fallingOf(s, w), `${s} ${w}`).toBe(SEASON_DRESSING[s].falling);
  });

  it('say which they are: rain, the season’s, or none', () => {
    expect(fallingKind('summer', 'rain')).toBe('rain');
    expect(fallingKind('winter', 'shower')).toBe('rain');
    expect(fallingKind('autumn', 'sunny')).toBe('season');
    expect(fallingKind('summer', 'sunny')).toBeNull();
    expect(fallingKind('summer', 'fog')).toBeNull();
  });

  it('make an emit for each emitter, falling to the water, with the rain’s figures', () => {
    const emits = fallingEmits('summer', world, 'rain');
    expect(emits).toHaveLength(FALLING.emitters);
    for (const e of emits) {
      expect(e.floor).toBe(world.level);
      expect(e.gravity).toBe(WEATHER.rain.falling.gravity);
      expect(e.count).toBe(WEATHER.rain.falling.count);
      expect(e.shape).toBe('disc');
    }
    expect(fallingEmits('summer', world), 'no weather is the old answer').toEqual([]);
    expect(fallingEmits('autumn', world, 'sunny')).toEqual(fallingEmits('autumn', world));
  });

  it.each(SEASONS)(
    'keep the %s window, with the falls’ mist, under the pool at every lake, in rain and in a shower',
    (s) => {
      for (const lake of lakes)
        for (const w of wet) {
          const window = particleWindow(s, lake, w);
          expect(window, `${lake.id} ${s} ${w}`).toBeGreaterThan(0);
          expect(window, `${lake.id} ${s} ${w}`).toBeLessThan(PARTICLE_POOL);
        }
    },
  );

  it('keep every other weather’s window as the season’s own', () => {
    for (const s of SEASONS)
      for (const w of ['sunny', 'fog', 'wind'] as const)
        expect(particleWindow(s, HOME, w)).toBe(particleWindow(s, HOME));
  });
});

describe('the particles’ wind', () => {
  it('is the season’s drift, none in rain, and the wind’s push scaled in the wind', () => {
    expect(windDrift('autumn', 'sunny')).toEqual(SEASON_DRESSING.autumn.falling!.drift);
    expect(windDrift('summer', 'sunny')).toEqual([0, 0, 0]);
    expect(windDrift('autumn', 'rain')).toEqual([0, 0, 0]);
    const [dx, dy, dz] = windDrift('summer', 'wind');
    expect(Math.hypot(dx, dy)).toBeCloseTo(WEATHER.wind.drift, 9);
    expect(dy / dx).toBeCloseTo(WEATHER.wind.direction[1] / WEATHER.wind.direction[0], 9);
    expect(dz).toBe(0);
  });
});
