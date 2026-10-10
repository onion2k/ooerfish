/**
 * The game as a player gets it: served by Vite, run in Chromium on the real
 * GPU, with a fresh save each test. What the unit tests cannot reach — the
 * renderer, the frame loop, the page — checked for the things that would
 * make it plainly broken: an error, a black screen, a page wider than a
 * phone.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { ready, start, watch } from './game';

/** How many frames the page draws in a second. */
function framesInASecond(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const began = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - began < 1000) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** How much a screenshot has in it: the spread of its brightness, and the share of it that is not near black. */
function content(png: Buffer) {
  const img = PNG.sync.read(png);
  let sum = 0,
    sq = 0,
    lit = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const y = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    sum += y;
    sq += y * y;
    if (y > 40) lit++;
  }
  const mean = sum / n;
  return { spread: Math.sqrt(sq / n - mean * mean), lit: lit / n };
}

test('boots with no errors and draws the lake', async ({ page }, info) => {
  const problems = watch(page);
  await start(page);
  expect(await framesInASecond(page)).toBeGreaterThan(20);
  const shot = await page.screenshot();
  await info.attach('lake', { body: shot, contentType: 'image/png' });
  const c = content(shot);
  expect(c.lit, 'share of the screen lit').toBeGreaterThan(0.2);
  expect(c.spread, 'variety in the picture').toBeGreaterThan(20);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test("works each of the lab's controls by mouse, and keeps them in the address", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const settings = () => page.evaluate(() => window.game!.settings());
  const pressed = (label: string) => page.getByRole('button', { name: label, exact: true });

  await pressed('Lit ripple').click();
  await expect.poll(settings).toMatchObject({ water: 'ripple' });
  await expect(pressed('Lit ripple')).toHaveAttribute('aria-pressed', 'true');
  await expect(pressed('Open water')).toHaveAttribute('aria-pressed', 'false');

  // the slider dragged a quarter of the way from clear to sick, by the mouse, as a viewer does
  const box = (await page.locator('#dirt').boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await settings()).dirt).toBeGreaterThan(0.15);
  expect((await settings()).dirt).toBeLessThan(0.35);
  expect((await page.evaluate(() => window.game!.state())).contamination).toBe((await settings()).dirt);

  await pressed('Dusk').click();
  await expect.poll(settings).toMatchObject({ time: 'dusk' });
  expect((await page.evaluate(() => window.game!.state())).timeOfDay).toBe(0.75);

  await pressed('Overhead').click();
  await expect.poll(settings).toMatchObject({ view: 'overhead' });
  const high = await page.evaluate(() => window.game!.camera());
  expect(high.position[2], 'overhead is high over the lake').toBeGreaterThan(80);

  // the address says it all, and a reload of it brings the same lake back
  const said = await settings();
  const url = new URL(page.url());
  expect(url.searchParams.get('water')).toBe('ripple');
  expect(url.searchParams.get('time')).toBe('dusk');
  expect(url.searchParams.get('view')).toBe('overhead');
  await page.reload();
  await ready(page);
  expect(await settings()).toEqual(said);
  await expect(pressed('Lit ripple')).toHaveAttribute('aria-pressed', 'true');
  await expect(pressed('Dusk')).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('refuses what the address says that it does not know, and draws the defaults', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/?water=lava&dirt=lots&time=teatime&view=moon&paused=1');
  await ready(page);
  expect(await page.evaluate(() => window.game!.settings())).toEqual({
    water: 'open',
    dirt: 1,
    time: 'day',
    view: 'shore',
  });
  expect(problems).toEqual([]);
});

test('puts the camera where each view says', async ({ page }) => {
  await start(page, { seed: 1, paused: true });
  for (const [view, near] of [
    ['shore', 62],
    ['boat', 18],
    ['overhead', 110],
    ['phone', 105],
  ] as const) {
    await page.evaluate((v) => window.game!.view(v), view);
    const cam = await page.evaluate(() => window.game!.camera());
    const away = Math.hypot(...cam.position.map((p, k) => p - cam.target[k]));
    expect(away, `${view}: how far the camera stands`).toBeCloseTo(near, 0);
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

  test('boots, and nothing is wider than the screen', async ({ page }, info) => {
    const problems = watch(page);
    await start(page);
    await expect(page.locator('#view')).toBeVisible();
    await info.attach('phone', { body: await page.screenshot(), contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
    // the lab's panel fits the screen open, and folds away by its title
    const panel = (await page.locator('#labPanel').boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(400);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    await page.getByText('Lake lab').tap();
    await expect(page.locator('#lab')).toBeHidden();
    expect(problems).toEqual([]);
  });
});
