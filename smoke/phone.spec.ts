/**
 * The phone, as a user holds it and as the screen hears it: the game on the local link (`?phonelink=local`, which needs
 * no relay and no network) and the real phone page, `phone.html`, as a second page of the same browser, its pad
 * clicked and dragged as a thumb does and its sensors fed by the browser's own device events. A stand-in that is only
 * the phone's side of the link plays the strangers: the peer that says what is not known, and the second phone. The
 * real relays are `npm run pair`'s, not this test's.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ANGLER } from '../src/lake';
import { ready, start, watch } from './game';
import { connect, openPhone, padBox, pairingFromOverlay, thumbDown, thumbTo, thumbUp } from './phoneside';

/** What the stand-in keeps: its link, and what the screen has said to it. */
interface PhoneSide {
  link: {
    send(message: unknown, to?: string): void;
    leave(): void;
  };
  heard: unknown[];
}
declare global {
  interface Window {
    phoneSide?: PhoneSide;
  }
}

/** A page of the dev server with nothing on it but the phone's side of the link, joined to a room: a stranger. */
async function strangerJoins(context: BrowserContext, room: string): Promise<Page> {
  await context.route('**/phone-blank', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>a stranger</title>' }),
  );
  const page = await context.newPage();
  await page.goto('/phone-blank');
  await page.evaluate(async (r) => {
    // a variable, so that neither the compiler nor Vite goes looking for it: the dev server serves it as it is asked
    const path = '/src/phone/link.ts';
    const { localLink } = (await import(/* @vite-ignore */ path)) as typeof import('../src/phone/link');
    const heard: unknown[] = [];
    const link = localLink(r);
    link.onMessage((raw) => heard.push(raw));
    window.phoneSide = { link, heard };
  }, room);
  return page;
}

const send = (page: Page, message: unknown) => page.evaluate((m) => window.phoneSide!.link.send(m), message);

/** A tilt of the phone, as the browser reports one. */
const tilt = (phone: Page, gamma: number) =>
  phone.evaluate((g) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: g })), gamma);

/** One sample of the phone's pull without gravity, as the browser reports one. */
const pull = (phone: Page, x: number, y: number, z: number) =>
  phone.evaluate(
    ([a, b, c]) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: a, y: b, z: c } })),
    [x, y, z] as const,
  );

/** A flick: a jolt of that peak and then the phone at rest. */
async function flick(phone: Page, peak: number) {
  await pull(phone, peak, 0, 0);
  await pull(phone, 0, 0, 0);
}

/** A share as the bar writes it: a per cent to a tenth. */
const per = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** What the phone's bar shows, read from its page. */
const barOf = (phone: Page) =>
  phone.evaluate(() => ({
    shown: !document.getElementById('gauge')!.hidden,
    zone: document.getElementById('gaugeZone')!.style.bottom,
    fish: (document.getElementById('gaugeFish') as unknown as SVGElement).style.bottom,
    meter: document.getElementById('gaugeMeterFill')!.style.height,
    words: document.getElementById('gaugeWords')!.textContent,
  }));

/** The same, as the game's `fishing()` would have the bar written. */
const barFrom = (f: { zone: number; fishAt: number; meter: number }, words: string) => ({
  shown: true,
  zone: per(f.zone),
  fish: per(f.fishAt),
  meter: per(f.meter),
  words,
});

test('a phone pairs through the QR code and its pad casts; a second phone is told the screen is taken', async ({
  page,
  context,
}) => {
  const problems = watch(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });

  // nothing of pairing is fetched to boot the game, and nothing reads before it is opened
  const pairingCode = /trystero|qrcode|phone\/(pairing|session|link)\.ts/i;
  expect(requested.filter((u) => pairingCode.test(u))).toEqual([]);
  expect(await page.evaluate(() => window.game!.phone())).toEqual({
    paired: false,
    motion: false,
    lastKind: null,
    refused: 0,
    lastRefusal: null,
  });

  // the button, pressed as a user does: the code is fetched then, and a QR code is drawn
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Pair a phone', exact: true }).click();
  await expect(page.locator('#pairing')).toBeVisible();
  await expect.poll(() => requested.filter((u) => pairingCode.test(u)).length).toBeGreaterThan(0);
  const drawn = () =>
    page.evaluate(() => {
      const canvas = document.getElementById('pairingQr') as HTMLCanvasElement;
      const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 100) dark++;
      return { width: canvas.width, dark: dark / (px.length / 4) };
    });
  await expect.poll(async () => (await drawn()).dark).toBeGreaterThan(0.2);
  const { url, room, key, link } = await pairingFromOverlay(page);
  expect(url).toMatch(/\/phone\.html#room=/);
  expect(room).toMatch(/^[0-9a-z]{12}$/);
  expect(key).toMatch(/^[0-9a-z]{24}$/);
  expect(link).toBe('local');
  // the overlay fits a phone's width: narrowed to one, the card and its code are inside the screen
  await page.setViewportSize({ width: 375, height: 700 });
  const card = (await page.locator('#pairing .card').boundingBox())!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 800 });

  // the real phone page opens that address, with no motion sensors, and Connect is tapped
  const phone = await openPhone(context, url, 'none');
  const phoneProblems = watch(phone);
  await expect(phone.locator('#status')).toContainText('Connect');
  await connect(phone);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  await expect(page.locator('#pairing')).toBeHidden();
  await expect(page.locator('#phoneStatus')).toHaveText('Phone connected');
  await expect(phone.locator('#status')).toContainText('Connected');
  // with no sensors the pad is a drag, and says so
  await expect(phone.locator('#padHelp')).toContainText('Drag back and let go to cast');
  await expect.poll(() => page.evaluate(() => window.game!.phone().lastKind)).toBe('hello');
  expect(await page.evaluate(() => window.game!.phone().motion)).toBe(false);

  // a thumb drags back on the pad: the preview is drawn on the big screen, and letting go casts
  await thumbDown(phone, { x: 0.5, y: 0.4 });
  await thumbTo(phone, { x: 0.5, y: 0.7 });
  await expect.poll(() => page.evaluate(() => window.game!.preview() !== null)).toBe(true);
  expect(await page.evaluate(() => window.game!.lure().phase)).toBe('ready');
  await thumbUp(phone);
  await expect.poll(() => page.evaluate(() => window.game!.lure().phase)).not.toBe('ready');
  expect(await page.evaluate(() => window.game!.preview())).toBeNull();
  // the first gesture from the phone put the page in cast mode
  expect(await page.evaluate(() => window.game!.mode())).toBe('cast');
  // the lure is cast, so the phone's word is nothing while it sinks and waits
  await page.evaluate(() => window.game!.step(120));
  await expect(phone.locator('#word')).toHaveText('');

  // a second phone on the same address is told the screen already has one, and is ignored
  const second = await openPhone(context, url, 'granted');
  await connect(second);
  await expect(second.locator('#status')).toContainText('already has a phone');
  const before = await page.evaluate(() => window.game!.phone());
  await thumbDown(second, { x: 0.5, y: 0.5 });
  await thumbUp(second);
  await page.evaluate(() => window.game!.step(1));
  expect(await page.evaluate(() => window.game!.phone())).toEqual(before);
  // the first phone never heard it was busy
  await expect(phone.locator('#status')).not.toContainText('already has a phone');
  // the second phone leaving is not the phone leaving
  await second.close();
  await page.evaluate(() => window.game!.step(1));
  expect(await page.evaluate(() => window.game!.phone().paired)).toBe(true);

  // the phone's page closing is the phone leaving, which the screen says
  await phone.close();
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(false);
  await expect(page.locator('#phoneStatus')).toHaveText('The phone left');
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
  expect(phoneProblems).toEqual([]);
});

test('a peer that says what is not known is refused by name and changes nothing', async ({ page, context }) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  await page.evaluate(() => window.game!.pair());
  const { room } = await pairingFromOverlay(page);
  const stranger = await strangerJoins(context, room);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  await send(stranger, { kind: 'hello', v: 1, motion: false });
  await send(stranger, { kind: 'up' });
  await expect.poll(() => page.evaluate(() => window.game!.phone().lastKind)).toBe('up');

  // a kind that is not known, and a version that is not
  await send(stranger, { kind: 'strike' });
  await expect.poll(() => page.evaluate(() => window.game!.phone().refused)).toBe(1);
  const after = await page.evaluate(() => window.game!.phone());
  expect(after.lastRefusal).toContain('"strike"');
  expect(after.lastKind).toBe('up');
  await send(stranger, { kind: 'hello', v: 7, motion: true });
  await expect.poll(() => page.evaluate(() => window.game!.phone().refused)).toBe(2);
  expect(await page.evaluate(() => window.game!.phone().motion)).toBe(false);
  expect(await page.evaluate(() => window.game!.lure().phase)).toBe('ready');
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('the phone page refuses an address with no pairing in it, and fits a phone either way up', async ({
  page,
  context,
}) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  for (const hash of ['', '#room=only', '#key=only', '#room=bad%20room!&key=k']) {
    const bad = await openPhone(context, `/phone.html${hash}`, 'none');
    await expect(bad.locator('#status')).toContainText('scan');
    await expect(bad.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled();
    await bad.close();
  }

  await page.evaluate(() => window.game!.pair());
  const { url } = await pairingFromOverlay(page);
  const phone = await openPhone(context, url, 'granted');
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [320, 568],
  ]) {
    await phone.setViewportSize({ width, height });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await phone.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
    const pad = await padBox(phone);
    expect(pad.width).toBeGreaterThan(100);
    expect(pad.x).toBeGreaterThanOrEqual(0);
    expect(pad.x + pad.width).toBeLessThanOrEqual(width);
    expect(pad.y + pad.height).toBeLessThanOrEqual(height);
  }
  expect(problems).toEqual([]);
});

test('a phone with motion tilts to aim and flicks to cast, is told to strike, hooks, reels and lets go', async ({
  page,
  context,
}) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  await page.evaluate(() => window.game!.pair());
  const { url } = await pairingFromOverlay(page);
  const phone = await openPhone(context, url, 'granted');
  const phoneProblems = watch(phone);
  await connect(phone);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  // the permission was given inside the tap, so the phone says it has motion, and the pad says to flick
  await expect(phone.locator('#padHelp')).toContainText('flick to cast');
  await expect.poll(() => page.evaluate(() => window.game!.phone().motion)).toBe(true);
  const game = <T>(f: () => T) => page.evaluate(f);

  // a flick with no thumb down casts nothing
  await flick(phone, 40);
  await thumbDown(phone, { x: 0.5, y: 0.5 });
  await expect.poll(() => game(() => window.game!.phone().lastKind)).toBe('move');
  expect(await game(() => window.game!.lure().phase)).toBe('ready');

  // with the thumb down, tilting swings the preview: right and left land on either side of the middle
  await tilt(phone, 0);
  await tilt(phone, 30);
  await expect.poll(() => game(() => window.game!.preview() !== null)).toBe(true);
  await expect.poll(async () => (await game(() => window.game!.preview()))!.x).toBeGreaterThan(0.5);
  const right = (await game(() => window.game!.preview()))!;
  await tilt(phone, -30);
  await expect.poll(async () => (await game(() => window.game!.preview()))!.x).toBeLessThan(-0.5);
  const left = (await game(() => window.game!.preview()))!;
  expect(right.x).toBeGreaterThan(left.x);

  // a weak flick (the phone's rest swallows a second flick sent too soon, so it is sent again until the cast is out)
  await tilt(phone, 30);
  await expect.poll(async () => (await game(() => window.game!.preview()))!.x).toBeGreaterThan(0.5);
  await expect
    .poll(async () => {
      await flick(phone, 20);
      return game(() => window.game!.lure().phase);
    })
    .not.toBe('ready');
  await game(() => window.game!.step(120));
  const weak = await game(() => window.game!.lure());
  expect(weak.x).toBeGreaterThan(0.5);
  // letting go after a flick casts nothing more
  await thumbUp(phone);
  await expect.poll(() => game(() => window.game!.phone().lastKind)).toBe('up');
  expect(await game(() => window.game!.lure().x)).toBe(weak.x);

  // reeled in and cast again, the same tilt and a hard flick goes further: power rises with the flick's strength
  await game(() => {
    window.game!.reelIn();
    window.game!.step(120);
  });
  expect(await game(() => window.game!.lure().phase)).toBe('ready');
  await thumbDown(phone, { x: 0.5, y: 0.5 });
  await tilt(phone, 0);
  await tilt(phone, 30);
  await expect
    .poll(async () => {
      await flick(phone, 40);
      return game(() => window.game!.lure().phase);
    })
    .not.toBe('ready');
  await game(() => window.game!.step(120));
  const hard = await game(() => window.game!.lure());
  const reach = (l: { x: number; y: number }) => Math.hypot(l.x - ANGLER.x, l.y - ANGLER.y);
  expect(reach(hard)).toBeGreaterThan(reach(weak) + 5);
  // and the phone says the last flick's strength, to tune by
  await expect(phone.locator('#flick')).toContainText('40');
  await thumbUp(phone);

  // reeled in, a fish bites: the phone's word is Strike! and it is asked to vibrate, once
  await game(() => {
    window.game!.reelIn();
    window.game!.step(120);
  });
  await expect(phone.locator('#word')).toHaveText('Cast');
  expect(await game(() => window.game!.fishTo('bite'))).toBe(true);
  await expect(phone.locator('#word')).toHaveText('Strike!');
  await expect.poll(() => phone.evaluate(() => window.buzzes!.length)).toBe(1);

  // a tap on the pad strikes, as a tap on the screen does
  await thumbDown(phone, { x: 0.5, y: 0.5 });
  await thumbUp(phone);
  await expect.poll(() => game(() => window.game!.fishing().phase)).toBe('hooked');
  await game(() => window.game!.step(1));
  await expect(phone.locator('#word')).toHaveText('Reel');

  // a hold with the fish on reels until let go; stepped, the zone rises, and the phone's bar says what the game's does
  await thumbDown(phone, { x: 0.5, y: 0.5 });
  await expect.poll(() => game(() => window.game!.fishing().reeling)).toBe(true);
  await game(() => window.game!.step(90));
  const fight = await game(() => window.game!.fishing());
  expect(fight.phase).toBe('hooked');
  expect(fight.zone).toBeGreaterThan(0);
  const words = await game(() => (window.game!.invariants().length === 0 ? 'ok' : 'broken'));
  expect(words).toBe('ok');
  await expect
    .poll(async () => {
      const bar = await barOf(phone);
      return { ...bar, words: bar.words === 'in the zone' || bar.words === 'out of the zone' ? 'words' : bar.words };
    })
    .toEqual(barFrom(fight, 'words'));
  // the words say what the game says of the fish
  const inZone = await game(() => {
    const f = window.game!.fishing();
    return f.fishAt >= f.zone && f.fishAt <= f.zone + f.width;
  });
  expect((await barOf(phone)).words).toBe(inZone ? 'in the zone' : 'out of the zone');
  // stepped on, the bar follows
  await game(() => window.game!.step(30));
  const later = await game(() => window.game!.fishing());
  expect(later.phase).toBe('hooked');
  await expect.poll(async () => (await barOf(phone)).meter).toBe(per(later.meter));
  await expect.poll(async () => (await barOf(phone)).zone).toBe(per(later.zone));
  await expect.poll(async () => (await barOf(phone)).fish).toBe(per(later.fishAt));

  // letting go gives line
  await thumbUp(phone);
  await expect.poll(() => game(() => window.game!.fishing().reeling)).toBe(false);

  // held again, and the phone closes: the reel is let go, and the screen says the phone left
  await thumbDown(phone, { x: 0.5, y: 0.5 });
  await expect.poll(() => game(() => window.game!.fishing().reeling)).toBe(true);
  await phone.close();
  await expect.poll(() => game(() => window.game!.fishing().reeling)).toBe(false);
  await expect(page.locator('#phoneStatus')).toHaveText('The phone left');
  expect(await game(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
  expect(phoneProblems).toEqual([]);
});

test('a phone that denies the motion sensors still works as a pad, and says so', async ({ page, context }) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  await page.evaluate(() => window.game!.pair());
  const { url } = await pairingFromOverlay(page);
  const phone = await openPhone(context, url, 'denied');
  await connect(phone);
  await expect.poll(() => page.evaluate(() => window.game!.phone().lastKind)).toBe('hello');
  expect(await page.evaluate(() => window.game!.phone().motion)).toBe(false);
  await expect(phone.locator('#sensors')).toContainText('refused');
  expect(problems).toEqual([]);
});

test('a phone that reloads comes back to the same room and is the phone again', async ({ page, context }) => {
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  await page.evaluate(() => window.game!.pair());
  const { url } = await pairingFromOverlay(page);
  const phone = await openPhone(context, url, 'granted');
  await connect(phone);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  await phone.reload();
  // the page's leaving told the screen, so the rejoin is not told it is busy
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(false);
  await connect(phone);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  await expect(phone.locator('#status')).not.toContainText('already has a phone');
});

test('the overlay closes by its button and by Escape, and Pair a phone shows it again with the same code', async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto('/?phonelink=local&seed=3&paused=1&rung=full');
  await ready(page);
  // Pair a phone is behind the corner's More button: shut at the start, opened by it, and shut again by Escape and by
  // a click anywhere else, without pairing
  const more = page.getByRole('button', { name: 'More', exact: true });
  const item = page.getByRole('menuitem', { name: 'Pair a phone', exact: true });
  await expect(item).toBeHidden();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(item).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(item).toBeHidden();
  await more.click();
  await page.mouse.click(640, 400);
  await expect(item).toBeHidden();
  await expect(page.locator('#pairing')).toBeHidden();
  const pair = async () => {
    await more.click();
    await item.click();
    await expect(item).toBeHidden();
  };
  await pair();
  await expect(page.locator('#pairing')).toBeVisible();
  const first = await pairingFromOverlay(page);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#pairing')).toBeHidden();
  await pair();
  await expect(page.locator('#pairing')).toBeVisible();
  expect((await pairingFromOverlay(page)).room).toBe(first.room);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pairing')).toBeHidden();
  // closed unpaired, nothing has joined, and the pairing is still the page's to use
  expect((await page.evaluate(() => window.game!.phone())).paired).toBe(false);
  expect(problems).toEqual([]);
});

test('the test API opens the overlay on a fixed pairing and resolves once the code is drawn', async ({ page }) => {
  await page.goto('/?phonelink=local&paused=1&rung=full');
  await ready(page);
  await page.evaluate(() => window.game!.pair({ room: 'fixedroom00', key: 'fixedkey' }));
  const p = await pairingFromOverlay(page);
  expect(p).toMatchObject({ room: 'fixedroom00', key: 'fixedkey' });
  const dark = await page.evaluate(() => {
    const canvas = document.getElementById('pairingQr') as HTMLCanvasElement;
    const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return px.some((v, i) => i % 4 === 0 && v < 100);
  });
  expect(dark).toBe(true);
});

test('an address with a link not known is refused by name and the game still boots', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto('/?phonelink=nonsense&paused=1&rung=full');
  await ready(page);
  expect(warnings.some((w) => w.includes('phonelink') && w.includes('"nonsense"'))).toBe(true);
  // and the address is left as it was written: the link is not a lab setting
  await page.evaluate(() => window.game!.dirt(0.3));
  expect(page.url()).toContain('phonelink=nonsense');
});

test('the phone’s status line does not sit over the bucket, at a desk’s width or a phone’s', async ({ page }) => {
  const problems = watch(page);
  await start(page, { seed: 3, paused: true, query: { phonelink: 'local' } });
  await page.evaluate(() => {
    // a fish in the bucket, so that its count is on the screen, and a line from the phone beside it
    window.game!.fishTo('landed');
    window.game!.stow();
    window.game!.step(5);
    const status = document.getElementById('phoneStatus')!;
    status.textContent = 'The phone left';
    status.hidden = false;
  });
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    const bucket = (await page.locator('#bucket').boundingBox())!;
    const line = (await page.locator('#phoneStatus').boundingBox())!;
    const apart = line.y >= bucket.y + bucket.height || line.x + line.width <= bucket.x;
    expect(
      apart,
      `at ${width} wide the status (${JSON.stringify(line)}) is over the bucket (${JSON.stringify(bucket)})`,
    ).toBe(true);
  }
  expect(problems).toEqual([]);
});
