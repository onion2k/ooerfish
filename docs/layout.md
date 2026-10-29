# The game laid out for every screen, and a way to start again

## Context

The user played the game on their phone, a Pixel 7a, and found the overlays covering too much of it. Measured at
390×844: in the fight, the bar (116×324 px) and its words sit over the middle of the pond, over the fish and the
line, covering 23% of the screen, and the catch card lands in the same spot. Meanwhile the bottom third of the
screen is grass with nothing on it. Today the page has one breakpoint, at 600 px wide.

A phone held sideways (915×412) gets the desk layout on a short screen: the bar covers the pond's right side, and
the keyboard hint runs into the fight's words. A tablet (820×1180) gets the desk layout too, with the same overlap.

The user also wants a way to reset the pond: there is no Start again today.

**Chosen by the user, 17 Oct, from mocks in the real renderer:**

- **Portrait phones:** layout A, everything for the fight off the pond and onto the grass. The bar goes
  bottom-left, the Reel/Strike button bottom-right, the words just above the button, and the catch card becomes a
  strip at the foot.
- **A phone held sideways:** S1. One slim row at the top (the pond's gauge, the Cast button, the menu), the bar
  thin on the left edge, the Reel button bottom-right, and the words and card as a small strip at the foot between
  them.
- **Tablets and every other screen:** by shape. A screen taller than wide gets layout A, a short wide screen gets
  S1, and a wide screen with room keeps the desk layout.
- **The baseline phone:** the Pixel 7a, 412×915 CSS px (1080×2400 at a device pixel ratio of 2.625).

## What

1. **Three layouts, chosen by the screen's shape, not its width:**
   - **portrait** (taller than wide: phones and tablets held upright): layout A, with the gauge, the Cast button
     and the menu in a row at the top;
   - **sideways** (wider than tall, and no more than 500 px tall: phones held sideways): S1;
   - **desk** (wider than tall with room: desks and tablets held sideways): today's layout.

   The choice is CSS media queries on aspect ratio and height, said once in `index.html`. The 600 px width
   breakpoint goes.

2. **On a touch screen the keyboard hint is hidden** ("drag to look round, wheel to zoom, C to cast"), since it
   names keys a phone does not have. The test is `(hover: none)`.
3. **In every layout, during the fight, nothing covers the hooked fish, the line's end or the bobber,** and
   nothing overlaps anything else. The bar's height follows the screen's height, within limits, so it fits a
   small phone and fills a tablet.
4. **Start again**, a second item behind the corner's ⋯ menu. It asks first, in the page's own small dialog:
   "Start again? Every fish you have cured goes back to glowing, and the pond to sick." The buttons are Keep
   playing and Start again, and Escape keeps playing. Start again wipes the save (`Progress.reset()`, which exists
   and is unused) and reloads the page onto a fresh sick pond at dawn.

## Acceptance criteria

1. At each breakpoint (desk 1280×800; Pixel 7a 412×915; small phone 360×800; phone sideways 915×412; tablet
   820×1180 and 1180×820; and, added in part 3, a desk window narrowed to 412×915 and flattened to 915×412, with a mouse, so the hint shows in the phone's layouts), the page takes the layout its shape says. A test reads which layout is in force, from a
   data attribute the CSS keys off or from the computed positions.
2. At each breakpoint, at the moments welcome (a game begun afresh, added in part 3), look, cast, bite, fight, landed, cured and the Start again question, no two visible overlays intersect.
   During the fight, none covers the hooked fish's, the line end's or the bobber's point on the screen. The test API
   gains `game.onScreen()`, which gives those points through the page's `toScreen`.
3. On a touch screen (`hasTouch`) the hint is hidden; with a mouse it shows, as today.
4. Every overlay is inside the screen at every breakpoint, with no horizontal scroll and nothing cut off.
5. Start again asks first. Keep playing, Escape, or a click outside the dialog leaves everything as it was. Start
   again leaves a save of 0 cured after the reload, with a sick pond and no gifts. It is in the ⋯ menu beside Pair a
   phone, and works by keyboard as well as by tap.
6. The phone page (`phone.html`) is not changed.

## Edge cases (from the checklist)

- **save:** Start again wipes it, and a reload loads a fresh one. An old save is unaffected until the player
  chooses Start again.
- **phone:** the point of this. The phone and pairing pictures are rewritten at the Pixel 7a's size.
- **the mode:** look and cast in each layout. The Cast button stays in the top row in portrait and sideways.
- **the Row button** (`docs/boat.md`, C2): beside Cast in the same box, the `hud`, in every layout: bottom left of the
  screen at a desk's width, with the hint above them; in portrait the pair sits in the top row under the gauge, a
  little smaller (13 px, no minimum width) so that the two, with "Look round" in either, end before the bucket's words
  do at 360 px; sideways it sits in the slim top row after Cast. Both are greyed while the boat is rowed. The layout
  spec reads the two buttons on their own and holds them clear of each other and of every overlay but the hud, and
  gains the moments `rowing`, `aboard` and `aboard fight`, the last two held to the bobber, the line's end and the
  hooked fish as the bite and the fight are, the camera being behind the seat.
- **the rung:** unaffected.
- **the lab:** the pictures are taken at each time of day where a layout differs, and at least by day.
- **the line and the fish:** held clear by criterion 2 during the fight.
- **the phone as the rod:** the pairing overlay fits every breakpoint. Start again while paired reloads the page,
  so the phone is told the screen left and re-pairs from the code, as it does on any reload.
- **mid-fight Start again:** allowed. The reload drops the fight, and nothing is half-saved.
- **a screen turned while playing:** the layout follows at once (it is CSS), and the Shore view's framing already
  follows the shape (`framingFor`).
- **snags, the boat, the calendar, the cabin:** not reachable.

## Decisions (yours)

1. **The phone pictures' size.** Recommended: every phone picture, the existing ones (`phone`, `phone-fight`,
   `phone-splash`, `phone-pond-*`, `pairing-phone`) and the new ones, is taken at the Pixel 7a's 412×915. The
   existing ones move from 400×860 and 390×844, a meant move. The small phone (360×800) is held by the overlap test
   rather than by pictures.
2. **The dialog's words** above, and the gift's toast staying where it is in each layout (at the foot in portrait).
   Recommended as written.

## Performance risk

None to the frame: the layout is CSS, and the bar's height a CSS clamp. The download moves by a few hundred bytes.
Measured in the pass at each breakpoint's frame, which should not change, since the canvas is the same size.

## Design

- `index.html`: the layouts as media queries on `(orientation: portrait)`, `(orientation: landscape) and
(max-height: 500px)` and the rest, and `(hover: none)` for the hint. The bar's height is a `clamp()` on `vh`.
  The ⋯ menu gains Start again and the dialog.
- `src/main.ts`: the menu's second item, the dialog (open, Keep playing, Escape and outside click to close, Start
  again calling `game.progress.reset()` then `location.reload()`), and `onScreen` for the test API. No game logic
  is added.
- `src/debug.ts`: `onScreen()`, and `layout()` (which of the three is in force, read from a data attribute set
  from `matchMedia`, said once beside the CSS).
- `smoke/layout.spec.ts` (new): the breakpoints × moments overlap test (criteria 1 to 4), driven by the test API,
  seeded and paused.
- `smoke/look.spec.ts`: the pictures at the Pixel 7a for the phone, and new pictures of the fight and the landing at
  sideways and tablet.
- `smoke/progress.spec.ts`: Start again, in a fresh context with no `save` init script (since `start(page,
{ save })` writes the save on every load, a reload would put it back), with a fish cured first.
- `CLAUDE.md`: the layouts and the breakpoints, and the checklist's phone line gains sideways and tablet.
  `docs/layout.md` holds this spec.

Out of scope: the phone page's own layout; a settings screen; per-device tuning of the 3D camera (beyond the
existing portrait framing).

## Test plan

- **Unit:** the layout chooser, if it is a function (shape to layout), with the breakpoint table.
- **End-to-end:**
  - `smoke/layout.spec.ts`: 6 breakpoints × 6 moments, each asserting no overlaps, the hooked fish, line and
    bobber uncovered in the fight, everything inside the screen, and the hint shown or hidden by touch;
  - Start again in `progress.spec.ts`: asks first, Keep playing and Escape keep the save, Start again gives a save
    of 0 cured and a sick pond after the reload.
- **Pictures:**
  - the fight, the landing and a bite at 412×915, 915×412 and 820×1180 (new);
  - the existing phone pictures rewritten at 412×915;
  - the dialog at 412×915 and at a desk's width;
  - every desk picture unchanged.
- **Fuzzer:** nothing new for the game itself (Start again is a page action that reloads); the save's reset has a
  unit test.
- **Mutation:**
  - the bar put back over the pond in portrait;
  - the hint shown on touch;
  - Start again that wipes without asking;
  - Keep playing that wipes.

  The overlap test and the Start again test must catch each.

## Parts

- [x] 1. **The overlap test and the test API:** `onScreen()`, `layout()` and `smoke/layout.spec.ts`. Check: it fails
      on today's layout at the phone, sideways and tablet breakpoints (seen failing first) and passes at the desk.
- [x] 2. **The three layouts and the hint:** the CSS. Check: `smoke/layout.spec.ts` green at every breakpoint.
- [x] 3. **Start again:** the menu item, the dialog and the reset. Check: its end-to-end test, and the unit test of
      `Progress.reset()`.
- [x] 4. **The pass:** the full check, pictures written and each looked at, perf at each breakpoint, the
      mutations, `CLAUDE.md`, `docs/layout.md` and the report.
