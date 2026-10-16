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
import { jettyGap } from '../src/lake';
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
  expect(scenery).toEqual({ models: 30, placements: 426, triangles: 154941, cards: 10 });
  expect(scenery.cards).toBeGreaterThan(0);
  await play(page, 60, 'a second with the banks dressed');
  expect(problems).toEqual([]);
});

/**
 * How much cheaper a frame of the lean rung must be than one of the full: the grass's own cost, and not a share of
 * the frame, since every feature on the water costs the same on both rungs and dilutes the share. The grass was
 * measured at 0.67 to 0.72 ms over nine runs at the standard scene on 14 October 2026 (the detail layer's take-in,
 * docs/crystal.md part 11c), at the parent commit and after it alike; the woodland, which stands on both rungs,
 * costs 0.1; and a frame wobbles by 0.15 (smoke/judging.ts). Half the grass is over the wobble and well over the
 * woodland, so a lean rung that let no grass go would be caught.
 */
const GRASS_SAVING_MS = 0.35;

test('the banks grow grass in the breeze on the full rung, and on the lean rung the grass is let go and the woodland stands', async ({
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

  // lean: the grass let go, and the woodland standing as it did
  await page.evaluate(() => window.game!.rung('lean'));
  expect(await page.evaluate(() => window.game!.rung())).toBe('lean');
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(426);
  await play(page, 2, 'a frame of the lean rung');
  expect(await page.evaluate(() => window.game!.grass())).toEqual({ near: 0, far: 0 });
  const cheap = await page.evaluate(() => window.game!.measureFrame());
  console.log(`lean ${cheap.toFixed(3)} ms against full ${dear.toFixed(3)} ms`);
  expect(dear - cheap, 'the lean rung is cheaper than the full by the grass').toBeGreaterThan(GRASS_SAVING_MS);

  // and back: the grass grows again and the woodland stands
  await page.evaluate(() => window.game!.rung('full'));
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(426);
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
  // the banks stand the same on either rung
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(426);
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

test('a pebble splashes, and its ripples are handed to the water as they age, until they are over', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const ripples = () => page.evaluate(() => window.game!.ripples());
  expect(await ripples(), 'none before anything lands').toEqual([]);
  expect(await page.evaluate(() => window.game!.drop(2, 3))).toBe(true);
  await play(page, 30, 'half a second of a splash');
  const live = await page.evaluate(() => window.game!.splashes());
  expect(live.length).toBe(1);
  expect(live[0].age).toBeCloseTo(0.5, 5);
  // the frame drawn last handed the water this splash, half a second old, a pebble's size
  const handed = await ripples();
  expect(handed).toHaveLength(1);
  expect([handed[0].x, handed[0].y, handed[0].size]).toEqual([2, 3, 1]);
  expect(handed[0].age).toBeCloseTo(0.5, 5);
  await play(page, 150, 'three seconds of a splash');
  expect((await ripples())[0].age, 'still rippling at three seconds').toBeCloseTo(3, 5);
  await play(page, 31, 'the ripples over');
  expect((await page.evaluate(() => window.game!.splashes()))[0].age).toBeGreaterThan(3.5);
  expect(await ripples(), 'none handed once they are over').toEqual([]);
  expect(await page.evaluate(() => window.game!.events())).toEqual(['splashed 2.0,3.0']);
  expect(problems).toEqual([]);
});

test('a cast onto the bank lies there and hands the water no ripples; one onto the water does', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  // the look pictures' cast at the bank, off to the east of the Shore view
  expect(await page.evaluate(() => window.game!.cast(0.3, 0.85))).toBe(true);
  await play(page, 180, 'the cast flown out and landed');
  expect((await page.evaluate(() => window.game!.lure())).phase).toBe('lying');
  expect(await page.evaluate(() => window.game!.ripples()), 'no ripples from the bank').toEqual([]);
  await page.evaluate(() => window.game!.reelIn());
  expect(await page.evaluate(() => window.game!.cast(Math.PI / 2 + 0.2, 0.7))).toBe(true);
  await play(page, 180, 'the cast flown out and sinking');
  expect(await page.evaluate(() => window.game!.ripples()), "the water's ripples").toHaveLength(1);
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

test('the fish keep off the jetty’s deck, ten seconds in a second at a time, and the count is the same at the end', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const count = (await page.evaluate(() => window.game!.fish())).length;
  expect(count).toBe(6);
  for (let second = 0; second < 10; second++) {
    await play(page, 60, `second ${second} by the jetty`);
    for (const f of await page.evaluate(() => window.game!.fish()))
      expect(jettyGap(f.x, f.y), `a fish at ${f.x},${f.y} in second ${second}`).toBeGreaterThan(0);
  }
  expect((await page.evaluate(() => window.game!.fish())).length).toBe(count);
  expect(problems).toEqual([]);
});

test('a fish bites, is struck by space, played on the bar by the Reel button and by space, landed, and put in the bucket by its card', async ({
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
  // the bar shows the zone and the fish where the game has them, and the meter part filled
  const bar = await page.locator('#gaugeBar').boundingBox();
  const shown = await page.evaluate(() => {
    const at = (id: string) => document.getElementById(id)!.getBoundingClientRect();
    return { zone: at('gaugeZone'), fish: at('gaugeFish'), fill: at('gaugeMeterFill'), meter: at('gaugeMeter') };
  });
  const first = await page.evaluate(() => window.game!.fishing());
  expect(first.meter).toBeCloseTo(0.3, 1);
  expect(shown.zone.height / bar!.height).toBeCloseTo(first.width, 1);
  expect((bar!.y + bar!.height - (shown.fish.y + shown.fish.height / 2)) / bar!.height).toBeCloseTo(first.fishAt, 1);
  expect(shown.fill.height / shown.meter.height).toBeCloseTo(first.meter, 1);
  // played as a careful hand plays it, a tenth of a second at a time: held while the zone's middle is below the fish,
  // on the button by the mouse for the first ten seconds, and by space after
  const button = await page.locator('#reelButton').boundingBox();
  const [bx, by] = [button!.x + button!.width / 2, button!.y + button!.height / 2];
  await page.mouse.move(bx, by);
  let held: 'mouse' | 'space' | null = null;
  const letGo = async () => {
    if (held === 'mouse') await page.mouse.up();
    if (held === 'space') await page.keyboard.up('Space');
    held = null;
  };
  let movedUp = false,
    fell = false;
  // the bar stands still on the screen however the words under it change, in the zone or out of it
  const places = new Set<string>();
  const words = new Set<string>();
  for (let f = 0; f < 120 * 60; f += 6) {
    const { phase, zone, width, fishAt } = await page.evaluate(() => window.game!.fishing());
    if (phase !== 'hooked') break;
    const by = f < 600 ? 'mouse' : 'space';
    const want = zone + width / 2 < fishAt;
    if (held && (!want || held !== by)) await letGo();
    if (want && !held) {
      if (by === 'mouse') await page.mouse.down();
      else await page.keyboard.down('Space');
      held = by;
    }
    expect((await page.evaluate(() => window.game!.fishing())).reeling).toBe(held !== null);
    const place = await page.locator('#gaugeBar').boundingBox();
    places.add(`${Math.round(place!.x)} ${Math.round(place!.y)}`);
    words.add((await page.locator('#gaugeWords').textContent()) ?? '');
    await page.evaluate(() => window.game!.step(6));
    const after = (await page.evaluate(() => window.game!.fishing())).zone;
    if (held && after > zone) movedUp = true;
    if (!held && after < zone) fell = true;
  }
  expect(movedUp, 'the zone rose while held').toBe(true);
  expect(fell, 'and fell when let go').toBe(true);
  expect([...words].sort(), 'the fish was both in the zone and out of it').toEqual(['in the zone', 'out of the zone']);
  expect([...places], 'the bar never moved on the screen').toHaveLength(1);
  await letGo();
  await play(page, 1, 'the fight');
  await expect(page.locator('#gauge')).toBeHidden();
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
