/** The fight's snapshot: what the bar and the button show, as plain numbers and words that a phone could draw from. */
import { describe, expect, it } from 'vitest';
import { cardWords, fightPicture } from '../src/fightview';
import { Game } from '../src/game';
import { HOME } from '../src/lakes';
import { TREASURE_RULES } from '../src/rules';
import { careful } from '../src/angler';
import { DT, newGame } from './helpers';

const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };

const NORTH = Math.PI / 2;
const MIDDLE = 0.55;

/** A game cast out and run to the bite's window. */
function biting(seed = 1): Game {
  const { game } = newGame(seed);
  game.cast(NORTH + 0.15, MIDDLE);
  for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
  expect(game.bite.phase).toBe('biting');
  return game;
}

/** A game with a fish hooked and a few seconds of the fight played. */
function hooked(seed = 1): Game {
  const game = biting(seed);
  game.strike();
  expect(game.bite.phase).toBe('hooked');
  for (let f = 0; f < 120; f++) {
    game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt, game.line.figures.width));
    game.step(DT);
  }
  expect(game.bite.phase).toBe('hooked');
  return game;
}

/** A game that has landed its fish. */
function landed(seed = 1): Game {
  const game = biting(seed);
  game.strike();
  for (let f = 0; f < 7200 && game.bite.phase === 'hooked'; f++) {
    game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt, game.line.figures.width));
    game.step(DT);
  }
  game.reel(false);
  expect(game.bite.phase).toBe('landed');
  return game;
}

describe('fightPicture', () => {
  it('says nothing is on, with no button, before the cast', () => {
    const { game } = newGame(1);
    const p = fightPicture(game);
    expect(p.phase).toBe('none');
    expect(p.words).toBe('');
    expect(p.button).toBe('');
    expect(p.pulse).toBe(0);
    expect(p.reeling).toBe(false);
  });

  it('has the Strike button, pulsing, while the window is open', () => {
    const game = biting();
    const p = fightPicture(game);
    expect(p.phase).toBe('biting');
    expect(p.button).toBe('Strike');
    expect(p.biting).toBe(true);
    expect(p.pulse).toBeGreaterThanOrEqual(0);
    expect(p.pulse).toBeLessThanOrEqual(1);
    expect(p.words).toBe('');
  });

  it('matches game.fishing() while a fish is hooked, with the Reel button and the words', () => {
    const game = hooked();
    const p = fightPicture(game);
    const f = {
      phase: game.bite.phase,
      tension: game.line.tension,
      reeling: game.reeling,
      zone: game.line.zone,
      fishAt: game.line.fishAt,
      meter: game.line.meter,
    };
    expect(p).toMatchObject(f);
    expect(p.width).toBeGreaterThan(0);
    expect(p.button).toBe('Reel');
    expect(p.biting).toBe(false);
    expect(p.pulse).toBe(0);
    expect(p.words).toBe(game.line.inZone() ? 'in the zone' : 'out of the zone');
  });

  it('says both words as the fish leaves and enters the zone', () => {
    const game = hooked();
    const seen = new Set<string>();
    for (let f = 0; f < 600 && game.bite.phase === 'hooked'; f++) {
      game.reel(f % 90 < 45);
      game.step(DT);
      const p = fightPicture(game);
      if (p.phase === 'hooked') seen.add(p.words);
    }
    expect([...seen].sort()).toEqual(['in the zone', 'out of the zone']);
  });

  it('keeps the Strike/Reel button while the lure sinks, and drops it once landed', () => {
    const { game } = newGame(1);
    game.cast(NORTH + 0.15, MIDDLE);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(fightPicture(game).button).toBe('Strike');
    const done = landed();
    const p = fightPicture(done);
    expect(p.phase).toBe('landed');
    expect(p.words).toBe('');
  });

  it('reads Tug while the lure is snagged in the reeds, and Strike again once it is freed', () => {
    const { game } = newGame(1);
    game.snagAt(0);
    expect(game.lure.phase).toBe('snagged');
    expect(fightPicture(game).button).toBe('Tug');
    game.reel(true);
    for (let f = 0; f < 60; f++) game.step(DT);
    game.reel(false);
    expect(game.lure.phase).toBe('sinking');
    expect(fightPicture(game).button).toBe('Strike');
  });

  it('is plain data: it survives JSON unchanged, in every phase', () => {
    for (const game of [newGame(1).game, biting(), hooked(), landed()]) {
      const p = fightPicture(game);
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      for (const v of Object.values(p)) expect(['number', 'string', 'boolean']).toContain(typeof v);
    }
  });

  it('is the same for the same game state, and does not change the game', () => {
    const a = hooked(3),
      b = hooked(3);
    expect(fightPicture(a)).toEqual(fightPicture(b));
    expect(fightPicture(a)).toEqual(fightPicture(a));
  });
});

describe('cardWords', () => {
  it('names a drum of waste, with no temper, and its weight', () => {
    expect(cardWords('drum', 'steady', 42)).toEqual({
      name: 'drum of waste',
      weight: '42.00 kg',
      line: 'a drum of waste, 42.00 kg',
    });
    expect(cardWords('drum', 'feisty', 42).name, 'a drum has no temper').toBe('drum of waste');
  });

  it('names the temper, the kind and the weight, for each kind', () => {
    expect(cardWords(2, 'feisty', 3.62).line).toBe('a feisty pike, 3.62 kg');
    expect(cardWords(0, 'calm', 0.5).line).toBe('a calm sunny bream, 0.50 kg');
    expect(cardWords(1, 'steady', 1.234)).toEqual({
      name: 'steady glowing perch',
      weight: '1.23 kg',
      line: 'a steady glowing perch, 1.23 kg',
    });
  });

  it('names each treasure, its weight and its line, and the bottle’s note, with no temper', () => {
    TREASURES.list.forEach((t, i) => {
      const words = cardWords({ treasure: i }, 'feisty', t.weight);
      expect(words.name, t.id).toBe(t.name);
      expect(words.weight).toBe(`${t.weight.toFixed(2)} kg`);
      expect(words.line).toBe(`a ${t.name}, ${t.weight.toFixed(2)} kg`);
      expect(words.about, `${t.id}'s line about it`).toBe(t.line);
      if (t.id === 'bottle' || t.page !== undefined) expect(words.note, `${t.id}'s words`).toBe(t.note);
      else expect(words.note, `${t.id} holds no note`).toBeUndefined();
    });
    expect(cardWords({ treasure: 2 }, 'calm', 0.6).line).toBe('a Sunny Atom lunchbox, 0.60 kg');
    expect(cardWords({ treasure: 2 }, 'calm', 0.6).about).toBe('Empty, thank goodness.');
    expect(cardWords({ treasure: 4 }, 'calm', 0.3).note).toBe(
      "If you're reading this, the fish are glowing again. Bring them home. — E.",
    );
  });

  it('says nothing about a fish or a drum beyond its name and weight', () => {
    expect(cardWords(0, 'calm', 0.5).about).toBeUndefined();
    expect(cardWords('drum', 'steady', 42).about).toBeUndefined();
  });
});
