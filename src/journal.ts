/**
 * The journal: what has been caught, kind by kind, and the words of its page, as plain sums. An entry is how many of a
 * kind have been caught, the heaviest of them, and the day the first was. The kinds and the drums are handed in, so
 * this module knows nothing of the lake's content and is tested without a page; the save keeps the entries (`progress`
 * reads them back field by field), the game writes one at each stow, and the page only shows `journalWords`.
 */

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

export interface JournalPage {
  rows: JournalRow[];
  /** The junk's line, below the kinds. */
  drums: string;
}

/** The words of the journal page: each kind, caught or not, and the drums of waste hauled out of those on the bed. */
export function journalWords(
  journal: Readonly<Journal>,
  kinds: readonly JournalKind[],
  hauled: number,
  drums: number,
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
  return { rows, drums: `drums of waste hauled: ${hauled} of ${drums}` };
}
