# Nuclear Fishin': working on it

A calm, cosy 3D fishing game in which the glowing fish of a leaking power
plant's lakes are caught, cured and befriended, and each lake is seen to heal
as it is cleaned. `DESIGN.md` says what it is to be and the order it is built
in. TypeScript, Vite, and WebGPU through
[artshape-render](https://github.com/onion2k/artshape-render), with the
physics from [artshape-physics](https://github.com/onion2k/artshape-physics).
The README says what the game is; this file says how it is made. The house
rules in `~/.claude/CLAUDE.md` apply too. For now the page is the **lake
lab**: one pond, drawn several ways side by side so the water can be chosen
by looking, with fish swimming under it and a panel for the water, the
contamination, the time of day and the view. Nothing is played or saved yet;
the first stage of `DESIGN.md`'s order of work grows out of the lab.

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

| Property                                                 | Budget                         | Held by |
| -------------------------------------------------------- | ------------------------------ | ------- |
| Boot, page start to the frame loop running               | 3000 ms                        | `perf`  |
| Download, scripts and styles gzipped                     | 400 kB; baseline to the byte   | `perf`  |
| A frame drawn, the least of 24 at the standard scene     | 8 ms                           | `perf`  |
| A frame of every way of drawing the water, day and night | 8 ms                           | `perf`  |
| A step of the lake, against the reference arithmetic     | baseline ± 15%                 | `bench` |
| Anything kept: fish, save bytes, heap                    | ceilings in `scripts/leaks.ts` | `leaks` |

The standard scene is `STANDARD` in `smoke/game.ts`: open water half
cleaned, by day, from the shore. There is no pace gate while nothing is
played: it was the stub's, and comes back with the fishing as the minutes
to land a fish.

A budget is what the game may cost at all; a baseline is what it cost at
the last commit, held both ways, so a step toward a budget is noticed as
much as a step over it. The perf tolerances are the measured wobble of a
headless boot and a GPU frame, and say so in `smoke/judging.ts`. The
download does not wobble, so it is held to the byte: a change that adds to
it writes the perf baseline again and says by how much, and one that
should not have is looked into.

## Commands

    npm run dev            the game at http://localhost:5204
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook; ~10 s)
    npm run check          all of it: check:quick, fuzz, determinism, leaks, bench, smoke with perf and look (~1 min)
    npm test               unit tests (Vitest, test/)
    npm run fuzz           the game played at random, rules checked; -- --seed N plays one failure again
    npm run determinism    the same seed played twice, hashed, to catch chance not from the seed
    npm run leaks          an hour of play, watching what must stay bounded (10 min of it in check)
    npm run bench          a step of the lake held to scripts/bench-baseline.json, both ways
    npm run perf           boot, frame and download held to smoke/perf-baseline.json and the budget
    npm run smoke          the game in headless Chromium on the real GPU (Playwright, smoke/)
    npm run look           the scenes held to the pictures in smoke/screens, to the pixel

A unit test is allowed thirty seconds, and `vitest.config.ts` says why: the
limit is there to catch a test that never ends, and how fast the game steps
is the bench's to hold.

`--update` on `bench`, `npm run perf:update` and `npm run
look:update` write a baseline again. Only through `/gate-moved`, only for a
change meant to move it, and the commit says why. Look at every picture.
The bench writes its baseline from two readings, and only where they agree:
a baseline written while the machine is at other work fails every run after
it.

## How the code is laid out

- `src/game.ts` is the lake without the picture: its clock, its fish, and the
  lab's two levers on it (contamination, time of day), a step at a time. It
  knows nothing of the renderer or the page. `src/fish.ts` is the school.
- `src/main.ts` is the page. It turns the lab's settings into the water, the
  light and the camera, and draws the frame. There is no game logic here.
- `src/debug.ts` is `window.game`, the test API: the clock, the fish, and the
  lab's four controls (`water`, `dirt`, `time`, `view`), each resolving once
  its change is ready to draw. `src/invariants.ts` lists the rules that must
  always hold.
- Content lives in `src/lake.ts`: the shore's shape, the bed, the banks, the
  fish count and capacity, and the named views. Colours live in
  `src/palette.ts`, the times of day and the toon look in `src/look.ts`.
- **The ways of drawing the water** are in `src/water/`, one file each and a
  line in `STYLES` (`styles.ts`): open water, lit ripple, and see-through
  (`clear.ts`, the renderer's clear water from v0.29.0, whose `look.clear`
  follows the contamination, the caustics setting and the time of day).
  `waterColour` is the opaque styles' contamination colour. `src/glow.ts`
  draws a fish's glow on the surface over it, for the styles that cannot be
  seen through (`surfaceGlow`); `src/fishdraw.ts` draws each fish as a mesh
  glowing under the water (`FLOW_GLOW`), which see-through water shows.
- **Splashes:** `src/splash.ts` is the pool (twelve, the oldest replaced),
  filled by `Game.drop` and `Game.dropNear`, which refuse what is off the
  water and tell of a splash through `GameEvents.splashed`. Their picture is
  `src/ripples.ts` (a ring's radius and width at an age, pure),
  `src/ripplesdraw.ts` (the rings as flat pieces, none over the bank) and
  `splashBurst` in `src/bursts.ts` (the droplets, emitted on the event).
  `src/pick.ts` turns a tap on the screen into the point on the water.
- `src/settings.ts` reads the lab's settings (the water, the dirt, the time,
  the view, and see-through water's caustics) from the address and refuses
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

- **A way of drawing the water:** `src/water/ripple.ts`. A file that makes
  the groups at a contamination, a line in `STYLES`, a unit test in
  `test/water.test.ts`, pictures in `smoke/look.spec.ts`, and the perf test
  measures it by itself.
- **A thing in the lake:** the fish. Its numbers are content in `lake.ts`,
  it moves in `fish.ts` stepped by `game.ts`, is held by `invariants.ts`,
  hashed by `scripts/determinism.ts`, watched by `scripts/leaks.ts`, timed by
  the bench, read by `debug.ts`, and drawn (its glow) by `glow.ts`.
- **A control on the lab:** a key in `Settings` with its check in `CHECK`
  (`settings.ts`), a group on the panel (`lab.ts`), what it changes in
  `apply` (`main.ts`), a method on the test API, and a click in the controls
  test in `smoke/game.spec.ts`.
- **Tools:** the fuzzer (`scripts/fuzzer.ts`) and the bench
  (`scripts/bench.ts`, its arithmetic in `scripts/benching.ts`). Each has
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
  are handed over again only when the lab's water or contamination changes. A per-frame
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
- **the lab:** each way of drawing the water, each time of day, each view,
  the lake clear and sick; what the address says that is not known; and a
  pebble dropped on it, by a tap or the button, at the shore and off it
- **the water:** above, on and under the surface; at the shore's edge; at
  the deepest and the shallowest; a lure or a fish never out of the lake
- **the line:** cast, sinking, bitten, reeled in, drawn too tight (the fish
  slips off, nothing is lost), propped on the rail and left
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
save })`.

## Commits

Commit only when asked, through `/commit`: a sentence summary in the house
voice, a body saying what changed and why, two commits when a refactor and
a feature land together. The pre-commit hook runs `check:quick`.
