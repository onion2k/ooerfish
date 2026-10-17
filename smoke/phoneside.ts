/**
 * The phone's side of a smoke test: the real phone page (`phone.html`) opened as a second page of one browser, its
 * sensors and vibrator stubbed, its pad put under a thumb. They are here, and not in either spec, so that the phone's
 * end-to-end test and the pictures of its page play it the same way: a spec may not import another spec.
 */
import type { BrowserContext, Page } from '@playwright/test';

declare global {
  interface Window {
    /** What the phone page was asked to vibrate, in the page's stub of `navigator.vibrate`. */
    buzzes?: unknown[];
  }
}

/** The room and key in the address the overlay is showing, which is the one in its QR code. */
export async function pairingFromOverlay(page: Page) {
  const url = await page.locator('#pairing').getAttribute('data-url');
  const hash = new URL(url!).hash;
  const params = new URLSearchParams(hash.slice(1));
  return { url: url!, room: params.get('room')!, key: params.get('key')!, link: params.get('link') };
}

/** What the phone's sensors are, for the page that opens: none at all, or the iOS kind that asks and is granted. */
export type Sensors = 'none' | 'granted' | 'denied';

/** The real phone page at an address, at a phone's size, with its sensors and its vibrator stubbed, not yet connected. */
export async function openPhone(context: BrowserContext, url: string, sensors: Sensors = 'none'): Promise<Page> {
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.addInitScript((kind) => {
    window.buzzes = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: unknown) => {
        window.buzzes!.push(pattern);
        return true;
      },
    });
    const w = window as unknown as Record<string, unknown>;
    if (kind === 'none') delete w.DeviceMotionEvent;
    else {
      // Safari's: the page has to ask from inside a tap, and the answer is the person's
      Object.assign(w.DeviceMotionEvent as object, { requestPermission: () => Promise.resolve(kind) });
    }
  }, sensors);
  await phone.goto(url);
  return phone;
}

/** Connect, tapped as a user does. */
export async function connect(phone: Page) {
  await phone.getByRole('button', { name: 'Connect', exact: true }).click();
}

/** The pad's box, for a thumb to be put on. */
export async function padBox(phone: Page) {
  return (await phone.locator('#pad').boundingBox())!;
}

/** A thumb put down on the pad at a share of it, and moved to others, by the mouse (pointer events as a finger makes). */
export async function thumbDown(phone: Page, at: { x: number; y: number }) {
  const box = await padBox(phone);
  await phone.mouse.move(box.x + box.width * at.x, box.y + box.height * at.y);
  await phone.mouse.down();
}
export async function thumbTo(phone: Page, at: { x: number; y: number }) {
  const box = await padBox(phone);
  await phone.mouse.move(box.x + box.width * at.x, box.y + box.height * at.y, { steps: 4 });
}
export const thumbUp = (phone: Page) => phone.mouse.up();
