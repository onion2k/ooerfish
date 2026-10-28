/**
 * The sleep page's words (`docs/moon.md`): the marked nights ahead, each with how many nights it is and whether it may
 * be chosen. A pure function of the day, so it is tested without a page; the page writes what it says each time it
 * opens and not on a frame.
 */
import { nextFull, nextNew, nextWeather } from '../calendar';
import { WEATHER, type Weather } from '../lake';

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

/** The weather's kinds that have a row, with the name each is called in the label (sunny is the plain day, so none). */
const WEATHER_NAMES: Readonly<Partial<Record<Weather, string>>> = {
  rain: 'rain',
  fog: 'fog',
  shower: 'sun-shower',
  wind: 'wind',
};

/**
 * The choices on `day`, nearest first: the moon's marks and the weather's next days within a round. The festivals'
 * nights join the list when they come, each a row of the same shape, and are put in order of distance with these.
 * A tie keeps the moon first, then the weather's kinds in the order of `WEATHER.kinds`, since the sort is stable.
 */
export function sleepWords(day: number, fighting: boolean): SleepRow[] {
  const rows: { nights: number; label: string }[] = [
    { nights: nextFull(day), label: 'the full moon' },
    { nights: nextNew(day), label: 'the new moon' },
  ];
  for (const kind of WEATHER.kinds) {
    const name = WEATHER_NAMES[kind];
    const nights = name === undefined ? null : nextWeather(day, kind);
    if (nights !== null) rows.push({ nights, label: `the next ${name}` });
  }
  rows.sort((a, b) => a.nights - b.nights);
  return rows.map((r) => ({
    nights: r.nights,
    label: `Till ${r.label} (${nightsOf(r.nights)})`,
    enabled: !fighting,
  }));
}
