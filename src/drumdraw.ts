/**
 * The drums of waste as they are drawn on the bed: a hazard-yellow drum with a darker band round it and the black atom
 * on its lid, each a group of its own, built once from the package's solids and painted with the wood's faint warm lip
 * (the drum is a painted thing, not a glowing one, and the water over it dims and tints it). The drums are a few
 * placements in pools sized once; `groups` writes where the drums on the bed are and says how many are live, handed over
 * only when a drum is hauled (a haul takes it from the bed for good, so nothing moves in a frame).
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { at, built, disc, face, frustum } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import type { Mesh } from 'artshape-render/mesh/types';
import type { BedFinds } from './bedfinds';
import { placeAt } from './cabin';
import { CABIN_AT, DRUMS, bareGround, bedDepth } from './lake';
import { place } from './matrix';
import { PALETTE } from './palette';

/** The paint set the drum takes: the wood's, a faint warm lip (`WOOD_PAINT` is the second of the look's sets). */
const PAINT_SET = 1;
/** Sides to the drum's round, so it reads as a drum and not a block, and stays a few dozen triangles. */
const SIDES = 10;
/** How far the drum is sunk into the bed under it, so none of it hangs over a sloping bed. */
const SUNK = 0.25;
/** The bands round the drum: where each starts and ends, as a share of its height, and how far proud of the wall. */
const BANDS = {
  at: [
    [0.22, 0.32],
    [0.66, 0.76],
  ] as const,
  proud: 1.04,
};
/** The atom on the lid: the nucleus, the blades' inner and outer radius, and each blade's span, as shares of the lid. */
const ATOM = { nucleus: 0.15, inner: 0.27, outer: 0.78, span: Math.PI / 3, lift: 0.03, arcs: 3 };

/** The drum's three parts, built at its own size standing on z = 0: the body, the bands and the atom. */
export function drumParts(): { body: Mesh & { paint?: Float32Array }; bands: Mesh; atom: Mesh } {
  const { radius: r, height: h } = DRUMS;
  const body = painted(split(built((b) => frustum(b, at(0, 0, 0), SIDES, r, r, 0, h, { top: true }))), {
    set: PAINT_SET,
    choice: 'gate',
  });
  const bands = built((b) => {
    for (const [from, to] of BANDS.at)
      frustum(b, at(0, 0, 0), SIDES, r * BANDS.proud, r * BANDS.proud, h * from, h * to, { top: false });
  });
  const atom = built((b) => {
    const z = h + ATOM.lift;
    disc(b, at(0, 0, 0), 8, r * ATOM.nucleus, z);
    for (let k = 0; k < 3; k++) {
      const middle = Math.PI / 2 + (k * Math.PI * 2) / 3;
      const point = (angle: number, share: number): [number, number, number] => [
        Math.cos(angle) * r * share,
        Math.sin(angle) * r * share,
        z,
      ];
      // each blade a fan of quads round its arc, wound to face up
      for (let a = 0; a < ATOM.arcs; a++) {
        const a0 = middle - ATOM.span / 2 + (a / ATOM.arcs) * ATOM.span;
        const a1 = middle - ATOM.span / 2 + ((a + 1) / ATOM.arcs) * ATOM.span;
        face(b, point(a0, ATOM.inner), point(a0, ATOM.outer), point(a1, ATOM.outer), point(a1, ATOM.inner));
      }
    }
  });
  return { body, bands, atom };
}

/**
 * Where hauled drum `i` stands on the bank by the cabin, in the world: at its own spot of `DRUMS.bank` in front of the
 * cabin, sunk a little into the ground there, and which way it faces by its index. A drum hauled up is put here, so the
 * pond's cleaning is seen on the shore as well as in the water.
 */
export function bankSpot(i: number): [number, number, number, number] {
  const { across, along } = DRUMS.bank[i];
  const [x, y] = placeAt(CABIN_AT)([across, along, 0]);
  return [x, y, bareGround(x, y) - SUNK, i * 1.3 + 0.6];
}

export class DrumDraw {
  /** Each part's placements, sixteen floats a drum, sized once for the drums there are. */
  private readonly matrices = [0, 1, 2].map(() => new Float32Array(DRUMS.count * 16));
  /** The same for the drums stood on the bank. */
  private readonly bankMatrices = [0, 1, 2].map(() => new Float32Array(DRUMS.count * 16));
  private parts: ReturnType<typeof drumParts> | null = null;

  /**
   * The groups for the drums still on the bed, packed from the first placement: a hauled drum is left out, so it is
   * drawn no more. Says nothing of the others; call it again when one is hauled. The parts' meshes are built once.
   */
  groups(drums: BedFinds): GameGroup[] {
    this.parts ??= drumParts();
    let live = 0;
    for (let i = 0; i < drums.count; i++) {
      if (drums.found[i]) continue;
      const x = drums.x[i],
        y = drums.y[i];
      for (const m of this.matrices) place(m, live, x, y, -bedDepth(x, y) - SUNK, i * 1.3, 1);
      live++;
    }
    return this.pack(this.matrices, live);
  }

  /**
   * The groups for the drums hauled up, standing on the bank each at its own spot, packed from the first placement: a
   * drum still on the bed is left out, so none is drawn twice. The meshes are the same ones as the bed's.
   */
  bank(drums: BedFinds): GameGroup[] {
    this.parts ??= drumParts();
    let live = 0;
    for (let i = 0; i < drums.count; i++) {
      if (!drums.found[i]) continue;
      const [x, y, z, yaw] = bankSpot(i);
      for (const m of this.bankMatrices) place(m, live, x, y, z, yaw, 1);
      live++;
    }
    return this.pack(this.bankMatrices, live);
  }

  private pack(matrices: Float32Array[], live: number): GameGroup[] {
    const { body, bands, atom } = this.parts!;
    return [
      { mesh: body, matrices: matrices[0], count: live, albedo: PALETTE.drum, roughness: 0.55 },
      { mesh: bands, matrices: matrices[1], count: live, albedo: PALETTE.drumBand, roughness: 0.6 },
      { mesh: atom, matrices: matrices[2], count: live, albedo: PALETTE.drumAtom, roughness: 0.7 },
    ];
  }
}
