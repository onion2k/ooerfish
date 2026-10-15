/**
 * The mist at the foot of a fall: a few small white droplets thrown up and out from where the water lands, again and
 * again. It is pure, the same Emit for the same foot, so the page can make one at boot and hand it to the renderer
 * every time it is due, and nothing is made in a frame; and it is lighter than a splash, so a fall's mist and the
 * splashes of a game together fit the particle pool.
 */
import { describe, expect, it } from 'vitest';
import { MIST, SPLASH_BURST, mist, splashBurst } from '../src/bursts';

describe("a splash's droplets", () => {
  it('are the finer burst chosen with the ripples in the water (docs/splash.md): fewer, lower, smaller and shorter', () => {
    // the burst before them was a hundred, 26 up, 5.5 out, 0.9 s and 0.22 across: a third, 0.6, a half, 0.7 s and 0.55
    expect(SPLASH_BURST).toEqual({ count: 35, up: 15.6, spread: 2.75, life: 0.7, size: 0.12 });
  });
});

describe('the mist at the foot of a fall', () => {
  const m = mist(4, 31, 0, -1);

  it('starts at the foot, a hand above the water, and goes up and out from the cliff', () => {
    expect(m.position.slice(0, 2)).toEqual([4, 31]);
    expect(m.position[2]).toBeGreaterThan(0);
    expect(m.position[2]).toBeLessThan(0.5);
    expect(m.velocity[2], 'up').toBeGreaterThan(0);
    expect(m.velocity[0], 'out along x').toBeCloseTo(0, 9);
    expect(m.velocity[1], 'out along y, the way it is told').toBeLessThan(0);
    expect(mist(0, 0, 1, 0).velocity[0]).toBeGreaterThan(0);
  });

  it('is a few small, short-lived, translucent white droplets that die falling back into the water', () => {
    expect(m.count).toBeGreaterThanOrEqual(3);
    expect(m.count).toBeLessThan(SPLASH_BURST.count);
    // small and short-lived in their own right: the splash's droplets, which they were once held under, are now finer
    // than a mist's (docs/splash.md), and the pool's share is held by the count above and the room test below
    expect(m.size).toBeLessThan(0.5);
    expect(m.life).toBeLessThanOrEqual(1);
    for (const c of m.colour) expect(c).toBeGreaterThan(0.85);
    expect(m.alpha).toBeGreaterThan(0);
    expect(m.alpha).toBeLessThan(1);
    expect(m.gravity!).toBeGreaterThan(0);
    expect(m.floor!).toBeLessThanOrEqual(0);
  });

  it('is thrown every five frames, twelve times a second at the game’s sixty', () => {
    expect(MIST.every).toBe(5);
  });

  it('is the same Emit every time it is asked for, and carries its figures from content', () => {
    expect(mist(4, 31, 0, -1)).toEqual(m);
    expect(m.count).toBe(MIST.count);
    expect(m.life).toBe(MIST.life);
  });

  it('leaves room in the pool: a fall’s mist alive at once and a splash’s droplets do not pass the pool’s size', () => {
    // two falls, each emitting every `every` frames and living `life` seconds
    const live = (every: number) => 2 * m.count * Math.ceil((m.life * 60) / every + 1);
    expect(live(MIST.every) + splashBurst(0, 0, 1, 0).count * 4).toBeLessThan(2048);
  });
});
