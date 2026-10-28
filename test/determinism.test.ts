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

  it('plays a night out the same, twice: a yawn and a waking are hashed', () => {
    // a little before midnight, so the yawn, the waking and the morning after are all inside the run
    const run = playTwice({ seed: 2, frames: 1500, every: 30, startsAt: 0.99 });
    expect(run.diverged, run.note).toBe(null);
    expect(run.days, 'the day went up').toBeGreaterThan(1);
  });

  it('plays a returning player out the same, twice: a save at the pond and a save in the cabin', () => {
    const pond = playTwice({
      seed: 2,
      frames: 900,
      every: 100,
      label: 'save pond',
      save: { cured: 2, day: 3, time: 0.6, place: 'pond' },
    });
    expect(pond.diverged, pond.note).toBe(null);
    expect(pond.outs, 'nobody woke in the cabin').toBe(0);
    expect(pond.days, 'the day stayed the third').toBe(3);
    const cabin = playTwice({
      seed: 2,
      frames: 900,
      every: 100,
      label: 'save cabin',
      save: { cured: 3, day: 5, place: 'cabin' },
    });
    expect(cabin.diverged, cabin.note).toBe(null);
    expect(cabin.outs, 'went down to the pond').toBe(1);
    expect(cabin.days, 'on the day it slept').toBe(5);
  });

  it('plays the Reservoir out the same, twice: from dawn, and a night with no cabin to wake in', () => {
    const dawn = playTwice({ seed: 4, lake: 'reservoir', frames: 1200, every: 100, label: 'the Reservoir' });
    expect(dawn.diverged, dawn.note).toBe(null);
    const night = playTwice({ seed: 2, lake: 'reservoir', frames: 1500, every: 30, startsAt: 0.99 });
    expect(night.diverged, night.note).toBe(null);
    expect(night.days, 'the day went up').toBeGreaterThan(1);
  });

  it('hashes the weather itself, so a game in fog differs from one in sun though fog lifts and blows nothing', () => {
    const one = newGame(5).game;
    const two = newGame(5).game;
    expect(hashGame(one)).toBe(hashGame(two));
    one.setWeather('fog');
    expect(hashGame(one)).not.toBe(hashGame(two));
  });

  it('hashes the save, so one written differently shows where the game does not', () => {
    const one = newGame(5).game;
    const two = newGame(5).game;
    one.progress.save.time = 0.4;
    expect(hashGame(one)).not.toBe(hashGame(two));
    one.progress.save.time = two.progress.save.time;
    one.progress.save.place = 'cabin';
    expect(hashGame(one)).not.toBe(hashGame(two));
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
