/**
 * The wall calendar's arithmetic, without a picture: which of the year's squares are gone and which is today, from the
 * day of play. The year is `CALENDAR.days` squares and then comes round again, so day 57 is the first square with none
 * gone. A day that is not a safe whole number of one or more reads as day one, as the save reads it, so the squares are
 * always a whole count and today is always one of them.
 */
import { CALENDAR, MOON, SEASONS, type Season } from './lake';

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
