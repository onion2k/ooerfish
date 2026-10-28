/** A fish and the lure: noticed, come to, nibbled, bitten, and struck inside the window or not. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { Game } from '../src/game';
import { Bite } from '../src/bite';
import { HOME } from '../src/lakes';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { FISHING, KIND_INDEX } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, castAtDrum, cureAll, lieByDrum, lieByTreasure } from './helpers';

const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };

const NORTH = Math.PI / 2;

/** How hard a cast due north lands nearest the middle of the lake, from the flight's own sums. */
function powerToMiddle(): number {
  let best = 0,
    gap = Infinity;
  for (let p = 1; p <= 200; p++) {
    const f = flight(NORTH, p / 200);
    const g = Math.hypot(f.landing[0], f.landing[1]);
    if (g < gap) [best, gap] = [p / 200, g];
  }
  return best;
}
const MIDDLE = powerToMiddle();

/** A lake from a seed, with what it tells kept as lines. */
function lake(seed = 1) {
  const told: string[] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: {
      nibbled: () => told.push(`nibbled ${game.t.toFixed(2)}`),
      bitten: () => told.push(`bitten ${game.t.toFixed(2)}`),
      hooked: () => told.push('hooked'),
      missed: () => told.push('missed'),
    },
  });
  return { game, told };
}

/** Steps until `done` says so, at most `seconds`; the frames it took, or -1. */
function until(game: Game, done: () => boolean, seconds: number): number {
  for (let f = 0; f < seconds / DT; f++) {
    if (done()) return f;
    game.step(DT);
  }
  return done() ? Math.round(seconds / DT) : -1;
}

/** A lake with the lure sunk and every fish moved out of reach, so a test places the few it means to. */
function sunk(seed = 1) {
  const { game } = lake(seed);
  game.cast(NORTH, MIDDLE);
  for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
  for (let f = 0; f < 120; f++) game.step(DT);
  expect(game.lure.phase).toBe('sinking');
  // whoever came to the lure while it sank is sent off, and the bite starts clean
  game.bite.stowed(game.fish);
  for (let i = 0; i < game.fish.count; i++) game.fish.x[i] = game.fish.y[i] = 1e6;
  game.fish.held = -1;
  return game;
}

/** Fish `i` set `d` from the bobber, at the lure's depth. */
function put(game: Game, i: number, d: number) {
  game.fish.x[i] = game.lure.bobber[0] + d;
  game.fish.y[i] = game.lure.bobber[1];
  game.fish.depth[i] = game.lure.depth;
}

/** The bite stepped for `seconds` with a chance that always notices, and which fish it chose, or -1. */
function chosenIn(game: Game, seconds = 5): number {
  let t = game.t;
  for (let f = 0; f < seconds / DT; f++) {
    t += DT;
    game.bite.step(t, DT, game.fish, game.lure, () => 0);
    if (game.bite.phase !== 'none') return game.bite.fish;
  }
  return -1;
}

/** The first slot of a kind in the fixed school. */
const slotOf = (game: Game, kind: keyof typeof KIND_INDEX) => game.fish.kind.indexOf(KIND_INDEX[kind]);

/** Fish `i` set `d` from the bobber, at `depth` in the water. */
function putAt(game: Game, i: number, d: number, depth: number) {
  put(game, i, d);
  game.fish.depth[i] = depth;
}

describe('depth and the lure', () => {
  it('narrows the band to a share of the lake, so depth is a choice', () => {
    expect(FISHING.band).toBe(1.5);
  });

  it('brings a bream to a lure in the shallows and not to one at the bed', () => {
    const bream = slotOf(sunk(), 'bream');
    const shallow = sunk();
    shallow.lure.depth = 1;
    putAt(shallow, bream, 2, 1);
    expect(chosenIn(shallow)).toBe(bream);
    const deep = sunk();
    deep.lure.depth = 5;
    putAt(deep, bream, 2, 1);
    expect(chosenIn(deep, 60)).toBe(-1);
  });

  it('brings a pike to a lure at the bed and not to one in the shallows', () => {
    const pike = slotOf(sunk(), 'pike');
    const deep = sunk();
    deep.lure.depth = 5;
    putAt(deep, pike, 2, 4.5);
    expect(chosenIn(deep)).toBe(pike);
    const shallow = sunk();
    shallow.lure.depth = 1;
    putAt(shallow, pike, 2, 4.5);
    expect(chosenIn(shallow, 60)).toBe(-1);
  });

  it('never brings a cured fish of any kind, in its own band', () => {
    for (const kind of ['bream', 'perch', 'pike'] as const) {
      const game = sunk();
      const i = slotOf(game, kind);
      putAt(game, i, 1, game.lure.depth);
      game.fish.cured[i] = 1;
      expect(chosenIn(game, 60), kind).toBe(-1);
    }
  });

  it('takes the nearest of two fish in the band, and passes over a nearer one out of it', () => {
    const game = sunk();
    game.lure.depth = 3;
    putAt(game, 0, 4, 3);
    putAt(game, 1, 2, 3);
    expect(chosenIn(game)).toBe(1);
    const other = sunk();
    other.lure.depth = 3;
    putAt(other, 0, 4, 3);
    putAt(other, 1, 2, 3 + FISHING.band + 0.5);
    expect(chosenIn(other)).toBe(0);
  });
});

describe('a cured fish and the lure', () => {
  it('is never chosen over a glowing fish further off, with and without a twitch', () => {
    for (const twitch of [false, true]) {
      const game = sunk();
      put(game, 0, 0.5);
      game.fish.cured[0] = 1;
      put(game, 1, 3);
      if (twitch) expect(game.strike()).toBe('twitch');
      expect(chosenIn(game), `twitch ${twitch}`).toBe(1);
    }
  });

  it('draws no chance for a cured fish', () => {
    const game = sunk();
    put(game, 0, 0.5);
    game.fish.cured[0] = 1;
    let draws = 0;
    game.bite.step(game.t + DT, DT, game.fish, game.lure, () => (draws++, 1));
    expect(draws).toBe(0);
  });

  it('never bites in a pond where every fish is cured, however long the lure sinks', () => {
    const game = sunk();
    game.fish.cured.fill(1, 0, game.fish.count);
    put(game, 0, 0.5);
    put(game, 1, 1);
    expect(chosenIn(game, 600)).toBe(-1);
    expect(game.bite.phase).toBe('none');
  });
});

describe('a fish and the lure', () => {
  it('comes, nibbles and bites a lure sunk in the middle of the lake within a minute, on every seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { game, told } = lake(seed);
      game.cast(NORTH, MIDDLE);
      const took = until(game, () => game.bite.phase === 'biting', 60);
      expect(took, `seed ${seed}: a bite within a minute`).toBeGreaterThanOrEqual(0);
      // it came first, then nibbled once to three times, then bit
      const nibbles = told.filter((l) => l.startsWith('nibbled')).length;
      expect(nibbles, `seed ${seed}`).toBeGreaterThanOrEqual(FISHING.nibbles[0]);
      expect(nibbles, `seed ${seed}`).toBeLessThanOrEqual(FISHING.nibbles[1]);
      expect(told.at(-1)).toMatch(/^bitten/);
      // and the fish biting is at the lure
      const i = game.bite.fish;
      const gap = Math.hypot(game.fish.x[i] - game.lure.bobber[0], game.fish.y[i] - game.lure.bobber[1]);
      expect(gap, `seed ${seed}: the biting fish at the lure`).toBeLessThan(FISHING.mouth + 0.2);
    }
  });

  it('never bites a lure on the bank, in the air or on the rod', () => {
    const { game } = lake(2);
    expect(
      until(game, () => game.bite.phase !== 'none', 30),
      'on the rod',
    ).toBe(-1);
    game.cast(-NORTH, 0.6);
    expect(
      until(game, () => game.bite.phase !== 'none', 60),
      'on the bank',
    ).toBe(-1);
    expect(game.lure.phase).toBe('lying');
  });

  it('lets one fish come at a time, however many are near, and the rest swim on', () => {
    const { game } = lake(3);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.lure.phase === 'sinking', 5);
    // every fish put right by the lure
    for (let i = 0; i < game.fish.count; i++) {
      game.fish.x[i] = game.lure.bobber[0] + (i - 2.5) * 0.8;
      game.fish.y[i] = game.lure.bobber[1] + 1.5;
    }
    until(game, () => game.bite.phase !== 'none', 30);
    expect(game.bite.phase).not.toBe('none');
    expect(game.fish.held).toBe(game.bite.fish);
    const others = Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => i !== game.bite.fish);
    const before = others.map((i) => game.fish.x[i]);
    game.step(DT * 30);
    expect(
      others.some((i, k) => game.fish.x[i] !== before[k]),
      'the others swim on',
    ).toBe(true);
  });

  it('opens a window of its length to the frame, hooked by a strike inside it', () => {
    const { game, told } = lake(4);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.bite.phase === 'biting', 60);
    const frames = until(game, () => game.bite.phase !== 'biting', 5);
    expect(frames).toBe(Math.round(FISHING.window / DT));
    expect(told.at(-1), 'let go once the window shut').toBe('missed');
    // and a fresh bite struck just before its window shuts is hooked
    const again = lake(4);
    again.game.cast(NORTH, MIDDLE);
    until(again.game, () => again.game.bite.phase === 'biting', 60);
    for (let f = 0; f < Math.round(FISHING.window / DT) - 2; f++) again.game.step(DT);
    expect(again.game.strike()).toBe('hooked');
    expect(again.game.bite.phase).toBe('hooked');
    expect(again.told.at(-1)).toBe('hooked');
  });

  it('is not hooked by a strike while it only nibbles: it lets go, wary, and swims off', () => {
    const { game, told } = lake(5);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.bite.phase === 'nibbling', 60);
    const i = game.bite.fish;
    expect(game.strike()).toBe('spooked');
    expect(game.bite.phase).toBe('none');
    expect(game.fish.held).toBe(-1);
    expect(told.at(-1)).toBe('missed');
    // it does not come straight back
    expect(until(game, () => game.bite.phase !== 'none' && game.bite.fish === i, FISHING.wary - 1)).toBe(-1);
  });

  it('lets go when the lure is reeled in or a pebble splashes by it', () => {
    for (const how of ['reel', 'pebble'] as const) {
      const { game } = lake(6);
      game.cast(NORTH, MIDDLE);
      until(game, () => game.bite.phase === 'coming', 60);
      if (how === 'reel') game.reelIn();
      else game.drop(game.lure.bobber[0] + 1, game.lure.bobber[1]);
      expect(game.bite.phase, how).toBe('none');
      expect(game.fish.held, how).toBe(-1);
    }
  });

  it('is drawn in sooner by a twitch of the lure: a strike with no fish at it', () => {
    // over many seeds, how many have a fish notice the lure within half a second of its landing, twitched or not
    const noticed = (twitching: boolean) => {
      let n = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const { game } = lake(seed);
        game.cast(NORTH, MIDDLE);
        until(game, () => game.lure.phase === 'sinking', 5);
        if (twitching) expect(game.strike()).toBe('twitch');
        if (until(game, () => game.bite.phase !== 'none', 0.5) >= 0) n++;
      }
      return n;
    };
    const plain = noticed(false),
      twitched = noticed(true);
    // with the band narrowed fewer fish are in the water the lure is in as it lands, so the twitch has fewer to draw
    expect(twitched, `${twitched} seeds twitched against ${plain}`).toBeGreaterThan(plain * 1.3);
  });

  it('does nothing to a strike with the lure out of the water', () => {
    const { game } = lake(7);
    expect(game.strike()).toBe('none');
    game.cast(-NORTH, 0.6);
    until(game, () => game.lure.phase === 'lying', 5);
    expect(game.strike()).toBe('none');
  });

  it('is the same from the same seed', () => {
    const run = () => {
      const { game, told } = lake(8);
      game.cast(NORTH, MIDDLE);
      until(game, () => game.bite.phase === 'biting', 60);
      return told.join('|');
    };
    expect(run()).toBe(run());
  });
});

describe('a fish that cannot find its way', () => {
  it('gives up coming to the lure, quietly, keeps away a while, and leaves the lure to another', () => {
    // the state seed 36 reached under the pace gate's angler: a fish swimming a loop by the east boulder that never
    // reached the lure, which held the lure from every other fish for minutes; the steering draws no chance, so it loops
    // the same from here every time
    const { game, told } = lake(1);
    game.cast(NORTH, MIDDLE);
    for (let f = 0; f < 120; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    const i = 4;
    game.lure.bobber[0] = game.lure.at[0] = 6.252681736603605;
    game.lure.bobber[1] = game.lure.at[1] = -1.029073577945205;
    game.fish.x[i] = 15.027351267441663;
    game.fish.y[i] = -13.90675056489785;
    game.fish.heading[i] = 2.764421643383866;
    game.fish.depth[i] = 0.8299177338249425;
    Object.assign(game.bite, { phase: 'coming', fish: i, comingSince: game.t });
    game.fish.held = i;
    const from = game.t;
    let gaveUp = -1;
    for (let f = 0; f < (FISHING.comeLongest + 5) / DT && gaveUp < 0; f++) {
      game.step(DT);
      if (game.bite.fish !== i) gaveUp = game.t - from;
    }
    expect(gaveUp, 'it gave up').toBeGreaterThan(0);
    expect(gaveUp).toBeCloseTo(FISHING.comeLongest, 1);
    expect(game.fish.held === i).toBe(false);
    expect(game.bite.wary[i]).toBeGreaterThan(game.t);
    expect(
      told.filter((l) => l === 'missed'),
      'a fish that never reached the lure is not told as missed',
    ).toEqual([]);
  });
});

describe('the bite, seen', () => {
  /** A lake whose every splash and strike is told, with the time it was told. */
  function telling(seed: number) {
    const told: string[] = [];
    const game = new Game(new Progress(memoryStore()), {
      random: seeded(seed),
      events: {
        splashed: (x, y, size) => told.push(`splashed ${x.toFixed(3)} ${y.toFixed(3)} ${size}`),
        nibbled: () => told.push('nibbled'),
        bitten: () => told.push('bitten'),
        struck: (did) => told.push(`struck ${did}`),
        missed: () => told.push('missed'),
      },
    });
    return { game, told };
  }

  it('rings the water at the bobber at each nibble, and bigger at the bite, without scaring the fish off', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, told } = telling(seed);
      game.cast(NORTH, MIDDLE);
      for (let f = 0; f < 60 / DT && game.bite.phase !== 'biting'; f++) game.step(DT);
      expect(game.bite.phase, `seed ${seed}`).toBe('biting');
      const at = `${game.lure.bobber[0].toFixed(3)} ${game.lure.bobber[1].toFixed(3)}`;
      // every nibble and the bite is followed at once by its ring, where the bobber is
      for (let k = 0; k < told.length; k++) {
        if (told[k] === 'nibbled') expect(told[k + 1], `seed ${seed}`).toBe(`splashed ${at} ${FISHING.nibbleRing}`);
        if (told[k] === 'bitten') expect(told[k + 1], `seed ${seed}`).toBe(`splashed ${at} ${FISHING.biteRing}`);
      }
      expect(FISHING.biteRing).toBeGreaterThan(FISHING.nibbleRing);
      // the rings are on the water, in the pool the ripples are drawn from
      const sizes = Array.from(game.splashes.size.slice(0, game.splashes.count));
      expect(sizes).toContain(FISHING.biteRing);
      // and the fish bit through them, still there to be struck
      expect(told).not.toContain('missed');
      expect(game.strike()).toBe('hooked');
    }
  });

  it('tells what each strike did: a twitch with no fish, too soon at a nibble, hooked at the bite', () => {
    const { game, told } = telling(3);
    // the moment with no fish there is made, not hoped for: all but one fish cured, and that one kept far from the lure
    game.fish.cured.fill(1, 0, game.fish.count);
    game.cast(NORTH, MIDDLE);
    // long enough for the lure to reach the line's depth, where the fish are then put
    for (let f = 0; f < 480; f++) game.step(DT);
    expect(game.bite.phase).toBe('none');
    // then one is glowing again and comes to the lure, the only fish that can
    game.fish.cured[0] = 0;
    game.fish.x[0] = game.lure.bobber[0] + 3;
    game.fish.y[0] = game.lure.bobber[1];
    game.fish.depth[0] = game.lure.depth;
    game.strike();
    expect(told.at(-1)).toBe('struck twitch');
    for (let f = 0; f < 60 / DT && game.bite.phase !== 'nibbling'; f++) game.step(DT);
    game.strike();
    expect(told.slice(-2)).toEqual(['missed', 'struck spooked']);
    // the one glowing fish has fled and is wary, so another is let loose at the lure for the bite
    game.fish.cured[1] = 0;
    game.fish.x[1] = game.lure.bobber[0] + 3;
    game.fish.y[1] = game.lure.bobber[1];
    // held in the lure's water until it comes, as the wander would carry it back to its own
    for (let f = 0; f < 120 / DT && game.bite.phase !== 'biting'; f++) {
      if (game.bite.phase === 'none') game.fish.depth[1] = game.lure.depth;
      game.step(DT);
    }
    game.strike();
    expect(told.at(-1)).toBe('struck hooked');
  });
});

describe('a drum on the bed and the lure', () => {
  /** A pond with every fish cured, the lure lying on the bed beside drum `i`, and the bite not yet stepped. */
  function beside(i = 0, seed = 1) {
    const { game } = lake(seed);
    cureAll(game);
    lieByDrum(game, i);
    expect(game.lure.phase).toBe('sinking');
    expect(game.lure.onBed, 'the lure lies on the bed').toBe(true);
    expect(game.bite.phase).toBe('none');
    return game;
  }
  /** The bite stepped with a chance that always snags, for `seconds`; the drum it took, or -1. */
  function snagIn(game: Game, seconds = 3): number {
    let t = game.t;
    for (let f = 0; f < seconds / DT; f++) {
      t += DT;
      game.bite.step(t, DT, game.fish, game.lure, () => 0, game.drums);
      if (game.bite.phase !== 'none') return game.bite.drum;
    }
    return -1;
  }

  it('snags a lure lying on the bed within reach, with every fish cured, and dips the bobber at once', () => {
    const game = beside();
    expect(snagIn(game)).toBe(0);
    expect(game.bite.phase).toBe('biting');
    expect(game.bite.fish, 'no fish is the bite’s').toBe(-1);
    expect(game.fish.held).toBe(-1);
  });

  it('does not snag a lure still sinking, however near the drum it is above', () => {
    const { game } = lake();
    cureAll(game);
    castAtDrum(game, 0);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    game.lure.depth = 0.5;
    expect(game.lure.onBed).toBe(false);
    expect(snagIn(game, 20)).toBe(-1);
  });

  it('does not snag a lure lying on the bed out of reach', () => {
    const game = beside();
    game.drums.x[0] += DRUMS.reach + 1;
    expect(snagIn(game, 20)).toBe(-1);
  });

  it('does not snag a lure in water too deep for it to reach the bed, however near', () => {
    const game = beside();
    // a line that lets the lure down only so far, with the bed lying far below it
    game.lure.depth = 1;
    expect(game.lure.onBed).toBe(false);
    expect(snagIn(game, 20)).toBe(-1);
  });

  it('never snags a hauled drum, however long the lure lies by it', () => {
    const game = beside();
    game.drums.find(0);
    expect(snagIn(game, 60)).toBe(-1);
    expect(game.bite.phase).toBe('none');
  });

  it('snags by a rate a second and draws no chance when no drum is near', () => {
    const game = beside();
    let draws = 0;
    game.bite.step(game.t + DT, DT, game.fish, game.lure, () => (draws++, 1), game.drums);
    expect(draws, 'one draw while it lies by a drum').toBe(1);
    expect(game.bite.phase).toBe('none');
    const far = beside();
    far.drums.x[0] += DRUMS.reach + 1;
    far.drums.x[1] += DRUMS.reach + 1;
    draws = 0;
    far.bite.step(far.t + DT, DT, far.fish, far.lure, () => (draws++, 1), far.drums);
    expect(draws, 'none when no drum is near').toBe(0);
  });

  it('tells the bite heavy, hooks it with a strike inside the window, and lets go with none', () => {
    const told: boolean[] = [];
    const game = beside();
    const bite = new Bite({ bitten: (heavy) => told.push(heavy === true) }, HOME);
    let t = game.t;
    for (let f = 0; f < 200 && bite.phase === 'none'; f++)
      bite.step((t += DT), DT, game.fish, game.lure, () => 0, game.drums);
    expect(told).toEqual([true]);
    expect(bite.strike(t, game.fish, game.lure)).toBe('hooked');
    expect(bite.phase).toBe('hooked');
    expect(bite.drum).toBe(0);

    // left alone, the window shuts, the drum lets go and keeps away a while, and the lure stays where it lies
    const slow = beside();
    expect(snagIn(slow)).toBe(0);
    const t0 = slow.t;
    let late = t0;
    for (let f = 0; f < 120 && slow.bite.phase === 'biting'; f++)
      slow.bite.step((late += DT), DT, slow.fish, slow.lure, () => 0, slow.drums);
    expect(slow.bite.phase).toBe('none');
    expect(slow.bite.drum).toBe(-1);
    expect(slow.bite.drumWary[0]).toBeGreaterThan(late);
    for (let f = 0; f < 60 * (FISHING.wary - 2); f++)
      slow.bite.step((late += DT), DT, slow.fish, slow.lure, () => 0, slow.drums);
    expect(slow.bite.phase, 'wary of the lure, the drum is not snagged again at once').toBe('none');
  });

  it('keeps a fish’s own paths as they are: a fish in reach still wins the lure over a drum', () => {
    const game = beside();
    game.fish.cured[0] = 0;
    game.fish.x[0] = game.lure.bobber[0] + 2;
    game.fish.y[0] = game.lure.bobber[1];
    game.fish.depth[0] = game.lure.depth;
    let t = game.t;
    for (let f = 0; f < 10 && game.bite.phase === 'none'; f++)
      game.bite.step((t += DT), DT, game.fish, game.lure, () => 0, game.drums);
    expect(game.bite.phase).toBe('coming');
    expect(game.bite.fish).toBe(0);
    expect(game.bite.drum).toBe(-1);
  });
});

describe('a treasure on the bed and the lure', () => {
  /** A pond with every fish cured, the lure lying on the bed beside treasure `i`, and the bite not yet stepped. */
  function beside(i = 0, seed = 1) {
    const { game } = lake(seed);
    cureAll(game);
    lieByTreasure(game, i);
    expect(game.lure.phase).toBe('sinking');
    expect(game.lure.onBed, 'the lure lies on the bed').toBe(true);
    expect(game.bite.phase).toBe('none');
    return game;
  }
  /** The bite stepped with a chance that always snags, for `seconds`; what it took, as 'treasure 2' or 'drum 0', or ''. */
  function snagIn(game: Game, seconds = 3): string {
    let t = game.t;
    for (let f = 0; f < seconds / DT; f++) {
      t += DT;
      game.bite.step(t, DT, game.fish, game.lure, () => 0, game.drums, game.treasures);
      if (game.bite.phase !== 'none')
        return game.bite.treasure >= 0
          ? `treasure ${game.bite.treasure}`
          : game.bite.drum >= 0
            ? `drum ${game.bite.drum}`
            : 'fish';
    }
    return '';
  }

  it('snags a lure lying on the bed within reach, with every fish cured, and dips the bobber lightly', () => {
    const told: [boolean | undefined, string | undefined][] = [];
    const game = beside(3);
    const bite = new Bite({ bitten: (heavy, quarry) => told.push([heavy, quarry]) }, HOME);
    let t = game.t;
    for (let f = 0; f < 200 && bite.phase === 'none'; f++)
      bite.step((t += DT), DT, game.fish, game.lure, () => 0, game.drums, game.treasures);
    expect(bite.treasure).toBe(3);
    expect(bite.phase).toBe('biting');
    expect(bite.fish, 'no fish is the bite’s').toBe(-1);
    expect(bite.drum, 'nor a drum').toBe(-1);
    expect(told, 'a treasure is not heavy, and says what it is').toEqual([[false, 'treasure']]);
    expect(TREASURES.dip, 'lighter than a drum’s').toBeLessThan(DRUMS.dip);
    expect(TREASURES.dip, 'but more than a fish’s').toBeGreaterThan(1);
  });

  it('is hooked by a strike inside the window, and let go with none, wary of the lure a while', () => {
    const game = beside(1);
    expect(snagIn(game)).toBe('treasure 1');
    expect(game.bite.strike(game.t, game.fish, game.lure)).toBe('hooked');
    expect(game.bite.phase).toBe('hooked');
    const slow = beside(1);
    expect(snagIn(slow)).toBe('treasure 1');
    let late = slow.t;
    for (let f = 0; f < 120 && slow.bite.phase === 'biting'; f++)
      slow.bite.step((late += DT), DT, slow.fish, slow.lure, () => 0, slow.drums, slow.treasures);
    expect(slow.bite.phase).toBe('none');
    expect(slow.bite.treasure).toBe(-1);
    expect(slow.bite.treasureWary[1]).toBeGreaterThan(late);
    for (let f = 0; f < 60 * (FISHING.wary - 2); f++)
      slow.bite.step((late += DT), DT, slow.fish, slow.lure, () => 0, slow.drums, slow.treasures);
    expect(slow.bite.phase, 'wary, it is not snagged again at once').toBe('none');
  });

  it('is not snagged by a lure still sinking, out of reach, or hanging over water too deep for the bed', () => {
    const { game } = lake();
    cureAll(game);
    const far = beside();
    far.treasures.x[0] += TREASURES.reach + 1;
    far.treasures.x[1] += 1000;
    expect(snagIn(far, 20), 'out of reach').toBe('');
    const deep = beside();
    deep.lure.depth = 1;
    expect(deep.lure.onBed).toBe(false);
    expect(snagIn(deep, 20)).toBe('');
  });

  it('is never snagged once found, however long the lure lies by it', () => {
    const game = beside(2);
    game.treasures.find(2);
    expect(snagIn(game, 60)).toBe('');
    expect(game.bite.phase).toBe('none');
  });

  it('takes the nearer of a drum and a treasure, either way round', () => {
    const near = beside(0);
    // a drum a little way off the lure, the treasure under it
    near.drums.x[0] = near.lure.bobber[0] + 1.2;
    near.drums.y[0] = near.lure.bobber[1];
    expect(snagIn(near)).toBe('treasure 0');
    const drumNear = beside(0);
    drumNear.drums.x[0] = drumNear.lure.bobber[0] + 0.1;
    drumNear.drums.y[0] = drumNear.lure.bobber[1];
    drumNear.treasures.x[0] = drumNear.lure.bobber[0] + 1.2;
    drumNear.treasures.y[0] = drumNear.lure.bobber[1];
    expect(snagIn(drumNear)).toBe('drum 0');
    expect(drumNear.bite.treasure, 'never two at once').toBe(-1);
  });

  it('draws one chance a step while one is in reach and none when nothing is, drum or treasure', () => {
    const game = beside();
    let draws = 0;
    game.bite.step(game.t + DT, DT, game.fish, game.lure, () => (draws++, 1), game.drums, game.treasures);
    expect(draws).toBe(1);
    const far = beside();
    far.treasures.x.fill(5000);
    far.drums.x.fill(5000);
    draws = 0;
    far.bite.step(far.t + DT, DT, far.fish, far.lure, () => (draws++, 1), far.drums, far.treasures);
    expect(draws).toBe(0);
  });

  it('gives a fish coming first the lure, over a treasure beside it', () => {
    const game = beside();
    game.fish.cured[0] = 0;
    game.fish.x[0] = game.lure.bobber[0] + 2;
    game.fish.y[0] = game.lure.bobber[1];
    game.fish.depth[0] = game.lure.depth;
    let t = game.t;
    for (let f = 0; f < 10 && game.bite.phase === 'none'; f++)
      game.bite.step((t += DT), DT, game.fish, game.lure, () => 0, game.drums, game.treasures);
    expect(game.bite.phase).toBe('coming');
    expect(game.bite.fish).toBe(0);
    expect(game.bite.treasure).toBe(-1);
  });

  it('can snag in a clean pond, where no fish can bite', () => {
    const game = beside();
    game.drums.loadFirst(DRUMS.count);
    expect(game.pondClean, 'every fish cured, every drum hauled').toBe(true);
    expect(snagIn(game)).toBe('treasure 0');
    expect(game.bite.fish).toBe(-1);
  });

  it('is let go of by the bite’s own letGo and stowed away with the quarry', () => {
    const game = beside();
    snagIn(game);
    game.bite.letGo(game.t, game.fish, game.lure);
    expect(game.bite.treasure).toBe(-1);
    expect(game.bite.phase).toBe('none');
    snagIn(game);
    game.bite.phase = 'landed';
    game.bite.stowed(game.fish);
    expect(game.bite.treasure).toBe(-1);
  });
});

describe('the rain and the lure', () => {
  /** A lone fish held still at `d` from the bobber, settled for a minute at the school's lift, then the lure sunk to `lureDepth`. */
  function settledFish(lift: number, lureDepth: number) {
    const game = sunk();
    const bream = slotOf(game, 'pike');
    game.fish.keeps[bream] = 0.9;
    game.fish.speed[bream] = 0;
    put(game, bream, 2);
    for (let f = 0; f < 3600; f++) game.fish.step(DT, () => 0.5, lift);
    // the school's step wandered nothing (the fish is still), but a held-off bite state is clean
    game.bite.stowed(game.fish);
    game.lure.depth = lureDepth;
    return { game, fish: bream };
  }

  it('brings a deep fish to a shallow lure in rain that it never came to in sun', () => {
    const rain = settledFish(FISHING.rainLift, 0);
    const lureDepth = rain.game.fish.depth[rain.fish];
    // the lure sits at the depth the fish rose to, and the same fish unlifted lies well below the band
    const lifted = settledFish(FISHING.rainLift, lureDepth);
    const sun = settledFish(0, lureDepth);
    expect(sun.game.fish.depth[sun.fish] - lureDepth, 'sun leaves it out of the band').toBeGreaterThan(FISHING.band);
    expect(chosenIn(sun.game, 60)).toBe(-1);
    expect(Math.abs(lifted.game.fish.depth[lifted.fish] - lureDepth), 'rain puts it in the band').toBeLessThanOrEqual(
      FISHING.band,
    );
    expect(chosenIn(lifted.game, 60)).toBe(lifted.fish);
    expect(Math.abs(lifted.game.fish.depth[lifted.fish] - lifted.game.lure.depth)).toBeLessThanOrEqual(FISHING.band);
  });
});
