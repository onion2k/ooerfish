/** The post's page: open letters first, in order, then the answered ones with their replies; pure sums, tested without a page. */
import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../src/town/requests';
import { postWords } from '../src/town/post';

const save = (requests: string[]) => ({ requests });

describe('the words of the post page', () => {
  it('lists the six letters open, in order, with no reply, for an empty save', () => {
    const page = postWords(REQUESTS, save([]));
    expect(page.title).toBe('Post');
    expect(page.letters.map((l) => l.id)).toEqual(['ducks', 'rainbow', 'biggest', 'pink', 'logbook', 'window']);
    for (const l of page.letters) expect(l.reply).toBeNull();
    expect(page.letters[0].heading).toBe('From Ida Penny');
    expect(page.letters[0].body).toBe(REQUESTS[0].asks);
    expect(page.letters[0].from).toBe('Ida Penny');
  });

  it('puts the answered letters after the open ones, with their replies and headings', () => {
    const page = postWords(REQUESTS, save(['ducks']));
    expect(page.letters.map((l) => l.id)).toEqual(['rainbow', 'biggest', 'pink', 'logbook', 'window', 'ducks']);
    const ducks = page.letters[5];
    expect(ducks.heading).toBe('Answered: from Ida Penny');
    expect(ducks.reply).toBe(REQUESTS[0].reply);
    expect(ducks.body).toBe(REQUESTS[0].asks);
    expect(page.letters[0].reply).toBeNull();
    expect(page.letters[0].heading).toBe('From Pip and the Glow-Worms');
  });

  it('keeps the answered ones in the order they were answered', () => {
    const page = postWords(REQUESTS, save(['biggest', 'ducks']));
    expect(page.letters.map((l) => l.id)).toEqual(['rainbow', 'pink', 'logbook', 'window', 'biggest', 'ducks']);
  });

  it('is pure: the same save gives the same words and the save is untouched', () => {
    const s = save(['rainbow']);
    const a = postWords(REQUESTS, s);
    const b = postWords(REQUESTS, s);
    expect(a).toEqual(b);
    expect(s.requests).toEqual(['rainbow']);
  });

  it('ignores an id it does not know', () => {
    expect(postWords(REQUESTS, save(['nobody'])).letters).toHaveLength(6);
  });
});
