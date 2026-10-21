/**
 * The map in the cabin as it is drawn and as it is tapped. The lakes and the dam are static parts of the room
 * (`cabinroom.ts`); the red pin is the one moving part, a block put on the lake the save names, and handed over only
 * when that changes, as `CalendarDraw`'s marks are when the day does: the matrix is sized once and written into, so a
 * journey makes nothing. `mapHit` is the tap: a ray from the screen's point to the paper's rectangle on the wall.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { at, block, built } from 'artshape-render/mesh/lowpoly';
import { MAP, mapGeometry } from './cabinroom';
import type { Lake } from './lakes/lake';
import { place } from './matrix';
import type { Colour } from './palette';
import { rayThrough } from './pick';

/** A unit block standing out of the wall: its own x is the way out into the room, its base on the wall's plane. */
function unitBlock() {
  return built((b) => block(b, at(0, 0, 0), 0, 1, -0.5, 0.5, -0.5, 0.5));
}

export class MapDraw {
  private readonly geometry: ReturnType<typeof mapGeometry>;
  private readonly mesh = unitBlock();
  private readonly pinned = new Float32Array(16);
  private on = '';

  /** The map is the room's in `lake`, which must have a cabin, and shows `lakes`. */
  constructor(lake: Lake, lakes: readonly Lake[]) {
    this.geometry = mapGeometry(lake, lakes);
  }

  /** The pin's group, put on the lake with that id; a lake not on the map has the pin scaled to nothing, not put somewhere wrong. */
  groups(id: string, colour: Colour): GameGroup[] {
    const blob = this.geometry.blobs.find((b) => b.id === id);
    this.on = id;
    const [x, y, z] = blob ? this.geometry.spot(blob.centre[0], blob.centre[1], MAP.pin.depth) : [0, 0, 0];
    place(this.pinned, 0, x, y, z, this.geometry.yaw, blob ? MAP.pin.size : 0);
    return [{ mesh: this.mesh, matrices: this.pinned, count: 1, albedo: colour, roughness: 0.6 }];
  }

  /** The lake the pin was last put on. */
  pin(): string {
    return this.on;
  }

  /** Where the pin's middle is on the screen's wall, read back from the matrix. */
  at(): [number, number, number] {
    return [this.pinned[12], this.pinned[13], this.pinned[14]];
  }

  /** The paper's middle in the world: where a tap on the map is aimed. */
  middle(): [number, number, number] {
    return this.geometry.paper.middle;
  }
}

/**
 * Whether the screen's point (`ndcX`, `ndcY`, from minus one to one, up positive) falls on the map's paper, given the
 * inverse of the camera's view and projection: the ray through the point is carried to the wall's plane and the place
 * it meets it is asked to lie within the paper's rectangle. A lake with no cabin has no map; a ray that runs parallel
 * to the wall or meets it behind the camera meets nothing.
 */
export function mapHit(ndcX: number, ndcY: number, inverse: Float32Array, lake: Lake): boolean {
  if (!lake.cabin) return false;
  const { paper, wide, high } = mapGeometry(lake, [lake]);
  const { near, far } = rayThrough(inverse, ndcX, ndcY);
  const dir = [far[0] - near[0], far[1] - near[1]];
  const out = dir[0] * paper.normal[0] + dir[1] * paper.normal[1];
  // a ray that runs along the wall, or away from it, never comes to it
  const gap = (paper.middle[0] - near[0]) * paper.normal[0] + (paper.middle[1] - near[1]) * paper.normal[1];
  if (out >= 0) return false;
  const k = gap / out;
  if (k < 0 || k > 1) return false;
  const px = near[0] + (far[0] - near[0]) * k - paper.middle[0],
    py = near[1] + (far[1] - near[1]) * k - paper.middle[1],
    pz = near[2] + (far[2] - near[2]) * k - paper.middle[2];
  return Math.abs(px * paper.right[0] + py * paper.right[1]) <= wide / 2 && Math.abs(pz) <= high / 2;
}
