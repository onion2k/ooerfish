/** The times of day as data, and the sky each is mirrored from. */
import { describe, expect, it } from 'vitest';
import { PAINT_DEFAULT } from 'artshape-render/game/paint';
import { PALETTE } from '../src/palette';
import {
  CLIFF_PAINT,
  PAINT,
  ROCK_PAINT,
  SKY_SIZE,
  TIMES,
  WOOD_PAINT,
  nearestTime,
  paintFor,
  skyImage,
  timeNamed,
} from '../src/look';

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

describe('the paint sets', () => {
  it('are the rock’s, the wood’s and the cliff’s, in the order the meshes name them by set', () => {
    expect(PAINT).toEqual([ROCK_PAINT, WOOD_PAINT, CLIFF_PAINT]);
  });

  it('take their chalk from the palette, the rock’s the package’s own recipe with it', () => {
    expect(ROCK_PAINT).toEqual({ ...PAINT_DEFAULT, lightColour: PALETTE.chalk });
    expect(CLIFF_PAINT.lightColour).toEqual(PALETTE.chalkCool);
    expect(CLIFF_PAINT).toEqual({ ...ROCK_PAINT, widthFacet: 0.06, gate: 0.45, lightColour: PALETTE.chalkCool });
    expect(WOOD_PAINT.lightColour).toEqual(PALETTE.chalkWarm);
    expect(WOOD_PAINT).toMatchObject({ light: 0.5, widthFacet: 0.05, gate: 0.5, markValue: 0, markEnd: 0, markHue: 0 });
  });

  it('are the sets themselves with the paint on, and have every light and dark at nought with it off', () => {
    expect(paintFor('on')).toBe(PAINT);
    const off = paintFor('off');
    expect(off).toHaveLength(PAINT.length);
    for (const set of off) {
      expect(set.light).toBe(0);
      expect(set.dark).toBe(0);
    }
    // a set that darkens as well is let go of too: the sets carry no dark today, so one is made for the test
    const darker = paintFor('off', [{ ...ROCK_PAINT, dark: 0.5 }]);
    expect(darker[0].dark).toBe(0);
    expect(darker[0].light).toBe(0);
    // what is not the light is left as it was, and the sets themselves are not written over
    expect(off[2].gate).toBe(CLIFF_PAINT.gate);
    expect(ROCK_PAINT.light).toBe(PAINT_DEFAULT.light);
    expect(ROCK_PAINT.light).toBeGreaterThan(0);
  });
});
