/**
 * The lab's settings: how dirty the lake is, the time of day, where the
 * camera stands, whether the water has caustics on its bed, and whether the rocks are painted. They live in the address, so a
 * link or a picture brings the same lake back, and nowhere else: they are the
 * viewer's, not the game's, and are never saved.
 *
 * The address is read as if anyone had written it: a name that is not known,
 * or a number that is not one, is refused, and the default kept.
 */
import { VIEWS, type ViewName } from './lake';
import { TIMES, type TimeOfDay } from './look';

export interface Settings {
  /** How dirty the lake is, from clear (0) to sick (1). */
  dirt: number;
  time: TimeOfDay['name'];
  view: ViewName;
  /** Whether the water lights its bed with caustics. */
  caustics: 'on' | 'off';
  /** Whether the rocks' ridges carry the painted edge: off draws the same rocks plain, to compare. */
  paint: 'on' | 'off';
}

export const DEFAULTS: Settings = { dirt: 1, time: 'day', view: 'shore', caustics: 'on', paint: 'on' };

/** What each setting may be, read from text as the address has it: the setting, or null for what is not known. */
const CHECK: { [K in keyof Settings]: (text: string) => Settings[K] | null } = {
  dirt: (text) => (text.trim() !== '' && Number.isFinite(Number(text)) ? Math.min(1, Math.max(0, Number(text))) : null),
  time: (text) => TIMES.find((t) => t.name === text)?.name ?? null,
  view: (text) => (Object.hasOwn(VIEWS, text) ? (text as ViewName) : null),
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

/** Settings with a change made, as the panel or the test API asks for it; what is not known is refused, and left as it was. */
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

/** The address's query with the settings written into it, and whatever else it said kept. */
export function writeSettings(settings: Settings, query: URLSearchParams): string {
  const out = new URLSearchParams(query);
  out.set('dirt', String(Math.round(settings.dirt * 100) / 100));
  out.set('time', settings.time);
  out.set('view', settings.view);
  out.set('caustics', settings.caustics);
  out.set('paint', settings.paint);
  return out.toString();
}
