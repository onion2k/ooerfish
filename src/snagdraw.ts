/**
 * The reed beds as they are drawn (`docs/boat.md`, C4): in each of a lake's `snags` a stand of six-sided tapered rods
 * of a dry green, leaning a little, with a brown seed head on the tallest few. Every rod stands from the bed under it
 * (`lake.groundUnder`) to its height over the water, so none floats and the shallows show them rooted. They are
 * thin, so they take no paint. Each bed is placed from a stream of its own (the lake's id and the bed's index, never
 * the game's chance), so one more bed moves no other. One static group a lake for the stems and one for the heads,
 * made once and handed over with the rest of the static set, summer's colours in every season.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { frustum, type Place } from 'artshape-render/mesh/lowpoly';
import { MeshBuilder, type Mesh } from 'artshape-render/mesh/types';
import type { Lake } from './lakes/lake';
import type { Palette } from './palette';
import { seeded } from './random';
import { WATER_LEVEL } from './rules';

/** How many rods a bed has, and how many of the tallest carry a seed head. */
const REEDS = 24;
const HEADS = 8;
/** A rod's height over the water as a share of the bed's, its radius at the foot and the top, and how far it may lean. */
const TALL = { least: 0.6, most: 1 } as const;
const STEM = { foot: 0.05, tip: 0.02, sides: 6 } as const;
const LEAN = 0.12;
/** A seed head's length, its radius at the widest and at the tip. */
const HEAD = { long: 0.3, wide: 0.07, tip: 0.04 } as const;
/** How far inside the bed's radius a rod may stand, so its lean and its width keep it within the bed's radius and 0.3. */
const MARGIN = 0.05;
/** How far a foot is sunk into the bed, so a slope does not leave it hanging. */
const SUNK = 0.1;

/** A string from a lake's id, for the seed of its beds. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** A bed's two meshes: its stems and its seed heads. */
export interface ReedBed {
  stems: Mesh;
  heads: Mesh;
}

/** Bed `i` of `lake` laid into two builders, its stems and its heads. */
function layBed(lake: Lake, i: number, stems: MeshBuilder, heads: MeshBuilder) {
  const snag = lake.snags[i];
  const random = seeded(hash(lake.id) * 7 + i * 101 + 13);
  const rods = Array.from({ length: REEDS }, () => {
    const turn = random() * Math.PI * 2;
    const out = Math.sqrt(random()) * (snag.radius - MARGIN - STEM.foot);
    const share = TALL.least + random() * (TALL.most - TALL.least);
    return {
      x: snag.x + Math.cos(turn) * out,
      y: snag.y + Math.sin(turn) * out,
      top: WATER_LEVEL + snag.height * share,
      lean: random() * LEAN,
      way: random() * Math.PI * 2,
    };
  });
  // the tallest carry the heads
  const tallest = new Set(
    rods
      .map((r, k) => [r.top, k] as const)
      .sort((x, y) => y[0] - x[0] || x[1] - y[1])
      .slice(0, HEADS)
      .map(([, k]) => k),
  );
  // a rod leans by shearing: a point's height carries it sideways, so the height itself is untouched
  const leaning = (r: (typeof rods)[number], foot: number): Place => {
    const dx = Math.tan(r.lean) * Math.cos(r.way),
      dy = Math.tan(r.lean) * Math.sin(r.way);
    return ([px, py, pz]) => [r.x + px + pz * dx, r.y + py + pz * dy, foot + pz];
  };
  rods.forEach((r, k) => {
    const foot = lake.groundUnder(r.x, r.y) - SUNK;
    const place = leaning(r, foot);
    frustum(stems, place, STEM.sides, STEM.foot, STEM.tip, 0, r.top - foot);
    // the head sits at the stem's top and reaches no higher than the bed's height
    if (tallest.has(k)) frustum(heads, place, STEM.sides, HEAD.wide, HEAD.tip, r.top - foot - HEAD.long, r.top - foot);
  });
}

/** Bed `i` of `lake`, built the same every time. */
export function reedBed(lake: Lake, i: number): ReedBed {
  const stems = new MeshBuilder(),
    heads = new MeshBuilder();
  layBed(lake, i, stems, heads);
  return { stems: stems.build(), heads: heads.build() };
}

/** Every lake's reeds, all its beds in one mesh a colour, made once. */
const MADE = new WeakMap<Lake, ReedBed>();

function merged(lake: Lake): ReedBed {
  let made = MADE.get(lake);
  if (!made) {
    const stems = new MeshBuilder(),
      heads = new MeshBuilder();
    lake.snags.forEach((_, i) => layBed(lake, i, stems, heads));
    made = { stems: stems.build(), heads: heads.build() };
    MADE.set(lake, made);
  }
  return made;
}

const ONE = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** The lake's reeds as two static groups, the stems and the heads; none for a lake without snags. */
export function snagGroups(palette: Palette, lake: Lake): GameGroup[] {
  if (lake.snags.length === 0) return [];
  const made = merged(lake);
  return [
    { mesh: made.stems, matrices: ONE, albedo: palette.reed, roughness: 0.9 },
    { mesh: made.heads, matrices: ONE, albedo: palette.reedHead, roughness: 0.9 },
  ];
}
