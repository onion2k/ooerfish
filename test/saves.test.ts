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
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

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
    expect(new Progress(memoryStore('not json')).save).toEqual({ cured: 0 });
    expect(new Progress(memoryStore('[1, 2]')).save).toEqual({ cured: 0 });
    expect(new Progress(memoryStore('{"bank": 7}')).save).toEqual({ cured: 0 });
    // a count that is not a whole number of fish, or is a string, a null or a list, is taken for none
    for (const bad of ['-3', '2.5', '"7"', 'null', '[4]', '1e400', '9007199254740993'])
      expect(new Progress(memoryStore(`{"cured": ${bad}}`)).save, bad).toEqual({ cured: 0 });
    // and one that is, is kept, with whatever else the save said left alone
    expect(new Progress(memoryStore('{"cured": 12, "bank": 7}')).save.cured).toBe(12);
  });

  it('starts over: a save of seven cured is wiped in memory and in the store, and a new load finds none', () => {
    const store = memoryStore('{"cured": 7}');
    const progress = new Progress(store);
    expect(progress.save.cured).toBe(7);
    progress.reset();
    expect(progress.save).toEqual({ cured: 0 });
    expect(store.json).toBeNull();
    expect(new Progress(store).save).toEqual({ cured: 0 });
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    const newest = Object.keys(JSON.parse(read(files[files.length - 1])) as object).sort();
    expect(newest, 'add a save in the new shape to test/saves').toEqual(now);
  });
});
