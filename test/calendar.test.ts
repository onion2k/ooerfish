/** The wall calendar's arithmetic: a day of play to the squares gone and today's. */
import { describe, expect, it } from 'vitest';
import { calendarMarks, moonLight, moonName, moonOf, nextFull, nextNew, seasonOf } from '../src/calendar';
import { CALENDAR, MOON, SEASONS } from '../src/lake';

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

describe('the moon', () => {
  it('is full on days 1, 9 and 57, new on 5, and the quarters on 3 and 7', () => {
    for (const d of [1, 9, 57]) expect(moonName(moonOf(d))).toBe('full');
    expect(moonName(moonOf(5))).toBe('new');
    expect(moonName(moonOf(3))).toBe('last quarter');
    expect(moonName(moonOf(7))).toBe('first quarter');
  });

  it('has eight names in order from the full moon', () => {
    expect(MOON.names).toHaveLength(MOON.days);
    expect(MOON.names[MOON.full]).toBe('full');
    expect(MOON.names[MOON.new]).toBe('new');
  });

  it('gives all its light at full, the least at new, and the same either side', () => {
    expect(moonLight(0)).toBe(1);
    expect(moonLight(4)).toBeCloseTo(MOON.darkest, 12);
    expect(moonLight(1)).toBeCloseTo(moonLight(7), 12);
    expect(moonLight(3)).toBeCloseTo(moonLight(5), 12);
    for (let p = 0; p < MOON.days; p++) expect(moonLight(p)).toBeGreaterThanOrEqual(MOON.darkest - 1e-12);
  });

  it('holds seven rounds in the year of 56 days, so day 57 is day 1', () => {
    expect(CALENDAR.days / MOON.days).toBe(7);
    expect(moonOf(57)).toBe(moonOf(1));
    expect(moonOf(113)).toBe(moonOf(1));
  });

  it('reads a bad day as day one', () => {
    for (const d of [0, -3, 2.5, NaN, Infinity]) expect(moonOf(d)).toBe(moonOf(1));
  });

  it('counts the nights to the next full and new moon, one to eight', () => {
    expect(nextFull(1)).toBe(8);
    expect(nextFull(2)).toBe(7);
    expect(nextFull(8)).toBe(1);
    expect(nextFull(9)).toBe(8);
    expect(nextNew(1)).toBe(4);
    expect(nextNew(5)).toBe(8);
    expect(nextNew(4)).toBe(1);
    expect(nextNew(0)).toBe(nextNew(1));
    for (let d = 1; d <= 20; d++) {
      expect(nextFull(d)).toBeGreaterThanOrEqual(1);
      expect(nextFull(d)).toBeLessThanOrEqual(8);
      expect(moonOf(d + nextFull(d))).toBe(MOON.full);
      expect(moonOf(d + nextNew(d))).toBe(MOON.new);
    }
  });
});
