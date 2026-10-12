/**
 * The waterfalls as they are drawn: a strip of rippling water running down the wall from each notch in the crest to
 * just under the lake's surface, tilted out from the face so the rock does not cover it, with foam at its foot, and
 * the mist thrown up there on a count of the game's frames. A strip buried in the wall, flowing up, or stopping short
 * of the water would be drawn and no other test would say.
 */
import { describe, expect, it } from 'vitest';
import { FLOW_RIPPLE } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { CLIFF, NOTCHES, WATER_PACE, ground, inside } from '../src/lake';
import { PALETTE } from '../src/palette';
import { FALLS, fallFrames, fallGroups, fallMists, mistDue } from '../src/falls';
import { MIST } from '../src/bursts';

describe('the falls', () => {
  it('are one for each notch in the crest, at its angle and as wide as it', () => {
    expect(FALLS).toHaveLength(NOTCHES.length);
    FALLS.forEach((f, i) => {
      expect(f.angle).toBe(CLIFF.notches[i].angle);
      expect(f.width).toBe(CLIFF.notches[i].width);
    });
  });
});

describe('a fall’s strip', () => {
  const frames = fallFrames();
  it('starts at the notch’s lip and ends under the water, one strip a fall', () => {
    expect(frames).toHaveLength(FALLS.length);
    frames.forEach((f, i) => {
      const n = NOTCHES[i];
      // the top is the notch’s lip, on its line, as high as the ground there
      expect(
        Math.abs((f.top[0] - n.x) * n.along[0] + (f.top[1] - n.y) * n.along[1]),
        'on the notch’s line',
      ).toBeLessThan(0.05);
      expect(f.top[2]).toBeCloseTo(ground(f.top[0], f.top[1]), 0);
      expect(f.top[2]).toBeGreaterThan(CLIFF.height * CLIFF.dip - 1);
      // the bottom is a little under the surface, over the water or the ledge at its edge
      expect(f.bottom[2]).toBeLessThan(0);
      expect(f.bottom[2]).toBeGreaterThan(-1);
      expect(f.length).toBeCloseTo(
        Math.hypot(f.top[0] - f.bottom[0], f.top[1] - f.bottom[1], f.top[2] - f.bottom[2]),
        6,
      );
    });
  });

  it('runs its own x down the wall, its y along the cliff and its z out toward the lake', () => {
    for (const [i, f] of frames.entries()) {
      const n = NOTCHES[i];
      const m = f.matrix;
      const col = (c: number) => [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]];
      for (const c of [0, 1, 2]) expect(Math.hypot(...col(c)), `column ${c} is unit`).toBeCloseTo(1, 5);
      expect(col(0)[2], 'x runs down').toBeLessThan(-0.5);
      expect(col(0)[0] * n.inward[0] + col(0)[1] * n.inward[1], 'and toward the lake').toBeGreaterThan(0);
      expect(col(1)[0] * n.along[0] + col(1)[1] * n.along[1]).toBeCloseTo(1, 5);
      expect(col(2)[0] * n.inward[0] + col(2)[1] * n.inward[1], 'z out from the face').toBeGreaterThan(0);
      // right-handed, so the strip is not turned inside out
      const [x, y, z] = [col(0), col(1), col(2)];
      const cross = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
      expect(cross[0] * z[0] + cross[1] * z[1] + cross[2] * z[2]).toBeCloseTo(1, 5);
    }
  });

  it('stands clear of the wall all the way down, never buried in it', () => {
    for (const f of frames)
      for (let s = 0; s <= 40; s++) {
        const u = s / 40;
        const p = [0, 1, 2].map((a) => f.top[a] + (f.bottom[a] - f.top[a]) * u);
        // under the surface it is in the water, and the bed there is a hand down at the most
        if (p[2] >= 0) expect(p[2], `${u} of the way down`).toBeGreaterThanOrEqual(ground(p[0], p[1]) - 0.02);
      }
  });

  it('lands in the water or at its edge, not on the far bank', () => {
    for (const f of frames) expect(inside(f.foot[0], f.foot[1], 0), 'the foot is on the water').toBe(true);
  });
});

describe('the falls’ groups', () => {
  const groups = fallGroups();
  const strips = groups.filter((g) => g.patterns);

  it('are a rippling strip a fall, flowing near white in the fall’s pale water', () => {
    expect(strips).toHaveLength(FALLS.length);
    for (const g of strips) {
      expect(g.matrices.length).toBe(16);
      expect(g.patterns![0]).toBe(FLOW_RIPPLE);
      expect(g.patterns!.length).toBe(PATTERN_STRIDE);
      for (const c of [4, 5, 6]) expect(g.patterns![c], 'second colour').toBeGreaterThan(0.85);
      expect(g.albedo).toEqual(PALETTE.fallWater);
    }
  });

  it('flow at the speed they should seem to fall, made up for the water’s slow pace', () => {
    strips.forEach((g, i) => {
      expect(FALLS[i].speed, 'it seems to fall fast').toBeGreaterThan(4);
      expect(g.patterns![2] * WATER_PACE).toBeCloseTo(FALLS[i].speed, 4);
      expect(g.patterns![2], 'and the renderer’s clock is slower than the game’s').toBeGreaterThan(FALLS[i].speed);
    });
  });

  it('have foam at each foot, a white disc just over the surface', () => {
    const foam = groups.filter((g) => !g.patterns);
    expect(foam).toHaveLength(1);
    expect(foam[0].matrices.length / 16).toBe(FALLS.length);
    expect(foam[0].albedo).toEqual(PALETTE.foam);
    for (let i = 0; i < FALLS.length; i++) {
      const z = foam[0].matrices[i * 16 + 14];
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(0.3);
    }
  });
});

describe('the mist', () => {
  it('is one Emit a fall, made once, at its foot', () => {
    const mists = fallMists();
    expect(mists).toHaveLength(FALLS.length);
    mists.forEach((m, i) => {
      expect(m.count).toBe(MIST.count);
      expect(m.position[0]).toBeCloseTo(fallFrames()[i].foot[0], 6);
      expect(m.position[1]).toBeCloseTo(fallFrames()[i].foot[1], 6);
    });
  });

  it('is due on every Nth frame of the game’s clock, a fall at a time, the same each time it is asked', () => {
    const every = MIST.every;
    for (let i = 0; i < FALLS.length; i++) {
      const due: number[] = [];
      for (let frame = 1; frame <= 600; frame++) if (mistDue(frame, i)) due.push(frame);
      expect(due).toHaveLength(600 / every);
      for (let d = 1; d < due.length; d++) expect(due[d] - due[d - 1]).toBe(every);
      // asked again, the same
      const again: number[] = [];
      for (let frame = 1; frame <= 600; frame++) if (mistDue(frame, i)) again.push(frame);
      expect(again).toEqual(due);
    }
  });

  it('is not due on the same frame for two falls, so the mist is not thrown in a lump', () => {
    for (let frame = 1; frame <= 600; frame++)
      expect(FALLS.map((_, i) => mistDue(frame, i)).filter(Boolean).length, `frame ${frame}`).toBeLessThanOrEqual(1);
  });
});
