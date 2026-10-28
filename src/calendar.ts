/**
 * The wall calendar's arithmetic, without a picture: which of the year's squares are gone and which is today, from the
 * day of play. The year is `CALENDAR.days` squares and then comes round again, so day 57 is the first square with none
 * gone. A day that is not a safe whole number of one or more reads as day one, as the save reads it, so the squares are
 * always a whole count and today is always one of them.
 */
import { CALENDAR, MOON, SEASONS, WEATHER, type Season, type Weather } from './lake';

/** How many squares are gone (the first ones, so squares 0 to `gone - 1`) and which one is today. */
export interface CalendarMarks {
  gone: number;
  today: number;
}

export function calendarMarks(day: number): CalendarMarks {
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  const today = (d - 1) % CALENDAR.days;
  return { gone: today, today };
}

/** The season a day of play falls in, a row of the calendar's year; a bad day reads as day one, as the squares do. */
export function seasonOf(day: number): Season {
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  return SEASONS[Math.floor(((d - 1) % CALENDAR.days) / CALENDAR.seasonDays)];
}

/** The moon's phase on a day, 0 (full) to `MOON.days - 1`; a bad day reads as day one, as the squares do. */
export function moonOf(day: number): number {
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  return (d - 1) % MOON.days;
}

/** The name of a phase, from `MOON.names`. */
export function moonName(phase: number): string {
  return MOON.names[phase] ?? MOON.names[MOON.full];
}

/** The share of the full moon's light a phase gives: 1 at full, `MOON.darkest` at new, a cosine between. */
export function moonLight(phase: number): number {
  return MOON.darkest + ((1 - MOON.darkest) * (1 + Math.cos((2 * Math.PI * phase) / MOON.days))) / 2;
}

/** Nights from this day to the phase `to`, one to `MOON.days`: on the day itself, a whole round. */
function nightsTo(day: number, to: number): number {
  return ((to - moonOf(day) - 1 + MOON.days) % MOON.days) + 1;
}

/** Nights until the next full moon, one to eight; on a full-moon day, the round to the next. */
export function nextFull(day: number): number {
  return nightsTo(day, MOON.full);
}

/** Nights until the next new moon, one to eight. */
export function nextNew(day: number): number {
  return nightsTo(day, MOON.new);
}

/**
 * The weather on a day: the first day's is `WEATHER.firstDay`, and any other is one draw from a hash of the day (never
 * the game's chance, so the same save has the same forecast every time) set against the cumulative odds of its season.
 * A bad day reads as day one, as the season and the moon do.
 */
export function weatherOf(day: number): Weather {
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  if (d === 1) return WEATHER.firstDay;
  const odds = WEATHER.odds[seasonOf(d)];
  const draw = dayHash(d);
  let sum = 0;
  for (let i = 0; i < odds.length; i++) {
    sum += odds[i];
    if (draw < sum) return WEATHER.kinds[i];
  }
  // the odds sum to one and a draw is below it, so this is only the rounding of the last sum
  return WEATHER.kinds[odds.length - 1];
}

/**
 * A number in [0, 1) from a day, each day's unrelated to its neighbours': the integer mix murmur3 finishes with. One
 * step of `seeded(day)` is not that: its first draw climbs in a straight line with the seed, so the weather came in
 * runs of a fortnight.
 */
export function dayHash(day: number): number {
  let h = day >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Nights from this day to the next day of that weather, one to `MOON.days` (the sleep's cap), or null if none comes within them; never zero. */
export function nextWeather(day: number, kind: Weather): number | null {
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  for (let n = 1; n <= MOON.days; n++) if (weatherOf(d + n) === kind) return n;
  return null;
}
