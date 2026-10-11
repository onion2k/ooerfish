/**
 * The game played through in a real browser, a stage at a time. Played
 * through the test API with the game paused and stepped a frame at a time,
 * so it is the same every run and waits on no clock; but everything that
 * follows, the scene and the words on the screen, is the game's own.
 *
 * A feature that a player can reach gets a stage here, and after every
 * stage the game's invariants are checked.
 */
import { expect, test, type Page } from '@playwright/test';
import { STANDARD, set, start, watch } from './game';

/** Play `frames` frames, and check nothing that must hold has broken. */
async function play(page: Page, frames: number, stage: string) {
  const broken = await page.evaluate((n) => {
    window.game!.step(n);
    return window.game!.invariants();
  }, frames);
  expect(broken, `invariants after ${stage}`).toEqual([]);
}

test('the scenery is loaded at ready, and the banks wear the kit as content says, with cut cards among it', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  // the figures are worked out in node by test/scene.test.ts from the files on disk, and held equal here from the page
  const scenery = await page.evaluate(() => window.game!.scenery());
  expect(scenery).toEqual({ models: 33, placements: 246, triangles: 385769, cards: 20 });
  expect(scenery.cards).toBeGreaterThan(0);
  await play(page, 60, 'a second with the banks dressed');
  expect(problems).toEqual([]);
});

test('the banks grow grass in the breeze on the full rung, and on the lean rung neither it nor the woodland is drawn', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await set(page, STANDARD, 60);
  expect(await page.evaluate(() => window.game!.rung())).toBe('full');
  // grass is drawn, near the camera and past it, read back from the GPU
  const full = await page.evaluate(() => window.game!.grass());
  expect(full.near, 'blades near').toBeGreaterThan(1000);
  expect(full.far, 'blades far').toBeGreaterThan(0);
  const dear = await page.evaluate(() => window.game!.measureFrame());
  // the wind moves them: the same lake a second later has the grass drawn again, still there
  await play(page, 60, 'a second of grass in the breeze');
  expect((await page.evaluate(() => window.game!.grass())).near).toBeGreaterThan(1000);

  // lean: the grass let go and the woodland out of the banks
  await page.evaluate(() => window.game!.rung('lean'));
  expect(await page.evaluate(() => window.game!.rung())).toBe('lean');
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(186);
  await play(page, 2, 'a frame of the lean rung');
  expect(await page.evaluate(() => window.game!.grass())).toEqual({ near: 0, far: 0 });
  const cheap = await page.evaluate(() => window.game!.measureFrame());
  console.log(`lean ${cheap.toFixed(3)} ms against full ${dear.toFixed(3)} ms`);
  expect(cheap, 'the lean rung is cheaper than the full').toBeLessThan(dear * 0.8);

  // and back: the grass grows again and the woodland stands
  await page.evaluate(() => window.game!.rung('full'));
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(246);
  await play(page, 2, 'a frame of the full rung again');
  expect((await page.evaluate(() => window.game!.grass())).near).toBeGreaterThan(1000);
  expect(problems).toEqual([]);
});

test('the governor chooses a rung at boot when none is asked for, and an unknown rung is refused by name', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true, rung: 'auto' });
  const rung = await page.evaluate(() => window.game!.rung());
  expect(['full', 'lean']).toContain(rung);
  // the placements are those of the rung it chose
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(rung === 'full' ? 246 : 186);
  await play(page, 30, 'half a second on the rung chosen');
  expect(problems).toEqual([]);

  const bad = await page.context().newPage();
  await bad.goto('/?rung=thin');
  await expect(bad.locator('#bootMsg')).toContainText('unknown rung "thin"');
  await bad.close();
});

test("the lake's time runs while it is played, and stands still while it is paused", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const before = await page.evaluate(() => window.game!.state().t);
  await play(page, 120, 'two seconds stepped');
  const after = await page.evaluate(() => window.game!.state().t);
  expect(after - before).toBeCloseTo(2, 6);
  // paused, the page's own frames add no time, however many it draws: ten of them, counted, and not waited for by the clock
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let n = 0;
        const tick = () => (++n < 10 ? requestAnimationFrame(tick) : done());
        requestAnimationFrame(tick);
      }),
  );
  expect(await page.evaluate(() => window.game!.state().t)).toBe(after);
  expect(problems).toEqual([]);
});

test("a pebble splashes, its rings spread and are gone by the splash's end", async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  expect(await page.evaluate(() => window.game!.drop(2, 3))).toBe(true);
  await play(page, 30, 'half a second of a splash');
  const live = await page.evaluate(() => window.game!.splashes());
  expect(live.length).toBe(1);
  expect(live[0].age).toBeCloseTo(0.5, 5);
  await play(page, 150, 'the splash over');
  expect((await page.evaluate(() => window.game!.splashes()))[0].age).toBeGreaterThan(2.2);
  expect(await page.evaluate(() => window.game!.events())).toEqual(['splashed 2.0,3.0']);
  expect(problems).toEqual([]);
});

test('the fish swim the lake, and stay in it', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const before = await page.evaluate(() => window.game!.fish());
  expect(before.length).toBe(6);
  await play(page, 600, 'ten seconds of fish');
  const after = await page.evaluate(() => window.game!.fish());
  expect(after.length).toBe(6);
  for (let i = 0; i < after.length; i++)
    expect(Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y), `fish ${i} swam`).toBeGreaterThan(1);
  expect(problems).toEqual([]);
});

test('a fish bites, is struck by space, played on the Reel button, landed, and put in the bucket by its card', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  // cast to the middle of the lake through the API, and step until a fish bites
  await page.evaluate(() => {
    const g = window.game!;
    g.cast(Math.PI / 2, 0.62);
    for (let f = 0; f < 3600 && g.fishing().phase !== 'biting'; f++) g.step(1);
  });
  expect((await page.evaluate(() => window.game!.fishing())).phase).toBe('biting');
  await expect(page.locator('#castLine')).toHaveText('a bite! strike');
  await expect(page.locator('#reelButton')).toHaveText('Strike');
  await page.keyboard.press('Space');
  expect((await page.evaluate(() => window.game!.fishing())).phase).toBe('hooked');
  await play(page, 1, 'hooked');
  await expect(page.locator('#gauge')).toBeVisible();
  await expect(page.locator('#reelButton')).toHaveText('Reel');
  // played on the button by the mouse: held while the line is slack, let go when it is tight, a frame at a time
  const button = await page.locator('#reelButton').boundingBox();
  const [bx, by] = [button!.x + button!.width / 2, button!.y + button!.height / 2];
  await page.mouse.move(bx, by);
  let held = false;
  for (let f = 0; f < 120 * 60; f += 6) {
    const { phase, tension } = await page.evaluate(() => window.game!.fishing());
    if (phase !== 'hooked') break;
    if (!held && tension < 0.45) {
      await page.mouse.down();
      held = true;
    } else if (held && tension > 0.75) {
      await page.mouse.up();
      held = false;
    }
    expect((await page.evaluate(() => window.game!.fishing())).reeling).toBe(held);
    await page.evaluate(() => window.game!.step(6));
  }
  if (held) await page.mouse.up();
  await play(page, 1, 'the fight');
  expect((await page.evaluate(() => window.game!.fishing())).phase).toBe('landed');
  const landed = (await page.evaluate(() => window.game!.events())).filter((l) => l.startsWith('landed'));
  expect(landed).toHaveLength(1);
  // shown off on its card, and a tap on the card puts it in the bucket
  await expect(page.locator('#catch')).toBeVisible();
  await expect(page.locator('#catchName')).toHaveText('glowing perch');
  await expect(page.locator('#catchWeight')).toHaveText(/^\d\.\d\d kg$/);
  await page.locator('#catch').click();
  await play(page, 1, 'stowed');
  await expect(page.locator('#catch')).toBeHidden();
  await expect(page.locator('#bucket')).toHaveText('in the bucket: 1');
  expect((await page.evaluate(() => window.game!.fishing())).bucket).toBe(1);
  expect(problems).toEqual([]);
});
