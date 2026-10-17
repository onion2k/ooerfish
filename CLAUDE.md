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
  round past midnight, held to [0, 1)), its fish, and the contamination, a step
  at a time. It knows nothing of the renderer or the page. `src/fish.ts` is the
  school.
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
  fish is out of the zone. A heavier fish darts faster, a sick lake's more
  often. `Game` wires them (`strike`, `reel`, `stow`, the fish
  steered along the line, `GameEvents` nibbled to landed); the figures are
  `FISHING`, `FIGHT` and `PERCH` in `lake.ts`, tuned on measured seeds.
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
- `src/settings.ts` reads the address, which holds only the viewer's and the
  tests' switches, `caustics` and `paint` (beside `seed`, `paused` and `rung`,
  read where they are used), and refuses what it does not know by name; it is
  never written back, and an old link with `dirt=`, `time=` or `view=` still
  opens the game, unread. The save lives in `progress.ts` and holds the count
  cured (default 0; a count that is not a non-negative whole number is taken for
  none; `test/saves/` has a file for each shape). Chance comes from `random.ts`,
  handed in.
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
  (a `Settings` key, as a switch below), since nothing chooses
  between waters now.
- **A thing in the lake:** the fish. Its numbers are content in `lake.ts`,
  it moves in `fish.ts` stepped by `game.ts`, is held by `invariants.ts`,
  hashed by `scripts/determinism.ts`, watched by `scripts/leaks.ts`, timed by
  the bench, read by `debug.ts`, posed by `swim.ts` and drawn (a chain of
  glowing segments) by `fishdraw.ts`.
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
- **phone:** narrow screen, and a slower GPU: which rung it steps down to
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
