/**
 * The wall calendar's marks as they are drawn: one square of ink for each of the fifty-six, in two groups that move with
 * the day. `gone` has a slot for every square, and the first `gone` of them are shown; `today` has one slot, put on
 * today's square. A slot not shown is scaled to nothing where it would be, so it is never seen and every vertex stays
 * inside the room, and the matrices are sized once and written into, so a day's change makes nothing. The groups are
 * handed over only when the day changes, never in a frame, as `TreasureDraw`'s are when a find is made.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { built, face } from 'artshape-render/mesh/lowpoly';
import { calendarMarks } from './calendar';
import { calendarGeometry } from './cabinroom';
import { CALENDAR } from './lake';
import type { Lake } from './lakes/lake';
import { place } from './matrix';
import type { Colour } from './palette';

/** A mark: a unit square standing in the wall's plane (local y along the wall, z up), its normal along local +x. */
function unitSquare() {
  return built((b) => face(b, [0, -0.5, -0.5], [0, 0.5, -0.5], [0, 0.5, 0.5], [0, -0.5, 0.5]));
}

export class CalendarDraw {
  private readonly geometry: ReturnType<typeof calendarGeometry>;
  private readonly mesh = unitSquare();
  private readonly gone = new Float32Array(CALENDAR.days * 16);
  private readonly today = new Float32Array(16);

  /** The wall it marks is the room's in `lake`, which must have a cabin. */
  constructor(lake: Lake) {
    this.geometry = calendarGeometry(lake);
  }

  /** The two mark groups for that day, written into matrices that are the same each time. */
  groups(day: number, colours: { gone: Colour; today: Colour }): GameGroup[] {
    const { gone, today } = calendarMarks(day);
    const { size, spot, yaw } = this.geometry;
    for (let i = 0; i < CALENDAR.days; i++) {
      const [x, y, z] = spot(i);
      place(this.gone, i, x, y, z, yaw, i < gone ? size : 0);
    }
    const [x, y, z] = spot(today);
    place(this.today, 0, x, y, z, yaw, size);
    return [
      { mesh: this.mesh, matrices: this.gone, count: CALENDAR.days, albedo: colours.gone, roughness: 1 },
      { mesh: this.mesh, matrices: this.today, count: 1, albedo: colours.today, roughness: 0.8 },
    ];
  }

  /** What the matrices show as they stand: the squares gone and today's, read back from the scales. */
  shown(): { gone: number; today: number } {
    let gone = 0;
    for (let i = 0; i < CALENDAR.days; i++) if (this.gone[i * 16] !== 0 || this.gone[i * 16 + 1] !== 0) gone++;
    const [x, y, z] = [this.today[12], this.today[13], this.today[14]];
    let today = -1;
    for (let i = 0; i < CALENDAR.days; i++) {
      const s = this.geometry.spot(i);
      if (Math.fround(s[0]) === x && Math.fround(s[1]) === y && Math.fround(s[2]) === z) today = i;
    }
    return { gone, today };
  }
}
