/**
 * The junk treasures as they are drawn (`docs/junk.md`): each a few solids from the package's primitives, built once and
 * painted with the wood's faint warm lip on its main part, a toy of a few dozen triangles standing on z = 0 and facing
 * along x. One group a part, each with one placement that moves: a treasure still on the bed lies on it where its seed
 * put it, drawn `bedScale` times its size so that it is seen through the water, and one found stands on its shelf in the
 * cabin, a good deal smaller, so a find is never drawn twice and the pool never changes size. The groups are handed over
 * only when the count found changes, never in a frame, and the room's walls hide the shelves from outside, as they hide
 * the rest of its furniture.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { at, block, built, disc, face, frustum, rod } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import type { Mesh } from 'artshape-render/mesh/types';
import type { BedFinds } from './bedfinds';
import { placeAt } from './cabin';
import type { Lake } from './lakes/lake';
import { place } from './matrix';
import { PALETTE, type Colour } from './palette';

/** The paint set the treasures take: the wood's, as the drums do. */
const PAINT_SET = 1;
/** How far a treasure is sunk into the bed under it, so none of it hangs over a sloping bed (the bed's scale applies to the models, not to this). */
const SUNK = 0.05;

/** One part of a treasure: its mesh (painted if it is a main part), its colour and its roughness. */
export interface TreasurePart {
  mesh: Mesh & { paint?: Float32Array };
  colour: Colour;
  roughness: number;
}

/** How high a six-sided rod's axis stands over the ground it lies on, as a share of its radius: its lowest points are a sixth of a turn round. */
const REST = Math.sin(Math.PI / 3);

const paint = (mesh: Mesh) => painted(split(mesh), { set: PAINT_SET, choice: 'gate' });

/**
 * Treasure `i`'s parts, built at one standing on z = 0 about the origin and facing +x, to the size the lake's `treasures` say.
 * The same every time, and each under sixty triangles together.
 */
export function treasureParts(i: number, lake: Lake): TreasurePart[] {
  switch (lake.treasures.list[i].id) {
    case 'lure': {
      // a spinner lying on its side: a rusted spindle with a bright blade at its head and a hook's bar
      const body = built((b) => rod(b, [-0.3, 0, 0.1 * REST], [0.3, 0, 0.1 * REST], 0.1, 6, true));
      const blade = built((b) => {
        block(b, at(0.34, 0, 0, 0.4), 0, 0.2, -0.07, 0.07, 0.02, 0.05);
        block(b, at(-0.3, 0, 0), -0.08, 0, -0.02, 0.02, 0.02, 0.06);
      });
      return [
        { mesh: paint(body), colour: PALETTE.lureBody, roughness: 0.8 },
        { mesh: blade, colour: PALETTE.lureBlade, roughness: 0.3 },
      ];
    }
    case 'plush': {
      // the Sunny Atom, sitting: a round yellow body and head, and a dark face on the front of the head
      const body = built((b) => {
        frustum(b, at(0, 0, 0), 6, 0.38, 0.3, 0, 0.42);
        frustum(b, at(0, 0, 0), 6, 0.3, 0.22, 0.42, 0.74);
      });
      const face_ = built((b) => {
        const x = 0.222;
        for (const y of [-0.08, 0.08])
          face(b, [x, y - 0.03, 0.6], [x, y + 0.03, 0.6], [x, y + 0.03, 0.66], [x, y - 0.03, 0.66]);
        face(b, [x, -0.07, 0.5], [x, 0.07, 0.5], [x, 0.07, 0.53], [x, -0.07, 0.53]);
      });
      return [
        { mesh: paint(body), colour: PALETTE.plush, roughness: 1 },
        { mesh: face_, colour: PALETTE.plushFace, roughness: 0.9 },
      ];
    }
    case 'lunchbox': {
      // a tin box with a lighter band round it and a handle on its lid
      const box = built((b) => block(b, at(0, 0, 0), -0.33, 0.33, -0.2, 0.2, 0, 0.36));
      const band = built((b) => block(b, at(0, 0, 0), -0.345, 0.345, -0.215, 0.215, 0.16, 0.22));
      const handle = built((b) => block(b, at(0, 0, 0), -0.12, 0.12, -0.04, 0.04, 0.36, 0.43));
      return [
        { mesh: paint(box), colour: PALETTE.lunchbox, roughness: 0.5 },
        { mesh: band, colour: PALETTE.lunchboxBand, roughness: 0.6 },
        { mesh: handle, colour: PALETTE.lunchboxHandle, roughness: 0.4 },
      ];
    }
    case 'badge': {
      // a round tin badge lying flat, a pale face on a red rim
      const rim = built((b) => frustum(b, at(0, 0, 0), 8, 0.42, 0.42, 0, 0.07));
      const centre = built((b) => disc(b, at(0, 0, 0), 8, 0.3, 0.08));
      return [
        { mesh: paint(rim), colour: PALETTE.badge, roughness: 0.4 },
        { mesh: centre, colour: PALETTE.badgeFace, roughness: 0.5 },
      ];
    }
    case 'bottle': {
      // a bottle lying on its side, neck toward the front, a cork in its mouth
      const glass = built((b) => {
        rod(b, [-0.4, 0, 0.13 * REST], [0.15, 0, 0.13 * REST], 0.13, 6, true);
        rod(b, [0.15, 0, 0.13 * REST], [0.42, 0, 0.13 * REST], 0.055, 5, true);
      });
      const cork = built((b) => rod(b, [0.42, 0, 0.13 * REST], [0.5, 0, 0.13 * REST], 0.045, 5, true));
      return [
        { mesh: paint(glass), colour: PALETTE.bottle, roughness: 0.25 },
        { mesh: cork, colour: PALETTE.bottleCork, roughness: 0.9 },
      ];
    }
    case 'duck': {
      // the pond's rubber duck, bright yellow, with an orange bill
      const body = built((b) => {
        frustum(b, at(0, 0, 0), 7, 0.36, 0.3, 0, 0.3);
        frustum(b, at(0.1, 0, 0), 6, 0.2, 0.15, 0.3, 0.56);
      });
      const bill = built((b) => block(b, at(0, 0, 0), 0.24, 0.4, -0.07, 0.07, 0.36, 0.42));
      return [
        { mesh: paint(body), colour: PALETTE.duck, roughness: 0.4 },
        { mesh: bill, colour: PALETTE.duckBill, roughness: 0.6 },
      ];
    }
  }
  throw new Error(`no model for treasure ${i}`);
}

/** Where treasure `i` lies on the bed, a little sunk, and which way it points: its own, from its index. */
export function bedSpot(treasures: BedFinds, i: number, lake: Lake): [number, number, number, number] {
  const [x, y] = [treasures.x[i], treasures.y[i]];
  return [x, y, -lake.bedDepth(x, y) - SUNK, i * 2.1];
}

/** Where treasure `i` stands on its shelf in the cabin, in the world: on the shelf's top, facing into the room. */
export function shelfSpot(i: number, lake: Lake): [number, number, number, number] {
  if (!lake.cabin) throw new Error(`${lake.name} has no cabin, so no shelf`);
  const { spec: CABIN, at: CABIN_AT, room: CABIN_ROOM, floor: CABIN_FLOOR } = lake.cabin;
  const t = lake.treasures.list[i];
  const sh = t.shelf.on === 'lower' ? CABIN_ROOM.furniture.shelf : CABIN_ROOM.furniture.shelfUpper;
  const wall = CABIN.body.across / 2 - CABIN_ROOM.inset;
  const [x, y] = placeAt(CABIN_AT)([wall - sh.deep / 2, t.shelf.along, 0]);
  // the front faces out from the wall, into the room: away from the lake, a little turned by its own index
  const [ix, iy] = CABIN_AT.inward;
  return [x, y, CABIN_FLOOR + sh.high + sh.thick, Math.atan2(-iy, -ix) + (i % 2 ? 0.25 : -0.25)];
}

export class TreasureDraw {
  /** Each part's placement, sixteen floats, one a group and sized once. */
  private matrices: Float32Array[] = [];
  private parts: TreasurePart[][] | null = null;

  /** The treasures of `lake`: its bed under the ones lost, and its cabin's shelves for the ones found. */
  constructor(private readonly lake: Lake) {}

  /**
   * The groups of every treasure, a part each: the ones still on the bed lie there, and the ones found stand on the
   * shelf. Call again when the count found changes; the meshes are built and the matrices sized once.
   */
  groups(treasures: BedFinds): GameGroup[] {
    const { lake } = this;
    this.parts ??= lake.treasures.list.map((_, i) => treasureParts(i, lake));
    if (this.matrices.length === 0)
      for (const p of this.parts) for (let k = 0; k < p.length; k++) this.matrices.push(new Float32Array(16));
    const out: GameGroup[] = [];
    let g = 0;
    this.parts.forEach((parts, i) => {
      // a find in a lake with no cabin has no shelf to stand on, and is drawn on the bed at no size at all
      const shelved = treasures.found[i] && lake.cabin !== null;
      const [x, y, z, yaw] = shelved ? shelfSpot(i, lake) : bedSpot(treasures, i, lake);
      const scale = shelved ? lake.treasures.shelfScale : treasures.found[i] ? 0 : lake.treasures.bedScale;
      for (const p of parts) {
        const m = this.matrices[g++];
        place(m, 0, x, y, z, yaw, scale);
        out.push({ mesh: p.mesh, matrices: m, count: 1, albedo: p.colour, roughness: p.roughness });
      }
    });
    return out;
  }
}
