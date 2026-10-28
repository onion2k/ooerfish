/** The weather as the game holds it: the day's, and the lever that overrides it for the tests (`docs/weather.md`). */
import { describe, expect, it } from 'vitest';
import { weatherOf } from '../src/calendar';
import { FISHING, WEATHER } from '../src/lake';
import { depthRange } from '../src/fish';
import { BREEZE } from '../src/grass';
import { checkInvariants } from '../src/invariants';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, newGame } from './helpers';

/** A day whose weather is not sunny, so a lever to sunny is a change. */
function stormyDay(): number {
  for (let d = 2; d < 100; d++) if (weatherOf(d) !== 'sunny') return d;
  throw new Error('no stormy day');
}

describe('Game.weather', () => {
  it('follows the day, and is sunny on the first', () => {
    const { game } = newGame();
    expect(game.weather).toBe('sunny');
    const day = stormyDay();
    game.day = day;
    expect(game.weather).toBe(weatherOf(day));
  });

  it('is set by the lever, which counts, and is cleared by null', () => {
    const { game } = newGame();
    const before = game.levers;
    expect(game.setWeather('fog')).toBe(true);
    expect(game.weather).toBe('fog');
    expect(game.levers).toBe(before + 1);
    expect(game.setWeather(null)).toBe(true);
    expect(game.weather).toBe(weatherOf(game.day));
  });

  it('refuses an unknown name, changing nothing', () => {
    const { game } = newGame();
    game.setWeather('rain');
    const before = game.levers;
    expect(game.setWeather('hail')).toBe(false);
    expect(game.weather).toBe('rain');
    expect(game.levers).toBe(before);
  });

  it('is cleared by a wake, since the day moved', () => {
    const { game } = newGame();
    game.setWeather('rain');
    game.timeOfDay = 0.999;
    for (let i = 0; i < 4000 && game.day === 1; i++) game.step(DT);
    expect(game.day).toBeGreaterThan(1);
    expect(game.weather).toBe(weatherOf(game.day));
    expect(WEATHER.kinds).toContain(game.weather);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('Game.lift', () => {
  it("is the rain's lift in rain and in a shower and nought in the rest", () => {
    const { game } = newGame();
    for (const kind of WEATHER.kinds) {
      game.setWeather(kind);
      expect(game.lift, kind).toBe(kind === 'rain' || kind === 'shower' ? FISHING.rainLift : 0);
    }
  });

  it('raises the school over a few seconds in rain, and none above the shallowest', () => {
    const { game } = newGame(3);
    for (let f = 0; f < 3600; f++) game.step(DT);
    const sun = Array.from(game.fish.depth.slice(0, game.fish.count));
    game.setWeather('rain');
    for (let f = 0; f < 3600; f++) game.step(DT);
    for (let i = 0; i < game.fish.count; i++)
      expect(game.fish.depth[i]).toBeGreaterThanOrEqual(
        depthRange(game.fish.x[i], game.fish.y[i], game.lake)[0] - 1e-9,
      );
    const mean = (xs: ArrayLike<number>, n: number) =>
      Array.from({ length: n }, (_, i) => xs[i]).reduce((a, b) => a + b, 0) / n;
    expect(mean(game.fish.depth, game.fish.count)).toBeLessThan(0.8 * mean(sun, sun.length));
  });
});

describe('Game.wind', () => {
  it('is the push along the breeze in the wind weather and zero in every other, one shared array', () => {
    const { game } = newGame();
    const push = Math.hypot(...WEATHER.wind.vector);
    expect(push).toBeCloseTo(WEATHER.wind.push, 12);
    for (const kind of WEATHER.kinds) {
      game.setWeather(kind);
      expect(Array.from(game.wind), kind).toEqual(kind === 'wind' ? Array.from(WEATHER.wind.vector) : [0, 0]);
    }
    game.setWeather('wind');
    expect(game.wind).toBe(game.wind);
  });

  it('is on a cast, fixed at the throw: a weather change in the air changes nothing', () => {
    const { game } = newGame();
    game.setWeather('wind');
    game.cast(Math.PI / 2, 1);
    expect(Array.from(game.lure.wind)).toEqual(Array.from(game.wind));
    const flies = game.lure.flies;
    game.setWeather('sunny');
    for (let f = 0; f < Math.ceil(flies / DT) + 2; f++) game.step(DT);
    expect(game.lure.wind[0]).toBe(WEATHER.wind.vector[0]);
    expect(game.lure.at[0], 'bent off the line it was cast along').toBeGreaterThan(1);
  });

  it("holds the breeze's direction, as the grass is blown", () => {
    const [dx, dy] = BREEZE.direction;
    const n = Math.hypot(dx, dy);
    expect(WEATHER.wind.direction[0]).toBeCloseTo(dx / n, 12);
    expect(WEATHER.wind.direction[1]).toBeCloseTo(dy / n, 12);
    expect(Math.hypot(...WEATHER.wind.direction)).toBeCloseTo(1, 12);
  });

  it('is found by the invariants to be neither zero nor the push', () => {
    const { game } = newGame();
    game.lure.wind[0] = 5;
    expect(checkInvariants(game).join('\n')).toMatch(/the lure's wind/);
  });
});

describe('the raindrops’ rings', () => {
  const run = (game: ReturnType<typeof newGame>['game'], seconds: number) => {
    for (let f = 0; f < Math.round(seconds / DT); f++) game.step(DT);
  };
  const rings = (game: ReturnType<typeof newGame>['game']) => game.rainRings;

  it('come every WEATHER.rain.ringEvery seconds of stepped time in rain and in a shower', () => {
    for (const w of ['rain', 'shower']) {
      const { game } = newGame();
      game.setWeather(w);
      run(game, 12.05);
      expect(rings(game), w).toBe(Math.floor(12.05 / WEATHER.rain.ringEvery));
    }
  });

  it('are splashes of the rain’s size in the pool, never more than half the slots, and none told as a pebble is', () => {
    let told = 0;
    const game = new Game(new Progress(memoryStore()), { random: seeded(1), events: { splashed: () => told++ } });
    game.setWeather('rain');
    run(game, 20);
    expect(game.splashes.count).toBeGreaterThan(0);
    expect(game.splashes.count).toBeLessThanOrEqual(12);
    const live = [...Array(game.splashes.count).keys()].filter((i) => game.t - game.splashes.at[i] < 3.5);
    expect(live.length).toBeLessThanOrEqual(6);
    for (let i = 0; i < game.splashes.count; i++) expect(game.splashes.size[i]).toBe(WEATHER.rain.ring);
    expect(told, 'a raindrop is not an event').toBe(0);
  });

  it('land on the water and keep the invariants', () => {
    const { game } = newGame();
    game.setWeather('rain');
    for (let f = 0; f < 60 * 120; f++) {
      game.step(DT);
      if (f % 60 === 0) expect(checkInvariants(game), `at ${f}`).toEqual([]);
    }
    for (let i = 0; i < game.splashes.count; i++)
      expect(game.lake.inside(game.splashes.x[i], game.splashes.y[i], 1)).toBe(true);
  });

  it('are the same in two games of one seed, and do not draw the game’s chance', () => {
    const play = (seed: number, weather: string | null) => {
      const { game } = newGame(seed);
      game.setWeather(weather);
      run(game, 30);
      return game;
    };
    const a = play(7, 'rain');
    const b = play(7, 'rain');
    expect([...a.splashes.x]).toEqual([...b.splashes.x]);
    expect([...a.splashes.y]).toEqual([...b.splashes.y]);
    // the fish, which the game’s chance draws, swim the same with the rings as without (in a shower, whose lift is the same)
    const c = play(7, 'shower');
    expect([...a.fish.x]).toEqual([...c.fish.x]);
  });

  it('are none in sun, fog or wind', () => {
    for (const w of ['sunny', 'fog', 'wind']) {
      const { game } = newGame();
      game.setWeather(w);
      run(game, 10);
      expect(rings(game), w).toBe(0);
      expect(game.splashes.count, w).toBe(0);
    }
  });

  it('are none in the cabin, where nothing steps but the fade, and start again from nothing when rain returns', () => {
    const { game } = newGame();
    game.setWeather('rain');
    run(game, 3);
    const before = rings(game);
    expect(game.enter()).toBe(true);
    run(game, 10);
    expect(rings(game)).toBe(before);
    game.setWeather('sunny');
    game.out();
    run(game, 5);
    expect(rings(game), 'none in sun').toBe(before);
  });
});
