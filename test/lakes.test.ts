/**
 * The Duck Pond as an object (`docs/lakes.md`, part 1). The snapshot in `__snapshots__/lakes.test.ts.snap` was taken
 * from the functions and constants of `src/lake.ts` before they were moved into `DUCK_POND`, so the object answers
 * what the module answered: every geometry call at a grid of points (each function's answers hashed whole, bit for
 * bit, so a change of one ulp anywhere is seen and the function that moved is named) and every constant held to its
 * figures. A refactor that moves nothing leaves the snapshot alone.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as lake from '../src/lake';
import { DUCK_POND } from '../src/lakes/duckpond';
import { RESERVOIR } from '../src/lakes/reservoir';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { HOME, LAKES, lakeNamed } from '../src/lakes';
import { fallsOf } from '../src/falls';
import type { BedWorld } from '../src/bedfinds';
import type { FallingWorld } from '../src/falling';

/** Everything the snapshot asks of a lake, whichever way it is reached. */
interface Probe {
  inside: (x: number, y: number, margin?: number) => boolean;
  inShore: (x: number, y: number, margin?: number) => boolean;
  inward: (x: number, y: number) => number;
  bedDepth: (x: number, y: number) => number;
  ground: (x: number, y: number) => number;
  bareGround: (x: number, y: number) => number;
  groundUnder: (x: number, y: number) => number;
  shoreRadius: (angle: number) => number;
  boulderGap: (x: number, y: number) => number;
  nearestBoulder: (x: number, y: number) => { x: number; y: number };
  jettyGap: (x: number, y: number) => number;
  nearestOnDeck: (x: number, y: number) => [number, number];
  cabinGap: (x: number, y: number) => number;
  onFall: (x: number, y: number) => boolean;
  onFace: (x: number, y: number) => boolean;
  cliffRise: (x: number, y: number) => number;
  channel: (x: number, y: number) => number;
  onCabinOrDeck: (x: number, y: number) => boolean;
  deckFrame: (x: number, y: number) => [number, number];
  bowlDepthAt: (out: number) => number;
  contaminationAfter: (cured: number, drums: number) => number;
  constants: Record<string, unknown>;
}

/** The pond as the object gives it. */
function viaObject(): Probe {
  const p = DUCK_POND;
  return {
    inside: p.inside,
    inShore: p.inShore,
    inward: p.inward,
    bedDepth: p.bedDepth,
    ground: p.ground,
    bareGround: p.bareGround,
    groundUnder: p.groundUnder,
    shoreRadius: p.shoreRadius,
    boulderGap: p.boulderGap,
    nearestBoulder: p.nearestBoulder,
    jettyGap: p.jetty!.gap,
    nearestOnDeck: p.jetty!.nearestOnDeck,
    cabinGap: p.cabin!.gap,
    onFall: p.onFall,
    onFace: p.onFace,
    cliffRise: p.cliff!.rise,
    channel: p.cliff!.channel,
    onCabinOrDeck: p.onCabinOrDeck,
    deckFrame: p.jetty!.frame,
    bowlDepthAt: p.bowlDepthAt,
    contaminationAfter: p.contaminationAfter,
    constants: {
      SHORE_RADIUS: p.radius,
      STRETCH: p.stretch,
      MAX_DEPTH: p.maxDepth,
      BANK_TOP: p.bankTop,
      BANK_RISE: p.bankRise,
      SHORE_POINTS: p.shorePoints,
      BED_SHALLOWS: p.bedShallows,
      BOULDERS: p.boulders,
      BOULDER_DOMES: p.domes,
      ROCKS: p.rocks,
      JETTY: p.jetty!.spec,
      DECK: p.jetty!.deck,
      DECK_ROUND: p.jetty!.round,
      DECK_NEAR: p.jetty!.near,
      CABIN: p.cabin!.spec,
      CABIN_AT: p.cabin!.at,
      CLIFF: p.cliff!.spec,
      NOTCHES: p.cliff!.notches,
      CABIN_ROOM: p.cabin!.room,
      CABIN_FLOOR: p.cabin!.floor,
      WAKING_EYE: p.cabin!.wakingEye,
      VIEWS: p.views,
      FISH_KINDS: p.fishKinds,
      FISH_COUNT: p.fishCount,
      FISH_SHORE: p.fishShore,
      FISH_SHALLOWEST: p.fishShallowest,
      FISH_ABOVE_BED: p.fishAboveBed,
      DRUMS: { ...DRUM_RULES, ...p.drums },
      TREASURES: { ...TREASURE_RULES, ...p.treasures },
      ANGLER: p.angler,
      CAST: {
        reach: p.castReach,
        launch: lake.CAST.launch,
        sink: lake.CAST.sink,
        lineDepth: lake.CAST.lineDepth,
        aboveBed: lake.CAST.aboveBed,
      },
      // the fight's figures as the module held them, `landAt` among them, which the lake owns now
      FIGHT: { ...lake.FIGHT, landAt: p.landAt },
      FIGHT_LAND_AT: p.landAt,
      SURFACE: p.surface,
      SCENERY: {
        trees: p.scenery.trees,
        woodland: p.scenery.woodland,
        pebbles: p.scenery.pebbles,
        clumps: p.scenery.clumps,
      },
      WATER_PACE: p.waterPace,
      LAKE_NAME: p.name,
      CURE: { toClean: p.toClean, total: p.total },
    },
  };
}

/** Where the snapshot asks: every two units over the lake and its banks, and the places the lake's things stand. */
function points(p: Probe): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -60; x <= 60; x += 2) for (let y = -45; y <= 45; y += 2) out.push([x, y]);
  const c = p.constants as {
    ANGLER: { x: number; y: number };
    CABIN_AT: { x: number; y: number };
    DECK: { x: number; y: number };
  };
  out.push([c.ANGLER.x, c.ANGLER.y], [c.CABIN_AT.x, c.CABIN_AT.y], [c.DECK.x, c.DECK.y]);
  // the deck's middle and its far end, and each boulder's centre and edge
  const deck = p.constants.DECK as { x: number; y: number; inward: [number, number] };
  out.push(
    [deck.x + deck.inward[0] * 6.5, deck.y + deck.inward[1] * 6.5],
    [deck.x + deck.inward[0] * 13, deck.y + deck.inward[1] * 13],
  );
  for (const b of p.constants.BOULDERS as { x: number; y: number; radius: number }[])
    out.push([b.x, b.y], [b.x + b.radius, b.y]);
  return out;
}

/** The sha256 of a run of numbers, each by its eight bytes, so a different last bit is a different hash. */
function digest(values: Iterable<number>): string {
  const array = Float64Array.from(values);
  return createHash('sha256').update(Buffer.from(array.buffer)).digest('hex');
}

/** What the probe answers, as the snapshot holds it. */
function snapshotOf(p: Probe) {
  const at = points(p);
  const grid: Record<string, string> = {};
  const hash = (name: string, f: (x: number, y: number) => number | boolean | readonly number[]) => {
    const values: number[] = [];
    for (const [x, y] of at) {
      const v = f(x, y);
      if (typeof v === 'number') values.push(v);
      else if (typeof v === 'boolean') values.push(v ? 1 : 0);
      else values.push(...v);
    }
    grid[name] = digest(values);
  };
  hash('inside0', (x, y) => p.inside(x, y));
  hash('inside2', (x, y) => p.inside(x, y, 2));
  hash('inShore0', (x, y) => p.inShore(x, y));
  hash('inShore2', (x, y) => p.inShore(x, y, 2));
  hash('inward', p.inward);
  hash('bedDepth', p.bedDepth);
  hash('ground', p.ground);
  hash('bareGround', p.bareGround);
  hash('groundUnder', p.groundUnder);
  hash('boulderGap', p.boulderGap);
  hash('nearestBoulder', (x, y) => {
    const b = p.nearestBoulder(x, y);
    return [b.x, b.y];
  });
  hash('jettyGap', p.jettyGap);
  hash('nearestOnDeck', p.nearestOnDeck);
  hash('cabinGap', p.cabinGap);
  hash('onFall', p.onFall);
  hash('onFace', p.onFace);
  hash('cliffRise', p.cliffRise);
  hash('channel', p.channel);
  hash('onCabinOrDeck', p.onCabinOrDeck);
  hash('deckFrame', p.deckFrame);
  const angles = Array.from({ length: 64 }, (_, i) => -Math.PI + (i / 64) * Math.PI * 2);
  const outs = Array.from({ length: 41 }, (_, i) => i / 40);
  const cures = [0, 1, 5, 12, 20].flatMap((c) => [0, 1, 2].map((d) => p.contaminationAfter(c, d)));
  return {
    points: at.length,
    grid,
    shoreRadius: angles.map(p.shoreRadius),
    bowlDepthAt: digest(outs.map(p.bowlDepthAt)),
    contaminationAfter: cures,
    constants: p.constants,
  };
}

describe('the Duck Pond, held to what the module answered before it was an object', () => {
  it('answers every geometry call and holds every figure as it did (the snapshot)', () => {
    expect(snapshotOf(viaObject())).toMatchSnapshot();
  });

  it('holds the grid it says it does', () => {
    expect(snapshotOf(viaObject()).points).toBe(61 * 46 + 3 + 2 + 2 * 4);
  });
});

describe('the Duck Pond as a Lake', () => {
  it('is the home, and the registry names it', () => {
    expect(HOME).toBe(DUCK_POND);
    expect(LAKES[DUCK_POND.id]).toBe(DUCK_POND);
    expect(lakeNamed(DUCK_POND.id)).toBe(DUCK_POND);
  });

  it('reads an unknown id as the home', () => {
    expect(lakeNamed('nowhere')).toBe(DUCK_POND);
    expect(lakeNamed('')).toBe(DUCK_POND);
  });

  it('is named for the gauge', () => {
    expect(DUCK_POND.name).toBe('Duck Pond');
  });

  it('stands in for the seams the builders already take', () => {
    const bed: BedWorld = DUCK_POND;
    const falling: FallingWorld = DUCK_POND;
    expect(bed.from).toEqual([DUCK_POND.angler.x, DUCK_POND.angler.y]);
    expect(falling.radius).toBe(DUCK_POND.radius);
    expect(falling.level).toBe(lake.WATER_LEVEL);
  });

  it('gives its falls the speeds it names, one a notch', () => {
    expect(fallsOf(DUCK_POND).map((f) => f.speed)).toEqual(DUCK_POND.cliff!.fallSpeeds);
  });

  it('cleans by its own counts: sick at nought, clean once every fish and drum is in', () => {
    expect(DUCK_POND.contaminationAfter(0, 0)).toBe(1);
    expect(DUCK_POND.contaminationAfter(DUCK_POND.toClean, DUCK_POND.drums.count)).toBe(0);
    expect(DUCK_POND.toClean).toBe(DUCK_POND.fishCount);
    expect(DUCK_POND.total).toBe(DUCK_POND.fishCount + DUCK_POND.drums.count * DRUM_RULES.worth);
  });
});

describe('the registry of lakes', () => {
  it('has the Duck Pond and the Reservoir, each under its own id', () => {
    expect(Object.keys(LAKES).sort()).toEqual(['duckpond', 'reservoir']);
    expect(lakeNamed('reservoir')).toBe(RESERVOIR);
    expect(lakeNamed('duckpond')).toBe(DUCK_POND);
    for (const [id, lake] of Object.entries(LAKES)) expect(lake.id).toBe(id);
  });

  it('still reads an unknown id as the home, and the home is still the pond', () => {
    expect(lakeNamed('the-sea')).toBe(HOME);
    expect(HOME).toBe(DUCK_POND);
  });
});
