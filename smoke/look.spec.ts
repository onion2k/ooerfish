/**
 * What the lake looks like, held to pictures taken before. Every other check
 * is on what the game does; nothing else notices a palette gone muddy, a
 * light lost, or water drawn over the bank. In the lake lab these pictures
 * are also the record of every way of drawing the water: each style at a
 * dirty and a clean lake by day, and dirty at dusk, when the glow matters.
 *
 * Each scene is set through the test API with chance seeded from before the
 * game is built, the game paused, and a fixed number of frames stepped, so
 * the same machine draws the same pixels every run. The pictures are in
 * `smoke/screens/`. They are this machine's GPU: another one will draw them
 * a little differently, so the pictures are not worth arguing with from
 * elsewhere.
 *
 *   npm run look               the scenes against the pictures
 *   npm run look:update        the pictures written again, after a change meant to alter them
 *
 * A failure leaves the picture, what was drawn and the difference in
 * `test-results/`. Look at all three before deciding which is right.
 */
import { expect, test, type Page } from '@playwright/test';
import { STANDARD, set, start, watch, type Scene } from './game';

/**
 * How far the pictures may differ before it is a change and not the GPU: not a pixel whose colour is off by more
 * than 0.02, Playwright's own measure of a colour's difference. Drawn on thirty pages just booted, ten of them with
 * every core at other work, the template's arena matched its picture to the pixel even at a threshold of 0, so
 * there is no drift there to allow for. The lake draws more (moving water, glows over it): its drift is measured
 * the same way before this is believed of it, and `/gate-moved` says how. Playwright leaves out a pixel it takes
 * for the edge of a shape smoothed. The five-hundredth of the pixels the template used to forgive was 2,048 of
 * them, and a button over the scene is 701.
 */
const TOLERANCE = { maxDiffPixels: 0, threshold: 0.02 };

/** The corners that count the milliseconds and tell how to look round, and the lab's panel: not the look. */
async function hideOverlays(page: Page) {
  await page.evaluate(() => {
    for (const id of ['stats', 'help', 'labPanel']) document.getElementById(id)!.hidden = true;
  });
}

/** Every picture of the lake, by name: each style dirty and clean by day and dirty at dusk, and open water's others. */
const PICTURES: [string, Scene][] = [
  ...['open', 'ripple'].flatMap((water): [string, Scene][] => [
    [`${water}-sick-day`, { water, dirt: 1, time: 'day', view: 'shore' }],
    [`${water}-clear-day`, { water, dirt: 0, time: 'day', view: 'shore' }],
    [`${water}-sick-dusk`, { water, dirt: 1, time: 'dusk', view: 'shore' }],
  ]),
  ['clear-sick-day', { water: 'clear', dirt: 1, time: 'day', view: 'shore' }],
  ['clear-clear-day', { water: 'clear', dirt: 0, time: 'day', view: 'shore' }],
  ['clear-sick-dusk', { water: 'clear', dirt: 1, time: 'dusk', view: 'shore' }],
  ['clear-half-boat', { water: 'clear', dirt: 0.5, time: 'day', view: 'boat' }],
  ['open-sick-night', { water: 'open', dirt: 1, time: 'night', view: 'shore' }],
  ['open-half-overhead', { water: 'open', dirt: 0.5, time: 'day', view: 'overhead' }],
  ['open-half-boat', { water: 'open', dirt: 0.5, time: 'dawn', view: 'boat' }],
];

test.describe('what it looks like', () => {
  for (const [name, scene] of PICTURES)
    test(name, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, scene, 180);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // a pebble a third of a second after it landed in front of the boat, in each way of drawing the water: its droplets
  // in the air and its first rings spreading
  for (const water of ['open', 'ripple', 'clear'])
    test(`${water}-splash`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { water, dirt: 0.3, time: 'day', view: 'boat' }, 60);
      await page.evaluate(() => {
        window.game!.drop(8, 6);
        window.game!.step(20);
      });
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`${water}-splash.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // the cast from the shore, by day, on open water and see-through: aimed at the water and at the bank, in the air,
  // and landed and sinking under its bobber
  for (const water of ['open', 'clear'])
    for (const [name, act] of [
      ['aim-water', 'aim water'],
      ['aim-bank', 'aim bank'],
      ['flight', 'flight'],
      ['sinking', 'sinking'],
    ] as const)
      test(`${water}-cast-${name}`, async ({ page }) => {
        const problems = watch(page);
        await start(page, { seed: 11, paused: true });
        // a cast landing on a bank lands off to the side, out of the Shore view's frame: it is pictured from overhead
        await set(page, { water, dirt: 0.2, time: 'day', view: name === 'aim-bank' ? 'overhead' : 'shore' }, 60);
        await page.evaluate((what) => {
          const g = window.game!;
          if (what === 'aim water') g.aim({ angle: Math.PI / 2 + 0.2, power: 0.7 });
          if (what === 'aim bank') g.aim({ angle: 0.3, power: 0.85 });
          if (what === 'flight' || what === 'sinking') g.cast(Math.PI / 2 + 0.2, 0.7);
          g.step(what === 'sinking' ? 175 : what === 'flight' ? 25 : 1);
        }, act);
        await hideOverlays(page);
        await expect(page.locator('#view')).toHaveScreenshot(`${water}-cast-${name}.png`, TOLERANCE);
        expect(problems).toEqual([]);
      });

  test('the water moves by the game clock alone', async ({ page }) => {
    // two pictures at the same game time are the same to the byte, splash and all, and a second later the water has moved
    await start(page, { seed: 11, paused: true });
    await set(page, STANDARD, 120);
    await page.evaluate(() => {
      window.game!.drop(0, 0);
      window.game!.step(12);
    });
    await hideOverlays(page);
    // with the page's transitions finished, as the pictures are taken: the boot screen fading out over the first
    // scene drew every pixel different from one frame to the next, and was taken for the water
    const shot = () => page.locator('#view').screenshot({ animations: 'disabled' });
    const first = await shot();
    // the page draws frames of its own while paused, of no time: they must draw the same water
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect((await shot()).equals(first), 'the same game time drew different water').toBe(true);
    await page.evaluate(() => window.game!.step(60));
    expect((await shot()).equals(first), 'a second on, the water had not moved').toBe(false);
  });

  test('a small thing added to the scene is a change', async ({ page }, info) => {
    // while the pictures are being written this would write its own, button and all, over the scene's
    test.skip(!['none', 'missing'].includes(info.config.updateSnapshots), 'the pictures are being written');
    // the gate held to itself: a button a fifth the size of a thumb, which a tolerance of a five-hundredth of the
    // pixels let through, and let through four times over in a game copied from the template
    await start(page, { seed: 11, paused: true });
    await set(page, PICTURES[0][1], 180);
    await hideOverlays(page);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.textContent = 'Go';
      Object.assign(button.style, { position: 'fixed', left: '600px', top: '380px', font: '12px sans-serif' });
      document.body.append(button);
    });
    let seen = '';
    try {
      await expect(page.locator('#view')).toHaveScreenshot(`${PICTURES[0][0]}.png`, { ...TOLERANCE, timeout: 5000 });
    } catch (e) {
      seen = String(e);
    }
    expect(seen, 'the picture with a button on it matched the picture without').toMatch(/pixels \(ratio/);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

  test('the lake from the shore, with the lab folded away', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, view: 'phone' }, 180);
    await page.evaluate(() => {
      document.getElementById('stats')!.hidden = true;
      (document.getElementById('labPanel') as HTMLDetailsElement).open = false;
    });
    await expect(page).toHaveScreenshot('phone.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});
