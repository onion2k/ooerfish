/**
 * The radio's words (`docs/radio.md`): what the cabin's wireless says of a morning, a forecast from the day and one line
 * of the town's gossip from the save. Pure sums of the day and the save, so the same morning is the same words and they
 * are tested without a page; the view writes them where they change. Every name and line is a placeholder in the
 * design's roles (the postmistress, the baker, the mayor, the old fisherman and the rest), since the townsfolk are not
 * yet named, and they are words and not content figures, so they sit here beside the function as `CLEAN_WORDS` does.
 */
import { dayHash, moonOf, seasonOf, weatherOf } from './calendar';
import { gearFor } from './fight';
import { CALENDAR, KINDS, MOON, SEASONS } from './lake';
import type { Lake } from './lakes/lake';
import { theLake } from './lakes/page';
import type { LakeSave, Save } from './progress';

/** The station's name, the plant's old one still on the air, a placeholder until the story's words. */
export const STATION = 'Sunny Atom Radio';

/** What the radio says: the forecast and a line of gossip, shown together. */
export interface RadioWords {
  forecast: string;
  gossip: string;
}

/**
 * The forecast for a day. `hour` is the name of the clock's look and only tunes "this morning" against "today" for the
 * fog, since the radio is heard in the cabin at any hour; "tonight" is the moon's, whatever the hour.
 */
export function forecastFor(day: number, hour: string): string {
  const weather = weatherOf(day);
  const season = seasonOf(day);
  let clause: string;
  switch (weather) {
    case 'sunny':
      clause = 'a fine day';
      break;
    case 'rain':
      clause = season === 'winter' ? 'snow today' : 'rain today';
      break;
    case 'fog':
      clause = hour === 'dawn' ? 'fog on the lake this morning' : 'fog on the lake today';
      break;
    case 'shower':
      clause = 'a sun-shower today';
      break;
    case 'wind':
      clause = 'a windy day';
      break;
  }
  const phase = moonOf(day);
  if (phase === MOON.full) clause += ', and the full moon tonight';
  else if (phase === MOON.new) clause += ', and a new moon tonight';
  // a day is a season's first by the calendar's own count, so day 1 is summer's
  const d = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  if ((d - 1) % CALENDAR.seasonDays === 0) clause += `, on the first day of ${season}`;
  return `${STATION} says ${clause}.`;
}

/** A line of gossip: plain words, or words that name the lake, the kind or the treasure the news is about. */
type Line = string | ((name: string) => string);

/**
 * The town's gossip, a few lines a key, picked among by the day's hash so a week of mornings does not repeat. The keys
 * are in the order they are chosen in (`gossipFor`). `found` has a line for each treasure on the pond in the order of its
 * list, and a last one for any other.
 */
export const GOSSIP = {
  clean: [
    (lake: string) => `The ducks are back on ${theLake(lake)}, and the whole town is talking about it.`,
    (lake: string) => `The mayor says ${theLake(lake)} has never looked so clear, and is planning a picnic.`,
    (lake: string) =>
      `The postmistress has had three letters about ${theLake(lake)}, and every one of them says thank you.`,
  ],
  first: [
    (kind: string) =>
      `Word is somebody landed their first ${kind} yesterday. The old fisherman says he is not jealous.`,
    (kind: string) =>
      `The baker heard it from the postmistress that someone caught a ${kind} for the first time yesterday.`,
    (kind: string) => `The children's club are asking everyone about the new ${kind}. Nobody will say who it was.`,
  ],
  found: [
    'The old fisherman has lost a lure, he says, and wonders if anyone has seen it.',
    "The children's club want to know who has their Sunny Atom plush.",
    'The retired plant engineer says a lunchbox like that was last seen in the canteen, years ago.',
    'The mayor wants to know who has the Safety First! badge. It is an honour, he says, to be asked.',
    'The postmistress is sure a message in a bottle is a letter, and would like to read it.',
    "The children's club want to know who has their rubber duck.",
    (thing: string) => `Somebody has found ${thing} in the lake, and the whole street is guessing whose it was.`,
  ],
  drum: [
    'The mayor is pleased to hear a drum of waste came out of the pond.',
    'The retired plant engineer says that drum has been down there longer than he can remember.',
    'The baker says the pond smells better already, and she is not even near it.',
  ],
  gift: [
    "The Sunny Atom has been leaving parcels on somebody's step again.",
    'The postmistress says there is a parcel with no stamp, and she has her suspicions.',
    "The old fisherman's rival has a new bit of kit and will not say where it came from.",
  ],
  rain: ['The baker says it is pie weather.', "The children's club are splashing in every puddle in town."],
  fog: [
    'The postmistress has lost her glasses in the fog.',
    'The mayor walked into the lamp post in the fog, and says it moved.',
  ],
  shower: [
    "The children's club are out looking for the end of the rainbow.",
    'The baker says a sun-shower is a good sign for the buns.',
  ],
  wind: [
    'The postmistress is chasing letters up the high street.',
    "The old fisherman says a wind like this bends a cast, and his rival says it doesn't.",
  ],
  season: [
    'Good fishing weather, they say, and the old fisherman has been out since before breakfast.',
    "The baker says the leaves are turning, and the children's club are saving the best ones.",
    "The mayor has put the town's big scarf on and says the lake looks quiet.",
    'The postmistress says the blossom is out, and the whole street smells of it.',
  ],
} as const satisfies Record<string, readonly Line[]>;

export type GossipKey = keyof typeof GOSSIP;

/** The gossip picked for a morning, and the key it was picked from. */
export interface Gossip {
  key: GossipKey;
  text: string;
}

/**
 * Added to the day before it is hashed for the pick. The weather is drawn from the day's plain hash, so within one kind
 * of weather the hash lies in a narrow band (a fog day's is always the same fifth of the range) and a line chosen by it
 * could never be reached; a salt of its own makes the pick unrelated to the sky.
 */
const PICK_SALT = 0x5bd1e995;

/** A line among a key's by the day's hash, so the choice follows the day and draws no chance. */
function pick(key: GossipKey, day: number, name = ''): Gossip {
  const lines: readonly Line[] = GOSSIP[key];
  const line = lines[Math.floor(dayHash(day + PICK_SALT) * lines.length)];
  return { key, text: typeof line === 'function' ? line(name) : line };
}

/**
 * The most notable thing the save says, and a line of it: a lake clean (the one the player is at first, then the others
 * in the registry's order), a first fish of a kind caught yesterday, the latest treasure found, a drum hauled, a gift
 * held, and failing all of them the weather's gossip or the season's. Read from the save and not from events, so a load
 * shows the same morning; an old save without a journal or finds has none of the first four.
 */
export function gossipFor(day: number, save: Save, lakes: Readonly<Record<string, Lake>>): Gossip {
  // the saves are read as the progress reads them, but a lake or an entry the registry or the save lacks is passed over
  const current = lakes[save.lake] as Lake | undefined;
  const entryOf = (id: string) => save.lakes[id] as LakeSave | undefined;
  const order = current ? [current, ...Object.values(lakes).filter((l) => l !== current)] : Object.values(lakes);

  for (const lake of order) {
    const entry = entryOf(lake.id);
    if (entry && entry.cured >= lake.toClean && entry.drums >= lake.drums.count) return pick('clean', day, lake.name);
  }

  const here = entryOf(save.lake);
  for (const kind of KINDS) {
    const entry = here?.journal[kind.id];
    if (entry && entry.first >= 1 && entry.first === day - 1) return pick('first', day, kind.name);
  }

  if (current && here && here.found.length > 0) {
    const id = here.found[here.found.length - 1];
    const at = current.treasures.list.findIndex((t) => t.id === id);
    const line = GOSSIP.found[at >= 0 ? at : GOSSIP.found.length - 1];
    // a treasure the lake does not list is called by its id, which is all the radio knows of it
    return { key: 'found', text: typeof line === 'function' ? line(`a ${id}`) : line };
  }

  if (here && here.drums > 0) return pick('drum', day);

  let curedTotal = 0;
  for (const entry of Object.values(save.lakes)) curedTotal += entry.cured;
  if (Object.values(gearFor(curedTotal)).some(Boolean)) return pick('gift', day);

  const weather = weatherOf(day);
  if (weather !== 'sunny') return pick(weather, day);

  return { key: 'season', text: GOSSIP.season[SEASONS.indexOf(seasonOf(day))] };
}

/**
 * The radio's words for a morning: the forecast of the day and the gossip of the save. `lakes` is the registry the save
 * is read against; `hour` is the name of the clock's look and only changes "this morning" to "today".
 */
export function radioWords(day: number, save: Save, lakes: Readonly<Record<string, Lake>>, hour: string): RadioWords {
  return { forecast: forecastFor(day, hour), gossip: gossipFor(day, save, lakes).text };
}
