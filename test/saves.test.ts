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
import { gearFor } from '../src/fight';
import { checkInvariants } from '../src/invariants';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { CLOCK, KINDS, PHOTOS } from '../src/lake';
import { HOME } from '../src/lakes';
import type { Lake } from '../src/lakes/lake';
import { Progress, memoryStore, type Save } from '../src/progress';
import { seeded } from '../src/random';
import { newGame } from './helpers';

const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };

/** A save with nothing in it: at the home, its entry fresh, dawn at the pond. */
const FRESH = {
  lake: HOME.id,
  lakes: { [HOME.id]: { cured: 0, drums: 0, journal: {}, found: [], boat: null } },
  day: 1,
  time: 0.25,
  place: 'pond',
  requests: [],
  photos: [],
  tally: { rain: 0, run: 0, best: 0 },
};

const DIR = new URL('saves/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
/** What a save says of the home lake, however it was written. */
const entryOf = (json: string | null, lakes: Record<string, Lake> = { [HOME.id]: HOME }) =>
  new Progress(memoryStore(json), lakes).entry(HOME.id);
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
  // a cabin save keeps its time, since the clock is held wherever the player walked in
  '08-cabin.json': { cured: 3, day: 5, time: 0.6, place: 'cabin' },
  // the lakes: the flat file of before, whose fields are the home's entry (the save has none of `lake` or `lakes`)
  '09-flat-into-lakes.json': {
    lake: HOME.id,
    cured: 7,
    day: 6,
    drums: 2,
    journal: { bream: { caught: 3, best: 0.9, first: 1 }, pike: { caught: 1, best: 2.5, first: 3 } },
    found: ['badge'],
    time: 0.4,
    place: 'pond',
  },
  // the save per lake: an entry for the home, and one under an id the game has no lake for, which is dropped
  '10-lakes.json': {
    lake: HOME.id,
    cured: 6,
    day: 3,
    drums: 1,
    journal: { perch: { caught: 2, best: 1.5, first: 2 } },
    found: ['lunchbox'],
    time: 0.4,
    place: 'pond',
  },
  // the town's requests: the ids answered, in order
  '11-requests.json': { cured: 12, drums: 2, requests: ['ducks', 'biggest'] },
  // the album: two photographs, one lit, one of two kinds
  '12-photos.json': {
    cured: 12,
    drums: 2,
    photos: [
      {
        lake: HOME.id,
        day: 2,
        time: 0.25,
        weather: 'rain',
        view: { x: 0, y: 0, z: 0, azimuth: 0.5, polar: 1.2, radius: 40 },
        kinds: ['bream', 'pike'],
        lit: false,
      },
      {
        lake: HOME.id,
        day: 4,
        time: 0.9,
        weather: 'sunny',
        view: { x: 1.5, y: -2, z: 0.5, azimuth: 3.1, polar: 1, radius: 25 },
        kinds: [],
        lit: true,
      },
    ],
  },
  // the contests' tally: fish stowed in rain, the run of casts that landed, and the longest run
  '13-tally.json': { cured: 12, drums: 2, tally: { rain: 1, run: 2, best: 2 } },
  // the boat: the player aboard, anchored in the open water of the pond
  '14-boat.json': { cured: 4, boat: { x: 2, y: -12, heading: 0.5 } },
};

describe('saves from every shape the game has written', () => {
  it('has a file for every shape, oldest first', () => {
    expect(files).toEqual(Object.keys(KEPT).sort());
  });

  for (const file of files) {
    describe(file, () => {
      it('loads with what it held kept', () => {
        // the home's entry is read beside the player's own fields, since the files of before the lakes held them flat
        const loaded = new Progress(memoryStore(read(file)));
        const save = { ...loaded.save, ...loaded.entry(HOME.id) } as unknown as Record<string, unknown>;
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
        // the requests the save already meets are marked at the load, which the bare read does not do
        expect(after).toEqual({ ...before, requests: game.progress.save.requests });
        expect(after.requests.length).toBeGreaterThanOrEqual(before.requests.length);
      });
    });
  }

  it('shrugs at what it cannot read', () => {
    expect(new Progress(memoryStore('not json')).save).toEqual(FRESH);
    expect(new Progress(memoryStore('[1, 2]')).save).toEqual(FRESH);
    expect(new Progress(memoryStore('{"bank": 7}')).save).toEqual(FRESH);
    // a count that is not a whole number of fish, or is a string, a null or a list, is taken for none
    for (const bad of ['-3', '2.5', '"7"', 'null', '[4]', '1e400', '9007199254740993'])
      expect(new Progress(memoryStore(`{"cured": ${bad}}`)).save, bad).toEqual(FRESH);
    // and one that is, is kept, with whatever else the save said left alone
    expect(entryOf('{"cured": 12, "bank": 7}').cured).toBe(12);
  });

  it('reads the day as a whole number of one or more, and anything else as day one', () => {
    expect(new Progress(memoryStore('{"day": 9}')).save.day).toBe(9);
    expect(new Progress(memoryStore('{"cured": 3}')).save.day, 'an old save has none').toBe(1);
    for (const bad of ['0', '-2', '2.5', '"3"', 'null', '[4]', '1e400', '9007199254740993', 'true'])
      expect(new Progress(memoryStore(`{"day": ${bad}}`)).save.day, bad).toBe(1);
  });

  it('reads the drums hauled as a whole number held to the drums there are, and anything else as none', () => {
    expect(entryOf('{"drums": 1}').drums).toBe(1);
    expect(entryOf('{"cured": 3}').drums, 'an old save has none').toBe(0);
    expect(entryOf('{"drums": 0}').drums).toBe(0);
    expect(entryOf(`{"drums": ${DRUMS.count}}`).drums).toBe(DRUMS.count);
    expect(entryOf('{"drums": 9}').drums, 'past the pond’s drums').toBe(DRUMS.count);
    for (const bad of ['-1', '1.5', '"1"', 'null', '[1]', '1e400', '9007199254740993', 'true'])
      expect(entryOf(`{"drums": ${bad}}`).drums, bad).toBe(0);
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

  it('reads a cabin save at the time it says, as a pond save', () => {
    const cabin = new Progress(memoryStore('{"time": 0.6, "place": "cabin"}')).save;
    expect(cabin).toMatchObject({ time: 0.6, place: 'cabin' });
    expect(new Progress(memoryStore('{"place": "cabin"}')).save.time, 'none is dawn').toBe(CLOCK.startsAt);
    expect(new Progress(memoryStore('{"time": 0.6, "place": "pond"}')).save.time).toBe(0.6);
  });

  it('holds the default clock of a fresh save equal to where the day starts', () => {
    expect(new Progress(memoryStore()).save.time).toBe(CLOCK.startsAt);
  });

  describe('the journal', () => {
    const journalOf = (j: string, rest = '"cured": 9, "day": 5') => entryOf(`{${rest}, "journal": ${j}}`).journal;
    const good = { caught: 2, best: 0.5, first: 3 };

    it('is empty for an old save, and an entry is kept as it was written', () => {
      expect(entryOf('{"cured": 3}').journal).toEqual({});
      expect(journalOf('{"bream": {"caught": 2, "best": 0.5, "first": 3}}')).toEqual({ bream: good });
    });

    it('is none when it is not an object', () => {
      for (const bad of ['null', '4', '"x"', '[1]', 'true']) expect(journalOf(bad), bad).toEqual({});
    });

    it('drops an entry for a kind the game does not know, and keeps the others', () => {
      expect(
        journalOf('{"heron": {"caught": 1, "best": 1, "first": 1}, "bream": {"caught": 2, "best": 0.5, "first": 3}}'),
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
      expect((JSON.parse(store.json!) as Save).lakes[HOME.id].journal).toEqual({
        pike: { caught: 1, best: 0, first: 2 },
      });
    });
  });

  describe('the treasures found', () => {
    const foundOf = (j: string) => entryOf(`{"cured": 3, "found": ${j}}`).found;

    it('is empty for an old save, and the ids are kept as written', () => {
      expect(entryOf('{"cured": 3}').found).toEqual([]);
      expect(foundOf('["duck", "lure"]')).toEqual(['duck', 'lure']);
      expect(foundOf('[]')).toEqual([]);
    });

    it('drops an id the game does not know, and keeps the others', () => {
      expect(foundOf('["nope", "badge", 4, null, "Badge"]')).toEqual(['badge']);
    });

    it('drops a logbook page named under the wrong lake, the Reservoir’s page4 in the pond’s list', () => {
      expect(foundOf('["page4", "page1"]')).toEqual(['page1']);
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
      expect((JSON.parse(store.json!) as Save).lakes[HOME.id].found).toEqual(['bottle']);
    });
  });

  it('starts over: a save of seven cured is wiped in memory and in the store, and a new load finds none', () => {
    const store = memoryStore('{"cured": 7}');
    const progress = new Progress(store);
    expect(progress.entry(HOME.id).cured).toBe(7);
    progress.reset();
    expect(progress.save).toEqual(FRESH);
    expect(store.json).toBeNull();
    expect(new Progress(store).save).toEqual(FRESH);
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

describe('the boat', () => {
  const boatOf = (b: string) => entryOf(`{"cured": 3, "boat": ${b}}`).boat;

  it('is ashore for an old save, and a point and a heading are kept as written', () => {
    expect(entryOf('{"cured": 3}').boat).toBeNull();
    expect(boatOf('{"x": 2, "y": -12, "heading": 0.5}')).toEqual({ x: 2, y: -12, heading: 0.5 });
    expect(boatOf('{"x": 0, "y": 0, "heading": -3}')).toEqual({ x: 0, y: 0, heading: -3 });
  });

  it('is ashore when it is not a finite point and heading, and extras are dropped', () => {
    for (const bad of [
      'null',
      '4',
      '"boat"',
      '[1, 2, 3]',
      'true',
      '{}',
      '{"x": 1, "y": 2}',
      '{"x": "1", "y": 2, "heading": 0}',
      '{"x": 1, "y": null, "heading": 0}',
      '{"x": 1e400, "y": 2, "heading": 0}',
      '{"x": 1, "y": 2, "heading": 1e400}',
      '{"x": 1, "y": 2, "heading": [0]}',
    ])
      expect(boatOf(bad), bad).toBeNull();
    expect(boatOf('{"x": 1, "y": 2, "heading": 0, "speed": 9}')).toEqual({ x: 1, y: 2, heading: 0 });
  });

  it('puts the player aboard there at the pond, anchored, with the lure in', () => {
    const { game } = newGame(1, read('14-boat.json'));
    expect(game.boat).toMatchObject({ aboard: true, rowing: false, x: 2, y: -12, heading: 0.5 });
    expect(game.lure.phase).toBe('ready');
    expect(game.anglerAt()).not.toBe(HOME.angler);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is ashore when the point is not on the water by the margin, and the save forgets it', () => {
    // on the bank, off the water by the keep-off, at the shore's edge, and on the jetty’s deck
    const deck = HOME.jetty!.deck;
    for (const [x, y] of [
      [0, -40],
      [0, -HOME.shoreRadius(-Math.PI / 2) + 1],
      [deck.x + deck.inward[0] * 6, deck.y + deck.inward[1] * 6],
    ]) {
      const { game } = newGame(1, JSON.stringify({ cured: 3, boat: { x, y, heading: 0 } }));
      expect(game.boat.aboard, `${x},${y}`).toBe(false);
      expect(game.boat.x).toBe(HOME.boat!.mooring.x);
      expect(game.progress.entry(HOME.id).boat).toBeNull();
      expect(game.anglerAt()).toBe(HOME.angler);
    }
  });

  it('is ashore from a cabin save, since the cabin is reached from the shore', () => {
    const { game } = newGame(1, JSON.stringify({ place: 'cabin', cured: 3, boat: { x: 2, y: -12, heading: 0 } }));
    expect(game.boat.aboard).toBe(false);
  });

  it('is written again as the game has it, null ashore and the point aboard', () => {
    const store = memoryStore(read('14-boat.json'));
    const game = new Game(new Progress(store));
    game.persist();
    expect((JSON.parse(store.json!) as Save).lakes[HOME.id].boat).toEqual({ x: 2, y: -12, heading: 0.5 });
    expect(game.row(0, -5)).toBe(true);
    for (let f = 0; f < 600; f++) game.step(1 / 60);
    expect(game.land()).toBe(true);
    for (let f = 0; f < 60 * 20; f++) game.step(1 / 60);
    expect((JSON.parse(store.json!) as Save).lakes[HOME.id].boat).toBeNull();
  });
});

describe('the requests answered', () => {
  // a flat save that earns all three: the pond clean, every one of the six kinds caught, a pike over the rival's weight
  const EARNED =
    '"cured": 12, "drums": 2, "journal": {"bream": {"caught": 2, "best": 0.9, "first": 1}, ' +
    '"perch": {"caught": 4, "best": 2, "first": 1}, "pike": {"caught": 3, "best": 4.2, "first": 2}, ' +
    '"dawnfish": {"caught": 1, "best": 1, "first": 3}, "eel": {"caught": 1, "best": 1, "first": 3}, "trout": {"caught": 1, "best": 1, "first": 3}}';
  const requestsOf = (json: string) => new Progress(memoryStore(json)).save.requests;
  const earned = (requests: string) => requestsOf(`{${EARNED}, "requests": ${requests}}`);

  it('is none by default, and an old save without the field has all open', () => {
    expect(requestsOf('{"cured": 3}')).toEqual([]);
    expect(requestsOf('{}')).toEqual([]);
  });

  it('keeps the known ids in order', () => {
    expect(earned('["biggest", "ducks"]')).toEqual(['biggest', 'ducks']);
  });

  it('drops an id not known', () => {
    expect(earned('["nope", "ducks", 4, null, "Ducks"]')).toEqual(['ducks']);
  });

  it('drops a repeat', () => {
    expect(earned('["ducks", "rainbow", "ducks", "rainbow", "biggest"]')).toEqual(['ducks', 'rainbow', 'biggest']);
  });

  it('drops a request the save does not earn, so a save that lies is read as not written', () => {
    expect(requestsOf('{"requests": ["biggest", "ducks", "rainbow"]}')).toEqual([]);
    expect(requestsOf('{"cured": 12, "drums": 2, "requests": ["biggest", "ducks"]}')).toEqual(['ducks']);
  });

  it('refuses what is not a list', () => {
    for (const bad of ['null', '4', '"ducks"', '{"ducks": 1}', 'true'])
      expect(requestsOf(`{${EARNED}, "requests": ${bad}}`), bad).toEqual([]);
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
    expect(entryOf('{"drums": 5}', { [HOME.id]: small }).drums).toBe(1);
    expect(entryOf('{"drums": 5}').drums).toBe(HOME.drums.count);
  });

  it('keeps only the treasures the lake has', () => {
    const json = JSON.stringify({ cured: 3, found: [ids[1], ids[0]] });
    expect(entryOf(json, { [HOME.id]: small }).found).toEqual([ids[0]]);
    expect(entryOf(json).found).toEqual([ids[1], ids[0]]);
  });
});

describe('the save per lake', () => {
  const other: Lake = { ...HOME, id: 'other', name: 'Other Water', drums: { ...HOME.drums, count: 1 } };
  const both: Record<string, Lake> = { [HOME.id]: HOME, [other.id]: other };
  const load = (json: string, lakes = both) => new Progress(memoryStore(json), lakes);
  const entry = (cured = 0, drums = 0) => ({ cured, drums, journal: {}, found: [], boat: null });

  it('has an entry for every lake the game has, fresh, and the home as the lake it is at', () => {
    const { save } = new Progress(memoryStore(), both);
    expect(save.lake).toBe(HOME.id);
    expect(save.lakes).toEqual({ [HOME.id]: entry(), [other.id]: entry() });
  });

  it('reads the flat save of before as the home’s entry, and writes it back in the new shape only', () => {
    const store = memoryStore(read('09-flat-into-lakes.json'));
    const progress = new Progress(store, both);
    expect(progress.entry(HOME.id)).toMatchObject({ cured: 7, drums: 2, found: ['badge'] });
    expect(progress.entry(other.id), 'the other lake is untouched').toEqual(entry());
    progress.persist();
    const written = JSON.parse(store.json!) as Record<string, unknown>;
    expect(Object.keys(written).sort()).toEqual([
      'day',
      'lake',
      'lakes',
      'photos',
      'place',
      'requests',
      'tally',
      'time',
    ]);
    for (const old of ['cured', 'drums', 'journal', 'found']) expect(written, old).not.toHaveProperty(old);
  });

  it('takes `lakes` when a save has both, and leaves the flat fields alone', () => {
    const progress = load('{"cured": 9, "drums": 2, "lakes": {"duckpond": {"cured": 2}}}');
    expect(progress.entry(HOME.id)).toEqual(entry(2));
  });

  it('reads `lake` as the home’s unless it names a lake the game has', () => {
    expect(load('{"lake": "other"}').save.lake).toBe('other');
    for (const bad of ['"nowhere"', '3', 'null', '["other"]', 'true', '"__proto__"', '"toString"'])
      expect(load(`{"lake": ${bad}}`).save.lake, bad).toBe(HOME.id);
    expect(load('{"cured": 3}').save.lake, 'an old save has none').toBe(HOME.id);
  });

  it('reads `lakes` that is not an object as fresh, flat fields beside it or not', () => {
    for (const bad of ['null', '4', '"x"', '[1]', 'true'])
      expect(load(`{"cured": 5, "lakes": ${bad}}`).save.lakes, bad).toEqual({
        [HOME.id]: entry(),
        [other.id]: entry(),
      });
  });

  it('drops an entry under an id the game has no lake for, and gives a known lake with none a fresh one', () => {
    const progress = load('{"lakes": {"nowhere": {"cured": 9}, "other": {"cured": 4}}}');
    expect(Object.keys(progress.save.lakes).sort()).toEqual([HOME.id, 'other']);
    expect(progress.entry('other').cured).toBe(4);
    expect(progress.entry(HOME.id)).toEqual(entry());
    const corpus = new Progress(memoryStore(read('10-lakes.json'))).save;
    expect(corpus.lakes).not.toHaveProperty('nowhere');
    expect(corpus.lakes[HOME.id].cured).toBe(6);
  });

  it('reads each entry against its own lake: the drums held to that lake’s, the journal to its cures', () => {
    const progress = load(
      '{"lakes": {"duckpond": {"drums": 9}, "other": {"drums": 9, "cured": 1, "journal": {"bream": {"caught": 2, "best": 0.5, "first": 1}}}}}',
    );
    expect(progress.entry(HOME.id).drums).toBe(HOME.drums.count);
    expect(progress.entry('other').drums).toBe(1);
    expect(progress.entry('other').journal, 'two caught of one cured').toEqual({});
  });

  it('reads an entry’s bad fields as their defaults, field by field, and a bad entry as fresh', () => {
    const progress = load(
      '{"lakes": {"duckpond": {"cured": -1, "drums": "x", "journal": 4, "found": {"a": 1}}, "other": 7}}',
    );
    expect(progress.save.lakes).toEqual({ [HOME.id]: entry(), [other.id]: entry() });
    expect(load('{"lakes": {"duckpond": {"cured": 2.5}}}').entry(HOME.id).cured).toBe(0);
    expect(load('{"lakes": {"duckpond": {"cured": 3}}}').entry(HOME.id).cured).toBe(3);
  });

  it('makes an entry for a lake the save has none for when the game asks, and keeps it', () => {
    const progress = new Progress(memoryStore());
    progress.entry('new').cured = 2;
    expect(progress.entry('new').cured).toBe(2);
  });

  it('comes back as it went: two lakes written and read again are the same', () => {
    const store = memoryStore();
    const progress = new Progress(store, both);
    progress.entry(HOME.id).cured = 3;
    progress.entry(HOME.id).found.push('badge');
    progress.entry('other').cured = 4;
    progress.entry('other').drums = 1;
    progress.save.lake = 'other';
    progress.save.day = 5;
    progress.persist();
    expect(new Progress(memoryStore(store.json), both).save).toEqual(progress.save);
  });

  it('starts over to a fresh entry for every lake', () => {
    const progress = new Progress(memoryStore('{"lakes": {"other": {"cured": 4}}}'), both);
    progress.reset();
    expect(progress.save.lakes).toEqual({ [HOME.id]: entry(), [other.id]: entry() });
    expect(progress.save.lake).toBe(HOME.id);
  });

  describe('the gear', () => {
    const journeyed = JSON.stringify({ lake: 'other', lakes: { duckpond: entry(3), other: entry(4) } });

    it('is the sum of the fish cured over every lake', () => {
      const progress = load(journeyed);
      expect(progress.curedTotal()).toBe(7);
      const game = new Game(progress, { lake: other, random: seeded(1) });
      expect(game.gear).toEqual(gearFor(7));
      expect(game.gear).not.toEqual(gearFor(4));
      expect(game.bite.gear).toBe(game.gear);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('is the same from either lake, and a journey resets nothing', () => {
      const a = new Game(load(journeyed), { lake: HOME, random: seeded(1) });
      const b = new Game(load(journeyed), { lake: other, random: seeded(1) });
      expect(a.gear).toEqual(b.gear);
      expect(a.progress.entry('other').cured, 'the other lake’s count is not the game’s').toBe(4);
      expect(a.fish.curedCount()).toBe(3);
      expect(b.fish.curedCount()).toBe(Math.min(4, other.fishCount));
    });
  });
});

describe('the album', () => {
  const GOOD = {
    lake: 'duckpond',
    day: 2,
    time: 0.5,
    weather: 'fog',
    view: { x: 0, y: 0, z: 0, azimuth: 1, polar: 1, radius: 30 },
    kinds: ['bream'],
    lit: false,
  };
  const albumOf = (photos: unknown, day = 5) => new Progress(memoryStore(JSON.stringify({ day, photos }))).save.photos;

  it('is none by default, and an old save without the field has none', () => {
    expect(albumOf(undefined)).toEqual([]);
    expect(new Progress(memoryStore('{"cured": 3}')).save.photos).toEqual([]);
  });

  it('keeps a good photograph and drops each malformed one', () => {
    const bad = [
      { ...GOOD, lake: 'nowhere' },
      { ...GOOD, time: 1 },
      { ...GOOD, time: -0.1 },
      { ...GOOD, day: 6 },
      { ...GOOD, day: 0 },
      { ...GOOD, day: 1.5 },
      { ...GOOD, weather: 'hail' },
      { ...GOOD, kinds: ['bream', 'kraken'] },
      { ...GOOD, kinds: 'bream' },
      { ...GOOD, lit: 1 },
      { ...GOOD, view: { ...GOOD.view, radius: null } },
      { ...GOOD, view: 4 },
      null,
      'x',
    ];
    expect(albumOf([...bad, GOOD, ...bad])).toEqual([GOOD]);
  });

  it('is none when it is not a list, and held to the first twelve', () => {
    for (const bad of [null, 4, 'x', { 0: GOOD }]) expect(albumOf(bad)).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...GOOD, day: 1 + (i % 5) }));
    expect(albumOf(many)).toEqual(many.slice(0, PHOTOS.most));
  });

  it('keeps each kind of a photograph once', () => {
    expect(albumOf([{ ...GOOD, kinds: ['bream', 'bream'] }])[0].kinds).toEqual(['bream']);
  });
});

describe('the tally', () => {
  const tallyOf = (tally: unknown) => new Progress(memoryStore(JSON.stringify({ tally }))).save.tally;

  it('is nought by default, and an old save without the field has none', () => {
    expect(tallyOf(undefined)).toEqual({ rain: 0, run: 0, best: 0 });
    expect(new Progress(memoryStore('{"cured": 3}')).save.tally).toEqual({ rain: 0, run: 0, best: 0 });
    expect(new Progress(memoryStore(null)).save.tally).toEqual({ rain: 0, run: 0, best: 0 });
  });

  it('keeps good figures', () => {
    expect(tallyOf({ rain: 4, run: 2, best: 5 })).toEqual({ rain: 4, run: 2, best: 5 });
  });

  it('takes anything but a non-negative whole number as nought, each on its own', () => {
    for (const bad of [-1, 1.5, '3', null, Number.NaN, Infinity, 2 ** 60, {}, [1]])
      expect(tallyOf({ rain: bad, run: 1, best: 2 }), JSON.stringify(bad)).toEqual({ rain: 0, run: 1, best: 2 });
  });

  it('is none when it is not an object', () => {
    for (const bad of [null, 4, 'x', [1, 2, 3]]) expect(tallyOf(bad)).toEqual({ rain: 0, run: 0, best: 0 });
  });

  it('holds the run to the best', () => {
    expect(tallyOf({ rain: 0, run: 5, best: 3 })).toEqual({ rain: 0, run: 3, best: 3 });
    expect(tallyOf({ rain: 0, run: 2 })).toEqual({ rain: 0, run: 0, best: 0 });
  });
});
