/** The camera's framings aboard the boat (`docs/boat.md`, C2): the shore's, the phone's and the boat's put on the seat and turned to the heading. */
import { describe, expect, it } from 'vitest';
import { framingFor } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';

const stand = { x: 12.5, y: -3, tipHeight: 3.6, tipReach: 2.4, heading: 0.7 };

describe('the framings aboard the boat', () => {
  it('put the shore, the phone and the boat views on the seat, behind it looking along the heading, at the boat view polar and radius', () => {
    for (const lake of Object.values(LAKES)) {
      for (const name of ['shore', 'phone', 'boat'] as const) {
        for (const aspect of [1.6, 0.45]) {
          const v = framingFor(lake, name, aspect, stand);
          expect(v.x, `${lake.id} ${name} x`).toBe(stand.x);
          expect(v.y, `${lake.id} ${name} y`).toBe(stand.y);
          expect(v.azimuth, `${lake.id} ${name} azimuth`).toBeCloseTo(stand.heading + Math.PI, 12);
          expect(v.polar).toBe(lake.views.boat.polar);
          expect(v.radius).toBe(lake.views.boat.radius);
        }
      }
    }
  });

  it('leave the overhead and the cabin views as they were, aboard', () => {
    expect(framingFor(HOME, 'overhead', 1.6, stand)).toBe(HOME.views.overhead);
    expect(framingFor(HOME, 'cabin', 1.6, stand)).toBe(HOME.views.cabin);
    expect(framingFor(HOME, 'cabin', 0.5, stand)).toBe(HOME.views.cabinTall);
  });

  it('are the shore framings, to the object, with no stand', () => {
    expect(framingFor(HOME, 'shore', 1.6)).toBe(HOME.views.shore);
    expect(framingFor(HOME, 'shore', 0.5)).toBe(HOME.views.phone);
    expect(framingFor(HOME, 'boat', 1.6)).toBe(HOME.views.boat);
  });

  it('keep the shore framing for a stand with no heading, which is the shore angler', () => {
    const shore = { x: 1, y: 2, tipHeight: 1, tipReach: 1 };
    expect(framingFor(HOME, 'shore', 1.6, shore)).toBe(HOME.views.shore);
  });

  it('write nothing into the lake views', () => {
    const before = JSON.stringify(HOME.views);
    framingFor(HOME, 'phone', 0.5, stand);
    expect(JSON.stringify(HOME.views)).toBe(before);
  });
});
