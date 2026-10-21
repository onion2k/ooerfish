/** A point on the screen, carried out into the world to where it meets the water. */
import { Camera } from 'artshape-render/gpu/camera';
import { invertInto } from 'artshape-render/geom/transform';
import { describe, expect, it } from 'vitest';
import { cabinHit, waterPoint } from '../src/pick';
import { HOME, LAKES } from '../src/lakes';

function camera(position: [number, number, number], target: [number, number, number]) {
  const cam = new Camera();
  cam.fov = 40;
  cam.aspect = 1.6;
  cam.near = 1;
  cam.far = 1500;
  cam.position = position;
  cam.target = target;
  cam.update();
  const inverse = new Float32Array(16);
  invertInto(inverse, cam.viewProjection);
  return { cam, inverse };
}

/** Where a world point falls on the screen, in the screen's own units from minus one to one. */
function ndc(cam: Camera, x: number, y: number, z: number): [number, number] {
  const m = cam.viewProjection;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
}

describe('a point on the screen, on the water', () => {
  it('is what the camera looks at, at the middle of the screen', () => {
    const { inverse } = camera([0, -40, 30], [3, 4, 0]);
    const p = waterPoint(inverse, 0, 0)!;
    expect(p[0]).toBeCloseTo(3, 3);
    expect(p[1]).toBeCloseTo(4, 3);
  });

  it('is the very point of the water drawn there, anywhere on the screen', () => {
    const { cam, inverse } = camera([10, -50, 25], [0, 0, 0]);
    for (const [x, y] of [
      [-12, 5],
      [8, -9],
      [20, 14],
    ]) {
      const [sx, sy] = ndc(cam, x, y, 0);
      const p = waterPoint(inverse, sx, sy)!;
      expect(p[0], `${x},${y}`).toBeCloseTo(x, 2);
      expect(p[1]).toBeCloseTo(y, 2);
    }
  });

  it('is nowhere above the horizon, where the screen shows sky and not water', () => {
    const { inverse } = camera([0, -40, 3], [0, 0, 2.5]);
    expect(waterPoint(inverse, 0, 0.95)).toBe(null);
  });
});

describe('a tap on the cabin', () => {
  const cabin = HOME.cabin!;
  const middle = (): [number, number, number] => [cabin.at.x, cabin.at.y, cabin.floor + cabin.spec.body.high / 2];

  it('meets the cabin from the shore view, at its middle', () => {
    // a camera standing off the cabin's lake side, looking at its middle
    const eye: [number, number, number] = [
      cabin.at.x + cabin.at.inward[0] * 30,
      cabin.at.y + cabin.at.inward[1] * 30,
      cabin.floor + 6,
    ];
    const seen = camera(eye, middle());
    const [x, y] = ndc(seen.cam, ...middle());
    expect(cabinHit(x, y, seen.inverse, HOME)).toBe(true);
  });

  it('misses the water and the sky, and the bank well to either side', () => {
    const eye: [number, number, number] = [
      cabin.at.x + cabin.at.inward[0] * 30,
      cabin.at.y + cabin.at.inward[1] * 30,
      cabin.floor + 6,
    ];
    const seen = camera(eye, middle());
    // a point on the water in front of the camera, and the top of the screen (sky)
    const water: [number, number, number] = [
      cabin.at.x + cabin.at.inward[0] * 50,
      cabin.at.y + cabin.at.inward[1] * 50,
      0,
    ];
    const [wx, wy] = ndc(seen.cam, ...water);
    expect(cabinHit(wx, wy, seen.inverse, HOME)).toBe(false);
    expect(cabinHit(0, 0.98, seen.inverse, HOME)).toBe(false);
    const aside: [number, number, number] = [
      cabin.at.x + cabin.at.along[0] * 40,
      cabin.at.y + cabin.at.along[1] * 40,
      cabin.floor + 2,
    ];
    const [ax, ay] = ndc(seen.cam, ...aside);
    expect(cabinHit(ax, ay, seen.inverse, HOME)).toBe(false);
  });

  it('is never a hit at a lake with no cabin', () => {
    const eye: [number, number, number] = [0, -40, 10];
    const seen = camera(eye, [0, 0, 3]);
    expect(cabinHit(0, 0, seen.inverse, LAKES.reservoir)).toBe(false);
  });
});
