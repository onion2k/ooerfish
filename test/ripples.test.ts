/** A splash's picture: its rings over their life, the pieces they are drawn with, and its droplets. */
import { describe, expect, it } from 'vitest';
import { splashBurst } from '../src/bursts';
import { SPLASH_CAPACITY, SPLASH_LASTS, inside, shoreRadius } from '../src/lake';
import { RINGS, ringAt } from '../src/ripples';
import { PIECES, RippleDraw } from '../src/ripplesdraw';
import { Splashes } from '../src/splash';

describe("a splash's rings", () => {
  it('are a few, each starting a little after the one before', () => {
    expect(RINGS.count).toBeGreaterThanOrEqual(2);
    expect(RINGS.count).toBeLessThanOrEqual(3);
    for (let k = 1; k < RINGS.count; k++) {
      expect(ringAt(k * RINGS.gap - 0.01, k), `ring ${k} before its start`).toBe(null);
      expect(ringAt(k * RINGS.gap + 0.01, k), `ring ${k} after its start`).not.toBe(null);
    }
  });

  it('grow outward and thin as they go, and are gone by the end of the splash', () => {
    for (let k = 0; k < RINGS.count; k++) {
      let was = { radius: 0, width: Infinity };
      for (let age = k * RINGS.gap; age < SPLASH_LASTS; age += 0.02) {
        const ring = ringAt(age, k);
        if (!ring) break;
        expect(ring.radius, `ring ${k} at ${age.toFixed(2)}`).toBeGreaterThan(was.radius);
        expect(ring.width).toBeLessThan(was.width);
        expect(ring.width).toBeGreaterThan(0);
        was = ring;
      }
      expect(ringAt(SPLASH_LASTS, k), `ring ${k} at the end`).toBe(null);
      expect(ringAt(-0.1, k), `ring ${k} before the splash`).toBe(null);
    }
  });

  it('are bigger for a bigger splash', () => {
    const small = ringAt(0.5, 0, 1)!,
      big = ringAt(0.5, 0, 2)!;
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(big.width).toBeGreaterThan(small.width);
  });
});

describe('the pieces the rings are drawn with', () => {
  it('are one group, sized once for every ring of every splash the pool holds', () => {
    const draw = new RippleDraw();
    const g = draw.group();
    expect(g.matrices.length).toBe(SPLASH_CAPACITY * RINGS.count * PIECES * 16);
    expect(g.count).toBe(0);
  });

  it('are as many as the live rings have, on the water and just above it, and none once the splash is over', () => {
    const splashes = new Splashes();
    splashes.add(0, 0, 0, 1);
    const draw = new RippleDraw();
    // half a second in: every ring that has started is wholly on the water, at the middle of the lake
    const live = Array.from({ length: RINGS.count }, (_, k) => ringAt(0.5, k)).filter(Boolean).length;
    expect(draw.write(splashes, 0.5)).toBe(live * PIECES);
    for (let i = 0; i < live * PIECES; i++) {
      const m = draw.matrices.subarray(i * 16, i * 16 + 16);
      expect(inside(m[12], m[13]), `piece ${i}`).toBe(true);
      expect(m[14], 'just above the water').toBeGreaterThan(0);
      expect(m[14]).toBeLessThan(0.1);
    }
    expect(draw.write(splashes, SPLASH_LASTS + 0.1), 'none once it is over').toBe(0);
  });

  it('ride the swells: each piece as far above the water as it is drawn there, where the water stands', () => {
    const splashes = new Splashes();
    splashes.add(0, 0, 0, 1);
    const flat = new RippleDraw(),
      swelling = new RippleDraw();
    swelling.surface = (x, y, t) => 0.2 * Math.sin(x + 2 * y + t);
    const n = flat.write(splashes, 0.5);
    expect(swelling.write(splashes, 0.5)).toBe(n);
    for (let i = 0; i < n; i++) {
      const [x, y] = [swelling.matrices[i * 16 + 12], swelling.matrices[i * 16 + 13]];
      expect(swelling.matrices[i * 16 + 14] - flat.matrices[i * 16 + 14], `piece ${i}`).toBeCloseTo(
        0.2 * Math.sin(x + 2 * y + 0.5),
        5,
      );
    }
  });

  it('are cut at the shore: a splash at the edge draws only the pieces over the water', () => {
    const splashes = new Splashes();
    const north = shoreRadius(Math.PI / 2);
    splashes.add(0, north - 1, 0, 1);
    const draw = new RippleDraw();
    const n = draw.write(splashes, 1.2);
    expect(n).toBeGreaterThan(0);
    const live = Array.from({ length: RINGS.count }, (_, k) => ringAt(1.2, k)).filter(Boolean).length;
    expect(n, 'fewer than every piece of every live ring').toBeLessThan(live * PIECES);
    for (let i = 0; i < n; i++) {
      const m = draw.matrices.subarray(i * 16, i * 16 + 16);
      expect(inside(m[12], m[13]), `piece ${i} on the water`).toBe(true);
    }
  });
});

describe("a splash's droplets", () => {
  it('jump up from where it landed, more for a bigger splash, in the contamination’s colour', () => {
    const clean = splashBurst(3, -2, 1, 0),
      sick = splashBurst(3, -2, 1, 1),
      big = splashBurst(3, -2, 2, 0);
    expect(clean.position.slice(0, 2)).toEqual([3, -2]);
    expect(clean.velocity[2]).toBeGreaterThan(0);
    expect(clean.gravity).toBeGreaterThan(0);
    expect(clean.count).toBeGreaterThan(0);
    expect(big.count).toBeGreaterThan(clean.count);
    expect(clean.colour[2], 'clean, blue').toBeGreaterThan(clean.colour[0]);
    expect(sick.colour[1], 'sick, green').toBeGreaterThan(sick.colour[2]);
    expect(clean.floor!, 'they die as they fall back into the water').toBeLessThanOrEqual(0);
  });
});
