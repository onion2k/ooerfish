# Nuclear Fishin': working on it

A calm, cosy 3D fishing game in which the glowing fish of a leaking power
plant's lakes are caught, cured and befriended, and each lake is seen to heal
as it is cleaned. `DESIGN.md` says what it is to be and the order it is built
in. TypeScript, Vite, and WebGPU through
[artshape-render](https://github.com/onion2k/artshape-render), with the
physics from [artshape-physics](https://github.com/onion2k/artshape-physics).
The README says what the game is; this file says how it is made. The house
rules in `~/.claude/CLAUDE.md` apply too. The page is the game's first
playable loop (`docs/game.md` is the plan it was built from): the Duck Pond,
sick and glowing at dawn, its water seen into (the lake is seen into as it is
cleaned, which is what the game is about), with fish swimming under it. A
fish can be cast for, hooked, played and landed (stages 1 and 2 of
`DESIGN.md`'s order of work), and **each fish put in the bucket is cured** and
let go in the pond, gold, where it never bites again, and clears the pond a
twelfth (stage 3, without the cabin), kept in the save as a count; the day runs
round from dawn (a first slice of stage 5). There is no
panel: the old lake lab's levers are the test API's now.

## The factory

This repo is a line that turns ideas into a browser game that loads fast,
draws fast and has no bugs, one feature at a time, and it holds those three
properties as numbers from the first commit. Every change goes down the same
line: a spec agreed, tests written and seen failing, the change built, every
gate run, the result looked at, the report made with evidence, then a
commit. The line does not skip a station, and it stops when a gate is red:
a red gate is fixed before anything else lands, never skipped with
`--no-verify` and never made green by moving its baseline.

The three properties, and what holds each:

- **Bug free.** Every rule that must always hold is in `src/invariants.ts`,
  and the fuzzer hunts for it. Every bug found becomes a test that would
  have caught it and, where it is a rule, an invariant; there is no list of
  known issues, because a bug found is fixed before the next feature. The
  same seed gives the same game, so every failure can be played again.
- **Loads fast.** Boot time and the gzipped download are measured by
  `npm run perf` in headless Chromium and held to a budget and a baseline.
- **Draws fast.** A frame's cost at the standard view is measured by the
  same gate, and a step of the lake's own by `npm run bench`. A feature that cannot fit
  the budget gets a rung the game steps down to on a slower machine, not a
  pass.

## Budgets

Numbers, held by gates, on this machine at 1280×800:

| Property                                             | Budget                         | Held by   |
| ---------------------------------------------------- | ------------------------------ | --------- |
| Boot, page start to the frame loop running           | 3000 ms                        | `perf`    |
| Download, scripts and styles gzipped                 | 400 kB; baseline to the byte   | `perf`    |
| A frame drawn, the least of 24 at the standard scene | 8 ms                           | `perf`    |
| A frame of the water, day and night                  | 8 ms                           | `perf`    |
| A step of the lake, against the reference arithmetic | baseline ± 15%                 | `bench`   |
| Game minutes for the angler to land three fish       | baseline ± 20%, both ways      | `pace`    |
| Fights landed and their length, by speed, size, gear | baseline, every cell exactly   | `balance` |
| The scenery download, `public/scenery` gzipped       | 900 kB; baseline to the byte   | `perf`    |
| Anything kept: fish, save bytes, heap                | ceilings in `scripts/leaks.ts` | `leaks`   |

The standard scene is `STANDARD` in `smoke/game.ts`: the water half
cleaned, by day, from the shore. The pace gate's angler (`src/angler.ts`)
casts toward the middle, strikes on the dip and plays the fight's bar a
quarter of a second late (`careful`, which the fuzzer and bench play by too);
`scripts/pace.ts` says how its tolerance was measured.

A budget is what the game may cost at all; a baseline is what it cost at
the last commit, held both ways, so a step toward a budget is noticed as
much as a step over it. The perf tolerances are the measured wobble of a
headless boot and a GPU frame, and say so in `smoke/judging.ts`. The
downloads do not wobble (`sceneryBytes` is every file in `dist/scenery`,
gzipped), so they are held to the byte: a change that adds to one writes the
perf baseline again and says by how much, and one that should not have is
looked into.

## Commands

    npm run dev            the game at http://localhost:5204
    npm run dev:phone      the same over HTTPS on the LAN, for a real phone (its motion sensors need a secure page)
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook; ~10 s)
    npm run check          all of it: check:quick, fuzz, determinism, leaks, bench, pace, smoke with perf and look (~1.5 min)
    npm test               unit tests (Vitest, test/)
    npm run fuzz           the game played at random, rules checked; -- --seed N plays one failure again
    npm run determinism    the same seed played twice, hashed, to catch chance not from the seed
    npm run leaks          an hour of play, watching what must stay bounded (10 min of it in check)
    npm run bench          a step of the lake held to scripts/bench-baseline.json, both ways
    npm run pace:check     the angler's minutes to land three fish, held to scripts/pace-baseline.json
    npm run balance        the real line at four reaction speeds, three sizes and each gear level, held to scripts/balance-baseline.json
    npm run perf           boot, frame and download held to smoke/perf-baseline.json and the budget
    npm run smoke          the game in headless Chromium on the real GPU (Playwright, smoke/)
    npm run look           the scenes held to the pictures in smoke/screens, to the pixel
    npm run film -- --scene <name> --seconds <n>  a scene filmed a stepped frame at a time, for looking at, not a gate
    npm run pair           two headless browsers paired over the real Nostr relays, with the figures: a tool, not a gate, since it needs the network
    npm run kit -- <dir>   a folder of .glb into public/scenery (see below)
    npm run kit:prune -- <kind> ...  models of those kinds out of public/scenery, no GLBs needed

A unit test is allowed thirty seconds, and `vitest.config.ts` says why: the
limit is there to catch a test that never ends, and how fast the game steps
is the bench's to hold.

`--update` on `bench`, `npm run perf:update` and `npm run
look:update` write a baseline again. Only through `/gate-moved`, only for a
change meant to move it, and the commit says why. Look at every picture.
The bench writes its baseline from two readings, and only where they agree:
a baseline written while the machine is at other work fails every run after
it.

The banks' scenery is Quaternius's Stylized Nature MegaKit (CC0), from
poly.pizza. Its GLBs are not committed: `npm run kit` reads a folder of them,
checks each against the sha256 in `scripts/kit-sources.json`, and writes
`public/scenery/` (generated, never edited, and in `.prettierignore`). Cards
take face normals by default (`--card-normals=face|kit|turned`), positions
and normals are float16 and indices uint16. Run it again to change the kit.
The game no longer uses the kit's trees and pines (the lake's trees are the
package's low-poly ones), so they were taken out with `npm run kit:prune --
tree pine`, which reads the committed `public/scenery` files, drops every model
of the kinds named (and the masks only they used, if they are the last ones, so
no layer moves), and writes them again, byte for byte the same every time from
the same files; `kit-sources.json` lost the ten models too, so a full run
agrees. The kit now gives the pebbles and the bank's clumps only.

## How the code is laid out

- `src/game.ts` is the lake without the picture: its clock (`timeOfDay` runs on
  by game time, `CLOCK` in `lake.ts`: a day is 720 s, an estimate, from dawn,
  to midnight, held to [0, 1)), its fish, and the contamination, a step
  at a time. It knows nothing of the renderer or the page. `src/fish.ts` is the
  school.
- **The day's end** (`docs/day.md`): `Game.place` is `pond`, `yawning` or
  `cabin`, and `Game.day` counts from 1. A step that carries the clock past
  midnight (`pastMidnight` in `src/night.ts`, a wrap of more than half a day, so
  the lever is never one) starts the yawn, unless a fish is hooked or landed:
  then the clock runs on and the yawn comes on the first step after the fight
  is settled and the fish stowed. The yawn reels the lure in (a coming or
  nibbling fish lets go) and fades the screen over `NIGHT.fadeOut` of stepped
  time; at its end the game wakes (`GameEvents.woke`): the day goes up and is
  saved, the clock is dawn, a heal still running is finished, the splashes are
  emptied, and the player is in the cabin, where `step` moves only the fade in
  (`NIGHT.fadeIn`) and `t`, the clock, the fish, the lure and the water hold.
  `Game.out` goes down to the pond; `Game.sleep` is bed early, from the pond or
  the cabin, refused with a fish hooked or landed. `cast`, `drop` and `dropNear`
  are refused away from the pond. `src/nightview.ts` is the page's side: the
  fade (`#night`, its opacity `game.fade()`, written on change, never a CSS
  transition, so a picture holds), the yawn's words, the morning line and the
  "Down to the pond" button (Enter too), and "Go to bed" in the ⋯ menu, greyed
  mid-fight; `nightWords` is the words as a pure function. Away from the pond
  the page refuses casting, striking, reeling, aiming, pebbles, the mode and
  `game.view(name)` and `game.time(name)`, and a paired phone's gestures are
  ignored, not refused. The angler, the fuzzer, the phone monkey and the leak
  run go down to the pond when they wake; the bench's long scenario holds its
  clock short of midnight with the lever (`heldToDay` in `scripts/benching.ts`),
  since it times the lake, not the night; determinism plays each seed from dawn
  and from just before midnight. `game.day()`, `place()`, `fade()`, `sleep()`
  and `out()` are the test API. **The cabin by day** (`docs/cabin-by-day.md`): `Game.enter()` walks the player in
  without ending the day (refused mid-fight, yawning, leaving, in the cabin, or at a lake without one): the lure
  reeled in, the place the cabin with the fade in and the clock, the day, the fish and the heal held where they are,
  the save written so a load lands there at that time (the cabin's clock holds at any time: the old rule that it is
  dawn is gone; a wake still sets dawn itself), and `out()` resumes the same time. "Go to the cabin" in the ⋯ menu
  (`enterCabin()` in `main.ts`; from a lake without a cabin a journey home into it, `travel(id, 'cabin')`) and a tap
  on the cabin from the shore in look mode (`cabinHit`, the ray against the cabin's box; a tap on the water still
  drops a pebble) are the ways in; the cabin's line reads Morning, Afternoon, Evening or Night by the clock's look;
  `game.enter()` and `game.cabinOnScreen()` are the API, and the fuzzer goes in at random.
- **The seasons** (`docs/seasons.md`): the year is `SEASONS` in `lake.ts`, summer first (so the lake as drawn on day 1
  is summer's, and no picture moved), then autumn, winter and spring, `CALENDAR.seasonDays` (14) each; `seasonOf(day)`
  in `src/calendar.ts` is pure, and the morning line names the season from autumn on. Nothing is saved: the season is
  the day's. `SEASON_DRESSING` in `lake.ts` is each season's content: the palette keys it moves (`seasonPalette` in
  `src/season.ts`, the grass ground derived from the blades), `grassHeight`, the sky's tint and mix and `ambient`
  (`timesFor(season)` in `look.ts`, the baked cubes keyed `season:name`, four at a time), the water's `near`, `crest`
  and sparkle (`style.clear(..., season)`), `breeze` (the grass wind's strength), `waves` (an amplitude scale,
  `wavesFor`, which the bobber's surface is rebuilt from), `falling` (the particles of leaves, snow or blossom:
  `fallingEmits` in `src/falling.ts`, a ring of `FALLING.emitters` over the lake, emitted on a cadence from `simulate`
  at the pond only, carried by `setWind`; autumn's are the renderer's `leaf` shape and spring's its `petal`
  (`Falling.shape`, from artshape-render v0.49.0, each tumbling from its own hash), winter's the disc; the pool stays `PARTICLE_POOL`, 2048, since a bigger ring moves the slot each
  droplet's chance is drawn from and so nineteen pictures; the window of a fall and the falls' mist over the longest
  life is held under it in `leaks`) and `mist` (the renderer's fog, `mistFor`, low over `WATER_LEVEL` at autumn dawn
  and winter dawn and night, about 0.2 ms, off on the lean rung with the grass; the flakes fall on lean too). The page
  dresses the lake in `dress(season)` (`main.ts`): the static set built again with the season's palette (the
  colour-free meshes memoised per kit in `Scene.static`, so about 5 ms) and the grass handed over (about 30 ms), at
  boot and at a wake into a new season, in the cabin, then that season's four looks baked (about 33 ms); a wake inside
  a season hands nothing over. `game.season()` reads it all (`name`, `dressed`, `statics`, `dressMs`, `bakeMs`,
  `falling`, `mist`). The calendar's rows carry a band each in the season's colour (`BAND_PARTS` in `cabinroom.ts`).
- **The moon** (`docs/moon.md`): an eight-day round from the day, `MOON` in `lake.ts` (`days` 8, `full` 0, `new` 4,
  `darkest` 0.35, the eight names, the disc's `distance`, `radius` and `direction`), day 1 a full moon by the user's
  choice so tonight's look as drawn is the full moon's; `moonOf(day)`, `moonName`, `moonLight` (1 at full, `darkest`
  at new, a cosine between), `nextFull` and `nextNew` in `src/calendar.ts`, pure; the year's 56 days hold seven
  rounds, so the calendar's full and new moons are fixed squares (`moonFull` and `moonNew`, static parts of the room).
  `timesFor(season, phase)` in `look.ts` scales the night's ambient, moonlight, zenith, horizon and glitter by
  `moonLight` and never the exposure, since the fish's glow is added before the exposure and must read brighter
  against a darker night; the cube stays keyed `season:time`. The night's light is lowered to 25° (`TIMES.night.sun`)
  and the disc has a direction of its own at 2.7° (`MOON.direction`), since the shore's lens sees no higher: the moon
  rises over the ridge in the frame's corner. `MoonDraw` (`src/moondraw.ts`) is two discs far along that direction,
  the moon unlit through `FLOW_GLOW` in `MOON_COLOUR` and a shadow in the night sky's colour slid across it by the
  phase (`shadowOffset`), scaled to nothing except at night, handed over by `main.ts` only when the look's name, the
  phase or the season changes (`game.moon()` reads `phase`, `name`, `light`, `nextFull`, `nextNew`, `shown`,
  `handovers`). The morning line says "Full moon tonight." or "New moon tonight.". **Sleeping through:**
  `Game.sleepThrough(nights)` (1 to `MOON.days`, refused as bed is) yawns and wakes `nights` days on, one persist,
  at home; "Sleep through…" in the ⋯ menu opens `#sleep` (`sleepWords` in `src/sleep/page.ts`: the marked nights
  ahead in order of distance, the weather's and the festivals' later), a page that stops the clock;
  `game.openSleep(open)` and `game.sleepThrough(n)` are the API, and the fuzzer sleeps through at random.
- **The cabin's room** (`src/cabinroom.ts`): the interior the player wakes in,
  built once at boot into the static set from `CABIN_ROOM` in `lake.ts` (walls
  inset from the cabin's, facing in, a floor, a bed, the window's frame, the
  door and a lamp, and the furniture in `CABIN_ROOM.furniture`: a table, chair
  and mug under the window, a stove with its pipe on the end wall, a shelf of
  books and a jar, a rug, a chest, a picture and a coat on a peg, `FURNITURE`
  naming each piece's parts), painted with the wood's set, every vertex inside
  the cabin's outer walls so no outside picture changes, each piece on the floor
  or hung on a wall, clear of the camera's eye, the door and the window, and all
  of it under 1500 triangles, held by `test/cabinroom.test.ts`. **The wall calendar** (`docs/time.md`) hangs on the end wall beside the stove, 1.3 wide (`across`, not
  `along`: `onEnd` in `cabinroom.ts` is `onWall`'s counterpart), where it reads from the pillow at a slant and is out
  of the phone's tall framing, whose lens could not hold it with the window and the door; the room test's window rule
  guards the opening and its frame only: a sheet and bar in the static set (`calendarSheet`, `calendarBar`), and the year's `CALENDAR.days`
  (56, four rows of fourteen) squares as two moving parts, `calendarGone` and `calendarToday`, from the pure
  `calendarMarks(day)` in `src/calendar.ts`, drawn by `CalendarDraw` (`src/calendardraw.ts`, matrices sized once, a
  square not shown scaled to nothing) and handed over by `main.ts` only when `game.day` changes; `game.calendar()`
  reads what was handed over. The `cabin` view (and `cabinTall`
  for a tall screen, through `framingFor`) looks from the pillow at the window
  and the door with the orbit off, and the lamp is one of the renderer's point
  lights, lit only while `game.place` is `cabin`.
- **The cure:** `Game.stow` counts a fish cured (`progress.save.cured`, saved
  at once, told as `GameEvents.cured`) and sets the contamination to the lesser
  of where it is and `contaminationAfter(cured)`, `1 - cured / CURE.toClean`
  floored at 0 (`CURE.toClean` is 12, an estimate), so nothing but the cure
  lowers it and nothing but `setContamination` (the lever of the tests and the
  fuzzer's start, counted in `game.levers`) raises it. The save keeps the count,
  never the contamination, so a retuned step is applied to a save already
  written; the invariants hold that it never rises by any other road and that
  the count is a whole number. **The pond holds as many fish as it takes to
  clean it** (`FISH_COUNT`, which `CURE.toClean` reads), and a cured fish is
  not replaced: `School.cured` flags it, `stow` lets it go `RELEASE.distance`
  out from the angler with a splash, the bite passes over it before drawing its
  chance (the bait is one only an uncured fish takes), and a load cures the
  first `min(save.cured, FISH_COUNT)`. When all are cured (`pondClean`) nothing
  bites and the cast line says so (`castWords`, `CLEAN_WORDS`). `fishdraw.ts`
  draws a cured fish gold (`PALETTE.cured`, `curedFin`, `curedGlow`, at
  `CURED_GLOW`) through per-fish `materials`, and the page hands the fish's
  groups over again when the count cured changes (`game.drawnCured()`). The
  invariants hold the count cured to the save and a cured fish off the bite;
  the fuzzer starts each seed from a save part cured, so it reaches the clean
  pond. `docs/cured.md` is the plan it was built from. **The water heals
  gradually** (`docs/heal.md`): `Game.waterDirt` is the contamination the water
  shows, easing to the truth over `HEAL.seconds` of game time after a cure
  (`healToward` in `src/heal.ts`, `1 - (1 - u)^3`, so about half in the first
  fifth), from wherever it is, so cures close together never jump; paused it
  holds, and the lever and a load set it at once. The fight reads the truth.
  The page draws the water at `waterDirt` rounded to `HEAL.step` (`waterShown`
  in `main.ts`) and hands it over only when that moves, about forty times a
  cure (`game.waterHandovers()` counts them), since a handover makes buffers
  and costs about half a millisecond; the gauge steps at the cure.
- **The kinds, the drums and the journal** (`docs/journal.md`): the pond's twelve fish are three kinds, `KINDS` in
  `lake.ts` (sunny bream 0.2 to 1 kg in the shallows, glowing perch 0.3 to 2.4 kg in the middle, pike 1.5 to 5 kg near
  the bed: each with a weight range, a `keeps` band the fish's one depth draw is put into, a body scale and a glow),
  and `FISH_KINDS` gives each slot's kind, 4/5/3, fixed so the seed gives the same school. `School.kind` is a
  `Uint8Array`; `fill` draws what it did, so the chance moves nowhere. A fish comes to the lure only within
  `FISHING.band` (1.5) of its own depth, so the sink is the choice; the weight is drawn from the kind's range and
  heft is its place in it, so `fightFor` and the balance tool are unchanged. **Two drums of waste** lie on the bed
  (`DRUMS`, a `BedFinds` in `src/bedfinds.ts`: places from a seed of their own, never the game's chance). A lure lying on the bed within
  `DRUMS.reach` may snag one, a heavy dip, and a strike hooks it; `drumFight` in `fight.ts` is its profile (no darts,
  never slips, the reel held fills the meter), and a tap on the landed card is `Game.haul`, which keeps `save.drums`,
  tells `GameEvents.hauled` and lowers the contamination to `contaminationAfter(cured, drums)`:
  `1 - (cured + drums x worth) / (FISH_COUNT + DRUMS.count x worth)`, the one place it is worked out. The pond is
  clean (`pondClean`) when every fish is cured and every drum hauled; a drum left on the bed can still be snagged when
  all the fish are cured. **The journal** is `Save.journal` (`{ caught, best, first }` by kind id, written at each stow,
  read field by field in `progress.ts`), its page's words are the pure `journalWords` in `src/journal.ts`, and it opens
  from the ⋯ menu (`game.openJournal()`) and stops the game's step while open, as does every page of the menu: the
  open ⋯ list, Start again and the pairing card (`pagesOpen()` in `main.ts`, the one gate on `simulate`, the keys,
  the Cast button and every gesture; `game.pagesOpen()` reads it; a held reel is let go as a page opens). A load cures, of each kind, as many
  as the journal says were caught and then the rest in slot order, as an old save does. `fishdraw.ts` draws each slot
  at its kind's scale and glow, `drumdraw.ts` the drums, and `game.fish()`, `game.drums()` and `game.journal()` read
  them. The fuzzer starts each seed with drums and a journal from a stream of its own and casts to lie by a drum.
  **Six junk treasures** (`docs/junk.md`) lie on the bed as well, a second `BedFinds` (`TREASURES` in `lake.ts`: an old
  lure, a Sunny Atom plush and lunchbox, a "Safety First!" badge, a message bottle and the rubber duck, each with its id,
  name, card line, weight, size and place on the shelves, the bottle a note) placed from a seed of its own clear of the
  drums (`places(spec, world, avoid)`) in a band nearer than the pace angler's lure lies. `Bite.step` takes both sets and
  snags the nearer unfound thing in reach by one draw (a treasure at the drum's rate and reach), so the quarry
  (`Bite.fish`, `drum`, `treasure`) is at most one, and a treasure's dip is lighter (`TREASURES.dip`). `treasureFight`
  is the drum's profile at three times the fill; the landed card (`cardWords({ treasure })`) names it, says its line
  and the bottle's note; a tap is `Game.keep`, which adds its id to `save.found` (read in `progress.ts`: known, once
  each, held to six), tells `GameEvents.found` and cleans nothing. `contaminationAfter` and `pondClean` read cures and
  drums alone, and a treasure can be snagged in a clean pond (the fuzzer counts fish bites there, and a treasure
  snag apart). `src/treasuredraw.ts` draws each model (a few primitives, painted, under sixty triangles) once, at
  `TREASURES.bedScale` on the bed and `shelfScale` on its shelf in the cabin (`CABIN_ROOM.furniture` has a second
  shelf, `shelfUpper`), one placement a part that moves with the count found, handed over only when it changes; a hauled
  drum stands on the bank by the cabin (`bankSpot`, `DrumDraw.bank`). `journalWords` lists the treasures found (the
  bottle's note under its name) under "Found in the pond". `game.treasures()`, `keep()` and `fishTo('landed',
'<id>')` are the test API.
- **The line as a rope** (`docs/boat.md`, C0): `src/rope.ts` is the fishing line, `ROPE.points` (24) pinned at the rod's
  tip and the line's end, stepped at the end of `Game.step` (a ready line is laid straight once and not stepped), its
  length the chord plus slack by the fight's tension; `Game.lineStart` and `lineEnd` are the ends (`lineEnds`, the figures
  `LINE_DRAW` in `lake.ts`, the bobber's height from `Game.surface`, which the page hands the swell), `bentTip` in
  `cast.ts` the tip under tension, and `castdraw.ts` draws the segments and decides nothing; `game.rope()` reads the points.
- `src/main.ts` is the page. It turns what the game says into the water (when
  the contamination changes: `showWater`), the light (when the clock comes to
  the next look: `showLight`, each frame comparing `nearestTime` to the look's
  name and writing the uniforms, the four environments all baked once right
  after the first frame is up, `bakeLooks`, about 35 ms that are not the boot's)
  and the camera (when a view is picked: `setView`, the Shore view taking the
  `phone` framing on a screen taller than wide, `framingFor` in `lake.ts`, and
  again on a turn of the screen in cast mode), the page's mode into what a drag
  does, and draws the frame. There is no game logic here. The look steps, it
  does not fade; a blended sky needs two environments mixed in the renderer, a
  package change.
- `src/pondview.ts` is the pond on the screen, as `fightview.ts` is the fight:
  the glow gauge (the lake's name, `LAKE_NAME`, and a bar that empties as it
  cleans), the welcome line (until the first cast, and never to a player who has
  cured a fish), the "Cured!" line for `HEARD_FOR` of game time and the "clean"
  line at the twelfth. `pondWords` is the words as a pure function, tested without
  a page; the view writes the page only where they change.
- `src/debug.ts` is `window.game`, the test API: the clock, the fish, and the
  levers the lab's panel used to hold (`dirt`, `time`, `view`, `caustics`,
  `paint`; `time()` and `view()` with no name say which look and view the page
  is at, `clock(at)` puts the clock somewhere without lighting the page,
  `looksBaked()` and `drawnDirt()` read the page's own state), each resolving
  once its change is ready to draw, and the page's `mode`. `src/invariants.ts`
  lists the rules that must always hold.
- **The lakes** (`docs/lakes.md`): a lake is a `Lake` object (`src/lakes/lake.ts`, the interface): its id and
  name, its geometry (`shoreRadius`, `inside`, `inShore`, `inward`, `bedDepth`, `ground`, `bareGround`,
  `groundUnder`), its boulders, its dressing (`cliff` with the falls, `jetty` and `cabin` with the room, each or
  `null`; the scenery's counts and seeds; the shadow box), its fishing (`fishCount`, `fishKinds`, the placement
  extents and margins, `angler`, `landAt`, `castReach`, the pace angler's `aim`, `waterPace`), its bed finds (the
  drums' and treasures' specs and the treasures' list), its `views`, its `surface` figures and its own cure
  arithmetic (`toClean`, `total`, `contaminationAfter`). The Duck Pond is `DUCK_POND` in `src/lakes/duckpond.ts`,
  `LAKES` in `src/lakes/index.ts` is the registry by id and `HOME` the pond, where the cabin is; `lakeNamed(id)`
  gives the home for an unknown id. `src/lake.ts` holds the rules only (`CLOCK`, `FIGHT`, `FISHING`, `SWIM`,
  `GEAR`, `KINDS` the dictionary of kinds, `CALENDAR`, the seasons, the particles) and `src/rules.ts` the drums' and
  treasures' rule halves and `WATER_LEVEL`, which the lakes read. Every builder and reader takes the lake (`new
Scene(lake)`, `bankField(kind, lake)`, `shoreField(size, lake)`, `surface(lake)`, `fallsOf(lake)`,
  `cabinGroups(palette, lake)`, `roomGroups`, the draws, `School`, `Bite`, `Lure`, the cast, `checkInvariants`
  through `game.lake`, `new Game(progress, { lake })`, `new Progress(store, lake)`), and the memos that were the
  module's (`bedBands`, the surface, the boulders, the falls, the bed's places) are a `WeakMap` by lake, so a second
  lake moves nothing of the first. The page builds one lake at boot (`main.ts`); nothing in `src/` but `src/lakes/`
  names the Duck Pond. `test/lakes.test.ts` holds the pond's geometry to the bit by a snapshot taken before the
  move; `game.lake()` and `game.lakes()` read the lake and the registry. **The Reservoir** (`src/lakes/reservoir.ts`)
  is the second lake: an oval 1.6 times the pond across and 1.5 as deep, cut on the north by a dam (`src/dam.ts`,
  `damMesh(lake)`, a painted solid on the cliff's set the scene takes as a `dam` dressing, the ground rising behind
  its face), two boulders, no cliff, jetty or cabin, sixteen fish 5/7/4, three drums, no treasures yet, its own
  views, surface and cure. **Travel is a reload** (`docs/lakes.md`): `Game.travel(id)` (refused with a fish hooked
  or landed, while yawning or leaving, or for an unknown id; to the current lake it goes out from the cabin) reels
  in, writes `save.lake` and sets `place` `leaving`, a fade-out over `NIGHT.fadeOut` with the clock held, and
  `GameEvents.left` at its end has the page reload with the hidden-page write off; every page load fades in over
  `NIGHT.fadeIn` (`options.arrives`, set only by `main.ts`; `start()` in the smoke calls `game.arrived()` so no
  picture waits on it). The wake writes `save.lake` as the home, and the page reloads from a lake without a cabin
  before anything is drawn there, so the player always wakes in the cabin at the Duck Pond; the morning's button
  reads "Out to the <lake>" and "Somewhere else…" opens the lakes page. **The map** is the picture on the cabin's
  lake wall (`mapGeometry`, `mapWater` and `mapDam` static parts, `mapPin` a moving part in `src/mapdraw.ts`
  handed over when `save.lake` changes, `game.map()` reads it); a tap on it in the cabin view (`mapHit`, a ray to
  the paper's rectangle through `rayThrough` in `pick.ts`; `game.mapOnScreen()` gives its centre) opens **the lakes
  page** (`#lakes`, `lakesWords` in `src/lakes/page.ts`: each lake, "You are here", its glow in four bands, Go),
  which "Lakes" in the ⋯ menu opens too; it stops the clock as every page does and `game.openLakes(open)` is the
  API. The welcome line, the toasts and the journal's heading name the lake (`theLake` in `src/lakes/page.ts`). Content figures are the lake's: the
  shore's shape, the bed, the banks, the boulders, the fish count, and the named views. A boulder is a
  bit of bank in the water: `inside` is false within its waterline (a margin
  counted from it as from the shore), `ground` is its dome, and `bedDepth`
  shallows over its flank, so the fish, splashes, rings, casts and invariants
  keep off it through the paths they already use; `groundUnder` is the ground
  without them, which the bed's sheet is drawn from. The bed is coloured by its
  depth (`BED_SHALLOWS`): the sand (`PALETTE.sand`) in the shallows and out past
  the shore as a beach, the slate (`PALETTE.bed`) in the deep, and bands of a
  colour each between, since a group has one colour; `bedBands()` in `scene.ts`
  makes them once, on the one sheet's rings, and `game.scenery()` counts them. Colours live in
  `src/palette.ts`, the times of day and the toon look in `src/look.ts`.
- **The rocks:** `src/rocks.ts` makes the boulders and the cliff's lumps as
  faceted rock, once, from seeds of their own (never the game's chance, and
  one more rock moves no other): each is a lump cut by `lowpoly`, then
  `split` and `painted`, one mesh to a dome and to a lump, placed at a scale
  of one. `rockBudget` gives the ridgelines by world size (1, 2 or 3), `scene.ts`
  `static()` takes the groups from it, and `game.scenery()` counts their
  triangles. The paint sets (boulder chalk, wood, cliff) are in `look.ts`
  beside `TOY`, and `lookFor(time, paint)` is what the renderer is handed.
  The paint switch (`on`|`off`, `?paint=off`, `game.paint()`) draws
  the same rocks plain, to compare. The paint is not gated by the rung. The
  cabin and jetty timber take the wood's set. `docs/painted.md` is the plan
  they were built from.
- **The banks:** `src/scenery.ts` reads `public/scenery` (`readManifest`,
  `readKit`, `loadScenery`, refusing what it does not know by name) before
  `ready`, and hands the card masks to `renderer.setCardImages`.
  `Scene.static(kit)` in `src/scene.ts` places the kit's pebbles and clumps and
  the trees from a dressing seed of its own, so the game's seed does not move
  them; the bed, weed and boulders are as they were, and with no kit the old
  hand-made banks are built. Placement keeps off the water and the near south
  bank, and no top passes `SHADOW_BOX`. `SCENERY` in `lake.ts` is the content
  (counts, scales, layers); the roles map to the palette in `scenery.ts`.
  `game.scenery()` counts what was handed over. **The trees** are not the kit's
  but the package's low-poly generators (`artshape-render/parts/lowpoly`, as
  ooergolf's): `src/trees.ts` makes four `broadleaf` and three `conifer`
  variants once at a height of one, `treeFor(u)` picks one from a placement's
  own draw (never its place in a list, so one more tree moves no other), and
  `TREE_COLOUR` colours each part by its name (`trunk`, `leaves`, `crown`, the
  canopy's lighter top; the conifer's leaves are `PALETTE.pine`). A tree's
  matrix scales a variant to its height, `SCENERY.trees` (broadleaf 16 to 29,
  conifer 17 to 32, the kit's true-size heights, held under `SHADOW_BOX` which
  reaches 40), and a group is made per variant and part. A tree takes three
  draws of the stream, as the kit's did, so the pebbles and clumps stay where
  they were; `SCENERY.woodland` adds 210 more in a band of shore radii (further
  out on the south bank), drawn last. A tree is 50 to 250 triangles against the
  kit's three to six thousand.
- **The grass:** `src/grass.ts` is the banks' long grass as the renderer grows
  it (`setGrass`, `wind`): the `LUSH` kind (colours in `PALETTE.bladeBase` and
  `bladeTip`), `bankField()` (half-unit cells over the banks to the shadow
  box; grass where it is dry, 0.9 back from the waterline and over 4 from the
  angler, heights from `groundUnder`), `GRASS_OPTIONS` (ooergolf's rings) and
  `BREEZE`. `PALETTE.grass`, the ground under the blades, is held by a test to
  `grassGround(LUSH)`. The renderer's clock runs at the water's pace, so the
  breeze is slow; there is no second clock. `game.grass()` reads the blades
  drawn near and far back from the GPU.
- **The rung:** the page is on `full` (the grass) or `lean` (no grass),
  `src/rung.ts`; the woodland stands on both, since measured it costs about
  0.1 ms (the grass about 0.7, which `npm run perf` tells and does not hold). At boot, unless `?rung=full|lean` asks, the
  governor measures the frame as `measureFrame` does (the least of five
  samples, half a second) and steps to lean when it is over
  `RUNG_DOWN_MS` (8, the budget), once and never again; `game.rung()` reads and
  sets it, resolving when applied. The smoke's `start` puts the page on `full`
  unless it is asked for `rung: 'auto'`, so a picture or a frame never depends
  on the machine's mood.
- **The water** is drawn one way, the water seen into, in `src/water/`: a
  file and a line in `STYLES` (`styles.ts`), so another would be a file and a
  line. It is `clear.ts`, the renderer's clear water (from v0.29.0), whose
  `look.clear` follows the contamination, the caustics setting and the time
  of day, with its finish in `CLEAR` and `CLEAR_WAVES`: its `waves` are the
  style's own, which the bobber rides through
  `src/water/swell.ts`, and its foam lines come from `src/shorefield.ts`, the
  distance to the shore or a boulder, made once at boot. The surface's mesh is `src/water/surface.ts`: as coarse
  as it was over most of the lake and fine within `SURFACE.near` of the Shore
  view's camera, so a short swell is drawn travelling there (`SURFACE` in
  `lake.ts`, its triangles counted by `game.scenery()` under a ceiling). `src/fishdraw.ts`
  draws each fish glowing under the water (`FLOW_GLOW`), which the
  water shows; there is no glow drawn on the surface.
- **The fish's bodies:** the renderer has no skinning, so a fish is a chain of
  rigid segments (head, two body, stalk, then the tail and dorsal fins), a
  group a part (`FISH_PARTS`), laid along a spine. `src/swim.ts` poses the
  spine (pure sums): a carangiform wave growing to the tail, an arc into the
  turn, a pitch as it rises, each joint a segment's length from the last, and
  lifted or held clear of a bed that rises under the body. The school keeps the
  stroke (`phase`, `turn`, `rise`, `pace`, `vigour`) in `School.stroke`, run once
  at the end of `Game.step` from how each fish actually moved, so the wander,
  the bite and the fight all swim it; it draws no chance. A hooked fish pulling
  beats harder; a landed one hangs nose up and flaps by the game's clock. The
  figures are `SWIM` in `lake.ts`, the chunky toy and subtle stroke chosen from a
  mock; `game.fishPose(i)` reads the spine the last frame drew, and the
  invariants hold every joint in the water.
- **The cast:** `src/cast.ts` is its flight as sums (an arc from the rod's tip
  that lands where it first meets the water or the bank), shared by the
  preview, so the preview is the flight to the bit; `src/lure.ts` is the lure
  (ready, flying, sinking under its bobber, lying on the bank), stepped by
  `Game.step` and cast by `Game.cast` and `Game.reelIn`; `src/aim.ts` is
  ooergolf's drag back as a cast; `src/castdraw.ts` draws the rod, line,
  bobber, lure and preview. Its figures are first guesses in `CAST` and
  `ANGLER` (`lake.ts`). The player is the angler and is not drawn.
- **The page's mode, look or cast** (`src/mode.ts`: `nextMode` is a pure
  function from a mode and an event to the next mode and what the camera does;
  `main.ts` does it). It starts in look: the orbit is on in every view,
  Shore too, a drag turns the camera and a tap drops a pebble. Cast (the
  button, always on the screen and saying what it does next, or the C key,
  not over the page's buttons) puts the camera at the Shore view, the view
  becoming `shore`, turns the orbit off, and a drag back aims, letting
  go casts and a tap with the lure sinking strikes. Picking a view, through
  `game.view`, is look mode again, and puts the camera there even if
  it is the view already. The mode is the page's and not a setting: it is not
  in the address, and `game.mode()` reads and sets it. The Game's `cast`,
  `aim` and the fuzzer do not go through it.
- **The fishing:** `src/bite.ts` is a fish and the lure (none, coming,
  nibbling, biting, hooked, landed): one fish at a time, which the school's
  wander leaves alone (`School.held`) while `steerTo` swims it, the strike's
  window, the twitch, the wary fish, and a coming fish that gives up after
  `comeLongest` (steering has no way round a boulder). `src/line.ts` is the
  fight, kept in the zone (`docs/fight.md`): the fish darts on a bar, the reel
  held pushes the zone up it and let go it falls, and a meter fills while
  the fish is in the zone and drains while out, full landed and empty
  slipped; the line out follows the meter and its tension is how far the
  fish is out of the zone. Each fish fights by its size and a **temper** drawn on
  the hook (calm, steady, feisty): `fightFor(heft, temper, gear)` in
  `src/fight.ts` gives every figure the `Line` plays by, from `SIZE`, `TEMPERS`
  and `FIGHT` in `lake.ts`, so the line knows nothing of either and the balance
  tool plays the very same fights; the fish's lowest dart stands above a resting
  zone, so a hand that never holds lands nothing. Curing brings **gifts**
  (`GEAR`, at 2, 4, 6, 8 and 10 cures: a stronger line, a faster reel, a longer
  rod, a bigger bobber, tastier bait), worked out from the count by `gearFor` (the count summed over every lake,
  `progress.curedTotal()`, so a journey takes no gift back), so the save holds nothing new; each does what its toast says at a size a player
  feels, as the user chose over figures tuned to the tool's hand. `careful`
  centres on the zone's own width. `docs/fight2.md` is the plan, with every
  target and what was changed with the user. A sick lake's fish dart more
  often. `Game` wires them (`strike`, `reel`, `stow`, the fish
  steered along the line, `GameEvents` nibbled to landed); the figures are
  `FISHING`, `FIGHT` and `KINDS` in `lake.ts`, tuned on measured seeds.
  `castdraw.ts` bends the rod, colours the line by the tension and hangs a
  landed fish; `src/fightview.ts` is the bar, the Strike/Reel button, the
  card and the bucket. A tap strikes and a hold reels in cast mode;
  space and the button do in any view and mode.
- **Splashes:** `src/splash.ts` is the pool (twelve, the oldest replaced),
  filled by `Game.drop` and `Game.dropNear`, which refuse what is off the
  water and tell of a splash through `GameEvents.splashed`. Their picture is
  the water's own: `src/ripples.ts` (`rippleData`, pure) writes each live
  splash as x, y, age and size into an array sized once, `main.ts` hands it
  to `renderer.setRings` every frame, and the renderer's clear water (from
  v0.44.0) carries each out as a train of ripples in its normal, bending the
  bed, the light and the mirror, never the height; the ring's figures are
  `CLEAR.ring*` in `src/water/clear.ts` and nothing is painted on the water
  (`docs/splash.md`). `game.ripples()` reads what the last frame handed over.
  `splashBurst` in `src/bursts.ts` is the droplets, emitted on the event.
  `src/pick.ts` turns a tap on the screen into the point on the water.
- **The phone:** a phone paired by a QR code is the rod (`docs/phone.md`). `src/gesture.ts` is every way of playing
  as pure rules (`Gesture.handle` from `down`, `move`, `up`, `tilt`, `flick`, `gone` and the key, button and blur,
  each tagged with its source, to calls on a `GestureTarget`); the reel is held while any source holds it, and
  `main.ts` only turns DOM events into its events and does the page's own (capture, camera, picking). `src/flick.ts`
  makes a flick of a run of acceleration samples, on the phone. `src/phone/`: `protocol.ts` the versioned messages
  each way (refusing unknown, NaN, extra and wrong-version ones by name), `link.ts` a `Link` (`trysteroLink`, WebRTC
  through public Nostr relays, and `localLink` over `BroadcastChannel`, chosen by `?phonelink=local`, which every test
  uses so none depends on a relay), `linkname.ts` that address key, `session.ts` the screen's side of **one phone**
  (the first peer; a second is told `busy` and ignored; a refusal is counted and changes nothing), `pairing.ts` the
  QR overlay and the room, `word.ts` the phone's large word, and `page.ts` with `phone.html` the phone's own page (a
  pad, the sensors behind Connect, the word, the fight's bar, the buzz). Pairing is **lazy**: Trystero and the QR
  library are fetched when Pair a phone, behind the corner's More button (`#menu`, ⋯), is first pressed, never to boot, and the room and key are from `crypto`, not
  the game's chance. `PHONE` in `lake.ts` (tilt range, aim spread, flick figures, the state rate) are first guesses,
  tuned on a real phone. `game.phone()` reads the pairing and `game.pair({ room, key })` opens the overlay on a fixed
  one so a picture holds still. A gesture from the phone in look mode goes to cast at the Shore view; nothing is
  saved. `scripts/phonemonkey.ts` plays a phone at random for the fuzzer and a busy room of phones for the leak run.
- **The screen's layout** (`docs/layout.md`): the overlays are placed by the screen's shape, never its width.
  `layoutFor(width, height)` in `src/layout.ts` is the one rule (portrait taller than wide; sideways no more than
  `SIDEWAYS_MAX_HEIGHT`, 500, tall; desk the rest), the page sets it on `<html data-layout>` and the CSS in
  `index.html` keys off that. Portrait keeps the fight on the grass at the foot (the bar bottom left, its height a
  clamp on the screen's, Reel bottom right, the words above it, the card a strip); sideways keeps one slim top row
  and the bar thin on the left; desk is the base rules. `(hover: none)` hides the keyboard hint. The phone's pictures
  are taken on the user's Pixel 7a, 412×915. `smoke/layout.spec.ts` holds eight screens by eight moments: no two
  overlays meet, none covers the bobber, the line's end or the hooked fish (`game.onScreen()`), all inside the
  screen; `game.layout()` reads which is in force. **Start again** is behind the ⋯ menu: a question first, Keep
  playing focused, then `Progress.reset()` and a reload; `game.startAgain()` opens it but cannot confirm it.
- `src/settings.ts` reads the address, which holds only the viewer's and the
  tests' switches, `caustics` and `paint` (beside `seed`, `paused` and `rung`,
  read where they are used), and refuses what it does not know by name; it is
  never written back, and an old link with `dirt=`, `time=` or `view=` still
  opens the game, unread. The save lives in `progress.ts` and holds `lake`, the id of the lake the player was at
  (an unknown id is the home's), and `lakes`, an entry a lake (`LakeSave`, `progress.entry(id)`, a fresh one for a
  lake without; an entry under an unknown id dropped; a flat save from before the lakes read as the home's entry;
  `new Progress(store, LAKES)` takes the registry to read each against), each with the count
  cured (default 0; a count that is not a non-negative whole number is taken for
  none), the drums hauled (default 0, held to `DRUMS.count`), the journal (default `{}`) and the finds; and, the angler's, the day (default 1; anything but a safe whole number of 1 or more is
  day 1), and **the time and the place** (`docs/time.md`): `time`, the clock as a fraction of the day (default dawn,
  `CLOCK.startsAt`; anything not a finite number in [0, 1) is dawn) and `place`, `pond` or `cabin` (anything else is
  the pond; a cabin save is at dawn whatever it says), so a load opens where the player was. `Game.persist` writes
  both unless yawning (the yawn's clock is past midnight with the day not yet up, so a load lands before it); the
  clock is written every `CLOCK.saveEvery` (10 s) of stepped time at the pond, on `out`, and by the page on
  `visibilitychange` hidden and `pagehide` (`keep` in `main.ts`, off once Start again has wiped the save). A load
  into the cabin gets the pillow camera from the page after `ready`, since `woke` does not fire. `test/saves/` has a
  file for each shape. Chance comes from `random.ts`, handed in.
- **The boat** (`docs/boat.md`, C2): `src/boat.ts` is the row's sums (`rowPath`, `rowAt`, `seatOf`, `anglerAboard`,
  `landingAboard`) and `Game.boat` its state; `Game.row(x, y)` boards from the lake's `mooring` and rows a straight line
  at `BOAT.speed` to any point `lake.inside(x, y, BOAT.keepOff)` whose way is open (refused mid-fight, yawning, leaving,
  rowing, away from the pond; the lure is reeled in first), `Game.land()` rows home and steps off; `GameEvents.rowed`,
  `anchored`, `ashore`. `Game.anglerAt()` is the angler's `Stand` (the lake's `angler` ashore, the seat aboard, with
  `heading` and `base`) and `landing()` where a fish is landed: everything that threw, bent, drew or released from the
  shore takes them, and nothing in the game reads `lake.angler` for a cast. `LakeSave.boat` keeps an anchorage. The
  page's row mode (`mode.ts`, `#rowButton`, R) taps the water to row and the bank to land; `framingFor(..., stand)`
  looks along the heading aboard; `src/boatdraw.ts` is the painted hull, moved each frame, with the winter cover; the
  pace angler boards on every third seed. `game.boat()`, `row`, `land`, `anglerAt`, `landing` and `mode('row')` are the API.
  **Drift** (C3): a row ends anchored (`BoatState.anchored`, saved); `Game.anchor(down)` weighs the anchor (the boat's
  body let go, `GameEvents.adrift`) or drops it (held, `anchored`), refused ashore, rowing, away from the pond and when
  already so; adrift, the boat reads its place from its body each step unless that is off the water by `BOAT.keepOff`,
  when it is put back and stilled, and the bobber likewise against `DRIFT.bank`, so nothing drifts aground. The wind
  weather pushes both free bodies (`DRIFT.wind`, in u/s², the drift about a tenth of it) and a lake's `currents` are
  the physics' belts (`currentsOf`), carrying at about six tenths of the figure; nothing is drawn for a current. The
  Anchor button (`#anchorButton`, A, shown only aboard, `anchorWording`) is the third in `#modes`; the fuzzer weighs
  and drops at random; `game.anchor(down)` and `game.boat().anchored` are the API.
- **The snags** (`docs/boat.md`, C4): a lake's `snags` are reed beds (`Snag` in `src/lakes/lake.ts`: a place, a radius,
  a height, a kind; the pond's three in the shallows by the west bank, the north-west and the south-east, the
  Reservoir's two), water the fish may be in (`inside` is unchanged) and the physics' posts (`posts(lake)` in
  `src/snags.ts`, set on the world), so the bobber and a boat adrift are kept off and `rowPath` keeps the boat's
  line `BOAT.keepOff` from every bed. A lure sinking within `SNAG.reach` of a bed's edge is snagged there (the lure's
  `'snagged'` phase and `Lure.snagged`, the bed; the body carried, a coming fish let go, `GameEvents.snagged`): the
  reel held is a tug (`Game.tugging` counts it, the rope's tension `SNAG.tension` so the rod bends and the line warms)
  and the let-go after `SNAG.tug` of it frees the lure `SNAG.drop` out from the edge, resolved at the let-go itself
  (`freedPoint`, a splash, `GameEvents.freed`); sooner, nothing. `strike`, `cast` and the public `reelIn` are refused
  while snagged (Cast greyed with `SNAGGED_HINT`, the Reel button "Tug", every way of playing's hold a tug through
  `gesture.ts`), and the yawn, a row, a journey and the cabin reel in by force (`reelInForce`, nothing lost). A lure
  sinking within `SNAG.lureReach` of a bed is noticed `SNAG.notice` times as fast (`Bite.step`, the draw count
  unchanged). `src/snagdraw.ts` builds each bed once from a seed of its own into the static set (`snagGroups`, under
  800 triangles a bed, summer's colour in every season). The angler tugs `SNAG.tug + 0.25`; the fuzzer casts at the
  reeds, tugs long and short and tries the refusals on about two seeds in five (`reedy`, from a stream of its own, so
  the other seeds play as they did); `game.snags()`, `snag(i)` and `tugging()` are the API. The figures are `SNAG` in
  `lake.ts`, first guesses.
- **The physics** (`docs/boat.md`, C1): `src/physics.ts` is the one door to artshape-physics, and nothing else in `src/`
  imports it. Its floor is the water's surface (the package refuses the bed as terrain), its rock the shore on a grid of
  `PHYSICS.tile`, a world a game (`newWorld(lake)`; `worldFor(lake)` the memoised grid for readers), and `Bodies` the
  slots: the bobber's, carried (placed by the game) except while the lure sinks, when it is dropped on the water and
  read back into `lure.bobber` only where it differs as a 32-bit float. The world is not stepped while every body is
  carried, and stepped while any body is free (the bobber sinking, the boat adrift). Its tuning's `sleepDrift` is
  lowered to `DRIFT.sleepDrift` so a slow drift is not put to sleep. The lure's depth under the bobber stays the game's sum. `game.bodies()` reads it; the invariants hold the
  body on the water, carried or at the bobber; `PHYSICS.capacity` is its ceiling in `scripts/leaks.ts`.

## Skills

In `.claude/skills`, and they come with every game copied from here:
**/feature** builds one, spec and tests first; **/bug** fixes one,
reproduction first; **/gate-moved** decides what a moved baseline means
before anything is written; **/commit** commits in the house style.

## Model features

What to copy the shape of, when building something new:

- **A way of drawing the water:** there is one, `src/water/clear.ts`. Another
  would be a file beside it that makes the groups at a contamination and its
  `look.clear`, a line in `STYLES`, a unit test in `test/water.test.ts`, and
  pictures in `smoke/look.spec.ts`; it would also need a way to be chosen
  (a `Settings` key, as a switch below), since nothing chooses
  between waters now.
- **A thing in the lake:** the fish. Its numbers are content in `lake.ts`,
  it moves in `fish.ts` stepped by `game.ts`, is held by `invariants.ts`,
  hashed by `scripts/determinism.ts`, watched by `scripts/leaks.ts`, timed by
  the bench, read by `debug.ts`, posed by `swim.ts` and drawn (a chain of
  glowing segments) by `fishdraw.ts`.
- **A thing on the bed:** a drum or a treasure: a `BedFinds` (`bedfinds.ts`) from a spec in `lake.ts` and a seed of its
  own, a quarry index on `Bite` and a wary list, a fight profile in `fight.ts`, a landing in `Game` (`haul`, `keep`)
  that saves what it must, an invariant for each rule (known, once, on the bed, the bite's never found), a hash in
  `scripts/determinism.ts`, a ceiling in `scripts/leaks.ts`, an aimed cast in the fuzzer, its models in `drumdraw.ts`
  or `treasuredraw.ts`, a `fishTo` quarry, and pictures of it on the bed and where it ends up.
- **A kind of fish:** a line in `KINDS` (its weight, `keeps` band, scale and glow, the glow's colour in
  `palette.ts`), slots in `FISH_KINDS`, a journal row for free (the page reads `KINDS`), a unit test in
  `test/fish.test.ts` and `test/bite.test.ts` for its depth, a `fishTo` quarry in `debug.ts`, and a picture in
  `fish-kinds-*`; the balance tool needs nothing, since heft is a share of the range.
- **A painted edge on a solid:** the rocks (`src/rocks.ts`) and the cabin's
  timber (`src/cabin.ts`): a mesh `split` and `painted` once with a `set`
  named in `look.ts`'s `PAINT`, a test that it is painted and built the same
  each time, and a picture; the paint turns off with `?paint=off`. See
  `docs/painted.md`.
- **A way of playing:** the phone: its events in `gesture.ts` with a source, the rules tested there without a page,
  its messages in `phone/protocol.ts`, a `Link` to carry them, an action in the fuzzer (`scripts/phonemonkey.ts`),
  what it keeps named in `scripts/leaks.ts`, and a spec in `smoke/phone.spec.ts` that plays the real page.
- **A switch for the viewer or the tests:** a key in `Settings` with its check
  in `CHECK` (`settings.ts`), what it changes in `setSettings`/`finish`
  (`main.ts`), a method on the test API, and a line in the levers test in
  `smoke/game.spec.ts`. It has no button: the lab's panel is gone.
- **A line or gauge on the screen:** `pondview.ts`: its words a pure function
  with a unit test, an element in `index.html` hidden until shown, a write only
  on change, a stage in `smoke/progress.spec.ts` and a picture at a desk's and a
  phone's width in `smoke/look.spec.ts` (`desk-pond-*`, `phone-pond-*`).
- **A thing on the bank:** a plant or a stone: a model in
  `scripts/kit-sources.json` and its counts and scales in `SCENERY`
  (`lake.ts`; the grass a kind and a field in `grass.ts`), converted by
  `kit.ts`, read by `scenery.ts`, placed by `scene.ts`, held by `test/scene.test.ts`, counted by
  `game.scenery()`, weighed by `sceneryBytes`, and seen in the look pictures.
  A tree is not one of these: its generator seeds are in `trees.ts`, its
  heights and the woodland's count in `SCENERY`, and it is placed by `scene.ts`
  and held by `test/scene.test.ts` and `test/trees.test.ts` all the same.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`), the bench
  (`scripts/bench.ts`, its arithmetic in `scripts/benching.ts`) and the
  film (`scripts/film.ts`, its arithmetic in `scripts/filming.ts`): a
  scene of the look pictures, `standard`, or `cast-sinking` or `splash`
  played to their moment, seeded and paused as they
  are, then a picture after each fixed step, into
  `node_modules/.cache/film/<scene>/` as frames, a strip of every eighth,
  and an MP4 and a GIF where `ffmpeg` is; its own dev server is on
  `--port` or `FILM_PORT` (5211). Nothing is held to the film. Each has
  unit tests of its own working parts. The bench passed a frame made thirty
  times slower until it was made to fail one on purpose: a gate is trusted
  once it has been seen to fail what it is for.
- **Test helpers:** `newGame(seed)` in `test/helpers.ts`, `memoryStore` in
  `src/progress.ts` for a save that is not the player's, and `set(page,
scene)` in `smoke/game.ts` to put the page in a scene.

## Rules for the code

- **No tight coupling.** A module takes what it needs as arguments or
  options. It does not import game state, and lower modules do not import
  content. `main.ts` is the only place that wires everything together.
- **Chance is handed in.** `Game` takes a `random`; nothing in `src/` calls
  `Math.random` itself.
- **Nothing is made each frame.** Pools are sized once and written into;
  the renderer's groups are fixed and `move` writes them. The water's groups
  are handed over again only when the contamination changes. A per-frame
  allocation is a frame-time bug and a garbage-collection stutter.
- **Nothing is kept for ever.** A list, map or cache that is added to has to
  be emptied somewhere, and its ceiling named in `scripts/leaks.ts`.
- **Loading is the first frame's business.** Everything the first frame
  needs is built before `ready`; everything else after it. A dependency is
  weighed against the download budget before it is added.
- **Every kind of thing is handled everywhere.** A new way of drawing the
  water, time of day, view, thing in the lake or save field has to work in
  every path it can reach.
- **Save compatibility.** A new save field needs a default in `progress.ts`
  and a save in the new shape in `test/saves/`; the corpus test fails until
  it is there.
- **Match the style.** Comments are full sentences in the house voice,
  saying why and not what. Prettier decides the formatting.

## Definition of done

The house's nine points, in `~/.claude/CLAUDE.md`. Here, they mean: unit
tests in `test/`, a stage in `smoke/progress.spec.ts`, an action in
`scripts/fuzzer.ts` and a rule in `src/invariants.ts`, a size in
`scripts/leaks.ts` for anything kept, the perf figures before and after in
the report and within budget, `measureFrame` in any other scene touched, and
a picture in `smoke/look.spec.ts`. `npm run check` green, and
`npm run fuzz -- --seeds 1-24` clean.

## Edge-case checklist

For anything new, check what it does, from `DESIGN.md`:

- **save:** saved, reloaded, and loaded from an old save without the field
- **scale:** many at once, at capacity (`FISH_CAPACITY`); and what it costs
  a frame at that many
- **phone:** narrow screen, held upright and sideways, a tablet both ways, and a desk window squeezed to either
  shape: the layout each takes, held by `smoke/layout.spec.ts`; and a slower GPU: which rung it steps down to
- **the mode:** look and cast, each view picked from each, the button and
  the key, a drag, a tap and a hold in each, and cast again while out
- **the rung:** full and lean, each time of day and view on each; the governor
  choosing at boot, forced by the address, and set through `game.rung()` while
  playing; lean has no grass drawn and the same placements
- **the phone as the rod:** paired and not; with motion and without; a second phone (told busy, ignored); the phone
  leaving mid-hold and mid-aim, and a reload (it comes back to the same room); a malformed message (refused by name,
  nothing changed); each mode, and the first gesture in look; the bite's buzz; the status line clear of the bucket
- **the switches:** each time of day, each view, caustics on and off, the paint
  on and off (`?paint=off`; `?paint=maybe` refused by name),
  the lake clear and sick; what the address says that is not known, and an old
  `?dirt=` ignored; and a pebble dropped on it, by a tap or `game.dropNear`, at
  the shore and off it
- **the water:** above, on and under the surface; at the shore's edge; at
  the deepest and the shallowest; a lure or a fish never out of the lake
- **the line:** cast (onto the water, onto the bank, at the shore's edge),
  sinking to the line's depth or the bed, reeled in, cast again while out;
  and, when the fish come, bitten, let out of the zone until the meter
  empties (the fish slips off, nothing is lost), propped on the rail and left
- **the fish:** wandering, at its own depth, drawn to the lure, fleeing,
  hooked; two fish at one lure; a fish hidden behind a snag
- **snags:** reeds, rocks and rooftops caught on, and freed from
- **the boat:** from the shore and from the boat; anchored, drifting in wind
  and current
- **the day:** at dawn, day, dusk and night; at midnight's end of the day;
  slept through; time stopped in the cabin, the journal and the menus
- **the calendar:** each season, a full and a new moon, each weather (rain,
  fog that hides a catch's kind, a sun-shower, wind that bends a cast), a
  festival day; and the year coming round again
- **the real clock:** on and off, the same seed playing the same fish,
  weather and catches either way
- **the lake's contamination:** only ever going down, by the cure; a lake fully
  clean, where no fish is left to bite; a save past the pond's twelve. `game.dirt` moves it both ways, as a lever for the
  pictures, and the invariants allow a rise only where that lever was set
- **the cabin:** the shelves (a cured fish is let go into the pond at once,
  so there is no curing machine and nothing is kept in a tank)

## Verifying in a browser

Use headless Playwright (`start()` in `smoke/game.ts`) for anything seen or
measured; the in-app browser pane pauses when hidden. Control time through
the API: `pause()`, `seed(n)`, then `step(frames)`, never a timeout. Never
write over the player's save; a test save goes in through `start(page, {
save })`. The smoke serves on `SMOKE_PORT` (default 5205), so a worktree
runs it on a port of its own beside the main checkout.

## Commits

Commit only when asked, through `/commit`: a sentence summary in the house
voice, a body saying what changed and why, two commits when a refactor and
a feature land together. The pre-commit hook runs `check:quick`.
