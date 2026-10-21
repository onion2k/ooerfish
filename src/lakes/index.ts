/** Every lake the game has, by id, and the one it begins at (`docs/lakes.md`). */
import { DUCK_POND } from './duckpond';
import { RESERVOIR } from './reservoir';
import type { Lake } from './lake';

/** The lakes by id. */
export const LAKES: Record<string, Lake> = { [DUCK_POND.id]: DUCK_POND, [RESERVOIR.id]: RESERVOIR };

/** The home lake, where the cabin is: the Duck Pond. */
export const HOME: Lake = DUCK_POND;

/** The lake an id names, or the home for an id that names none (a save from some other game, or a lake since taken away). */
export function lakeNamed(id: string): Lake {
  return Object.hasOwn(LAKES, id) ? LAKES[id] : HOME;
}
