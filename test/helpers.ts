/** What the tests share: a new game in memory, from a seed. */
import { aimAt } from '../src/cast';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

export const DT = 1 / 60;

export function newGame(seed = 1, json: string | null = null) {
  const store = memoryStore(json);
  const game = new Game(new Progress(store), { random: seeded(seed) });
  return { game, store };
}

/** Play `frames` frames. */
export function settle(game: Game, frames = 120) {
  for (let f = 0; f < frames; f++) game.step(DT);
}

/** Every fish in the pond cured, so none comes to the lure and a test of a drum is about the drum alone. */
export function cureAll(game: Game) {
  game.fish.cured.fill(1, 0, game.fish.count);
}

/** A cast thrown at drum `i` that lands on it (`aimAt` its place). Says whether it was thrown. */
export function castAtDrum(game: Game, i: number): boolean {
  const { angle, power } = aimAt(game.drums.x[i], game.drums.y[i]);
  return game.cast(angle, power);
}

/** A cast at drum `i`, stepped until the lure lies on the bed beside it (the bite untouched, a chance of nought stepped in). */
export function lieByDrum(game: Game, i: number) {
  castAtDrum(game, i);
  for (let f = 0; f < 60 * 30 && !game.lure.onBed; f++) {
    game.lure.step(game.t, DT);
    game.t += DT;
  }
}

/** A cast at treasure `i` that lands on it. Says whether it was thrown. */
export function castAtTreasure(game: Game, i: number): boolean {
  const { angle, power } = aimAt(game.treasures.x[i], game.treasures.y[i]);
  return game.cast(angle, power);
}

/** A cast at treasure `i`, stepped until the lure lies on the bed beside it (the bite untouched). */
export function lieByTreasure(game: Game, i: number) {
  castAtTreasure(game, i);
  for (let f = 0; f < 60 * 30 && !game.lure.onBed; f++) {
    game.lure.step(game.t, DT);
    game.t += DT;
  }
}
