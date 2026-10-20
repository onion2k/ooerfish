# The seasons: the year's four dressings of the Duck Pond

## Context

Stage 6 of `DESIGN.md`'s order of work is "the seasons, the moon and the weather". The day counts, the year is
drawn on the cabin's calendar as four rows of fourteen, and nothing yet reads which row the day is in. This slice is
**the seasons' dressing**: the day's season, and each season seen on the lake. The moon, the weather (showers, fog
that hides a kind, wind that bends a cast, the radio's forecast) and sleeping through to a marked day are later
slices of the stage; the season's own fish (bright fry, winter fish) are stage 11's, since every one of the pond's
twelve is needed to clean it, so no kind can be away for a season.

**Chosen by the user (20 Oct 2026):** day 1 is **summer**, so the game as drawn today is summer's and the year runs
summer, autumn, winter, spring; **the falling things** (blossom, leaves, snow) are in this slice; **the mist** is in
too, as the last part, measured, dropped to a slice of its own if it cannot fit the budget.

## What

- **The season** is a pure function of the day: `seasonOf(day)` in `src/calendar.ts` beside `calendarMarks`, from
  `CALENDAR` (`SEASON_DAYS` 14; `SEASONS` names in `lake.ts`, in order summer, autumn, winter, spring). The morning
  line says it: "Day 15. An autumn morning at the cabin." (`nightWords`). It changes only at a wake, so the page
  dresses the lake at boot and in the `woke` handover (`dayDrawn`'s branch of `showWater`), never in a frame.
- **Each season's dressing**, content in `SEASON_DRESSING` in `lake.ts` (first guesses, tuned by the pictures):
  - **Summer** is the lake as it is: today's palette, breeze, waves and sky. Nothing falls.
  - **Autumn:** broadleaf leaves and crowns russet and gold, grass yellowed, the kit's leaves the same, a warmer
    hazier sky at dawn and dusk; leaves falling, russet and gold, drifting on a stronger breeze (0.5); waves 1.2 of
    summer's; mist at dawn.
  - **Winter:** snow: the ground sheet white, the grass pale and shorter, the cabin's roof and the jetty's deck
    white, broadleaf leaves a snowy pale (the pines keep their green); a pale cold sky, the light bluer; snow
    falling slowly on a light breeze (0.2); waves 0.8; mist off the water at dawn and night, where the glow reads
    brightest against the white. The lake never freezes.
  - **Spring:** fresh light greens, crowns and the kit's flowers blossom pink; petals falling on a soft breeze
    (0.35); waves as summer's; a clearer brighter dawn.
- **How the dressing reaches the renderer** (`src/season.ts`, the page's side, pure where it can be):
  - _Colours:_ `seasonPalette(season)` gives the palette keys the season moves (grass ground, blade base and tip,
    leaves, crown, flowers, cabin roof, jetty deck) and the rest unchanged; `Scene.static`, `cabinGroups`,
    `jettyGroups` and `bankField` take their colours from it, and at a season change the page hands the static set
    and the grass over again (`renderer.setStatic`, `setGrass`), once, at the wake, in the cabin where nothing
    moves. The cost is measured (part 2) and said; if it is over about 50 ms the seasonal groups move to the
    dynamic set and are tinted instead.
  - _Sky and light:_ `TIMES` becomes `timesFor(season)` in `look.ts`, each season shifting zenith, horizon, sun
    colour and ambient of the four looks by a tint and a mix in `SEASON_DRESSING`; the baked cubes are keyed
    `season:time` and baked lazily, the current season's four after the first frame as now (about 35 ms), the next
    season's at its wake. `nearestTime` and the stepping are unchanged.
  - _Water, wind, waves:_ `style.clear` takes the season for `near`, `crest` and `sparkleBright`; `CLEAR_WAVES` are
    scaled by the season's amplitude (steepness kept under one) and the bobber's `surface` is rebuilt with them;
    `renderer.wind` takes the season's breeze. All free, written in `finish`.
  - _The falling things:_ `src/falling.ts` (pure: the emitters of a season, a ring of `FALLING.emitters` points over
    the lake and banks at `FALLING.height`, each a `count`, `life`, `size`, `colour`, `gravity`, `floor` at the water,
    and a cadence in game frames) emitted from `simulate` as the falls' mist is (`mistDue`), through
    `renderer.emit`, carried sideways by `renderer.setWind` set to the season's wind; nothing in a frame is made. The
    particle pool grows from 2048 to what the worst season needs at its steady state (rate × life, about 300 live
    plus the splashes), named in `scripts/leaks.ts`. Paused, nothing is emitted (as the mist). The lean rung draws them too (found in part 6: lean drops the grass and the mist, not the particles), since the
    fall measured no frame cost.
  - _The mist:_ `renderer.fog`, density 0 (nothing) except autumn at dawn and winter at dawn and night, where
    `SEASON_DRESSING.mist` gives a low layer (`base` at the water, a small `height`, a pale colour); written in
    `showLight` with the look. The lean rung has none (`economy.fog`). Its frame cost is measured in the water
    perf test at winter night and held to the 8 ms budget.
- **The calendar** marks the seasons: the sheet's four rows each get a thin band in the season's colour at the
  row's left (four small faces, static), so the rows read as the year.
- **The test API:** `game.season()` reads the season and what the page has dressed (`{ name, dressed, statics,
falling, mist }`: the name, the season last handed over, how many static handovers, the falling emits counted,
  whether the fog is on). `set(page, scene)` and `start` take a `day` so a picture can be any season.

## Where it stands now (read)

| Figure             | Now                                                                       | Source                       |
| ------------------ | ------------------------------------------------------------------------- | ---------------------------- |
| Looks              | four, `TIMES` in `look.ts`; cubes baked once, keyed by name, 8-12 ms each | `look.ts:100-244`            |
| Static set         | built once at boot, albedo per group, no tint for static groups           | `scene.ts`, `main.ts`        |
| Grass colours      | `LUSH` base and tip, set once with the field                              | `grass.ts:34`, `main.ts:205` |
| Fog                | none used; renderer has a volumetric layer, 0 density costs nothing       | `renderer.fog`               |
| Particles          | pool 2048, bursts for splashes, the falls' mist every 5th frame           | `bursts.ts`, `main.ts:973`   |
| Wind for particles | `setWind` never called                                                    | grep                         |
| Perf               | boot 756 ms, frame 3.6 ms, download 185951 B, cabin frame 3.48 ms         | `smoke/perf-baseline.json`   |
| Pictures           | 69, all at day 1 unless the save says otherwise                           | `smoke/screens`              |
| Suite              | about 13 min, layout and look most of it                                  | last `npm run smoke`         |

## Acceptance criteria

1. `seasonOf(day)` gives summer for days 1-14, 57-70; autumn 15-28; winter 29-42; spring 43-56; a bad day is day
   1, as `calendarMarks` reads it.
2. A load on day 15, 29 and 43 shows, from the shore by day, the season's colours on the grass, the trees and the
   roof, the season's sky, and the falling thing where the season has one; day 1 is pixel for pixel the game as it
   is today in every existing picture.
3. At the wake into a new season the page hands the static set and the grass over again once, the sky's cubes
   are baked for it once, and `game.season()` counts both; a wake inside a season hands nothing over again.
4. The falling things are emitted on their cadence only while the game steps at the pond (paused, in the cabin
   and with a page open none are emitted), carried by the season's wind, and none in summer; the pool's ceiling
   holds in `leaks`.
5. The mist is on at autumn dawn and winter dawn and night, off at every other look and in every other season,
   and off on the lean rung; the water frame at winter night is under 8 ms.
6. The morning line names the season from autumn on; the calendar's rows carry the four season bands.
7. The bobber rides the season's waves (the `surface` agrees with the drawn waves); the grass bends to the season's
   breeze.
8. Perf: the standard frame (summer) unchanged within tolerance; the frame measured at each of the other three
   seasons by day from the shore, said in the report, and the worst held to 8 ms; the download's growth written
   and said; boot unchanged within tolerance (the season's work after the first frame).

## Edge cases (from the checklist)

- **save:** a save with any day loads its season; an old save without a day is day 1, summer. Nothing new is saved.
- **the day:** at each time of day in each season (sixteen looks, pictures of the four seasons by day and of the
  mist's three); the wake from day 14 to 15 (the change) and from 15 to 16 (no change); day 56 to 57 (spring to
  summer, the year round); sleeping through is not yet.
- **the rung:** full draws the grass in the season's colours, the falling things and the mist; lean has no grass and no mist, the flakes still falling (they cost nothing measurable), and the trees and roof
  still in the season's colours; the governor's measure at boot is
  summer's and unchanged.
- **the mode, the line, the fish:** unchanged; a petal or flake is a particle and never a thing in the lake.
- **the switches:** `?paint=off` draws the season's colours plain; caustics as now; `game.dirt` as now.
- **the water:** the waves scale and the swell the bobber rides scales with them; the rings do not.
- **scale:** the worst season's particles at steady state in the water perf test with twelve splashes live.
- **phone:** the pictures by day at the Pixel's width for winter; the layout is untouched.
- **the calendar's seasons:** this slice; the moon, the weather, festivals: not reachable.
- **the real clock, the lake's contamination, snags, the boat, the cabin's shelves:** not reachable.

## Decisions (mine, said so they can be changed)

- **A static rebuild at the wake,** not a move of the banks to the dynamic set: simpler, once a fortnight, in the
  cabin. If measured over 50 ms it is swapped for dynamic tinting in part 2 and the spec says so.
- **Lazy cubes:** sixteen looks eagerly is 130-190 ms; four at a time keeps the first frame as it is.
- **Winter's leaves pale, not bare:** the trees are groups per part and a bare tree needs new variants; a snowy
  crown reads as winter and costs nothing. Said in the picture; a bare variant can follow.
- **The falling things are not game state:** the GPU spawns them from its own hash, as the splashes' droplets are,
  so determinism and the fuzzer do not see them; the emitters' places are fixed content.
- **Summer first** keeps every existing picture; the year's order in the design's table is a list, not a start.

## Performance risk

- **Frame:** particles at steady state (about 300 live quads, measured) and the fog's march passes (unknown, the
  real risk: measured in part 5 at winter night, dropped to the lean rung's `economy.fog` off, and if over budget on
  full too, left for its own slice with the figure). The standard frame is summer's and should not move.
- **Boot:** the season's dressing is built with the static set; summer's palette is today's, so no change.
- **Download:** `season.ts`, `falling.ts`, the dressing table: under 2 kB gzipped expected, said exactly.
- **Memory:** the particle pool's growth and four more cubes at most, named in `leaks`.

## Test plan

- **Unit:** `test/calendar.test.ts` (`seasonOf`, the boundaries, the year round); `test/season.test.ts`
  (`seasonPalette` moves only its keys and summer is the palette unchanged; `timesFor('summer')` equals `TIMES`;
  the waves' steepness under one in every season; the falling emitters of each season, none in summer, every one
  over the lake or bank and above the water, the cadence); `test/nightview.test.ts` (the morning line by season);
  `test/cabinroom.test.ts` (the bands, the triangle ceiling); `test/scene.test.ts` and `test/grass.test.ts` where
  colours are taken from the season; `test/leaks.test.ts` the pool ceiling.
- **End to end, `smoke/progress.spec.ts`:** a load on day 14 at the pond, a sleep, and `game.season()` reads autumn
  dressed with one static handover and one grass handover; a second sleep, none more; paused, no falling emits; in
  the cabin, none; the mist on at autumn dawn and off at day; on lean, off.
- **Perf, `smoke/perf.spec.ts`:** the standard frame as now; a new test measuring the shore by day at days 15, 29
  and 43 and telling the three, holding the worst to the budget; the water test at winter night with the mist.
- **Pictures, `smoke/look.spec.ts`:** `season-autumn-day`, `season-winter-day`, `season-spring-day` from the shore;
  `season-autumn-dawn-mist`, `season-winter-night-mist`; `phone-season-winter`; `cabin-calendar-bands`; and
  `season-winter-lean`. Every existing picture unchanged.
- **Fuzzer:** each seed's start day is drawn across the year (the day is already drawn; widen it past 56), so every
  season is played; nothing else, since the season is not game state.
- **Invariants:** none new; `seasonOf` is pure. Determinism: unchanged.

## Parts

Built on `sonnet` by the `builder` agent, one at a time (they share `main.ts`), from `docs/seasons.md`, which is
this spec copied into the repo as part 0.

- [x] 0. **The spec in the repo:** `docs/seasons.md`; `DESIGN.md` stage 6 says what this slice is and that summer
      is day 1. Check: Prettier.
- [x] 1. **The season and its words:** `SEASONS`, `SEASON_DAYS` in `lake.ts`; `seasonOf` in `calendar.ts`; the
      morning line; `game.season().name`; the fuzzer's wider day. Check: `test/calendar`, `test/nightview`, fuzz 1-24.
- [x] 2. **The colours:** `SEASON_DRESSING` palettes, `seasonPalette`, the static set and the grass taking it,
      the handover at the wake measured and said, `game.season().statics`. Check: `test/season`, `test/scene`, the
      progress stage, the three day pictures.
- [x] 3. **Sky, water, wind, waves:** `timesFor`, lazy cubes keyed by season, `style.clear` by season, the waves
      and the bobber's surface, `renderer.wind`. Check: `test/season`, `test/water`, the pictures again.
- [x] 4. **The falling things:** `falling.ts`, the cadence in `simulate`, `setWind`, the pool's size in `leaks`,
      `game.season().falling`. Check: `test/season`, the paused and cabin stages, the perf test by season.
- [x] 5. **The mist:** `fog` by season and look, lean off, measured at winter night. Check: the mist stages and
      pictures, the water perf test; if over budget, reported and left out with the figure.
- [x] 6. **The calendar's bands.** Check: `test/cabinroom`, `cabin-calendar-bands`.
- [x] 7. **The pass:** `npm run check`, fuzz 1-24, perf before and after by season, the mutations (`seasonOf` off
      by a day; the handover made every wake; summer given a falling thing), the report.
