/**
 * The town's requests (`docs/post.md`): a letter each, from someone in Brightwater, and the reply that comes when the
 * player has done what it asked. A request is met by what the save says and never fails: it waits until it is met, and
 * once answered it stays answered. The predicates are pure sums over the save and the lakes, so a load can ask them as
 * well as a stow; the letters are words beside the code, as the radio's gossip is.
 */
import { KINDS } from '../lake';
import type { Lake } from '../lakes/lake';
import { HOME } from '../lakes';
import type { Save } from '../progress';
import type { Role } from './town';

export interface Request {
  id: string;
  /** Who it is from, as the page heads the letter. */
  from: string;
  /** Which of the town's people, by role. */
  role: Role;
  /** The letter. */
  asks: string;
  /** What comes back once it is met. */
  reply: string;
  /** Whether the save meets it, over the lakes the save is read against. */
  met(save: Save, lakes: Record<string, Lake>): boolean;
}

/** The figures the requests ask for: content, and an estimate. A pike runs 1.5 to 5 kg, so 3.5 is a big one and not the biggest. */
export const REQUEST_RULES = { biggest: { kg: 3.5 } } as const;

export const REQUESTS: readonly Request[] = [
  {
    id: 'ducks',
    from: 'Ida Penny',
    role: 'ducks',
    asks: 'Dear neighbour, The Mallards have asked me to write, since a duck cannot hold a pen. They would like the Duck Pond back the way it was, clear to the bottom, and they will come home the day it is. No hurry, they say; the reeds up the hill are comfortable enough. Yours, Ida Penny, Postmistress.',
    reply:
      'The Mallards are back, all seven, and have been round the pond twice to check it. Thank you from all of us at the post office. Ida.',
    // the pond's own entry, whatever lake the player is at, so it holds at a load as it does at a stow
    met: (save, lakes) => {
      if (!Object.hasOwn(save.lakes, HOME.id)) return false;
      const mine = save.lakes[HOME.id];
      const home = Object.hasOwn(lakes, HOME.id) ? lakes[HOME.id] : HOME;
      return mine.cured >= home.toClean && mine.drums >= home.drums.count;
    },
  },
  {
    id: 'rainbow',
    from: 'Pip and the Glow-Worms',
    role: 'club',
    asks: 'Dear Fisher, We are the Glow-Worms and we are making a RAINBOW for the school hall, and we need one fish of every kind that glows. You do not have to keep them. Just catch them and we will draw them. Please. From Pip (age 9) and the Glow-Worms.',
    reply:
      'WE DREW THEM ALL. The rainbow is on the wall by the coats and Miss says it is the best one yet. Thank you from Pip and everybody.',
    met: (save) =>
      KINDS.every((k) => Object.values(save.lakes).some((entry) => (entry.journal[k.id]?.caught ?? 0) >= 1)),
  },
  {
    id: 'biggest',
    from: 'Flo Keel',
    role: 'rival',
    asks: 'Dear Rival, Old Ned says the biggest fish in the Duck Pond is his, from nineteen fifty-something. I say it is still in there. Land one over three and a half kilos and I will buy the buns. No rush. Fish do not read calendars. Flo Keel.',
    reply:
      'Three and a half! I have told Ned and he has gone quiet. The buns are at the bakery with your name on them. Flo.',
    met: (save) =>
      Object.values(save.lakes).some((entry) =>
        Object.values(entry.journal).some((e) => e !== undefined && e.best >= REQUEST_RULES.biggest.kg),
      ),
  },
];

/** The request with this id, or none. */
export function requestNamed(id: string): Request | undefined {
  return REQUESTS.find((r) => r.id === id);
}
