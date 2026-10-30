/** The cast as it is drawn: a piece between two ends, the line's sag, the preview, the bobber and the lure. */
import { describe, expect, it } from 'vitest';
import { careful } from '../src/angler';
import { flight, rodTip } from '../src/cast';
import { CastDraw, HANG, LINE_COLOURS, LINE_PIECES, PREVIEW_DOTS, ROD_PIECES, piece } from '../src/castdraw';
import { FISH_BODY } from '../src/fishdraw';
import { LAZY, ROPE, WEATHER } from '../src/lake';
import { bellSwing, proppedTip, restFor } from '../src/lazy';
import { Game } from '../src/game';
import { HOME, LAKES } from '../src/lakes';
import type { Lake } from '../src/lakes/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, newGame, settle } from './helpers';

/** Which way a cast goes to land on the water: down the jetty's deck from where the angler stands. */
const OUT = HOME.aim.angle;

/** The game's line worked out again for a clock or tension a test has set by hand, since the draw reads what the step made. */
function again(game: unknown) {
  (game as { stepRope(dt: number): void }).stepRope(DT);
}

/** Where a point of the unit box's own space is carried to by placement `i`. */
function carried(m: Float32Array, i: number, x: number, y: number, z: number): number[] {
  const o = i * 16;
  return [0, 1, 2].map((r) => m[o + r] * x + m[o + 4 + r] * y + m[o + 8 + r] * z + m[o + 12 + r]);
}

describe('a piece between two ends', () => {
  it('runs from the one to the other, as thick as it is asked, whichever way they lie', () => {
    const m = new Float32Array(16);
    for (const [a, b] of [
      [
        [0, 0, 0],
        [3, 4, 0],
      ],
      [
        [1, 2, 3],
        [1, 2, -5],
      ],
      [
        [-2, 7, 1],
        [4, -1, 6],
      ],
    ] as [number, number, number][][]) {
      piece(m, 0, a, b, 0.1);
      const from = carried(m, 0, -0.5, 0, 0),
        to = carried(m, 0, 0.5, 0, 0);
      for (let k = 0; k < 3; k++) {
        expect(from[k]).toBeCloseTo(a[k], 5);
        expect(to[k]).toBeCloseTo(b[k], 5);
      }
      const side = carried(m, 0, 0, 0.5, 0),
        mid = carried(m, 0, 0, 0, 0);
      expect(Math.hypot(side[0] - mid[0], side[1] - mid[1], side[2] - mid[2]) * 2).toBeCloseTo(0.1, 5);
    }
  });
});

describe('the cast, drawn', () => {
  it('has a line from the rod tip that sags below the straight way to the lure', () => {
    const { game } = newGame();
    game.cast(OUT, 0.7);
    settle(game, 20);
    const draw = new CastDraw();
    draw.write(game, null);
    const tip = rodTip();
    const first = carried(draw.lines[0], 0, -0.5, 0, 0);
    for (let k = 0; k < 3; k++) expect(first[k]).toBeCloseTo(tip[k], 4);
    const last = carried(draw.lines[0], LINE_PIECES - 1, 0.5, 0, 0);
    for (let k = 0; k < 3; k++) expect(last[k]).toBeCloseTo(game.lure.at[k], 4);
    // halfway along, it hangs below the straight line from the tip to the lure
    const mid = carried(draw.lines[0], LINE_PIECES / 2, -0.5, 0, 0);
    const length = Math.hypot(game.lure.at[0] - tip[0], game.lure.at[1] - tip[1], game.lure.at[2] - tip[2]);
    expect(
      (tip[2] + game.lure.at[2]) / 2 - mid[2],
      'how far it sags, at the least a share of its length',
    ).toBeGreaterThan(length * 0.02);
  });

  it('shows the preview only while aiming, its ring yellow over the water and red over the bank', () => {
    const { game } = newGame();
    const draw = new CastDraw();
    let n = draw.write(game, null);
    expect(n.dots).toBe(0);
    expect(n.ringWater + n.ringBank).toBe(0);
    n = draw.write(game, { angle: OUT, power: 0.6 });
    expect(n.dots).toBe(PREVIEW_DOTS);
    expect(n.ringWater).toBeGreaterThan(0);
    expect(n.ringBank).toBe(0);
    // its last dot is where the cast would land
    const landing = flight(OUT, 0.6).landing;
    const last = carried(draw.dots, PREVIEW_DOTS - 1, 0, 0, 0);
    for (let k = 0; k < 3; k++) expect(last[k]).toBeCloseTo(landing[k], 4);
    // the ring that is drawn is the water's, round where it lands
    const piece0 = carried(draw.ringWater, 0, 0, 0, 0);
    expect(Math.hypot(piece0[0] - landing[0], piece0[1] - landing[1]), 'the water ring round the landing').toBeLessThan(
      2,
    );
    n = draw.write(game, { angle: -OUT, power: 0.6 });
    expect(n.ringBank).toBeGreaterThan(0);
    expect(n.ringWater).toBe(0);
    const bank = flight(-OUT, 0.6).landing;
    const piece1 = carried(draw.ringBank, 0, 0, 0, 0);
    expect(Math.hypot(piece1[0] - bank[0], piece1[1] - bank[1]), 'the bank ring round the landing').toBeLessThan(2);
  });

  it('has a bobber once the lure is in the water, bobbing by the clock, and none before', () => {
    const { game } = newGame();
    const draw = new CastDraw();
    expect(draw.write(game, null).bobber).toBe(0);
    game.cast(OUT, 0.6);
    settle(game, 120);
    expect(game.lure.phase).toBe('sinking');
    expect(draw.write(game, null).bobber).toBe(1);
    const z = (t: number) => {
      game.t = t;
      again(game);
      draw.write(game, null);
      return draw.bobber[14];
    };
    expect(z(10)).not.toBeCloseTo(z(10.4), 4);
    expect(z(12)).toBeCloseTo(z(12), 10);
    // and it rides the swells: as far over the water as before, where the water stands
    const still = z(10.4);
    game.surface = (x, y, t) => 0.3 * Math.cos(x - y + t);
    const riding = z(10.4);
    expect(riding - still).toBeCloseTo(0.3 * Math.cos(game.lure.bobber[0] - game.lure.bobber[1] + 10.4), 5);
    game.surface = () => 0;
    // and the lure is under it, at its depth
    draw.write(game, null);
    expect(draw.lure[14]).toBeCloseTo(-game.lure.depth, 5);
    expect(DT).toBeGreaterThan(0);
  });
});

/** A lake with a fish on the line, from a seed. */
function onTheLine(seed = 1) {
  const { game } = newGame(seed);
  game.cast(OUT, 0.62);
  for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
  expect(game.strike()).toBe('hooked');
  game.step(DT);
  return game;
}

describe('the fight, drawn', () => {
  it('has the rod straight with the line slack, bent down toward the fish the tighter it is', () => {
    const game = onTheLine();
    const draw = new CastDraw();
    const tipAt = (tension: number) => {
      game.line.tension = tension;
      again(game);
      expect(draw.write(game, null).rod).toBe(ROD_PIECES);
      return carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0);
    };
    const slack = tipAt(0);
    for (let k = 0; k < 3; k++) expect(slack[k]).toBeCloseTo(rodTip()[k], 4);
    const tight = tipAt(0.9),
      half = tipAt(0.45);
    expect(tight[2], 'bent down').toBeLessThan(half[2]);
    expect(half[2]).toBeLessThan(slack[2]);
    // toward the fish: nearer it, in plan, than the rod's own tip
    const fish = [game.lure.at[0], game.lure.at[1]];
    expect(Math.hypot(tight[0] - fish[0], tight[1] - fish[1])).toBeLessThan(
      Math.hypot(slack[0] - fish[0], slack[1] - fish[1]),
    );
  });

  it('draws the line in one colour of four, from white to red by its tension, and white while no fish is on', () => {
    const game = onTheLine();
    const draw = new CastDraw();
    for (const [tension, colour] of [
      [0.1, 0],
      [0.3, 1],
      [0.6, 2],
      [0.95, 3],
    ] as const) {
      game.line.tension = tension;
      again(game);
      const n = draw.write(game, null);
      expect(n.lines.length).toBe(LINE_COLOURS);
      n.lines.forEach((count, k) =>
        expect(count, `tension ${tension}, colour ${k}`).toBe(k === colour ? LINE_PIECES : 0),
      );
    }
    const { game: idle } = newGame();
    idle.line.tension = 0.95;
    expect(draw.write(idle, null).lines[0]).toBe(LINE_PIECES);
  });

  it('runs the line from the bent tip to the hooked fish, its bobber gone under', () => {
    const game = onTheLine();
    game.line.tension = 0.7;
    again(game);
    const draw = new CastDraw();
    const n = draw.write(game, null);
    expect(n.bobber).toBe(0);
    const k = n.lines.findIndex((c) => c > 0);
    const tip = carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0),
      first = carried(draw.lines[k], 0, -0.5, 0, 0),
      last = carried(draw.lines[k], LINE_PIECES - 1, 0.5, 0, 0);
    for (let j = 0; j < 3; j++) {
      expect(first[j]).toBeCloseTo(tip[j], 4);
      expect(last[j]).toBeCloseTo(game.lure.at[j], 4);
    }
  });

  it('shakes the bobber from side to side while the strike’s window is open, and only then, the same each run', () => {
    const { game } = newGame(1);
    game.cast(OUT, 0.62);
    const draw = new CastDraw();
    // how far the drawn bobber stands from where the lure's bobber is, sideways, over a second of game time
    const swing = () => {
      let most = 0;
      for (let k = 0; k < 20; k++) {
        game.t += 0.05;
        again(game);
        draw.write(game, null);
        most = Math.max(most, Math.hypot(draw.bobber[12] - game.lure.bobber[0], draw.bobber[13] - game.lure.bobber[1]));
      }
      game.t -= 1;
      return most;
    };
    for (let f = 0; f < 3600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(swing(), 'still while sinking').toBeLessThan(1e-6);
    for (let f = 0; f < 3600 && game.bite.phase !== 'nibbling'; f++) game.step(DT);
    expect(swing(), 'still while nibbling').toBeLessThan(1e-6);
    for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
    const shaken = swing();
    expect(shaken, 'shaken on the bite').toBeGreaterThan(0.05);
    expect(swing(), 'the same from the same time').toBe(shaken);
  });

  it('dips the bobber under on a bite, and twitches it on a nibble', () => {
    const { game } = newGame(1);
    game.cast(OUT, 0.62);
    const draw = new CastDraw();
    const bobberZ = () => (again(game), draw.write(game, null), draw.bobber[14]);
    for (let f = 0; f < 3600 && game.bite.phase !== 'nibbling'; f++) game.step(DT);
    // the still bob's range, before any nibble
    let lo = Infinity;
    for (let k = 0; k < 120; k++) {
      game.t += 0.05;
      lo = Math.min(lo, bobberZ());
    }
    game.t -= 6;
    // just after a nibble it twitches below that
    for (let f = 0; f < 3600 && game.bite.nibbledAt < 0; f++) game.step(DT);
    // at the height of the twitch, half its length after the nibble
    game.t = game.bite.nibbledAt + 0.15;
    expect(bobberZ(), 'twitched on a nibble').toBeLessThan(lo - 0.03);
    for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(bobberZ(), 'dipped on the bite').toBeLessThan(lo - 0.15);
  });
});

describe('the catch, drawn', () => {
  it('hangs the landed fish from the rod tip on a short line, the lure at its mouth, until it is stowed', () => {
    const game = onTheLine(3);
    for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
      game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt, game.line.figures.width));
      game.step(DT);
    }
    expect(game.bite.phase).toBe('landed');
    const draw = new CastDraw();
    const n = draw.write(game, null);
    expect(n.hung).toBe(1);
    expect(n.bobber).toBe(0);
    const tip = rodTip();
    const lure = [draw.lure[12], draw.lure[13], draw.lure[14]];
    expect(lure[2]).toBeCloseTo(tip[2] - HANG.drop, 5);
    expect(Math.hypot(lure[0] - tip[0], lure[1] - tip[1]), 'swaying no further than its sway').toBeLessThanOrEqual(
      HANG.sway + 1e-9,
    );
    // the fish's middle below the lure by half its length
    expect(draw.hang[2]).toBeCloseTo(lure[2] - FISH_BODY.length / 2, 5);
    expect(draw.hang[0]).toBeCloseTo(lure[0], 5);
    game.stow();
    expect(draw.write(game, null).hung).toBe(0);
  });

  it('draws the line thicker with a fish on, so its colour reads from the shore', () => {
    const game = onTheLine();
    const draw = new CastDraw();
    const k = draw.write(game, null).lines.findIndex((c) => c > 0);
    const on = Math.hypot(draw.lines[k][4], draw.lines[k][5], draw.lines[k][6]);
    const { game: idle } = newGame();
    const draw2 = new CastDraw();
    draw2.write(idle, null);
    const off = Math.hypot(draw2.lines[0][4], draw2.lines[0][5], draw2.lines[0][6]);
    expect(on).toBeGreaterThan(off * 1.6);
  });
});

describe('the preview in a wind', () => {
  it('is the bent flight: its last dot is where the cast lands in the wind, and downwind of where it lands in none', () => {
    const { game } = newGame();
    const draw = new CastDraw();
    draw.write(game, { angle: OUT, power: 0.6 });
    const calm = carried(draw.dots, PREVIEW_DOTS - 1, 0, 0, 0);
    game.setWeather('wind');
    draw.write(game, { angle: OUT, power: 0.6 });
    const bent = carried(draw.dots, PREVIEW_DOTS - 1, 0, 0, 0);
    const landing = flight(OUT, 0.6, game.lake, WEATHER.wind.vector).landing;
    for (let k = 0; k < 3; k++) expect(bent[k]).toBeCloseTo(landing[k], 4);
    expect(bent[0] - calm[0], 'downwind').toBeGreaterThan(1);
  });
});

describe('the line, drawn as the rope', () => {
  it('has as many pieces as the rope has segments, the first from the line’s start and the last to its end, to the bit', () => {
    expect(LINE_PIECES).toBe(ROPE.points - 1);
    const game = onTheLine();
    game.line.tension = 0.5;
    again(game);
    const draw = new CastDraw();
    const n = draw.write(game, null);
    const k = n.lines.findIndex((c) => c > 0);
    expect(n.lines[k]).toBe(LINE_PIECES);
    // the pieces are placed in f32, so "to the bit" is to the f32 of the rope's own point
    const first = carried(draw.lines[k], 0, -0.5, 0, 0),
      last = carried(draw.lines[k], LINE_PIECES - 1, 0.5, 0, 0);
    for (let j = 0; j < 3; j++) {
      expect(first[j]).toBeCloseTo(game.lineStart[j], 5);
      expect(last[j]).toBeCloseTo(game.lineEnd[j], 5);
    }
  });

  it('makes nothing in a write: the pools and lists are the very objects as before', () => {
    const game = onTheLine();
    const draw = new CastDraw();
    const before = [...draw.lines, draw.rod, draw.lure, draw.bobber, draw.dots, draw.ringWater, draw.ringBank];
    const drawn = draw.write(game, null);
    const lines = drawn.lines;
    for (let f = 0; f < 5; f++) {
      game.step(DT);
      expect(draw.write(game, { angle: OUT, power: 0.5 })).toBe(drawn);
    }
    expect(drawn.lines).toBe(lines);
    expect([...draw.lines, draw.rod, draw.lure, draw.bobber, draw.dots, draw.ringWater, draw.ringBank]).toEqual(before);
    before.forEach((pool, i) =>
      expect(pool).toBe([...draw.lines, draw.rod, draw.lure, draw.bobber, draw.dots, draw.ringWater, draw.ringBank][i]),
    );
  });
});

describe('the rod aboard the boat', () => {
  it('is held from the seat and ends at the boat’s rod tip, and the preview flies from that tip too', () => {
    const { game } = newGame(1);
    expect(game.row(HOME.boat!.spot[0], HOME.boat!.spot[1])).toBe(true);
    settle(game, 60 * 40);
    expect(game.boat.aboard && !game.boat.rowing).toBe(true);
    const stand = game.anglerAt();
    const draw = new CastDraw();
    expect(draw.write(game, null).rod).toBe(ROD_PIECES);
    const tip = carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0);
    const want = rodTip(HOME, stand);
    for (let k = 0; k < 3; k++) expect(tip[k]).toBeCloseTo(want[k], 4);
    // the butt is beside the seat, a little over the boat’s seat height and not on the shore
    const butt = carried(draw.rod, 0, -0.5, 0, 0);
    expect(Math.hypot(butt[0] - stand.x, butt[1] - stand.y)).toBeLessThan(1.5);
    expect(butt[2]).toBeLessThan(want[2]);
    // the preview’s first dot is on the arc from the tip, not from the shore
    draw.write(game, { angle: game.boat.heading, power: 0.5 });
    const dot0 = carried(draw.dots, 0, 0, 0, 0);
    for (let k = 0; k < 3; k++) expect(dot0[k]).toBeCloseTo(want[k], 3);
  });

  it('is held ashore from the stand’s own heading: the hand ahead and to the right of it, over the deck, the tip out in front', () => {
    const { game } = newGame(1);
    const draw = new CastDraw();
    draw.write(game, null);
    const a = HOME.angler;
    const h = a.heading!;
    const butt = carried(draw.rod, 0, -0.5, 0, 0);
    // half a unit ahead and six tenths to the right of the heading, five over the deck's top (the stand's base)
    expect(butt[0]).toBeCloseTo(a.x + Math.cos(h) * 0.5 + Math.sin(h) * 0.6, 4);
    expect(butt[1]).toBeCloseTo(a.y + Math.sin(h) * 0.5 - Math.cos(h) * 0.6, 4);
    expect(butt[2]).toBeCloseTo(a.base! + 5, 4);
    // the tip is out in front along the heading, and the rod runs that way from the hand
    const tip = carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0);
    const want = rodTip(HOME, a);
    for (let k = 0; k < 3; k++) expect(tip[k]).toBeCloseTo(want[k], 4);
    expect((tip[0] - a.x) * Math.cos(h) + (tip[1] - a.y) * Math.sin(h)).toBeCloseTo(a.tipReach, 4);
    expect(-(tip[0] - a.x) * Math.sin(h) + (tip[1] - a.y) * Math.cos(h)).toBeCloseTo(0, 4);
    expect((tip[0] - butt[0]) * Math.cos(h) + (tip[1] - butt[1]) * Math.sin(h)).toBeGreaterThan(3);
  });

  it('turns with the heading, whichever way the stand faces', () => {
    for (const heading of [0, 0.7, Math.PI / 2, 3, -2.5]) {
      const lake: Lake = { ...HOME, id: 'facing', angler: { ...HOME.angler, heading } };
      const game = new Game(new Progress(memoryStore(), { [lake.id]: lake }), { lake, random: seeded(1) });
      const draw = new CastDraw(lake);
      draw.write(game, null);
      const a = lake.angler;
      const butt = carried(draw.rod, 0, -0.5, 0, 0);
      const tip = carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0);
      // in the stand's own frame, forward along the heading and right across it, the hand and the tip are where they are
      const frame = (p: number[]) => [
        (p[0] - a.x) * Math.cos(heading) + (p[1] - a.y) * Math.sin(heading),
        (p[0] - a.x) * Math.sin(heading) - (p[1] - a.y) * Math.cos(heading),
      ];
      expect(frame(butt)[0], `hand ahead at ${heading}`).toBeCloseTo(0.5, 4);
      expect(frame(butt)[1], `hand right at ${heading}`).toBeCloseTo(0.6, 4);
      expect(frame(tip)[0], `tip ahead at ${heading}`).toBeCloseTo(a.tipReach, 4);
      expect(frame(tip)[1], `tip across at ${heading}`).toBeCloseTo(0, 4);
    }
  });

  it('is exactly the Reservoir’s as it was, a stand with no heading facing north: the hand is where it was built to be', () => {
    const lake = LAKES.reservoir;
    const game = new Game(new Progress(memoryStore(), LAKES), { lake, random: seeded(1) });
    const draw = new CastDraw(lake);
    draw.write(game, null);
    const a = lake.angler;
    expect(a.heading).toBeUndefined();
    const butt = carried(draw.rod, 0, -0.5, 0, 0);
    expect(butt[0]).toBeCloseTo(a.x + 0.6, 4);
    expect(butt[1]).toBeCloseTo(a.y + 0.5, 4);
    expect(butt[2]).toBeCloseTo(lake.ground(a.x, a.y) + 5, 4);
  });
});

describe('the rod propped (`docs/boat.md`, C5)', () => {
  /** A game with the lure sinking at the pond, the rod propped or not. */
  function sinking(on: boolean) {
    const { game } = newGame(1);
    expect(game.cast(OUT, 0.58)).toBe(true);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    if (on) expect(game.prop(true)).toBe(true);
    settle(game, 5);
    return game;
  }

  it('hangs the line from the propped tip, which is the rest’s and not the hand’s', () => {
    const game = sinking(true);
    const want = proppedTip(restFor(HOME, game.anglerAt()), new Float64Array(3));
    for (let k = 0; k < 3; k++) expect(game.lineStart[k]).toBeCloseTo(want[k], 9);
    const hand = rodTip(HOME, game.anglerAt());
    expect(Math.hypot(want[0] - hand[0], want[1] - hand[1], want[2] - hand[2])).toBeGreaterThan(0.5);
  });

  it('hangs the line from the hand’s tip again when the rod is taken up', () => {
    const game = sinking(true);
    expect(game.prop(false)).toBe(true);
    settle(game, 5);
    const want = rodTip(HOME, game.anglerAt());
    for (let k = 0; k < 3; k++) expect(game.lineStart[k]).toBeCloseTo(want[k], 9);
  });

  it('draws the rod straight from the rest to that tip, with the bell at the tip and the rest only at a lake without a jetty', () => {
    const game = sinking(true);
    const draw = new CastDraw();
    const drawn = draw.write(game, null);
    const r = restFor(HOME, game.anglerAt());
    const tip = proppedTip(r, new Float64Array(3));
    const butt = carried(draw.rod, 0, -0.5, 0, 0);
    const end = carried(draw.rod, ROD_PIECES - 1, 0.5, 0, 0);
    for (let k = 0; k < 3; k++) {
      expect(butt[k]).toBeCloseTo([r.x, r.y, r.z][k], 4);
      expect(end[k]).toBeCloseTo(tip[k], 4);
    }
    // the bell hangs from the tip, at the bell's size; a jetty is its own rest, so nothing is planted
    expect(drawn.bell).toBe(1);
    expect(Array.from(draw.bell.slice(12, 15))).toEqual(Array.from(new Float32Array(tip)));
    expect(draw.bell[0]).toBeCloseTo(LAZY.bell, 6);
    expect(drawn.rest).toBe(0);
  });

  it('plants the rest in the bank at the Reservoir, and swings the bell from the time of the bite', () => {
    const lake = LAKES.reservoir;
    const game = new Game(new Progress(memoryStore(), LAKES), { lake, random: seeded(1) });
    expect(game.cast(lake.aim.angle, lake.aim.power)).toBe(true);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.prop(true)).toBe(true);
    const draw = new CastDraw(lake);
    expect(draw.write(game, null).rest).toBe(1);
    const r = restFor(lake, game.anglerAt());
    expect(Array.from(draw.restAt.slice(12, 15))).toEqual(Array.from(new Float32Array([r.x, r.y, r.z])));
    // rung a quarter of a swing ago: the bell is turned off the vertical, and by the swing's own figure
    game.rang = game.t - 0.02;
    draw.write(game, null);
    const hung = draw.bell[10];
    expect(hung).toBeCloseTo(LAZY.bell * Math.cos(bellSwing(0.02)), 5);
    // and long after the ring it hangs straight again
    game.rang = game.t - LAZY.ring - 1;
    draw.write(game, null);
    expect(draw.bell[10]).toBeCloseTo(LAZY.bell, 6);
  });

  it('scales the bell and the rest to nothing in hand', () => {
    const game = sinking(false);
    const draw = new CastDraw();
    const drawn = draw.write(game, null);
    expect(drawn.bell).toBe(0);
    expect(drawn.rest).toBe(0);
    expect(Array.from(draw.bell.slice(0, 11))).toEqual(new Array(11).fill(0));
    expect(Array.from(draw.restAt.slice(0, 11))).toEqual(new Array(11).fill(0));
  });

  it('makes nothing each frame: the same pools after any number of writes', () => {
    const game = sinking(true);
    const draw = new CastDraw();
    const [bell, rest] = [draw.bell, draw.restAt];
    for (let f = 0; f < 30; f++) draw.write(game, null);
    expect(draw.bell).toBe(bell);
    expect(draw.restAt).toBe(rest);
  });
});
