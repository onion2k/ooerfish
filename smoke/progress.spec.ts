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
import { DRUMS, FIGHT, FISH_COUNT, GEAR, HEAL, KINDS, jettyGap } from '../src/lake';

/** The rod's gift, as content says it, so the test reads the figure and does not say it again. */
const ROD = GEAR.find((g) => g.id === 'rod')!;
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
 * The rungs here are held by what they draw, never by what a frame costs: the blades read back from the GPU and the
 * placements counted are the same however busy the machine is. What the lean rung saves is the perf gate's to hold
 * (smoke/perf.spec.ts), where a frame is measured as a frame should be; timed here it failed on a loaded machine
 * though nothing was wrong.
 */
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
  // the wind moves them: the same lake a second later has the grass drawn again, still there
  await play(page, 60, 'a second of grass in the breeze');
  expect((await page.evaluate(() => window.game!.grass())).near).toBeGreaterThan(1000);

  // lean: the grass let go, and the woodland standing as it did
  await page.evaluate(() => window.game!.rung('lean'));
  expect(await page.evaluate(() => window.game!.rung())).toBe('lean');
  expect(await page.evaluate(() => window.game!.scenery().placements)).toBe(426);
  await play(page, 2, 'a frame of the lean rung');
  expect(await page.evaluate(() => window.game!.grass())).toEqual({ near: 0, far: 0 });

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
  // and the clock wrapped at midnight, still a time of the day, with the yawn begun
  await page.evaluate(() => window.game!.clock(0.9999));
  await play(page, 20, 'past midnight');
  expect((await api(() => window.game!.state())).timeOfDay).toBeLessThan(0.01);
  expect(await api(() => window.game!.time())).toBe('night');
  expect(await api(() => window.game!.place())).toBe('yawning');
  // the night passes, and the player comes down to the pond at dawn
  await play(page, 100, 'the night');
  await page.evaluate(() => window.game!.out());
  expect((await api(() => window.game!.state())).timeOfDay).toBe(0.25);
  expect(await api(() => window.game!.time())).toBe('dawn');

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
  await start(page, { seed: 7, paused: true });
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
  // the card names the fish's temper before its kind, the one the game drew when it was hooked
  const temper = (await page.evaluate(() => window.game!.fishing())).temper;
  expect(['calm', 'steady', 'feisty']).toContain(temper);
  const kind = await page.evaluate(() => {
    const g = window.game!;
    return g.fish()[g.fishing().fish].kind;
  });
  await expect(page.locator('#catchName')).toHaveText(`${temper} ${KINDS[kind].name}`);
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

  // the tap on the card: a sixteenth cleaner, in the game, the gauge and the save at once
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(15 / 16, 12);
  expect(await meter()).toBe('94');
  // the water is not: it heals over `HEAL.seconds`, and has hardly moved a frame in (docs/heal.md)
  expect(await api(() => window.game!.drawnDirt()), 'the water starts to heal, not jumps').toBeGreaterThan(
    15 / 16 + 0.05,
  );
  expect(JSON.parse(await api(() => window.game!.save()))).toMatchObject({ cured: 1, day: 1, drums: 0 });
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
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(15 / 16, 12);
  expect(await meter()).toBe('94');
  await expect(page.locator('#welcome')).toBeHidden();
  expect(problems).toEqual([]);
});

test('the twelfth fish cleans the pond and says so, and after it no fish is left to take the bait, the pond staying clean', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 11, drums: DRUMS.count } });
  const api = <T>(f: () => T) => page.evaluate(f);
  expect((await api(() => window.game!.state())).contamination).toBeCloseTo(1 / 16, 12);
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
  expect(JSON.parse(await api(() => window.game!.save()))).toMatchObject({ cured: 12, day: 1, drums: DRUMS.count });
  expect(await api(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('the second cure gives the line: its toast follows the cure’s once, and the gear is in force', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 1 } });
  const api = <T>(f: () => T) => page.evaluate(f);
  expect(await api(() => window.game!.gear())).toEqual({
    line: false,
    reel: false,
    rod: false,
    bobber: false,
    bait: false,
  });
  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  // the cure's own line first, and the gift's after it, the two never at once
  await expect(page.locator('#toast')).toHaveText('Cured! The pond clears a little.');
  await api(() => window.game!.step(150));
  await expect(page.locator('#toast')).toHaveText(
    'A gift from the Sunny Atom: a stronger line. The meter drains more slowly.',
  );
  expect((await api(() => window.game!.gear())).line).toBe(true);
  await api(() => window.game!.step(300));
  await expect(page.locator('#toast')).toBeHidden();
  expect((await api(() => window.game!.events())).filter((e) => e.startsWith('gifted'))).toEqual([
    'gifted a stronger line',
  ]);
  expect(await api(() => window.game!.invariants())).toEqual([]);

  // the next cure is not a gift, and says only that it cured
  expect(await api(() => window.game!.fishTo('landed'))).toBe(true);
  await page.locator('#catch').click();
  await api(() => window.game!.step(1));
  await expect(page.locator('#toast')).toHaveText('Cured! The pond clears a little.');
  await api(() => window.game!.step(600));
  // the log was read (and so emptied) above with the one gift in it: this read has the third cure and no second gift
  const later = await api(() => window.game!.events());
  expect(later).toContain('cured 3/12');
  expect(later.filter((e) => e.startsWith('gifted'))).toEqual([]);
  expect(problems).toEqual([]);
});

test('a load from a save of 6 holds the line, reel and rod with no toast, and the next fight has the rod’s zone', async ({
  page,
}) => {
  const problems = watch(page);
  await start(page, { seed: 11, paused: true, save: { cured: 6 } });
  const api = <T>(f: () => T) => page.evaluate(f);
  expect(await api(() => window.game!.gear())).toEqual({
    line: true,
    reel: true,
    rod: true,
    bobber: false,
    bait: false,
  });
  await expect(page.locator('#toast')).toBeHidden();
  expect(await api(() => window.game!.fishTo('fight'))).toBe(true);
  expect((await api(() => window.game!.fishing())).width).toBeCloseTo(FIGHT.width + ROD.plus, 12);
  // the bar draws the wider zone: its height is the line's width, as a share of the bar
  const bar = await page.locator('#gaugeZone').evaluate((e) => (e as HTMLElement).style.height);
  expect(bar).toBe(`${Math.round((FIGHT.width + ROD.plus) * 1000) / 10}%`);
  await expect(page.locator('#toast')).toBeHidden();
  expect((await api(() => window.game!.events())).filter((e) => e.startsWith('gifted'))).toEqual([]);
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
  expect(old).toBeCloseTo(11 / 16, 12);
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
  expect(target).toBeCloseTo(10 / 16, 12);
  await expect(page.locator('#pondBar')).toHaveAttribute('aria-valuenow', '63');
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
  expect(handovers, 'no more than a handover a step').toBeLessThanOrEqual(1 / 16 / HEAL.step + 2);
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

/**
 * Start again, played as a user does it. No `save` is handed to `start`: its init script writes the save on every load,
 * and the reload that Start again makes would put the old one back. The fish is cured in the page's own store instead,
 * in a fresh context, so the player's storage is never touched.
 */
test.describe('Start again', () => {
  const DIALOG = '#startAgain';
  const saved = (page: Page) => page.evaluate(() => JSON.parse(window.game!.save()) as { cured: number });
  const stored = (page: Page) => page.evaluate(() => localStorage.getItem('ooerfish-save-v1'));
  const openFromMenu = async (page: Page) => {
    await page.locator('#menuButton').click();
    await page.getByRole('menuitem', { name: 'Start again' }).click();
    await expect(page.locator(DIALOG)).toBeVisible();
  };
  /** A page with one fish cured and kept in its own store. */
  const withOneCured = async (page: Page) => {
    await start(page, { seed: 7, paused: true });
    expect(await page.evaluate(() => window.game!.fishTo('landed'))).toBe(true);
    await page.locator('#catch').click();
    await page.evaluate(() => window.game!.step(1));
    expect((await saved(page)).cured).toBe(1);
    expect(JSON.parse((await stored(page))!)).toMatchObject({ cured: 1, day: 1, drums: 0 });
  };

  test('asks first, and Keep playing, Escape and a click outside each leave the save as it was', async ({ page }) => {
    const problems = watch(page);
    await withOneCured(page);
    await openFromMenu(page);
    await expect(page.locator(DIALOG)).toContainText(
      'Start again? Every fish you have cured goes back to glowing, and the pond to sick.',
    );
    await expect(page.locator(DIALOG)).toHaveAttribute('role', 'dialog');
    await expect(page.locator(DIALOG)).toHaveAttribute('aria-modal', 'true');

    await page.getByRole('button', { name: 'Keep playing' }).click();
    await expect(page.locator(DIALOG)).toBeHidden();
    expect(JSON.parse((await stored(page))!)).toMatchObject({ cured: 1, day: 1, drums: 0 });

    await openFromMenu(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(DIALOG)).toBeHidden();
    expect(JSON.parse((await stored(page))!)).toMatchObject({ cured: 1, day: 1, drums: 0 });

    await openFromMenu(page);
    await page.mouse.click(3, 3);
    await expect(page.locator(DIALOG)).toBeHidden();
    expect(JSON.parse((await stored(page))!)).toMatchObject({ cured: 1, day: 1, drums: 0 });
    expect((await page.evaluate(() => window.game!.state())).contamination).toBeCloseTo(15 / 16, 12);
    expect(problems).toEqual([]);
  });

  test('Start again wipes the save and reloads onto a sick pond with no gifts and the welcome showing', async ({
    page,
  }) => {
    await withOneCured(page);
    await openFromMenu(page);
    const reloaded = page.waitForEvent('load');
    await page.locator('#startAgainConfirm').click();
    await reloaded;
    await ready(page);
    expect(await stored(page)).toBeNull();
    expect(await saved(page)).toEqual({ cured: 0, day: 1, drums: 0, journal: {} });
    expect((await page.evaluate(() => window.game!.state())).contamination).toBe(1);
    expect(Object.values(await page.evaluate(() => window.game!.gear())).some(Boolean)).toBe(false);
    await expect(page.locator('#welcome')).toBeVisible();
  });

  test('by keyboard: the menu, the item, and Keep playing focused first so a stray Enter keeps playing', async ({
    page,
  }) => {
    await withOneCured(page);
    await page.locator('#menuButton').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Pair a phone' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menuitem', { name: 'Go to bed' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menuitem', { name: 'Start again' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(DIALOG)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep playing' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(DIALOG)).toBeHidden();
    expect(JSON.parse((await stored(page))!)).toMatchObject({ cured: 1, day: 1, drums: 0 });
  });

  test('the test API opens the dialog as the menu does, and keys over it do nothing in the game', async ({ page }) => {
    await start(page, { seed: 7, paused: true });
    await page.evaluate(() => window.game!.startAgain());
    await expect(page.locator(DIALOG)).toBeVisible();
    await page.keyboard.press('KeyC');
    expect(await page.evaluate(() => window.game!.mode())).toBe('look');
  });
});

/**
 * The day's end (`docs/day.md`): midnight, the yawn and the fade, waking in the cabin on the next day, and down to the
 * pond. Seeded and paused, stepped through the test API, so no wait is on a clock.
 */
test.describe('the day ends', () => {
  const api =
    <T>(f: () => T) =>
    (page: Page) =>
      page.evaluate(f);
  const place = api(() => window.game!.place());
  const day = api(() => window.game!.day());
  const state = api(() => window.game!.state());

  test('the day ends at midnight and the player wakes at the cabin, then goes down to the pond', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 5, paused: true });
    await play(page, 30, 'a half second of the day');
    expect(await day(page)).toBe(1);
    await expect(page.locator('#night')).toBeHidden();
    await expect(page.locator('#modeButton')).toBeVisible();

    // just short of midnight: a few frames carry the clock across it, and the yawn begins
    await page.evaluate(() => window.game!.clock(0.9995));
    await play(page, 30, 'midnight crossed');
    expect(await place(page)).toBe('yawning');
    expect(await page.evaluate(() => window.game!.events())).toContain('yawned');
    await expect(page.locator('#yawn')).toHaveText('Yawn… time for bed');
    await expect(page.locator('#night')).toBeVisible();
    // the Cast button and the rod's words are not there, and Go to bed is greyed
    await expect(page.locator('#modeButton')).toBeHidden();
    await expect(page.locator('#castLine')).toBeHidden();
    await page.locator('#menuButton').click();
    await expect(page.getByRole('menuitem', { name: 'Go to bed' })).toBeDisabled();
    await page.locator('#menuButton').click();

    // the fade rises with stepped time, and the page writes what the game says
    let last = await page.evaluate(() => window.game!.fade());
    const frozen = await state(page);
    for (let k = 0; k < 8; k++) {
      await page.evaluate(() => window.game!.step(10));
      const f = await page.evaluate(() => window.game!.fade());
      if (await place(page).then((p) => p !== 'yawning')) break;
      expect(f, 'the fade rises').toBeGreaterThan(last);
      const shown = Number(await page.locator('#night').evaluate((el) => (el as HTMLElement).style.opacity));
      expect(shown).toBeCloseTo(f, 2);
      last = f;
    }
    // the yawn holds time: the clock and the game's time do not move
    expect((await state(page)).t).toBe(frozen.t);

    await play(page, 90, 'the yawn over');
    expect(await place(page)).toBe('cabin');
    expect(await day(page)).toBe(2);
    expect(await page.evaluate(() => window.game!.events())).toContain('woke 2');
    expect(JSON.parse(await page.evaluate(() => window.game!.save()))).toEqual({
      cured: 0,
      day: 2,
      drums: 0,
      journal: {},
    });
    expect(await page.evaluate(() => window.game!.view())).toBe('cabin');
    expect(await page.evaluate(() => window.game!.time()), 'the page is lit as dawn').toBe('dawn');
    await expect(page.locator('#morning')).toHaveText('Day 2. Morning at the cabin.');
    await expect(page.locator('#downButton')).toBeVisible();
    await expect(page.locator('#yawn')).toBeHidden();
    await expect(page.locator('#welcome')).toBeHidden();

    // the fade lifts over a second of stepped time
    await play(page, 70, 'the fade lifted');
    await expect(page.locator('#night')).toBeHidden();
    expect(await page.evaluate(() => window.game!.fade())).toBe(0);

    // game time is stopped in the cabin: three hundred frames move nothing
    const woken = await state(page);
    const fish = await page.evaluate(() => window.game!.fish());
    await play(page, 300, 'five seconds in the cabin');
    const later = await state(page);
    expect(later.t, 'game time holds').toBe(woken.t);
    expect(later.timeOfDay, 'the clock holds at dawn').toBe(0.25);
    expect(await page.evaluate(() => window.game!.fish())).toEqual(fish);

    // the rod is not theirs here: C, space, a tap and a drag do nothing, and the camera is not turned
    const camera = await page.evaluate(() => window.game!.camera());
    await page.keyboard.press('KeyC');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    const box = (await page.locator('#view').boundingBox())!;
    const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.click(mid.x, mid.y);
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 160, mid.y + 60, { steps: 6 });
    await page.mouse.up();
    await play(page, 30, 'keys and a drag in the cabin');
    expect(await page.evaluate(() => window.game!.mode())).toBe('look');
    expect(await page.evaluate(() => window.game!.lure().phase)).toBe('ready');
    expect(await page.evaluate(() => window.game!.splashes()).then((s) => s.filter((x) => x.age < 5))).toEqual([]);
    expect(await place(page)).toBe('cabin');
    expect(await page.evaluate(() => window.game!.camera())).toEqual(camera);
    await expect(page.locator('#modeButton')).toBeHidden();

    // down to the pond: Enter, as the button does; the Shore view, dawn, look mode, and the clock runs
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.game!.step(1));
    expect(await place(page)).toBe('pond');
    expect(await page.evaluate(() => [window.game!.view(), window.game!.mode()])).toEqual(['shore', 'look']);
    await expect(page.locator('#morning')).toBeHidden();
    await expect(page.locator('#downButton')).toBeHidden();
    await expect(page.locator('#modeButton')).toBeVisible();
    await play(page, 120, 'two seconds at the pond');
    const out = await state(page);
    expect(out.t).toBeGreaterThan(woken.t + 1.9);
    expect(out.timeOfDay).toBeGreaterThan(0.25);
    expect(await page.evaluate(() => window.game!.time())).toBe('dawn');
    expect(problems).toEqual([]);
  });

  test('the Down to the pond button brings the player down to the pond', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 5, paused: true });
    await page.evaluate(() => window.game!.sleep());
    await play(page, 100, 'to the cabin');
    expect(await place(page)).toBe('cabin');
    await page.getByRole('button', { name: 'Down to the pond' }).click();
    await page.evaluate(() => window.game!.step(1));
    expect(await place(page)).toBe('pond');
    expect(await page.evaluate(() => window.game!.view())).toBe('shore');
    expect(problems).toEqual([]);
  });

  test('midnight with a fish on the line runs on until it is landed and put in the bucket, and then the yawn comes', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 7, paused: true, save: { cured: 3 } });
    expect(await page.evaluate(() => window.game!.fishTo('fight'))).toBe(true);
    // midnight is crossed with the fish hooked: the clock wraps, and the day does not end
    await page.evaluate(() => window.game!.clock(0.9999));
    await play(page, 20, 'midnight crossed mid-fight');
    expect((await state(page)).timeOfDay).toBeLessThan(0.1);
    expect(await place(page), 'the day waits for the fish').toBe('pond');
    expect(await page.evaluate(() => window.game!.fishing().phase)).toBe('hooked');
    // Go to bed is refused mid-fight, by the game and in the menu
    expect(await page.evaluate(() => window.game!.sleep())).toBe(false);
    await page.locator('#menuButton').click();
    await expect(page.getByRole('menuitem', { name: 'Go to bed' })).toBeDisabled();
    await page.locator('#menuButton').click();
    // the fight is played to its end
    await page.evaluate(() => {
      const g = window.game!;
      for (let f = 0; f < 7200 && g.fishing().phase === 'hooked'; f++) {
        const k = g.fishing();
        g.reel(k.fishAt > k.zone + k.width / 2);
        g.step(1);
      }
      g.reel(false);
    });
    expect(await page.evaluate(() => window.game!.fishing().phase)).toBe('landed');
    // landed and not yet in the bucket still holds the day open
    await play(page, 60, 'a landed fish by the rod');
    expect(await place(page)).toBe('pond');
    await page.locator('#catch').click();
    await play(page, 2, 'the fish stowed');
    expect(await place(page)).toBe('yawning');
    await play(page, 100, 'the night');
    expect(await place(page)).toBe('cabin');
    expect(JSON.parse(await page.evaluate(() => window.game!.save()))).toMatchObject({ cured: 4, day: 2, drums: 0 });
    expect(problems).toEqual([]);
  });

  test('Go to bed in the menu ends the day at once, from the pond and from the cabin, with no question', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 9, paused: true });
    // from cast mode, the page looks again once the night begins
    await page.evaluate(() => window.game!.mode('cast'));
    await page.locator('#menuButton').click();
    await page.getByRole('menuitem', { name: 'Go to bed' }).click();
    await expect(page.locator('#startAgain')).toBeHidden();
    await expect(page.locator('#menuList')).toBeHidden();
    expect(await place(page)).toBe('yawning');
    expect(await page.evaluate(() => window.game!.mode())).toBe('look');
    await play(page, 100, 'the first night');
    expect([await place(page), await day(page)]).toEqual(['cabin', 2]);

    // again from the cabin: the morning, then the next
    await page.locator('#menuButton').click();
    await page.getByRole('menuitem', { name: 'Go to bed' }).click();
    expect(await place(page)).toBe('yawning');
    await play(page, 100, 'the second night');
    expect([await place(page), await day(page)]).toEqual(['cabin', 3]);
    await expect(page.locator('#morning')).toHaveText('Day 3. Morning at the cabin.');
    expect(problems).toEqual([]);
  });

  test('a load on day 3 opens at the pond at dawn on that day, and the next morning is day 4, which a reload keeps', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 3, paused: true, save: { cured: 2, day: 3 } });
    expect(await day(page)).toBe(3);
    expect(await place(page)).toBe('pond');
    expect(await page.evaluate(() => window.game!.view())).toBe('shore');
    expect((await state(page)).timeOfDay).toBe(0.25);
    await page.evaluate(() => window.game!.sleep());
    await play(page, 100, 'a night');
    await expect(page.locator('#morning')).toHaveText('Day 4. Morning at the cabin.');
    // a reload from the cabin opens at the pond on the day saved
    await page.reload();
    await ready(page);
    expect(await day(page)).toBe(4);
    expect(await place(page)).toBe('pond');
    expect(await page.evaluate(() => window.game!.view())).toBe('shore');
    await expect(page.locator('#morning')).toBeHidden();
    expect(problems).toEqual([]);
  });
});

/**
 * The journal (`docs/journal.md`): each kind caught at its own depth and written in it, a drum hauled up, and the page
 * stopping the clock. Seeded and paused, stepped through the test API, so no wait is on a clock.
 */
test.describe('the journal and the drum', () => {
  test('each kind is caught at its depth and written in the journal', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watch(page);
    await start(page, { seed: 1, paused: true });
    const api = <T>(f: () => T) => page.evaluate(f);

    // a bream, then a pike: each fished for where its own kind lies, landed, and put in the bucket by its card
    const caught: { kind: string; depth: number }[] = [];
    for (const kind of ['bream', 'pike'] as const) {
      expect(await page.evaluate((k) => window.game!.fishTo('landed', k), kind), `${kind} landed`).toBe(true);
      const hooked = await api(() => {
        const g = window.game!;
        const f = g.fish()[g.fishing().fish];
        return { kind: f.kind, depth: f.depth, weight: g.fishing().weight };
      });
      expect(hooked.kind, 'the kind landed is the kind fished for').toBe(kind === 'bream' ? 0 : 2);
      caught.push({ kind, depth: hooked.depth });
      await page.locator('#catch').click();
      await play(page, 1, `a ${kind} in the bucket`);
    }
    expect(caught[0].depth, 'the bream was caught in shallower water than the pike').toBeLessThan(caught[1].depth);

    // the save keeps both, with today as the first day and a weight within each kind's range
    const journal = await api(() => window.game!.journal());
    expect(Object.keys(journal).sort()).toEqual(['bream', 'pike']);
    expect(journal.bream).toMatchObject({ caught: 1, first: 1 });
    expect(journal.pike).toMatchObject({ caught: 1, first: 1 });
    expect(journal.bream!.best).toBeGreaterThanOrEqual(0.2);
    expect(journal.bream!.best).toBeLessThanOrEqual(1);
    expect(journal.pike!.best).toBeGreaterThanOrEqual(1.5);
    expect(journal.pike!.best).toBeLessThanOrEqual(5);

    // and the page lists them, by name, with weight and day, the kind not caught saying so
    await api(() => window.game!.openJournal());
    await expect(page.locator('#journal')).toBeVisible();
    const items = page.locator('#journalKinds li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText(
      `sunny bream1 caught, best ${journal.bream!.best.toFixed(2)} kg, first on day 1`,
    );
    await expect(items.nth(1)).toHaveText('glowing perchnot yet caught');
    await expect(items.nth(2)).toHaveText(`pike1 caught, best ${journal.pike!.best.toFixed(2)} kg, first on day 1`);
    await expect(page.locator('#journalDrums')).toHaveText('drums of waste hauled: 0 of 2');
    expect(problems).toEqual([]);
  });

  test('a drum on the bed is hauled up and cleans the pond more', async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watch(page);
    // every fish cured, so nothing but the drum can take the bait
    await start(page, { seed: 1, paused: true, save: { cured: 12 } });
    const api = <T>(f: () => T) => page.evaluate(f);
    const meter = () => page.locator('#pondBar').getAttribute('aria-valuenow');
    expect(await meter()).toBe('25');

    // snagged and struck: a drum plays, and the reel let go leaves it waiting, the meter holding and the phase hooked
    expect(await api(() => window.game!.fishTo('fight', 'drum'))).toBe(true);
    expect(await api(() => window.game!.fishing().drum)).toBeGreaterThanOrEqual(0);
    await api(() => window.game!.reel(false));
    const held = await api(() => window.game!.fishing().meter);
    await play(page, 1800, 'half a minute of the reel let go');
    const waited = await api(() => window.game!.fishing());
    expect(waited.phase, 'a drum never slips').toBe('hooked');
    expect(waited.meter, 'and the meter does not drain').toBeGreaterThanOrEqual(held);

    // reeled in with the reel held, the card names it, and the tap hauls it: the gauge falls two sixteenths
    await api(() => window.game!.reel(true));
    for (let k = 0; k < 120 && (await api(() => window.game!.fishing().phase)) !== 'landed'; k++)
      await play(page, 30, 'the drum being reeled');
    expect(await api(() => window.game!.fishing().phase)).toBe('landed');
    await expect(page.locator('#catchName')).toHaveText('drum of waste');
    expect(await meter(), 'the gauge has not moved before the tap').toBe('25');
    await page.locator('#catch').click();
    await play(page, 1, 'the drum hauled');
    expect((await api(() => window.game!.state())).contamination).toBeCloseTo(2 / 16, 12);
    expect(await meter()).toBe('13');
    await expect(page.locator('#toast')).toHaveText('Hauled out! The pond clears a lot.');
    expect(await api(() => window.game!.drums().filter((d) => d.hauled).length)).toBe(1);
    expect(JSON.parse(await api(() => window.game!.save()))).toMatchObject({ cured: 12, drums: 1 });
    expect(problems).toEqual([]);
  });

  test('the journal stops the clock while open, and the game runs on when it is closed', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 1, paused: true });
    const api = <T>(f: () => T) => page.evaluate(f);
    const clock = () => api(() => ({ t: window.game!.state().t, at: window.game!.state().timeOfDay }));
    await play(page, 60, 'a second before the journal');
    const before = await clock();
    expect(before.t).toBeGreaterThan(0);

    // from the menu's item, the page opens with focus on its button
    await page.locator('#menuButton').click();
    await page.getByRole('menuitem', { name: 'Journal' }).click();
    await expect(page.locator('#journal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
    await play(page, 120, 'two seconds with the journal open');
    expect(await clock(), 'game time holds').toEqual(before);
    // keys do not reach the game
    await page.keyboard.press('KeyC');
    expect(await api(() => window.game!.mode())).toBe('look');

    // Escape closes it, and the clock runs again
    await page.keyboard.press('Escape');
    await expect(page.locator('#journal')).toBeHidden();
    await play(page, 60, 'a second after');
    const after = await clock();
    expect(after.t).toBeGreaterThan(before.t);
    expect(after.at).toBeGreaterThan(before.at);

    // the backdrop closes it too, and so does the button
    await api(() => window.game!.openJournal());
    await expect(page.locator('#journal')).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(page.locator('#journal')).toBeHidden();
    await api(() => window.game!.openJournal());
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#journal')).toBeHidden();
    await api(() => window.game!.openJournal(false));
    expect(problems).toEqual([]);
  });
});
