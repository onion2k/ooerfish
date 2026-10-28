/** The town's requests: the letters as the spec has them, and when each is met, as pure sums over a save. */
import { describe, expect, it } from 'vitest';
import { KINDS } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import type { LakeSave, Save } from '../src/progress';
import { REQUESTS, REQUEST_RULES, requestNamed } from '../src/town/requests';
import { TOWN } from '../src/town/town';

const entry = (over: Partial<LakeSave> = {}): LakeSave => ({ cured: 0, drums: 0, journal: {}, found: [], ...over });
const saveOf = (lakes: Record<string, LakeSave>): Save => ({
  lake: HOME.id,
  lakes,
  day: 1,
  time: 0.25,
  place: 'pond',
  requests: [],
});
const met = (id: string, save: Save) => requestNamed(id)!.met(save, LAKES);
const caught = (best = 1) => ({ caught: 1, best, first: 1 });

describe('the town', () => {
  it('is Brightwater, with its people by role, each named and with a line', () => {
    expect(TOWN.name).toBe('Brightwater');
    expect(Object.keys(TOWN.people).sort()).toEqual(
      ['postmistress', 'engineer', 'baker', 'club', 'mayor', 'fisherman', 'rival', 'ducks'].sort(),
    );
    expect(TOWN.people.postmistress.name).toBe('Mrs Ida Penny');
    expect(TOWN.people.engineer.name).toBe('Wendell Fisk');
    expect(TOWN.people.baker.name).toBe('Marigold Bunn');
    expect(TOWN.people.club.name).toBe('the Glow-Worms');
    expect(TOWN.club.writer).toBe('Pip (age 9)');
    expect(TOWN.people.mayor.name).toBe('Mayor Hubert Quill');
    expect(TOWN.people.fisherman.name).toBe('Old Ned');
    expect(TOWN.people.rival.name).toBe('Flo Keel');
    expect(TOWN.people.ducks.name).toBe('the Mallards');
    for (const p of Object.values(TOWN.people)) expect(p.line.length).toBeGreaterThan(10);
  });
});

describe('the requests', () => {
  it('are the four, in order, each id once, each from a person of the town', () => {
    expect(REQUESTS.map((r) => r.id)).toEqual(['ducks', 'rainbow', 'biggest', 'pink']);
    expect(new Set(REQUESTS.map((r) => r.id)).size).toBe(REQUESTS.length);
    expect(requestNamed('ducks')).toBe(REQUESTS[0]);
    expect(requestNamed('nope')).toBeUndefined();
    expect(REQUESTS.map((r) => r.from)).toEqual(['Ida Penny', 'Pip and the Glow-Worms', 'Flo Keel', 'Marigold Bunn']);
    expect(REQUESTS.map((r) => r.role)).toEqual(['ducks', 'club', 'rival', 'baker']);
  });

  it('say the spec’s words, word for word', () => {
    expect(requestNamed('ducks')!.asks).toBe(
      'Dear neighbour, The Mallards have asked me to write, since a duck cannot hold a pen. They would like the Duck Pond back the way it was, clear to the bottom, and they will come home the day it is. No hurry, they say; the reeds up the hill are comfortable enough. Yours, Ida Penny, Postmistress.',
    );
    expect(requestNamed('ducks')!.reply).toBe(
      'The Mallards are back, all seven, and have been round the pond twice to check it. Thank you from all of us at the post office. Ida.',
    );
    expect(requestNamed('rainbow')!.asks).toBe(
      'Dear Fisher, We are the Glow-Worms and we are making a RAINBOW for the school hall, and we need one fish of every kind that glows. You do not have to keep them. Just catch them and we will draw them. Please. From Pip (age 9) and the Glow-Worms.',
    );
    expect(requestNamed('rainbow')!.reply).toBe(
      'WE DREW THEM ALL. The rainbow is on the wall by the coats and Miss says it is the best one yet. Thank you from Pip and everybody.',
    );
    expect(requestNamed('biggest')!.asks).toBe(
      'Dear Rival, Old Ned says the biggest fish in the Duck Pond is his, from nineteen fifty-something. I say it is still in there. Land one over three and a half kilos and I will buy the buns. No rush. Fish do not read calendars. Flo Keel.',
    );
    expect(requestNamed('biggest')!.reply).toBe(
      'Three and a half! I have told Ned and he has gone quiet. The buns are at the bakery with your name on them. Flo.',
    );
  });

  it('say the baker’s words, word for word', () => {
    expect(requestNamed('pink')!.asks).toBe(
      'Dear Early Riser, There is a fish in the Reservoir that glows pink, and it only comes up at dawn, which is when I am up anyway. Catch me one and I will pay in pies. Any morning will do. Marigold Bunn, the bakery.',
    );
    expect(requestNamed('pink')!.reply).toBe(
      'A PINK one! I have put a pie in the window with your name on it, and another behind the counter in case. Marigold.',
    );
  });

  it('hold the rival to three and a half kilos', () => {
    expect(REQUEST_RULES.biggest.kg).toBe(3.5);
  });
});

describe('the ducks are met when the Duck Pond is clean', () => {
  const clean = { cured: HOME.toClean, drums: HOME.drums.count };

  it('with every fish cured and every drum hauled, and not one short of either', () => {
    expect(met('ducks', saveOf({ [HOME.id]: entry(clean) }))).toBe(true);
    expect(met('ducks', saveOf({ [HOME.id]: entry({ ...clean, cured: HOME.toClean - 1 }) }))).toBe(false);
    expect(met('ducks', saveOf({ [HOME.id]: entry({ ...clean, drums: HOME.drums.count - 1 }) }))).toBe(false);
    expect(met('ducks', saveOf({ [HOME.id]: entry() }))).toBe(false);
  });

  it('is false without an entry for the pond, and is the pond’s whatever lake is cleaned', () => {
    expect(met('ducks', saveOf({}))).toBe(false);
    const other = Object.keys(LAKES).find((id) => id !== HOME.id)!;
    expect(met('ducks', saveOf({ [other]: entry({ cured: 99, drums: 99 }) }))).toBe(false);
  });
});

describe('the rainbow is met when every kind has been caught', () => {
  const every = Object.fromEntries(KINDS.map((k) => [k.id, caught()]));
  const [first, ...rest] = KINDS;
  const other = Object.keys(LAKES).find((id) => id !== HOME.id)!;

  it('in one journal, and not with a kind missing', () => {
    expect(met('rainbow', saveOf({ [HOME.id]: entry({ journal: every }) }))).toBe(true);
    const missing = Object.fromEntries(rest.map((k) => [k.id, caught()]));
    expect(met('rainbow', saveOf({ [HOME.id]: entry({ journal: missing }) }))).toBe(false);
    expect(met('rainbow', saveOf({ [HOME.id]: entry() }))).toBe(false);
  });

  it('over two lakes together', () => {
    const save = saveOf({
      [HOME.id]: entry({ journal: { [first.id]: caught() } }),
      [other]: entry({ journal: Object.fromEntries(rest.map((k) => [k.id, caught()])) }),
    });
    expect(met('rainbow', save)).toBe(true);
    save.lakes[other].journal = Object.fromEntries(rest.slice(1).map((k) => [k.id, caught()]));
    expect(met('rainbow', save)).toBe(false);
  });

  it('counts a kind only when something was caught of it', () => {
    const zero = Object.fromEntries(KINDS.map((k) => [k.id, { caught: 0, best: 0, first: 0 }]));
    expect(met('rainbow', saveOf({ [HOME.id]: entry({ journal: zero }) }))).toBe(false);
  });
});

describe('the biggest is met by a best at or over the rival’s weight', () => {
  const withBest = (best: number, id = HOME.id) =>
    saveOf({ [id]: entry({ journal: { pike: { caught: 1, best, first: 1 } } }) });

  it('at 3.5 and not at 3.49', () => {
    expect(met('biggest', withBest(3.5))).toBe(true);
    expect(met('biggest', withBest(3.49))).toBe(false);
    expect(met('biggest', withBest(4.9))).toBe(true);
    expect(met('biggest', saveOf({ [HOME.id]: entry() }))).toBe(false);
  });

  it('in any lake’s journal', () => {
    const other = Object.keys(LAKES).find((id) => id !== HOME.id)!;
    expect(met('biggest', withBest(3.5, other))).toBe(true);
  });
});

describe('the predicates', () => {
  it('are pure: asking changes neither the save nor the answer', () => {
    const save = saveOf({
      [HOME.id]: entry({ cured: 12, drums: HOME.drums.count, journal: { pike: caught(4) } }),
    });
    const before = JSON.stringify(save);
    for (const r of REQUESTS) expect(r.met(save, LAKES)).toBe(r.met(save, LAKES));
    expect(JSON.stringify(save)).toBe(before);
  });
});

describe('the baker’s letter is met by a dawn fish caught', () => {
  const other = Object.keys(LAKES).find((id) => id !== HOME.id)!;

  it('in any lake’s journal, and not by another kind or a count of nought', () => {
    expect(met('pink', saveOf({ [other]: entry({ journal: { dawnfish: caught() } }) }))).toBe(true);
    expect(met('pink', saveOf({ [HOME.id]: entry({ journal: { dawnfish: caught() } }) }))).toBe(true);
    expect(met('pink', saveOf({ [HOME.id]: entry({ journal: { pike: caught(), eel: caught() } }) }))).toBe(false);
    expect(met('pink', saveOf({ [HOME.id]: entry({ journal: { dawnfish: { caught: 0, best: 0, first: 0 } } }) }))).toBe(
      false,
    );
    expect(met('pink', saveOf({ [HOME.id]: entry() }))).toBe(false);
  });
});
