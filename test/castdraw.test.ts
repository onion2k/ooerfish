/** The cast as it is drawn: a piece between two ends, the line's sag, the preview, the bobber and the lure. */
import { describe, expect, it } from 'vitest';
import { flight, rodTip } from '../src/cast';
import { CastDraw, LINE_PIECES, PREVIEW_DOTS, piece } from '../src/castdraw';
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
    const first = carried(draw.line, 0, -0.5, 0, 0);
    for (let k = 0; k < 3; k++) expect(first[k]).toBeCloseTo(tip[k], 4);
    const last = carried(draw.line, LINE_PIECES - 1, 0.5, 0, 0);
    for (let k = 0; k < 3; k++) expect(last[k]).toBeCloseTo(game.lure.at[k], 4);
    // halfway along, it hangs below the straight line from the tip to the lure
    const mid = carried(draw.line, LINE_PIECES / 2, -0.5, 0, 0);
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
    // and the lure is under it, at its depth
    draw.write(game, null);
    expect(draw.lure[14]).toBeCloseTo(-game.lure.depth, 5);
    expect(DT).toBeGreaterThan(0);
  });
});
