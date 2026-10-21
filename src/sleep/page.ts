/**
 * The sleep page's words (`docs/moon.md`): the marked nights ahead, each with how many nights it is and whether it may
 * be chosen. A pure function of the day, so it is tested without a page; the page writes what it says each time it
 * opens and not on a frame.
 */
import { nextFull, nextNew } from '../calendar';

export interface SleepRow {
  /** How many nights to sleep through: a whole number from one to `MOON.days`. */
  nights: number;
  /** The choice in words: "Till the full moon (3 nights)". */
  label: string;
  /** Whether it may be chosen, which it may not with a fish on the line or landed. */
  enabled: boolean;
}

/** "(1 night)" or "(3 nights)". */
const nightsOf = (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`;

/**
 * The choices on `day`, nearest first. Only the moon's marks are listed for now; the weather's and the festivals'
 * nights join the list when they come, each a row of the same shape, and are put in order of distance with these.
 */
export function sleepWords(day: number, fighting: boolean): SleepRow[] {
  const rows = [
    { nights: nextFull(day), name: 'full' },
    { nights: nextNew(day), name: 'new' },
  ];
  rows.sort((a, b) => a.nights - b.nights);
  return rows.map((r) => ({
    nights: r.nights,
    label: `Till the ${r.name} moon (${nightsOf(r.nights)})`,
    enabled: !fighting,
  }));
}
