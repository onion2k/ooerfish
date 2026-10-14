# Nuclear Fishin': working on it

A calm, cosy 3D fishing game in which the glowing fish of a leaking power
plant's lakes are caught, cured and befriended, and each lake is seen to heal
as it is cleaned. `DESIGN.md` says what it is to be and the order it is built
in. TypeScript, Vite, and WebGPU through
[artshape-render](https://github.com/onion2k/artshape-render), with the
physics from [artshape-physics](https://github.com/onion2k/artshape-physics).
The README says what the game is; this file says how it is made. The house
rules in `~/.claude/CLAUDE.md` apply too. For now the page is the **lake
lab**: one pond, its water seen into (the lake is seen into as it is cleaned,
which is what the game is about), with fish swimming under it and a panel for
the contamination, the time of day, the view and the caustics. In it a fish can be cast for,
hooked, played and landed (stages 1 and 2 of `DESIGN.md`'s order of work);
nothing is saved yet, and the bucket is the session's until the cure comes.

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

| Property                                             | Budget                         | Held by |
| ---------------------------------------------------- | ------------------------------ | ------- |
| Boot, page start to the frame loop running           | 3000 ms                        | `perf`  |
| Download, scripts and styles gzipped                 | 400 kB; baseline to the byte   | `perf`  |
| A frame drawn, the least of 24 at the standard scene | 8 ms                           | `perf`  |
| A frame of the water, day and night                  | 8 ms                           | `perf`  |
| A step of the lake, against the reference arithmetic | baseline ± 15%                 | `bench` |
| Game minutes for the angler to land three fish       | baseline ± 20%, both ways      | `pace`  |
| The scenery download, `public/scenery` gzipped       | 900 kB; baseline to the byte   | `perf`  |
| Anything kept: fish, save bytes, heap                | ceilings in `scripts/leaks.ts` | `leaks` |

The standard scene is `STANDARD` in `smoke/game.ts`: the water half
cleaned, by day, from the shore. The pace gate's angler (`src/angler.ts`)
casts toward the middle, strikes on the dip and plays the line by its gauge;
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
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook; ~10 s)
    npm run check          all of it: check:quick, fuzz, determinism, leaks, bench, pace, smoke with perf and look (~1.5 min)
    npm test               unit tests (Vitest, test/)
    npm run fuzz           the game played at random, rules checked; -- --seed N plays one failure again
    npm run determinism    the same seed played twice, hashed, to catch chance not from the seed
    npm run leaks          an hour of play, watching what must stay bounded (10 min of it in check)
    npm run bench          a step of the lake held to scripts/bench-baseline.json, both ways
    npm run pace:check     the angler's minutes to land three fish, held to scripts/pace-baseline.json
    npm run perf           boot, frame and download held to smoke/perf-baseline.json and the budget
    npm run smoke          the game in headless Chromium on the real GPU (Playwright, smoke/)
    npm run look           the scenes held to the pictures in smoke/screens, to the pixel
    npm run film -- --scene <name> --seconds <n>  a scene filmed a stepped frame at a time, for looking at, not a gate
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

- `src/game.ts` is the lake without the picture: its clock, its fish, and the
  lab's two levers on it (contamination, time of day), a step at a time. It
  knows nothing of the renderer or the page. `src/fish.ts` is the school.
- `src/main.ts` is the page. It turns the lab's settings into the water, the
  light and the camera, and the page's mode into what a drag does, and draws the frame. There is no game logic here.
- `src/debug.ts` is `window.game`, the test API: the clock, the fish, and the
  lab's controls (`dirt`, `time`, `view`, `caustics`), each resolving once
  its change is ready to draw, and the page's `mode`. `src/invariants.ts` lists the rules that must
  always hold.
- Content lives in `src/lake.ts`: the shore's shape, the bed, the banks, the
  boulders, the fish count and capacity, and the named views. A boulder is a
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
  The lab's `paint` control (`on`|`off`, `?paint=off`, `game.paint()`) draws
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
  0.1 ms (the grass about 1 ms). At boot, unless `?rung=full|lean` asks, the
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
  style's own, which the bobber and the rings ride through
  `src/water/swell.ts`, and its foam lines come from `src/shorefield.ts`, the
  distance to the shore or a boulder, made once at boot. `src/fishdraw.ts`
  draws each fish as a mesh glowing under the water (`FLOW_GLOW`), which the
  water shows; there is no glow drawn on the surface.
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
  not over the lab's controls) puts the camera at the Shore view, the view
  setting becoming `shore`, turns the orbit off, and a drag back aims, letting
  go casts and a tap with the lure sinking strikes. Picking a view, from the
  panel or `game.view`, is look mode again, and puts the camera there even if
  it is the view already. The mode is the page's and not a setting: it is not
  in the address, and `game.mode()` reads and sets it. The Game's `cast`,
  `aim` and the fuzzer do not go through it.
- **The fishing:** `src/bite.ts` is a fish and the lure (none, coming,
  nibbling, biting, hooked, landed): one fish at a time, which the school's
  wander leaves alone (`School.held`) while `steerTo` swims it, the strike's
  window, the twitch and the wary fish. `src/line.ts` is the fight's sums
  (the line out and its tension under the reel and the fish's pulls, the
  slip, the landing). `Game` wires them (`strike`, `reel`, `stow`, the fish
  steered along the line, `GameEvents` nibbled to landed); the figures are
  `FISHING`, `FIGHT` and `PERCH` in `lake.ts`, tuned on measured seeds.
  `castdraw.ts` bends the rod, colours the line by the tension and hangs a
  landed fish; `src/fightview.ts` is the gauge, the Strike/Reel button, the
  card and the bucket. A tap strikes and a hold reels in cast mode;
  space and the button do in any view and mode.
- **Splashes:** `src/splash.ts` is the pool (twelve, the oldest replaced),
  filled by `Game.drop` and `Game.dropNear`, which refuse what is off the
  water and tell of a splash through `GameEvents.splashed`. Their picture is
  `src/ripples.ts` (a ring's radius and width at an age, pure),
  `src/ripplesdraw.ts` (the rings as flat pieces, none over the bank) and
  `splashBurst` in `src/bursts.ts` (the droplets, emitted on the event).
  `src/pick.ts` turns a tap on the screen into the point on the water.
- `src/settings.ts` reads the lab's settings (the dirt, the time, the view,
  and the water's caustics) from the address and refuses
  what it does not know; `src/lab.ts` is the panel. The save lives in
  `progress.ts` and has no fields yet. Chance comes from `random.ts`, handed
  in.
- artshape-physics is a dependency with nothing using it: the lure and the
  bobber will be its bodies, through a `src/physics.ts` of the game's own.

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
  (a `Settings` key, as a control on the lab below), since nothing chooses
  between waters now.
- **A thing in the lake:** the fish. Its numbers are content in `lake.ts`,
  it moves in `fish.ts` stepped by `game.ts`, is held by `invariants.ts`,
  hashed by `scripts/determinism.ts`, watched by `scripts/leaks.ts`, timed by
  the bench, read by `debug.ts`, and drawn (its glow, as a mesh) by
  `fishdraw.ts`.
- **A painted edge on a solid:** the rocks (`src/rocks.ts`) and the cabin's
  timber (`src/cabin.ts`): a mesh `split` and `painted` once with a `set`
  named in `look.ts`'s `PAINT`, a test that it is painted and built the same
  each time, and a picture; the paint turns off with `?paint=off`. See
  `docs/painted.md`.
- **A control on the lab:** a key in `Settings` with its check in `CHECK`
  (`settings.ts`), a group on the panel (`lab.ts`), what it changes in
  `apply` (`main.ts`), a method on the test API, and a click in the controls
  test in `smoke/game.spec.ts`.
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
  scene of the look pictures, or `standard`, seeded and paused as they
  are, then a picture after each fixed step, into
  `node_modules/.cache/film/<scene>/` as frames, a strip of every eighth,
  and an MP4 and a GIF where `ffmpeg` is; its own dev server is on
  `--port` or `FILM_PORT` (5211). Nothing is held to the film. Each has
  unit tests of its own working parts. The bench passed a frame made thirty
  times slower until it was made to fail one on purpose: a gate is trusted
  once it has been seen to fail what it is for.
- **Test helpers:** `newGame(seed)` in `test/helpers.ts`, `memoryStore` in
  `src/progress.ts` for a save that is not the player's, and `set(page,
scene)` in `smoke/game.ts` to put the lab in a scene.

## Rules for the code

- **No tight coupling.** A module takes what it needs as arguments or
  options. It does not import game state, and lower modules do not import
  content. `main.ts` is the only place that wires everything together.
- **Chance is handed in.** `Game` takes a `random`; nothing in `src/` calls
  `Math.random` itself.
- **Nothing is made each frame.** Pools are sized once and written into;
  the renderer's groups are fixed and `move` writes them. The water's groups
  are handed over again only when the lab's contamination changes. A per-frame
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
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
- **the mode:** look and cast, each view picked from each, the button and
  the key, a drag, a tap and a hold in each, and cast again while out
- **the rung:** full and lean, each time of day and view on each; the governor
  choosing at boot, forced by the address, and set through `game.rung()` while
  playing; lean has no grass drawn and the same placements
- **the lab:** each time of day, each view, caustics on and off, the paint
  on and off (`?paint=off`; `?paint=maybe` refused by name),
  the lake clear and sick; what the address says that is not known; and a
  pebble dropped on it, by a tap or the button, at the shore and off it
- **the water:** above, on and under the surface; at the shore's edge; at
  the deepest and the shallowest; a lure or a fish never out of the lake
- **the line:** cast (onto the water, onto the bank, at the shore's edge),
  sinking to the line's depth or the bed, reeled in, cast again while out;
  and, when the fish come, bitten, drawn too tight (the fish slips off,
  nothing is lost), propped on the rail and left
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
- **the lake's contamination:** only ever going down; a lake fully clean.
  The lab's slider moves it both ways, as a lever for looking; the rule that
  it never rises comes with the cure, and goes in the invariants then
- **the cabin:** the curing machine, the aquarium at its ceiling, the
  shelves, a fish named and let go

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
