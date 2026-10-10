/** A fish's glow, drawn on the surface over it: where it falls on the screen, how big and how bright. */
import { EFFECT_STRIDE } from 'artshape-render/game/renderer';
import { Camera } from 'artshape-render/gpu/camera';
import { describe, expect, it } from 'vitest';
import { School } from '../src/fish';
import { FISH_CAPACITY } from '../src/lake';
import { glowQuads } from '../src/glow';

/** A camera on the south bank looking north at the middle of the lake. */
function camera(): Camera {
  const cam = new Camera();
  cam.fov = 40;
  cam.aspect = 1.6;
  cam.position = [0, -60, 20];
  cam.target = [0, 0, 0];
  cam.update();
  return cam;
}

function oneFish(x: number, y: number, depth: number): School {
  const school = new School();
  school.count = 1;
  school.x[0] = x;
  school.y[0] = y;
  school.depth[0] = depth;
  return school;
}

describe("a fish's glow", () => {
  it('falls in the middle of the screen for a fish the camera looks straight at', () => {
    const out = new Float32Array(FISH_CAPACITY * EFFECT_STRIDE);
    expect(glowQuads(out, oneFish(0, 0, 1), camera(), 1)).toBe(1);
    expect(Math.abs(out[0])).toBeLessThan(0.01);
    expect(Math.abs(out[1])).toBeLessThan(0.01);
    expect(out[2], 'a size on the screen').toBeGreaterThan(0);
    expect(out[3], 'a brightness').toBeGreaterThan(0);
  });

  it('is to the right for a fish to the east, and higher for one further north', () => {
    const out = new Float32Array(EFFECT_STRIDE);
    glowQuads(out, oneFish(10, 0, 1), camera(), 1);
    expect(out[0]).toBeGreaterThan(0.05);
    glowQuads(out, oneFish(0, 15, 1), camera(), 1);
    expect(out[1]).toBeGreaterThan(0.05);
  });

  it('is brighter and wider the shallower the fish, and brighter by the time of day', () => {
    const out = new Float32Array(EFFECT_STRIDE);
    glowQuads(out, oneFish(0, 0, 0.5), camera(), 1);
    const shallow = [out[2], out[3]];
    glowQuads(out, oneFish(0, 0, 4), camera(), 1);
    expect(shallow[0]).toBeGreaterThan(out[2]);
    expect(shallow[1]).toBeGreaterThan(out[3]);
    glowQuads(out, oneFish(0, 0, 4), camera(), 2);
    expect(out[3]).toBeGreaterThan(shallow[1] / 10);
  });

  it('is left out for a fish behind the camera', () => {
    const out = new Float32Array(EFFECT_STRIDE);
    expect(glowQuads(out, oneFish(0, -90, 1), camera(), 1)).toBe(0);
  });

  it('writes no more than the pool holds', () => {
    const school = new School();
    school.fill(FISH_CAPACITY, () => 0.5);
    const out = new Float32Array(4 * EFFECT_STRIDE);
    expect(glowQuads(out, school, camera(), 1)).toBeLessThanOrEqual(4);
  });

  it('leaves out the fish it is told to, as the landed one hanging from the rod', () => {
    const out = new Float32Array(EFFECT_STRIDE * 4);
    expect(glowQuads(out, oneFish(0, 0, 1), camera(), 1, 0)).toBe(0);
    expect(glowQuads(out, oneFish(0, 0, 1), camera(), 1, -1)).toBe(1);
  });
});
