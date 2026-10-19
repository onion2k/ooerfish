/**
 * Every seed played twice, side by side: see `determinism.ts`.
 *
 *   npm run determinism                      seeds 1-6, 3600 frames each
 *   npm run determinism -- --seeds 1-12 --frames 7200 --every 600
 *
 * Fails, and says at which frame, if any seed does not play out the same way
 * twice. A failure is not in the feature that was just written: it is chance
 * from somewhere other than the seed, or state left over between runs.
 */
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { playTwice, type TwiceOptions, type TwiceResult } from './determinism';

/** Where the second run of each seed starts the clock: seven seconds short of midnight. */
const MIDNIGHT_EVE = 0.99;
/** The two saves a returning player opens: at the pond in the afternoon, and in the cabin, where the clock is dawn. */
const POND_SAVE = { label: 'save pond', save: { cured: 2, day: 3, time: 0.6, place: 'pond' } } as const;
const CABIN_SAVE = { label: 'save cabin', save: { cured: 3, day: 5, place: 'cabin' } } as const;

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const range = (value('seeds') ?? '1-6').split('-').map(Number);
  const seeds = Array.from({ length: (range[1] ?? range[0]) - range[0] + 1 }, (_, k) => range[0] + k);
  const frames = +(value('frames') ?? 3600);
  const every = +(value('every') ?? 300);
  const started = performance.now();
  // each seed from dawn, and again from a little before midnight so a yawn and a waking are hashed
  const queue: TwiceOptions[] = seeds.flatMap((seed) => [
    { seed, frames, every },
    { seed, frames, every, startsAt: MIDNIGHT_EVE },
    { seed, frames, every, ...POND_SAVE },
    { seed, frames, every, ...CABIN_SAVE },
  ]);
  const results: TwiceResult[] = [];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(seeds.length, availableParallelism() - 1)) }, async () => {
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
        const at = job;
        results.push(
          await new Promise<TwiceResult>((resolve, reject) => {
            const worker = new Worker(new URL(`file://${process.argv[1]}`), { workerData: at });
            worker.once('message', resolve);
            worker.once('error', reject);
          }),
        );
      }
    }),
  );
  results.sort((a, b) => a.seed - b.seed || (a.note < b.note ? -1 : 1));
  const parted = results.filter((r) => r.diverged !== null);
  console.log(
    `${seeds.length} seed${seeds.length === 1 ? '' : 's'}, from dawn, from before midnight and from two saves, each played twice, ${frames} frames each (${((performance.now() - started) / 1000).toFixed(1)} s)`,
  );
  for (const r of parted) console.error(`  ${r.note}`);
  // a run from before midnight that never woke hashed no night, which would be a check that checks nothing
  const dry = results.filter((r) => r.note.includes(` from ${MIDNIGHT_EVE}`) && r.days < 2);
  for (const r of dry) console.error(`  ${r.note}: no night was crossed, so none was hashed`);
  // and a cabin save that never went down played no pond, which would be as little
  const shut = results.filter((r) => r.note.includes(` from ${CABIN_SAVE.label}`) && r.outs < 1);
  for (const r of shut) console.error(`  ${r.note}: the cabin was never left, so no pond was played`);
  if (dry.length || shut.length) process.exitCode = 1;
  if (parted.length) {
    console.error(
      `\n${parted.length} seed${parted.length === 1 ? ' does' : 's do'} not play out the same twice: look for chance taken from somewhere other than the game's own source, state kept in a module between runs, or an order that is not the same twice`,
    );
    process.exitCode = 1;
  } else {
    console.log(`  the same twice, every seed (${results[0].checkpoints.length} checkpoints each)`);
  }
}

if (!isMainThread) {
  parentPort!.postMessage(playTwice(workerData as TwiceOptions));
} else {
  await main();
}
