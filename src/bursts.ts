/**
 * The bursts of particles the lake throws up, for the renderer to emit: a splash's droplets, jumping up from where
 * something landed and falling back into the water, pale blue when the lake is clean and pale green when it is sick.
 */
import type { Emit } from 'artshape-render/game/particles';
import { PALETTE, mix } from './palette';

/** A pebble's splash: how many droplets, how fast up and how far out they go, how long they last and how big they are. */
export const SPLASH_BURST = { count: 100, up: 26, spread: 5.5, life: 0.9, size: 0.22 } as const;

/** The droplets of a splash of `size` at (x, y), at a contamination from clear (0) to sick (1). */
export function splashBurst(x: number, y: number, size: number, contamination: number): Emit {
  const k = Math.min(1, Math.max(0, contamination));
  return {
    position: [x, y, 0.05],
    velocity: [0, 0, SPLASH_BURST.up * Math.sqrt(size)],
    spread: SPLASH_BURST.spread * Math.sqrt(size),
    count: Math.round(SPLASH_BURST.count * size),
    life: SPLASH_BURST.life,
    lifeSpread: 0.3,
    size: SPLASH_BURST.size * Math.sqrt(size),
    growth: 0.1,
    colour: mix(PALETTE.clearSplash, PALETTE.sickSplash, k),
    alpha: 0.85,
    gravity: 1,
    // a droplet falling back through the surface is gone
    floor: -0.05,
  };
}
