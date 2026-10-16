/**
 * A phone paired with the game over the real thing, headless: the public Nostr relays and WebRTC.
 *
 *   npm run pair [-- --port <n>]
 *
 * The game opens its pairing overlay in one browser; a phone's side of the link, the very code the phone page runs,
 * joins the room from a page of a second, fresh browser context, through the real `trysteroLink`, and sends a hello
 * and a drag. The time from the screen opening the room to the screen knowing the phone is printed, and whether the
 * screen saw what the phone sent. It needs the network and a relay that answers, so it is a tool and not part of
 * `check`: a relay that is down says nothing about the code. Exits non-zero if the two do not pair in 45 seconds. Its
 * own dev server is on `--port` or `PAIR_PORT` (5212), clear of the main checkout's 5204, the smoke's 5205 and the
 * film's 5211.
 */
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { ready, watch } from '../smoke/game';

/** How long the phone has to be heard of, in milliseconds. */
const PAIR_WITHIN_MS = 45_000;

function portAsked(): number {
  const at = process.argv.indexOf('--port');
  return Number(at >= 0 ? process.argv[at + 1] : (process.env.PAIR_PORT ?? 5212));
}

/** The dev server, on its own port, once it answers. */
async function serve(port: number) {
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let said = '';
  server.stderr.on('data', (d: Buffer) => (said += d.toString()));
  for (let tries = 0; tries < 600; tries++) {
    if (server.exitCode !== null) throw new Error(`the dev server on ${port} stopped: ${said}`);
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return server;
    } catch {
      // not answering yet
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  server.kill();
  throw new Error(`the dev server on ${port} did not answer in a minute`);
}

async function main(): Promise<boolean> {
  const port = portAsked();
  const base = `http://localhost:${port}`;
  const server = await serve(port);
  const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-webgpu'] });
  try {
    // the screen
    const screen = await (
      await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 800 } })
    ).newPage();
    const problems = watch(screen);
    await screen.goto('/?paused=1&seed=1&rung=full');
    await ready(screen);
    const opened = Date.now();
    await screen.evaluate(() => window.game!.pair());
    const url = (await screen.locator('#pairing').getAttribute('data-url'))!;
    const params = new URLSearchParams(new URL(url).hash.slice(1));
    console.log(`pair: the room is open; the overlay is up after ${Date.now() - opened} ms`);

    // the phone, in a context of its own, as a second device would be
    const phoneContext = await browser.newContext({ baseURL: base });
    await phoneContext.route('**/phone-blank', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>a phone</title>' }),
    );
    const phone = await phoneContext.newPage();
    await phone.goto('/phone-blank');
    // the join runs in the page, with the code the phone page will run; it is waited for there and not here
    const joining = phone.evaluate(
      async ([room, key, within]) => {
        const path = '/src/phone/link.ts';
        const { trysteroLink } = (await import(/* @vite-ignore */ path)) as typeof import('../src/phone/link');
        const link = await trysteroLink(room, key);
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('the screen was not found')), within);
          link.onJoin(() => {
            clearTimeout(timer);
            link.send({ kind: 'hello', v: 1, motion: false });
            link.send({ kind: 'down' });
            for (let i = 0; i <= 5; i++) link.send({ kind: 'move', x: 0.5, y: 0.4 + i * 0.06, aspect: 0.5 });
            link.send({ kind: 'up' });
            resolve('sent');
          });
        });
      },
      [params.get('room')!, params.get('key')!, PAIR_WITHIN_MS] as const,
    );
    joining.catch(() => {});

    const paired = await waitFor(() => screen.evaluate(() => window.game!.phone().paired), PAIR_WITHIN_MS);
    if (!paired) {
      console.error(`pair: no phone joined within ${PAIR_WITHIN_MS / 1000} s (are the Nostr relays reachable?)`);
      return false;
    }
    const pairMs = Date.now() - opened;
    await joining;
    // the up is the last thing sent, over an ordered channel, so by the time it is heard the rest has been
    const heard = await waitFor(
      () => screen.evaluate(() => window.game!.phone().lastKind === 'up' && window.game!.lure().phase !== 'ready'),
      10_000,
    );
    const reading = await screen.evaluate(() => window.game!.phone());
    console.log(`pair: paired in ${(pairMs / 1000).toFixed(2)} s from the room opening`);
    console.log(`pair: the screen saw ${JSON.stringify(reading)}; the drag cast: ${String(heard)}`);
    if (problems.length) console.error(`pair: the screen's page went wrong:\n  ${problems.join('\n  ')}`);
    return heard && problems.length === 0;
  } finally {
    await browser.close();
    server.kill();
  }
}

/** Polls `check` until it is true or `ms` has passed. A real network is not stepped, so this is its one wait. */
async function waitFor(check: () => Promise<boolean>, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return true;
    await new Promise((done) => setTimeout(done, 100));
  }
  return false;
}

process.exit((await main()) ? 0 : 1);
