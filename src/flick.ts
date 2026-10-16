/**
 * A flick as a run of acceleration samples gives it: the phone's pull without gravity, over `min`, up and back down,
 * reported once with its peak as it falls away, then silence for `rest`. It holds no history, only the peak so far, so
 * it costs nothing to run at the sensor's full rate; and without the rest a single flick's ringing would cast twice.
 * Pure, and handed its figures, so the phone page takes them from the content and a test from itself.
 */

export interface FlickOptions {
  /** The magnitude, in m/s², a sample must pass for a flick to have started. */
  min: number;
  /** How long, in milliseconds, after a flick nothing more is reported. */
  rest: number;
}

export class Flicks {
  private peak = 0;
  private active = false;
  private quietUntil = -Infinity;

  constructor(private readonly options: FlickOptions) {}

  /** One sample at `t` milliseconds; a flick that has just ended, with its peak, or null. A sample that is not a number is ignored. */
  sample(t: number, x: number, y: number, z: number): { peak: number } | null {
    const m = Math.hypot(x, y, z);
    if (!Number.isFinite(t) || !Number.isFinite(m)) return null;
    if (t < this.quietUntil) return null;
    if (m > this.options.min) {
      this.active = true;
      if (m > this.peak) this.peak = m;
      return null;
    }
    if (!this.active) return null;
    const peak = this.peak;
    this.active = false;
    this.peak = 0;
    this.quietUntil = t + this.options.rest;
    return { peak };
  }
}
