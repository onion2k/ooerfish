/**
 * The post's page as plain words (`docs/post.md`): the letters the town has written, the open ones first in the order
 * of the list and the answered ones after in the order they were answered, each with its reply under it. Pure, so it is
 * tested without a page; the page writes what this says.
 */
import type { Save } from '../progress';
import type { Request } from './requests';

export interface PostLetter {
  id: string;
  /** Who it is from. */
  from: string;
  /** "From Ida Penny", or "Answered: from Ida Penny". */
  heading: string;
  /** The letter. */
  body: string;
  /** What came back, or null while the letter is open. */
  reply: string | null;
}

export interface PostPage {
  title: string;
  letters: PostLetter[];
}

/** The page for these requests and a save that has answered some. */
export function postWords(requests: readonly Request[], save: Pick<Save, 'requests'>): PostPage {
  const open = requests
    .filter((r) => !save.requests.includes(r.id))
    .map((r): PostLetter => ({ id: r.id, from: r.from, heading: `From ${r.from}`, body: r.asks, reply: null }));
  const answered: PostLetter[] = [];
  for (const id of save.requests) {
    const r = requests.find((q) => q.id === id);
    if (r) answered.push({ id, from: r.from, heading: `Answered: from ${r.from}`, body: r.asks, reply: r.reply });
  }
  return { title: 'Post', letters: [...open, ...answered] };
}
