/**
 * The falling things of a season (`docs/seasons.md`, part 4), as the renderer's particles are asked for them: blossom,
 * leaves or snow dropping from a spiral of emitters over the lake and its near banks, each dying where it meets the water,
 * carried sideways by the season's wind. Pure sums on content; the page makes the list once a season and hands the
 * same Emits to the renderer on their cadence, so nothing is made in a frame. Summer has none. The GPU draws each
 * particle's chance from its own hash, so none of this is the game's state.
 */
import type { Emit } from 'artshape-render/game/particles';
import { MIST } from './bursts';
import { FALLING, SEASON_DRESSING, type Season } from './lake';
import { FALLS } from './falls';

/** The lake the emitters stand over: its mean shore radius, and the water's level, which a flake dies at. */
export interface FallingWorld {
  radius: number;
  level: number;
}

/** The golden angle, which spreads a spiral's points evenly round and never into lines. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The Emits of a season, one for each emitter of the spiral, made once; an empty list where nothing falls. */
export function fallingEmits(season: Season, world: FallingWorld): Emit[] {
  const f = SEASON_DRESSING[season].falling;
  if (!f) return [];
  const reach = world.radius * FALLING.radius;
  return Array.from({ length: FALLING.emitters }, (_, i) => {
    // a share of the area each, so the cover is even
    const r = reach * Math.sqrt((i + 0.5) / FALLING.emitters);
    const a = i * GOLDEN;
    return {
      position: [r * Math.cos(a), r * Math.sin(a), world.level + FALLING.height],
      velocity: [0, 0, 0],
      spread: FALLING.spread,
      count: f.count,
      life: f.life,
      lifeSpread: f.lifeSpread,
      size: f.size,
      growth: f.growth,
      colour: f.colour,
      fade: f.fade,
      alpha: 1,
      gravity: f.gravity,
      // a flake reaching the water is gone
      floor: world.level,
    } satisfies Emit;
  });
}

/**
 * Whether emitter `i` drops on the game's frame number `frame`: once in `every` frames, each a frame after the last, so
 * the ring does not drop in a lump. Counted from the game's own frame, so a paused lake drops none.
 */
export function fallingDue(frame: number, every: number, i = 0): boolean {
  return (frame + i) % every === 0;
}

/** How many of a season's particles are alive at once, at its steady state: emitters × count × life ÷ the seconds between drops. */
export function steadyLive(season: Season): number {
  const f = SEASON_DRESSING[season].falling;
  return f ? FALLING.emitters * f.count * f.life * (60 / f.every) : 0;
}

/**
 * How many particles the falling things and the falls' mist emit in the longest life a season's drops can have. The ring
 * holds this many, so no drop is overwritten alive at the game's steady rate; a burst of splashes on top may shorten a
 * drop's last second, which is accepted (`PARTICLE_POOL`).
 */
export function particleWindow(season: Season): number {
  const f = SEASON_DRESSING[season].falling;
  const window = f ? f.life * (1 + f.lifeSpread) : 0;
  const falling = f ? FALLING.emitters * f.count * window * (60 / f.every) : 0;
  const mist = FALLS.length * MIST.count * (60 / MIST.every) * window;
  return falling + mist;
}
