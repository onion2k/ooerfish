/** Sleeping through (`docs/moon.md`, part 4): the page's words, and the game's wake that goes several days on. */
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { LAKES } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import { MOON } from '../src/lake';
import { moonOf, nextFull, nextNew, nextWeather, seasonOf } from '../src/calendar';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { sleepWords } from '../src/sleep/page';
import { DT, settle } from './helpers';

/** Steps the game through the yawn to the cabin. */
function toCabin(game: Game) {
  for (let f = 0; f < 600 && game.place !== 'cabin'; f++) game.step(DT);
}

/** A game on `day`, from a save. */
function onDay(day: number, woke: number[] = []) {
  const store = memoryStore(JSON.stringify({ cured: 2, day }));
  const game = new Game(new Progress(store), { random: seeded(1), events: { woke: (d) => woke.push(d) } });
  return { game, store };
}

/** The moon's rows alone, since the weather's join them on most days. */
const moons = (day: number, fighting = false) => sleepWords(day, fighting).filter((r) => /moon/.test(r.label));

describe('the sleep page’s words', () => {
  it('lists the marked nights ahead in order of distance, with the nights in the label', () => {
    expect(moons(1)).toEqual([
      { nights: 4, label: 'Till the new moon (4 nights)', enabled: true },
      { nights: 8, label: 'Till the full moon (8 nights)', enabled: true },
    ]);
    expect(moons(7)).toEqual([
      { nights: 2, label: 'Till the full moon (2 nights)', enabled: true },
      { nights: 6, label: 'Till the new moon (6 nights)', enabled: true },
    ]);
  });

  it('says one night in the singular', () => {
    expect(moons(8)[0]).toEqual({ nights: 1, label: 'Till the full moon (1 night)', enabled: true });
    expect(moons(4)[0].label).toBe('Till the new moon (1 night)');
  });

  it('is in order of distance on every day, and each choice is a whole number up to a round', () => {
    for (let day = 1; day <= 120; day++) {
      const rows = sleepWords(day, false);
      expect(moons(day).length).toBe(2);
      expect(moons(day)[0].nights).toBeLessThan(moons(day)[1].nights);
      for (let i = 1; i < rows.length; i++) expect(rows[i].nights).toBeGreaterThanOrEqual(rows[i - 1].nights);
      for (const r of rows) expect(r.nights >= 1 && r.nights <= MOON.days && Number.isInteger(r.nights)).toBe(true);
    }
  });

  it('is held off mid-fight', () => {
    expect(sleepWords(1, true).every((r) => !r.enabled)).toBe(true);
    expect(moons(1, true).length).toBe(2);
  });
});

describe('the weather on the sleep page', () => {
  const LABELS = { rain: 'rain', fog: 'fog', shower: 'sun-shower', wind: 'wind' } as const;
  const weatherRows = (day: number) => sleepWords(day, false).filter((r) => !/moon/.test(r.label));

  it('lists each kind within eight nights with its nights in the label, in the right place', () => {
    for (let day = 1; day <= 120; day++) {
      const rows = sleepWords(day, false);
      for (const kind of ['rain', 'fog', 'shower', 'wind'] as const) {
        const n = nextWeather(day, kind);
        const label = `Till the next ${LABELS[kind]} (${n} ${n === 1 ? 'night' : 'nights'})`;
        const at = rows.filter((r) => r.label === label);
        expect(at.length).toBe(n === null ? 0 : 1);
        if (n !== null) expect(at[0]).toEqual({ nights: n, label, enabled: true });
      }
    }
  });

  it('has no row for a kind that is not within eight nights, and never one for sunny', () => {
    let missing = 0;
    for (let day = 1; day <= 120; day++) {
      const labels = sleepWords(day, false).map((r) => r.label);
      expect(labels.some((l) => /sunny/.test(l))).toBe(false);
      for (const kind of ['rain', 'fog', 'shower', 'wind'] as const)
        if (nextWeather(day, kind) === null) {
          missing++;
          expect(labels.some((l) => l.includes(`next ${LABELS[kind]} `))).toBe(false);
        }
    }
    expect(missing).toBeGreaterThan(0);
  });

  it('keeps the order of distance, a tie going to the moon and then to the kinds in their order', () => {
    const kinds = ['rain', 'fog', 'shower', 'wind'];
    const rank = (label: string) =>
      /moon/.test(label) ? -1 : kinds.findIndex((k) => label.includes(`next ${LABELS[k as keyof typeof LABELS]} `));
    let ties = 0;
    for (let day = 1; day <= 120; day++) {
      const rows = sleepWords(day, false);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].nights).toBeGreaterThanOrEqual(rows[i - 1].nights);
        if (rows[i].nights === rows[i - 1].nights) {
          ties++;
          expect(rank(rows[i].label)).toBeGreaterThan(rank(rows[i - 1].label));
        }
      }
    }
    expect(ties).toBeGreaterThan(0);
  });

  it('is held off mid-fight as the moons are', () => {
    expect(weatherRows(8).length).toBeGreaterThan(0);
    expect(sleepWords(8, true).every((r) => !r.enabled)).toBe(true);
  });
});

describe('sleeping through', () => {
  it('wakes the chosen number of days on, in the cabin at dawn, saved, told once', () => {
    for (const nights of [1, 3, 8]) {
      const woke: number[] = [];
      const { game, store } = onDay(5, woke);
      expect(game.sleepThrough(nights)).toBe(true);
      expect(game.place).toBe('yawning');
      expect(game.day, 'the day goes up at the wake and not before').toBe(5);
      toCabin(game);
      expect(game.day).toBe(5 + nights);
      expect(game.place).toBe('cabin');
      expect(woke).toEqual([5 + nights]);
      expect((JSON.parse(store.json!) as { day: number }).day).toBe(5 + nights);
      expect(game.timeOfDay).toBeCloseTo(0.25, 1);
      expect(checkInvariants(game)).toEqual([]);
    }
  });

  it('is the same as sleep for one night', () => {
    const a = onDay(3).game;
    const b = onDay(3).game;
    expect(a.sleep()).toBe(true);
    expect(b.sleepThrough(1)).toBe(true);
    toCabin(a);
    toCabin(b);
    expect(a.day).toBe(b.day);
  });

  it('is refused, and changes nothing, with a fish hooked or landed, while yawning or leaving, and for a bad number of nights', () => {
    const { game } = onDay(5);
    for (const n of [0, -1, 9, 1.5, NaN, Infinity]) expect(game.sleepThrough(n), `${n} nights`).toBe(false);
    expect(game.place).toBe('pond');
    for (const phase of ['hooked', 'landed'] as const) {
      game.bite.phase = phase;
      expect(game.sleepThrough(3)).toBe(false);
      expect(game.place).toBe('pond');
    }
    game.bite.phase = 'none';
    expect(game.sleepThrough(3)).toBe(true);
    expect(game.sleepThrough(3), 'already yawning').toBe(false);
    toCabin(game);
    expect(game.day).toBe(8);

    const { game: leaver } = (() => {
      const store = memoryStore(JSON.stringify({ cured: 2 }));
      return { game: new Game(new Progress(store, LAKES), { random: seeded(1) }) };
    })();
    expect(leaver.travel('reservoir')).toBe(true);
    expect(leaver.place).toBe('leaving');
    expect(leaver.sleepThrough(2)).toBe(false);
    expect(leaver.place).toBe('leaving');
  });

  it('finishes a heal and empties the splashes, as the wake of one night does', () => {
    const { game } = onDay(2);
    game.setContamination(1);
    game.bite.phase = 'landed';
    game.bite.fish = 0;
    game.fish.held = 0;
    game.lure.phase = 'hooked';
    game.stow();
    settle(game, 30);
    expect(game.waterDirt).toBeGreaterThan(game.contamination);
    expect(game.splashes.count).toBeGreaterThan(0);
    game.bite.phase = 'none';
    expect(game.sleepThrough(5)).toBe(true);
    toCabin(game);
    expect(game.waterDirt).toBe(game.contamination);
    expect(game.splashes.count).toBe(0);
  });

  it('wakes at home from the Reservoir', () => {
    const store = memoryStore(JSON.stringify({ cured: 2, lake: 'reservoir' }));
    const game = new Game(new Progress(store, LAKES), { random: seeded(1), lake: RESERVOIR });
    expect(game.lake.id).toBe('reservoir');
    expect(game.sleepThrough(3)).toBe(true);
    toCabin(game);
    expect(game.progress.save.lake).toBe('duckpond');
    expect((JSON.parse(store.json!) as { lake: string }).lake).toBe('duckpond');
  });

  it('crosses the year and a season: day 54 and seven nights is day 61, spring to summer', () => {
    const { game } = onDay(54);
    expect(seasonOf(54)).toBe('spring');
    expect(game.sleepThrough(7)).toBe(true);
    toCabin(game);
    expect(game.day).toBe(61);
    expect(seasonOf(game.day)).toBe('summer');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('lands on the marked moon when the nights are those the page offers', () => {
    for (let day = 1; day <= 30; day++) {
      const { game } = onDay(day);
      const full = nextFull(day);
      const dark = nextNew(day);
      expect(game.sleepThrough(full)).toBe(true);
      toCabin(game);
      expect(moonOf(game.day), `full from day ${day}`).toBe(MOON.full);
      const { game: other } = onDay(day);
      other.sleepThrough(dark);
      toCabin(other);
      expect(moonOf(other.day), `new from day ${day}`).toBe(MOON.new);
    }
  });

  it('keeps the day safe at the top of the integers', () => {
    const { game } = onDay(5);
    game.day = Number.MAX_SAFE_INTEGER - 2;
    game.progress.save.day = game.day;
    expect(game.sleepThrough(8)).toBe(true);
    toCabin(game);
    expect(game.day).toBe(Number.MAX_SAFE_INTEGER);
  });
});
