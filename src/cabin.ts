/**
 * The cabin on the north-east bank and the jetty before it, as they are drawn: the cabin's walls, roof, chimney, door and
 * window, and the jetty's deck and the posts it stands on. They are the page's picture, and the game knows nothing of
 * them beyond the deck (a bit of bank in the water: `jettyGap`) and the cabin's footprint, which the grass, trees and
 * clumps keep out of. Where they stand and how big they are is the lake's (`lake.cabin`, `lake.jetty`), so the picture and the
 * rules are held to one place; what is here is how they are built from the package's solids and where they stand on the
 * ground. Each is made once, in the world's own frame, and placed by the identity. A lake with no cabin or no jetty is
 * given none of its groups.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import { block, built, prism, type Place } from 'artshape-render/mesh/lowpoly';
import { painted, split } from 'artshape-render/mesh/paint';
import type { Mesh } from 'artshape-render/mesh/types';
import type { Lake } from './lakes/lake';
import { PALETTE, type Palette } from './palette';

/** The paint set the timber takes, the wood's faint warm lip (`WOOD_PAINT` is the second of the look's sets). */
const WOOD = 1;

/**
 * A timber mesh with the painted edge: split so every triangle has its own vertices, and painted on the wood's set with
 * the gate's choice, since a board has no ridges worth choosing between. Made once with the group it is in, never in a
 * frame. Without it the eaves and the deck's rim would be as plain as the glass.
 */
function timber(mesh: Mesh) {
  return painted(split(mesh), { set: WOOD, choice: 'gate' });
}

const ONE = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** How much the window glows from itself, as the fish glow: it is lit inside. */
const WINDOW_GLOW = 0.6;
/** How far the walls are sunk under the lowest ground below them, so no sloping bank leaves them hanging. */
const SUNK = 0.2;

/**
 * A frame on the ground at a point, right-handed like the world: x toward the lake's middle, y along the shore, z up,
 * written as a place into the world's own frame.
 */
export function placeAt(origin: {
  x: number;
  y: number;
  inward: readonly [number, number];
  along: readonly [number, number];
}): Place {
  return ([x, y, z]) => [
    origin.x + origin.inward[0] * x + origin.along[0] * y,
    origin.y + origin.inward[1] * x + origin.along[1] * y,
    z,
  ];
}

/** The cabin's drawn parts: five groups, the walls with their gables, the roof, the chimney, the door and the window. The timber (all but the chimney's stone and the window's glass) carries the painted edge. */
export function cabinGroups(palette: Palette = PALETTE, lake: Lake): GameGroup[] {
  if (!lake.cabin) return [];
  const { body, roof, chimney, door, window } = lake.cabin.spec;
  const CABIN_AT = lake.cabin.at;
  const place = placeAt(CABIN_AT);
  const at = (x: number, y: number) =>
    lake.bareGround(
      CABIN_AT.x + CABIN_AT.inward[0] * x + CABIN_AT.along[0] * y,
      CABIN_AT.y + CABIN_AT.inward[1] * x + CABIN_AT.along[1] * y,
    );
  const halfX = body.across / 2,
    halfY = body.along / 2;
  // the door's sill is the ground at the front wall's middle; the walls stand from under the lowest ground below them
  const floor = at(halfX, 0);
  const eaves = floor + body.high;
  let lowest = Infinity;
  for (const x of [-halfX, 0, halfX]) for (const y of [-halfY, 0, halfY]) lowest = Math.min(lowest, at(x, y));
  const tan = Math.tan(roof.pitch);
  // the roof's panels leave the ridge and fall to the eaves, past the wall by the overhang; the undersides meet the walls'
  // top corners, and the gable fills the triangle under them
  const reach = halfX + roof.overhang;
  const under = (u: number) => eaves + (halfX - Math.abs(u)) * tan;
  const thick = roof.thick / Math.cos(roof.pitch);
  // the roof's cross-section is in x and z, its length along y: a place that turns the prism's own axes to those
  const roofPlace: Place = ([u, v, w]) => place([u, -w, v]);
  const lengthwise = halfY + roof.overhang;

  const walls = built((b) => {
    block(b, place, -halfX, halfX, -halfY, halfY, lowest - SUNK, eaves, true);
    prism(
      b,
      roofPlace,
      [
        [-halfX, eaves],
        [halfX, eaves],
        [0, under(0)],
      ],
      -halfY,
      halfY,
      { bottom: true },
    );
  });
  const panels = built((b) => {
    prism(
      b,
      roofPlace,
      [
        [0, under(0)],
        [reach, under(reach)],
        [reach, under(reach) + thick],
        [0, under(0) + thick],
      ],
      -lengthwise,
      lengthwise,
      { bottom: true },
    );
    prism(
      b,
      roofPlace,
      [
        [0, under(0)],
        [0, under(0) + thick],
        [-reach, under(reach) + thick],
        [-reach, under(reach)],
      ],
      -lengthwise,
      lengthwise,
      { bottom: true },
    );
  });
  const stack = built((b) =>
    block(
      b,
      place,
      -chimney.size / 2,
      chimney.size / 2,
      chimney.along - chimney.size / 2,
      chimney.along + chimney.size / 2,
      eaves + chimney.from,
      eaves + chimney.from + chimney.high,
    ),
  );
  // the door and the window stand a tenth proud of the lake-facing wall
  const proud = 0.1;
  const doorway = built((b) =>
    block(b, place, halfX - proud, halfX + proud, -door.width / 2, door.width / 2, floor, floor + door.high),
  );
  const pane = built((b) =>
    block(
      b,
      place,
      halfX - proud,
      halfX + proud,
      window.along - window.width / 2,
      window.along + window.width / 2,
      floor + window.sill,
      floor + window.sill + window.high,
    ),
  );
  const lit = packFlow(new Float32Array(PATTERN_STRIDE), 0, {
    kind: FLOW_GLOW,
    scale: 0,
    speed: 0,
    glow: WINDOW_GLOW,
    second: palette.cabinWindow,
  });
  return [
    { mesh: timber(walls), matrices: ONE, albedo: palette.cabinWall, roughness: 0.9 },
    { mesh: timber(panels), matrices: ONE, albedo: palette.cabinRoof, roughness: 0.85 },
    { mesh: stack, matrices: ONE, albedo: palette.cabinChimney, roughness: 0.9 },
    { mesh: timber(doorway), matrices: ONE, albedo: palette.cabinDoor, roughness: 0.9 },
    { mesh: pane, matrices: ONE, albedo: palette.cabinWindow, roughness: 0.6, patterns: lit },
  ];
}

/** A post of the jetty: where it stands, the ground at its foot, and the height of the deck's underside it holds up. */
export interface PostSpot {
  x: number;
  y: number;
  foot: number;
  top: number;
}

/** The jetty's posts, a pair at each place along the deck, each from the ground under it to the deck's underside. */
export function postSpots(lake: Lake): PostSpot[] {
  if (!lake.jetty) return [];
  const { spec: JETTY, deck: DECK } = lake.jetty;
  const { along, side } = JETTY.posts;
  const spots: PostSpot[] = [];
  for (const u of along)
    for (const s of [-1, 1]) {
      const x = DECK.x + DECK.inward[0] * u + DECK.along[0] * s * side,
        y = DECK.y + DECK.inward[1] * u + DECK.along[1] * s * side;
      spots.push({ x, y, foot: lake.bareGround(x, y), top: JETTY.top - JETTY.thick });
    }
  return spots;
}

/** The jetty's drawn parts: the deck of planks, and the posts it stands on, all in one mesh, both painted as timber. */
export function jettyGroups(palette: Palette = PALETTE, lake: Lake): GameGroup[] {
  if (!lake.jetty) return [];
  const { spec: JETTY, deck: DECK } = lake.jetty;
  const place = placeAt(DECK);
  const deck = built((b) =>
    block(b, place, 0, JETTY.length, -JETTY.width / 2, JETTY.width / 2, JETTY.top - JETTY.thick, JETTY.top, true),
  );
  const half = JETTY.posts.size / 2;
  const posts = built((b) => {
    for (const s of postSpots(lake))
      block(b, ([x, y, z]) => [s.x + x, s.y + y, z], -half, half, -half, half, s.foot, s.top);
  });
  return [
    { mesh: timber(deck), matrices: ONE, albedo: palette.deck, roughness: 0.9 },
    { mesh: timber(posts), matrices: ONE, albedo: palette.post, roughness: 0.9 },
  ];
}
