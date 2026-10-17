/**
 * The same seed gives the same game, twice over. Everything that holds the
 * game to a figure rests on that; where it fails, those figures wander for
 * reasons nobody can see.
 */
import { describe, expect, it } from 'vitest';
import { hashGame, playTwice } from '../scripts/determinism';
import { DT, newGame } from './helpers';

describe('the same seed gives the same game', () => {
  it('plays out the same, twice from a seed', () => {
    const run = playTwice({ seed: 3, frames: 1200, every: 100 });
    expect(run.diverged, run.note).toBe(null);
    expect(run.checkpoints.length).toBe(12);
  });

  it('hashes what a lake is, so anything moved shows', () => {
    const one = newGame(5).game;
    const two = newGame(5).game;
    for (let f = 0; f < 60; f++) {
      one.step(DT);
      two.step(DT);
    }
    const hash = hashGame(one);
    expect(hashGame(two)).toBe(hash);
    // the clock a millionth of a second out, a fish a thousandth out of place, a lever moved: each a different lake
    one.t += 1e-6;
    expect(hashGame(one)).not.toBe(hash);
    one.t -= 1e-6;
    expect(hashGame(one)).toBe(hash);
    // two games alike but for the water they show
    const water = one.waterDirt;
    one.waterDirt = water + 0.001;
    expect(hashGame(one)).not.toBe(hash);
    one.waterDirt = water;
    expect(hashGame(one)).toBe(hash);
    one.fish.x[3] += 0.001;
    expect(hashGame(one)).not.toBe(hash);
    one.fish.x[3] -= 0.001;
    one.setContamination(0.5);
    expect(hashGame(one)).not.toBe(hash);
    const was = hashGame(one);
    one.drop(1, 1);
    expect(hashGame(one), 'a splash').not.toBe(was);
    const before = hashGame(one);
    one.cast(Math.PI / 2, 0.5);
    expect(hashGame(one), 'a cast').not.toBe(before);
  });

  it('says where two runs first parted, when they do', () => {
    let frame = 0;
    const run = playTwice({
      seed: 4,
      frames: 400,
      every: 100,
      // a second run that nudges the clock part way through: the check must catch it, and say when
      meddle: (game, pass) => {
        if (pass === 1 && ++frame === 250) game.t += 0.01;
      },
    });
    expect(run.diverged).toBe(300);
    expect(run.note).toMatch(/parted by frame 300/);
  });

  it('hashes which fish are cured, so two runs that differ only in that part', () => {
    const one = newGame(5).game;
    const two = newGame(5).game;
    expect(hashGame(two)).toBe(hashGame(one));
    one.fish.cured[2] = 1;
    expect(hashGame(one), 'a fish cured').not.toBe(hashGame(two));
    two.fish.cured[3] = 1;
    expect(hashGame(two), 'a different fish cured').not.toBe(hashGame(one));
  });
});
