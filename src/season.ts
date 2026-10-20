/**
 * What a season does to the colours of the lake (`docs/seasons.md`, part 2), as pure sums: the palette the static set
 * is built from and the kind of grass the banks grow. Summer moves nothing, so it is the palette and the grass as they
 * were before the seasons. Only the albedo of a group differs between seasons, never a mesh, so a rebuild at the wake
 * reuses the memoised meshes and costs the albedo and the handover.
 */
import { grassGround } from 'artshape-render/game/grass';
import type { GrassKind } from 'artshape-render/game/grass';
import { noFog, type Fog } from 'artshape-render/game/fog';
import { SEASON_DRESSING, WATER_LEVEL, type Season, type SeasonColour } from './lake';
import { LUSH } from './grass';
import { PALETTE, type Palette } from './palette';

// a key the dressing may move that the palette does not have is a type error here
const MOVABLE: SeasonColour extends keyof Palette ? true : never = true;
void MOVABLE;

/**
 * The grass of a season: `LUSH` with the season's blade colours, and a height of the season's share of it. Winter's
 * is shorter, so the snow shows between blades.
 */
export function seasonGrass(season: Season): GrassKind {
  const { palette, grassHeight } = SEASON_DRESSING[season];
  return {
    ...LUSH,
    base: palette.bladeBase ?? LUSH.base,
    tip: palette.bladeTip ?? LUSH.tip,
    height: LUSH.height * grassHeight,
  };
}

/**
 * The palette of a season: the one as it is with the keys the season names moved, and the ground under the grass
 * worked out from the season's blades (`grassGround`) wherever the season moves them, so the bank is the colour the
 * blades average to in every season, as `PALETTE.grass` is for summer's.
 */
export function seasonPalette(season: Season): Palette {
  const { palette } = SEASON_DRESSING[season];
  const moved: Palette = { ...PALETTE, ...palette };
  return palette.bladeBase || palette.bladeTip ? { ...moved, grass: grassGround(seasonGrass(season)) } : moved;
}

/**
 * The fog of a season at a look (`docs/seasons.md`, part 5): the season's mist, a low layer from the water's level up,
 * where it has one at that look, and `noFog` (density nothing, so the renderer skips its passes) everywhere else. The
 * lengths are in the renderer's world units, as `mmPerUnit` converts them.
 */
export function mistFor(season: Season, time: string, mmPerUnit: number): Fog {
  const mist = SEASON_DRESSING[season].mist;
  const none = noFog(mmPerUnit);
  if (!mist || !(mist.at as readonly string[]).includes(time)) return none;
  const { density, height, colour, ambient, steps } = mist;
  return { ...none, density, base: WATER_LEVEL, height, colour: [...colour], ambient, steps };
}
