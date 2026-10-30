/** What the tests share: a new game in memory, from a seed. */
import { aimAt, flight } from '../src/cast';
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

/**
 * A cast thrown at the point (x, y) on the bed that lands on it. From the jetty's deck the cast reaches 45 from the rod's
 * tip, and a few of the things on the bed lie a little past that (they were placed from the south bank, which they have
 * always been measured from): a cast that would land more than a unit short is thrown at full power, stepped until the
 * lure sinks, and the bobber is put where the thing is, as a drift would leave it. Says whether it was thrown.
 */
function castAtThing(game: Game, x: number, y: number): boolean {
  const { angle, power } = aimAt(x, y);
  const lands = flight(angle, power).landing;
  if (!game.cast(angle, power)) return false;
  if (Math.hypot(lands[0] - x, lands[1] - y) <= 1) return true;
  for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
  game.lure.bobber[0] = x;
  game.lure.bobber[1] = y;
  game.bodies.drop(x, y);
  return true;
}

/** A cast thrown at drum `i` that lands on it (`aimAt` its place), or past the deck's reach put there. Says whether it was thrown. */
export function castAtDrum(game: Game, i: number): boolean {
  return castAtThing(game, game.drums.x[i], game.drums.y[i]);
}

/** A cast at drum `i`, stepped until the lure lies on the bed beside it (the bite untouched, a chance of nought stepped in). */
export function lieByDrum(game: Game, i: number) {
  castAtDrum(game, i);
  for (let f = 0; f < 60 * 30 && !game.lure.onBed; f++) {
    game.lure.step(game.t, DT);
    game.t += DT;
  }
}

/** A cast at treasure `i` that lands on it, or past the deck's reach put there. Says whether it was thrown. */
export function castAtTreasure(game: Game, i: number): boolean {
  return castAtThing(game, game.treasures.x[i], game.treasures.y[i]);
}

/** A cast at treasure `i`, stepped until the lure lies on the bed beside it (the bite untouched). */
export function lieByTreasure(game: Game, i: number) {
  castAtTreasure(game, i);
  for (let f = 0; f < 60 * 30 && !game.lure.onBed; f++) {
    game.lure.step(game.t, DT);
    game.t += DT;
  }
}
