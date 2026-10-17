/**
 * The same seed, played twice, giving the same game — checked a hash at a
 * time, so a run that parts from itself says at which frame.
 *
 *   npm run determinism                    seeds 1-6, 3600 frames each
 *   npm run determinism -- --seeds 1-12 --frames 7200
 *
 * Everything that holds the game to a figure rests on this: the pace gate,
 * the fuzzer replaying a failure by seed, a bug reported with the seed it
 * happened on. What breaks it is chance taken from somewhere other than the
 * game's own source, state left over in a module between runs, or an order
 * that is not the same twice — and none of that shows as a failure anywhere
 * else, only as figures that wander.
 *
 * Each run is stepped the same, frame for frame, so the two are played the
 * same way without a recording.
 */
import { careful } from '../src/angler';
import { Game } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DT = 1 / 60;
/** How many frames apart the two runs each drop a pebble near the middle. */
const DROP_EVERY = 200;

export interface TwiceOptions {
  seed: number;
  frames: number;
  /** How many frames between hashes. */
  every?: number;
  /** For testing the check itself: something done to the game at each step of a pass. */
  meddle?: (game: Game, pass: number) => void;
}

export interface TwiceResult {
  seed: number;
  frames: number;
  /** The frame the two runs first parted at, or null if they never did. */
  diverged: number | null;
  /** The hashes of the first run, one per checkpoint. */
  checkpoints: string[];
  note: string;
}

/**
 * Everything the lake is at this moment, as one number in hex: its time,
 * every fish, every splash, the lure, the levers and the save. Two lakes with the same hash are the same lake, down to the last
 * bit of every float.
 */
export function hashGame(game: Game): string {
  // FNV-1a over the bits, which is enough to catch a thing a thousandth out of place
  let h = 0x811c9dc5;
  const bits = new DataView(new ArrayBuffer(8));
  const eat = (n: number) => {
    bits.setFloat64(0, n);
    for (let b = 0; b < 8; b++) {
      h ^= bits.getUint8(b);
      h = Math.imul(h, 0x01000193);
    }
  };
  eat(game.t);
  const { fish } = game;
  eat(fish.count);
  for (let i = 0; i < fish.count; i++) {
    eat(fish.x[i]);
    eat(fish.y[i]);
    eat(fish.depth[i]);
    eat(fish.heading[i]);
    eat(fish.speed[i]);
    eat(fish.keeps[i]);
    // which fish are cured, since two lakes that differ only in that are not the same lake
    eat(fish.cured[i]);
    // the stroke too, which only the drawing reads, so a picture of a fish is held to the seed as its place is
    eat(fish.phase[i]);
    eat(fish.turn[i]);
    eat(fish.rise[i]);
    eat(fish.pace[i]);
    eat(fish.vigour[i]);
  }
  const { splashes } = game;
  eat(splashes.count);
  eat(splashes.next);
  for (let i = 0; i < splashes.count; i++) {
    eat(splashes.x[i]);
    eat(splashes.y[i]);
    eat(splashes.at[i]);
    eat(splashes.size[i]);
  }
  const { lure } = game;
  eat(['ready', 'flying', 'sinking', 'lying', 'hooked'].indexOf(lure.phase));
  for (const n of [lure.angle, lure.power, lure.castAt, lure.depth, lure.sunk, ...lure.at, ...lure.bobber]) eat(n);
  // the bite and the fight, every number of each, so a fish's coming, nibbling and fighting are held to the seed
  const { bite, line } = game;
  eat(['none', 'coming', 'nibbling', 'biting', 'hooked', 'landed'].indexOf(bite.phase));
  for (const n of [bite.fish, bite.timer, bite.nibblesLeft, bite.twitchUntil, game.fish.held]) eat(n);
  for (let i = 0; i < game.fish.count; i++) eat(bite.wary[i]);
  for (const n of [
    line.out,
    line.tension,
    line.timer,
    line.zone,
    line.zoneSpeed,
    line.fishAt,
    line.target,
    line.meter,
    line.heft,
    +line.pulling,
    +game.reeling,
    game.bucket,
    game.catchWeight,
  ])
    eat(n);
  eat(game.contamination);
  eat(game.timeOfDay);
  for (const c of JSON.stringify(game.progress.save)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Play a seed twice, hashing every `every` frames, and say where the two runs first parted. */
export function playTwice({ seed, frames, every = 300, meddle }: TwiceOptions): TwiceResult {
  const passes: string[][] = [];
  for (let pass = 0; pass < 2; pass++) {
    const game = new Game(new Progress(memoryStore()), { random: seeded(seed) });
    const hashes: string[] = [];
    for (let f = 1; f <= frames; f++) {
      game.step(DT);
      // a pebble dropped by chance now and then, the same frames in both runs, so a splash's chance is held to the seed too
      if (f % DROP_EVERY === 0) game.dropNear(0, 0);
      // and a cast by chance as often, so the lure is played and held to the seed
      if (f % DROP_EVERY === DROP_EVERY / 2) game.cast(game.random() * Math.PI * 2, game.random());
      // and fished as an angler would, struck on the dip and played by the bar, so a fight is held too
      if (game.bite.phase === 'biting') game.strike();
      if (game.bite.phase === 'hooked') game.reel(careful(game.line.zone, game.line.zoneSpeed, game.line.fishAt));
      if (game.bite.phase === 'landed') game.stow();
      meddle?.(game, pass);
      if (f % every === 0) hashes.push(hashGame(game));
    }
    passes.push(hashes);
  }
  const [one, two] = passes;
  const at = one.findIndex((h, k) => h !== two[k]);
  if (at < 0) return { seed, frames, diverged: null, checkpoints: one, note: `seed ${seed}: the same, twice` };
  const frame = (at + 1) * every;
  return {
    seed,
    frames,
    diverged: frame,
    checkpoints: one,
    note: `seed ${seed}: the two runs parted by frame ${frame} (${one[at]} against ${two[at]}); the last they agreed on was ${at ? `frame ${at * every}` : 'the start'}`,
  };
}
