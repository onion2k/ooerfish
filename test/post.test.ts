/** The post's page: open letters first, in order, then the answered ones with their replies; pure sums, tested without a page. */
import { describe, expect, it } from 'vitest';
import { LAKES } from '../src/lakes';
import type { Save } from '../src/progress';
import { REQUESTS } from '../src/town/requests';
import { postWords } from '../src/town/post';

const save = (requests: string[]): Save => ({
  lake: 'duckpond',
  lakes: {},
  day: 1,
  time: 0.25,
  place: 'pond',
  requests,
  photos: [],
  tally: { rain: 0, run: 0, best: 0 },
});

describe('the words of the post page', () => {
  it('lists the eight letters open, in order, with no reply, for an empty save', () => {
    const page = postWords(REQUESTS, save([]), LAKES);
    expect(page.title).toBe('Post');
    expect(page.letters.map((l) => l.id)).toEqual([
      'ducks',
      'rainbow',
      'biggest',
      'pink',
      'logbook',
      'window',
      'rain',
      'casts',
    ]);
    for (const l of page.letters) expect(l.reply).toBeNull();
    expect(page.letters[0].heading).toBe('From Ida Penny');
    expect(page.letters[0].body).toBe(REQUESTS[0].asks);
    expect(page.letters[0].from).toBe('Ida Penny');
  });

  it('puts the answered letters after the open ones, with their replies and headings', () => {
    const page = postWords(REQUESTS, save(['ducks']), LAKES);
    expect(page.letters.map((l) => l.id)).toEqual([
      'rainbow',
      'biggest',
      'pink',
      'logbook',
      'window',
      'rain',
      'casts',
      'ducks',
    ]);
    const ducks = page.letters[7];
    expect(ducks.heading).toBe('Answered: from Ida Penny');
    expect(ducks.reply).toBe(REQUESTS[0].reply);
    expect(ducks.body).toBe(REQUESTS[0].asks);
    expect(page.letters[0].reply).toBeNull();
    expect(page.letters[0].heading).toBe('From Pip and the Glow-Worms');
  });

  it('keeps the answered ones in the order they were answered', () => {
    const page = postWords(REQUESTS, save(['biggest', 'ducks']), LAKES);
    expect(page.letters.map((l) => l.id)).toEqual([
      'rainbow',
      'pink',
      'logbook',
      'window',
      'rain',
      'casts',
      'biggest',
      'ducks',
    ]);
  });

  it('is pure: the same save gives the same words and the save is untouched', () => {
    const s = save(['rainbow']);
    const a = postWords(REQUESTS, s, LAKES);
    const b = postWords(REQUESTS, s, LAKES);
    expect(a).toEqual(b);
    expect(s.requests).toEqual(['rainbow']);
  });

  it('ignores an id it does not know', () => {
    expect(postWords(REQUESTS, save(['nobody']), LAKES).letters).toHaveLength(8);
  });

  it('carries the counter under an open letter that has one, and none under an answered one', () => {
    const open = postWords(REQUESTS, save([]), LAKES);
    const byId = (page: ReturnType<typeof postWords>, id: string) => page.letters.find((l) => l.id === id)!;
    expect(byId(open, 'rain').progress).toBe('In the rain so far: 0 of 3.');
    expect(byId(open, 'casts').progress).toBe('Best run: 0 of 3.');
    expect(byId(open, 'ducks').progress).toBeNull();
    const done = postWords(REQUESTS, save(['rain']), LAKES);
    expect(byId(done, 'rain').progress).toBeNull();
    expect(byId(done, 'casts').progress).toBe('Best run: 0 of 3.');
  });
});
