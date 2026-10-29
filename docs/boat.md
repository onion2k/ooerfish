# The boat (Part C of the roadmap): the user's choices and its slices

The spec of stage 8, slice by slice, as each is agreed. Measured and decided 29 Oct 2026.

## Context and the decisions

`docs/roadmap.md` Part C is stage 8 of `DESIGN.md`: the boat from spot to spot, its drift on wind and currents, snags,
and lazy fishing, the first use of artshape-physics, "one `docs/boat.md` with the user's choices, built in slices,
each a commit". The decisions were put first and are made:

- **The line is a rope now** (the user's choice over the roadmap's recommendation): the design's "rope of sixteen to
  thirty-two points held apart, worked in the game so it is deterministic and tested, drawn as a strip from a pool".
  It is its own slice, C0, before C1, since it changes how every fight is drawn and should land and be looked at alone.
- **The physics' floor is the water's surface** (recommended, chosen). Measured: the physics refuses the bed as
  terrain at every tile size (2, 3, 4 and 6: the shelf drops 4.4 units over 2 at the pond and 5.1 over 4 at the
  Reservoir, its rule half a tile). So the floor is flat at the surface, the shore is its rock, and what floats
  rests on it: the bobber and, later, the boat are bodies; currents are belts carrying what rests on them; snags
  are posts standing above the surface. The lure hangs under the bobber by the game's sum, to the bed, as now.
  No package change.
- **Mine, said so they can be changed:** the boat (C2) will be a body of its own kind in the same world, `carried`
  while rowed between spots and while anchored (the game puts it where it likes) and let go to drift (C3), so one
  mechanism serves both; the lure's depth stays the game's; the physics' rock is a little outside the waterline
  (a tile whose centre is more than a tile's half-diagonal outside the shore), so a thing anywhere on the water
  is never in rock, and the game's own rules keep a drifting thing off the last strip of bank, as they keep the fish.

## Measured

| What                                             | Figure                 |
| ------------------------------------------------ | ---------------------- |
| A game step today, fish swimming                 | 6.05 µs                |
| A world step at 1/60, two bodies awake, one belt | 1.86 µs                |
| The same, bodies asleep                          | 1.13 µs                |
| The bench's "casting and sinking" baseline       | 0.00363 ms, held ± 15% |

So C1 moves the bench's casting and fight scenarios by about a quarter, a meant move written through `/gate-moved`;
the frame is untouched (the world is stepped in the game, not drawn). A rope of 24 points at 6 relaxations is
about a microsecond a step: the same scenarios move again in C0, meant.

## The slices (each a commit, each its own `/feature` pass; C0 and C1 first)

- **C0. The line as a rope** (`src/rope.ts`). Full spec below.
- **C1. `src/physics.ts` and the bobber's body.** Full spec below.
- **C2. The boat from spot to spot.** `Game.board`/`land`, a boat body at the jetty, a lake's `spots` (content in the
  `Lake`), rowed between them by a tap, anchored on arrival; the `boat` view from its seat; the cast thrown from the
  boat's rod tip and reaching from there; the boat rocking by ooergolf's sway (drawing only); the pace angler and the
  fuzzer board at random; invariants keep the boat on the water. _Decision first:_ how the row is shown (a few
  seconds along a straight line, the camera following).
- **C3. Drift, wind and current.** The boat let go when unanchored: the day's wind added in the step as the cast's
  push is, belts from a lake's `currents` (content), carrying the bobber too; the rope between them bends; anchoring
  stops it. Invariants hold both on the water.
- **C4. Snags.** Reeds, rocks and rooftops as posts (bumpers) and boxes in the lake's content; a lure cast onto one
  catches, freed by a give of line; fish hide behind them.
- **C5. Lazy fishing.** The rod propped, the bobber left, a bell on the bite.

C2 to C5 get their sections in `docs/boat.md` as each is specified, with the user's choices.

---

## C0. The line as a rope

### What

The line between the rod's tip and whatever is on its end (the lure dangling when ready, the lure in the air, the
bobber on the water, the hooked fish, the landed fish hanging) is a rope of `ROPE.points` (24) points, stepped in
`Game.step` at the pond: a Verlet chain with the two ends pinned, gravity and damping, relaxed `ROPE.iterations`
(6) times to `ROPE.points - 1` equal segments whose sum is the rope's length. The length is the chord plus slack by
the fight's tension: `chord * (1 + ROPE.slack * (1 - tension))` with no fish on it treated as calm, so a slack line
sags and a strained one straightens, as the sum does now. A point is kept out of the ground: above `lake.ground`
off the water, above the bed on it. `castdraw.ts` draws the rope's segments as the pieces it already draws
(`LINE_PIECES` becomes `ROPE.points - 1`), from the pools it already has, and keeps the colour by tension, the
width, the bobber, the under-water piece from the bobber to the lure and the preview; the drawn sag sum goes.
Where the line starts (the tip bent by the tension) and ends become game-side sums (`bentTip` in `cast.ts`, `Game.lineEnd`)
the draw reads, so the draw decides nothing. `game.rope()` reads the points.

### Acceptance criteria

1. The ends are where they are pinned to the bit, and after a settle every segment is within 2% of the length over
   the segment count: `test/rope.test.ts`.
2. At calm the middle sags below the chord and stays above the ground and the bed; at full tension the rope is
   straight to within 1% of the chord: `test/rope.test.ts`.
3. The same inputs give the same points, and ends moved wildly for 10,000 steps leave every point finite and within
   the length of each end: `test/rope.test.ts`; `scripts/determinism.ts` hashes the points.
4. Nothing played moves: the pace and balance baselines hold exactly and `test/line.test.ts` is untouched.
5. Every rope point is finite and no point is under the ground: `src/invariants.ts`, `test/invariants.test.ts`.

### Edge cases

- **the line:** ready (a short rope to the dangle), flying (the chord grows each step, the rope paying out),
  sinking (to the bobber, which bobs and dips: the end follows the drawn bobber's height, a game sum of the swell
  through `Game.surface`, handed in by the page as `castdraw.surface` is), hooked (to the fish's mouth, the slack by
  the tension), landed (to the hang), lying on the bank (the rope draped, its points held on the ground), slipped
  (back to the bobber at once: the rope is reset straight when the end jumps further than its length, so it never
  whips across the lake).
- **the day, the cabin, the pages:** the game's step holds, so the rope holds; a load into the cabin with no cast
  out has the ready rope; a load at the pond mid-cast (the save keeps no cast) has the ready rope.
- **the lakes:** the rope takes the lake's ground and bed; the Reservoir's rod tip is its own.
- **the pictures:** every picture with the rod in it moves (the shore's many), since the rope's rest is not the sum's
  sag to the bit; settled over the pictures' thirty frames. Looked at and written through `/gate-moved`.
- **phone, mode, rung, switches, water, fish, contamination, save:** not reachable (nothing saved, nothing played).

### Performance risk

A microsecond a game step (the bench moves, meant); nothing on the frame; nothing downloaded beyond the module (under
1 kB gzipped, said exactly).

### Parts

- [ ] 0. `docs/boat.md` (this spec, the choices and the slices); `DESIGN.md` stage 8 notes the slice; the roadmap
      gains C0 ticked. Check: Prettier.
- [x] 1. `src/rope.ts` (`ROPE` in `lake.ts`; `Rope` with `points`, `reset(a, b)`, `step(dt, a, b, length, keepOut)`),
      `bentTip` in `cast.ts`, `Game.lineEnd` and the rope stepped in `Game.step`, the invariants, the determinism
      hash, `game.rope()`. Check: `test/rope.test.ts`, `test/invariants.test.ts`, `npm run determinism`.
- [x] 2. `castdraw.ts` draws the rope; `test/castdraw.test.ts` (if there is one; else the look). Check: `npm run look`
      on the cast pictures, looked at.
- [ ] 3. The pass: check, fuzz 1-24, perf before and after, the mutations (the ends unpinned; the slack not by
      tension; a point let under the ground), pictures written through `/gate-moved`. Commit and push.

### C0's notes (built 29 Oct 2026)

- **The figures as tuned:** 24 points, 6 relaxations each sweeping the chain forward and back (the plain sweep left a
  rope as long as its chord sagging 1.4%, over the 1% criterion), gravity 6 and slack 0.01 (at 30 and 0.08 the line
  bellied 18% of a 35-unit chord against the old sum's 6%; now about 7%), damping 0.92, whip 0.5, 0.05 above the
  ground. Gravity is felt in the share the slack gives (`slack / ROPE.slack`, clamped), so a strained line is held
  straight; the rest is the spec's.
- **The cost:** a step of the rope is about 5 µs, not the microsecond estimated: the relaxations are most of it, the
  keep-out the rest (a point over the water and above its surface skips the bed's lookup). A ready line is laid once
  and not stepped, so the idle game costs what it did; the bench's casting and fight scenarios moved from 0.000234 and
  0.000221 of the reference to 0.000622 and 0.000607, meant, written after seven tries on a desktop at other work. The
  frame does not feel it. The download grew by 1,107 bytes gzipped, 217,781 to 218,888.
- **A bug found in the build:** the rope's gravity was edited by a search that also hit the raindrops' (`RAIN_DROPS.gravity`,
  0.85 to 6), which moved the rain in five pictures the rope cannot touch. Found by running one picture at the parent
  and bisecting; put back, and the rain holds.
- **The pictures:** 22 moved, every one with a line out (the cast's flight and sink, the bite, the fight, the landed
  card, at a desk's, a phone's, a tablet's and a sideways width, and the Reservoir's), each looked at; the flight's
  line shows a mild wave mid-cast as the rope pays out. 104 held, the ready line among them.
- **Not verified:** the rope on a slow reel in play, which is what the design left open; a rope in the physics stays a
  package change only if this one does not feel right.

---

## C1. `src/physics.ts` and the bobber's body

### What

`src/physics.ts` is the one door to artshape-physics: `worldFor(lake)` makes a `World` once a lake (a `WeakMap`,
as the surface's memo) on a grid of `PHYSICS.tile` (2) units covering the lake's furthest shore and a margin, its
rock every tile whose centre is more than a tile's half-diagonal outside `lake.inside`, a flat floor at the surface,
`bottom` below everything, kinds `[bobber, boat]` by radius (`PHYSICS.radii`: the bobber's 0.38, the boat's for C2),
the tuning's gravity and step left as the package's. `Bodies` holds the slots: the bobber's, spawned at boot
carried (so the game places it), `put(x, y)` while carried, `drop(x, y)` lets it go at a landing, `take()` carries
it again. `Game` steps the world each step at the pond after the lure, and while the lure is sinking its bobber is
read back from the body (a bobber on a flat floor with nothing moving it stays where it was dropped, so nothing
visible moves; from C3 the belts and the wind move it). A reel-in, a hook, a slip's `freed` and a cast take it.
Nothing is drawn or saved. `game.bodies()` reads the slots.

### Acceptance criteria

1. Every point a cast can land on in either lake is on a water tile, and every tile outside the shore by more than a
   tile is rock: `test/physics.test.ts` (a thousand points inside each lake).
2. A bobber dropped stays within 1e-4 of where it was dropped for ten seconds of steps, asleep by the end:
   `test/physics.test.ts`.
3. The same lake gives the same world; two lakes two: `test/physics.test.ts`.
4. The game's lure sits where it landed to the bit the pictures see: the cast pictures hold (`npm run look`), and
   the pace and balance baselines hold exactly.
5. The body is on the water and finite, carried whenever the lure is not sinking, and where the lure's bobber is while
   it is: `src/invariants.ts`, `test/invariants.test.ts`; the determinism hash takes the body in.

### Edge cases

- **the line:** a cast onto the bank (the body stays carried, nothing dropped); the shore's edge (the tile is water
  by the margin rule); reeled in, cast again while out (taken, then dropped again); a slip (`freed` puts the body
  where the fish let go); a drum or a treasure (the bobber is on the water as for a fish).
- **the lakes:** a world each; travel reloads, so nothing carries over.
- **the day, the cabin:** the step holds away from the pond; a wake with the lure reeled in has the body carried.
- **scale:** two bodies; the capacity is `PHYSICS.capacity` (8) and named in `scripts/leaks.ts`.
- **save, phone, mode, rung, switches, water, fish, contamination:** not reachable.

### Performance risk

About 1.5 µs a game step (the bench's casting and fight scenarios move by about a quarter, meant, through
`/gate-moved`); the frame untouched; the download gains the package's `world.ts` (measured by the perf gate, said
exactly; the physics is bundled today by nothing, so this is the first cost of it).

### Parts

- [ ] 0. `docs/boat.md` gains C1's section; the roadmap ticks C1; `DESIGN.md`'s note. Check: Prettier.
- [x] 1. `src/physics.ts`, `PHYSICS` in `lake.ts`, `test/physics.test.ts`. Check: the test.
- [x] 2. `Game` owns `Bodies`, steps the world, reads the bobber back; the invariants; the determinism hash;
      `game.bodies()`; the leaks ceiling. Check: `test/game.test.ts` (dropped at a landing, taken at a reel-in and a
      hook), `test/invariants.test.ts`, `npm run determinism`.
- [ ] 3. The pass: check, fuzz 1-24, perf before and after, the mutations (the body not read back; the rock a tile
      inside the shore; the body dropped while flying), the bench written through `/gate-moved`. Commit and push.

### C1's notes (built 29 Oct 2026)

- **As built:** `src/physics.ts` is the one door to the package: `worldFor(lake)` the memoised grid and a world on it
  for the tests, `newWorld(lake)` a world of its own for each `Game` (a world holds bodies, so games cannot share one),
  `Bodies` the slots. The grid's extent is found by bisection against `inShore` along 256 rays (the shore is stretched
  in x, so `shoreRadius` alone put water outside the grid), plus the margin; the rock is every tile whose centre is
  more than a tile's half-diagonal outside the waterline. The world's chance is a constant (it only tilts a spawned
  body), so the game's is never spent. A body's x and y are written back to the lure only when they differ from the
  lure's as 32-bit floats, so a bobber nothing moved is the lure's to the bit, and every picture and the pace hold.
- **The cost:** the world is not stepped while every body is carried, so the idle game costs what it did; with the
  bobber dropped and asleep the step is under the bench's tolerance (casting +1%, the fight +13%, both within), so no
  bench baseline moved. The download grew by 22,591 bytes gzipped, 218,888 to 241,479: the whole of the package's
  `world.ts` (discs, terrain, holes and all) comes with its first use, under the 400 kB budget and said here plainly.
  Boot and frame hold alone (819 ms, 3.95 ms); in the full suite they read high, as they do after a long run.
- **Not verified:** nothing moves the body yet, so the read-back is proved only by the body staying put; C3's belts
  and wind are what will show it.

---

## C2. The boat from spot to spot: rowed anywhere on the water, the camera following, fished from and landed

### Context

The third slice of Part C (`docs/boat.md`; C0 the rope and C1 the bobber's body are in). `DESIGN.md` stage 8: "The
boat goes from spot to spot and anchors". Decided with the user: **the row is shown**, the boat moving along a
straight line at `BOAT.speed` with the camera following, and **the player picks anywhere on the water**, not marked
spots. A tap on the water drops a pebble in look mode already, so rowing is a **mode** behind a **Row button**, as
casting is behind Cast: in row mode a tap on the water rows there and a tap on the bank lands. The boat is a body of
its own kind in C1's world, carried the whole of this slice (the game puts it where it rows; C3 lets it go to
drift). Nothing about the fight changes: the angler's place moves, and everything that read `lake.angler` or
`lake.landAt` reads the game's place instead.

### What

- **Content.** `BOAT` in `src/lake.ts` (first guesses): `speed` 6 (world units a second), `keepOff` 3 (how far the
  boat's middle keeps from the shore, a boulder or the jetty, through `lake.inside(x, y, keepOff)`), `hull`
  (`length` 4.2, `width` 1.7, `freeboard` 0.5, `seat` 0.35 up, the seat 0.8 aft of the middle), `tip` (the rod's
  tip height over the seat 3.6 and reach ahead 2.4, as the shore's `tipHeight`/`tipReach`), `landAt` (a fish is
  landed 1.5 beside the seat), `rock` (the rocking's roll 0.03 and pitch 0.02 radians and rate, drawing only),
  `cover` (the winter canvas's height over the gunwale). `Lake.boat: { mooring: { x, y, heading }; spot: [x, y] } |
null`: where the boat lies and is boarded (the pond: beside the jetty's lake end, heading inward; the Reservoir:
  off the beach ahead of the angler, since it has no jetty) and the spot the pace angler rows to (near the middle).
  Both lakes have a boat.
- **The boat in the game** (`src/boat.ts`, pure sums, and `Game`): `Boat` state: `x, y, heading, aboard, rowing,
from, to, rowedAt`. `Game.row(x, y)`: refused (false) away from the pond, yawning or leaving, with a fish hooked or
  landed, while rowing, for a point that is not a number, off the water by `keepOff`, or whose straight path from
  the boat crosses ground the boat keeps off (`rowPath(lake, from, to)` samples the line every half unit); otherwise
  the lure is reeled in (a coming or nibbling fish lets go, as the yawn does), the angler is aboard (boarding from
  the mooring if ashore: the boat starts where it lies), and the boat rows along the line at `BOAT.speed`, its
  heading the line's, told as `GameEvents.rowed` at the start and `anchored` at the end, where it is anchored and
  the save written. `Game.land()`: refused as `row` is, and when ashore; rows to the mooring and steps off on
  arrival (`aboard` false, told as `landed`... name it `GameEvents.ashore`), saved. `cast`, `strike`, `drop` and
  `dropNear` are refused while rowing; the fight cannot start while rowing since the lure is ready. **The angler's
  place** is `Game.anglerAt()`: ashore the lake's `angler`; aboard the seat, with the boat's tip figures, and
  `Game.landing()` the lake's `landAt` ashore or `BOAT.landAt` beside the seat aboard: `rodTip(lake, at)` takes the
  place (the throw memo keyed by the tip's height, since a boat's tip and the shore's differ), `cast`, `strike`'s
  bearing, the fight's `lx, ly`, `fightFind`, the release of a cured fish and the bodies' spawn read them. Nothing
  else reads `lake.angler` (the grass, the scenery and the bed finds keep the shore's). The boat's body is put each
  step at the boat.
- **The save.** `LakeSave.boat: { x: number; y: number; heading: number } | null` (default null: ashore, the boat at
  its mooring): written at an anchoring and a landing; a load with it has the angler aboard there. A row under way
  is not saved: a load lands at the last anchorage. `test/saves/14-boat.json`.
- **The page.** `src/mode.ts` gains `row`: `nextMode` from `'row'` (the button) toggles look and row, `cast`
  leaves row for cast, `view` leaves it for look; `orbits('row')` is true (a drag looks round), `wording('row')` is
  `{ button: 'Look round', hint: 'tap the water to row there, tap the bank to land' }` and the Row button reads "Row"
  in the other modes. A tap in row mode: on the water `game.row(x, y)`, off it `game.land()`, the mode back to look
  either way; a refusal leaves the mode. While rowing the Row and Cast buttons are greyed (`disabled`). The camera:
  aboard, the `shore` and `phone` framings (cast mode's) and the `boat` view are centred on the seat and turned to
  the heading (`framingFor(lake, name, aspect, boat)`, pure: the view's target moved to the seat and its azimuth
  the heading's), and while rowing the page sets the orbit's target each frame so the camera follows; the orbit is
  on in look mode aboard as ashore. The phone's gestures are ignored in row mode and while rowing. `castdraw.ts`
  holds the rod from `game.anglerAt()`.
- **The boat drawn** (`src/boatdraw.ts`): a hull of painted timber (`timber` as the cabin's, `PALETTE.hull`,
  `PALETTE.gunwale`), a thwart, two oars laid in, a moving group placed each frame at the boat with its heading and
  rocking by a sway (`roll`, `pitch` from the time, as ooergolf's sway: drawing only, never the game's), the hull
  riding `game.surface` at its middle; and the **winter cover**, a canvas over the gunwales in `PALETTE.cover`
  (snow-white in winter), a part scaled to nothing unless the season is winter and nobody is aboard, handed over on
  change as the frost is. `game.boat()` reads the state, the body and what was drawn.
- **The tools.** The pace angler rows to `lake.boat.spot` on every third seed before it casts (the pace moves,
  meant; the gate is widened to no one). The fuzzer rows to random points on and off the water and NaN, lands,
  taps Row at random, and casts aboard; the invariants hold the boat.
- **Not in this slice:** drift (C3), the boat's dressing (F2), the ducklings following (stage 11).

### Acceptance criteria

1. `row` and `land` refuse as listed and otherwise board, reel in, row at `BOAT.speed` along the line, anchor and
   save: `test/boat.test.ts`, `test/game.test.ts`.
2. Aboard, a cast flies from the seat's tip, a fish is landed beside the seat and a cured one let go beside the boat;
   ashore everything is as it was to the bit (the pace and balance baselines hold exactly on the seeds that do not
   board): `test/game.test.ts`, `test/cast.test.ts`.
3. The save reads the boat back, an old save is ashore, and anything not a finite point on the water is ashore:
   `test/saves.test.ts`.
4. The mode's rules: `test/mode.test.ts`. The framings aboard: `test/lake.test.ts` (or `test/views.test.ts`).
5. The invariants: the boat's middle inside the water by `keepOff` or at its mooring; aboard implies the angler's
   place is the seat; rowing implies the lure ready and nothing hooked; the body at the boat; the save's boat where
   the boat is when anchored: `test/invariants.test.ts`.
6. End to end, `smoke/progress.spec.ts` "the boat": Row, a tap on the water, the boat seen rowing (the API reads it),
   anchored, a cast from it and a fish landed (`fishTo` aboard), Row and a tap on the bank, ashore again; the layout
   spec gains the moments `rowing` and `aboard` and the Row button.

### Edge cases (from the checklist)

- **save:** aboard at an anchorage, reloaded (aboard there); an old save (ashore); a row under way (the last
  anchorage); Start again (ashore).
- **the mode:** look, cast and row, each from each; the button and the R key; a tap on the water, the bank, the
  cabin (lands, since it is off the water) and a button; cast again aboard; the view picked while aboard (look
  mode, the camera at the view's place as named).
- **the phone:** its gestures ignored in row mode and while rowing; a flick aboard casts from the seat.
- **the layout:** the Row button at a desk's, a phone's, a tablet's and a sideways width, clear of Cast, the gauge
  and the fight; `smoke/layout.spec.ts`.
- **the day:** midnight while rowing: the yawn waits for the anchoring as it waits for a fight (`midnightWaits`),
  then yawns aboard; the wake is at home ashore (the save's `boat` cleared at a wake, since the player walks down).
  The cabin: `enter` from the boat refused (the cabin is reached from the shore), "Go to the cabin" lands first? No:
  refused aboard, the menu item greyed, said in the test.
- **the lakes:** the Reservoir's mooring and spot; travel aboard refused (land first), said.
- **the water:** a row to the shore's edge (refused by `keepOff`), to a boulder's flank (refused), across the jetty
  (refused by the path), to the deepest; the boat rides the swell.
- **the line:** a cast from the boat onto the bank, reeled in, and a row with a line out (reeled in first).
- **the fish:** a fish hooked from the boat fights as from the shore (the line knows nothing of the place); a
  cured fish let go beside the boat on the water (`RELEASE.distance` toward the middle, as ashore).
- **the contamination, the calendar, the rung, the switches:** the boat is drawn on both rungs; winter's cover
  shown by the season; the paint off draws the hull plain. **snags, drift:** not reachable.

### Decisions (mine, said so they can be changed)

- **A mode, not a long press:** rowing and pebbles both tap the water; a button is what the page already does for
  casting, and a phone has no second button.
- **Refused, not clamped:** a tap too near the shore or across the jetty does nothing, and the hint says to tap the
  water. A clamped destination would surprise more than a refusal.
- **The pace angler boards on a third of its seeds,** so the gate holds both the shore's minutes and the boat's.
- **The boat is always carried in this slice;** `Bodies.step` skips while every body is carried, so the bench's
  idle scenarios hold.

### Performance risk

A boat step a frame while rowing (a few sums) and its body `put`: nothing. A moving painted group (about 200
triangles) and the cover: under 0.05 ms, measured by `measureFrame` at the standard scene and from the boat. The
download: the boat, the mode and the draw, about 3 kB gzipped, said exactly. Pictures: every one with the jetty in
view moves (the boat moored there), the Reservoir's shore ones too (the beach mooring).

### Test plan

- **Unit:** `test/boat.test.ts` (`rowPath`, the row's sums, the state), `test/game.test.ts` (the criteria aboard),
  `test/mode.test.ts`, `test/saves.test.ts` (+corpus), `test/invariants.test.ts`, `test/boatdraw.test.ts` (the hull
  painted, built the same each time, under 400 triangles, a placement at the boat).
- **End to end:** the smoke stage, the layout moments, `game.boat()`, `game.row(x, y)`, `game.land()`,
  `game.mode('row')`, `game.anglerAt()`.
- **Fuzzer:** `row` (on the water, off it, NaN, across the jetty), `land`, a cast aboard; the invariants above; a
  coverage test that across seeds 1 to 24 the boat anchors and a fish is landed aboard.
- **Pictures:** new `boat-moored` (desk and phone), `boat-rowing`, `boat-cast` (a cast from the seat), `boat-fight`,
  `boat-winter`, `reservoir-boat`; every moved one looked at.
- **Perf and bench:** before and after; `/gate-moved` for the pace (meant) and the pictures.

### Parts

Built on `sonnet` by the `builder` agent, a part at a time, from `docs/boat.md`'s C2 section (this spec copied in).

- [ ] 0. The spec into `docs/boat.md`; the roadmap; `DESIGN.md`'s note. Check: Prettier.
- [x] 1. `BOAT`, `Lake.boat` for both lakes, `src/boat.ts`, `Game.row`/`land`/`anglerAt`/`landing`, the readers
      moved off `lake.angler`/`landAt`, `rodTip(lake, at)`, the save field and corpus, the boat's body put, the
      invariants, the determinism hash, `game.boat()`/`row`/`land`/`anglerAt`. Check: `test/boat`, `test/game`,
      `test/cast`, `test/saves`, `test/invariants`, `npm run determinism`.
- [x] 2. The page: `mode.ts` row, the Row button and its CSS and layout, the tap, the camera following and the
      framings aboard, `castdraw` from `anglerAt`, `src/boatdraw.ts` with the cover, `game.mode('row')`. Check:
      `test/mode`, `test/boatdraw`, the smoke stage.
- [x] 3. The tools: the pace angler aboard on a third of seeds, the fuzzer's actions and coverage test, the layout
      moments, the pictures. Check: `test/fuzz`, `npm run look -- -g boat`.
- [ ] 4. The pass: check, fuzz 1-24, perf before and after, mutations (a row across the jetty allowed; the landing
      not beside the boat; the save's boat not read), `/gate-moved` for the pace and the pictures, the notes.
      Commit and push.

### C2's notes (built 29 Oct 2026)

- **As built:** `src/boat.ts` is the row's sums and `Game.row`/`land`/`anglerAt`/`landing` the game's side; a `Stand`
  (the angler's place, with the boat's `heading` and `base` on the water) is what `rodTip`, the flight, the preview and
  the draw take, and ashore it is the lake's `angler` to the bit (`test/ashore.test.ts` holds five seeds to hashes taken
  before the change). The page's row mode is a third mode beside look and cast (`#rowButton`, the R key); a refused
  tap leaves it. Aboard, the shore, phone and boat framings sit behind the seat looking along the heading, and while
  rowing the page retargets the orbit on the seat each frame. The boat is four painted groups moved each frame, with
  the winter cover handed over on change. The pace angler boards on every third seed (the gate moved 2.2 to 2.07 min,
  within its tolerance, so no baseline was written); the fuzzer's boat actions are drawn from a stream of their own at
  a weight of two so the older coverage holds, and a quarter of its seeds start aboard.
- **Changed from the spec:** the layout moments and the boat pictures row out past the spot and back so the boat points
  up the lake, since a row straight from the jetty leaves the camera looking at the south bank with the fish behind it;
  the framing itself is as specified. `HAND_UP` in the draw came down from 1.2 to 0.5 so the rod's butt rests on the
  rail (ashore unmoved, since the shore keeps its hand). `land()` is refused when the straight way home crosses ground
  the boat keeps off: row to open water first.
- **The cost:** the bench within tolerance on every scenario; boot 812 ms and frame 3.99 ms in the full suite; the
  download grew by 4,157 bytes gzipped, 241,479 to 245,636. Pictures: 91 moved (the boat at the jetty or the beach,
  the Row button in every HUD) and seven are new, each looked at.
- **Bugs found in the build:** two smoke stages held the save's shape without the new field, updated.
- **Not verified:** the row in play on the live site; the boat's figures (its speed, where it moors, the hull) are
  first guesses for the play-test; nothing drifts yet.

## C3. Drift, wind and current

### Context

The fourth slice of Part C (`docs/boat.md`; C0 the rope, C1 the bobber's body and C2 the rowed boat are in, a0cb7a4).
`DESIGN.md` stage 8: "wind and current make it drift, carrying the lure and moving the line". Decided with the user
(29 Oct 2026): **a row still ends anchored**, as it does now, and the anchor is **weighed to drift** and dropped to
hold, so nothing already built moves; the control is **a third button beside Cast and Row, shown only aboard**
("Weigh anchor" / "Drop anchor", the A key), wrapping under the pair on a phone's portrait. The bobber, let go on the
water since C1, drifts whether or not the boat does, so the wind is felt from the shore too. The physics does the
carrying: the wind is a push added each step as the cast's is (`hit`, the floor's drag giving a terminal speed), and
a current is one of the package's belts. Nothing is drawn for a current in this slice: the drift shows it.

### Where it stands now (measured)

- The package's floor drag is 5.5, so a steady push `a` gives a drift of about `a / 5.5` u/s; its default
  `sleepDrift` 0.25 over 40 substeps puts to sleep anything moving under 0.75 u/s, so a slow drift needs the
  tuning's `sleepDrift` lowered (0.05, so under 0.15 u/s sleeps), given through `newWorld`.
- A world step with two awake bodies and one belt: 1.86 µs (C1's table); the bench's casting and fight scenarios
  are sunny and cast off any belt, so the resting bobber sleeps as it does now and the baselines are expected to
  hold; `/gate-moved` if not.
- The wind weather is 10 to 20% of days by season; the cast's push is 12 u/s², far too hard for a drift (2.2 u/s).

### What

- **Content.** `DRIFT` in `src/lake.ts` (first guesses): `wind: { bobber: 2.2, boat: 1.4 }` pushes in u/s² in the
  wind weather along `WEATHER.wind.direction` (terminal about 0.4 and 0.25 u/s: the pond's 67 units in four to five
  minutes of a twelve-minute day), `bank: 0.5` (how far in from the waterline a drifting bobber is held, the fish's
  own margin), `sleepDrift: 0.05`. `Lake.currents: readonly Current[]` (`src/lakes/lake.ts`:
  `{ x, y, heading, length, width, speed }`, a strip of water flowing one way); the Duck Pond's one runs from the
  falls' foot south toward the middle (length 20, width 6, speed 0.6), the Reservoir's from the middle north to the
  dam's face (length 24, width 8, speed 0.5); each lies on the water and clear of the mooring and the pace spot (a
  unit test holds it).
- **The physics** (`src/physics.ts`): `currentsOf(lake)` turns the currents into belts once (a `WeakMap`), set on
  the world at `newWorld`; `Bodies.blow(ax, ay, dt)` hits every free body; `letGoBoat()` frees the boat's body
  awake where it is and `holdBoat()` carries it again, still; `still(i, x, y)` puts a body back and stops it.
  `Bodies.step` runs the world while any body is free.
- **The game.** `BoatState.anchored` (true ashore and at every row's end). `Game.anchor(down: boolean)`: refused
  (false) ashore, while rowing, away from the pond, while a photograph is looked at, and when already so; otherwise
  weighs (the boat's body let go, `GameEvents.adrift`) or drops (held, `GameEvents.anchored(x, y)`), the save
  written. A fight neither refuses nor is refused by it. Each step: the wind blown on the free bodies in the wind
  weather; the boat adrift reads its place back from its body unless that place is off the water by `BOAT.keepOff`,
  when the body is put back and stilled (the heading holds; a drifting boat does not turn); the bobber likewise
  against `DRIFT.bank` (the lure's depth already follows the bed under its bobber each step). A row or a landing
  from adrift holds the body again. The yawn and the wake are unchanged (the wake puts the boat ashore).
- **The save.** `LakeSave.boat` gains `anchored: boolean` (default true, so every C2 save is anchored; anything not
  a boolean is true); written at a weigh, a drop and on the clock's cadence while adrift, so a load lands about
  where the boat was. `test/saves/15-adrift.json`.
- **The page.** `#anchorButton` in `#modes` after Row: hidden unless aboard at a lake with a boat, greyed while
  rowing, reading `anchorWording(anchored)` ("Weigh anchor" / "Drop anchor"), the A key; `#modes` wraps in
  portrait so it sits under the pair. Adrift, the orbit's target follows the seat each frame as it does rowing.
  `game.anchor(down)` and `game.boat()` (gains `anchored`, `adrift` body state) are the API.
- **The tools.** The fuzzer weighs and drops anchor at random from its boat stream and casts adrift; coverage asks
  that across seeds 1 to 24 the boat is weighed, drifts (moves while adrift) and is dropped again, and that a bobber
  drifts in wind. The invariants: adrift implies aboard, not rowing, the body free and the boat at it; anchored
  implies the body held; both on the water by `keepOff`; the save's `anchored` matches when not rowing; the
  bobber's body on the water (already). Determinism hashes `anchored`. Leaks: nothing new is kept (the belts are
  made once). The pace angler is unchanged (it anchors as every row does).
- **Not in this slice:** a current drawn (a dressing later), the boat turning as it drifts, snags (C4).

### Acceptance criteria

1. `anchor` refuses as listed and otherwise weighs and drops, told and saved: `test/boat.test.ts`,
   `test/game.test.ts` ("the boat adrift").
2. In the wind weather a free bobber drifts downwind at about `DRIFT.wind.bobber / 5.5` u/s and a weighed boat at
   about `DRIFT.wind.boat / 5.5`; in sunny weather off a current neither moves and the bobber sleeps as before:
   `test/game.test.ts`, `test/physics.test.ts`.
3. A bobber on a current is carried along it at its speed within half a second, and the rope's end goes with it;
   the lure's depth follows the bed: `test/game.test.ts`.
4. A drifting bobber is held `DRIFT.bank` in from the waterline and a drifting boat `BOAT.keepOff` in, never
   off the water: `test/game.test.ts` (a wind blowing straight at the bank, stepped a minute), `test/invariants`.
5. The save reads `anchored` back, a C2 save is anchored, and a load adrift drifts on: `test/saves.test.ts`.
6. Each lake's currents lie on the water clear of the mooring and the spot: `test/lakes.test.ts`.
7. End to end, `smoke/progress.spec.ts` "the boat adrift": rowed out, Weigh anchor shown and pressed, the wind
   lever set, the boat seen to move and the button to read Drop anchor, a cast whose bobber drifts, Drop anchor and
   the boat still; the layout spec's `adrift` moment holds the third button clear.

### Edge cases (from the checklist)

- **save:** adrift, reloaded (adrift there, drifting on); a C2 save (anchored); Start again (ashore).
- **the mode:** the Anchor button in look, cast and row; the A key; pressed while rowing (greyed, nothing); a view
  picked while adrift (the camera at the view from the seat, following).
- **the phone:** the phone's gestures as aboard anchored; nothing new.
- **the layout:** three buttons at a desk's, a phone's, a tablet's and a sideways width; portrait wraps the third.
- **the day:** midnight adrift (the yawn comes as anchored, the wake puts the boat ashore and anchored); the cabin
  and travel refused aboard as before.
- **the lakes:** each lake's currents; the Reservoir's boat weighed by the dam.
- **the water:** drift into the shore (held), onto a boulder's flank (held, `inside` counts boulders), under the
  jetty (held, keepOff counts it), over the shallows (the lure lifted), at the deepest.
- **the line:** a cast adrift (from the moving seat), the rope between a drifting boat and a drifting bobber; a
  bobber drifting onto the bank (held at the margin, still fishable); a reel-in and a cast take the body as now.
- **the fish:** a nibble on a drifting bobber (the fish follows the lure as it does now); a fish hooked adrift
  (the body is taken at the hook; the seat drifts; the fight is the same); a cured fish let go beside a drifting boat.
- **the weather:** wind on and off through the lever mid-drift (the push stops, the drag stills the body); rain,
  fog and the rest blow nothing.
- **the rung, the switches:** nothing is drawn, so nothing changes.
- **snags, the calendar:** not reachable.

### Decisions (mine, said so they can be changed)

- **Nothing is drawn for a current;** the drift shows it, and a visible current is a dressing of its own.
- **The boat keeps its heading adrift;** turning it to the drift is a picture change for a later slice.
- **The anchor can be weighed or dropped mid-fight;** the fight does not depend on it.
- **The wind blows only in the wind weather;** the other days are calm, as the cast finds them.

### Performance risk

A world step while a body is awake, about 2 µs, only in wind or on a current; a `hit` a step on two bodies in
wind: nothing. No new groups: the frame is untouched. The download: the button, the content and the sums, about
1.5 kB gzipped, said exactly. The bench's scenarios are calm and off the currents, so the baselines should hold.

### Test plan

- **Unit:** `test/physics.test.ts` (belts from currents, blow, let go and hold, still), `test/boat.test.ts`
  (`anchorWording`, the state), `test/game.test.ts` (criteria 1 to 4), `test/saves.test.ts` (+corpus),
  `test/lakes.test.ts` (6), `test/invariants.test.ts`, `test/mode.test.ts` if the mode changes (it should not).
- **End to end:** the smoke stage, the layout moment `adrift`, `game.anchor(down)`, `game.boat()`.
- **Fuzzer:** `weigh`, `drop` and a cast adrift; coverage over seeds 1 to 24; the invariants above.
- **Pictures:** new `wind-drift` (from the shore in wind, a cast stepped twelve seconds: the bobber downwind and
  the rope bent), `boat-adrift` (aboard, weighed, twenty seconds of wind, the button reading Drop anchor),
  `phone-boat-adrift` (the wrapped button); every moved one looked at.
- **Perf and bench:** before and after; `/gate-moved` for anything that moves.

### Parts

Built on `sonnet` by the `builder` agent, a part at a time, from `docs/boat.md`'s C3 section (this spec copied in).

- [x] 0. The spec into `docs/boat.md`; the roadmap; `DESIGN.md`'s note. Check: Prettier.
- [x] 1. `DRIFT`, `Lake.currents` for both lakes, `physics.ts` (belts, blow, let go, hold, still, the tuning),
      `BoatState.anchored`, `Game.anchor`, the step's drift and keep-off, the save field and corpus, the invariants,
      the determinism hash, `game.anchor`/`boat()`. Check: `test/physics`, `test/boat`, `test/game`, `test/saves`,
      `test/lakes`, `test/invariants`, `npm run determinism`.
- [x] 2. The page: the Anchor button and its CSS and wrap, the A key, the camera following adrift. Check: the smoke
      stage, `npm run smoke -- layout.spec.ts`.
- [x] 3. The tools: the fuzzer's actions and coverage, the layout moment, the pictures. Check: `test/fuzz`,
      `npm run look -- -g "drift|adrift"`.
- [ ] 4. The pass: check, fuzz 1-24, perf before and after, mutations (the keep-off dropped: a bobber blown onto
      the bank; the wind's push on the boat zeroed; `anchored` not read from the save), `/gate-moved` for anything
      moved, the notes. Commit and push.

### C3's notes (built 29 Oct 2026)

- **Built as specified,** with these figures found in the build: the drift runs at the push over about ten, not over
  the floor's drag of 5.5 alone, since the package's slow-speed settling (0.96 a substep) slows a body as much again,
  so `DRIFT.wind` is `bobber: 4, boat: 2.5` for the intended 0.4 and 0.25 u/s (measured 0.403 and 0.252 over ten
  seconds); a body on a current goes at about six tenths of the belt's figure (0.34 u/s on the pond's 0.6), since
  the belt's blend and the drag settle there, and the figures are left as the belt's own, said in `Current`'s
  comment. The Duck Pond's current is not from the falls' foot but down the east side, `(11.5, 6)` heading south,
  16 by 5: the north shore is nearer than the spec guessed (about y = 23), the pace angler's cast from the boat
  lands at about `(0, 22)`, and a current in the middle moved the shore's casts and `test/ashore.test.ts`. The
  Reservoir's is as specified. `sleepDrift` lives under `DRIFT`.
- **Changed from the spec:** the invariant that a cast out was thrown from where the angler stands holds the rod
  tip's height only while aboard, since the seat drifts on after the throw and dropping anchor where it got to is
  no fault (ashore it holds the place exactly); the fuzzer's keys are `weigh anchor` and `drop anchor`, since
  `drop` was the pebble's. The portrait layout's wrap is written but not reached at the Pixel's 412 px, where the
  three buttons fit in one row.
- **Bugs found in the build:** dropping anchor with a line out tripped the cast's invariant (above); the pond's
  current as first placed put the pace angler's boat cast and the shore's long casts on it, found by the lakes test
  and the ashore hashes; Vitest's worker threw "Timeout calling onTaskUpdate" with every test green once the
  fuzzer's file crossed a minute on a machine at a load of sixteen (a file of synchronous tests never reads its
  message port), fixed by a turn of the event loop before each test (`test/setup.ts`), seen on the parent commit
  under the same load.
- **Noticed and left:** a bobber that lands within `DRIFT.bank` of the shore is held where it landed and never
  drifts; while yawning the boat adrift holds still (the night's step), and the wake puts it ashore.
- **The cost:** the bench within tolerance on every scenario, read alone on a quiet machine (casting and sinking
  within five percent of its baseline either way across three runs; an earlier run at a load of twenty read the
  parent commit slower than its own baseline too, so nothing was written); the pace 2.2 to 2.07 min as C2 left it;
  the balance's sixty cells unmoved; boot 849 ms and frame 4.00 ms in the full suite; the download grew by 1,031
  bytes gzipped, 245,636 to 246,667. Pictures: three new and three moved (the boat's, gaining the Anchor button),
  each looked at.
- **Not verified:** the drift in play on the live site; every drift figure is a first guess for the play-test.

## Verification, every slice

`npm run check` green; `npm run fuzz -- --seeds 1-24` clean; `npm run perf` alone, before and after; the bench's
moved baselines written from two readings that agree with the machine idle; every moved picture looked at (the rope's
sag read as a line's); the pace and balance baselines unmoved. Built by the `builder` agent on sonnet a part at a time
from `docs/boat.md`, as the slices before were.
