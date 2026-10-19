/**
 * The wall calendar's arithmetic, without a picture: which of the year's squares are gone and which is today, from the
 * day of play. The year is `CALENDAR.days` squares and then comes round again, so day 57 is the first square with none
 * gone. A day that is not a safe whole number of one or more reads as day one, as the save reads it, so the squares are
 * always a whole count and today is always one of them.
 */
import { CALENDAR } from './lake';

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
