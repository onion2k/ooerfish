/**
 * What the lake looks like, held to pictures taken before. Every other check
 * is on what the game does; nothing else notices a palette gone muddy, a
 * light lost, or water drawn over the bank. The lake's one water is
 * pictured at a dirty and a clean lake by day, dirty at dusk and night, from the boat and overhead.
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
import { expect, test } from '@playwright/test';
import { CAST_SHOT, PICTURES, STANDARD, hideOverlays, set, splashing, start, watch } from './game';
import { GRASS_WOBBLE, pixelsApart } from './judging';

/**
 * How far the pictures may differ before it is a change and not the GPU: not a pixel whose colour is off by more
 * than 0.02, Playwright's own measure of a colour's difference. Drawn on thirty pages just booted, ten of them with
 * every core at other work, the template's arena matched its picture to the pixel even at a threshold of 0, so
 * there is no drift there to allow for. The lake draws more (moving water, glows over it): its drift is measured
 * the same way before this is believed of it, and `/gate-moved` says how. Playwright leaves out a pixel it takes
 * for the edge of a shape smoothed. The five-hundredth of the pixels the template used to forgive was 2,048 of
 * them, and a button over the scene is 701. Since the banks' grass the lake does drift, by a pixel or two: the
 * renderer's blades are drawn in no fixed order, so where two meet at one depth the last wins. `GRASS_WOBBLE`
 * (`judging.ts`) is that drift measured and widened, a handful of pixels and no share, and the test below that
 * holds the gate to a button still fails it.
 */
const TOLERANCE = { maxDiffPixels: GRASS_WOBBLE, threshold: 0.02 };

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

  // a pebble a third of a second after it landed in front of the boat: its fine droplets fallen back and its first
  // ripples going out in the water's own surface, bending the bed and the mirror and painting nothing; on the sick lake, whose
  // murk shows the ring only by its light and its mirror; and at night, when the mirror is all it has
  for (const [name, scene] of [
    ['splash', {}],
    ['splash-sick', { dirt: 1 }],
    ['splash-night', { dirt: 0, time: 'night' }],
  ] as const)
    test(name, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await splashing(page, scene);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // the fish nearer than the shore stands, on the clean lake: each body flexed along its stroke from head to tail fin,
  // its back fin up, by day and at night, when its own glow is what shows it. Any nearer and the surface's refraction
  // breaks a fish into pieces, which is the water and says nothing of the fish
  for (const time of ['day', 'night'] as const)
    test(`fish-swimming-${time}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { ...STANDARD, dirt: 0, time }, 180);
      await page.evaluate(() => {
        const [fish] = window.game!.fish();
        window.game!.look(fish.x, fish.y, { polar: 1, radius: 28 });
        window.game!.step(0);
      });
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`fish-swimming-${time}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // the cast from the shore, by day: aimed at the water and at the bank, in the air, and landed and sinking under its
  // bobber
  for (const [name, act] of [
    ['aim-water', 'aim water'],
    ['aim-bank', 'aim bank'],
    ['flight', 'flight'],
    ['sinking', 'sinking'],
  ] as const)
    test(`cast-${name}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      // a cast landing on a bank lands off to the side, out of the Shore view's frame: it is pictured from overhead
      await set(page, { ...CAST_SHOT.scene, view: name === 'aim-bank' ? 'overhead' : 'shore' }, CAST_SHOT.settle);
      await page.evaluate(
        ([what, c]) => {
          const g = window.game!;
          if (what === 'aim water') g.aim({ angle: c.angle, power: c.power });
          if (what === 'aim bank') g.aim({ angle: 0.3, power: 0.85 });
          if (what === 'flight' || what === 'sinking') g.cast(c.angle, c.power);
          g.step(what === 'sinking' ? c.sinking : what === 'flight' ? 25 : 1);
        },
        [act, CAST_SHOT] as const,
      );
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`cast-${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // the fishing from the shore: the bobber dipped at a bite, a fish played with the line warm and the rod bent, and a
  // fish landed, hanging from the rod with its card shown; the fight by day and at dusk
  for (const [name, time, moment] of [
    ['bite', 'day', 'bite'],
    ['fight-dusk', 'dusk', 'fight'],
    ['landed', 'day', 'landed'],
  ] as const)
    test(`fishing-${name}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { dirt: 0.2, time, view: 'shore' }, 30);
      await page.evaluate((m) => window.game!.fishTo(m), moment);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`fishing-${name}.png`, TOLERANCE);
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
    // not the same bytes: the grass's blades are drawn in no fixed order and a pixel or two of the far bank flickers
    expect(pixelsApart(await shot(), first), 'the same game time drew different water').toBeLessThanOrEqual(
      GRASS_WOBBLE,
    );
    await page.evaluate(() => window.game!.step(60));
    expect(pixelsApart(await shot(), first), 'a second on, the water had not moved').toBeGreaterThan(1000);
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

  test('a bite at a desk’s width: the mark over the bobber, the Strike button pulsing and the words', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, STANDARD, 30);
    await page.evaluate(() => {
      window.game!.fishTo('bite');
      document.getElementById('stats')!.hidden = true;
      (document.getElementById('labPanel') as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('#biteMark')).toBeInViewport();
    await expect(page).toHaveScreenshot('desk-bite.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a fish on the line at a desk’s width, the bar beside the Reel button', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, STANDARD, 30);
    await page.evaluate(() => {
      window.game!.fishTo('fight');
      document.getElementById('stats')!.hidden = true;
      (document.getElementById('labPanel') as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('#gauge')).toBeInViewport();
    await expect(page).toHaveScreenshot('desk-fight.png', TOLERANCE);
    expect(problems).toEqual([]);
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

  // a pebble dropped from the phone's view, as its button does, half a second on: the ripples at a phone's width
  test('a splash from the phone', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, view: 'phone' }, 60);
    await page.evaluate(() => {
      window.game!.drop(0, 4);
      window.game!.step(30);
    });
    await page.evaluate(() => {
      document.getElementById('stats')!.hidden = true;
      (document.getElementById('labPanel') as HTMLDetailsElement).open = false;
    });
    await expect(page).toHaveScreenshot('phone-splash.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a fish on the line, with the bar and the Reel button in reach of a thumb', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, view: 'phone' }, 30);
    await page.evaluate(() => {
      window.game!.fishTo('fight');
      document.getElementById('stats')!.hidden = true;
      (document.getElementById('labPanel') as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('#reelButton')).toBeInViewport();
    await expect(page.locator('#gauge')).toBeInViewport();
    await expect(page).toHaveScreenshot('phone-fight.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});
