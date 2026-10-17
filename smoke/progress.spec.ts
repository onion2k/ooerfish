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
import { quantised } from '../src/heal';
import { FISH_COUNT, HEAL, jettyGap } from '../src/lake';
import { STANDARD, ready, set, start, watch } from './game';

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

test('the day runs from dawn: the light steps when the clock crosses into the next time, paused it does not, and all four looks are baked at ready', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const api = <T>(f: () => T) => page.evaluate(f);
  // the game starts at dawn, and the four environments are baked once the first frame is up, so no step in play bakes one
  expect(await api(() => window.game!.time())).toBe('dawn');
  expect((await api(() => window.game!.state())).timeOfDay).toBe(0.25);
  expect(await api(() => window.game!.looksBaked()), 'the four looks baked after ready').toBe(4);

  // the clock runs on by game time: a sixtieth of a day-second a frame
  await play(page, 60, 'a second of the day');
  expect((await api(() => window.game!.state())).timeOfDay).toBeCloseTo(0.25 + 1 / 720, 6);

  // each boundary between two looks, crossed by a step: the look is the old one until it, and the new one after
  for (const [from, to, at] of [
    ['dawn', 'day', 0.375],
    ['day', 'dusk', 0.625],
    ['dusk', 'night', 0.875],
    ['night', 'dawn', 0.125],
  ] as const) {
    await page.evaluate(
      async ([f, a]) => {
        await window.game!.time(f);
        window.game!.clock(a - 0.0005);
      },
      [from, at] as const,
    );
    await play(page, 10, `the ${from} look held`);
    expect(await api(() => window.game!.time()), `${from} before ${at}`).toBe(from);
    await play(page, 30, `crossing ${at}`);
    expect(await api(() => window.game!.time()), `${to} after ${at}`).toBe(to);
    // the frame across the step is inside its budget, as it is on either side
    expect(await api(() => window.game!.measureFrame()), `a frame of ${to}`).toBeLessThan(8);
  }
  // and the clock wrapped at midnight, still a time of the day
  await page.evaluate(() => window.game!.clock(0.9999));
  await play(page, 120, 'past midnight');
  expect((await api(() => window.game!.state())).timeOfDay).toBeLessThan(0.01);
  expect(await api(() => window.game!.time())).toBe('night');

  // paused, the clock stands still, however many frames the page draws
  const at = (await api(() => window.game!.state())).timeOfDay;
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let n = 0;
        const tick = () => (++n < 10 ? requestAnimationFrame(tick) : done());
        requestAnimationFrame(tick);
      }),
  );
  expect((await api(() => window.game!.state())).timeOfDay).toBe(at);
  // a look picked by name sets the clock there, and it runs on from it
  await page.evaluate(() => window.game!.time('dusk'));
  await play(page, 60, 'from dusk');
  expect((await api(() => window.game!.state())).timeOfDay).toBeCloseTo(0.75 + 1 / 720, 6);
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
  expect(before.length).toBe(FISH_COUNT);
  await play(page, 600, 'ten seconds of fish');
  const after = await page.evaluate(() => window.game!.fish());
  expect(after.length).toBe(FISH_COUNT);
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
  expect(count).toBe(FISH_COUNT);
  for (let second = 0; second < 10; second++) {
    await play(page, 60, `second ${second} by the jetty`);
    for (const f of await page.evaluate(() => window.game!.fish()))
      expect(jettyGap(f.x, f.y), `a fish at ${f.x},${f.y} in second ${second}`).toBeGreaterThan(0);
  }
  expect((await page.evaluate(() => window.game!.fish())).length).toBe(count);
  expect(problems).toEqual([]);
});

test('what a strike did is said: nothing biting yet, too soon at a nibble, and too late once the bite has gone', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  const said = page.locator('#castLine');
  await page.evaluate(() => {
    const g = window.game!;
    g.cast(Math.PI / 2, 0.62);
    for (let f = 0; f < 600 && g.lure().phase !== 'sinking'; f++) g.step(1);
  });
  await expect(said).toHaveText('waiting for a fish…');
  // struck with nothing there, on the button: the lure twitches, and that is said
  await page.locator('#reelButton').click();
  await expect(said).toHaveText('nothing biting yet');
  await page.evaluate(() => window.game!.step(130));
  await expect(said).not.toHaveText('nothing biting yet');
  // struck at a nibble: too soon
  await page.evaluate(() => {
    const g = window.game!;
    for (let f = 0; f < 3600 && g.fishing().phase !== 'nibbling'; f++) g.step(1);
  });
  await expect(said).toHaveText('nibble… wait for the dip');
  await page.locator('#reelButton').click();
  await expect(said).toHaveText('too soon, it swam off');
  // and a bite left until its window shuts: too late
  await page.evaluate(() => {
    const g = window.game!;
    for (let f = 0; f < 7200 && g.fishing().phase !== 'biting'; f++) g.step(1);
  });
  expect((await page.evaluate(() => window.game!.fishing())).phase).toBe('biting');
  await page.evaluate(() => window.game!.step(60));
  await expect(said).toHaveText('too late, it let go');
  await expect(page.locator('#biteMark')).toBeHidden();
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
  await expect(page.locator('#castLine')).toHaveText('BITE! strike now');
  await expect(page.locator('#reelButton')).toHaveText('Strike');
  // the bite is seen: a mark stands over the bobber, and the Strike button pulses by the game's clock
  const lure = await page.evaluate(() => window.game!.lure());
  const over = (await page.evaluate(([x, y]) => window.game!.project(x, y, 1.4), lure.bobber))!;
  const mark = (await page.locator('#biteMark').boundingBox())!;
  expect(Math.abs(mark.x + mark.width / 2 - over.x), 'the mark over the bobber').toBeLessThan(3);
  expect(Math.abs(mark.y + mark.height - over.y)).toBeLessThan(3);
  await expect(page.locator('#reelButton')).toHaveClass(/biting/);
  const pulse = () => page.locator('#reelButton').evaluate((b) => b.style.getPropertyValue('--pulse'));
  const pulses = new Set([await pulse()]);
  for (let k = 0; k < 4; k++) {
    await page.evaluate(() => window.game!.step(3));
    pulses.add(await pulse());
  }
  expect(pulses.size, 'the button pulses').toBeGreaterThan(1);
  await page.keyboard.press('Space');
  expect((await page.evaluate(() => window.game!.fishing())).phase).toBe('hooked');
  await play(page, 1, 'hooked');
  await expect(page.locator('#gauge')).toBeVisible();
  await expect(page.locator('#biteMark')).toBeHidden();
  await expect(page.locator('#reelButton')).not.toHaveClass(/biting/);
  // the bar is tall enough to play, and its fish is a fish
  expect((await page.locator('#gaugeBar').boundingBox())!.height).toBe(280);
  await expect(page.locator('#gaugeFish path')).toHaveCount(1);
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

test('a fish cured: the welcome goes at the first cast, the card says what the tap does, and the tap steps the gauge, the water and the save, which a reload keeps', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  const api = <T>(f: () => T) => page.evaluate(f);
  const meter = () => page.locator('#pondBar').getAttribute('aria-valuenow');

  // straight in: the pond's name, the gauge full, and a welcome line, and no title card
  await expect(page.locator('#pondName')).toHaveText('Duck Pond');
  expect(await meter()).toBe('100');
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome')).toContainText("Welcome home. The pond's fish are glowing");
  await expect(page.locator('#toast')).toBeHidden();

  // the first cast takes the welcome away
  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#catch')).toContainText('tap to cure it and put it in the bucket');
  const before = (await api(() => window.game!.state())).contamination;
  expect(before).toBe(1);

  // the tap on the card: a twelfth cleaner, in the game, the gauge and the save at once
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(11 / 12, 12);
  expect(await meter()).toBe('92');
  // the water is not: it heals over `HEAL.seconds`, and has hardly moved a frame in (docs/heal.md)
  expect(await api(() => window.game!.drawnDirt()), 'the water starts to heal, not jumps').toBeGreaterThan(
    11 / 12 + 0.05,
  );
  expect(JSON.parse(await api(() => window.game!.save()))).toEqual({ cured: 1 });
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toHaveText('Cured! The pond clears a little.');
  expect(await api(() => window.game!.events())).toContain('cured 1/12');
  expect(await api(() => window.game!.invariants())).toEqual([]);

  // the line goes by itself, in game time
  await api(() => window.game!.step(150));
  await expect(page.locator('#toast')).toBeHidden();

  // reload: the gauge and the water as left, and no welcome for a player who has cured a fish
  await page.reload();
  await ready(page);
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(11 / 12, 12);
  expect(await meter()).toBe('92');
  await expect(page.locator('#welcome')).toBeHidden();
  expect(problems).toEqual([]);
});

test('the twelfth fish cleans the pond and says so, and after it no fish is left to take the bait, the pond staying clean', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 11 } });
  const api = <T>(f: () => T) => page.evaluate(f);
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(1 / 12, 12);
  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  expect((await api(() => window.game!.state())).contamination).toBe(0);
  await expect(page.locator('#toast')).toContainText('The Duck Pond is clean! Every fish is cured.');
  await expect(page.locator('#pondBar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('#pond')).toHaveClass(/clean/);

  // every fish is cured, and the bait is one only an uncured fish takes: none is left to land, and the pond stays at nothing
  await api(() => window.game!.step(150));
  expect(await api(() => window.game!.fishTo('landed'))).toBe(false);
  expect((await api(() => window.game!.state())).contamination).toBe(0);
  // the API shows all twelve cured, and a cast into the pond says why nothing comes
  const fish = await api(() => window.game!.fish());
  expect(fish.length).toBe(12);
  expect(fish.filter((f) => f.cured).length, 'every fish cured').toBe(12);
  await api(() => window.game!.reelIn());
  expect(await api(() => window.game!.cast(Math.PI / 2, 0.62))).toBe(true);
  await api(() => window.game!.step(1200));
  await expect(page.locator('#castLine')).toHaveText('the pond is clean: nothing takes this bait');
  expect(await api(() => window.game!.fishing().phase), 'nothing came in twenty seconds').toBe('none');
  expect(JSON.parse(await api(() => window.game!.save()))).toEqual({ cured: 12 });
  expect(await api(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('a cure with the water already clean still hands the fish over again, gold from the next frame', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 11 } });
  const api = <T>(f: () => T) => page.evaluate(f);
  await api(() => window.game!.dirt(0));
  expect(await api(() => window.game!.drawnDirt())).toBe(0);
  expect(await api(() => window.game!.drawnCured()), 'a save of 11 is drawn with 11 gold').toBe(11);
  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  expect(await api(() => window.game!.drawnDirt()), 'the water was clear before and after').toBe(0);
  expect(await api(() => window.game!.drawnCured()), 'the twelfth is handed over gold').toBe(12);
  expect(problems).toEqual([]);
});

test('a cure heals the water over thirty seconds in steps, the gauge stepping at once, and a paused game hands over nothing', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 5 } });
  const api = <T>(f: () => T) => page.evaluate(f);
  const old = (await api(() => window.game!.state())).contamination;
  expect(old).toBeCloseTo(7 / 12, 12);
  expect(await api(() => window.game!.drawnDirt())).toBe(quantised(old, HEAL.step));

  // paused with no steps: two reads of the count, across frames the page drew itself, are the same
  const idle = await api(() => window.game!.waterHandovers());
  await api(() => window.game!.step(0));
  await api(() => window.game!.step(0));
  expect(await api(() => window.game!.waterHandovers()), 'a paused page hands nothing over').toBe(idle);

  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  const target = (await api(() => window.game!.state())).contamination;
  expect(target).toBeCloseTo(6 / 12, 12);
  await expect(page.locator('#pondBar')).toHaveAttribute('aria-valuenow', '50');
  const first = (await api(() => window.game!.drawnDirt()))!;
  expect(Math.abs(first - old), 'the water has barely moved a frame after the cure').toBeLessThanOrEqual(HEAL.step * 4);
  const handedAtCure = await api(() => window.game!.waterHandovers());

  let last = first;
  const steps = new Set<number>();
  for (let s = 0; s < 30; s++) {
    await api(() => window.game!.step(60));
    const now = (await api(() => window.game!.drawnDirt()))!;
    expect(now, 'the water never darkens in a heal').toBeLessThanOrEqual(last);
    expect(now).toBe(quantised(now, HEAL.step));
    steps.add(now);
    last = now;
  }
  expect(last, 'the water ends at the new contamination').toBe(quantised(target, HEAL.step));
  expect((await api(() => window.game!.state())).waterDirt).toBe(target);
  expect(steps.size).toBeGreaterThan(5);
  const handovers = (await api(() => window.game!.waterHandovers())) - handedAtCure;
  expect(handovers, 'no more than a handover a step').toBeLessThanOrEqual(1 / 12 / HEAL.step + 2);
  expect(handovers).toBeGreaterThan(5);

  // healed, the page hands nothing over for a further second
  const done = await api(() => window.game!.waterHandovers());
  await api(() => window.game!.step(60));
  expect(await api(() => window.game!.waterHandovers())).toBe(done);
  expect(await api(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('the lever draws the water at once, quantised', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true });
  await page.evaluate(() => window.game!.dirt(0.3));
  expect(await page.evaluate(() => window.game!.drawnDirt())).toBe(quantised(0.3, HEAL.step));
  expect((await page.evaluate(() => window.game!.state())).waterDirt).toBe(0.3);
  expect(problems).toEqual([]);
});
