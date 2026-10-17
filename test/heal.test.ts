/** The pond heals gradually: the curve alone, then the game's water following the truth after a cure. */
import { describe, expect, it } from 'vitest';
import { healToward, quantised } from '../src/heal';
import { HEAL } from '../src/lake';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, newGame } from './helpers';

describe('healToward', () => {
  const S = 30;
  it('starts at the start and ends at the target, eased out', () => {
    expect(healToward(0.8, 0.4, 0, S)).toBe(0.8);
    // 1 - (1 - u)^3 is 0.488 at a fifth of the time: about half the heal is done by then
    const fifth = healToward(1, 0, S / 5, S);
    expect(1 - fifth).toBeCloseTo(0.488, 3);
    expect(1 - healToward(1, 0, S / 2, S)).toBeCloseTo(0.875, 3);
    expect(healToward(1, 0, S, S)).toBe(0);
  });
  it('is exactly the target at the end and after it', () => {
    for (const [from, to] of [
      [0.9, 0.3],
      [0.3, 0.9],
      [0.1, 0.0],
    ]) {
      expect(healToward(from, to, S, S)).toBe(to);
      expect(healToward(from, to, S * 5, S)).toBe(to);
    }
  });
  it('never goes past the target, from above or from below, and is monotone', () => {
    for (const [from, to] of [
      [0.9, 0.3],
      [0.3, 0.9],
    ]) {
      let last = from;
      for (let e = 0; e <= S + 5; e += 0.1) {
        const v = healToward(from, to, e, S);
        expect(v).toBeGreaterThanOrEqual(Math.min(from, to));
        expect(v).toBeLessThanOrEqual(Math.max(from, to));
        expect(Math.abs(v - to)).toBeLessThanOrEqual(Math.abs(last - to) + 1e-15);
        last = v;
      }
    }
  });
  it('treats a heal of no time as done, and holds a start that is the target', () => {
    expect(healToward(0.7, 0.2, 0, 0)).toBe(0.2);
    expect(healToward(0.5, 0.5, 3, S)).toBe(0.5);
  });
});

describe('quantised', () => {
  it('rounds to the step, keeping nought and one exact and within range', () => {
    expect(quantised(0, HEAL.step)).toBe(0);
    expect(quantised(1, HEAL.step)).toBe(1);
    expect(quantised(0.5003, HEAL.step)).toBeCloseTo(240 / 480, 12);
    for (let v = 0; v <= 1; v += 0.00137) {
      const q = quantised(v, HEAL.step);
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
      expect(Math.abs(q - v)).toBeLessThanOrEqual(HEAL.step / 2 + 1e-12);
    }
    expect(quantised(-0.2, HEAL.step)).toBe(0);
    expect(quantised(1.2, HEAL.step)).toBe(1);
  });
});

function landed(seed = 1, json: string | null = null) {
  const game = new Game(new Progress(memoryStore(json)), { random: seeded(seed) });
  const land = (i: number) => {
    game.bite.phase = 'landed';
    game.bite.fish = i;
    game.fish.held = i;
    game.lure.phase = 'hooked';
  };
  return { game, land };
}
const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += DT) g.step(DT);
};

describe('the water after a cure', () => {
  it('a cure lowers the contamination at once while the water stays', () => {
    const { game, land } = landed();
    land(0);
    game.stow();
    expect(game.contamination).toBeLessThan(1);
    expect(game.waterDirt).toBe(1);
    game.step(DT);
    expect(game.waterDirt).toBeLessThan(1);
    expect(game.waterDirt).toBeGreaterThan(game.contamination);
  });
  it('equals the contamination exactly after HEAL.seconds of steps', () => {
    const { game, land } = landed();
    land(0);
    game.stow();
    run(game, HEAL.seconds + 0.5);
    expect(game.waterDirt).toBe(game.contamination);
  });
  it('holds while paused', () => {
    const { game, land } = landed();
    land(0);
    game.stow();
    game.step(DT);
    const was = game.waterDirt;
    for (let i = 0; i < 100; i++) game.step(0);
    expect(game.waterDirt).toBe(was);
    game.step(DT);
    expect(game.waterDirt).toBeLessThan(was);
  });
  it('a second cure at 10 s does not jump and still reaches the new target 30 s later', () => {
    const { game, land } = landed();
    land(0);
    game.stow();
    run(game, 10);
    const before = game.waterDirt;
    land(1);
    game.stow();
    expect(game.waterDirt).toBe(before);
    game.step(DT);
    expect(before - game.waterDirt).toBeGreaterThan(0);
    expect(before - game.waterDirt).toBeLessThan(0.02);
    run(game, HEAL.seconds + 0.5);
    expect(game.waterDirt).toBe(game.contamination);
    expect(checkInvariants(game)).toEqual([]);
  });
  it('the lever sets the water at once and ends the heal', () => {
    const { game, land } = landed();
    land(0);
    game.stow();
    game.step(DT);
    game.setContamination(0.25);
    expect(game.waterDirt).toBe(0.25);
    run(game, 5);
    expect(game.waterDirt).toBe(0.25);
    game.setContamination(0.9);
    expect(game.waterDirt).toBe(0.9);
  });
  it('a load starts healed', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 5 }));
    expect(game.waterDirt).toBe(game.contamination);
    expect(game.contamination).toBeLessThan(1);
  });
});
