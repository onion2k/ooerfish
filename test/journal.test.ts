/** The journal: an entry updated on each catch, and the words of its page. */
import { describe, expect, it } from 'vitest';
import { journalWords, recorded } from '../src/journal';
import { DRUMS, KINDS } from '../src/lake';

describe('an entry on a catch', () => {
  it('starts at one, with the weight as the best and the day as the first', () => {
    expect(recorded(undefined, 1.25, 3)).toEqual({ caught: 1, best: 1.25, first: 3 });
  });

  it('keeps the heavier weight when a better one is caught, and counts it', () => {
    expect(recorded({ caught: 1, best: 1.25, first: 3 }, 1.8, 5)).toEqual({ caught: 2, best: 1.8, first: 3 });
  });

  it('keeps the best when a worse one is caught, and the first day whatever day it is now', () => {
    expect(recorded({ caught: 2, best: 1.8, first: 3 }, 0.5, 9)).toEqual({ caught: 3, best: 1.8, first: 3 });
  });

  it('does not change the entry it was given', () => {
    const was = { caught: 1, best: 1, first: 1 };
    recorded(was, 2, 2);
    expect(was).toEqual({ caught: 1, best: 1, first: 1 });
  });
});

describe('the journal page’s words', () => {
  it('names every kind, caught or not, in order, and says none is caught yet of a new journal', () => {
    const page = journalWords({}, KINDS, 0, DRUMS.count);
    expect(page.rows.map((r) => r.name)).toEqual(KINDS.map((k) => k.name));
    for (const row of page.rows) expect(row).toMatchObject({ caught: false, words: 'not yet caught' });
  });

  it('gives the count, the best weight to the gram’s hundredth and the first day of a kind caught', () => {
    const page = journalWords({ pike: { caught: 3, best: 3.6, first: 2 } }, KINDS, 0, 2);
    const pike = page.rows.find((r) => r.name === 'pike')!;
    expect(pike).toEqual({ name: 'pike', caught: true, words: '3 caught, best 3.60 kg, first on day 2' });
    expect(page.rows.find((r) => r.name === 'sunny bream')!.words).toBe('not yet caught');
  });

  it('leaves unsaid a best weight or a first day that was read as nought', () => {
    const words = (e: { caught: number; best: number; first: number }) =>
      journalWords({ pike: e }, KINDS, 0, 2).rows.find((r) => r.name === 'pike')!.words;
    expect(words({ caught: 2, best: 0, first: 3 })).toBe('2 caught, first on day 3');
    expect(words({ caught: 2, best: 3, first: 0 })).toBe('2 caught, best 3.00 kg');
    expect(words({ caught: 2, best: 0, first: 0 })).toBe('2 caught');
  });

  it('ignores an entry for a kind it was not handed', () => {
    const page = journalWords({ eel: { caught: 1, best: 1, first: 1 } }, KINDS, 0, 2);
    expect(page.rows.every((r) => !r.caught)).toBe(true);
  });

  it('says the drums hauled of those there are', () => {
    expect(journalWords({}, KINDS, 1, 2).drums).toBe('drums of waste hauled: 1 of 2');
    expect(journalWords({}, KINDS, 0, 2).drums).toBe('drums of waste hauled: 0 of 2');
  });
});
