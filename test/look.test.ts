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
  TOY,
  WOOD_PAINT,
  lookFor,
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

  it('stand the dawn and dusk suns low ahead of the angler, north over the lake, so the sun lies in a lane across the water, and keep the day sun behind', () => {
    // docs/crystal-2.md part 3: the lane shows only where the camera looks toward the sun, and from the Shore view on
    // the south bank that is north; chosen by the user from the stills of 15 October 2026, with the day sun kept where
    // it stood so the cliff, which faces the angler, stays lit by day
    expect(timeNamed('dawn').sun).toEqual([0.45, 0.8, 0.35]);
    expect(timeNamed('dusk').sun).toEqual([-0.45, 0.8, 0.3]);
    expect(timeNamed('day').sun).toEqual([0.45, -0.5, 0.74]);
    for (const name of ['dawn', 'dusk']) expect(timeNamed(name).sun[1], name).toBeGreaterThan(0);
    expect(timeNamed('day').sun[1]).toBeLessThan(0);
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

describe('the light the renderer is handed', () => {
  const day = lookFor(timeNamed('day'));

  it('has the deep cool shade, the cool fill, the stronger rim and the corners shaded, as the painted edge wants', () => {
    expect(day.shadeColour).toEqual([0.13, 0.19, 0.34]);
    expect(day.skyLight).toEqual([0.2, 0.25, 0.42]);
    expect(day.groundLight).toEqual([0.15, 0.17, 0.13]);
    expect(day.rim).toBe(0.4);
    expect(day).toMatchObject({ occlusion: 4, occlusionRadius: 12, occlusionTint: 1, occlusionDirect: 0.25 });
    // the package holds form to three and the look asks four, as ooergolf's does: the asking is the content
    expect(TOY.form).toBe(4);
  });

  it('scales the fill by each time’s ambient, so night’s is the day’s times night’s ambient', () => {
    const night = timeNamed('night');
    const dark = lookFor(night);
    for (let c = 0; c < 3; c++) {
      expect(dark.skyLight[c]).toBeCloseTo(day.skyLight[c] * night.ambient, 10);
      expect(dark.groundLight[c]).toBeCloseTo(day.groundLight[c] * night.ambient, 10);
    }
    // the shade and the occlusion are the look's own, the same at every time
    expect(dark.shadeColour).toEqual(day.shadeColour);
    expect(dark.occlusion).toBe(day.occlusion);
  });

  it('hands over each time’s sun as the palette has it, the day’s warmer than it was and the others moved alike', () => {
    for (const t of TIMES) expect(lookFor(t).sunColour, t.name).toEqual(t.sunColour);
    expect(PALETTE.daylight).toEqual([2.9, 2.5, 1.9]);
    // the day moved by these factors per channel, and dawn and dusk moved by the same, from 2.2, 1.65, 1.25 and 2.2, 1.35, 0.95
    const f = [2.9 / 2.6, 2.5 / 2.45, 1.9 / 2.2];
    const was: Record<string, number[]> = {
      dawnlight: [2.2, 1.65, 1.25],
      dusklight: [2.2, 1.35, 0.95],
      moonlight: [0.28, 0.34, 0.55],
    };
    for (const [name, from] of Object.entries(was))
      for (let c = 0; c < 3; c++)
        expect((PALETTE as Record<string, readonly number[]>)[name][c], `${name} ${c}`).toBeCloseTo(from[c] * f[c], 4);
  });

  it('carries the paint sets at every time, and none when the paint is off', () => {
    for (const t of TIMES) expect(lookFor(t).paint).toBe(PAINT);
    expect(lookFor(timeNamed('day'), 'off').paint).toEqual(paintFor('off'));
  });
});

describe('the rocks’ colours', () => {
  it('are a matte face darker than the chalk that strokes it: the boulders’ and the cliff’s', () => {
    expect(PALETTE.boulder).toEqual([0.12, 0.12, 0.115]);
    expect(PALETTE.cliff).toEqual([0.11, 0.12, 0.145]);
    for (let c = 0; c < 3; c++) {
      expect(PALETTE.boulder[c]).toBeLessThan(PALETTE.chalk[c] / 3);
      expect(PALETTE.cliff[c]).toBeLessThan(PALETTE.chalkCool[c] / 3);
    }
  });
});
