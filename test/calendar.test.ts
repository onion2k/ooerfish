/** The wall calendar's arithmetic: a day of play to the squares gone and today's. */
import { describe, expect, it } from 'vitest';
import { calendarMarks, seasonOf } from '../src/calendar';
import { CALENDAR, SEASONS } from '../src/lake';

describe('the calendar’s marks', () => {
  it('has four seasons of fourteen squares', () => {
    expect(CALENDAR.days).toBe(56);
    expect(CALENDAR.rows * CALENDAR.columns).toBe(CALENDAR.days);
  });

  it('shows none gone and the first square today on day one', () => {
    expect(calendarMarks(1)).toEqual({ gone: 0, today: 0 });
  });

  it('has one more gone each day', () => {
    expect(calendarMarks(2)).toEqual({ gone: 1, today: 1 });
    expect(calendarMarks(10)).toEqual({ gone: 9, today: 9 });
  });

  it('has the last square today on day 56, with the 55 before it gone', () => {
    expect(calendarMarks(56)).toEqual({ gone: 55, today: 55 });
  });

  it('comes round to the first square on day 57, and again on 113', () => {
    expect(calendarMarks(57)).toEqual(calendarMarks(1));
    expect(calendarMarks(113)).toEqual(calendarMarks(1));
    expect(calendarMarks(114)).toEqual(calendarMarks(2));
  });

  it('reads a day that is not a safe whole number of one or more as day one, as the save does', () => {
    for (const bad of [0, -3, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2])
      expect(calendarMarks(bad), String(bad)).toEqual({ gone: 0, today: 0 });
  });

  it('never has today past the last square, nor more gone than fit', () => {
    for (const day of [1, 55, 56, 57, 1000, Number.MAX_SAFE_INTEGER]) {
      const { gone, today } = calendarMarks(day);
      expect(today).toBeGreaterThanOrEqual(0);
      expect(today).toBeLessThan(CALENDAR.days);
      expect(gone).toBeLessThanOrEqual(CALENDAR.days - 1);
    }
  });
});

describe('the season of a day', () => {
  it('has as many days in the seasons as the calendar has squares', () => {
    expect(CALENDAR.seasonDays * SEASONS.length).toBe(CALENDAR.days);
    expect(CALENDAR.seasonDays).toBe(CALENDAR.columns);
    expect(SEASONS).toEqual(['summer', 'autumn', 'winter', 'spring']);
  });

  it('gives each season its fortnight, summer first', () => {
    expect([1, 14].map(seasonOf)).toEqual(['summer', 'summer']);
    expect([15, 28].map(seasonOf)).toEqual(['autumn', 'autumn']);
    expect([29, 42].map(seasonOf)).toEqual(['winter', 'winter']);
    expect([43, 56].map(seasonOf)).toEqual(['spring', 'spring']);
  });

  it('comes round to summer on day 57', () => {
    expect(seasonOf(57)).toBe('summer');
    expect(seasonOf(71)).toBe('autumn');
  });

  it('reads a bad day as day one, as the squares do', () => {
    for (const bad of [0, -3, 1.5, NaN, Infinity]) expect(seasonOf(bad)).toBe('summer');
  });
});
