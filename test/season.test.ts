/**
 * The seasons' colours (`docs/seasons.md`, part 2): summer is the palette and the grass as they were, every other season
 * moves only the keys it names, the ground under the grass is the colour its blades average to in every season, and
 * the static set and the field take the colours they are handed.
 */
import { describe, expect, it } from 'vitest';
import { grassGround } from 'artshape-render/game/grass';
import { noFog } from 'artshape-render/game/fog';
import { LUSH, bankField } from '../src/grass';
import { SEASONS, SEASON_DRESSING, WATER_LEVEL, type Season } from '../src/lake';
import { PALETTE } from '../src/palette';
import { cabinGroups, jettyGroups } from '../src/cabin';
import { mistFor, seasonGrass, seasonPalette } from '../src/season';
import { GRAVITY_MM, heightAt } from 'artshape-render/game/waves';
import { BREEZE } from '../src/grass';
import { TIMES, nearestTime, timeNamed, timesFor } from '../src/look';
import { mix } from '../src/palette';
import { CLEAR, CLEAR_WAVES, clear, wavesFor } from '../src/water/clear';
import { surfaceOf } from '../src/water/swell';

const others = SEASONS.filter((s) => s !== 'summer');

describe('summer', () => {
  it('moves nothing: the palette key for key, and the grass as LUSH', () => {
    expect(SEASON_DRESSING.summer.palette).toEqual({});
    expect(seasonPalette('summer')).toEqual(PALETTE);
    expect(seasonGrass('summer')).toEqual(LUSH);
  });
});

describe('the other seasons', () => {
  it.each(others)('%s differs from summer only in the keys it names, and the grass ground derived from them', (s) => {
    const named = Object.keys(SEASON_DRESSING[s].palette);
    const moved = seasonPalette(s);
    const differs = (Object.keys(PALETTE) as (keyof typeof PALETTE)[]).filter((k) =>
      moved[k].some((v, c) => v !== PALETTE[k][c]),
    );
    expect(differs.sort()).toEqual([...named, 'grass'].sort());
    for (const k of named) expect(moved[k as keyof typeof PALETTE]).toEqual(SEASON_DRESSING[s].palette[k as never]);
  });

  it.each(SEASONS)('%s names only palette keys, and no colour component leaves [0, 1]', (s) => {
    for (const [k, v] of Object.entries(SEASON_DRESSING[s].palette)) {
      expect(k in PALETTE, `${s} names ${k}`).toBe(true);
      for (const c of v as number[]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
    for (const c of seasonPalette(s).grass) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it.each(SEASONS)('%s has the bank painted the colour its blades average to', (s: Season) => {
    const ground = grassGround(seasonGrass(s));
    for (let c = 0; c < 3; c++) expect(seasonPalette(s).grass[c]).toBeCloseTo(ground[c], 4);
  });

  it('winter grows its grass shorter, and only winter', () => {
    expect(seasonGrass('winter').height).toBeCloseTo(LUSH.height * 0.7, 6);
    for (const s of SEASONS.filter((x) => x !== 'winter')) expect(seasonGrass(s).height).toBe(LUSH.height);
  });

  it('each season keeps LUSH for everything but its blades and height', () => {
    for (const s of SEASONS)
      expect({ ...seasonGrass(s), base: 0, tip: 0, height: 0 }).toEqual({ ...LUSH, base: 0, tip: 0, height: 0 });
  });
});

describe('what is handed a palette', () => {
  const winter = seasonPalette('winter');
  it('the cabin and the jetty take their roof and deck from it, and are as they were without', () => {
    expect(cabinGroups(winter).some((g) => g.albedo === winter.cabinRoof)).toBe(true);
    expect(jettyGroups(winter).some((g) => g.albedo === winter.deck)).toBe(true);
    expect(cabinGroups().some((g) => g.albedo === PALETTE.cabinRoof)).toBe(true);
    expect(jettyGroups().some((g) => g.albedo === PALETTE.deck)).toBe(true);
  });

  it('the field carries the kind it is given, LUSH by default', () => {
    expect(bankField().kinds).toEqual([LUSH]);
    expect(bankField(seasonGrass('winter')).kinds).toEqual([seasonGrass('winter')]);
  });
});

describe('the sky of a season', () => {
  it('summer is TIMES unchanged, deep-equal', () => {
    expect(timesFor('summer')).toEqual(TIMES);
  });

  it('is memoised, a season being the same list each time', () => {
    for (const s of SEASONS) expect(timesFor(s)).toBe(timesFor(s));
  });

  it.each(others)('%s keeps the four names and times, and moves only colours and ambient', (s) => {
    const list = timesFor(s);
    expect(list.map((t) => t.name)).toEqual(TIMES.map((t) => t.name));
    expect(list.map((t) => t.at)).toEqual(TIMES.map((t) => t.at));
    list.forEach((t, i) => {
      expect({ ...t, zenith: 0, horizon: 0, sunColour: 0, ambient: 0 }).toEqual({
        ...TIMES[i],
        zenith: 0,
        horizon: 0,
        sunColour: 0,
        ambient: 0,
      });
    });
    expect(list.some((t, i) => t.zenith.some((v, c) => v !== TIMES[i].zenith[c]))).toBe(true);
  });

  it.each(SEASONS)('%s has sky colours in [0, 1] and a light that is never negative', (s) => {
    for (const t of timesFor(s)) {
      for (const c of [...t.zenith, ...t.horizon]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      for (const c of t.sunColour) expect(c).toBeGreaterThanOrEqual(0);
      expect(t.ambient).toBeGreaterThan(0);
    }
  });

  it('is found by name or by the clock in the season given', () => {
    expect(timeNamed('dawn', timesFor('winter'))).toBe(timesFor('winter')[1]);
    expect(nearestTime(0.5, timesFor('autumn'))).toBe(timesFor('autumn')[2]);
  });

  it('winter reads colder than summer by day and autumn warmer', () => {
    const day = (s: Season) => timesFor(s)[2].horizon;
    expect(day('winter')[2] - day('winter')[0]).toBeGreaterThan(day('summer')[2] - day('summer')[0]);
    expect(day('autumn')[0] - day('autumn')[2]).toBeGreaterThan(day('summer')[0] - day('summer')[2]);
  });
});

describe('the waves of a season', () => {
  it('summer is CLEAR_WAVES itself', () => {
    expect(wavesFor('summer')).toBe(CLEAR_WAVES);
  });

  it.each(SEASONS)('%s scales the amplitudes by its share and keeps the steepness under one', (s) => {
    const waves = wavesFor(s);
    expect(waves.length).toBe(CLEAR_WAVES.length);
    waves.forEach((w, i) => {
      expect(w.amplitude).toBeCloseTo(CLEAR_WAVES[i].amplitude * SEASON_DRESSING[s].waves, 9);
      expect(w.direction).toBe(CLEAR_WAVES[i].direction);
      expect(w.wavelength).toBe(CLEAR_WAVES[i].wavelength);
    });
    expect(waves.reduce((sum, w) => sum + w.steepness, 0)).toBeLessThan(1);
  });

  it('the bobber rides what is drawn: the surface differs by season and matches the waves handed to the look', () => {
    const at = (s: Season) => surfaceOf(wavesFor(s), 100, 1)(3, 4, 7);
    expect(at('autumn')).not.toBe(at('summer'));
    expect(at('winter')).not.toBe(at('summer'));
    for (const s of SEASONS) {
      expect(clear.clear(0, true, timeNamed('day'), s).waves).toBe(wavesFor(s));
      expect(at(s)).toBe(heightAt(wavesFor(s), 3, 4, 7, GRAVITY_MM / 100));
    }
  });

  it("the breeze is the dressing's: summer's is BREEZE's own", () => {
    expect(SEASON_DRESSING.summer.breeze).toBe(BREEZE.strength);
    expect(SEASON_DRESSING.autumn.breeze).toBeGreaterThan(SEASON_DRESSING.winter.breeze);
  });
});

describe('the water of a season', () => {
  it('summer is the water as it was: near, crest and sparkles', () => {
    for (const dirt of [0, 0.5, 1]) {
      const a = clear.clear(dirt, true, timeNamed('day'));
      const b = clear.clear(dirt, true, timeNamed('day'), 'summer');
      expect(b).toEqual(a);
      expect(b.near).toEqual(mix(PALETTE.clearNear, PALETTE.sickNear, dirt));
      expect(b.crest).toEqual(PALETTE.crest);
      expect(b.sparkleBright).toBe(CLEAR.sparkleBright * 1 * (1 - (1 - CLEAR.sickSparkles) * dirt));
    }
  });

  it('the other seasons move the water, and the sick lake still goes green', () => {
    const day = timeNamed('day');
    for (const s of others) {
      const w = clear.clear(0, true, day, s);
      expect(w.sparkleBright).toBeCloseTo(CLEAR.sparkleBright * SEASON_DRESSING[s].water.sparkle, 9);
      const sick = clear.clear(1, true, day, s);
      expect(sick.near).toEqual(PALETTE.sickNear);
    }
    expect(clear.clear(0, true, day, 'winter').near).not.toEqual(clear.clear(0, true, day, 'summer').near);
  });
});

describe('the mist', () => {
  const MM = 100;
  const looks = TIMES.map((t) => t.name);
  const on = (season: Season, time: string) => mistFor(season, time, MM).density > 0;

  it.each(['summer', 'spring'] as const)('%s has none at any look', (s) => {
    for (const t of looks) expect(on(s, t), `${s} ${t}`).toBe(false);
  });

  it('is autumn at dawn only', () => {
    expect(looks.filter((t) => on('autumn', t))).toEqual(['dawn']);
  });

  it('is winter at dawn and night', () => {
    expect(looks.filter((t) => on('winter', t)).sort()).toEqual(['dawn', 'night']);
  });

  it('lies from the water up, low, and is no fog where it is off', () => {
    for (const s of SEASONS)
      for (const t of looks) {
        const fog = mistFor(s, t, MM);
        const off = noFog(MM);
        if (fog.density > 0) {
          expect(fog.base).toBe(WATER_LEVEL);
          expect(fog.height).toBeGreaterThan(0);
          expect(fog.height).toBeLessThan(10);
          expect(fog.steps).toBeGreaterThan(0);
          for (const c of fog.colour) expect(c).toBeGreaterThanOrEqual(0);
        } else expect(fog).toEqual(off);
      }
  });
});
