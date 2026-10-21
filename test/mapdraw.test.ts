/** The map on the cabin's wall: the pin that moves with the lake the save names, and the tap that meets the paper. */
import { Camera } from 'artshape-render/gpu/camera';
import { invertInto } from 'artshape-render/geom/transform';
import { describe, expect, it } from 'vitest';
import { placeAt } from '../src/cabin';
import { mapGeometry } from '../src/cabinroom';
import { MapDraw, mapHit } from '../src/mapdraw';
import { HOME, LAKES } from '../src/lakes';
import { ROOM_COLOURS } from '../src/palette';

const lakes = Object.values(LAKES);
const cabin = HOME.cabin!;

describe('the pin', () => {
  it('is one group of one block, in the pin’s colour', () => {
    const draw = new MapDraw(HOME, lakes);
    const groups = draw.groups('duckpond', ROOM_COLOURS.mapPin);
    expect(groups.length).toBe(1);
    expect(groups[0].albedo).toBe(ROOM_COLOURS.mapPin);
    expect(groups[0].count).toBe(1);
    expect(groups[0].mesh.indices.length / 3).toBeLessThan(40);
  });

  it('is on the pond for the pond and on the Reservoir for the Reservoir, and not in the same place', () => {
    const draw = new MapDraw(HOME, lakes);
    const at = (id: string) => Array.from(draw.groups(id, ROOM_COLOURS.mapPin)[0].matrices.slice(12, 15));
    const pond = at('duckpond'),
      reservoir = at('reservoir');
    expect(pond).not.toEqual(reservoir);
    expect(at('duckpond')).toEqual(pond);
    expect(draw.pin()).toBe('duckpond');
    expect(reservoir.map((v) => Math.fround(v))).toEqual(reservoir);
  });

  it('puts the pin over the middle of the lake’s blob, in front of the paper', () => {
    const draw = new MapDraw(HOME, lakes);
    const map = mapGeometry(HOME, lakes);
    for (const blob of map.blobs) {
      const m = draw.groups(blob.id, ROOM_COLOURS.mapPin)[0].matrices;
      const [x, y, z] = map.spot(blob.centre[0], blob.centre[1], 0.05);
      expect(m[12]).toBeCloseTo(x, 4);
      expect(m[13]).toBeCloseTo(y, 4);
      expect(m[14]).toBeCloseTo(z, 4);
    }
  });

  it('writes the same array each time, so a handover makes nothing', () => {
    const draw = new MapDraw(HOME, lakes);
    const first = draw.groups('duckpond', ROOM_COLOURS.mapPin)[0].matrices;
    expect(draw.groups('reservoir', ROOM_COLOURS.mapPin)[0].matrices).toBe(first);
  });

  it('is not shown for a lake that is not on the map, rather than somewhere wrong', () => {
    const draw = new MapDraw(HOME, lakes);
    const m = draw.groups('nowhere', ROOM_COLOURS.mapPin)[0].matrices;
    expect(m[0]).toBe(0);
    expect(draw.pin()).toBe('nowhere');
  });
});

/** The camera as the cabin view puts it: at the eye, looking out ten units, with the view's lens. */
function cabinCamera(aspect = 1.6) {
  const v = HOME.views.cabin;
  const cam = new Camera();
  cam.fov = v.fov ?? 40;
  cam.aspect = aspect;
  cam.near = 0.1;
  cam.far = 1500;
  const eye = placeAt(cabin.at)([cabin.wakingEye.across, cabin.wakingEye.along, 0]);
  cam.position = [eye[0], eye[1], cabin.floor + cabin.wakingEye.high];
  cam.target = [v.x, v.y, v.z ?? 0];
  cam.update();
  const inverse = new Float32Array(16);
  invertInto(inverse, cam.viewProjection);
  return { cam, inverse };
}

function ndc(cam: Camera, p: readonly number[]): [number, number] {
  const m = cam.viewProjection;
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w];
}

describe('a tap on the map', () => {
  const map = mapGeometry(HOME, lakes);
  const { cam, inverse } = cabinCamera();

  it('meets the paper at its middle, which is on the screen from the pillow', () => {
    const [x, y] = ndc(cam, map.spot(0, map.high / 2, 0.04));
    expect(Math.abs(x)).toBeLessThan(1);
    expect(Math.abs(y)).toBeLessThan(1);
    expect(mapHit(x, y, inverse, HOME)).toBe(true);
  });

  it('meets the paper near each of its corners, and not just outside them', () => {
    const near = 0.01;
    for (const [su, sv] of [
      [-map.wide / 2 + near, near],
      [map.wide / 2 - near, near],
      [-map.wide / 2 + near, map.high - near],
      [map.wide / 2 - near, map.high - near],
    ]) {
      const [x, y] = ndc(cam, map.spot(su, sv, 0.04));
      expect(mapHit(x, y, inverse, HOME), `${su}, ${sv} in`).toBe(true);
    }
    for (const [su, sv] of [
      [-map.wide / 2 - 0.03, map.high / 2],
      [map.wide / 2 + 0.03, map.high / 2],
      [0, -0.03],
      [0, map.high + 0.03],
    ]) {
      const [x, y] = ndc(cam, map.spot(su, sv, 0.04));
      expect(mapHit(x, y, inverse, HOME), `${su}, ${sv} out`).toBe(false);
    }
  });

  it('misses elsewhere on the wall: the door, the window, the shelves and the coat', () => {
    const { door, window: win, furniture } = cabin.room;
    const eye = (along: number, z: number) => {
      const p = placeAt(cabin.at)([cabin.spec.body.across / 2 - cabin.room.inset, along, 0]);
      return [p[0], p[1], cabin.floor + z];
    };
    for (const [name, p] of [
      ['door', eye(door.along, 1)],
      ['window', eye(win.along, win.sill + win.high / 2)],
      ['shelf', eye(furniture.shelf.along, furniture.shelf.high + 0.3)],
      ['coat', eye(furniture.coat.along, furniture.coat.peg - 0.3)],
    ] as const) {
      const [x, y] = ndc(cam, p);
      expect(mapHit(x, y, inverse, HOME), name).toBe(false);
    }
  });

  it('misses when the ray runs away from the wall, or never comes to it', () => {
    // straight at the back wall behind the camera's view, and at the ceiling, and off the screen's edge
    expect(mapHit(0.99, 0.99, inverse, HOME)).toBe(false);
    expect(mapHit(-0.99, -0.99, inverse, HOME)).toBe(false);
  });

  it('is never a hit for a lake with no cabin', () => {
    expect(mapHit(0, 0, inverse, LAKES.reservoir)).toBe(false);
  });
});
