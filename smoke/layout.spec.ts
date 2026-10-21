/**
 * Whether the page's overlays get in each other's way, or in the way of the fishing, on every screen the game is
 * played on. The fight is the case that matters: the bar, its words and the Reel button have to stand clear of the
 * bobber, the line's end and the hooked fish, or the player cannot see what they are playing. Without this, a
 * layout that looks right on a desk quietly covers the pond on a phone.
 *
 * Each breakpoint is held at each moment of play, seeded and paused, stepped through the test API. Every visible
 * overlay's box is read from the page, and a failure names the breakpoint, the moment and the two boxes, so the
 * report reads as a list of what overlaps what.
 */
import { expect, test, type Page } from '@playwright/test';
import { layoutFor } from '../src/layout';
import { start, watch } from './game';

/** A phone, a tablet or a desk: its size, and whether it is a touch screen. */
const BREAKPOINTS = [
  { name: 'desk 1280x800', width: 1280, height: 800, touch: false },
  { name: 'Pixel 7a 412x915', width: 412, height: 915, touch: true },
  { name: 'small phone 360x800', width: 360, height: 800, touch: true },
  { name: 'phone sideways 915x412', width: 915, height: 412, touch: true },
  { name: 'tablet 820x1180', width: 820, height: 1180, touch: true },
  { name: 'tablet sideways 1180x820', width: 1180, height: 820, touch: true },
  // a desk's window narrowed or flattened: the phone's layouts with a mouse, so the keyboard hint shows in them
  { name: 'narrow desk window 412x915', width: 412, height: 915, touch: false },
  { name: 'short desk window 915x412', width: 915, height: 412, touch: false },
] as const;

/**
 * The overlays: every top-level, fixed-position thing the page lays over the canvas, by id. A box inside one of
 * these is part of it, so it is not listed on its own.
 *   pond        the lake's gauge, top left.
 *   hud         the Cast button and the hint, one box: its children are laid out inside it by the page.
 *   menu        the corner button and its list, one box.
 *   bucket      the count of fish kept.
 *   phoneStatus the paired phone's word.
 *   welcome     the first words.
 *   toast       a gift or a note.
 *   castLine    what the lure is doing, in words.
 *   gauge       the fight's bar and its words.
 *   reelButton  Strike, then Reel.
 *   catch       the landed fish's card.
 *   biteMark    the "!" over the bobber while the strike's window is open: it is meant to stand there, so it alone
 *               may contain the bobber's point.
 *   yawn        the words while the screen fades to the night.
 *   morning     the line on waking in the cabin.
 *   downButton  Out to the lake, beside the morning line.
 *   elsewhereButton  Somewhere else…, above it: the way to the lakes page.
 *   startAgainCard the question before Start again, a modal: held inside the screen, and left out of the overlap rule.
 *   journalCard the journal's page, a modal of the same kind: held inside the screen and left out of the overlap rule, and
 *               its words must fit it without scrolling.
 *   lakesCard   the lakes page, a modal of the same kind, its two rows and their buttons fitting it without scrolling.
 *   sleepCard   the sleep page, a modal of the same kind, its two choices fitting it without scrolling.
 * Left out: `pairing` (a full-screen modal, closed in every moment here, and it would cover everything by design),
 * `boot` (the cover, gone by then) and `stage` (the canvas the overlays are over).
 */
const OVERLAYS = [
  'pond',
  'hud',
  'menu',
  'bucket',
  'phoneStatus',
  'welcome',
  'toast',
  'castLine',
  'gauge',
  'reelButton',
  'catch',
  'biteMark',
  'yawn',
  'morning',
  'downButton',
  'elsewhereButton',
] as const;

/**
 * The fight is looked at this many times, FIGHT_GAP frames apart, the reel held and let go by turns: the hooked fish
 * swims across the pond as it is played, so one look would pass a bar that stands over where the fish goes next.
 */
const FIGHT_SAMPLES = 12;
const FIGHT_GAP = 30;

/** The modal pages' cards, which lie over the other overlays by design. */
const MODALS = ['startAgainCard', 'journalCard', 'lakesCard', 'sleepCard'];

/** How near an overlay's edge may come to the bobber, the line's end or the fish, in CSS pixels: a finger-width of nothing is not asked, but the point must not sit on the edge. */
const POINT_MARGIN = 6;
/** Tolerated overlap between two boxes, in pixels, for the rounding of a laid-out edge. */
const EDGE_SLACK = 0.5;

type Moment =
  | 'welcome'
  | 'look'
  | 'cast'
  | 'bite'
  | 'fight'
  | 'landed'
  | 'cured'
  | 'drum card'
  | 'bottle card'
  | 'start again'
  | 'journal'
  | 'journal found'
  | 'lakes'
  | 'lakes cabin'
  | 'sleep'
  | 'yawn'
  | 'morning';
const MOMENTS: Moment[] = [
  'welcome',
  'look',
  'cast',
  'bite',
  'fight',
  'landed',
  'cured',
  'drum card',
  'bottle card',
  'start again',
  'journal',
  'journal found',
  'lakes',
  'lakes cabin',
  'sleep',
  'yawn',
  'morning',
];
/** The fewest overlays a moment must show, so a selector that finds nothing fails and does not pass in silence. */
const AT_LEAST: Record<Moment, number> = {
  welcome: 4,
  look: 3,
  cast: 3,
  bite: 4,
  fight: 5,
  landed: 4,
  cured: 3,
  'drum card': 4,
  'bottle card': 4,
  'start again': 1,
  journal: 1,
  'journal found': 1,
  lakes: 1,
  'lakes cabin': 1,
  sleep: 1,
  // the gauge, the menu and the words; and, in the cabin, the line and the two buttons with them
  yawn: 3,
  morning: 5,
};

interface Box {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const show = (b: Box) =>
  `#${b.id} [${b.left.toFixed(0)},${b.top.toFixed(0)} to ${b.right.toFixed(0)},${b.bottom.toFixed(0)}]`;

/** Every visible overlay's box on the page now. */
async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(
    (ids) => {
      const out: Box[] = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.hidden) continue;
        const css = getComputedStyle(el);
        if (css.display === 'none' || css.visibility === 'hidden' || css.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        out.push({ id, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      // the question before Start again is a modal over the whole screen: its card is the box to hold inside the screen
      const card = document.querySelector<HTMLElement>('#startAgain:not([hidden]) .card');
      if (card) {
        const r = card.getBoundingClientRect();
        out.push({ id: 'startAgainCard', left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      // and so is the journal's page
      const page = document.querySelector<HTMLElement>('#journal:not([hidden]) .card');
      if (page) {
        const r = page.getBoundingClientRect();
        out.push({ id: 'journalCard', left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      // and the lakes page
      const lakes = document.querySelector<HTMLElement>('#lakes:not([hidden]) .card');
      if (lakes) {
        const r = lakes.getBoundingClientRect();
        out.push({ id: 'lakesCard', left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      // and the sleep page
      const sleep = document.querySelector<HTMLElement>('#sleep:not([hidden]) .card');
      if (sleep) {
        const r = sleep.getBoundingClientRect();
        out.push({ id: 'sleepCard', left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      return out;
    },
    OVERLAYS as readonly string[],
  );
}

/**
 * The page played to a moment, from a save of three cured, seeded and paused; but the welcome is a game begun afresh,
 * with no save, since the welcome line shows only before the first fish is cured and the first cast.
 */
async function reach(page: Page, moment: Moment) {
  // the journal's page is read from a save with a journal part filled and a drum hauled, so that it has words to fit; the
  // drum's card from a pond with every fish cured, so that only a drum can be landed
  const save =
    moment === 'welcome'
      ? {}
      : // the lakes page in the cabin is read from a load there, on the second day, as a morning is
        moment === 'lakes cabin'
        ? { save: { cured: 3, day: 2, place: 'cabin' as const } }
        : moment === 'journal'
          ? {
              save: {
                cured: 3,
                day: 2,
                drums: 1,
                journal: { perch: { caught: 2, best: 1.9, first: 1 }, pike: { caught: 1, best: 3.62, first: 2 } },
              },
            }
          : moment === 'journal found'
            ? {
                // every treasure found, with the bottle's note the longest line of it, and a journal and a drum as well
                save: {
                  cured: 3,
                  day: 2,
                  drums: 1,
                  journal: { perch: { caught: 2, best: 1.9, first: 1 }, pike: { caught: 1, best: 3.62, first: 2 } },
                  found: ['lure', 'plush', 'lunchbox', 'badge', 'bottle', 'duck'],
                },
              }
            : moment === 'drum card' || moment === 'bottle card'
              ? { save: { cured: 12 } }
              : { save: { cured: 3 } };
  await start(page, { seed: 7, paused: true, ...save });
  await page.evaluate(() => window.game!.step(30));
  const ok = await page.evaluate(async (m) => {
    const g = window.game!;
    if (m === 'look' || m === 'welcome') return true;
    if (m === 'start again') {
      await g.startAgain();
      return true;
    }
    if (m === 'journal' || m === 'journal found') {
      await g.openJournal();
      return true;
    }
    if (m === 'lakes' || m === 'lakes cabin') {
      await g.openLakes();
      return g.pagesOpen();
    }
    if (m === 'sleep') {
      await g.openSleep();
      return g.pagesOpen();
    }
    if (m === 'drum card') return g.fishTo('landed', 'drum');
    // the bottle's card is the longest: its note is the most words a card ever holds
    if (m === 'bottle card') return g.fishTo('landed', 'bottle');
    if (m === 'yawn' || m === 'morning') {
      // to bed from the pond: the screen half dark and yawning, or woken in the cabin with the fade lifted
      await g.sleep();
      g.step(m === 'yawn' ? 45 : 160);
      return g.place() === (m === 'yawn' ? 'yawning' : 'cabin');
    }
    if (m === 'cast') {
      await g.mode('cast');
      g.step(30);
      return true;
    }
    if (m === 'bite') return g.fishTo('bite');
    if (m === 'fight') {
      if (!g.fishTo('bite')) return false;
      const struck = g.strike() === 'hooked';
      g.step(30);
      return struck && g.fishing().phase === 'hooked';
    }
    if (!g.fishTo('landed')) return false;
    return true;
  }, moment);
  expect(ok, `the page reached ${moment}`).toBe(true);
  if (moment === 'cured') {
    await page.locator('#catch').click();
    await page.evaluate(() => window.game!.step(1));
  }
}

for (const bp of BREAKPOINTS) {
  test.describe(bp.name, () => {
    test.use({
      viewport: { width: bp.width, height: bp.height },
      ...(bp.touch ? { hasTouch: true, isMobile: true } : {}),
    });

    for (const moment of MOMENTS)
      test(moment, async ({ page }) => {
        const problems = watch(page);
        await reach(page, moment);
        // a set, so the same two boxes seen at every look of the fight are said once
        const failures = new Set<string>();
        let looks = 0;
        let checked = 0;

        /** One look at the page: the overlays against each other, the screen and, when a fish is on, the points. */
        const look = async (label: string) => {
          const all = await boxes(page);
          looks++;
          checked += all.length;
          expect(all.length, `overlays checked at ${label}: ${all.map((b) => b.id).join(', ')}`).toBeGreaterThanOrEqual(
            AT_LEAST[moment],
          );
          const where = `${bp.name} at ${label}`;
          // what holds the same at every look of the fight is said once
          const still = `${bp.name} at ${moment}`;

          // no two overlays intersect
          for (let a = 0; a < all.length; a++)
            for (let b = a + 1; b < all.length; b++) {
              const p = all[a],
                q = all[b];
              // the dialog is modal, so it lies over the other overlays by design, as the pairing overlay does
              if (MODALS.includes(p.id) || MODALS.includes(q.id)) continue;
              if (
                Math.min(p.right, q.right) - Math.max(p.left, q.left) > EDGE_SLACK &&
                Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > EDGE_SLACK
              )
                failures.add(`${still}: ${show(p)} overlaps ${show(q)}`);
            }

          // every overlay is inside the screen
          for (const b of all)
            if (
              b.left < -EDGE_SLACK ||
              b.top < -EDGE_SLACK ||
              b.right > bp.width + EDGE_SLACK ||
              b.bottom > bp.height + EDGE_SLACK
            )
              failures.add(`${still}: ${show(b)} is outside the ${bp.width}x${bp.height} screen`);

          // while a fish is on or biting, nothing stands over the bobber, the line's end or the fish
          if (moment === 'bite' || moment === 'fight') {
            const points = await page.evaluate(() => window.game!.onScreen());
            // a hooked fish drags the bobber under, so in the fight there is no bobber to cover; the line and the fish remain
            const named: [string, { x: number; y: number } | null][] = [['line end', points.line]];
            if (moment === 'bite') named.push(['bobber', points.bobber]);
            if (moment === 'fight') named.push(['hooked fish', points.fish]);
            for (const [what, at] of named) {
              expect(at, `${what} is on the screen at ${label}`).not.toBeNull();
              for (const b of all) {
                if (b.id === 'biteMark' && what === 'bobber') continue;
                if (
                  at!.x > b.left - POINT_MARGIN &&
                  at!.x < b.right + POINT_MARGIN &&
                  at!.y > b.top - POINT_MARGIN &&
                  at!.y < b.bottom + POINT_MARGIN
                )
                  failures.add(`${where}: ${show(b)} covers the ${what} at ${at!.x.toFixed(0)},${at!.y.toFixed(0)}`);
              }
            }
          }

          // with all found, the page is longer than a short screen: its card may scroll, and must say it can, inside the screen
          if (moment === 'journal found') {
            const fit = await page.evaluate(() => {
              const card = document.querySelector<HTMLElement>('#journal .card')!;
              return {
                scroll: card.scrollHeight,
                shown: card.clientHeight,
                overflow: getComputedStyle(card).overflowY,
                close: document.getElementById('journalClose')!.getBoundingClientRect().width,
              };
            });
            if (fit.scroll > fit.shown + 1 && !['auto', 'scroll'].includes(fit.overflow))
              failures.add(
                `${still}: the journal's card needs ${fit.scroll}px, shows ${fit.shown}px and cannot scroll`,
              );
            if (fit.close <= 0) failures.add(`${still}: the journal's Close button has no size`);
          }

          // the journal's words all fit its card, with nothing left to scroll to
          if (moment === 'journal') {
            const fit = await page.evaluate(() => {
              const card = document.querySelector<HTMLElement>('#journal .card')!;
              return { scroll: card.scrollHeight, shown: card.clientHeight };
            });
            if (fit.scroll > fit.shown + 1)
              failures.add(`${still}: the journal's words need ${fit.scroll}px and the card shows ${fit.shown}px`);
          }

          // the lakes page's rows and buttons all fit its card, with nothing left to scroll to
          if (moment === 'lakes' || moment === 'lakes cabin') {
            const fit = await page.evaluate(() => {
              const card = document.querySelector<HTMLElement>('#lakes .card')!;
              return {
                scroll: card.scrollHeight,
                shown: card.clientHeight,
                buttons: document.querySelectorAll('#lakesList button').length,
              };
            });
            if (fit.scroll > fit.shown + 1)
              failures.add(`${still}: the lakes page's words need ${fit.scroll}px and the card shows ${fit.shown}px`);
            const wanted = moment === 'lakes' ? 1 : 2;
            if (fit.buttons !== wanted)
              failures.add(`${still}: the lakes page has ${fit.buttons} buttons, not ${wanted}`);
          }

          // the sleep page's two choices all fit its card, with nothing left to scroll to
          if (moment === 'sleep') {
            const fit = await page.evaluate(() => {
              const card = document.querySelector<HTMLElement>('#sleep .card')!;
              return {
                scroll: card.scrollHeight,
                shown: card.clientHeight,
                buttons: document.querySelectorAll('#sleepList button').length,
              };
            });
            if (fit.scroll > fit.shown + 1)
              failures.add(`${still}: the sleep page's words need ${fit.scroll}px and the card shows ${fit.shown}px`);
            if (fit.buttons !== 2) failures.add(`${still}: the sleep page has ${fit.buttons} choices, not 2`);
          }

          // the keyboard hint names keys a phone does not have
          const help = await page.evaluate(() => {
            const el = document.getElementById('help')!;
            const r = el.getBoundingClientRect();
            return !el.hidden && getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
          });
          if (bp.touch && help) failures.add(`${still}: the keyboard hint shows on a touch screen`);
          if (!bp.touch && moment === 'look' && !help)
            failures.add(`${still}: the keyboard hint is hidden with a mouse`);
          // and so does the welcome's "or C", which a touch screen leaves out and a mouse keeps
          if (moment === 'welcome') {
            const words = await page.evaluate(
              () => (document.querySelector('#welcome small') as HTMLElement).innerText,
            );
            if (bp.touch && words.includes('C,'))
              failures.add(`${still}: the welcome names the C key on a touch screen`);
            if (!bp.touch && !words.includes('C,'))
              failures.add(`${still}: the welcome leaves out the C key with a mouse`);
          }
        };

        expect(await page.evaluate(() => window.game!.layout()), 'the layout in force').toBe(
          layoutFor(bp.width, bp.height),
        );

        await look(moment);
        if (moment === 'fight') {
          for (let k = 1; k < FIGHT_SAMPLES; k++) {
            const on = await page.evaluate(
              ([hold, gap]) => {
                const g = window.game!;
                g.reel(hold);
                g.step(gap);
                return g.fishing().phase === 'hooked';
              },
              [k % 2 === 1, FIGHT_GAP] as const,
            );
            if (!on) break;
            await look(`fight +${k * FIGHT_GAP}`);
          }
          expect(looks, 'the fight was looked at more than once').toBeGreaterThanOrEqual(6);
        }
        expect(checked, 'overlay boxes checked').toBeGreaterThanOrEqual(AT_LEAST[moment] * looks);

        // the page does not scroll sideways
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        if (scrollWidth > bp.width)
          failures.add(`${bp.name} at ${moment}: the page scrolls sideways (${scrollWidth} wide)`);

        expect([...failures], `\n${[...failures].join('\n')}\n`).toEqual([]);
        expect(problems).toEqual([]);
      });
  });
}
