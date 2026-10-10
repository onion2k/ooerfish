/** A point on the screen, carried out into the world to where it meets the water. */
import { Camera } from 'artshape-render/gpu/camera';
import { invertInto } from 'artshape-render/geom/transform';
import { describe, expect, it } from 'vitest';
import { waterPoint } from '../src/pick';

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
