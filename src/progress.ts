/**
 * What the player has done, and where it is kept: in the browser's storage
 * or, for the game run without a page, anywhere. Old saves must still load:
 * a field a save does not have takes its default, and a field it has that
 * the game no longer knows is left alone.
 *
 * What is kept so far is the cure, how many fish have been cured, and the day's number. The
 * lake's contamination is worked out from the count and not kept itself, so
 * a retuned step is applied to a save already written. A new field gets a
 * default here and a file in `test/saves`.
 */
export interface Save {
  /** How many fish have been landed and cured, from nought; the lake is clean once it reaches what the cure asks. */
  cured: number;
  /** Which day of play it is, from one: a whole number that goes up on waking at the cabin and never down. */
  day: number;
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

const fresh = (): Save => ({ cured: 0, day: 1 });

export class Progress {
  readonly save: Save;

  /** Loaded from the store; loading alone never writes. */
  constructor(private readonly saves: SaveStore = browserStore()) {
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
    if (typeof said.day === 'number' && Number.isSafeInteger(said.day) && said.day >= 1) this.save.day = said.day;
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
