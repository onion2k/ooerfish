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
import { expect, test, type Page } from '@playwright/test';
import { HEAL } from '../src/lake';
import { CAST_SHOT, PICTURES, STANDARD, hideOverlays, set, splashing, start, watch } from './game';
import { GRASS_WOBBLE, pixelsApart } from './judging';
import { connect, openPhone, pairingFromOverlay } from './phoneside';

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

  // half the pond cured, by night: six gold fish among six green, the gold's own faint warm glow all that shows them
  // in the dark, as the user chose it (`docs/cured.md`); the water as clean as six cures make it
  test('half cured, by night', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 6 } });
    await set(page, { dirt: 0.5, time: 'night', view: 'shore' }, 180);
    await hideOverlays(page);
    expect((await page.evaluate(() => window.game!.fish())).filter((f) => f.cured).length).toBe(6);
    await expect(page.locator('#view')).toHaveScreenshot('half-cured-night.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  // the pond healing (`docs/heal.md`): five cured, the sixth stowed, and a fifth of the heal gone by, where the ease
  // has taken the water about half way from where it was to where the cure puts it
  test('healing, a fifth of the way through', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 5 } });
    await set(page, { dirt: 7 / 12, time: 'day', view: 'shore' }, 60);
    const was = await page.evaluate(() => {
      const g = window.game!;
      if (!g.fishTo('landed') || !g.stow()) throw new Error('no fish to cure');
      return g.state().contamination;
    });
    await page.evaluate(() => window.game!.step(360));
    const now = await page.evaluate(() => window.game!.state());
    expect(now.contamination).toBeCloseTo(was, 12);
    expect(now.waterDirt).toBeGreaterThan(now.contamination);
    expect(now.waterDirt).toBeLessThan(7 / 12);
    await hideOverlays(page);
    await expect(page.locator('#view')).toHaveScreenshot('healing.png', TOLERANCE);
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
    });
    await expect(page.locator('#gauge')).toBeInViewport();
    await expect(page).toHaveScreenshot('desk-fight.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

  test('the lake from the shore', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, view: 'phone' }, 180);
    await page.evaluate(() => {});
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
    await page.evaluate(() => {});
    await expect(page).toHaveScreenshot('phone-splash.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a fish on the line, with the bar and the Reel button in reach of a thumb', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, view: 'phone' }, 30);
    await page.evaluate(() => {
      window.game!.fishTo('fight');
    });
    await expect(page.locator('#reelButton')).toBeInViewport();
    await expect(page.locator('#gauge')).toBeInViewport();
    await expect(page).toHaveScreenshot('phone-fight.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

/** A pairing that holds still, with an address of its own, so that the QR code and the text under it are the same every run on any port. */
const FIXED_PAIRING = { room: 'fixedroom00', key: 'fixedkey0000000000000000', origin: 'https://lake.test' };

/**
 * The pairing overlay over the game, at a desk's width and a phone's: the card, the code as wide as the card, the
 * address under it, and the lake dimmed behind. The room and key are fixed so the code holds still.
 */
test.describe('pairing a phone', () => {
  test('the overlay at a desk’s width', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, query: { phonelink: 'local' } });
    await set(page, STANDARD, 30);
    await page.evaluate((fixed) => window.game!.pair(fixed), FIXED_PAIRING);
    await expect(page.locator('#pairing')).toBeVisible();
    await expect(page).toHaveScreenshot('pairing-desk.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('the overlay at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, query: { phonelink: 'local' } });
      await set(page, { ...STANDARD, view: 'phone' }, 30);
      await page.evaluate((fixed) => window.game!.pair(fixed), FIXED_PAIRING);
      await expect(page.locator('#pairing')).toBeVisible();
      await expect(page).toHaveScreenshot('pairing-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});

/**
 * The phone's own page at a phone's size, paired to a game on the local link, in the three words it shows: Cast with
 * the lure ready, Strike! at a bite, and Reel with the bar part filled. The game is stepped through the test API and
 * the phone is waited on for the state it has drawn, never for a time, since it draws what the game last sent it.
 */
test.describe('the phone as the rod', () => {
  /** The game paired to a phone that has connected without motion sensors; the phone is at 390 by 844. */
  async function paired(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
    await start(page, { seed: 11, paused: true, query: { phonelink: 'local' } });
    await set(page, { ...STANDARD, dirt: 0.2 }, 30);
    await page.evaluate(() => window.game!.pair());
    const { url } = await pairingFromOverlay(page);
    const phone = await openPhone(context, url, 'none');
    await connect(phone);
    await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
    return phone;
  }
  /** A share as the phone's bar writes it. */
  const per = (v: number) => `${Math.round(v * 1000) / 10}%`;

  test('Cast: paired, the lure ready', async ({ page, context }) => {
    const problems = watch(page);
    const phone = await paired(page, context);
    await expect(phone.locator('#word')).toHaveText('Cast');
    await expect(phone.locator('#status')).toContainText('Connected to the screen');
    await expect(phone).toHaveScreenshot('rod-cast.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('Strike!: a fish biting', async ({ page, context }) => {
    const problems = watch(page);
    const phone = await paired(page, context);
    expect(await page.evaluate(() => window.game!.fishTo('bite'))).toBe(true);
    await expect(phone.locator('#word')).toHaveText('Strike!');
    // the word and the rest are drawn from one state, so the picture is of the bite and not of the one before it
    await expect(phone).toHaveScreenshot('rod-strike.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('Reel: hooked, the reel held until the catch meter is part filled', async ({ page, context }) => {
    const problems = watch(page);
    const phone = await paired(page, context);
    expect(await page.evaluate(() => window.game!.fishTo('fight'))).toBe(true);
    // stepped, a frame at a time, with the reel held, until the meter is a fair way up and the fish still on
    const meter = await page.evaluate(() => {
      const g = window.game!;
      g.reel(true);
      for (let i = 0; i < 600 && g.fishing().phase === 'hooked' && g.fishing().meter < 0.4; i++) g.step(1);
      return g.fishing();
    });
    expect(meter.phase).toBe('hooked');
    expect(meter.meter).toBeGreaterThan(0.2);
    expect(meter.meter).toBeLessThan(0.9);
    await expect(phone.locator('#word')).toHaveText('Reel');
    await expect
      .poll(() => phone.evaluate(() => document.getElementById('gaugeMeterFill')!.style.height))
      .toBe(per(meter.meter));
    await expect
      .poll(() => phone.evaluate(() => (document.getElementById('gaugeFish') as unknown as SVGElement).style.bottom))
      .toBe(per(meter.fishAt));
    await expect(phone).toHaveScreenshot('rod-reel.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

/**
 * The pond as a player first meets it and as it comes to be, the real HUD over the real page, from the start of the
 * game at dawn: `welcome` is the first sight (the sick pond, the gauge full, the welcome line), `playing` is eight
 * fish cured with the line gone, and `clean` is the twelfth cured and the line that says so. Seeded and paused, so
 * each is the same every run.
 */
async function pond(page: Page, scene: 'welcome' | 'playing' | 'clean') {
  const save = scene === 'welcome' ? undefined : { cured: scene === 'playing' ? 8 : 11 };
  await start(page, { seed: 11, paused: true, ...(save ? { save } : {}) });
  await page.evaluate(() => window.game!.step(60));
  if (scene === 'clean') {
    expect(await page.evaluate(() => window.game!.fishTo('landed'))).toBe(true);
    await page.locator('#catch').click();
    await page.evaluate(() => window.game!.step(1));
    await expect(page.locator('#toast')).toContainText('The Duck Pond is clean!');
    // the water heals to the cure's level over `HEAL.seconds`, so the clean pond is pictured after the heal
    await page.evaluate((n) => window.game!.step(n), HEAL.seconds * 60);
  }
}

test.describe('the pond at a desk’s width', () => {
  for (const scene of ['welcome', 'playing', 'clean'] as const)
    test(`${scene}`, async ({ page }) => {
      const problems = watch(page);
      await pond(page, scene);
      await expect(page).toHaveScreenshot(`desk-pond-${scene}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
});

test.describe('the pond on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const scene of ['welcome', 'playing', 'clean'] as const)
    test(`${scene}`, async ({ page }) => {
      const problems = watch(page);
      await pond(page, scene);
      // the Shore view is the phone's framing by itself here, and the gauge, the Cast button and the lines are clear of each other
      const box = async (id: string) => (await page.locator(`#${id}`).boundingBox())!;
      const gauge = await box('pond'),
        cast = await box('modeButton');
      expect(gauge.y + gauge.height, 'the Cast button is under the gauge').toBeLessThanOrEqual(cast.y);
      for (const id of ['welcome', 'toast'])
        if (await page.locator(`#${id}`).isVisible()) {
          const line = await box(id);
          expect(cast.y + cast.height, `${id} is under the Cast button`).toBeLessThanOrEqual(line.y);
          expect(line.x).toBeGreaterThanOrEqual(0);
          expect(line.x + line.width).toBeLessThanOrEqual(390);
        }
      await expect(page).toHaveScreenshot(`phone-pond-${scene}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
});
