/** The cure: each fish put in the bucket lowers the lake's contamination a step, kept in the save as a count. */
import { describe, expect, it } from 'vitest';
import { Angler } from '../src/angler';
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { CURE, DRUMS, contaminationAfter } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT } from './helpers';

/** A game that tells what was cured, on a save of its own that the test can read. */
function cureGame(seed = 1, json: string | null = null) {
  const told: [number, number][] = [];
  const events: GameEvents = { cured: (cured, toClean) => told.push([cured, toClean]) };
  const store = memoryStore(json);
  const game = new Game(new Progress(store), { random: seeded(seed), events });
  return { game, store, told };
}

/** The careful angler fishes until `n` fish have been cured, calling `each` after every frame; fails if it never does. */
function fishUntil(game: Game, n: number, each?: () => void, seed = 5) {
  const angler = new Angler(game, seeded(seed));
  for (let f = 0; f < 60 * 60 * 90 && cured(game) < n; f++) {
    angler.step(DT);
    each?.();
  }
  expect(cured(game), 'the angler cured them').toBeGreaterThanOrEqual(n);
}
const cured = (game: Game) => game.progress.save.cured;

describe('the cure', () => {
  it('takes twelve fish and two drums, worth two fish each, to clean the lake: sixteen fish’s worth, estimates to be tuned by playing', () => {
    expect(CURE).toEqual({ toClean: 12, total: 16 });
    expect(CURE.total).toBe(CURE.toClean + DRUMS.count * DRUMS.worth);
  });

  it('starts sick with none cured', () => {
    const { game, told } = cureGame();
    expect(game.contamination).toBe(1);
    expect(cured(game)).toBe(0);
    expect(game.stow(), 'nothing landed to stow').toBe(false);
    expect(told).toEqual([]);
    expect(game.contamination).toBe(1);
  });

  it('lowers the contamination by a sixteenth for each fish stowed, tells of it, and saves it', () => {
    const { game, store, told } = cureGame();
    for (let k = 1; k <= 3; k++) {
      fishUntil(game, k);
      expect(game.contamination).toBeCloseTo(1 - k / CURE.total, 12);
      expect(told.at(-1)).toEqual([k, CURE.toClean]);
      expect(told.length, 'told once a fish').toBe(k);
      // saved at once, as a count of fish and not as the contamination, so a retuned step re-derives it
      expect(JSON.parse(store.json!)).toEqual({
        cured: k,
        day: 1,
        drums: 0,
        journal: expect.any(Object) as unknown,
        found: [],
      });
    }
    expect(game.bucket).toBe(3);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('cleans the lake only with the drums hauled, and then nothing takes the bait, the lake staying clean', () => {
    // the drums hauled on the save, so the twelfth fish is the last of the cleaning
    const { game, told } = cureGame(2, `{"drums": ${DRUMS.count}}`);
    expect(game.contamination).toBeCloseTo(1 - (DRUMS.count * DRUMS.worth) / CURE.total, 12);
    fishUntil(game, CURE.toClean);
    expect(game.contamination).toBe(0);
    expect(game.pondClean).toBe(true);
    expect(told.at(-1)).toEqual([CURE.toClean, CURE.toClean]);
    // the angler goes on fishing for ten game minutes, and no fish comes to the lure
    const angler = new Angler(game, seeded(9));
    for (let f = 0; f < 60 * 60 * 10; f++) {
      angler.step(DT);
      expect(game.bite.phase).toBe('none');
    }
    expect(cured(game)).toBe(CURE.toClean);
    expect(game.contamination).toBe(0);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('leaves a quarter of the dirt at the twelfth fish with the drums on the bed', () => {
    const { game } = cureGame(2);
    fishUntil(game, CURE.toClean);
    expect(game.contamination).toBeCloseTo(0.25, 12);
    expect(game.pondClean, 'the drums are still there').toBe(false);
  });

  it('starts from the save: the contamination is worked out from the counts, and counts past the pond’s are clean', () => {
    expect(cureGame(1, '{"cured": 5}').game.contamination).toBeCloseTo(1 - 5 / CURE.total, 12);
    expect(cureGame(1, `{"cured": ${CURE.toClean}}`).game.contamination).toBeCloseTo(0.25, 12);
    expect(cureGame(1, `{"cured": ${CURE.toClean}, "drums": ${DRUMS.count}}`).game.contamination).toBe(0);
    expect(cureGame(1, '{"cured": 40, "drums": 9}').game.contamination).toBe(0);
    expect(cureGame(1, '{}').game.contamination).toBe(1);
  });

  it('never rises as it is played, and is checked to: only the lever may raise it', () => {
    const { game } = cureGame(3);
    let last = game.contamination;
    fishUntil(game, 4, () => {
      expect(game.contamination).toBeLessThanOrEqual(last);
      expect(checkInvariants(game)).toEqual([]);
      last = game.contamination;
    });
    // the lever, the test API's and the fuzzer's start, may put it anywhere, up too, and that is not a fault
    game.setContamination(0.9);
    expect(checkInvariants(game)).toEqual([]);
    // but a rise by any other road is a fault, and is said
    game.contamination = 0.95;
    expect(checkInvariants(game).join('\n')).toMatch(/the contamination rose from 0.9 to 0.95/);
  });

  it('never makes a lake the lever has cleaned dirtier: a cure takes the lesser of where it is and what the count says', () => {
    const { game } = cureGame(4);
    game.setContamination(0.3);
    fishUntil(game, 1);
    // the count says fifteen sixteenths; the lake was already cleaner than that, and stays so
    expect(game.contamination).toBe(0.3);
    expect(checkInvariants(game)).toEqual([]);
    // a lake the lever made dirtier than the count says is cleaned to what the count says
    game.setContamination(1);
    fishUntil(game, 2);
    expect(game.contamination).toBeCloseTo(contaminationAfter(2, 0), 12);
  });

  it('is a count that must be a whole number of fish, and is checked as one', () => {
    const { game } = cureGame();
    game.progress.save.cured = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/cured -1 fish/);
    game.progress.save.cured = 2.5;
    expect(checkInvariants(game).join('\n')).toMatch(/cured 2.5 fish/);
    game.progress.save.cured = 3;
    expect(checkInvariants(game).filter((p) => /the lake has cured/.test(p))).toEqual([]);
  });
});
