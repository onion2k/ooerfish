/**
 * What the player has done, and where it is kept: in the browser's storage
 * or, for the game run without a page, anywhere. Old saves must still load:
 * a field a save does not have takes its default, and a field it has that
 * the game no longer knows is left alone.
 *
 * What is kept so far is the cure, how many fish have been cured, how many drums of waste hauled, the day's number, the
 * journal of what each kind has had caught, and the ids of the junk treasures found on the bed, the clock, and whether the player was at the pond or in the cabin. The
 * lake's contamination is worked out from the count and not kept itself, so
 * a retuned step is applied to a save already written. A new field gets a
 * default here and a file in `test/saves`.
 */
import { CLOCK, KINDS } from './lake';
import type { Lake } from './lakes/lake';
import { HOME } from './lakes';
import type { Journal } from './journal';

export interface Save {
  /** How many fish have been landed and cured, from nought; the lake is clean once it reaches what the cure asks. */
  cured: number;
  /** Which day of play it is, from one: a whole number that goes up on waking at the cabin and never down. */
  day: number;
  /** How many drums of waste have been hauled up from the bed, from nought, and never more than the pond has. */
  drums: number;
  /** What each kind of fish has had caught, by the kind's id: how many, the best weight and the day of the first. */
  journal: Journal;
  /** The ids of the treasures found and kept for the shelf, in the order they were found, each once and never more than the pond has. */
  found: string[];
  /** Where the day's clock stood, a fraction of the day from nought up to but not reaching one; dawn in the cabin, where it is held. */
  time: number;
  /** Where the player was: at the pond or in the cabin. The yawn between is never kept, so a load lands before it. */
  place: 'pond' | 'cabin';
}

/** Where the save is kept. */
export interface SaveStore {
  load(): string | null;
  store(json: string): void;
  clear(): void;
}

export const KEY = 'ooerfish-save-v1';

/** The browser's storage, and nothing at all where there is none, or it will not be written. */
export function browserStore(key = KEY): SaveStore {
  return {
    load() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    store(json) {
      try {
        localStorage.setItem(key, json);
      } catch {
        /* fine */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to remove */
      }
    },
  };
}

/** A save kept in memory, starting from `json` if given: for the game run without a page. */
export function memoryStore(json: string | null = null): SaveStore & { json: string | null } {
  return {
    json,
    load() {
      return this.json;
    },
    store(next) {
      this.json = next;
    },
    clear() {
      this.json = null;
    },
  };
}

const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);

/**
 * The journal as anyone may have written it, field by field. A kind the game does not know is dropped, and so is an
 * entry whose count is not a whole number of one or more. A best weight outside its kind's range, or a first day that
 * is not a whole number from one up to today (the day is the save's own, known here), is taken for none, which is
 * nought, and the entry keeps the rest. A journal that counts more catches than there are fish cured was not written
 * by play, since each catch cures one, and is taken for none whole.
 */
function readJournal(raw: unknown, cured: number, day: number): Journal {
  const out: Journal = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const said = raw as Record<string, unknown>;
  let caught = 0;
  for (const kind of KINDS) {
    if (!Object.hasOwn(said, kind.id)) continue;
    const e = said[kind.id];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) continue;
    const entry = e as Record<string, unknown>;
    if (!whole(entry.caught) || entry.caught < 1) continue;
    const [least, most] = kind.weight;
    const best = typeof entry.best === 'number' && entry.best >= least && entry.best <= most ? entry.best : 0;
    const first = whole(entry.first) && entry.first >= 1 && entry.first <= day ? entry.first : 0;
    out[kind.id] = { caught: entry.caught, best, first };
    caught += entry.caught;
  }
  return caught > cured ? {} : out;
}

/**
 * The treasures found as anyone may have written them: a list, of which an id the lake has no treasure for, and a
 * repeat of one already kept, is dropped, so what is kept is known, unique, in order, and no longer than the treasures
 * there are. Anything that is not a list is none.
 */
function readFound(raw: unknown, lake: Lake): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(lake.treasures.list.map((t) => t.id));
  const out: string[] = [];
  for (const id of raw) if (typeof id === 'string' && known.has(id) && !out.includes(id)) out.push(id);
  return out;
}

const fresh = (): Save => ({
  cured: 0,
  day: 1,
  drums: 0,
  journal: {},
  found: [],
  time: CLOCK.startsAt,
  place: 'pond',
});

export class Progress {
  readonly save: Save;

  /** Loaded from the store; loading alone never writes. */
  constructor(
    private readonly saves: SaveStore = browserStore(),
    private readonly lake: Lake = HOME,
  ) {
    this.save = fresh();
    const json = saves.load();
    if (json === null) return;
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return;
    // each field is read as if anyone had written it: one that is not what it should be is taken for its default
    const said = raw as Record<string, unknown>;
    if (typeof said.cured === 'number' && Number.isSafeInteger(said.cured) && said.cured >= 0)
      this.save.cured = said.cured;
    if (typeof said.drums === 'number' && Number.isSafeInteger(said.drums) && said.drums >= 0)
      this.save.drums = Math.min(said.drums, this.lake.drums.count);
    if (typeof said.day === 'number' && Number.isSafeInteger(said.day) && said.day >= 1) this.save.day = said.day;
    this.save.journal = readJournal(said.journal, this.save.cured, this.save.day);
    this.save.found = readFound(said.found, this.lake);
    if (typeof said.time === 'number' && Number.isFinite(said.time) && said.time >= 0 && said.time < 1)
      this.save.time = said.time;
    if (said.place === 'pond' || said.place === 'cabin') this.save.place = said.place;
    // the clock is held at dawn in the cabin, so a cabin save has no other time to keep
    if (this.save.place === 'cabin') this.save.time = CLOCK.startsAt;
  }

  persist() {
    this.saves.store(JSON.stringify(this.save));
  }

  /** Start over: the save wiped, in memory and in the store. */
  reset() {
    Object.assign(this.save, fresh());
    this.saves.clear();
  }
}
