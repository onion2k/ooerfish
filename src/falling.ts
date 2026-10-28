/**
 * The falling things of a season (`docs/seasons.md`, part 4), as the renderer's particles are asked for them: blossom,
 * leaves or snow dropping from a spiral of emitters over the lake and its near banks, each dying where it meets the water,
 * carried sideways by the season's wind. Pure sums on content; the page makes the list once a season and hands the
 * same Emits to the renderer on their cadence, so nothing is made in a frame. Summer has none. The GPU draws each
 * particle's chance from its own hash, so none of this is the game's state.
 */
import type { Emit } from 'artshape-render/game/particles';
import { MIST } from './bursts';
import { FALLING, SEASON_DRESSING, WEATHER, type Falling, type Season, type Weather } from './lake';
import { fallsOf } from './falls';
import type { Lake } from './lakes/lake';

/** The lake the emitters stand over: its mean shore radius, and the water's level, which a flake dies at. */
export interface FallingWorld {
  radius: number;
  level: number;
}

/** The golden angle, which spreads a spiral's points evenly round and never into lines. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Winter's flakes at the cadence rain gives them: the snow that falls in place of rain, made once. */
const SNOW_IN_RAIN: Falling = {
  ...SEASON_DRESSING.winter.falling!,
  count: WEATHER.rain.snow.count,
  every: WEATHER.rain.snow.every,
};

/**
 * What falls in a season in a weather: the season's own (leaves, petals, snow or nothing) except in rain and in a shower,
 * when the rain's drops fall in its place, and in winter the flakes come at the rain's cadence instead, since snow is
 * what winter's rain is (`docs/weather.md`).
 */
export function fallingOf(season: Season, weather: Weather = 'sunny'): Falling | null {
  if (weather !== 'rain' && weather !== 'shower') return SEASON_DRESSING[season].falling;
  if (season === 'winter') return SNOW_IN_RAIN;
  return WEATHER[weather].falling;
}

/** Whether what falls is the rain's (`'rain'`, snow in winter too), the season's (`'season'`) or nothing (null). */
export function fallingKind(season: Season, weather: Weather = 'sunny'): 'rain' | 'season' | null {
  if (weather === 'rain' || weather === 'shower') return 'rain';
  return SEASON_DRESSING[season].falling ? 'season' : null;
}

/**
 * The particles' wind, in world units a second: the falling things' own drift, which the rain has none of, and in the
 * wind weather the wind's push direction at `WEATHER.wind.drift`, which carries whatever the season lets fall. Made on a
 * change of weather only.
 */
export function windDrift(season: Season, weather: Weather = 'sunny'): [number, number, number] {
  if (weather === 'wind')
    return [WEATHER.wind.direction[0] * WEATHER.wind.drift, WEATHER.wind.direction[1] * WEATHER.wind.drift, 0];
  const drift = fallingOf(season, weather)?.drift ?? [0, 0, 0];
  return [drift[0], drift[1], drift[2]];
}

/** The Emits of a season in a weather, one for each emitter of the spiral, made once; an empty list where nothing falls. */
export function fallingEmits(season: Season, world: FallingWorld, weather: Weather = 'sunny'): Emit[] {
  const f = fallingOf(season, weather);
  if (!f) return [];
  const reach = world.radius * FALLING.radius;
  return Array.from({ length: FALLING.emitters }, (_, i) => {
    // a share of the area each, so the cover is even
    const r = reach * Math.sqrt((i + 0.5) / FALLING.emitters);
    const a = i * GOLDEN;
    return {
      position: [r * Math.cos(a), r * Math.sin(a), world.level + FALLING.height],
      velocity: [0, 0, 0],
      spread: FALLING.spread,
      count: f.count,
      life: f.life,
      lifeSpread: f.lifeSpread,
      size: f.size,
      growth: f.growth,
      colour: f.colour,
      fade: f.fade,
      // a leaf or a petal, drawn as one and tumbling; snow and rain are the disc they were
      shape: f.shape ?? 'disc',
      alpha: 1,
      gravity: f.gravity,
      // a flake reaching the water is gone
      floor: world.level,
    } satisfies Emit;
  });
}

/**
 * Whether emitter `i` drops on the game's frame number `frame`: once in `every` frames, each a frame after the last, so
 * the ring does not drop in a lump. Counted from the game's own frame, so a paused lake drops none.
 */
export function fallingDue(frame: number, every: number, i = 0): boolean {
  return (frame + i) % every === 0;
}

/** How many of a season's particles are alive at once, at its steady state: emitters × count × life ÷ the seconds between drops. */
export function steadyLive(season: Season): number {
  const f = SEASON_DRESSING[season].falling;
  return f ? FALLING.emitters * f.count * f.life * (60 / f.every) : 0;
}

/**
 * How many particles the falling things and the falls' mist emit in the longest life a season's drops can have. The ring
 * holds this many, so no drop is overwritten alive at the game's steady rate; a burst of splashes on top may shorten a
 * drop's last second, which is accepted (`PARTICLE_POOL`). In rain and a shower the drops' short life shortens the
 * mist's window too, so the sum is smaller than a season's own.
 */
export function particleWindow(season: Season, lake: Lake, weather: Weather = 'sunny'): number {
  const f = fallingOf(season, weather);
  const window = f ? f.life * (1 + f.lifeSpread) : 0;
  const falling = f ? FALLING.emitters * f.count * window * (60 / f.every) : 0;
  const mist = fallsOf(lake).length * MIST.count * (60 / MIST.every) * window;
  return falling + mist;
}
