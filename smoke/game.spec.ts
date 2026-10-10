/**
 * The game as a player gets it: served by Vite, run in Chromium on the real
 * GPU, with a fresh save each test. What the unit tests cannot reach — the
 * renderer, the frame loop, the page — checked for the things that would
 * make it plainly broken: an error, a black screen, a page wider than a
 * phone.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { ready, set, start, watch } from './game';

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

  // the see-through water, and its caustics turned off and on again
  await pressed('See-through').click();
  await expect.poll(settings).toMatchObject({ water: 'clear' });
  await pressed('Off').click();
  await expect.poll(settings).toMatchObject({ caustics: 'off' });
  await expect(pressed('Off')).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('caustics')).toBe('off');
  await pressed('On').click();
  await expect.poll(settings).toMatchObject({ caustics: 'on' });
  await pressed('Lit ripple').click();

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
    caustics: 'on',
  });
  expect(problems).toEqual([]);
});

test("turns see-through water's caustics on and off in what is drawn", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await set(page, { water: 'clear', dirt: 0, time: 'day', view: 'boat' }, 30);
  // the panel and the corners out of the picture: the panel's own buttons, drawn over the canvas, are not the water
  await page.evaluate(() => {
    for (const id of ['stats', 'help', 'labPanel']) document.getElementById(id)!.hidden = true;
  });
  // turned on or off, and drawn again by the paused page's own frames, which are of no time, so only the caustics can
  // differ: a step would draw a frame of a sixtieth, and move the renderer's post clock on with it
  const shot = async (caustics: 'on' | 'off') => {
    await page.evaluate(async (c) => {
      await window.game!.caustics(c);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, caustics);
    return page.locator('#view').screenshot({ animations: 'disabled' });
  };
  const on = await shot('on');
  const off = await shot('off');
  const again = await shot('on');
  expect(on.equals(off), 'caustics on and off drew the same').toBe(false);
  expect(on.equals(again), 'caustics on, twice at the same time, drew differently').toBe(true);
  expect(problems).toEqual([]);
});

test('drops a pebble where the water is tapped, none for a drag, and one for the button', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await page.evaluate(() => window.game!.view('shore'));
  const splashes = () => page.evaluate(() => window.game!.splashes());
  // a point of the water in front of the shore, where it is on the page
  const at = (await page.evaluate(() => window.game!.project(4, -6, 0)))!;
  await page.mouse.click(at.x, at.y);
  const tapped = await splashes();
  expect(tapped.length, 'a tap drops one').toBe(1);
  expect(Math.hypot(tapped[0].x - 4, tapped[0].y + 6), 'where it was tapped').toBeLessThan(0.5);
  expect(await page.evaluate(() => window.game!.events())).toContain('splashed 4.0,-6.0');

  // a drag across the water turns the camera, and drops nothing
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + 10, { steps: 6 });
  await page.mouse.up();
  expect((await splashes()).length, 'a drag drops none').toBe(1);

  // the panel's button drops one near what the camera looks at
  await page.getByRole('button', { name: 'Drop a pebble' }).click();
  expect((await splashes()).length, 'the button drops one').toBe(2);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
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
    // and a tap on the water drops a pebble, as a click does
    await page.evaluate(() => window.game!.pause());
    const at = (await page.evaluate(() => window.game!.project(0, -2, 0)))!;
    await page.touchscreen.tap(at.x, at.y);
    const tapped = await page.evaluate(() => window.game!.splashes());
    expect(tapped.length, 'a tap on a phone drops one').toBe(1);
    expect(Math.hypot(tapped[0].x, tapped[0].y + 2)).toBeLessThan(0.5);
    expect(problems).toEqual([]);
  });
});
