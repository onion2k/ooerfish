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
import { HOME } from '../src/lakes';
import { HEAL } from '../src/lake';
import { CABIN_DAWN, CAST_SHOT, PICTURES, STANDARD, hideOverlays, ready, set, splashing, start, watch } from './game';
import { GRASS_WOBBLE, pixelsApart } from './judging';
import { connect, openPhone, pairingFromOverlay } from './phoneside';

const FISH_KINDS = HOME.fishKinds;

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
/** The phone the pictures are taken on: the user's Pixel 7a, 1080 by 2400 at a device pixel ratio of 2.625 (`docs/layout.md`). */
const PIXEL_7A = { width: 412, height: 915 };
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

  // the room inside the cabin (`docs/day.md`): the player woken at dawn, seen from the pillow with the bed's foot below,
  // the door and the window across the room and the lamp lit above; the world only, and the outside pictures unchanged
  // show that it is not seen through the walls
  test('the cabin at dawn', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, CABIN_DAWN, 60);
    await hideOverlays(page);
    expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
    await expect(page.locator('#view')).toHaveScreenshot('cabin-dawn.png', TOLERANCE);
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
    await set(page, { dirt: 11 / 16, time: 'day', view: 'shore' }, 60);
    const was = await page.evaluate(() => {
      const g = window.game!;
      if (!g.fishTo('landed') || !g.stow()) throw new Error('no fish to cure');
      return g.state().contamination;
    });
    await page.evaluate(() => window.game!.step(360));
    const now = await page.evaluate(() => window.game!.state());
    expect(now.contamination).toBeCloseTo(was, 12);
    expect(now.waterDirt).toBeGreaterThan(now.contamination);
    expect(now.waterDirt).toBeLessThan(11 / 16);
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

  // the three kinds under the clean water, side by side: the small yellow bream, the green perch and the long blue-green
  // pike, found as the trio nearest each other and looked down on, by day and at night, when each glow is what shows it
  for (const time of ['day', 'night'] as const)
    test(`fish-kinds-${time}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { ...STANDARD, dirt: 0, time }, 180);
      await page.evaluate((kinds) => {
        const g = window.game!;
        const fish = g.fish();
        // the nearest trio, one of each kind: the one whose farthest two are least apart
        let best: [number, number, number] | null = null,
          least = Infinity;
        for (let a = 0; a < fish.length; a++)
          for (let b = 0; b < fish.length; b++)
            for (let c = 0; c < fish.length; c++) {
              if (kinds[a] !== 0 || kinds[b] !== 1 || kinds[c] !== 2) continue;
              const far = Math.max(
                Math.hypot(fish[a].x - fish[b].x, fish[a].y - fish[b].y),
                Math.hypot(fish[a].x - fish[c].x, fish[a].y - fish[c].y),
                Math.hypot(fish[b].x - fish[c].x, fish[b].y - fish[c].y),
              );
              if (far < least) {
                least = far;
                best = [a, b, c];
              }
            }
        const [a, b, c] = best!;
        g.look((fish[a].x + fish[b].x + fish[c].x) / 3, (fish[a].y + fish[b].y + fish[c].y) / 3, {
          polar: 1,
          radius: 36,
        });
        g.step(0);
      }, FISH_KINDS);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`fish-kinds-${time}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  // a drum of waste on the bed under the clean water, by day: a hazard-yellow drum with the black atom on its lid, looked
  // down on from near enough to read it, with the first drum still on the bed in the middle of the frame
  test('drum-bed', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, { ...STANDARD, dirt: 0, time: 'day' }, 180);
    await page.evaluate(() => {
      const g = window.game!;
      const [drum] = g.drums();
      g.look(drum.x, drum.y, { polar: 0.45, radius: 12 });
      g.step(0);
    });
    await hideOverlays(page);
    await expect(page.locator('#view')).toHaveScreenshot('drum-bed.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  // a treasure lying on the bed under the clean water, by day and by night: looked down on from near enough to read it,
  // the lunchbox in the middle of the frame (`docs/junk.md`)
  for (const time of ['day', 'night'] as const)
    test(time === 'day' ? 'treasure-bed' : 'treasure-bed-night', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { ...STANDARD, dirt: 0, time }, 180);
      await page.evaluate(() => {
        const g = window.game!;
        const box = g.treasures().find((t) => t.id === 'lunchbox')!;
        g.look(box.x, box.y, { polar: 0.45, radius: 12 });
        g.step(0);
      });
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(
        time === 'day' ? 'treasure-bed.png' : 'treasure-bed-night.png',
        TOLERANCE,
      );
      expect(problems).toEqual([]);
    });

  // the two drums hauled up, standing on the bank beside the cabin, seen from across the water
  test('drums-by-cabin', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 6, drums: 2 } });
    await set(page, { ...STANDARD, dirt: 0.3, time: 'day' }, 180);
    await page.evaluate(() => {
      const g = window.game!;
      const [a, b] = g.drums();
      g.look((a.bank[0] + b.bank[0]) / 2, (a.bank[1] + b.bank[1]) / 2, { polar: 1.15, radius: 34 });
      g.step(0);
    });
    await hideOverlays(page);
    await expect(page.locator('#view')).toHaveScreenshot('drums-by-cabin.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  // the shelves in the cabin with all six treasures found standing on them, seen from the pillow
  test('cabin-shelves', async ({ page }) => {
    const problems = watch(page);
    await start(page, {
      seed: 11,
      paused: true,
      save: { found: ['lure', 'plush', 'lunchbox', 'badge', 'bottle', 'duck'] },
    });
    await set(page, CABIN_DAWN, 60);
    await hideOverlays(page);
    expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
    await expect(page.locator('#view')).toHaveScreenshot('cabin-shelves.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  // the last square of the calendar's year: a load in the cabin on day 56, 55 squares gone and the last one marked
  test('cabin-day56', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 3, day: 56, place: 'cabin' } });
    await set(page, { ...CABIN_DAWN, cabin: false }, 60);
    await hideOverlays(page);
    expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
    expect(await page.evaluate(() => window.game!.calendar())).toMatchObject({ gone: 55, today: 55 });
    await expect(page.locator('#view')).toHaveScreenshot('cabin-day56.png', TOLERANCE);
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

  // the catches of the new kinds, hanging from the rod with the card shown: a pike, long and blue-green, and a drum of
  // waste hauled in on the line, from a pond with every fish cured so that only the drum can take the bait
  for (const [name, quarry, save] of [
    ['pike', 'pike', undefined],
    ['drum', 'drum', { cured: 12 }],
    ['bottle', 'bottle', { cured: 12 }],
  ] as const)
    test(`fishing-landed-${name}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, ...(save ? { save } : {}) });
      await set(page, { dirt: 0.2, time: 'day', view: 'shore' }, 30);
      expect(await page.evaluate((q) => window.game!.fishTo('landed', q), quarry)).toBe(true);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`fishing-landed-${name}.png`, TOLERANCE);
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
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

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

/**
 * The fight laid out at each shape of screen beyond the desk and the Pixel 7a (`docs/layout.md`): a phone held
 * sideways, its bar thin on the left and the words and card a strip at the foot; and a tablet held upright, the
 * phone's layout with a taller bar. At each, a bite, the fight and the landing, the pond clear of everything.
 */
for (const [shape, viewport] of [
  ['sideways', { width: 915, height: 412 }],
  ['tablet', { width: 820, height: 1180 }],
] as const)
  test.describe(`laid out ${shape}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    for (const moment of ['bite', 'fight', 'landed'] as const)
      test(moment, async ({ page }) => {
        const problems = watch(page);
        await start(page, { seed: 11, paused: true });
        await set(page, STANDARD, 30);
        await page.evaluate(async (m) => {
          const g = window.game!;
          await g.mode('cast');
          g.fishTo(m);
          g.step(1);
        }, moment);
        await expect(page).toHaveScreenshot(`${shape}-${moment}.png`, TOLERANCE);
        expect(problems).toEqual([]);
      });
  });

/** The question before Start again, at the Pixel 7a and at a desk: the card over the dimmed lake, Keep playing focused. */
/**
 * The fight's own words and gifts (`docs/fight2.md`): the catch card naming the fish's temper at the Pixel 7a; the
 * gift's toast after the cure that earns the line, at a desk and on the phone; and the fight with the longer rod, its
 * zone a little taller on the bar, from a save of six. Seeded and paused, so each is the same every run.
 */
test.describe('the fight and its gifts', () => {
  async function giftToast(page: import('@playwright/test').Page) {
    // one fish cured already: the second, cured here, earns the line, whose toast follows the cure's own
    await start(page, { seed: 11, paused: true, save: { cured: 1 } });
    await page.evaluate(() => window.game!.step(60));
    expect(await page.evaluate(() => window.game!.fishTo('landed'))).toBe(true);
    await page.locator('#catch').click();
    // the cure's toast is said for two seconds of game time, then the gift's
    await page.evaluate(() => window.game!.step(150));
    await expect(page.locator('#toast')).toContainText('A gift from the Sunny Atom');
  }

  test('the gift’s toast at a desk’s width', async ({ page }) => {
    const problems = watch(page);
    await giftToast(page);
    await expect(page).toHaveScreenshot('gift-desk.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('the fight with the longer rod', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 6 } });
    await set(page, STANDARD, 30);
    await page.evaluate(() => {
      const g = window.game!;
      g.fishTo('fight');
      g.step(1);
    });
    expect(await page.evaluate(() => window.game!.gear().rod)).toBe(true);
    await expect(page).toHaveScreenshot('fight-rod.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

    test('the gift’s toast at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await giftToast(page);
      await expect(page).toHaveScreenshot('gift-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });

    test('the catch card naming its temper', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { ...STANDARD, view: 'phone' }, 30);
      await page.evaluate(() => {
        const g = window.game!;
        g.fishTo('landed');
        g.step(1);
      });
      const { temper } = await page.evaluate(() => window.game!.fishing());
      // the fish is whichever kind took the lure, so the card names its temper and any of the three kinds
      await expect(page.locator('#catchName')).toHaveText(new RegExp(`^${temper} (sunny bream|glowing perch|pike)$`));
      await expect(page).toHaveScreenshot('phone-landed.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});

test.describe('starting again', () => {
  test('the question at a desk’s width', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await set(page, STANDARD, 30);
    await page.evaluate(() => window.game!.startAgain());
    await expect(page.locator('#startAgainKeep')).toBeFocused();
    await expect(page).toHaveScreenshot('start-again-desk.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

    test('the question at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await set(page, { ...STANDARD, view: 'phone' }, 30);
      await page.evaluate(() => window.game!.startAgain());
      await expect(page.locator('#startAgainKeep')).toBeFocused();
      await expect(page).toHaveScreenshot('start-again-phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
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
    test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

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
 * The day's end with the real HUD over the real page (`docs/day.md`): the yawn with the screen half faded and its
 * words, and the morning in the cabin with its line and the button, at a desk's width and a phone's. Seeded and paused.
 */
async function night(page: Page, scene: 'yawn' | 'morning') {
  await start(page, { seed: 11, paused: true, save: { cured: 4, day: 1 } });
  await page.evaluate(async (m) => {
    const g = window.game!;
    g.step(60);
    await g.dirt(0.5);
    await g.sleep();
    // the yawn pictured half faded (0.75 s of its 1.5), the morning after the fade has lifted
    g.step(m === 'yawn' ? 45 : 160);
  }, scene);
  expect(await page.evaluate(() => window.game!.place())).toBe(scene === 'yawn' ? 'yawning' : 'cabin');
}

test.describe('the day’s end at a desk’s width', () => {
  for (const scene of ['yawn', 'morning'] as const)
    test(scene, async ({ page }) => {
      const problems = watch(page);
      await night(page, scene);
      await expect(page).toHaveScreenshot(`desk-${scene}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
});

// the pond at a desk's width with the ⋯ list up, which holds the clock still
test('the menu open at a desk’s width', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 4, day: 1 } });
  await page.evaluate(() => window.game!.step(60));
  await page.locator('#menuButton').click();
  await expect(page.locator('#menuList')).toBeVisible();
  await expect(page).toHaveScreenshot('desk-menu-open.png', TOLERANCE);
  expect(problems).toEqual([]);
});

test.describe('the morning on a phone', () => {
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

  test('morning', async ({ page }) => {
    const problems = watch(page);
    await night(page, 'morning');
    await expect(page).toHaveScreenshot('phone-morning.png', TOLERANCE);
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
  // the clean pond has its two drums hauled, or the twelfth fish would not be the last cleaning
  const save = scene === 'welcome' ? undefined : scene === 'playing' ? { cured: 8 } : { cured: 11, drums: 2 };
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
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

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
          expect(line.x + line.width).toBeLessThanOrEqual(PIXEL_7A.width);
        }
      await expect(page).toHaveScreenshot(`phone-pond-${scene}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
});

/** A save with a journal part filled: perch and pike caught, the bream not, and one drum hauled, on the second day. */
const JOURNAL_SAVE = {
  cured: 5,
  day: 2,
  drums: 1,
  journal: { perch: { caught: 3, best: 1.87, first: 1 }, pike: { caught: 2, best: 3.62, first: 2 } },
};

test.describe('the journal', () => {
  test('the page at a desk’s width', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: JOURNAL_SAVE });
    await set(page, STANDARD, 30);
    await page.evaluate(() => window.game!.openJournal());
    await expect(page.locator('#journalClose')).toBeFocused();
    await expect(page).toHaveScreenshot('desk-journal.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

    test('the page at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: JOURNAL_SAVE });
      await set(page, { ...STANDARD, view: 'phone' }, 30);
      await page.evaluate(() => window.game!.openJournal());
      await expect(page.locator('#journalClose')).toBeFocused();
      await expect(page).toHaveScreenshot('phone-journal.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});

/** Every treasure found, with a journal part filled and a drum hauled, on the second day: the longest page the journal has. */
const FOUND_SAVE = {
  ...JOURNAL_SAVE,
  found: ['lure', 'plush', 'lunchbox', 'badge', 'bottle', 'duck'],
};

test.describe('the journal with every treasure found', () => {
  test('the page at a desk’s width', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: FOUND_SAVE });
    await set(page, STANDARD, 30);
    await page.evaluate(() => window.game!.openJournal());
    await expect(page.locator('#journalClose')).toBeFocused();
    await expect(page).toHaveScreenshot('desk-journal-found.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

    test('the page at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: FOUND_SAVE });
      await set(page, { ...STANDARD, view: 'phone' }, 30);
      await page.evaluate(() => window.game!.openJournal());
      await expect(page.locator('#journalClose')).toBeFocused();
      await expect(page).toHaveScreenshot('phone-journal-found.png', TOLERANCE);
      expect(problems).toEqual([]);
    });

    // the bottle's card on a phone: the note is the longest words a card holds
    test('the bottle landed, at a phone’s width', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: { cured: 12 } });
      await set(page, { dirt: 0.2, time: 'day', view: 'phone' }, 30);
      expect(await page.evaluate(() => window.game!.fishTo('landed', 'bottle'))).toBe(true);
      await expect(page).toHaveScreenshot('phone-landed-bottle.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});

/**
 * The seasons' colours (`docs/seasons.md`, part 2): the standard scene from the shore by day, on a day in each of the
 * three seasons that are not summer's, whose pictures are all the others, with the season's fall in the air. A pond half cured, as the standard scene is.
 */
test.describe('the seasons', () => {
  for (const [name, day] of [
    ['autumn', 15],
    ['winter', 29],
    ['spring', 43],
  ] as const)
    test(`season-${name}-day`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: { cured: 6, day } });
      // ten seconds on, so the fall has reached the air above the water: the drops take eight to ten to come down
      await set(page, STANDARD, 600);
      await hideOverlays(page);
      expect((await page.evaluate(() => window.game!.season())).dressed).toBe(name);
      await expect(page.locator('#view')).toHaveScreenshot(`season-${name}-day.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
  for (const [name, day, time] of [
    ['season-autumn-dawn-mist', 15, 'dawn'],
    ['season-winter-night-mist', 29, 'night'],
  ] as const)
    test(name, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: { cured: 6, day } });
      await set(page, { ...STANDARD, time }, 600);
      await hideOverlays(page);
      expect((await page.evaluate(() => window.game!.season())).mist).toBe(true);
      await expect(page.locator('#view')).toHaveScreenshot(`${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });
});

/**
 * The rest of the seasons' pictures (`docs/seasons.md`, part 6): the cabin's calendar on day 29, winter's row holding
 * today's mark with the four season bands down its left edge; winter's shore by day at a phone's width; and winter's
 * shore on the lean rung, with no grass, no flakes and no mist but the season's colours on the banks and roof.
 */
test('cabin-calendar-bands', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 3, day: 29, place: 'cabin' } });
  await set(page, { ...CABIN_DAWN, cabin: false }, 60);
  await hideOverlays(page);
  expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
  expect(await page.evaluate(() => window.game!.calendar())).toMatchObject({ gone: 28, today: 28 });
  await expect(page.locator('#view')).toHaveScreenshot('cabin-calendar-bands.png', TOLERANCE);
  expect(problems).toEqual([]);
});

test.describe('winter on a phone', () => {
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

  test('phone-season-winter', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: { cured: 6, day: 29 } });
    await set(page, { ...STANDARD, view: 'phone' }, 600);
    await expect(page).toHaveScreenshot('phone-season-winter.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

test('season-winter-lean', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, rung: 'lean', save: { cured: 6, day: 29 } });
  await set(page, STANDARD, 600);
  await hideOverlays(page);
  const season = await page.evaluate(() => window.game!.season());
  expect(season.dressed).toBe('winter');
  expect(season.mist).toBe(false);
  expect(await page.evaluate(() => window.game!.rung())).toBe('lean');
  await expect(page.locator('#view')).toHaveScreenshot('season-winter-lean.png', TOLERANCE);
  expect(problems).toEqual([]);
});

// the Reservoir (`docs/lakes.md`, part 5): a big open water held in by a dam along the north bank, opened by a save that
// names it; by day from the shore, at dusk, from overhead, a fish at the bite as the pond's is, and on a phone
const RESERVOIR_SAVE = { lake: 'reservoir' } as const;

test.describe('the Reservoir', () => {
  for (const [name, scene] of [
    ['day', STANDARD],
    ['dusk', { ...STANDARD, time: 'dusk' }],
    ['overhead', { ...STANDARD, view: 'overhead' }],
  ] as const)
    test(`reservoir-${name}`, async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true, save: RESERVOIR_SAVE });
      expect(await page.evaluate(() => window.game!.lake())).toMatchObject({ id: 'reservoir' });
      await set(page, scene, 180);
      await hideOverlays(page);
      await expect(page.locator('#view')).toHaveScreenshot(`reservoir-${name}.png`, TOLERANCE);
      expect(problems).toEqual([]);
    });

  test('reservoir-fishing-bite', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: RESERVOIR_SAVE });
    await set(page, { dirt: 0.2, time: 'day', view: 'shore' }, 30);
    await page.evaluate(() => window.game!.fishTo('bite'));
    await hideOverlays(page);
    await expect(page.locator('#view')).toHaveScreenshot('reservoir-fishing-bite.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

test.describe('the Reservoir on a phone', () => {
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

  test('phone-reservoir', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: RESERVOIR_SAVE });
    await set(page, { ...STANDARD, view: 'phone' }, 180);
    await page.evaluate(() => {});
    await expect(page).toHaveScreenshot('phone-reservoir.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

// the map on the cabin's wall and the lakes page (`docs/lakes.md`, part 7). The map's picture is the cabin at home with the
// pin on the pond, cropped to the wall's frame at the screen's own pixels. The pin on the Reservoir has no picture: the pin
// reads the lake the save names, and a load in the cabin is always at home, so the only moment it is elsewhere is the
// journey's own fade; that move is held by `test/mapdraw.test.ts` and a stage reading `game.map()`.
test('cabin-map', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 3, day: 2, place: 'cabin' } });
  await set(page, { ...CABIN_DAWN, cabin: false }, 60);
  await hideOverlays(page);
  expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
  expect(await page.evaluate(() => window.game!.map())).toMatchObject({ pin: 'duckpond' });
  const at = (await page.evaluate(() => window.game!.mapOnScreen()))!;
  const clip = { x: Math.round(at.x - 80), y: Math.round(at.y - 64), width: 160, height: 128 };
  await expect(page).toHaveScreenshot('cabin-map.png', { ...TOLERANCE, clip });
  expect(problems).toEqual([]);
});

/** A save with each lake part cleaned: the pond a third, the Reservoir over half. */
const LAKES_SAVE = {
  day: 2,
  lakes: {
    duckpond: { cured: 4, drums: 0, journal: {}, found: [] },
    reservoir: { cured: 10, drums: 0, journal: {}, found: [] },
  },
};

test('desk-lakes-page', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: LAKES_SAVE });
  await set(page, STANDARD, 30);
  await page.evaluate(() => window.game!.openLakes());
  await expect(page.getByRole('button', { name: 'Go to the Reservoir' })).toBeFocused();
  await expect(page).toHaveScreenshot('desk-lakes-page.png', TOLERANCE);
  expect(problems).toEqual([]);
});

test.describe('the lakes page on a phone', () => {
  test.use({ viewport: PIXEL_7A, hasTouch: true, isMobile: true });

  test('phone-lakes-page', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true, save: LAKES_SAVE });
    await set(page, { ...STANDARD, view: 'phone' }, 30);
    await page.evaluate(() => window.game!.openLakes());
    await expect(page).toHaveScreenshot('phone-lakes-page.png', TOLERANCE);
    expect(problems).toEqual([]);
  });
});

// the morning after a day's end at the Reservoir: the wake is at home, in the cabin, with the way out to the pond and the
// way to the lakes both on the screen
test('desk-morning-out', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, fade: true, save: { lake: 'reservoir', time: 0.999, cured: 2 } });
  await page.evaluate(() => window.game!.step(100));
  const loaded = page.waitForEvent('load');
  await page.evaluate(() => window.game!.step(100));
  await loaded;
  await ready(page);
  await page.evaluate(() => {
    window.game!.arrived();
    window.game!.step(160);
  });
  expect(await page.evaluate(() => window.game!.place())).toBe('cabin');
  expect(await page.evaluate(() => window.game!.lake().id)).toBe('duckpond');
  await expect(page.locator('#downButton')).toHaveText('Out to the Duck Pond');
  await expect(page.locator('#elsewhereButton')).toBeVisible();
  await expect(page).toHaveScreenshot('desk-morning-out.png', TOLERANCE);
  expect(problems).toEqual([]);
});
