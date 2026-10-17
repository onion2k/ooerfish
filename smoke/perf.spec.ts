/**
 * What the game costs a player, held to a budget and to what it cost
 * before: how long it takes to boot, what a frame costs to draw at the
 * standard view, and how much is downloaded. The budget is what a good
 * browser game may cost at all; the baseline is what this one cost at the
 * last commit, so a step toward the budget is noticed as much as a step
 * over it.
 *
 *   npm run perf               the figures, held to smoke/perf-baseline.json and the budget
 *   npm run perf:update        the baseline written again, after a change meant to move it
 *
 * The boot and the frame are this machine's, headless on its own GPU, and
 * both wobble from run to run; the tolerances were set by running it several
 * times first, and the frame is the least of many samples. The download is
 * the built bundle, gzipped, and does not wobble at all, so it is held to the
 * byte. How each is judged is in `judging.ts`, with its tests.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { STANDARD, set, start, watch } from './game';
import { moved as hasMoved, type Figures } from './judging';

const BASELINE = 'smoke/perf-baseline.json';
/** How many times each rung is measured, in turn, for what the grass costs. */
const GRASS_ROUNDS = 3;
/**
 * What the grass costs a frame, the full rung's least less the lean's, and how far it may move either way. Read 0.65
 * to 0.77 ms over ten runs on 17 October 2026 (an M4 Pro, other sessions at work on it), as it read 0.67 to 0.72 on
 * 14 October: a spread of 0.12, and a quarter of a millisecond is twice that. Below it the lean rung is letting less
 * go than the grass, or the grass has got cheaper and the figure is written again; above it the grass has got dearer
 * by a third, which the full rung's frame, held to 15% of 3.6 ms, would not see alone.
 */
const GRASS_MS = { was: 0.7, tolerance: 0.25 };
/** What the game may cost at all, on this machine, whatever it cost before. */
export const BUDGET = { bootMs: 3000, frameMs: 8, bundleBytes: 400 * 1024, sceneryBytes: 900 * 1024 };

/** The built game's download: every script and stylesheet in dist/, gzipped, in bytes. */
function bundleBytes(): number {
  execFileSync('npx', ['vite', 'build', '--logLevel', 'silent'], { stdio: 'ignore' });
  const dir = 'dist/assets';
  let bytes = 0;
  for (const f of readdirSync(dir)) {
    if (!/\.(js|css)$/.test(f)) continue;
    if (!statSync(join(dir, f)).isFile()) continue;
    bytes += gzipSync(readFileSync(join(dir, f))).length;
  }
  return bytes;
}

/**
 * The scenery kit's download: every file in dist/scenery, each gzipped alone as a server would send it, in bytes. The
 * folder is flat (the manifest, the buffer and the masks), so there is no walking into folders.
 */
function sceneryBytes(): number {
  const dir = 'dist/scenery';
  let bytes = 0;
  for (const f of readdirSync(dir)) {
    if (!statSync(join(dir, f)).isFile()) continue;
    bytes += gzipSync(readFileSync(join(dir, f))).length;
  }
  return bytes;
}

test('boots, draws and downloads within budget, and as it did before', async ({ page }, info) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  const bundle = bundleBytes();
  const scenery = sceneryBytes();
  // the governor chooses, as it does for a player, so the boot figure holds the frame it measures; a machine too busy
  // to draw the full rung inside the budget would step down, and the frame below would then not be the full rung's
  await start(page, { seed: 11, paused: true, rung: 'auto' });
  const boot = await page.evaluate(() => window.game!.bootMs);
  expect(await page.evaluate(() => window.game!.rung()), 'the governor kept the full rung').toBe('full');
  // the standard scene, three seconds on
  await set(page, STANDARD, 180);
  // the first measuring on a page just booted: it keeps the GPU drawing for a quarter of a second before it times
  const frame = await page.evaluate(() => window.game!.measureFrame());
  const now: Figures = {
    bootMs: Math.round(boot),
    frameMs: Math.round(frame * 1000) / 1000,
    bundleBytes: bundle,
    sceneryBytes: scenery,
  };
  info.annotations.push({ type: 'perf', description: JSON.stringify(now) });
  console.log(
    `perf: boot ${now.bootMs} ms, frame ${now.frameMs} ms, download ${now.bundleBytes} bytes (${(now.bundleBytes / 1024).toFixed(1)} kB), scenery ${now.sceneryBytes} bytes (${(now.sceneryBytes / 1024).toFixed(1)} kB)`,
  );

  if (process.env.PERF_UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    console.log('perf baseline written');
  } else {
    let baseline: Partial<Figures> = {};
    try {
      baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Partial<Figures>;
    } catch {
      throw new Error('no baseline: run npm run perf:update first');
    }
    const moved: string[] = [];
    for (const key of ['bootMs', 'frameMs', 'bundleBytes', 'sceneryBytes'] as const) {
      const was = baseline[key];
      if (was === undefined) {
        moved.push(`${key} ${now[key]} (not in the baseline)`);
        continue;
      }
      const out = hasMoved(key, was, now[key]);
      console.log(`  ${key}: ${was} -> ${now[key]} (${out ? 'MOVED' : 'within tolerance'})`);
      if (out) moved.push(`${key} ${was} -> ${now[key]}`);
    }
    expect(moved, 'moved from the baseline: if that was meant, npm run perf:update, and say why').toEqual([]);
  }
  expect(now.bootMs, 'boot within budget').toBeLessThanOrEqual(BUDGET.bootMs);
  expect(now.frameMs, 'frame within budget').toBeLessThanOrEqual(BUDGET.frameMs);
  expect(now.bundleBytes, 'download within budget').toBeLessThanOrEqual(BUDGET.bundleBytes);
  expect(now.sceneryBytes, 'scenery within budget').toBeLessThanOrEqual(BUDGET.sceneryBytes);
  expect(problems).toEqual([]);
});

test('draws the water, at every time of day, splashing, within the frame budget', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  const costs: string[] = [];
  let first = true;
  for (const time of ['day', 'night']) {
    await set(page, { ...STANDARD, time, dirt: 1 }, 60);
    // twelve splashes live, the most a lake holds, their rings spreading and their droplets in the air; and a cast
    // in the air with its line, and another being aimed, its preview drawn
    await page.evaluate(() => {
      const g = window.game!;
      for (let k = 0; k < 12; k++) g.dropNear();
      g.cast(Math.PI / 2 + 0.2, 0.8);
      g.aim({ angle: Math.PI / 2 - 0.2, power: 0.6 });
      g.step(15);
    });
    // the first measured keeps the GPU drawing a quarter of a second; the rest follow on from it
    const ms = await page.evaluate((warm) => window.game!.measureFrame(warm), first ? undefined : 60);
    first = false;
    costs.push(`${time}: ${ms.toFixed(3)} ms`);
    expect(ms, `the water at ${time} within the frame budget`).toBeLessThanOrEqual(BUDGET.frameMs);
  }
  console.log(`frame, the water: ${costs.join(', ')}`);
  expect(problems).toEqual([]);
});

test('the lean rung saves the grass, and the grass costs what it did', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  await set(page, STANDARD, 60);
  // the rungs measured in turn, full and lean, so a spell of the machine at other work falls on both alike, and each
  // rung's frame the least of its readings, since a busy machine only ever adds to one
  const full: number[] = [],
    lean: number[] = [];
  for (let round = 0; round < GRASS_ROUNDS; round++)
    for (const rung of ['full', 'lean'] as const) {
      await page.evaluate((r) => window.game!.rung(r), rung);
      await page.evaluate(() => window.game!.step(2));
      const ms = await page.evaluate(
        (warm) => window.game!.measureFrame(warm),
        round === 0 && rung === 'full' ? undefined : 60,
      );
      (rung === 'full' ? full : lean).push(ms);
    }
  const grass = Math.min(...full) - Math.min(...lean);
  console.log(
    `grass: ${grass.toFixed(3)} ms, full ${full.map((m) => m.toFixed(3)).join(' ')}, lean ${lean.map((m) => m.toFixed(3)).join(' ')}`,
  );
  expect(Math.abs(grass - GRASS_MS.was), `the grass's cost, ${GRASS_MS.was} ms before`).toBeLessThanOrEqual(
    GRASS_MS.tolerance,
  );
  expect(problems).toEqual([]);
});
