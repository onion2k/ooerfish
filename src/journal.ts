/**
 * The journal: what has been caught, kind by kind, and the words of its page, as plain sums. An entry is how many of a
 * kind have been caught, the heaviest of them, and the day the first was. The kinds and the drums are handed in, so
 * this module knows nothing of the lake's content and is tested without a page; the save keeps the entries (`progress`
 * reads them back field by field), the game writes one at each stow, and the page only shows `journalWords`.
 */

import { theLake } from './lakes/page';

/**
 * What is kept of one kind: how many are caught, the best weight in kilograms, and the day of the first (from one).
 * A best or a first a save could not vouch for is read as nought, which the page leaves unsaid.
 */
export interface JournalEntry {
  caught: number;
  best: number;
  first: number;
}

/** Entries by the kind's id; a kind never caught has none. */
export type Journal = Partial<Record<string, JournalEntry>>;

/** The entry after one more catch: the count up, the heavier weight kept, and the first day kept from the first catch. */
export function recorded(entry: JournalEntry | undefined, weight: number, day: number): JournalEntry {
  if (!entry) return { caught: 1, best: weight, first: day };
  return { caught: entry.caught + 1, best: Math.max(entry.best, weight), first: entry.first };
}

/** A kind as the page needs it: the key its entry is kept under and the name it is called. */
export interface JournalKind {
  id: string;
  name: string;
}

export interface JournalRow {
  name: string;
  /** Whether any of the kind has been caught. */
  caught: boolean;
  /** What is said of it: the count, the best weight and the first day, or that none is caught yet. */
  words: string;
}

/** A junk treasure as the page needs it: the key it is kept under, what it is called, and the note it holds if it holds one. */
export interface JournalTreasure {
  id: string;
  name: string;
  note?: string;
}

export interface JournalTreasureRow {
  /** Its name once found, and "not yet found" until then. */
  name: string;
  found: boolean;
  /** What the message in it says, once it is found; a treasure with no message, or not yet found, has none. */
  note?: string;
}

export interface JournalPage {
  /** The page's heading: "Journal" at the home, where the book began, and "Journal: <lake>" at another lake, since the book is kept a lake at a time. */
  title: string;
  /** The treasures' heading, naming the lake: the pond for the home. */
  foundTitle: string;
  rows: JournalRow[];
  /** The junk's line, below the kinds. */
  drums: string;
  /** The treasures found in the pond, each by name or as not yet found, in the order the pond has them. */
  treasures: JournalTreasureRow[];
  /** How many of them are found, in words. */
  found: string;
}

/**
 * The words of the journal page: each kind, caught or not, the drums of waste hauled out of those on the bed, and each
 * junk treasure found (by `found`, a list of ids) by name, with the bottle's note under it, or as not yet found. An id of
 * a treasure not handed in is ignored. `lakeName` is the lake the book is of, or null at the home, whose page keeps
 * the plain heading it has always had.
 */
export function journalWords(
  journal: Readonly<Journal>,
  kinds: readonly JournalKind[],
  hauled: number,
  drums: number,
  treasures: readonly JournalTreasure[] = [],
  found: readonly string[] = [],
  lakeName: string | null = null,
): JournalPage {
  const rows = kinds.map(({ id, name }): JournalRow => {
    const e = journal[id];
    if (!e || e.caught < 1) return { name, caught: false, words: 'not yet caught' };
    // a best weight or a first day the save could not vouch for was read as nought, and is left out and not made up
    const parts = [`${e.caught} caught`];
    if (e.best > 0) parts.push(`best ${e.best.toFixed(2)} kg`);
    if (e.first > 0) parts.push(`first on day ${e.first}`);
    return { name, caught: true, words: parts.join(', ') };
  });
  const has = new Set(found);
  const rows2 = treasures.map(({ id, name, note }): JournalTreasureRow => {
    if (!has.has(id)) return { name: 'not yet found', found: false };
    return note ? { name, found: true, note } : { name, found: true };
  });
  const n = rows2.filter((r) => r.found).length;
  return {
    title: lakeName ? `Journal: ${lakeName}` : 'Journal',
    foundTitle: `Found in ${lakeName ? theLake(lakeName) : 'the pond'}`,
    rows,
    drums: `drums of waste hauled: ${hauled} of ${drums}`,
    treasures: rows2,
    found: `found: ${n} of ${treasures.length}`,
  };
}
