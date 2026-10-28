/** The radio's words (`docs/radio.md`): the forecast from the day, the gossip from the save, both pure. */
import { describe, expect, it } from 'vitest';
import { moonOf, seasonOf, weatherOf } from '../src/calendar';
import { CALENDAR, MOON, type Weather } from '../src/lake';
import { LAKES } from '../src/lakes';
import { GOSSIP, STATION, forecastFor, gossipFor, radioWords, type GossipKey } from '../src/radio';
import type { LakeSave, Save } from '../src/progress';
import { KINDS } from '../src/lake';

const POND = LAKES.duckpond;
const RES = LAKES.reservoir;

const fresh = (): LakeSave => ({ cured: 0, drums: 0, journal: {}, found: [] });

/** A save at a lake with the given entries made over the fresh ones. */
function saveOf(
  day: number,
  over: { pond?: Partial<LakeSave>; reservoir?: Partial<LakeSave>; lake?: string } = {},
): Save {
  return {
    lake: over.lake ?? 'duckpond',
    lakes: { duckpond: { ...fresh(), ...over.pond }, reservoir: { ...fresh(), ...over.reservoir } },
    day,
    time: 0.1,
    place: 'cabin',
  };
}

const dayWith = (kind: Weather, from = 2) => {
  let d = from;
  while (weatherOf(d) !== kind) d++;
  return d;
};

/** A day with this weather that is neither a full nor a new moon, nor a season's first, so the forecast is the weather alone. */
const plainDay = (kind: Weather) => {
  let d = 2;
  while (
    weatherOf(d) !== kind ||
    moonOf(d) === MOON.full ||
    moonOf(d) === MOON.new ||
    (d - 1) % CALENDAR.seasonDays === 0
  )
    d++;
  return d;
};

describe('the radio is pure', () => {
  it('gives the same words for the same inputs, and draws no chance', () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error('the radio drew chance');
    };
    try {
      const save = saveOf(13, { pond: { cured: 3, drums: 1, found: ['duck'] } });
      for (const hour of ['dawn', 'day', 'dusk', 'night']) {
        expect(radioWords(13, save, LAKES, hour)).toEqual(radioWords(13, save, LAKES, hour));
      }
    } finally {
      Math.random = real;
    }
  });

  it('does not change the save it is handed', () => {
    const save = saveOf(13, { pond: { cured: 3, found: ['duck'] } });
    const before = JSON.stringify(save);
    radioWords(13, save, LAKES, 'dawn');
    expect(JSON.stringify(save)).toBe(before);
  });
});

describe('the forecast', () => {
  it('names the station', () => {
    expect(STATION).toBe('Sunny Atom Radio');
    expect(forecastFor(2, 'dawn').startsWith(`${STATION} says `)).toBe(true);
  });

  it('reads as one sentence with the right clauses on every day of two years', () => {
    for (let day = 1; day <= 112; day++) {
      const w = weatherOf(day);
      const phase = moonOf(day);
      const season = seasonOf(day);
      const f = forecastFor(day, 'dawn');
      expect(f, `day ${day}`).toMatch(/^Sunny Atom Radio says [^.]+\.$/);
      const has = (re: RegExp) => re.test(f);
      expect(has(/a fine day/), `fine ${day}`).toBe(w === 'sunny');
      expect(has(/snow today/), `snow ${day}`).toBe(w === 'rain' && season === 'winter');
      expect(has(/rain today/), `rain ${day}`).toBe(w === 'rain' && season !== 'winter');
      expect(has(/fog on the lake/), `fog ${day}`).toBe(w === 'fog');
      expect(has(/sun-shower/), `shower ${day}`).toBe(w === 'shower');
      expect(has(/windy day/), `wind ${day}`).toBe(w === 'wind');
      expect(has(/the full moon tonight/), `full ${day}`).toBe(phase === MOON.full);
      expect(has(/a new moon tonight/), `new ${day}`).toBe(phase === MOON.new);
      const first = (day - 1) % CALENDAR.seasonDays === 0;
      expect(has(/on the first day of/), `season ${day}`).toBe(first);
      if (first) expect(f).toContain(`the first day of ${season}`);
    }
  });

  it('says a fine day on a sunny day with no moon and no new season', () => {
    const d = plainDay('sunny');
    expect(forecastFor(d, 'dawn')).toBe('Sunny Atom Radio says a fine day.');
  });

  it('says rain, and snow in the winter', () => {
    const rain = plainDay('rain');
    const text = forecastFor(rain, 'dawn');
    expect(text).toBe(seasonOf(rain) === 'winter' ? `${STATION} says snow today.` : `${STATION} says rain today.`);
    let winterRain = 29;
    while (weatherOf(winterRain) !== 'rain' || seasonOf(winterRain) !== 'winter') winterRain++;
    expect(forecastFor(winterRain, 'dawn')).toContain('snow today');
    expect(forecastFor(winterRain, 'dawn')).not.toContain('rain');
  });

  it('says fog this morning at dawn and fog today at other hours', () => {
    const fog = plainDay('fog');
    expect(forecastFor(fog, 'dawn')).toBe(`${STATION} says fog on the lake this morning.`);
    for (const hour of ['day', 'dusk', 'night'])
      expect(forecastFor(fog, hour)).toBe(`${STATION} says fog on the lake today.`);
  });

  it('adds the moon after the weather, and the season after both', () => {
    expect(forecastFor(1, 'dawn')).toBe(
      `${STATION} says a fine day, and the full moon tonight, on the first day of summer.`,
    );
    // day 29 is winter's first, and a new moon (28 % 8 = 4)
    expect(moonOf(29)).toBe(MOON.new);
    expect(forecastFor(29, 'dawn')).toContain(', and a new moon tonight, on the first day of winter.');
  });

  it('says the season’s first day on days 1, 15, 29 and 43', () => {
    for (const [d, s] of [
      [1, 'summer'],
      [15, 'autumn'],
      [29, 'winter'],
      [43, 'spring'],
      [57, 'summer'],
    ] as const)
      expect(forecastFor(d, 'dawn')).toContain(`on the first day of ${s}.`);
  });

  it('is the forecast radioWords gives', () => {
    expect(radioWords(13, saveOf(13), LAKES, 'dawn').forecast).toBe(forecastFor(13, 'dawn'));
  });

  it('says each weather in its own sentence', () => {
    const said = (kind: Weather) => forecastFor(plainDay(kind), 'dawn');
    expect(said('shower')).toBe(`${STATION} says a sun-shower today.`);
    expect(said('wind')).toBe(`${STATION} says a windy day.`);
  });
});

/** A save that selects each key, on the day given. */
function selecting(key: GossipKey, day: number): Save {
  switch (key) {
    case 'clean':
      return saveOf(day, { pond: { cured: POND.toClean, drums: POND.drums.count } });
    case 'first':
      return saveOf(day, { pond: { cured: 1, journal: { pike: { caught: 1, best: 2, first: day - 1 } } } });
    case 'found':
      return saveOf(day, { pond: { found: ['duck'] } });
    case 'drum':
      return saveOf(day, { pond: { drums: 1 } });
    case 'gift':
      return saveOf(day, { pond: { cured: 2 } });
    case 'rain':
    case 'fog':
    case 'shower':
    case 'wind':
    case 'season':
      return saveOf(day);
  }
}

describe('the gossip’s order of keys', () => {
  const day = dayWith('rain', 20);
  const key = (save: Save) => gossipFor(save.day, save, LAKES).key;

  it('puts a clean lake over everything', () => {
    const save = saveOf(day, {
      pond: {
        cured: POND.toClean,
        drums: POND.drums.count,
        found: ['duck'],
        journal: { pike: { caught: 1, best: 2, first: day - 1 } },
      },
    });
    expect(key(save)).toBe('clean');
  });

  it('puts a first catch yesterday over a treasure, a drum, a gift and the weather', () => {
    const save = saveOf(day, {
      pond: { cured: 3, drums: 1, found: ['duck'], journal: { pike: { caught: 1, best: 2, first: day - 1 } } },
    });
    expect(key(save)).toBe('first');
  });

  it('does not take a first catch of longer ago for news', () => {
    const save = saveOf(day, { pond: { cured: 1, journal: { pike: { caught: 1, best: 2, first: day - 2 } } } });
    expect(key(save)).not.toBe('first');
  });

  it('puts a treasure over a drum, a gift and the weather', () => {
    expect(key(saveOf(day, { pond: { cured: 3, drums: 1, found: ['lure', 'duck'] } }))).toBe('found');
  });

  it('puts a drum over a gift and the weather', () => {
    expect(key(saveOf(day, { pond: { cured: 3, drums: 1 } }))).toBe('drum');
  });

  it('puts a gift over the weather', () => {
    expect(key(saveOf(day, { pond: { cured: 2 } }))).toBe('gift');
  });

  it('counts the gift over the cures of every lake', () => {
    expect(key(saveOf(day, { pond: { cured: 1 }, reservoir: { cured: 1 } }))).toBe('gift');
    expect(key(saveOf(day, { pond: { cured: 1 } }))).toBe('rain');
  });

  it('falls to the weather and then the season', () => {
    expect(key(saveOf(dayWith('rain', 20)))).toBe('rain');
    expect(key(saveOf(dayWith('fog', 20)))).toBe('fog');
    expect(key(saveOf(dayWith('shower', 20)))).toBe('shower');
    expect(key(saveOf(dayWith('wind', 20)))).toBe('wind');
    expect(key(saveOf(1))).toBe('season');
  });

  it('gossips from the weather or season for an old save with no journal or finds', () => {
    const old = { ...saveOf(2), lakes: {} };
    expect(() => radioWords(2, old, LAKES, 'dawn')).not.toThrow();
    expect(radioWords(2, old, LAKES, 'dawn').gossip.length).toBeGreaterThan(0);
  });

  it('names the home lake first when every lake is clean, and the other if only it is', () => {
    const both = saveOf(day, {
      pond: { cured: POND.toClean, drums: POND.drums.count },
      reservoir: { cured: RES.toClean, drums: RES.drums.count },
    });
    expect(gossipFor(day, both, LAKES).text).toContain('Duck Pond');
    const only = saveOf(day, { lake: 'reservoir', reservoir: { cured: RES.toClean, drums: RES.drums.count } });
    expect(gossipFor(day, only, LAKES).text).toContain('the Reservoir');
    expect(gossipFor(day, only, LAKES).text).not.toContain('the the');
  });

  it('puts the current lake first when two are clean', () => {
    const both = saveOf(day, {
      lake: 'reservoir',
      pond: { cured: POND.toClean, drums: POND.drums.count },
      reservoir: { cured: RES.toClean, drums: RES.drums.count },
    });
    expect(gossipFor(day, both, LAKES).text).toContain('the Reservoir');
  });

  it('needs the drums as well as the fish for a clean lake', () => {
    const fishOnly = saveOf(day, { pond: { cured: POND.toClean, drums: 0 } });
    expect(key(fishOnly)).not.toBe('clean');
  });

  it('names the kind in a first-catch line and the treasure in a found line', () => {
    const first = saveOf(day, { pond: { cured: 1, journal: { pike: { caught: 1, best: 2, first: day - 1 } } } });
    expect(gossipFor(day, first, LAKES).text).toContain('pike');
    const unknown = saveOf(day, { pond: { found: ['mystery'] } });
    expect(gossipFor(day, unknown, LAKES).key).toBe('found');
    expect(gossipFor(day, unknown, LAKES).text.length).toBeGreaterThan(0);
  });
});

describe('the gossip’s variety and reach', () => {
  const keys = Object.keys(GOSSIP) as GossipKey[];

  it('varies among a key’s lines over a week of mornings', () => {
    for (const key of ['clean', 'first', 'drum', 'gift'] as GossipKey[]) {
      const seen = new Set<string>();
      for (let day = 2; day <= 9; day++) seen.add(gossipFor(day, selecting(key, day), LAKES).text);
      expect(seen.size, key).toBeGreaterThanOrEqual(2);
    }
  });

  it('has about twenty-five lines, two or three a key', () => {
    const total = keys.reduce((n, k) => n + GOSSIP[k].length, 0);
    expect(total).toBeGreaterThanOrEqual(22);
    expect(total).toBeLessThanOrEqual(32);
    for (const k of keys) if (k !== 'found') expect(GOSSIP[k].length, k).toBeGreaterThanOrEqual(2);
  });

  it('has a line for each treasure and one for any other', () => {
    expect(GOSSIP.found.length).toBe(POND.treasures.list.length + 1);
  });

  it('can say every line in the pool, to some save on some day', () => {
    const reached = new Set<string>();
    const note = (text: string) => reached.add(text);

    for (let day = 2; day <= 300; day++) {
      for (const key of ['clean', 'first', 'drum', 'gift', 'season'] as GossipKey[])
        note(gossipFor(day, selecting(key, day), LAKES).text);
      note(
        gossipFor(
          day,
          saveOf(day, { lake: 'reservoir', reservoir: { cured: RES.toClean, drums: RES.drums.count } }),
          LAKES,
        ).text,
      );
      for (const kind of KINDS)
        note(
          gossipFor(
            day,
            saveOf(day, { pond: { cured: 1, journal: { [kind.id]: { caught: 1, best: 1, first: day - 1 } } } }),
            LAKES,
          ).text,
        );
      for (const t of POND.treasures.list) note(gossipFor(day, saveOf(day, { pond: { found: [t.id] } }), LAKES).text);
      note(gossipFor(day, saveOf(day, { pond: { found: ['mystery'] } }), LAKES).text);
    }
    // the weather keys, on a day of that weather with nothing else to say
    for (let day = 2; day <= 600; day++) note(gossipFor(day, saveOf(day), LAKES).text);

    for (const key of Object.keys(GOSSIP) as GossipKey[]) {
      const names =
        key === 'clean'
          ? [POND.name, RES.name]
          : key === 'first'
            ? KINDS.map((k) => k.name)
            : key === 'found'
              ? [...POND.treasures.list.map((t) => t.name), 'a mystery']
              : [''];
      for (let i = 0; i < GOSSIP[key].length; i++) {
        const line = GOSSIP[key][i];
        const options = names.map((n) => (typeof line === 'function' ? line(n) : line));
        expect(
          options.some((o) => reached.has(o)),
          `${key} line ${i}: ${options[0]}`,
        ).toBe(true);
      }
    }
  });

  it('says a lake through theLake, never "the the"', () => {
    for (let day = 2; day <= 30; day++) {
      for (const lake of ['duckpond', 'reservoir']) {
        const l = LAKES[lake];
        const save = saveOf(day, {
          lake,
          [lake === 'duckpond' ? 'pond' : 'reservoir']: { cured: l.toClean, drums: l.drums.count },
        });
        const text = gossipFor(day, save, LAKES).text;
        expect(text).not.toMatch(/the the/i);
        expect(text).toContain(lake === 'duckpond' ? 'the Duck Pond' : 'the Reservoir');
      }
    }
  });

  it('keeps every line a plain sentence or two, in the house’s gentle voice', () => {
    for (const key of Object.keys(GOSSIP) as GossipKey[])
      for (const line of GOSSIP[key]) {
        const text = typeof line === 'function' ? line('the Duck Pond') : line;
        expect(text, key).toMatch(/[.!]$/);
        expect(text.length, key).toBeLessThan(140);
      }
  });
});
