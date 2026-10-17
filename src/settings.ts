/**
 * What the address still holds: whether the water lights its bed with caustics, and whether the rocks are painted.
 * Both are comparisons for whoever is testing the game or looking at it, not a player's choices, so they live in the
 * address, read once and never written back, and nowhere else. The game's own state (how dirty the lake is, the time
 * of day, where the camera stands) is the game's, and an address from the lab that still says it opens the game all
 * the same, unread.
 *
 * The address is read as if anyone had written it: a name that is not known is refused, and the default kept.
 */
export interface Settings {
  /** Whether the water lights its bed with caustics. */
  caustics: 'on' | 'off';
  /** Whether the rocks' ridges carry the painted edge: off draws the same rocks plain, to compare. */
  paint: 'on' | 'off';
}

export const DEFAULTS: Settings = { caustics: 'on', paint: 'on' };

/** What each setting may be, read from text as the address has it: the setting, or null for what is not known. */
const CHECK: { [K in keyof Settings]: (text: string) => Settings[K] | null } = {
  caustics: (text) => (text === 'on' || text === 'off' ? text : null),
  paint: (text) => (text === 'on' || text === 'off' ? text : null),
};

/** The settings an address says, each one not known left at its default. */
export function readSettings(query: URLSearchParams): Settings {
  const said: Partial<Record<keyof Settings, string>> = {};
  for (const key of Object.keys(CHECK) as (keyof Settings)[]) {
    const text = query.get(key);
    if (text !== null) said[key] = text;
  }
  return changed(DEFAULTS, said);
}

/** Settings with a change made, as the test API asks for it; what is not known is refused, and left as it was. */
export function changed(settings: Settings, next: Partial<Record<keyof Settings, string | number>>): Settings {
  const out = { ...settings };
  for (const key of Object.keys(CHECK) as (keyof Settings)[]) {
    const text = next[key];
    if (text === undefined) continue;
    const value = CHECK[key](String(text));
    if (value !== null) (out as Record<keyof Settings, unknown>)[key] = value;
  }
  return out;
}
