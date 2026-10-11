/**
 * What the smoke tests share: starting the game in a page, from a save if
 * the test wants one, and waiting until it is ready; and watching the page
 * for errors. Everything else a test does goes through `window.game`, the
 * game's test API (`src/debug.ts`), whose types these tests compile against.
 */
import { expect, type Page } from '@playwright/test';
import type { GameApi } from '../src/debug';
import type { Save } from '../src/progress';

declare global {
  interface Window {
    game?: GameApi;
  }
}

/** Errors on the page, and requests that failed, collected as they happen. */
export function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  return problems;
}

/**
 * The game in the page, from a save if given (written before the page's own
 * scripts run, and only on the first load, so a reload keeps what was
 * played), and ready. `seed` makes chance the same from before the game is
 * built, and `paused` stops it before a frame of its own has run, so
 * everything after is the test's own stepping.
 */
export async function start(page: Page, options: { save?: Partial<Save>; seed?: number; paused?: boolean } = {}) {
  const { save, seed, paused } = options;
  if (save)
    await page.addInitScript((s) => {
      if (sessionStorage.getItem('game-test-seeded')) return;
      localStorage.setItem('ooerfish-save-v1', JSON.stringify(s));
      sessionStorage.setItem('game-test-seeded', '1');
    }, save);
  const query = new URLSearchParams();
  if (seed !== undefined) query.set('seed', String(seed));
  if (paused) query.set('paused', '1');
  await page.goto(query.size ? `/?${query.toString()}` : '/');
  await ready(page);
}

/**
 * A one-finger drag on a touch screen, from one point of the page to another, by the browser's own touch events, as a
 * finger on a phone makes them: Playwright's touchscreen only taps.
 */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 6) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', from.x, from.y);
  for (let k = 1; k <= steps; k++)
    await touch('touchMove', from.x + ((to.x - from.x) * k) / steps, from.y + ((to.y - from.y) * k) / steps);
  await touch('touchEnd', to.x, to.y);
  await cdp.detach();
}

/** Wait until the game is booted and its frame loop running, or say what the boot screen was stuck on. */
export async function ready(page: Page) {
  try {
    await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
    await expect(page.locator('#boot')).toHaveClass(/gone/);
  } catch {
    throw new Error(`the game did not boot: ${await page.locator('#bootMsg').textContent()}`);
  }
}

/** A scene in the lab: the lake as dirty as that, at a time of day, from a view. */
export interface Scene {
  dirt: number;
  time: string;
  view: string;
  caustics?: 'on' | 'off';
  /** The page's mode, look unless said, put after the view: cast puts the camera at the shore whatever the view. */
  mode?: 'look' | 'cast';
}

/**
 * The standard scene, which the perf gate measures and the pictures start from: the water half cleaned, by day,
 * from the shore.
 */
export const STANDARD: Scene = { dirt: 0.5, time: 'day', view: 'shore' };

/** The lab set to a scene through the test API, and `frames` frames stepped, so the fish and the water are on. */
export async function set(page: Page, scene: Scene, frames = 120) {
  await page.evaluate(
    async ([s, n]) => {
      const g = window.game!;
      await g.dirt(s.dirt);
      await g.time(s.time);
      await g.view(s.view);
      await g.caustics(s.caustics ?? 'on');
      await g.mode(s.mode ?? 'look');
      g.step(n);
    },
    [scene, frames] as const,
  );
}
