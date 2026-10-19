/**
 * The splashes on a lake: where something landed on the water, when, and how big it was, in a pool sized once at
 * the most a lake may have live at once. One after the last replaces the oldest, so a lake pelted with pebbles keeps
 * the latest and nothing grows. The game records them; the picture draws their rings and droplets from them.
 */
import { SPLASH_CAPACITY } from './lake';

export class Splashes {
  readonly x = new Float64Array(SPLASH_CAPACITY);
  readonly y = new Float64Array(SPLASH_CAPACITY);
  /** The game's time it landed. */
  readonly at = new Float64Array(SPLASH_CAPACITY);
  /** How big it was: one for a pebble. */
  readonly size = new Float64Array(SPLASH_CAPACITY);
  /** How many slots have ever been filled, at the most the pool's size. */
  count = 0;
  /** The slot the next splash goes in: the oldest, once the pool is full. */
  next = 0;

  add(x: number, y: number, at: number, size: number) {
    const i = this.next;
    this.x[i] = x;
    this.y[i] = y;
    this.at[i] = at;
    this.size[i] = size;
    this.next = (i + 1) % SPLASH_CAPACITY;
    this.count = Math.min(SPLASH_CAPACITY, this.count + 1);
  }

  /** Every splash gone, as the night does to a lake; the pool is kept and written into again. */
  clear() {
    this.count = 0;
    this.next = 0;
  }

  /** How long ago slot `i` landed, at time `t`. */
  age(i: number, t: number): number {
    return t - this.at[i];
  }
}
