/**
 * Pairing, as a user does it and as a phone would: the game on the local link (`?phonelink=local`, which needs no
 * relay and no network) and the phone as a second page of the same browser, running the phone's side of the link
 * itself. The real relays are `npm run pair`'s, not this test's.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ready, watch } from './game';

/** What the phone page keeps: its link, and what the screen has said to it. */
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

/** A page of the dev server with nothing on it but the phone's side of the link, joined to a room. */
async function phoneJoins(context: BrowserContext, room: string): Promise<Page> {
  await context.route('**/phone-blank', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>a phone</title>' }),
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

/** The room and key in the address the overlay is showing, which is the one in its QR code. */
async function pairingFromOverlay(page: Page) {
  const url = await page.locator('#pairing').getAttribute('data-url');
  const hash = new URL(url!).hash;
  const params = new URLSearchParams(hash.slice(1));
  return { url: url!, room: params.get('room')!, key: params.get('key')!, link: params.get('link') };
}

test('a phone pairs through the QR code: the code loads on demand, closes when the phone joins, and its pad casts', async ({
  page,
  context,
}) => {
  const problems = watch(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/?phonelink=local&seed=3&paused=1&rung=full');
  await ready(page);

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
  await page.getByRole('button', { name: 'Pair a phone', exact: true }).click();
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

  // the phone joins, says hello (no motion) and drags back on its pad and lets go
  const phone = await phoneJoins(context, room);
  await expect.poll(() => page.evaluate(() => window.game!.phone().paired)).toBe(true);
  await expect(page.locator('#pairing')).toBeHidden();
  await expect(page.locator('#phoneStatus')).toHaveText('Phone connected');
  await send(phone, { kind: 'hello', v: 1, motion: false });
  await send(phone, { kind: 'down' });
  await send(phone, { kind: 'move', x: 0.5, y: 0.4, aspect: 0.5 });
  await send(phone, { kind: 'move', x: 0.5, y: 0.7, aspect: 0.5 });
  await expect.poll(() => page.evaluate(() => window.game!.preview() !== null)).toBe(true);
  expect(await page.evaluate(() => window.game!.lure().phase)).toBe('ready');
  await send(phone, { kind: 'up' });
  await expect.poll(() => page.evaluate(() => window.game!.lure().phase)).not.toBe('ready');
  expect(await page.evaluate(() => window.game!.phone())).toMatchObject({
    paired: true,
    motion: false,
    lastKind: 'up',
    refused: 0,
  });
  // the first gesture from the phone put the page in cast mode
  expect(await page.evaluate(() => window.game!.mode())).toBe('cast');

  // a message that is not known is refused by name, and counted, and the last good kind stands
  await send(phone, { kind: 'strike' });
  await expect.poll(() => page.evaluate(() => window.game!.phone().refused)).toBe(1);
  const after = await page.evaluate(() => window.game!.phone());
  expect(after.lastRefusal).toContain('"strike"');
  expect(after.lastKind).toBe('up');
  await send(phone, { kind: 'hello', v: 7, motion: true });
  await expect.poll(() => page.evaluate(() => window.game!.phone().refused)).toBe(2);
  expect(await page.evaluate(() => window.game!.phone().motion)).toBe(false);

  // a second phone is told the screen has one, and is ignored
  const second = await phoneJoins(context, room);
  await expect.poll(() => second.evaluate(() => window.phoneSide!.heard)).toContainEqual({ kind: 'busy' });
  const before = await page.evaluate(() => window.game!.phone());
  await send(second, { kind: 'hello', v: 1, motion: true });
  await send(second, { kind: 'down' });
  await send(second, { kind: 'strike' });
  // the first phone's next message is heard after the second's, so by then the second's would have been
  await send(phone, { kind: 'tilt', g: 4 });
  await expect.poll(() => page.evaluate(() => window.game!.phone().lastKind)).toBe('tilt');
  const now = await page.evaluate(() => window.game!.phone());
  expect(now).toMatchObject({ paired: true, motion: before.motion, refused: before.refused });
  // the first phone never heard it was busy
  expect(await phone.evaluate(() => window.phoneSide!.heard)).not.toContainEqual({ kind: 'busy' });

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
});

test('the overlay closes by its button and by Escape, and Pair a phone shows it again with the same code', async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto('/?phonelink=local&seed=3&paused=1&rung=full');
  await ready(page);
  const pair = page.getByRole('button', { name: 'Pair a phone', exact: true });
  await pair.click();
  await expect(page.locator('#pairing')).toBeVisible();
  const first = await pairingFromOverlay(page);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#pairing')).toBeHidden();
  await pair.click();
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
