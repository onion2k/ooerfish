/**
 * The game as a player gets it: served by Vite, run in Chromium on the real
 * GPU, with a fresh save each test. What the unit tests cannot reach — the
 * renderer, the frame loop, the page — checked for the things that would
 * make it plainly broken: an error, a black screen, a page wider than a
 * phone.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { ready, set, start, touchDrag, watch } from './game';
import { GRASS_WOBBLE, pixelsApart } from './judging';

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

test('a scenery file that will not load stops the boot, saying so, and no frame is drawn', async ({ page }) => {
  await page.route('**/scenery/scenery.bin', (route) => route.fulfill({ status: 404, body: 'gone' }));
  await page.goto('/');
  await expect(page.locator('#bootMsg')).toContainText('scenery-fetch');
  await expect(page.locator('#boot')).not.toHaveClass(/gone/);
  expect(await page.evaluate(() => window.game?.ready ?? false)).toBe(false);
});

test("works each of the lab's controls by mouse, and keeps them in the address", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const settings = () => page.evaluate(() => window.game!.settings());
  const pressed = (label: string) => page.getByRole('button', { name: label, exact: true });

  // the lake has one water, so the panel has no choice of it
  await expect(page.getByText('Water', { exact: true })).toHaveCount(0);
  await expect(pressed('Open water')).toHaveCount(0);

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

  // the water's caustics turned off and on again
  await pressed('Off').click();
  await expect.poll(settings).toMatchObject({ caustics: 'off' });
  await expect(pressed('Off')).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('caustics')).toBe('off');
  await pressed('On').click();
  await expect.poll(settings).toMatchObject({ caustics: 'on' });

  // the rocks' paint taken off and put back: its buttons are not called On and Off, which the caustics' are
  await expect(pressed('Painted')).toHaveAttribute('aria-pressed', 'true');
  await pressed('Plain').click();
  await expect.poll(settings).toMatchObject({ paint: 'off' });
  await expect(pressed('Plain')).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('paint')).toBe('off');
  await pressed('Painted').click();
  await expect.poll(settings).toMatchObject({ paint: 'on' });

  await pressed('Overhead').click();
  await expect.poll(settings).toMatchObject({ view: 'overhead' });
  const high = await page.evaluate(() => window.game!.camera());
  expect(high.position[2], 'overhead is high over the lake').toBeGreaterThan(80);

  // the address says it all, and a reload of it brings the same lake back
  const said = await settings();
  const url = new URL(page.url());
  expect(url.searchParams.has('water')).toBe(false);
  expect(url.searchParams.get('time')).toBe('dusk');
  expect(url.searchParams.get('view')).toBe('overhead');
  await page.reload();
  await ready(page);
  expect(await settings()).toEqual(said);
  await expect(pressed('Dusk')).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('refuses what the address says that it does not know, and draws the defaults', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/?water=lava&dirt=lots&time=teatime&view=moon&paused=1');
  await ready(page);
  expect(await page.evaluate(() => window.game!.settings())).toEqual({
    dirt: 1,
    time: 'day',
    view: 'shore',
    caustics: 'on',
    paint: 'on',
  });
  expect(problems).toEqual([]);
});

test("turns see-through water's caustics on and off in what is drawn", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await set(page, { dirt: 0, time: 'day', view: 'boat' }, 30);
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
  // caustics in this scene are faint (a few levels of 255), so any difference at all counts, not only a clear one
  expect(pixelsApart(on, off, 0), 'caustics on and off drew the same').toBeGreaterThan(GRASS_WOBBLE * 10);
  // not the same bytes: the grass's blades are drawn in no fixed order and a pixel or two of the far bank flickers
  expect(pixelsApart(on, again, 0), 'caustics on, twice at the same time, drew differently').toBeLessThanOrEqual(
    GRASS_WOBBLE,
  );
  expect(problems).toEqual([]);
});

test("turns the rocks' painted edge off and on in what is drawn, at the boulder by the shore", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await set(page, { dirt: 0, time: 'day', view: 'shore' }, 30);
  await page.evaluate(() => {
    for (const id of ['stats', 'help', 'labPanel']) document.getElementById(id)!.hidden = true;
  });
  // the camera brought to the boulder at the shore's edge, near and from the side the Shore view looks over
  await page.evaluate(() => window.game!.look(-13, -25.6, { azimuth: 0, polar: 1.3, radius: 9 }));
  // a window on the boulder alone, so the cliff and the banks are not what is counted
  const spot = (await page.evaluate(() => window.game!.project(-13, -25.6, 0.5)))!;
  expect(spot, 'the boulder is on the screen').not.toBeNull();
  const box = (await page.locator('#view').boundingBox())!;
  const clip = { x: box.x + spot.x - 80, y: box.y + spot.y - 80, width: 160, height: 160 };
  const shot = async (paint: 'on' | 'off') => {
    await page.evaluate(async (p) => {
      await window.game!.paint(p);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, paint);
    return page.screenshot({ clip, animations: 'disabled' });
  };
  const on = await shot('on');
  const off = await shot('off');
  const again = await shot('on');
  expect(await page.evaluate(() => window.game!.settings().paint)).toBe('on');
  // the chalk is a stroke of some hundreds of pixels on a boulder: a count over nought, here well over the grass's flicker
  const apart = pixelsApart(on, off, 0);
  console.log(`paint on against off at the boulder: ${apart} pixels apart`);
  expect(apart, 'paint on and off drew the same boulder').toBeGreaterThan(GRASS_WOBBLE * 5);
  expect(pixelsApart(on, again, 0), 'paint on, twice, drew differently').toBeLessThanOrEqual(GRASS_WOBBLE);
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
  // and the water is handed its ripples by the next frame drawn, and not before
  const ripples = async () => {
    await page.evaluate(() => window.game!.step(0));
    return page.evaluate(() => window.game!.ripples());
  };
  expect(await ripples(), "the tap's ripples handed to the water").toHaveLength(1);

  // a drag across the water, from overhead, turns the camera, and drops nothing
  await page.evaluate(() => window.game!.view('overhead'));
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + 10, { steps: 6 });
  await page.mouse.up();
  expect((await splashes()).length, 'a drag drops none').toBe(1);

  // the panel's button drops one near what the camera looks at
  await page.getByRole('button', { name: 'Drop a pebble' }).click();
  expect((await splashes()).length, 'the button drops one').toBe(2);
  expect(await ripples(), 'and its ripples too').toHaveLength(2);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('casts by a drag back in cast mode, to where its preview said, and not otherwise', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await page.evaluate(() => window.game!.mode('cast'));
  const box = (await page.locator('#view').boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
  const lure = () => page.evaluate(() => window.game!.lure());

  // a drag back and a little to the left: while it is held, the preview shows where it will land, on the water
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 40, from.y + 160, { steps: 8 });
  const preview = (await page.evaluate(() => window.game!.preview()))!;
  expect(preview, 'the preview while aiming').not.toBe(null);
  expect(preview.onWater).toBe(true);
  expect(preview.x, 'a drag to the left casts to the right').toBeGreaterThan(0);
  expect((await lure()).phase, 'nothing cast until let go').toBe('ready');
  await page.mouse.up();
  expect(await page.evaluate(() => window.game!.preview()), 'no preview once let go').toBe(null);
  expect((await lure()).phase).toBe('flying');
  // flown out, it lands where the preview said, splashes, and sinks under its bobber
  await page.evaluate(() => window.game!.step(180));
  const landed = await lure();
  expect(landed.phase).toBe('sinking');
  expect(Math.hypot(landed.bobber[0] - preview.x, landed.bobber[1] - preview.y), 'where the preview said').toBeLessThan(
    1e-6,
  );
  expect((await page.evaluate(() => window.game!.events())).length, 'a splash').toBe(1);
  const handed = await page.evaluate(() => window.game!.ripples());
  expect(handed, 'its ripples handed to the water').toHaveLength(1);
  expect(Math.hypot(handed[0].x - preview.x, handed[0].y - preview.y), 'where it landed').toBeLessThan(1e-4);
  expect(handed[0].size, "a lure's, smaller than a pebble's").toBeLessThan(1);
  await expect(page.locator('#castLine')).toHaveText('waiting for a fish…');

  // reeled in, it is ready to cast again
  await page.getByRole('button', { name: 'Reel in' }).click();
  expect((await lure()).phase).toBe('ready');

  // a drag let go near where it began casts nothing, and drops nothing either
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 14, { steps: 3 });
  await page.mouse.up();
  expect((await lure()).phase, 'taken back').toBe('ready');
  expect(await page.evaluate(() => window.game!.splashes()), 'no pebble').toHaveLength(1);

  // a view picked from the panel is look mode: a drag from overhead turns the camera, and casts nothing
  await page.evaluate(() => window.game!.view('overhead'));
  expect(await page.evaluate(() => window.game!.mode())).toBe('look');
  const before = await page.evaluate(() => window.game!.camera().position);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 120, from.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.evaluate(() => window.game!.step(1));
  expect((await lure()).phase, 'no cast from overhead').toBe('ready');
  expect(await page.evaluate(() => window.game!.camera().position), 'the camera turned').not.toEqual(before);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('strikes by a tap and reels by a hold in cast mode, and by the button from any view', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await page.evaluate(() => window.game!.mode('cast'));
  const box = (await page.locator('#view').boundingBox())!;
  const on = { x: box.x + box.width / 2, y: box.y + box.height * 0.45 };
  const fishing = () => page.evaluate(() => window.game!.fishing());
  const toBite = () =>
    page.evaluate(() => {
      const g = window.game!;
      g.cast(Math.PI / 2, 0.62);
      for (let f = 0; f < 3600 && g.fishing().phase !== 'biting'; f++) g.step(1);
    });

  // with the lure in the water, a tap strikes, and drops no pebble: on a bite, it hooks the fish
  await toBite();
  expect((await fishing()).phase).toBe('biting');
  const splashes = (await page.evaluate(() => window.game!.splashes())).length;
  await page.mouse.click(on.x, on.y);
  expect((await fishing()).phase, 'a tap struck').toBe('hooked');
  expect((await page.evaluate(() => window.game!.splashes())).length, 'and dropped no pebble').toBe(splashes);
  // held on the water, it reels; let go, it does not
  await page.mouse.move(on.x, on.y);
  await page.mouse.down();
  expect((await fishing()).reeling, 'a hold reels').toBe(true);
  await page.mouse.up();
  expect((await fishing()).reeling).toBe(false);

  // from overhead, the button: held, it reels, and let go, it does not
  await page.evaluate(() => window.game!.view('overhead'));
  const button = page.locator('#reelButton');
  await expect(button).toHaveText('Reel');
  const b = (await button.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect((await fishing()).reeling, 'the button held reels').toBe(true);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  expect((await fishing()).reeling).toBe(false);
  // a fish on: a cast is refused, and the panel's reel-in leaves it on the line
  expect(await page.evaluate(() => window.game!.cast(Math.PI / 2, 0.5))).toBe(false);
  await page.getByRole('button', { name: 'Reel in' }).click();
  expect((await fishing()).phase).toBe('hooked');
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('looks round by default, and casts only once switched to, by the button or the C key', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const api = <T>(f: () => T) => page.evaluate(f);
  const mode = () => api(() => window.game!.mode());
  const camera = () => api(() => window.game!.camera().position);
  const lure = () => api(() => window.game!.lure().phase);
  const button = page.locator('#modeButton');
  const box = (await page.locator('#view').boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
  const drag = async (dx: number, dy: number) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
    await page.mouse.up();
    await api(() => window.game!.step(1));
  };

  // look is the mode the page starts in, whatever the view: here the Shore view
  expect(await mode()).toBe('look');
  expect((await api(() => window.game!.settings())).view).toBe('shore');
  await expect(button).toHaveText('Cast');
  await expect(page.locator('#help')).toContainText('drag to look round');
  const shore = await camera();

  // a drag back turns the camera, and casts nothing, in the Shore view too
  await drag(-40, 160);
  expect(await camera(), 'the camera turned').not.toEqual(shore);
  expect(await lure(), 'and nothing was cast').toBe('ready');
  expect(await api(() => window.game!.preview()), 'no preview in look mode').toBe(null);
  expect(await api(() => window.game!.splashes()), 'and no pebble dropped').toHaveLength(0);

  // C switches to cast: the camera is put at the shore view, the button says what it does next
  await page.keyboard.press('c');
  expect(await mode()).toBe('cast');
  const put = await camera();
  put.forEach((v, k) => expect(v, 'the camera is back at the shore view').toBeCloseTo(shore[k], 3));
  await expect(button).toHaveText('Look round');
  await expect(page.locator('#help')).toContainText('drag back to cast');

  // and the same drag now casts, the camera held still
  await drag(-40, 160);
  expect(await lure()).toBe('flying');
  expect(await camera(), 'the camera held still').toEqual(put);

  // the button switches back, leaving the camera where it was, and the orbit works again
  await button.click();
  expect(await mode()).toBe('look');
  await expect(button).toHaveText('Cast');
  expect(await camera()).toEqual(put);
  await api(() => window.game!.step(180));
  const sinking = await lure();
  await drag(120, 30);
  expect(await camera(), 'the camera turned again').not.toEqual(put);
  expect(await lure(), 'and the lure was left as it was').toBe(sinking);
  // a tap on the water in look mode drops a pebble, and does not strike with the lure in the water
  const at = (await api(() => window.game!.project(4, -6, 0)))!;
  await page.mouse.click(at.x, at.y);
  expect(await api(() => window.game!.splashes()), 'a tap drops a pebble, the lure sinking').toHaveLength(2);
  expect(await lure()).toBe(sinking);

  // the key does nothing over the lab's controls, where it is only a letter
  await page.getByRole('button', { name: 'Dusk', exact: true }).focus();
  await page.keyboard.press('c');
  expect(await mode(), 'c over a control').toBe('look');

  // a view picked on the panel in cast mode is look mode, and the camera goes where the view says
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press('c');
  expect(await mode()).toBe('cast');
  await page.getByRole('button', { name: 'Overhead', exact: true }).click();
  expect(await mode(), 'a view picked').toBe('look');
  await expect(button).toHaveText('Cast');
  expect((await camera())[2], 'overhead is high').toBeGreaterThan(80);
  // the Shore view picked again puts the camera back, as it is the view's to do, and stays look
  await page.getByRole('button', { name: 'Shore', exact: true }).click();
  expect(await mode()).toBe('look');
  const back = await camera();
  back.forEach((v, k) => expect(v).toBeCloseTo(shore[k], 3));
  // and picked while it is the view already, it puts the camera back from wherever it was turned
  await drag(100, 20);
  expect(await camera()).not.toEqual(back);
  await page.getByRole('button', { name: 'Shore', exact: true }).click();
  (await camera()).forEach((v, k) => expect(v).toBeCloseTo(shore[k], 3));

  // the test API: the mode read and set, cast putting the camera at the shore
  await api(() => window.game!.view('boat'));
  await api(() => window.game!.mode('cast'));
  expect((await api(() => window.game!.settings())).view, 'cast is the Shore view').toBe('shore');
  await api(() => window.game!.mode('look'));
  expect(await mode()).toBe('look');
  expect(await api(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('draws each fish as a body that flexes as it swims, its head where the fish is, a hooked one too', async ({
  page,
}) => {
  await start(page, { seed: 1, paused: true });
  const g = () => page.evaluate(() => ({ fish: window.game!.fish(), pose: window.game!.fishPose(0) }));
  await page.evaluate(() => window.game!.step(60));
  const a = await g();
  expect(a.pose.length, 'a nose, the joints between segments and the stalk’s end').toBe(5);
  // the head's back, the second joint, is where the school has the fish, under the water
  expect(a.pose[1][0]).toBeCloseTo(a.fish[0].x, 3);
  expect(a.pose[1][1]).toBeCloseTo(a.fish[0].y, 3);
  for (const [, , z] of a.pose) expect(z).toBeLessThan(0);
  // how far the stalk's end lies to the side of the line from the head's back to the nose, through a beat
  const swing = async (frames: number, i = 0) => {
    let most = 0;
    for (let f = 0; f < frames; f++) {
      const pose = await page.evaluate((k) => {
        window.game!.step(1);
        return window.game!.fishPose(k);
      }, i);
      const [n, h, e] = [pose[0], pose[1], pose[4]];
      const fx = n[0] - h[0],
        fy = n[1] - h[1];
      most = Math.max(most, Math.abs((fx * (e[1] - h[1]) - fy * (e[0] - h[0])) / Math.hypot(fx, fy)));
    }
    return most;
  };
  const calm = await swing(40);
  expect(calm, 'the tail swings as it swims').toBeGreaterThan(0.02);
  expect(await page.evaluate(() => window.game!.fishTo('fight'))).toBe(true);
  const fought = await page.evaluate(() => window.game!.fishing().fish);
  // played on, it flexes still; that it beats harder is the unit tests', since the fight's steering bends it too
  expect(await swing(60, fought)).toBeGreaterThan(0.02);
  expect(await page.evaluate(() => window.game!.fishPose(99))).toEqual([]);
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
    // the mode button is in reach on the phone, and one finger dragged back in cast mode casts, as the mouse does
    await expect(page.locator('#modeButton')).toBeInViewport();
    await page.locator('#modeButton').tap();
    expect(await page.evaluate(() => window.game!.mode())).toBe('cast');
    await touchDrag(page, { x: 200, y: 500 }, { x: 200, y: 640 });
    expect((await page.evaluate(() => window.game!.lure())).phase, 'a finger casts').toBe('flying');
    expect(problems).toEqual([]);
  });
});
