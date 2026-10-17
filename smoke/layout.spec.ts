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
] as const;

/**
 * The breakpoints whose layout is not yet made for them, so their spec is `fixme` until it is. Part 2 of
 * `docs/layout.md` (the three layouts) removes every name from this set; the desk is never in it.
 */
const FIXME = new Set<string>([
  'Pixel 7a 412x915',
  'small phone 360x800',
  'phone sideways 915x412',
  'tablet 820x1180',
  'tablet sideways 1180x820',
]);

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
] as const;

/**
 * The fight is looked at this many times, FIGHT_GAP frames apart, the reel held and let go by turns: the hooked fish
 * swims across the pond as it is played, so one look would pass a bar that stands over where the fish goes next.
 */
const FIGHT_SAMPLES = 12;
const FIGHT_GAP = 30;

/** How near an overlay's edge may come to the bobber, the line's end or the fish, in CSS pixels: a finger-width of nothing is not asked, but the point must not sit on the edge. */
const POINT_MARGIN = 6;
/** Tolerated overlap between two boxes, in pixels, for the rounding of a laid-out edge. */
const EDGE_SLACK = 0.5;

type Moment = 'look' | 'cast' | 'bite' | 'fight' | 'landed' | 'cured';
const MOMENTS: Moment[] = ['look', 'cast', 'bite', 'fight', 'landed', 'cured'];
/** The fewest overlays a moment must show, so a selector that finds nothing fails and does not pass in silence. */
const AT_LEAST: Record<Moment, number> = { look: 3, cast: 3, bite: 4, fight: 5, landed: 4, cured: 3 };

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
      return out;
    },
    OVERLAYS as readonly string[],
  );
}

/** The page played to a moment, from a save of three cured, seeded and paused. */
async function reach(page: Page, moment: Moment) {
  await start(page, { seed: 7, paused: true, save: { cured: 3 } });
  await page.evaluate(() => window.game!.step(30));
  const ok = await page.evaluate(async (m) => {
    const g = window.game!;
    if (m === 'look') return true;
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
        // part 2 of docs/layout.md removes this: these breakpoints still have today's single layout
        test.fixme(FIXME.has(bp.name), 'the layouts for this screen are part 2 of docs/layout.md');
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

          // the keyboard hint names keys a phone does not have
          const help = await page.evaluate(() => {
            const el = document.getElementById('help')!;
            const r = el.getBoundingClientRect();
            return !el.hidden && getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0;
          });
          if (bp.touch && help) failures.add(`${still}: the keyboard hint shows on a touch screen`);
          if (!bp.touch && moment === 'look' && !help)
            failures.add(`${still}: the keyboard hint is hidden with a mouse`);
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
