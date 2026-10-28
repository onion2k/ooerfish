import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { depthRange } from '../src/fish';
import { fightFor, gearFor } from '../src/fight';
import { HOME } from '../src/lakes';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { newGame, settle } from './helpers';

const DECK = HOME.jetty!.deck;
const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };
const bedDepth = HOME.bedDepth;
const contaminationAfter = HOME.contaminationAfter;
const inside = HOME.inside;

describe('what must always hold', () => {
  it('holds of a new lake, and of one played a while', () => {
    const { game } = newGame();
    expect(checkInvariants(game)).toEqual([]);
    settle(game);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports a fish on the jetty’s deck as out of the water, with no rule of its own', () => {
    const { game } = newGame();
    game.fish.x[0] = DECK.x + DECK.inward[0] * 6;
    game.fish.y[0] = DECK.y + DECK.inward[1] * 6;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is out of the water/);
  });

  it('reports gear that is not what the count cured earns, and a zone that is not the gear’s while a fish is on', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 6 }));
    expect(checkInvariants(game)).toEqual([]);
    game.gear = { ...game.gear, rod: false };
    expect(checkInvariants(game).join('\n')).toMatch(/the rod is not held, but 6 cured earns it true/);
    game.gear = { ...game.gear, rod: true, bait: true };
    expect(checkInvariants(game).join('\n')).toMatch(/the bait is held/);
    game.gear = gearFor(6);
    game.bite.gear = gearFor(0);
    expect(checkInvariants(game).join('\n')).toMatch(/the bite has not the gear/);
    game.bite.gear = game.gear;
    game.bite.phase = 'hooked';
    game.bite.fish = game.fish.held = 0;
    game.lure.phase = 'hooked';
    game.lure.at.set([game.fish.x[0], game.fish.y[0], -game.fish.depth[0]]);
    game.line.start(5, fightFor(0.5, 'steady'), () => 0.5);
    expect(checkInvariants(game).join('\n')).toMatch(/the zone is 0.28 wide, the gear's is 0.3/);
  });

  it('reports a time that is not a number, or before the start', () => {
    const { game } = newGame();
    game.t = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/the time is NaN/);
    game.t = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the time is -1/);
  });

  it('reports the fishing gone wrong: the bite, the fish it holds, the lure in its mouth, the line and the bucket', () => {
    // a lake with a fish just hooked, the lure in its mouth
    const hookedLake = () => {
      const { game } = newGame(1);
      game.cast(Math.PI / 2, 0.62);
      for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(1 / 60);
      expect(game.strike()).toBe('hooked');
      game.step(1 / 60);
      expect(checkInvariants(game)).toEqual([]);
      return game;
    };
    const broken = (meddle: (g: ReturnType<typeof hookedLake>) => void) => {
      const game = hookedLake();
      meddle(game);
      return checkInvariants(game).join('\n');
    };
    expect(broken((g) => (g.bite.phase = 'gnawing' as never))).toMatch(/the bite is gnawing/);
    expect(broken((g) => (g.fish.held = -1))).toMatch(/but the school holds fish -1/);
    expect(broken((g) => (g.bite.fish = 99))).toMatch(/with fish 99/);
    expect(broken((g) => (g.lure.at[0] += 3))).toMatch(/from the lure in its mouth/);
    expect(broken((g) => (g.lure.phase = 'sinking'))).toMatch(/but the lure is sinking/);
    expect(broken((g) => (g.line.tension = Number.NaN))).toMatch(/tension is NaN/);
    expect(broken((g) => (g.line.tension = -0.1))).toMatch(/tension is -0.1/);
    expect(broken((g) => (g.line.out = 1000))).toMatch(/line out is 1000/);
    expect(broken((g) => (g.line.zone = 0.9))).toMatch(/the zone is at 0.9/);
    expect(broken((g) => (g.line.zone = Number.NaN))).toMatch(/the zone is at NaN/);
    expect(broken((g) => (g.line.fishAt = 1.2))).toMatch(/the fish is at 1.2 on the bar/);
    expect(broken((g) => (g.line.meter = -0.1))).toMatch(/the meter is at -0.1/);
    expect(broken((g) => (g.bucket = -1))).toMatch(/the bucket holds -1/);
    // and with no fish at the lure, none held
    const { game } = newGame();
    game.fish.held = 2;
    expect(checkInvariants(game).join('\n')).toMatch(/no fish is at the lure, but the school holds fish 2/);
  });

  it('reports a fish whose body, as it is drawn, stays in the water however it pitches, and reports a stroke that is not a number', () => {
    const { game } = newGame();
    settle(game, 30);
    expect(checkInvariants(game)).toEqual([]);
    game.fish.phase[1] = Number.NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 1's stroke is not a number/);
    game.fish.phase[1] = 0;
    // a fish sinking fast in the shallows, where a pitch as steep as it may have in the deep would lift its tail out
    let x = 0;
    while (!(bedDepth(x, 0) < 0.5 && inside(x, 0))) x += 0.05;
    game.fish.x[0] = x;
    game.fish.y[0] = 0;
    game.fish.heading[0] = 0;
    game.fish.depth[0] = depthRange(x, 0, HOME)[0];
    game.fish.rise[0] = -10;
    expect(checkInvariants(game)).toEqual([]);
    game.fish.rise[0] = 10;
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports the cured fish not matching the save, and a cured fish that is the bite’s', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 3 }));
    expect(checkInvariants(game)).toEqual([]);
    game.fish.cured[5] = 1;
    expect(checkInvariants(game).join('\n')).toMatch(/4 fish are cured, but the save says 3/);
    game.fish.cured[5] = 0;
    game.fish.cured[0] = 0;
    expect(checkInvariants(game).join('\n')).toMatch(/2 fish are cured, but the save says 3/);
    game.fish.cured[0] = 1;
    expect(checkInvariants(game)).toEqual([]);
    // a save past the pond's size means all of them
    const full = newGame(1, JSON.stringify({ cured: 99 })).game;
    expect(checkInvariants(full)).toEqual([]);
    full.fish.cured[2] = 0;
    expect(checkInvariants(full).join('\n')).toMatch(/11 fish are cured, but the save says 99/);
    // and a cured fish coming to the lure
    const { game: g } = newGame(1, JSON.stringify({ cured: 1 }));
    g.lure.phase = 'sinking';
    g.bite.phase = 'coming';
    g.bite.fish = 0;
    g.fish.held = 0;
    expect(checkInvariants(g).join('\n')).toMatch(/fish 0 is cured, but it is the bite's \(coming\)/);
  });
});

describe('the water the page shows', () => {
  it('is within nought and one', () => {
    const { game } = newGame();
    game.waterDirt = 1.5;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt is 1.5/);
    game.waterDirt = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt is NaN/);
  });
  it('is never cleaner than the truth', () => {
    const { game } = newGame();
    game.contamination = 0.5;
    game.waterDirt = 0.4;
    expect(checkInvariants(game).join('\n')).toMatch(/the water is cleaner than the lake/);
  });
  it('never rises unless the lever was set', () => {
    // twelve cured and no drum hauled leaves a quarter of the dirt, which is the formula's, so only the rise is wrong
    const { game } = newGame(1, '{"cured": 12}');
    expect(game.contamination).toBe(0.25);
    game.waterDirt = 0.6;
    expect(checkInvariants(game)).toEqual([]);
    game.waterDirt = 0.7;
    expect(checkInvariants(game).join('\n')).toMatch(/the water's dirt rose from 0.6 to 0.7, and no lever was set/);
    game.setContamination(0.9);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('the drums of waste', () => {
  it('holds the drums hauled to the save, and to none or the pond’s', () => {
    const { game } = newGame();
    expect(checkInvariants(game)).toEqual([]);
    game.drums.find(0);
    expect(checkInvariants(game).join('\n')).toMatch(/1 drums are hauled, but the save says 0/);
    game.progress.entry(game.lake.id).drums = 1;
    game.contamination = contaminationAfter(0, 1);
    game.waterDirt = game.contamination;
    expect(checkInvariants(game)).toEqual([]);
    game.progress.entry(game.lake.id).drums = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the save says -1 drums hauled/);
    game.progress.entry(game.lake.id).drums = 1.5;
    expect(checkInvariants(game).join('\n')).toMatch(/the save says 1.5 drums hauled/);
  });

  it('never has a hauled drum as the bite’s', () => {
    const { game } = newGame();
    game.drums.find(1);
    game.progress.entry(game.lake.id).drums = 1;
    game.contamination = game.waterDirt = contaminationAfter(0, 1);
    game.bite.drum = 1;
    game.bite.phase = 'biting';
    game.lure.phase = 'sinking';
    expect(checkInvariants(game).join('\n')).toMatch(/drum 1 is hauled, but it is the bite's/);
  });

  it('keeps the quarry to a fish or a drum, and none with the bite at rest', () => {
    const { game } = newGame();
    game.bite.drum = 0;
    expect(checkInvariants(game).join('\n')).toMatch(/no drum is at the lure, but the bite has drum 0/);
    game.bite.phase = 'biting';
    game.bite.fish = 2;
    game.lure.phase = 'sinking';
    expect(checkInvariants(game).join('\n')).toMatch(/with drum 0 and fish 2/);
    game.bite.fish = -1;
    game.bite.drum = 9;
    expect(checkInvariants(game).join('\n')).toMatch(/the bite has drum 9, of 2/);
  });

  it('holds the contamination to the formula for the fish cured and the drums hauled, unless the lever set it', () => {
    const { game } = newGame(1, '{"cured": 3, "drums": 1}');
    expect(checkInvariants(game)).toEqual([]);
    game.contamination = game.waterDirt = 0.3;
    expect(checkInvariants(game).join('\n')).toMatch(/the contamination is 0.3, but 3 cured and 1 hauled make it/);
    game.setContamination(0.3);
    expect(checkInvariants(game), 'the lever may put it anywhere').toEqual([]);
  });
});

describe('the journal', () => {
  const journalGame = (save: object) => newGame(1, JSON.stringify(save)).game;
  const bad = (game: ReturnType<typeof journalGame>) => checkInvariants(game).join('\n');

  it('holds of a journal the load made, whole or with an old save’s leftover', () => {
    const journal = { perch: { caught: 2, best: 1, first: 1 }, bream: { caught: 1, best: 0.5, first: 2 } };
    expect(checkInvariants(journalGame({ cured: 3, day: 2, journal }))).toEqual([]);
    expect(
      checkInvariants(journalGame({ cured: 7, day: 2, journal })),
      'four the journal does not account for',
    ).toEqual([]);
    expect(checkInvariants(journalGame({ cured: 5 })), 'an old save with none').toEqual([]);
  });

  it('holds each kind’s cured fish to the journal’s count of it, when the journal accounts for every cure', () => {
    const game = journalGame({ cured: 3, day: 2, journal: { pike: { caught: 3, best: 3, first: 1 } } });
    // move a cure from a pike to a perch: the total still agrees with the save, the kinds do not
    const pike = Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => game.fish.kind[i] === 2);
    const perch = Array.from({ length: game.fish.count }, (_, i) => i).find((i) => game.fish.kind[i] === 1)!;
    game.fish.cured[pike[0]] = 0;
    game.fish.cured[perch] = 1;
    expect(bad(game)).toMatch(/pike: 2 fish are cured, but the journal says 3 caught of 3 slots/);
    expect(bad(game)).toMatch(/perch: 1 fish are cured, but the journal says 0 caught/);
  });

  it('lets a kind hold more cured fish than the journal says only where the journal accounts for fewer than were cured', () => {
    const game = journalGame({ cured: 6, day: 2, journal: { pike: { caught: 1, best: 3, first: 1 } } });
    expect(checkInvariants(game)).toEqual([]);
    // but never fewer than it says
    const pike = Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => game.fish.kind[i] === 2);
    game.fish.cured[pike[0]] = 0;
    game.fish.cured[
      Array.from({ length: game.fish.count }, (_, i) => i).find((i) => !game.fish.cured[i] && game.fish.kind[i] !== 2)!
    ] = 1;
    expect(bad(game)).toMatch(/pike: 0 fish are cured, but the journal says 1 caught/);
  });

  it('reports a best weight outside its kind’s range, and a best of nought as none', () => {
    const game = journalGame({ cured: 2, day: 2, journal: { bream: { caught: 2, best: 0.5, first: 1 } } });
    game.progress.entry(game.lake.id).journal.bream!.best = 0;
    expect(checkInvariants(game)).toEqual([]);
    game.progress.entry(game.lake.id).journal.bream!.best = 1.5;
    expect(bad(game)).toMatch(/the journal's best bream is 1.5 kg, outside 0.2 to 1/);
    game.progress.entry(game.lake.id).journal.bream!.best = Number.NaN;
    expect(bad(game)).toMatch(/the journal's best bream is NaN kg/);
  });

  it('reports a first day after today, and one that is not a whole number', () => {
    const game = journalGame({ cured: 2, day: 2, journal: { bream: { caught: 2, best: 0.5, first: 2 } } });
    expect(checkInvariants(game)).toEqual([]);
    game.progress.entry(game.lake.id).journal.bream!.first = 3;
    expect(bad(game)).toMatch(/the journal's bream was first caught on day 3, but it is day 2/);
    game.progress.entry(game.lake.id).journal.bream!.first = 1.5;
    expect(bad(game)).toMatch(/the journal's bream was first caught on day 1.5/);
  });

  it('reports more catches than fish cured, a count that is not whole, and a kind not known', () => {
    const game = journalGame({ cured: 2, day: 2, journal: { bream: { caught: 2, best: 0.5, first: 1 } } });
    game.progress.entry(game.lake.id).journal.perch = { caught: 1, best: 1, first: 1 };
    expect(bad(game)).toMatch(/the journal counts 3 caught, but only 2 are cured/);
    game.progress.entry(game.lake.id).journal.perch!.caught = 0.5;
    expect(bad(game)).toMatch(/the journal's perch has caught 0.5/);
    delete game.progress.entry(game.lake.id).journal.perch;
    game.progress.entry(game.lake.id).journal.eel = { caught: 0, best: 0, first: 0 };
    expect(bad(game)).toMatch(/the journal has a kind not known: eel/);
  });
});

describe('the treasures on the bed', () => {
  const bad = (game: ReturnType<typeof newGame>['game']) => checkInvariants(game).join('\n');

  it('holds of a new lake, a load that has found some, and a lake played a while', () => {
    expect(checkInvariants(newGame(1, '{"found": ["lure", "duck"]}').game)).toEqual([]);
    const { game } = newGame(2);
    settle(game, 300);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('holds the ids found to known ones, once each, and no more than there are', () => {
    const { game } = newGame();
    game.progress.entry(game.lake.id).found = ['nope'];
    expect(bad(game)).toMatch(/the save has a treasure not known: nope/);
    game.progress.entry(game.lake.id).found = ['lure', 'lure'];
    expect(bad(game)).toMatch(/the save has the treasure lure twice/);
    game.progress.entry(game.lake.id).found = [...TREASURES.list.map((t) => t.id), 'duck'];
    expect(bad(game)).toMatch(/the save has 7 treasures found, of 6 in the lake/);
  });

  it('holds the treasures found on the bed to the save’s ids', () => {
    const { game } = newGame();
    game.treasures.find(1);
    expect(bad(game)).toMatch(/treasure plush is found, but the save does not say so/);
    game.progress.entry(game.lake.id).found = ['plush'];
    expect(checkInvariants(game)).toEqual([]);
    game.progress.entry(game.lake.id).found = ['duck'];
    expect(bad(game)).toMatch(/treasure duck is in the save, but it is still on the bed/);
  });

  it('never has a found treasure as the bite’s, and the quarry at most one thing', () => {
    const { game } = newGame();
    game.treasures.find(1);
    game.progress.entry(game.lake.id).found = ['plush'];
    game.bite.treasure = 1;
    game.bite.phase = 'biting';
    game.lure.phase = 'sinking';
    expect(bad(game)).toMatch(/treasure 1 is found, but it is the bite's/);
    const two = newGame().game;
    two.bite.phase = 'biting';
    two.lure.phase = 'sinking';
    two.bite.drum = 0;
    two.bite.treasure = 2;
    expect(bad(two)).toMatch(/with drum 0 and treasure 2/);
    const three = newGame().game;
    three.bite.phase = 'biting';
    three.lure.phase = 'sinking';
    three.bite.fish = 1;
    three.bite.treasure = 2;
    expect(bad(three)).toMatch(/with treasure 2 and fish 1/);
    const none = newGame().game;
    none.bite.treasure = 0;
    expect(bad(none)).toMatch(/no treasure is at the lure, but the bite has treasure 0/);
    none.bite.treasure = 9;
    expect(bad(none)).toMatch(/the bite has treasure 9, of 6/);
  });

  it('holds each treasure under the water on the bed, and clear of the drums', () => {
    const { game } = newGame();
    game.treasures.x[0] = 1000;
    expect(bad(game)).toMatch(/treasure 0 is not on the bed under the water/);
    const near = newGame().game;
    near.treasures.x[1] = near.drums.x[0] + 0.5;
    near.treasures.y[1] = near.drums.y[0];
    expect(bad(near)).toMatch(/treasure 1 lies .* from drum 0, under the .* apart/);
    expect(DRUMS.count).toBeGreaterThan(0);
  });

  it('leaves the cleaning to the formula: finding treasures moves nothing of it', () => {
    const { game } = newGame(1, '{"cured": 3, "drums": 1, "found": ["lure", "duck", "bottle"]}');
    expect(game.contamination).toBeCloseTo(contaminationAfter(3, 1), 12);
    expect(checkInvariants(game)).toEqual([]);
    game.contamination = game.waterDirt = contaminationAfter(3, 1) - 0.05;
    expect(bad(game)).toMatch(/the contamination is .*, but 3 cured and 1 hauled make it/);
  });
});

describe('the saved time and place', () => {
  const bad = (game: ReturnType<typeof newGame>['game']) => checkInvariants(game).join('\n');

  it('holds of a new lake and of a cabin save', () => {
    expect(checkInvariants(newGame().game)).toEqual([]);
    expect(checkInvariants(newGame(1, '{"day": 2, "place": "cabin", "time": 0.6}').game)).toEqual([]);
  });

  it('reports a saved time that is not a finite number from nought up to but not reaching one', () => {
    for (const time of [1, -0.1, NaN, Infinity, 1.5]) {
      const { game } = newGame();
      game.progress.save.time = time;
      expect(bad(game), String(time)).toMatch(/the save says the time is/);
    }
  });

  it('reports a saved place that is neither the pond nor the cabin', () => {
    for (const place of ['yawning', 'elsewhere', 3]) {
      const { game } = newGame();
      (game.progress.save as unknown as { place: unknown }).place = place;
      expect(bad(game), String(place)).toMatch(/the save says the player is at/);
    }
  });
});

describe('the save per lake', () => {
  const problems = (game: ReturnType<typeof newGame>['game']) => checkInvariants(game).join('\n');

  it('reports a save at a lake the game does not have', () => {
    const { game } = newGame();
    game.progress.save.lake = 'nowhere';
    expect(problems(game)).toMatch(/the save is at a lake not known: nowhere/);
  });

  it('reports an entry for a lake the game does not have', () => {
    const { game } = newGame();
    game.progress.save.lakes.nowhere = { cured: 0, drums: 0, journal: {}, found: [] };
    expect(problems(game)).toMatch(/an entry for a lake not known: nowhere/);
  });

  it('reports an entry whose counts are not its lake’s: cured, drums past the lake’s, treasures unknown or twice', () => {
    const { game } = newGame();
    const mine = game.progress.entry(game.lake.id);
    mine.drums = HOME.drums.count + 1;
    expect(problems(game)).toMatch(/duckpond has \d+ drums hauled, of/);
    mine.drums = 0;
    mine.found = ['nope'];
    expect(problems(game)).toMatch(/duckpond has treasures found that are not its own, or twice/);
    mine.found = [TREASURES.list[0].id, TREASURES.list[0].id];
    expect(problems(game)).toMatch(/duckpond has treasures found that are not its own, or twice/);
    mine.found = [];
    mine.cured = -1;
    expect(problems(game)).toMatch(/duckpond has -1 cured/);
  });

  it('holds the gear to the fish cured over every lake', () => {
    const { game } = newGame();
    // a second lake in the registry, as the Reservoir will be
    game.progress.lakes.elsewhere = { ...HOME, id: 'elsewhere' };
    game.progress.entry('elsewhere').cured = 6;
    expect(problems(game), 'six cured elsewhere earn gear this game has not been given').toMatch(/cured earns it/);
    game.progress.entry('elsewhere').cured = 0;
    expect(problems(game)).toBe('');
  });

  it('holds the weather to the day’s, unless the lever set it, and to the five kinds', () => {
    const { game } = newGame();
    expect(checkInvariants(game)).toEqual([]);
    // forced past the lever, as a broken rule would: the day is sunny and the weather says rain
    (game as unknown as { weatherLever: string | null }).weatherLever = 'rain';
    expect(checkInvariants(game).join('\n')).toMatch(/the weather is rain, but day 1 is sunny/);
    // the same weather by the lever is the tests' own, and allowed
    const lever = newGame().game;
    expect(lever.setWeather('rain')).toBe(true);
    expect(checkInvariants(lever)).toEqual([]);
    // and a weather that is none of the kinds is caught either way
    (lever as unknown as { weatherLever: string | null }).weatherLever = 'hail';
    expect(checkInvariants(lever).join('\n')).toMatch(/the weather is hail/);
  });
});
