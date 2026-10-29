/**
 * What the player has done, and where it is kept: in the browser's storage
 * or, for the game run without a page, anywhere. Old saves must still load:
 * a field a save does not have takes its default, and a field it has that
 * the game no longer knows is left alone.
 *
 * What is kept so far is the lake the player is at, and for each lake the cure (how many fish have been cured, how many
 * drums of waste hauled, the journal of what each kind has had caught and the ids of the junk treasures found on its
 * bed), and, of the player and not of a lake, the day's number, the clock, and whether the player was at the pond or in
 * the cabin. A save from before there were lakes held the lake's fields flat at the top, and reads as the home's. The
 * lake's contamination is worked out from the count and not kept itself, so
 * a retuned step is applied to a save already written. A new field gets a
 * default here and a file in `test/saves`.
 */
import { CLOCK, KINDS, PHOTOS, WEATHER } from './lake';
import type { Photo } from './photo';
import type { Lake } from './lakes/lake';
import { HOME } from './lakes';
import type { Journal } from './journal';
import { REQUESTS } from './town/requests';

/** What the player has done at one lake: it is kept for every lake known, and a journey from one to another resets none. */
export interface LakeSave {
  /** How many fish have been landed and cured, from nought; the lake is clean once it reaches what the cure asks. */
  cured: number;
  /** How many drums of waste have been hauled up from the bed, from nought, and never more than the pond has. */
  drums: number;
  /** What each kind of fish has had caught, by the kind's id: how many, the best weight and the day of the first. */
  journal: Journal;
  /** The ids of the treasures found and kept for the shelf, in the order they were found, each once and never more than the pond has. */
  found: string[];
  /**
   * Where the boat lies with the player aboard, anchored (`docs/boat.md`, C2): its middle and the way it points. Null when
   * the player is ashore, the boat at its mooring, which is how every save from before the boat reads. A row under way is
   * never saved, so a load lands at the last anchorage.
   */
  boat: { x: number; y: number; heading: number } | null;
}

export interface Save {
  /** The id of the lake the player is at; the home's for an id the game does not know. */
  lake: string;
  /** What has been done at each lake, by id: one entry for every lake the game has, fresh where the save had none. */
  lakes: Record<string, LakeSave>;
  /** Which day of play it is, from one: a whole number that goes up on waking at the cabin and never down. */
  day: number;
  /** Where the day's clock stood, a fraction of the day from nought up to but not reaching one; held wherever it stood in the cabin, where the player walked in or woke at dawn. */
  time: number;
  /** Where the player was: at the pond or in the cabin. The yawn between is never kept, so a load lands before it. */
  place: 'pond' | 'cabin';
  /** The ids of the town's requests answered, in the order they were, each once; nothing ever takes one away. */
  requests: string[];
  /** The album, oldest first and never more than `PHOTOS.most`: each a record of figures, redrawn when it is looked at. */
  photos: Photo[];
  /**
   * What the contests count (`docs/contests.md`), over every lake: `rain` is the fish stowed while it rained (not in a
   * shower), `run` the fish in a row landed and stowed with no cast wasted since, and `best` the longest such run, which
   * `run` never passes.
   */
  tally: { rain: number; run: number; best: number };
}

/** A save as a test may hand one in: any of the fields, the flat shape from before there were lakes included, which reads as the home's. */
export type SaveSaid = Omit<Partial<Save>, 'lakes'> & Partial<LakeSave> & { lakes?: Record<string, Partial<LakeSave>> };

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

/**
 * The requests answered as anyone may have written them: a list, of which an id the town has no request for, a
 * repeat of one already kept, and one the save does not earn (read after the lakes, so the request's own test is
 * asked) is dropped, as a journal that counts more caught than cured is. Anything that is not a list is none.
 */
function readRequests(raw: unknown, save: Save, lakes: Record<string, Lake>): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && !out.includes(id)) {
      const request = REQUESTS.find((r) => r.id === id);
      if (request && request.met(save, lakes)) out.push(id);
    }
  }
  return out;
}

/**
 * The tally as anyone may have written it: each figure a non-negative whole number or else nought, and the run held to
 * the best, since a run is never longer than the longest one. Anything that is not an object is all noughts.
 */
function readTally(raw: unknown): Save['tally'] {
  const e = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const figure = (n: unknown) => (whole(n) && n >= 0 ? n : 0);
  const best = figure(e.best);
  return { rain: figure(e.rain), run: Math.min(figure(e.run), best), best };
}

/**
 * The album as anyone may have written it: a list, of which an entry is kept only when its lake is one the game has,
 * its day a whole number from one up to today's, its time a finite number in [0, 1), its weather one the game has, its
 * view six finite numbers, its kinds a list of kind ids and its `lit` a boolean. A repeated kind is kept once. Held to
 * the first `PHOTOS.most`; anything that is not a list is none.
 */
function readPhotos(raw: unknown, save: Save, lakes: Record<string, Lake>): Photo[] {
  if (!Array.isArray(raw)) return [];
  const out: Photo[] = [];
  const ids: string[] = KINDS.map((k) => k.id);
  for (const p of raw) {
    if (out.length >= PHOTOS.most) break;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) continue;
    const e = p as Record<string, unknown>;
    if (typeof e.lake !== 'string' || !Object.hasOwn(lakes, e.lake)) continue;
    if (!whole(e.day) || e.day < 1 || e.day > save.day) continue;
    if (typeof e.time !== 'number' || !Number.isFinite(e.time) || e.time < 0 || e.time >= 1) continue;
    if (typeof e.weather !== 'string' || !(WEATHER.kinds as readonly string[]).includes(e.weather)) continue;
    const v = e.view;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) continue;
    const view = v as Record<string, unknown>;
    const keys = ['x', 'y', 'z', 'azimuth', 'polar', 'radius'] as const;
    if (!keys.every((k) => typeof view[k] === 'number' && Number.isFinite(view[k]))) continue;
    if (!Array.isArray(e.kinds) || !e.kinds.every((k) => typeof k === 'string' && ids.includes(k))) continue;
    if (typeof e.lit !== 'boolean') continue;
    out.push({
      lake: e.lake,
      day: e.day,
      time: e.time,
      weather: e.weather as Photo['weather'],
      view: {
        x: view.x as number,
        y: view.y as number,
        z: view.z as number,
        azimuth: view.azimuth as number,
        polar: view.polar as number,
        radius: view.radius as number,
      },
      kinds: [...new Set(e.kinds as string[])],
      lit: e.lit,
    });
  }
  return out;
}

/**
 * The boat as anyone may have written it: a point and a heading, each a finite number, or else none, which is ashore.
 * Whether the point is on the water is the game's to say when it loads, since the lake is what knows.
 */
function readBoat(raw: unknown): LakeSave['boat'] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const { x, y, heading } = e;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof heading !== 'number') return null;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(heading) ? { x, y, heading } : null;
}

const freshEntry = (): LakeSave => ({ cured: 0, drums: 0, journal: {}, found: [], boat: null });

/**
 * One lake's entry as anyone may have written it, read against that lake: the count cured a whole number from nought,
 * the drums held to the lake's own, the journal and the treasures as their readers have them. Anything missing or not
 * what it should be is its default, so an entry that is not an object is a fresh one.
 */
function readEntry(raw: unknown, lake: Lake, day: number): LakeSave {
  const out = freshEntry();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const said = raw as Record<string, unknown>;
  if (whole(said.cured) && said.cured >= 0) out.cured = said.cured;
  if (whole(said.drums) && said.drums >= 0) out.drums = Math.min(said.drums, lake.drums.count);
  out.journal = readJournal(said.journal, out.cured, day);
  out.found = readFound(said.found, lake);
  out.boat = readBoat(said.boat);
  return out;
}

export class Progress {
  readonly save: Save;

  /**
   * Loaded from the store; loading alone never writes. `lakes` is every lake the game has, by id, which the save is
   * read against (this file does not import the registry's content; the page hands it in, and a test a record of the
   * lakes it plays).
   */
  constructor(
    private readonly saves: SaveStore = browserStore(),
    readonly lakes: Record<string, Lake> = { [HOME.id]: HOME },
  ) {
    this.save = this.fresh();
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
    if (typeof said.day === 'number' && Number.isSafeInteger(said.day) && said.day >= 1) this.save.day = said.day;
    if (typeof said.time === 'number' && Number.isFinite(said.time) && said.time >= 0 && said.time < 1)
      this.save.time = said.time;
    if (said.place === 'pond' || said.place === 'cabin') this.save.place = said.place;
    // the lake the player was at, or the home for one the game does not know (a save from elsewhere, or a lake since taken away)
    if (typeof said.lake === 'string' && Object.hasOwn(lakes, said.lake)) this.save.lake = said.lake;
    // the lakes: a save with no `lakes` is from before there were any, and its flat fields are the home's entry; one with
    // `lakes` takes it and leaves the flat fields alone; an entry under an id the game does not know is dropped
    if (Object.hasOwn(said, 'lakes')) {
      const kept = said.lakes;
      if (typeof kept === 'object' && kept !== null && !Array.isArray(kept))
        for (const id of Object.keys(lakes))
          if (Object.hasOwn(kept, id))
            this.save.lakes[id] = readEntry((kept as Record<string, unknown>)[id], lakes[id], this.save.day);
    } else {
      const home = this.homeId();
      this.save.lakes[home] = readEntry(said, lakes[home] ?? HOME, this.save.day);
    }
    this.save.requests = readRequests(said.requests, this.save, lakes);
    this.save.photos = readPhotos(said.photos, this.save, lakes);
    this.save.tally = readTally(said.tally);
  }

  /** The home's id, or the first the registry has where the home is not in it (a test that plays some other lake alone). */
  private homeId(): string {
    return Object.hasOwn(this.lakes, HOME.id) ? HOME.id : (Object.keys(this.lakes)[0] ?? HOME.id);
  }

  private fresh(): Save {
    const lakes: Record<string, LakeSave> = {};
    for (const id of Object.keys(this.lakes)) lakes[id] = freshEntry();
    return {
      lake: this.homeId(),
      lakes,
      day: 1,
      time: CLOCK.startsAt,
      place: 'pond',
      requests: [],
      photos: [],
      tally: { rain: 0, run: 0, best: 0 },
    };
  }

  /** What has been done at the lake with this id: the live entry the game writes, made fresh if the save has none. */
  entry(id: string): LakeSave {
    return (this.save.lakes[id] ??= freshEntry());
  }

  /** The fish cured over every lake, which the gear is worked out from, so a journey resets none of it. */
  curedTotal(): number {
    let sum = 0;
    for (const e of Object.values(this.save.lakes)) sum = Math.min(sum + e.cured, Number.MAX_SAFE_INTEGER);
    return sum;
  }

  persist() {
    this.saves.store(JSON.stringify(this.save));
  }

  /** Start over: the save wiped, in memory and in the store. */
  reset() {
    for (const key of Object.keys(this.save.lakes)) delete this.save.lakes[key];
    Object.assign(this.save, this.fresh());
    this.saves.clear();
  }
}
