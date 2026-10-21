/**
 * Saves from every shape the game has ever written, kept in `test/saves`, all
 * still loading and playing. A player's save outlives the code that wrote it.
 *
 * A save whose shape is new needs a file here. The last test sees to that: it
 * fails when the game writes a field no file in the corpus has.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { CLOCK, KINDS } from '../src/lake';
import { HOME } from '../src/lakes';
import type { Lake } from '../src/lakes/lake';
import { Progress, memoryStore, type Save } from '../src/progress';
import { seeded } from '../src/random';

const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };

const DIR = new URL('saves/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8');

/** What each save was worth when it was written, and what loading it must keep. */
const KEPT: Record<string, Record<string, unknown>> = {
  // the lake lab saved nothing: an empty save loads as no fish cured
  '01-empty.json': { cured: 0 },
  // the cure: a count of fish cured, from which the lake's contamination is worked out
  '02-cured.json': { cured: 5 },
  // the day's end: the number of the day, from one
  '03-day.json': { cured: 5, day: 4 },
  // the drums of waste: a count hauled up from the bed
  '04-drums.json': { cured: 5, day: 4, drums: 1 },
  // the journal: what each kind has had caught, its best weight and the day of the first
  '05-journal.json': {
    cured: 5,
    day: 4,
    drums: 1,
    journal: {
      bream: { caught: 2, best: 0.85, first: 2 },
      perch: { caught: 2, best: 1.9, first: 1 },
      pike: { caught: 1, best: 3.1, first: 4 },
    },
  },
  // the junk treasures: the ids of what has been found on the bed and kept for the shelf
  '06-found.json': {
    cured: 5,
    day: 4,
    drums: 1,
    journal: {
      bream: { caught: 2, best: 0.85, first: 2 },
      perch: { caught: 2, best: 1.9, first: 1 },
      pike: { caught: 1, best: 3.1, first: 4 },
    },
    found: ['lunchbox', 'bottle'],
  },
  // the time and the place: the clock where the player left it, at the pond
  '07-time.json': { cured: 2, day: 3, time: 0.6, place: 'pond' },
  // a cabin save holds dawn whatever its file says, since the clock is held at dawn there
  '08-cabin.json': { cured: 3, day: 5, time: CLOCK.startsAt, place: 'cabin' },
};

describe('saves from every shape the game has written', () => {
  it('has a file for every shape, oldest first', () => {
    expect(files).toEqual(Object.keys(KEPT).sort());
  });

  for (const file of files) {
    describe(file, () => {
      it('loads with what it held kept', () => {
        const save = new Progress(memoryStore(read(file))).save as unknown as Record<string, unknown>;
        for (const [key, was] of Object.entries(KEPT[file])) expect(save[key]).toEqual(was);
      });

      it('plays on from where it left off, and breaks no rule', () => {
        const game = new Game(new Progress(memoryStore(read(file))), { random: seeded(7) });
        for (let f = 0; f < 300; f++) game.step(1 / 60);
        expect(checkInvariants(game)).toEqual([]);
      });

      it('comes back as it went, written again in the shape of today', () => {
        const store = memoryStore(read(file));
        const before = new Progress(store).save;
        expect(store.json, 'loading alone must not write').toBe(read(file));
        const game = new Game(new Progress(store));
        game.persist();
        const after = new Progress(memoryStore(store.json)).save;
        expect(after).toEqual(before);
      });
    });
  }

  it('shrugs at what it cannot read', () => {
    expect(new Progress(memoryStore('not json')).save).toEqual({
      cured: 0,
      day: 1,
      drums: 0,
      journal: {},
      found: [],
      time: 0.25,
      place: 'pond',
    });
    expect(new Progress(memoryStore('[1, 2]')).save).toEqual({
      cured: 0,
      day: 1,
      drums: 0,
      journal: {},
      found: [],
      time: 0.25,
      place: 'pond',
    });
    expect(new Progress(memoryStore('{"bank": 7}')).save).toEqual({
      cured: 0,
      day: 1,
      drums: 0,
      journal: {},
      found: [],
      time: 0.25,
      place: 'pond',
    });
    // a count that is not a whole number of fish, or is a string, a null or a list, is taken for none
    for (const bad of ['-3', '2.5', '"7"', 'null', '[4]', '1e400', '9007199254740993'])
      expect(new Progress(memoryStore(`{"cured": ${bad}}`)).save, bad).toEqual({
        cured: 0,
        day: 1,
        drums: 0,
        journal: {},
        found: [],
        time: 0.25,
        place: 'pond',
      });
    // and one that is, is kept, with whatever else the save said left alone
    expect(new Progress(memoryStore('{"cured": 12, "bank": 7}')).save.cured).toBe(12);
  });

  it('reads the day as a whole number of one or more, and anything else as day one', () => {
    expect(new Progress(memoryStore('{"day": 9}')).save.day).toBe(9);
    expect(new Progress(memoryStore('{"cured": 3}')).save.day, 'an old save has none').toBe(1);
    for (const bad of ['0', '-2', '2.5', '"3"', 'null', '[4]', '1e400', '9007199254740993', 'true'])
      expect(new Progress(memoryStore(`{"day": ${bad}}`)).save.day, bad).toBe(1);
  });

  it('reads the drums hauled as a whole number held to the drums there are, and anything else as none', () => {
    expect(new Progress(memoryStore('{"drums": 1}')).save.drums).toBe(1);
    expect(new Progress(memoryStore('{"cured": 3}')).save.drums, 'an old save has none').toBe(0);
    expect(new Progress(memoryStore('{"drums": 0}')).save.drums).toBe(0);
    expect(new Progress(memoryStore(`{"drums": ${DRUMS.count}}`)).save.drums).toBe(DRUMS.count);
    expect(new Progress(memoryStore('{"drums": 9}')).save.drums, 'past the pond’s drums').toBe(DRUMS.count);
    for (const bad of ['-1', '1.5', '"1"', 'null', '[1]', '1e400', '9007199254740993', 'true'])
      expect(new Progress(memoryStore(`{"drums": ${bad}}`)).save.drums, bad).toBe(0);
  });

  it('reads the clock as a finite number from nought up to but not reaching one, and anything else as dawn', () => {
    const timeOf = (t: string) => new Progress(memoryStore(`{"time": ${t}}`)).save.time;
    expect(timeOf('0.6')).toBe(0.6);
    expect(timeOf('0')).toBe(0);
    expect(timeOf('0.999999')).toBe(0.999999);
    expect(new Progress(memoryStore('{"cured": 3}')).save.time, 'an old save has none').toBe(CLOCK.startsAt);
    for (const bad of ['1', '-0.1', '"0.5"', 'null', '[0.5]', '1e400', 'true', '2']) {
      expect(timeOf(bad), bad).toBe(CLOCK.startsAt);
    }
    // NaN is not JSON, so it reaches a load as the "1e400" above (infinity) or a string, both read as dawn
  });

  it('reads the place as the pond or the cabin, and anything else as the pond', () => {
    const placeOf = (p: string) => new Progress(memoryStore(`{"place": ${p}}`)).save.place;
    expect(placeOf('"pond"')).toBe('pond');
    expect(placeOf('"cabin"')).toBe('cabin');
    expect(new Progress(memoryStore('{"cured": 3}')).save.place, 'an old save has none').toBe('pond');
    for (const bad of ['"yawning"', '"elsewhere"', '3', 'null', '["cabin"]', 'true', '"Cabin"'])
      expect(placeOf(bad), bad).toBe('pond');
  });

  it('reads a cabin save at dawn whatever time it says, and a pond save at the time it says', () => {
    const cabin = new Progress(memoryStore('{"time": 0.6, "place": "cabin"}')).save;
    expect(cabin).toMatchObject({ time: CLOCK.startsAt, place: 'cabin' });
    expect(new Progress(memoryStore('{"time": 0.6, "place": "pond"}')).save.time).toBe(0.6);
  });

  it('holds the default clock of a fresh save equal to where the day starts', () => {
    expect(new Progress(memoryStore()).save.time).toBe(CLOCK.startsAt);
  });

  describe('the journal', () => {
    const journalOf = (j: string, rest = '"cured": 9, "day": 5') =>
      new Progress(memoryStore(`{${rest}, "journal": ${j}}`)).save.journal;
    const good = { caught: 2, best: 0.5, first: 3 };

    it('is empty for an old save, and an entry is kept as it was written', () => {
      expect(new Progress(memoryStore('{"cured": 3}')).save.journal).toEqual({});
      expect(journalOf('{"bream": {"caught": 2, "best": 0.5, "first": 3}}')).toEqual({ bream: good });
    });

    it('is none when it is not an object', () => {
      for (const bad of ['null', '4', '"x"', '[1]', 'true']) expect(journalOf(bad), bad).toEqual({});
    });

    it('drops an entry for a kind the game does not know, and keeps the others', () => {
      expect(
        journalOf('{"eel": {"caught": 1, "best": 1, "first": 1}, "bream": {"caught": 2, "best": 0.5, "first": 3}}'),
      ).toEqual({
        bream: good,
      });
    });

    it('takes a count that is not a whole number of one or more for none: the entry is dropped', () => {
      for (const bad of ['-1', '0', '1.5', '"2"', 'null', '[2]', '1e400', '9007199254740993'])
        expect(journalOf(`{"bream": {"caught": ${bad}, "best": 0.5, "first": 3}}`), bad).toEqual({});
    });

    it('takes a best weight outside its kind’s range for none: the entry keeps its count and first day with no best', () => {
      const [least, most] = KINDS[0].weight;
      for (const bad of [least - 0.01, most + 0.01, 0, -1, 'null', '"1"', '[1]', '1e400'])
        expect(journalOf(`{"bream": {"caught": 2, "best": ${bad}, "first": 3}}`), String(bad)).toEqual({
          bream: { caught: 2, best: 0, first: 3 },
        });
      // the range’s ends are kept
      expect(journalOf(`{"bream": {"caught": 2, "best": ${least}, "first": 3}}`).bream!.best).toBe(least);
      expect(journalOf(`{"bream": {"caught": 2, "best": ${most}, "first": 3}}`).bream!.best).toBe(most);
    });

    it('takes a first day that is not a whole number of one or more for none, and one after today too', () => {
      for (const bad of ['0', '-2', '2.5', '"3"', 'null', '[4]', '1e400', '9007199254740993', '6'])
        expect(journalOf(`{"bream": {"caught": 2, "best": 0.5, "first": ${bad}}}`), bad).toEqual({
          bream: { caught: 2, best: 0.5, first: 0 },
        });
      // today (day 5) is allowed
      expect(journalOf('{"bream": {"caught": 2, "best": 0.5, "first": 5}}').bream!.first).toBe(5);
    });

    it('is none when it claims more catches than fish cured, which no play could have written', () => {
      expect(journalOf('{"bream": {"caught": 4, "best": 0.5, "first": 1}}', '"cured": 3, "day": 5')).toEqual({});
      expect(journalOf('{"bream": {"caught": 3, "best": 0.5, "first": 1}}', '"cured": 3, "day": 5')).toEqual({
        bream: { caught: 3, best: 0.5, first: 1 },
      });
    });

    it('is written again in the shape it was read, with a missing best or first as nought', () => {
      const store = memoryStore('{"cured": 2, "day": 2, "journal": {"pike": {"caught": 1, "best": 99, "first": 2}}}');
      const game = new Game(new Progress(store));
      game.persist();
      expect((JSON.parse(store.json!) as Save).journal).toEqual({ pike: { caught: 1, best: 0, first: 2 } });
    });
  });

  describe('the treasures found', () => {
    const foundOf = (j: string) => new Progress(memoryStore(`{"cured": 3, "found": ${j}}`)).save.found;

    it('is empty for an old save, and the ids are kept as written', () => {
      expect(new Progress(memoryStore('{"cured": 3}')).save.found).toEqual([]);
      expect(foundOf('["duck", "lure"]')).toEqual(['duck', 'lure']);
      expect(foundOf('[]')).toEqual([]);
    });

    it('drops an id the game does not know, and keeps the others', () => {
      expect(foundOf('["nope", "badge", 4, null, "Badge"]')).toEqual(['badge']);
    });

    it('drops repeats, keeping the first of each', () => {
      expect(foundOf('["duck", "lure", "duck", "lure", "plush"]')).toEqual(['duck', 'lure', 'plush']);
    });

    it('is none when it is not a list, and never longer than the treasures there are', () => {
      for (const bad of ['null', '4', '"lure"', '{"lure": 1}', 'true']) expect(foundOf(bad), bad).toEqual([]);
      const all = TREASURES.list.map((t) => t.id);
      expect(foundOf(JSON.stringify([...all, ...all, 'extra']))).toEqual(all);
      expect(foundOf(JSON.stringify(all)).length).toBe(TREASURES.count);
    });

    it('is written again as it was read, with the unknown and the repeats gone', () => {
      const store = memoryStore('{"cured": 2, "found": ["bottle", "bottle", "x"]}');
      const game = new Game(new Progress(store));
      game.persist();
      expect((JSON.parse(store.json!) as Save).found).toEqual(['bottle']);
    });
  });

  it('starts over: a save of seven cured is wiped in memory and in the store, and a new load finds none', () => {
    const store = memoryStore('{"cured": 7}');
    const progress = new Progress(store);
    expect(progress.save.cured).toBe(7);
    progress.reset();
    expect(progress.save).toEqual({ cured: 0, day: 1, drums: 0, journal: {}, found: [], time: 0.25, place: 'pond' });
    expect(store.json).toBeNull();
    expect(new Progress(store).save).toEqual({
      cured: 0,
      day: 1,
      drums: 0,
      journal: {},
      found: [],
      time: 0.25,
      place: 'pond',
    });
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    // the files taken together, since a later shape need not repeat every field of the earlier ones
    const held = new Set(files.flatMap((f) => Object.keys(JSON.parse(read(f)) as object)));
    expect(
      now.filter((key) => !held.has(key)),
      'add a save in the new shape to test/saves',
    ).toEqual([]);
  });
});

describe('a save read against the lake it is handed', () => {
  const small: Lake = {
    ...HOME,
    drums: { ...HOME.drums, count: 1 },
    treasures: { ...HOME.treasures, count: 1, list: HOME.treasures.list.slice(0, 1) },
  };
  const ids = HOME.treasures.list.map((t) => t.id);

  it('holds the drums hauled to the lake’s own, and the home’s by default', () => {
    expect(new Progress(memoryStore('{"drums": 5}'), small).save.drums).toBe(1);
    expect(new Progress(memoryStore('{"drums": 5}')).save.drums).toBe(HOME.drums.count);
  });

  it('keeps only the treasures the lake has', () => {
    const json = JSON.stringify({ cured: 3, found: [ids[1], ids[0]] });
    expect(new Progress(memoryStore(json), small).save.found).toEqual([ids[0]]);
    expect(new Progress(memoryStore(json)).save.found).toEqual([ids[1], ids[0]]);
  });
});
