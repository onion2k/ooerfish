/** The cast as it is drawn: a piece between two ends, the line's sag, the preview, the bobber and the lure. */
import { describe, expect, it } from 'vitest';
import { careful } from '../src/angler';
import { flight, rodTip } from '../src/cast';
import { CastDraw, HANG, LINE_COLOURS, LINE_PIECES, PREVIEW_DOTS, ROD_PIECES, piece } from '../src/castdraw';
import { FISH_BODY } from '../src/fishdraw';
import { DT, newGame, settle } from './helpers';

const NORTH = Math.PI / 2;

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
    game.cast(NORTH, 0.7);
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
    n = draw.write(game, { angle: NORTH, power: 0.6 });
    expect(n.dots).toBe(PREVIEW_DOTS);
    expect(n.ringWater).toBeGreaterThan(0);
    expect(n.ringBank).toBe(0);
    // its last dot is where the cast would land
    const landing = flight(NORTH, 0.6).landing;
    const last = carried(draw.dots, PREVIEW_DOTS - 1, 0, 0, 0);
    for (let k = 0; k < 3; k++) expect(last[k]).toBeCloseTo(landing[k], 4);
    // the ring that is drawn is the water's, round where it lands
    const piece0 = carried(draw.ringWater, 0, 0, 0, 0);
    expect(Math.hypot(piece0[0] - landing[0], piece0[1] - landing[1]), 'the water ring round the landing').toBeLessThan(
      2,
    );
    n = draw.write(game, { angle: -NORTH, power: 0.6 });
    expect(n.ringBank).toBeGreaterThan(0);
    expect(n.ringWater).toBe(0);
    const bank = flight(-NORTH, 0.6).landing;
    const piece1 = carried(draw.ringBank, 0, 0, 0, 0);
    expect(Math.hypot(piece1[0] - bank[0], piece1[1] - bank[1]), 'the bank ring round the landing').toBeLessThan(2);
  });

  it('has a bobber once the lure is in the water, bobbing by the clock, and none before', () => {
    const { game } = newGame();
    const draw = new CastDraw();
    expect(draw.write(game, null).bobber).toBe(0);
    game.cast(NORTH, 0.6);
    settle(game, 120);
    expect(game.lure.phase).toBe('sinking');
    expect(draw.write(game, null).bobber).toBe(1);
    const z = (t: number) => {
      game.t = t;
      draw.write(game, null);
      return draw.bobber[14];
    };
    expect(z(10)).not.toBeCloseTo(z(10.4), 4);
    expect(z(12)).toBeCloseTo(z(12), 10);
    // and it rides the swells: as far over the water as before, where the water stands
    const still = z(10.4);
    draw.surface = (x, y, t) => 0.3 * Math.cos(x - y + t);
    const riding = z(10.4);
    expect(riding - still).toBeCloseTo(0.3 * Math.cos(game.lure.bobber[0] - game.lure.bobber[1] + 10.4), 5);
    draw.surface = () => 0;
    // and the lure is under it, at its depth
    draw.write(game, null);
    expect(draw.lure[14]).toBeCloseTo(-game.lure.depth, 5);
    expect(DT).toBeGreaterThan(0);
  });
});

/** A lake with a fish on the line, from a seed. */
function onTheLine(seed = 1) {
  const { game } = newGame(seed);
  game.cast(NORTH, 0.62);
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
    game.cast(NORTH, 0.62);
    const draw = new CastDraw();
    // how far the drawn bobber stands from where the lure's bobber is, sideways, over a second of game time
    const swing = () => {
      let most = 0;
      for (let k = 0; k < 20; k++) {
        game.t += 0.05;
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
    game.cast(NORTH, 0.62);
    const draw = new CastDraw();
    const bobberZ = () => (draw.write(game, null), draw.bobber[14]);
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
