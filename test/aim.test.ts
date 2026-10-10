/** A drag on the screen, as a cast: which way round the compass, and how hard. */
import { describe, expect, it } from 'vitest';
import { AIM_DRAG, aimFrom } from '../src/aim';

const NORTH = Math.PI / 2;

describe('a drag back, as a cast', () => {
  it('casts the way opposite the drag, as the camera sees it', () => {
    // the camera looking north: a drag straight down casts straight north, a drag down and to the left casts north-east
    expect(aimFrom(0, 200, 800, NORTH)!.angle).toBeCloseTo(NORTH, 10);
    const right = aimFrom(-150, 150, 800, NORTH)!.angle;
    expect(right).toBeCloseTo(NORTH - Math.PI / 4, 10);
    // and the camera looking east: a drag down casts east
    expect(aimFrom(0, 200, 800, 0)!.angle).toBeCloseTo(0, 10);
  });

  it('is as hard as the drag is long, against a share of the screen, full at the most', () => {
    const short = 800;
    expect(aimFrom(0, AIM_DRAG.full * short * 0.5, short, NORTH)!.power).toBeCloseTo(0.5, 10);
    expect(aimFrom(0, AIM_DRAG.full * short * 3, short, NORTH)!.power).toBe(1);
  });

  it('is the same cast on a phone and a desk, for the same share of the screen', () => {
    const phone = aimFrom(-40, 90, 400, NORTH)!,
      desk = aimFrom(-80, 180, 800, NORTH)!;
    expect(phone.angle).toBeCloseTo(desk.angle, 10);
    expect(phone.power).toBeCloseTo(desk.power, 10);
  });

  it('is nothing at all inside the dead zone, which is how a drag is taken back', () => {
    expect(aimFrom(0, AIM_DRAG.dead * 800 * 0.9, 800, NORTH)).toBe(null);
    expect(aimFrom(0, 0, 800, NORTH)).toBe(null);
    expect(aimFrom(0, AIM_DRAG.dead * 800 * 1.1, 800, NORTH)).not.toBe(null);
  });
});
