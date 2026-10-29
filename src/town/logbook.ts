/**
 * The plant's logbook (`docs/logbook.md`): six pages written by the engineer, lying on the beds of the lakes as junk
 * treasures with a page number. The book is read over every lake, so a page found at the Reservoir reads at the pond;
 * these are the sums that gather the pages, say which are found and word the journal's section, tested without a page.
 */
import type { Lake } from '../lakes/lake';
import type { Save } from '../progress';

/** A page of the book as the lakes have it: its treasure's id, its number, the lake it lies in and what it says. */
export interface LogbookPageSpec {
  id: string;
  page: number;
  lakeId: string;
  words: string;
}

/** One line of the journal's logbook section. */
export interface LogbookRow {
  page: number;
  found: boolean;
  /** The page's words once it is found, and "not yet found" until then. */
  words: string;
}

/** The journal's logbook section as the page shows it. */
export interface LogbookWords {
  title: string;
  rows: LogbookRow[];
  found: string;
}

/** Every page over the lakes, in page order whatever order the lakes come in. */
export function logbookPages(lakes: Record<string, Lake>): LogbookPageSpec[] {
  const pages: LogbookPageSpec[] = [];
  for (const [lakeId, lake] of Object.entries(lakes)) {
    for (const t of lake.treasures.list) {
      if (t.page !== undefined) pages.push({ id: t.id, page: t.page, lakeId, words: t.note ?? '' });
    }
  }
  return pages.sort((a, b) => a.page - b.page);
}

/** The ids of the pages the save has found, over every lake's entry; an id that is no lake's page is left out. */
export function pagesFound(save: Save, lakes: Record<string, Lake>): Set<string> {
  const pages = new Set(logbookPages(lakes).map((p) => p.id));
  const found = new Set<string>();
  for (const entry of Object.values(save.lakes)) {
    for (const id of entry.found) if (pages.has(id)) found.add(id);
  }
  return found;
}

/** The logbook section's words: a row a page in order, its words once found, and how many are found. */
export function logbookWords(lakes: Record<string, Lake>, save: Save): LogbookWords {
  const pages = logbookPages(lakes);
  const have = pagesFound(save, lakes);
  const rows = pages.map(({ id, page, words }): LogbookRow => {
    const found = have.has(id);
    return { page, found, words: found ? words : 'not yet found' };
  });
  return { title: 'The logbook', rows, found: `pages found: ${rows.filter((r) => r.found).length} of ${rows.length}` };
}
