/**
 * What the smoke tests share: starting the game in a page, from a save if
 * the test wants one, and waiting until it is ready; and watching the page
 * for errors. Everything else a test does goes through `window.game`, the
 * game's test API (`src/debug.ts`), whose types these tests compile against.
 */
import { expect, type Page } from '@playwright/test';
import type { GameApi } from '../src/debug';
import type { SaveSaid } from '../src/progress';
import type { Weather } from '../src/lake';

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
 * everything after is the test's own stepping. The page is put on the full
 * rung unless a test says otherwise: the governor would choose by how busy the
 * machine is, and a picture or a frame that depended on that would hold the
 * game to the machine's mood. `rung: 'auto'` lets the governor choose.
 */
export async function start(
  page: Page,
  options: {
    save?: SaveSaid;
    seed?: number;
    paused?: boolean;
    rung?: 'full' | 'lean' | 'auto';
    /** More of the address, such as `phonelink: 'local'`, for a test that needs the page asked for something. */
    query?: Record<string, string>;
    /** Keep the load's fade-in, which a page is otherwise let out of at once so no picture is taken through it. */
    fade?: boolean;
  } = {},
) {
  const { save, seed, paused, rung = 'full', query: more = {}, fade = false } = options;
  if (save)
    await page.addInitScript((s) => {
      if (sessionStorage.getItem('game-test-seeded')) return;
      localStorage.setItem('ooerfish-save-v1', JSON.stringify(s));
      sessionStorage.setItem('game-test-seeded', '1');
    }, save);
  const query = new URLSearchParams();
  if (seed !== undefined) query.set('seed', String(seed));
  if (paused) query.set('paused', '1');
  if (rung !== 'auto') query.set('rung', rung);
  for (const [name, value] of Object.entries(more)) query.set(name, value);
  await page.goto(query.size ? `/?${query.toString()}` : '/');
  await ready(page);
  // every load fades in from black over a second of stepped time, and a paused page steps only when told: the pond is
  // let out of it, so a picture or a count of frames never depends on it (the fade has its own stages)
  if (!fade) await page.evaluate(() => window.game!.arrived());
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

/** A scene: the lake as dirty as that, at a time of day, from a view. */
export interface Scene {
  dirt: number;
  time: string;
  view: string;
  caustics?: 'on' | 'off';
  /** The page's mode, look unless said, put after the view: cast puts the camera at the shore whatever the view. */
  mode?: 'look' | 'cast';
  /** The player first put in the cabin the way the game does it: the clock carried past midnight, and the yawn stepped through to the waking. */
  cabin?: boolean;
  /** The day's weather put by the lever before the rest, sunny unless said, so no picture depends on the day it is taken on. */
  weather?: Weather;
}

/**
 * The standard scene, which the perf gate measures and the pictures start from: the water half cleaned, by day,
 * from the shore.
 */
export const STANDARD: Scene = { dirt: 0.5, time: 'day', view: 'shore' };

/** The room at dawn: the player woken in the cabin, seen from the pillow, the lake behind its walls half cleaned. */
export const CABIN_DAWN: Scene = { dirt: 0.5, time: 'dawn', view: 'cabin', cabin: true };

/** The page set to a scene through the test API, and `frames` frames stepped, so the fish and the water are on. */
export async function set(page: Page, scene: Scene, frames = 120) {
  await page.evaluate(
    async ([s, n]) => {
      const g = window.game!;
      if (s.cabin) {
        // just short of midnight, then a step past it starts the yawn, and the yawn's own seconds wake the player in the cabin
        g.clock(0.9995);
        g.step(150);
      }
      await g.weather(s.weather ?? 'sunny');
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

/** The corners that tell how to look round, the look or cast button, the Row button, the pond's gauge and lines, the menu and the bucket: not the look. */
export async function hideOverlays(page: Page) {
  await page.evaluate(() => {
    for (const id of [
      'help',
      'modeButton',
      'rowButton',
      'anchorButton',
      'pond',
      'welcome',
      'toast',
      'menu',
      'bucket',
      'morning',
      'radio',
      'downButton',
      'elsewhereButton',
      'yawn',
    ])
      document.getElementById(id)!.hidden = true;
    // the boot cover's own display rule beats the hidden attribute, and its fade runs on the wall clock, so a picture
    // taken right after boot could catch its text fading: it is taken off the page.
    document.getElementById('boot')!.style.display = 'none';
  });
}

/** Every picture of the lake, by name, which the look holds and the film (`scripts/film.ts`) can film: dirty and clean by day, dirty at dusk and night, and from the boat and overhead. */
export const PICTURES: [string, Scene][] = [
  ['sick-day', { dirt: 1, time: 'day', view: 'shore' }],
  ['clear-day', { dirt: 0, time: 'day', view: 'shore' }],
  ['sick-dusk', { dirt: 1, time: 'dusk', view: 'shore' }],
  ['half-boat', { dirt: 0.5, time: 'day', view: 'boat' }],
  ['sick-night', { dirt: 1, time: 'night', view: 'shore' }],
  ['half-overhead', { dirt: 0.5, time: 'day', view: 'overhead' }],
];

/**
 * The cast the look pictures and the film throw from the shore by day: the lake a little dirty, settled this many
 * frames, the cast's angle and power (into the water ahead and a little left), and the frames until it is landed and
 * sinking under its bobber.
 */
export const CAST_SHOT = {
  scene: { dirt: 0.2, time: 'day', view: 'shore' } as Scene,
  settle: 60,
  angle: Math.PI / 2 + 0.2,
  power: 0.7,
  sinking: 175,
} as const;

/**
 * The splash the look pictures and the film take from the boat: the lake a little dirty by day, settled this many frames,
 * a pebble dropped in front of the boat, and the frames after it the picture is taken at, a third of a second, its
 * droplets fallen back and its first ripples going out.
 */
export const SPLASH_SHOT = {
  scene: { dirt: 0.3, time: 'day', view: 'boat' } as Scene,
  settle: 60,
  at: [8, 6] as [number, number],
  after: 20,
} as const;

/** The page put at the splash's scene, or `scene` over it, the pebble dropped and the game stepped `after` frames. */
export async function splashing(page: Page, scene: Partial<Scene> = {}, after: number = SPLASH_SHOT.after) {
  await set(page, { ...SPLASH_SHOT.scene, ...scene }, SPLASH_SHOT.settle);
  await page.evaluate(
    ([at, n]) => {
      window.game!.drop(at[0], at[1]);
      window.game!.step(n);
    },
    [SPLASH_SHOT.at, after] as const,
  );
}

/** The page put at the cast's scene, the cast thrown, and the game stepped until it is landed and sinking. */
export async function castSinking(page: Page) {
  await set(page, CAST_SHOT.scene, CAST_SHOT.settle);
  await page.evaluate((c) => {
    window.game!.cast(c.angle, c.power);
    window.game!.step(c.sinking);
  }, CAST_SHOT);
}
