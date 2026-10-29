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

## Verification, both slices

`npm run check` green; `npm run fuzz -- --seeds 1-24` clean; `npm run perf` alone, before and after; the bench's
moved baselines written from two readings that agree with the machine idle; every moved picture looked at (the rope's
sag read as a line's); the pace and balance baselines unmoved. Built by the `builder` agent on sonnet a part at a time
from `docs/boat.md`, as the slices before were.
