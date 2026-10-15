/** The ways of drawing the water, as data: each one's groups. There is one, the water seen into. */
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { FLOW_CLEAR } from 'artshape-render/game/flow';
import { describe, expect, it } from 'vitest';
import { WATER_PACE } from '../src/lake';
import { timeNamed } from '../src/look';
import { PALETTE } from '../src/palette';
import { CLEAR, CLEAR_WAVES } from '../src/water/clear';
import { STYLES } from '../src/water/styles';

describe('the ways of drawing the water', () => {
  it('are one, the see-through water, named and labelled', () => {
    expect(STYLES.map((s) => s.name)).toEqual(['clear']);
    for (const s of STYLES) expect(s.label.length).toBeGreaterThan(0);
  });

  it('give one water group, flowing the clear way, at any contamination', () => {
    for (const s of STYLES)
      for (const dirt of [0, 0.5, 1]) {
        const groups = s.groups(dirt);
        expect(groups.length, s.name).toBe(1);
        const [water] = groups;
        expect(water.patterns?.length).toBe(PATTERN_STRIDE);
        expect(water.patterns?.[0], `${s.name}'s flow kind`).toBe(FLOW_CLEAR);
        expect(water.albedo?.every(Number.isFinite)).toBe(true);
        expect(water.mesh.indices.length).toBeGreaterThan(0);
      }
  });

  it('are the same twice for the same contamination, and a different colour for another', () => {
    for (const s of STYLES) {
      expect(s.groups(0.3)[0].albedo).toEqual(s.groups(0.3)[0].albedo);
      expect(s.groups(0.3)[0].albedo).not.toEqual(s.groups(0.7)[0].albedo);
    }
  });

  it('leave the palette nothing that only the opaque waters read', () => {
    for (const key of ['clear', 'sick', 'clearSky', 'sickSky']) expect(key in PALETTE, key).toBe(false);
  });
});

/**
 * The sparkles' cut: filmed from 0.45 to 0.98 over clear-day (docs/crystal.md, part 12b), no cut under one stops a star
 * coming back in its place, so it is kept as it was chosen until the user picks from the films.
 */
const SPARKLE_CUT = 0.45;

describe('the see-through water', () => {
  const clear = STYLES[0];

  it('is seen through: the fish glow under it, so it has no glow of its surface, and it says how clear it is', () => {
    expect(clear.label).toBe('See-through');
    expect('surfaceGlow' in clear).toBe(false);
    expect(typeof clear.clear).toBe('function');
  });

  it('is murkier the sicker the lake, and as clear as was chosen when clean', () => {
    const at = (dirt: number) => clear.clear(dirt, true, timeNamed('day')).clarity!;
    expect(at(0)).toBeCloseTo(CLEAR.clarity, 10);
    let was = at(0);
    for (let k = 1; k <= 10; k++) {
      const now = at(k / 10);
      expect(now, `clarity at ${k / 10}`).toBeLessThan(was);
      was = now;
    }
    expect(at(1)).toBeGreaterThan(0);
    // the sick lake's clarity is its own figure and not a share of the clean one's, so the cured lake can be made
    // clearer without clearing the sick: the 0.15 it has been since 14 October (docs/crystal-2.md, part 4)
    expect(at(1)).toBeCloseTo(CLEAR.sickClarity, 10);
    expect(CLEAR.sickClarity).toBe(0.15);
  });

  it('has caustics when they are asked for, and none when they are not', () => {
    expect(clear.clear(0.5, true, timeNamed('day')).caustics).toBeGreaterThan(0);
    expect(clear.clear(0.5, false, timeNamed('day')).caustics).toBe(0);
  });

  it('sparkles by the time of day, in round stars and not the glitter: in the sun the most, and hardly at all by the moon', () => {
    const at = (t: string) => clear.clear(0, true, timeNamed(t));
    for (const t of ['dawn', 'day', 'dusk', 'night']) expect(at(t).glitter, t).toBe(0);
    const bright = (t: string) => at(t).sparkleBright!;
    expect(bright('day')).toBeGreaterThan(bright('dawn'));
    expect(bright('dusk')).toBeGreaterThan(bright('night'));
    expect(bright('night')).toBeLessThan(bright('day') * 0.25);
    expect(at('day').sparkles).toBeGreaterThan(0);
  });

  it('moves at the pace and finish chosen from the films of 14 October: a gentle pulse and a more broken reflection', () => {
    // part 12's recommended setting (docs/crystal.md), which kept the calm look and gave it some visible crawl
    expect(WATER_PACE).toBe(0.6);
    expect(CLEAR.speed).toBe(0.2);
    expect(CLEAR.scale).toBe(3.5);
    // the 1.5 m swell gave its slot (the renderer draws four at most) to one of a metre from outside the others' spread
    expect(CLEAR_WAVES).toEqual([
      { direction: 1.2, wavelength: 3, amplitude: 0.012, steepness: 0.38 },
      { direction: 2.1, wavelength: 2, amplitude: 0.008, steepness: 0.38 },
      { direction: -0.5, wavelength: 1, amplitude: 0.004, steepness: 0.12 },
      { direction: 1.7, wavelength: 4, amplitude: 0.012, steepness: 0.1 },
    ]);
    // kept, since no cut under one stops a star blinking in its place (see SPARKLE_CUT)
    expect(CLEAR.sparkleCut).toBe(SPARKLE_CUT);
    expect(clear.clear(0, true, timeNamed('day')).sparkleCut).toBe(SPARKLE_CUT);
  });

  it('carries its sparkles along the main swell at half a unit a second, and asks for half as many', () => {
    // part 14 (docs/crystal.md): the user chose the drift at half a unit a second from the package's films, so a glint
    // that comes round again comes round somewhere else; a drifting lattice shows about twice the stars, so half as many
    // are asked for; the way is the main swell's, said once in CLEAR_WAVES
    expect(CLEAR.sparkleDrift).toBe(0.5);
    expect(CLEAR.sparkles).toBe(0.15);
    const main = CLEAR_WAVES[0];
    for (const dirt of [0, 1]) {
      const look = clear.clear(dirt, true, timeNamed('day'));
      expect(look.sparkleDrift![0], `at contamination ${dirt}`).toBeCloseTo(Math.cos(main.direction) * 0.5, 6);
      expect(look.sparkleDrift![1], `at contamination ${dirt}`).toBeCloseTo(Math.sin(main.direction) * 0.5, 6);
      expect(look.sparkles, `at contamination ${dirt}`).toBe(0.15);
    }
  });

  it('holds its detail near and far: a layer whose cell is eight pixels on the screen, added in full', () => {
    // part 11c (docs/crystal.md): chosen from the films of 14 October, where 8 px at 1.0 broke the reflections into
    // bands that drift and re-form and made the far water read as moving water; 4 px was grain and 16 px faint
    expect(CLEAR.detailPixels).toBe(8);
    expect(CLEAR.detailAmount).toBe(1);
    for (const dirt of [0, 1]) {
      const look = clear.clear(dirt, true, timeNamed('day'));
      expect(look.detailPixels, `at contamination ${dirt}`).toBe(8);
      expect(look.detailAmount, `at contamination ${dirt}`).toBe(1);
    }
  });

  it('lays a lane of sunlight on the water, lights its caustics on the sand, and holes its foam, as chosen from round two', () => {
    // docs/crystal-2.md: the sun's lane at 0.6 and a power of 60, the caustic glow at 0.45 (between the 0.3 and 0.6 the
    // sheet gave, settled from the game's own stills) with the cell at twice the default 1.5 units, and the foam's
    // grain at 0.3; the same clean and sick, since the glow follows the caustics' own strength
    expect(CLEAR.sunLane).toBe(0.6);
    expect(CLEAR.sunLaneWidth).toBe(60);
    expect(CLEAR.causticGlow).toBe(0.45);
    expect(CLEAR.causticScale).toBe(3);
    expect(CLEAR.foamGrain).toBe(0.3);
    for (const dirt of [0, 1]) {
      const look = clear.clear(dirt, true, timeNamed('day'));
      expect(look.sunLane, `at contamination ${dirt}`).toBe(0.6);
      expect(look.sunLaneWidth, `at contamination ${dirt}`).toBe(60);
      expect(look.causticGlow, `at contamination ${dirt}`).toBe(0.45);
      expect(look.causticScale, `at contamination ${dirt}`).toBe(3);
      expect(look.foamGrain, `at contamination ${dirt}`).toBe(0.3);
    }
  });

  it('swells no steeper, all added, than one, or the surface folds over itself where the crests meet', () => {
    const sum = CLEAR_WAVES.reduce((s, w) => s + w.steepness, 0);
    expect(sum).toBeLessThan(1);
  });

  it('swells, by the waves it says it has, and hands the same to the renderer', () => {
    expect(clear.waves?.length).toBe(4);
    expect(clear.clear(0.3, true, timeNamed('day')).waves).toBe(clear.waves);
  });

  it('is lighter by the camera, toward a blue when clean and a green when sick, with crests and lines of foam', () => {
    const clean = clear.clear(0, true, timeNamed('day')),
      sick = clear.clear(1, true, timeNamed('day'));
    const [r0, g0, b0] = clean.near!;
    expect(b0).toBeGreaterThan(g0);
    expect(g0).toBeGreaterThan(r0);
    const [r1, g1, b1] = sick.near!;
    expect(g1).toBeGreaterThan(b1);
    expect(g1).toBeGreaterThan(r1);
    expect(clean.crestAmount, 'a calm pond has no lighter crests').toBe(0);
    expect(clean.foamWidth2, 'one thin line of foam, no second').toBe(0);
    expect(clean.foamGap).toBeGreaterThan(0);
  });

  it('draws its foam as a bold line with a crisp edge, round the shore and the boulders only', () => {
    const clean = clear.clear(0, true, timeNamed('day'));
    expect(clean.foamWidth, 'a bold line').toBe(0.3);
    expect(clean.foamSoft, 'its edge crisp, a fiftieth of its width').toBe(0.02);
    expect(clean.foamWidth2, 'one line').toBe(0);
    expect(clean.foamEverywhere, 'things in the water are not ringed').toBeUndefined();
  });

  it('is the calm painted pond: faint soft ripples, a mirror tinted and kept by the camera, a flat saturated blue, and clear enough to see the bed', () => {
    for (const w of CLEAR_WAVES) {
      expect(w.amplitude, 'a swell under two centimetres').toBeLessThan(0.02);
      expect(w.wavelength, 'and under five metres long').toBeLessThan(5);
    }
    expect(CLEAR_WAVES.length).toBe(4);
    const look = clear.clear(0, true, timeNamed('day'));
    expect(look.mirrorTint).toEqual([0.35, 0.62, 0.92]);
    expect(look.mirrorNear, 'the mirror is not kept near the camera').toBe(0);
    // half the mirror it had, so the bright bed is seen through the far water and not the sky (part 4)
    expect(look.mirror).toBe(0.6);
    expect(look.nearDistance).toBe(45);
    // crystal clear when cured: light lasts ten times as far as it did, so the sand is seen through to the middle (part 4)
    expect(look.clarity).toBe(6);
    // the shallows chosen from the sheets of 14 October: a knee of half a clarity, a line half the renderer's width at
    // three times the strength it had, so a crisp net of light on the sand ring and not a wash
    expect(look.clearKnee).toBe(0.4);
    expect(look.causticLine).toBe(0.08);
    expect(look.caustics).toBe(0.36);
    expect(look.crestAmount).toBe(0);
    expect(look.sparkleSize).toBe(9);
    expect(look.sparkles).toBe(0.15);
    expect(look.sparkleBright).toBe(24);
    // the fine waves' slopes lift the body toward a lighter blue, painted and not mirrored
    expect(look.ripple).toEqual(PALETTE.rippleLight);
    expect(PALETTE.rippleLight).toEqual([0.28, 0.52, 0.88]);
    expect(look.rippleAmount).toBe(0.3);
    expect(look.rippleCut).toBe(0.4);
    // the flow is fine, slow and gently tilted: 3.5 cells, a fifth of a unit a second
    const [, scale, speed, steepness] = Array.from(clear.groups(0)[0].patterns!.subarray(0, 4));
    expect([scale, speed, steepness].map((v) => Math.round(v * 100) / 100)).toEqual([3.5, 0.2, 0.3]);
    // the water is a bright turquoise when cured (part 4, chosen from the sheet of 15 October over the saturated blue of
    // part 2, which darkened it): blue over green over red, near and deep, and green near the blue
    for (const c of [PALETTE.clearShallow, PALETTE.clearNear, PALETTE.clearDeep]) {
      expect(c[2]).toBeGreaterThan(c[1]);
      expect(c[1]).toBeGreaterThan(c[0]);
      expect(c[1] / c[2], 'turquoise, not navy').toBeGreaterThan(0.6);
    }
    expect(PALETTE.clearDeep).toEqual([0.04, 0.42, 0.62]);
    expect(PALETTE.clearShallow).toEqual([0.1, 0.62, 0.72]);
    // the water by the camera is the shallows' own colour, so the water at the feet is not darkened
    expect(PALETTE.clearNear).toEqual(PALETTE.clearShallow);
    // the slate is still the bed's deepest colour, which a bed whose sand reaches past the deepest never shows
    expect(PALETTE.bed).toEqual([0.035, 0.06, 0.11]);
  });

  it('is deep green when sick and deep blue-teal when clean', () => {
    const deep = (dirt: number) => Array.from(clear.groups(dirt)[0].patterns!.subarray(4, 7));
    const [r0, g0, b0] = deep(0);
    expect(b0, 'clean, blue the most').toBeGreaterThan(g0);
    expect(b0).toBeGreaterThan(r0);
    const [r1, g1, b1] = deep(1);
    expect(g1, 'sick, green the most').toBeGreaterThan(b1);
    expect(g1).toBeGreaterThan(r1);
  });
});
