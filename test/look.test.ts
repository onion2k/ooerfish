/** The times of day as data, and the sky each is mirrored from. */
import { describe, expect, it } from 'vitest';
import { SKY_SIZE, TIMES, nearestTime, skyImage, timeNamed } from '../src/look';

describe('the times of day', () => {
  it('are night, dawn, day and dusk, round the clock in that order', () => {
    expect(TIMES.map((t) => t.name)).toEqual(['night', 'dawn', 'day', 'dusk']);
    expect(TIMES.map((t) => t.at)).toEqual([0, 0.25, 0.5, 0.75]);
    for (const t of TIMES) expect(timeNamed(t.name)).toBe(t);
  });

  it('refuse a name they do not know, by giving the day', () => {
    expect(timeNamed('teatime').name).toBe('day');
  });

  it('are found from a time of day, the nearest round the clock', () => {
    expect(nearestTime(0.5).name).toBe('day');
    expect(nearestTime(0.7).name).toBe('dusk');
    expect(nearestTime(0.1).name).toBe('night');
    // just before midnight is nearer midnight than dusk, round the clock
    expect(nearestTime(0.95).name).toBe('night');
    expect(nearestTime(0.3).name).toBe('dawn');
  });

  it('carry no glow of their own: a fish glows as a mesh under the water, not on its surface by the hour', () => {
    for (const t of TIMES) expect('glow' in t, t.name).toBe(false);
  });

  it("each have a sky that is their own, the zenith's colour overhead and the horizon's at the horizon", () => {
    const seen = new Set<string>();
    for (const t of TIMES) {
      const img = skyImage(t);
      expect(img.width).toBe(SKY_SIZE * 2);
      expect(img.height).toBe(SKY_SIZE);
      expect(img.data.length).toBe(img.width * img.height * 4);
      expect(img.data.every(Number.isFinite)).toBe(true);
      const at = (row: number) => {
        // the middle of a row, away from the sun
        const i = (row * img.width + Math.floor(img.width / 4)) * 4;
        return [img.data[i], img.data[i + 1], img.data[i + 2]];
      };
      const top = at(0),
        horizon = at(Math.floor(img.height / 2) - 1);
      for (let c = 0; c < 3; c++) {
        expect(top[c], `${t.name} overhead`).toBeCloseTo(t.zenith[c], 1);
        expect(horizon[c], `${t.name} at the horizon`).toBeCloseTo(t.horizon[c], 1);
      }
      seen.add(top.join());
    }
    expect(seen.size, 'four skies, not one').toBe(4);
  });
});
