/** The logbook: the plant's six pages gathered over the lakes, in order, and read against a save; pure sums. */
import { describe, expect, it } from 'vitest';
import { HOME, LAKES } from '../src/lakes';
import type { LakeSave, Save } from '../src/progress';
import { logbookPages, logbookWords, pagesFound } from '../src/town/logbook';

const entry = (found: string[]): LakeSave => ({ cured: 0, drums: 0, journal: {}, found });
const saveOf = (lakes: Record<string, LakeSave>): Save => ({
  lake: HOME.id,
  lakes,
  day: 1,
  time: 0.25,
  place: 'pond',
  requests: [],
  photos: [],
});
const other = Object.keys(LAKES).find((id) => id !== HOME.id)!;

describe('the pages over the lakes', () => {
  it('are the registry’s six, numbered 1 to 6 once each, with their words', () => {
    const pages = logbookPages(LAKES);
    expect(pages.map((p) => p.page)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const p of pages) expect(p.words.length).toBeGreaterThan(10);
    expect(pages.filter((p) => p.lakeId === HOME.id)).toHaveLength(3);
    expect(pages[5].words).toContain('Night shift');
  });

  it('are in page order whatever order the lakes come in', () => {
    const reversed = Object.fromEntries(Object.entries(LAKES).reverse());
    expect(logbookPages(reversed)).toEqual(logbookPages(LAKES));
  });

  it('are found over every lake’s list, and an unknown id is ignored', () => {
    const save = saveOf({ [HOME.id]: entry(['page2', 'nope', 'lure']), [other]: entry(['page4']) });
    expect([...pagesFound(save, LAKES)].sort()).toEqual(['page2', 'page4']);
  });

  it('are read without touching the save', () => {
    const save = saveOf({ [HOME.id]: entry(['page1']), [other]: entry(['page6']) });
    const before = JSON.stringify(save);
    logbookWords(LAKES, save);
    expect(JSON.stringify(save)).toBe(before);
  });
});

describe('the logbook’s words', () => {
  it('say not yet found until a page is, then its words, and how many of six', () => {
    const none = logbookWords(LAKES, saveOf({ [HOME.id]: entry([]) }));
    expect(none.title).toBe('The logbook');
    expect(none.rows.map((r) => r.page)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const r of none.rows) expect(r).toMatchObject({ found: false, words: 'not yet found' });
    expect(none.found).toBe('pages found: 0 of 6');

    const some = logbookWords(LAKES, saveOf({ [HOME.id]: entry(['page2']), [other]: entry(['page4']) }));
    expect(some.rows.map((r) => r.found)).toEqual([false, true, false, true, false, false]);
    expect(some.rows[1].words).toBe(logbookPages(LAKES)[1].words);
    expect(some.found).toBe('pages found: 2 of 6');
  });
});
