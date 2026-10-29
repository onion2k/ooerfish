/** The photograph and the album: what is in frame, the words of a row, and the game's keeping and discarding. */
import { Camera } from 'artshape-render/gpu/camera';
import { describe, expect, it } from 'vitest';
import { hourName } from '../src/calendar';
import { Game, type GameEvents } from '../src/game';
import { KINDS, PHOTOS } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { albumWords, inFrame, photoLine, photoWords, type Photo } from '../src/photo';
import { Progress, memoryStore, type Save } from '../src/progress';
import { seeded } from '../src/random';
import { checkInvariants } from '../src/invariants';
import { newGame, settle } from './helpers';

const VIEW = { x: 0, y: 0, z: 0, azimuth: 0.5, polar: 1.2, radius: 40 };
const subjects = (kinds: string[] = [], lit = false) => ({ view: VIEW, kinds, lit });
const photo = (over: Partial<Photo> = {}): Photo => ({
  lake: 'reservoir',
  day: 3,
  time: 0.25,
  weather: 'rain',
  view: VIEW,
  kinds: ['dawnfish', 'pike'],
  lit: false,
  ...over,
});

describe('PHOTOS', () => {
  it('holds the album to twelve, a reach of sixty and a grain held at seven seconds', () => {
    expect(PHOTOS).toEqual({ most: 12, reach: 60, grain: 7 });
  });
});

describe('in frame', () => {
  // a real camera at the origin looking along +x, the way the page's is built
  const cam = new Camera();
  cam.position = [0, 0, 0];
  cam.target = [10, 0, 0];
  cam.aspect = 1.6;
  cam.update();
  const eye: [number, number, number] = [0, 0, 0];
  const at = (x: number, y: number, z: number, reach = 60) => inFrame(cam.viewProjection, eye, x, y, z, reach);

  it('is true for a point ahead of the camera', () => {
    expect(at(20, 0, 0)).toBe(true);
  });
  it('is false for a point behind it', () => {
    expect(at(-20, 0, 0)).toBe(false);
  });
  it('is false for a point outside the clip box, to the side or above', () => {
    expect(at(20, 40, 0)).toBe(false);
    expect(at(20, 0, 40)).toBe(false);
  });
  it('is false for a point beyond the reach, though it is on the screen', () => {
    expect(at(100, 0, 0)).toBe(false);
    expect(at(50, 0, 0, 60)).toBe(true);
  });
  it('is false for a point nearer than the near plane', () => {
    expect(at(0.1, 0, 0)).toBe(false);
  });
});

describe('the words of a row', () => {
  const kinds = KINDS.map((k) => ({ id: k.id, name: k.name }));
  it('names the day, the hour, the lake, the weather and the kinds in frame', () => {
    expect(photoWords(photo(), LAKES, kinds, hourName)).toBe(
      'Day 3, morning at the Reservoir, in rain: a pink dawn fish and a pike.',
    );
  });
  it('says nothing of the weather when it is sunny, and "nothing in particular" with no kind', () => {
    expect(photoWords(photo({ weather: 'sunny', kinds: [] }), LAKES, kinds, hourName)).toBe(
      'Day 3, morning at the Reservoir: nothing in particular.',
    );
  });
  it('joins three kinds as a list', () => {
    expect(photoWords(photo({ kinds: ['bream', 'eel', 'pike'] }), LAKES, kinds, hourName)).toContain(
      'a sunny bream, a lamp eel and a pike.',
    );
  });
  it('says the viewfinder line for the foot', () => {
    expect(photoLine(photo(), LAKES, hourName)).toBe('Day 3, morning, the Reservoir');
  });
  it('names the hour by the clock', () => {
    expect([0, 0.25, 0.5, 0.75, 0.99].map(hourName)).toEqual(['night', 'morning', 'afternoon', 'evening', 'night']);
  });
});

describe('Game.photograph', () => {
  const play = () => {
    const told: string[] = [];
    const events: GameEvents = {
      photographed: (i) => told.push(`photographed ${i}`),
      discarded: (i) => told.push(`discarded ${i}`),
    };
    const store = memoryStore();
    const game = new Game(new Progress(store), { random: seeded(1), events });
    return { game, store, told };
  };
  const saved = (store: { json: string | null }) => (JSON.parse(store.json!) as Save).photos;

  it('keeps the lake, day, time, weather, view, kinds and lit, persists, and tells', () => {
    const { game, store, told } = play();
    game.setTimeOfDay(0.6);
    game.setWeather('fog');
    expect(game.photograph(subjects(['pike'], true))).toBe(true);
    const kept = game.progress.save.photos[0];
    expect(kept).toEqual({
      lake: HOME.id,
      day: 1,
      time: game.timeOfDay,
      weather: 'fog',
      view: VIEW,
      kinds: ['pike'],
      lit: true,
    });
    expect(saved(store)).toEqual([kept]);
    expect(told).toEqual(['photographed 0']);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('keeps each kind once and drops one the lake cannot give', () => {
    const { game } = play();
    game.photograph(subjects(['bream', 'bream', 'nonsuch', 'pike']));
    expect(game.progress.save.photos[0].kinds).toEqual(['bream', 'pike']);
    // the pond has no eel, so one is dropped there
    expect(HOME.fishKinds.some((k) => KINDS[k].id === 'eel')).toBe(false);
    game.photograph(subjects(['eel']));
    expect(game.progress.save.photos[1].kinds).toEqual([]);
  });

  it('refuses the thirteenth, changing nothing and telling nothing', () => {
    const { game, told } = play();
    for (let i = 0; i < PHOTOS.most; i++) expect(game.photograph(subjects())).toBe(true);
    const before = JSON.stringify(game.progress.save);
    expect(game.photograph(subjects())).toBe(false);
    expect(JSON.stringify(game.progress.save)).toBe(before);
    expect(told.length).toBe(PHOTOS.most);
  });

  it('is refused while yawning', () => {
    const { game } = play();
    expect(game.sleep()).toBe(true);
    expect(game.photograph(subjects())).toBe(false);
    expect(game.progress.save.photos).toEqual([]);
  });

  it('is taken in the cabin too', () => {
    const { game } = newGame();
    expect(game.enter()).toBe(true);
    expect(game.photograph(subjects())).toBe(true);
  });
});

describe('Game.discard', () => {
  it('drops one by index, persists and tells; a bad index changes nothing', () => {
    const told: string[] = [];
    const store = memoryStore();
    const game = new Game(new Progress(store), { random: seeded(1), events: { discarded: (i) => told.push(`d${i}`) } });
    game.photograph(subjects(['bream']));
    game.photograph(subjects(['pike']));
    expect(game.discard(2)).toBe(false);
    expect(game.discard(-1)).toBe(false);
    expect(game.discard(0.5)).toBe(false);
    expect(told).toEqual([]);
    expect(game.discard(0)).toBe(true);
    expect(game.progress.save.photos.map((p) => p.kinds)).toEqual([['pike']]);
    expect((JSON.parse(store.json!) as Save).photos.length).toBe(1);
    expect(told).toEqual(['d0']);
  });
});

describe('the album’s section of the journal', () => {
  const kinds = KINDS.map((k) => ({ id: k.id, name: k.name }));
  const words = (photos: Photo[], here = 'reservoir') => albumWords(photos, LAKES, here, kinds, hourName);

  it('is titled, counts n of twelve and has no rows for an empty album', () => {
    expect(words([])).toEqual({ title: 'Photographs', rows: [], count: 'photographs: 0 of 12' });
  });

  it('lists the photographs in order, each with its place and the row’s words', () => {
    const a = photo(),
      b = photo({ day: 4, kinds: [] });
    const page = words([a, b]);
    expect(page.count).toBe('photographs: 2 of 12');
    expect(page.rows.map((r) => r.index)).toEqual([0, 1]);
    expect(page.rows[0].words).toBe(photoWords(a, LAKES, kinds, hourName));
    expect(page.rows[1].words).toContain('Day 4');
  });

  it('offers Look at the lake the page is at, and elsewhere says where it was taken instead', () => {
    const page = words([photo({ lake: 'reservoir' }), photo({ lake: HOME.id })]);
    expect(page.rows.map((r) => r.here)).toEqual([true, false]);
    expect(page.rows[0].words.endsWith('Taken at the Reservoir.')).toBe(false);
    expect(page.rows[1].words.endsWith(' Taken at the Duck Pond.')).toBe(true);
  });

  it('counts out of the album’s limit', () => {
    expect(words(Array.from({ length: PHOTOS.most }, () => photo())).count).toBe('photographs: 12 of 12');
  });
});

describe('Game.lookAt and lookAway', () => {
  const home = (over: Partial<Photo> = {}) => photo({ lake: HOME.id, day: 1, ...over });
  /** A game at the pond with a photograph of its own lake (rain at a quarter past nought) and one of another's. */
  const albumGame = () => {
    const { game } = newGame();
    game.progress.save.photos.push(home({ time: 0.6, weather: 'rain' }), photo({ lake: 'reservoir', day: 1 }));
    return game;
  };

  it('puts the clock and the weather to the photograph’s at the pond and puts them back, the lever untouched', () => {
    const game = albumGame();
    game.setTimeOfDay(0.3);
    const day = game.weather;
    const levers = game.levers;
    expect(game.lookAt(0)).toBe(true);
    expect(game.still?.index).toBe(0);
    expect(game.timeOfDay).toBe(0.6);
    expect(game.weather).toBe('rain');
    expect(game.levers).toBe(levers);
    expect(checkInvariants(game)).toEqual([]);
    expect(game.lookAway()).toBe(true);
    expect(game.still).toBe(null);
    expect(game.timeOfDay).toBe(0.3);
    expect(game.weather).toBe(day);
    expect(game.levers).toBe(levers);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('writes the clock it found, not the photograph’s, if the page saves while a photograph is looked at', () => {
    // the page writes the save when the tab is hidden, which can happen mid-look: a load must land where play was
    const game = albumGame();
    game.setTimeOfDay(0.3);
    game.lookAt(0);
    game.persist();
    expect(game.progress.save.time).toBe(0.3);
    game.lookAway();
    game.persist();
    expect(game.progress.save.time).toBe(0.3);
  });

  it('leaves a weather lever as it found it', () => {
    const game = albumGame();
    game.setWeather('wind');
    game.lookAt(0);
    expect(game.weather).toBe('rain');
    game.lookAway();
    expect(game.weather).toBe('wind');
  });

  it('holds the cabin’s clock', () => {
    const game = albumGame();
    game.setTimeOfDay(0.3);
    expect(game.enter()).toBe(true);
    expect(game.lookAt(0)).toBe(true);
    expect(game.timeOfDay).toBe(0.3);
    expect(game.lookAway()).toBe(true);
    expect(game.timeOfDay).toBe(0.3);
  });

  it('refuses, and changes nothing, for no photograph, another lake’s, a still already and a fish on the line', () => {
    const game = albumGame();
    for (const i of [-1, 5, 1, 0.5]) expect(game.lookAt(i)).toBe(false);
    expect(game.still).toBe(null);
    expect(game.lookAway()).toBe(false);
    expect(game.lookAt(0)).toBe(true);
    expect(game.lookAt(0)).toBe(false);
    game.lookAway();
    game.bite.phase = 'landed';
    const clock = game.timeOfDay;
    expect(game.lookAt(0)).toBe(false);
    expect(game.still).toBe(null);
    expect(game.timeOfDay).toBe(clock);
  });

  it('holds the game in a step while a still is shown, and refuses the bed and a journey', () => {
    const game = albumGame();
    game.lookAt(0);
    const t = game.t;
    const clock = game.timeOfDay;
    settle(game, 30);
    expect(game.t).toBe(t);
    expect(game.timeOfDay).toBe(clock);
    expect(game.sleep()).toBe(false);
    expect(game.sleepThrough(2)).toBe(false);
    expect(game.travel('reservoir')).toBe(false);
    expect(game.place).toBe('pond');
    game.lookAway();
    settle(game, 30);
    expect(game.t).toBeGreaterThan(t);
  });

  it('cannot begin while yawning', () => {
    const game = albumGame();
    game.sleep();
    expect(game.lookAt(0)).toBe(false);
  });
});
