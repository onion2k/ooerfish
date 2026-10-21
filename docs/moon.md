# The moon: an eight-day round, a disc in the night sky, the glow at its best, and sleeping through to it

## Context

Stage 6 of `DESIGN.md` is "the seasons, the moon and the weather"; the seasons are in. The design says the moon goes
round in eight days, so each season has a full and a new moon; at a new moon the night is darkest and the glow reads
best; and from the cabin the player may sleep through to a marked day, "so waiting for the full moon is never a
chore". Nothing of it exists: the night is one look, there is no disc in the sky, and the only sleep is one night.

**Chosen by the user (21 Oct 2026):** **day 1 is a full moon** (tonight's look as drawn is the full moon's, so the
lighting of every night picture holds; day 5 is the new moon); **the moon is a disc with its phase**, a bright unlit
disc with a sky-coloured disc slid across it to cut the crescent, the night's light lowered so it sits in the shore
view; **sleeping through is a page**, "Sleep through…" in the ⋯ menu listing the marked nights ahead. The Moon Fish
is stage 11's (a cleaned lake's big fish) and not this slice.

## What

- **The phase** is a pure function of the day: `moonOf(day)` in `src/calendar.ts` beside `seasonOf`, `(day - 1) %
MOON.days` (`MOON` in `lake.ts`: `days` 8, `full` 0, `new` 4), with the eight names (`full`, `waning gibbous`,
  `last quarter`, `waning crescent`, `new`, `waxing crescent`, `first quarter`, `waxing gibbous`) and `moonLight(phase)`,
  the share of the full moon's light each phase gives (1 at full, `MOON.darkest` 0.35 at new, cosine between). The
  year of 56 days holds exactly seven rounds, so day 57's moon is day 1's and the calendar's moons are fixed squares.
- **The night by the moon.** The `night` look's `ambient`, `skyLight`, `groundLight`, `sunColour` (the moonlight), the
  sky's zenith and horizon, and the water's `glitter` are scaled by `moonLight(phase)`; **`exposure` is not**, since
  the fish's glow is added before the exposure and must read brighter against a darker night, not dimmer with it.
  `timesFor(season, phase)` in `look.ts` gives the four looks with the night's entry so scaled, memoised by
  `season:phase`; the baked cube stays keyed `season:time` (the mirror and specular at the full moon's strength, the
  water's glitter carrying the phase), so no cube is baked per phase. Dawn, day and dusk are untouched. The night's
  `sun` direction is lowered from 59° to about 25° above the horizon on the same bearing, so the moon is in the shore
  view's frame; this moves the moonlit shadow and the night's toon shading in every night picture, once, meant.
- **The disc** (`src/moondraw.ts`, `MoonDraw`): a bright disc (a `disc` from `lowpoly`, `FLOW_GLOW` unlit as the cabin
  window is, `PALETTE.moon`) and a shadow disc in the night sky's colour slid across it by the phase (full: off the
  face; new: covering it; the quarters half across; the crescents' curve from two circles), both far along the night's
  `sun` direction at `MOON.distance` (within the far plane: measured in part 2; if the far plane is nearer, the
  distance and radius scale down together so the angle holds) with radius for about four degrees of sky, facing the
  camera's side, scaled to nothing except at night, so by day and dusk nothing is drawn; two moving groups in the
  dynamic set, handed over only when the look's name or the phase changes (the wake and the look's step), never in a
  frame. On the lean rung too (two discs cost nothing). Seen from the pond and the Reservoir (the direction is the
  look's, not the lake's).
- **The calendar's moons:** on the sheet, the seven full-moon squares get a small pale dot and the seven new-moon
  squares a small dark one, two static parts (`moonFull`, `moonNew` in `ROOM_PARTS`, `FURNITURE.calendar`,
  `ROOM_COLOURS`), placed by `calendarGeometry`'s `spot`, clear of the marks' plane, under the triangle ceiling.
- **The morning line** says the marked night: "Day 5. Morning at the cabin. New moon tonight." / "Full moon tonight."
  (`nightWords`, pure); the yawn's words unchanged.
- **Sleeping through** (`docs/moon.md`'s page, `src/sleep/page.ts` with the pure `sleepWords(day)`: the marked nights
  ahead from `moonOf`: "Till the full moon (3 nights)", "Till the new moon (7 nights)", in order of distance, and later
  the weather's and the festivals' nights): "Sleep through…" in the ⋯ menu (between "Go to bed" and "Start again"),
  greyed mid-fight as bed is, opens `#sleep`, a page like the lakes page that stops the clock; a choice calls
  `Game.sleepThrough(nights)`: the yawn as `sleep` does, and the wake goes `nights` days on (`wake(nights)`: the day up
  by `nights`, the heal finished, the splashes emptied, the clock dawn, the place the cabin, the lake the home, one
  persist), so a season's change or several are dressed by the existing `woke` handover (`showWater` compares
  seasons, not days). Refused mid-fight, while yawning or leaving, and for `nights` under 1 or over `MOON.days`.
  "Go to bed" stays as it is (one night). `game.sleepThrough(n)`, `game.openSleep(open)` and `game.moon()` (`{ phase,
name, light, nextFull, nextNew }`) are the test API.

## Where it stands now (read)

| Figure            | Now                                                                                                                            | Source                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| The night look    | one entry: ambient 0.25, exposure 0.42, glitter 0.12, sun at 59°, `moonlight`                                                  | `look.ts:103`, `palette.ts`       |
| A disc in the sky | none; the sky pass is a gradient; the cube's sun glow is the mirror's only                                                     | `look.ts:200`, `sky.ts`           |
| The fish's glow   | added before the exposure in the flow shader, so exposure scales it                                                            | `fishdraw.ts`, `flow.ts`          |
| Unlit things      | the cabin's window and the lamp's bulb through `FLOW_GLOW`                                                                     | `cabin.ts:152`                    |
| The calendar      | 56 squares, bands a season, marks `gone` and `today`; a static part is cheap                                                   | `cabinroom.ts`, `calendardraw.ts` |
| Sleep             | `Game.sleep` one night; `wake` does day + 1, heal, splashes, dawn, cabin, home                                                 | `game.ts:277-358`                 |
| A day's jump      | `showWater` dresses by `seasonOf(game.day)`, so a jump of any size is dressed                                                  | `main.ts:443`                     |
| Night pictures    | `sick-night`, `half-cured-night`, `splash-night`, the fish and pike by night, `treasure-bed-night`, `season-winter-night-mist` | `smoke/`                          |

## Acceptance criteria

1. `moonOf(day)`: day 1, 9, 57 full; day 5 new; 3 the last quarter; 7 the first; `moonLight` 1 at full, 0.35 at new,
   symmetric either side; a bad day is day 1.
2. The night look at the new moon has ambient, sky light, ground light, moonlight, zenith, horizon and glitter at
   `moonLight` of the full moon's and the same exposure; dawn, day and dusk are the same at every phase; the full
   moon's night is today's night with the sun lowered.
3. The disc is drawn at night only, in the shore view's frame at both lakes, its crescent by the phase; handed over
   only when the look or the phase changes (`game.moon().handovers`); nothing by day.
4. The calendar has fourteen moon dots on the right squares; the room's rules and ceiling hold.
5. The morning line says "Full moon tonight." and "New moon tonight." on those days and nothing on others.
6. "Sleep through…" opens the page with the nights ahead in order of distance; a choice yawns, and the wake is the
   chosen day on, in the cabin at home at dawn, the day saved, a season passed dressed once; refused mid-fight,
   yawning or leaving; the page stops the clock.
7. Pictures: the new moon's night and the first quarter's from the shore, the moon over the Reservoir, the calendar
   with its dots, the morning line on a full-moon day, the sleep page at a desk and a phone; the existing night
   pictures rewritten once for the lowered moon and the disc, read, and every other picture unchanged.
8. Perf: the standard frame unchanged; the night water frame told; the download's growth written and said.

## Edge cases (from the checklist)

- **save:** nothing new is saved; a day from any save gives its phase.
- **the day:** the moon at dusk and dawn is not drawn (night only); midnight's wake moves the phase and the disc;
  sleeping through from day 54 to 61 crosses the year and a season (spring to summer), dressed once; `sleepThrough`
  from the pond reels in as bed does.
- **the rung:** the disc on lean too; the mist at winter night still under the moon.
- **the lakes:** the disc from the Reservoir's shore; sleeping through at the Reservoir wakes at home.
- **the phone:** the sleep page at the phone's width; the layout spec's moments gain the page.
- **the switches:** `game.time('night')` at any day shows that day's moon; `game.clock` as now.
- **the seasons:** winter's night tint and the moon's scale compose (the tint mixes, then the phase scales).
- **the water, the line, the fish, the mode:** unchanged; the glow's reading is a picture, held by eye.
- **the weather, festivals, the Moon Fish, the real clock:** not reachable.

## Decisions (mine, said so they can be changed)

- **The phase scales the light, not the exposure,** so the glow reads brighter at the new moon without touching the
  fish's materials or handing their groups over.
- **No cube per phase:** the mirror keeps the full moon's glint; the water's glitter carries the phase. Eight cubes
  would be 64 ms and eight times the memory for a glint few would see.
- **The disc is two meshes, not a sprite,** so the crescent is a shape; it is unlit as the window is.
- **The night's sun is lowered once** for every phase, so the moon is seen; the shadow moves with it, meant.
- **Sleeping through is capped at a round** (eight nights) and lists only the moon's marks until the weather comes.

## Performance risk

- **Frame:** two discs, a few dozen triangles, unlit; nothing per frame. Measured in the night water test.
- **Boot:** nothing new at boot beyond two small meshes.
- **Download:** `moondraw.ts`, the page, the words: under 2 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/calendar.test.ts` (`moonOf`, `moonLight`, the year's rounds, `nextFull`/`nextNew`);
  `test/look.test.ts` or `test/season.test.ts` (`timesFor(season, phase)`: the night scaled, the rest untouched, the
  memo, the lowered sun); `test/moondraw.test.ts` (the discs along the sun's direction at the distance, the shadow's
  offset by phase: off at full, covering at new, half at the quarters; scaled to nothing by day; the same matrices for
  the same phase and look); `test/cabinroom.test.ts` (the dots on the right squares, the ceiling);
  `test/nightview.test.ts` (the morning line); `test/sleep.test.ts` (`sleepWords`, `Game.sleepThrough`: the wake's day,
  the refusals, the heal, the season crossed, the lake home); `test/water.test.ts` (the glitter by phase).
- **End to end, `smoke/progress.spec.ts` "the moon":** a load on day 5 at night reads `moon()` new with the discs'
  handover count 1; `time('day')` draws nothing, `time('night')` one more handover; the sleep page from the menu,
  the clock stopped, a choice to the full moon lands on day 9 in the cabin with the morning line; refused mid-fight.
- **Fuzzer:** a "sleep through" action (a random number of nights, refused as bed is), counted; the invariants hold
  the day never going back and the phase from the day.
- **Determinism:** unchanged (the phase is the day's).
- **Pictures:** `moon-new-night`, `moon-quarter-night` (day 7) from the shore, `moon-reservoir-night`,
  `cabin-calendar-moons`, `desk-morning-full-moon`, `desk-sleep-page`, `phone-sleep-page`; the existing night
  pictures rewritten through `/gate-moved`.
- **Perf:** the night water test told; the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, one at a time (they share `main.ts`), from `docs/moon.md`, which is this
spec copied into the repo as part 0.

- [x] 0. **The spec in the repo:** `docs/moon.md`; `DESIGN.md` stage 6 notes the slice. Check: Prettier.
- [x] 1. **The phase and the night's light:** `MOON`, `moonOf`, `moonLight`, `timesFor(season, phase)`, the glitter,
      the lowered sun, the morning line, `game.moon()`. Check: `test/calendar`, `test/season`, `test/nightview`.
- [x] 2. **The disc:** `MoonDraw`, the far plane measured, the handover in `main.ts`, the pictures (new and rewritten).
      Check: `test/moondraw`, the night stages, every picture read.
- [x] 3. **The calendar's moons:** `moonFull` and `moonNew`, fourteen blocks on the sheet. Check: `test/cabinroom`; `cabin-calendar-bands` frames them.
- [x] 4. **Sleeping through:** `Game.sleepThrough`, `wake(nights)`, the page, the menu item, the fuzzer's action.
      Check: `test/sleep`, the sleep stages, fuzz 1-24.
- [x] 5. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the phase off by a day; the
      exposure scaled with the light; the wake going one night whatever was chosen), the report. Commit.
