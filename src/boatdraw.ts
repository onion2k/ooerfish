/**
 * The rowing boat as it is drawn (`docs/boat.md`, C2): a shallow hull of painted timber with a pointed, raised bow and a
 * raised stern, a rail along each gunwale and the thwart across the seat, two oars laid in, and the winter canvas over
 * the gunwales. Each is a moving group with a matrix of one, placed each frame at the boat with its heading and a small
 * sway of roll and pitch (drawing only, never the game's), the hull riding the water's surface at its middle. Made
 * once in the boat's own frame (x forward, y left, z up, the origin at the middle on the waterline) with the cabin's
 * `timber`; nothing is made in a frame, and the page hands the groups over again only when `show` says the cover changed.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { block, built, prism } from 'artshape-render/mesh/lowpoly';
import type { Mesh } from 'artshape-render/mesh/types';
import { timber } from './cabin';
import type { Game } from './game';
import { BOAT, type Season } from './lake';
import type { Lake } from './lakes/lake';
import { tilted } from './matrix';
import { PALETTE, type Palette } from './palette';
import { WATER_LEVEL } from './rules';

/** How far the hull's bottom is below the waterline, and the thickness of a plank, a rail, the thwart and an oar's shaft. */
const DRAFT = 0.25;
const PLANK = 0.14;
const RAIL = { wide: 0.14, high: 0.08 } as const;
/** The bow and stern stand this much higher than the gunwale, the bow reaches back this far along the sides, and the stern is this deep. */
const BOW = { rise: 0.18, long: 1.0, blunt: 0.16 } as const;
const STERN = { rise: 0.12, deep: 0.4 } as const;

/** The four parts' meshes: hull, gunwale with the thwart, oars, cover. The same boat in every lake that has one. */
interface Parts {
  hull: Mesh;
  gunwale: Mesh;
  oars: Mesh;
  cover: Mesh;
}

let parts: Parts | null = null;

const keep = ([x, y, z]: readonly [number, number, number]): [number, number, number] => [x, y, z];

function partsOfBoat(): Parts {
  if (parts) return parts;
  const { length: L, width: W, freeboard, seat } = BOAT.hull;
  const halfL = L / 2,
    halfW = W / 2;
  const top = freeboard;
  const hull = built((b) => {
    // the bottom boards, the two sides, the stern board and the pointed bow, all one solid
    block(b, keep, -halfL + STERN.deep, halfL - BOW.long, -halfW + PLANK, halfW - PLANK, -DRAFT, 0, true);
    for (const s of [-1, 1])
      block(
        b,
        keep,
        -halfL + STERN.deep,
        halfL - BOW.long,
        s < 0 ? -halfW : halfW - PLANK,
        s < 0 ? -halfW + PLANK : halfW,
        -DRAFT,
        top,
        true,
      );
    block(b, keep, -halfL, -halfL + STERN.deep, -halfW * 0.9, halfW * 0.9, -DRAFT, top + STERN.rise, true);
    prism(
      b,
      keep,
      [
        [halfL - BOW.long, -halfW],
        [halfL, -BOW.blunt],
        [halfL, BOW.blunt],
        [halfL - BOW.long, halfW],
      ],
      -DRAFT,
      top + BOW.rise,
      { bottom: true },
    );
  });
  const gunwale = built((b) => {
    for (const s of [-1, 1])
      block(
        b,
        keep,
        -halfL + STERN.deep,
        halfL - BOW.long,
        s < 0 ? -halfW : halfW - RAIL.wide,
        s < 0 ? -halfW + RAIL.wide : halfW,
        top,
        top + RAIL.high,
        true,
      );
    // the thwart across the seat: the seat’s height is its top
    const aft = -seat.aft;
    block(b, keep, aft - 0.2, aft + 0.2, -halfW + PLANK, halfW - PLANK, seat.up - 0.08, seat.up, true);
  });
  const oars = built((b) => {
    // an oar a side, the shaft laid along the inside of the gunwale and the blade at the bow end
    for (const s of [-1, 1]) {
      const y = s * (halfW - PLANK - 0.12);
      block(b, keep, -1.4, 1.1, y - 0.04, y + 0.04, seat.up + 0.02, seat.up + 0.1, true);
      block(b, keep, 1.1, 1.65, y - 0.1, y + 0.1, seat.up + 0.03, seat.up + 0.08, true);
    }
  });
  const cover = built((b) =>
    block(
      b,
      keep,
      -halfL + STERN.deep + 0.1,
      halfL - BOW.long - 0.1,
      -halfW + 0.05,
      halfW - 0.05,
      top,
      top + BOAT.cover,
      true,
    ),
  );
  parts = { hull: timber(hull), gunwale: timber(gunwale), oars: timber(oars), cover };
  return parts;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The boat’s groups, each with a matrix of one, in this order: hull, gunwale with the thwart, oars, cover; none for a lake with no boat. */
export function boatGroups(palette: Palette = PALETTE, lake: Lake): GameGroup[] {
  if (!lake.boat) return [];
  const p = partsOfBoat();
  const g = (mesh: Mesh, albedo: Palette['hull']): GameGroup => ({
    mesh,
    matrices: new Float32Array(IDENTITY),
    count: 1,
    albedo,
    roughness: 0.9,
  });
  return [g(p.hull, palette.hull), g(p.gunwale, palette.gunwale), g(p.oars, palette.oar), g(p.cover, palette.cover)];
}

/** What the last frame drew of the boat: where, which way it points, and whether the winter cover was on it. */
export interface BoatDrawn {
  x: number;
  y: number;
  heading: number;
  cover: boolean;
}

export class BoatDraw {
  private readonly made: GameGroup[];
  /** The parts' matrices, one each in the order of the groups, which the page moves each frame. */
  readonly matrices: Float32Array[];
  private readonly drawn: BoatDrawn = { x: 0, y: 0, heading: 0, cover: false };
  private covered = false;
  /** How many times the groups have been asked for, which is how many times the page handed them over. */
  handovers = 0;

  constructor(lake: Lake) {
    this.made = boatGroups(PALETTE, lake);
    this.matrices = this.made.map((g) => g.matrices);
  }

  /** What the last `write` drew. */
  get last(): BoatDrawn {
    return this.drawn;
  }

  /** The cover shown for that season and whether anyone is aboard, or scaled to nothing; whether that was a change. */
  show(season: Season, aboard: boolean): boolean {
    const on = season === 'winter' && !aboard;
    if (on === this.covered) return false;
    this.covered = on;
    return true;
  }

  /** Whether the cover was last shown. */
  shown(): boolean {
    return this.covered;
  }

  /** The groups, handed to the renderer in the order `boatGroups` has them; the matrices are the ones `write` writes. */
  groups(): GameGroup[] {
    this.handovers++;
    return this.made;
  }

  /**
   * Every part placed at the boat: its middle on the water’s surface there, turned to its heading, rocking by the clock
   * `t` (roll and pitch of `BOAT.rock`, drawing only). Written into the matrices already made; the cover is scaled to
   * nothing unless `show` has it on.
   */
  write(game: Game, t: number): BoatDrawn {
    const { boat } = game;
    const out = this.drawn;
    out.x = boat.x;
    out.y = boat.y;
    out.heading = boat.heading;
    out.cover = this.covered;
    if (!this.made.length) return out;
    const { rock } = BOAT;
    const roll = rock.roll * Math.sin(t * rock.rate);
    const pitch = rock.pitch * Math.sin(t * rock.rate * 0.7 + 1);
    const z = WATER_LEVEL + game.surface(boat.x, boat.y, t);
    for (let k = 0; k < this.made.length; k++) {
      const scale = k === 3 && !this.covered ? 0 : 1;
      tilted(this.matrices[k], 0, boat.x, boat.y, z, boat.heading, pitch, roll, scale);
    }
    return out;
  }
}
