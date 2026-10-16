# The fight: keep the fish in the zone

## Context

The lake lab can already be fished from the cast to the bucket. The fight is a tension gauge, though: reel while the
fish rests and let go while it pulls, with one bar to watch. From three playable mocks, the user chose option B, "keep
it in the zone", as the better game mechanic: "C is the more realistic, but B is a better game mechanic". The cast,
the bite and the strike stay as they are. Only the fight, from the strike to landed or slipped, changes.

## What

Once a fish is hooked, a bar stands beside the Reel button. On it:

- **The fish** darts up and down the bar. It rests, then darts to a new place, by the game's seeded chance. A heavier
  fish darts faster, and a sick lake's fish rests less, so it darts more often.
- **Your zone** is a band on the bar. Holding the reel (the button, space, or a hold on the water in cast mode, which
  are the inputs that reel now) pushes it up. Let go and it falls back, with a little weight to it, as in the mock.
- **The catch meter** fills while the fish is inside your zone and drains while it is outside. Full, and the fish is
  landed. Empty, and it slips off with nothing lost, as a slip does now.

In the lake, the fish is where the meter says. As the meter fills, it is drawn in along the line toward the shallows
below you, and as the meter drains it swims back out. A full meter is the fish at the landing spot. The rod's bend
and the line's colour, from white to red, follow how far the fish is outside your zone, so the strain is seen in the
lake as well as on the bar. "Too tight" no longer loses the fish; only the empty meter does.

## Where it stands now (measured, 40 seeds, the pace gate's angler)

- A fight takes **27.2 s** at the median, 19.7 s at the shortest and 35.6 s at the longest. 120 fish were landed and
  none slipped.
- The pace gate: **2.13** game minutes to land three fish (`scripts/pace-baseline.json`).
- The mock's numbers gave a perfect player about 4 s, so they will be tuned in the build.

## Acceptance criteria

1. Holding moves the zone up and letting go lets it fall. The zone never leaves the bar.
2. The meter fills while the fish is in the zone and drains while it is out, at rates in `FIGHT`.
3. A full meter lands the fish, raising `landed` with its kind and weight, as now. An empty one slips it off, raising
   `slipped`, and the lure sinks on where it was, as now.
4. Never holding loses the fish, and so does holding the whole time. Each is a unit test on several seeds.
5. The careful angler, which reacts a quarter of a second late, lands at least 90% of its fish over 40 seeds, with a
   median fight of 15 to 25 s (decision 2).
6. The meter starts part-filled (0.3), so a fumble in the first moment does not lose the fish.
7. In the lake, the fish's distance from the landing spot follows the meter, and a full meter is within `landWithin`.
8. A sick lake's fish darts more often than a clean lake's one, and a heavier fish darts faster. These are unit tests
   on the dart counts and speeds.
9. On the page, the bar shows the zone, the fish and the meter while a fish is on, and is hidden otherwise. It is
   played by the Reel button, space and a hold, in the end-to-end test.
10. The same seed plays the same fight. The determinism hash includes the zone, the fish on the bar and the meter.

## Edge cases

- **the mode:** look and cast both use `game.reel()` as now, so the button, space and the hold work unchanged. Leaving
  cast lets go of the reel (the zone then falls), as now. Casting again while a fish is on is refused, as now.
- **the line:** the bite and the strike are unchanged. When the fish slips off, the lure sinks on where it was, as
  now. A blur of the page lets go of the reel.
- **the fish:** one fish at a time. A hooked fish keeps to the lake, and its depth along the line follows `out` as
  now. The invariants hold every joint in the water.
- **the water:** a fish hooked near the shore starts close in, and the most line out is still `FIGHT.spool`.
- **phone:** the bar sits beside the button above the folded panel, and is pictured at a phone's width. The rung does
  not touch it.
- **the rung, the lab:** the bar is the same on full and lean, by day and by night, and with the lake clear or sick.
- **scale, save:** nothing is kept and nothing is saved. The bar is one fixed set of DOM nodes, written only when
  something changes.
- The boat, the calendar, the cabin and the real clock are not reachable.

## Decisions (agreed 16 Oct 2026)

1. **Where the bar sits:** upright, just left of the Reel button.
2. **How long a fight is:** about 20 s for a careful player. The pace gate's figure moves on purpose.
3. **Whether a heavier fish fights harder:** yes, a heavier fish darts faster, by one figure in `FIGHT`.

## Performance risk

The sums are a handful a step, so the bench should not move beyond its ±15%. The page writes a few style values a
frame, only when they change, rounded to a pixel. Removing the SVG arc changes the download a little, so the perf
baseline will be written again to the byte, with the figure given. The frame budget is not at risk. It will be
measured against the parent commit in the pass.

## Gates that move on purpose (through `/gate-moved`, with the reason in the commit)

- **pace:** the angler plays a different game, so its figure will move.
- **look:** the fight picture shows the bar and not the arc.
- **perf:** the download moves by a few hundred bytes.
- **bench:** this only moves if the measurement says so.

## Files

- `src/line.ts`: rewritten as the zone fight. `Line` keeps `out`, `tension` and `pulling`, which the rest read, and
  gains `zone`, `fishAt`, `target` and `meter`. `start(out, heft, random)` and
  `step(dt, holding, hot, random): Fight` are its interface, and it holds no game state.
- `src/lake.ts`: `FIGHT` replaced, with comments on how each figure was measured: the zone's width, its push and fall,
  the meter's fill, drain and start, the dart speed, the rest and dart times, `sickRest`, the heavy fish's speed, the
  tension's sums, `spool`, `landAt` and `landWithin`.
- `src/game.ts`: the strike rolls the weight before `line.start`, and the fight reads `out` from the meter. Otherwise
  as now.
- `src/angler.ts`: plays the bar with a reaction delay of its own, from a ring buffer sized once. It holds while the
  fish is above the zone's middle.
- `src/fightview.ts`, `index.html`: the upright bar, with its zone, fish and meter, in place of the arc.
- `src/debug.ts`: `fishing()` gains `zone`, `width`, `fishAt` and `meter`. `fishTo('fight')` stops a few seconds in
  with the fish in the zone.
- `scripts/fuzzer.ts`, `scripts/determinism.ts` and `scripts/bench.ts` play by the bar and not by the tension.
  `determinism.ts` also hashes the new fields.
- `src/invariants.ts`: the zone, the fish and the meter on the bar, from nought to one.
- Tests: `test/line.test.ts` rewritten, `test/game` and `test/pace.test.ts` updated, the fight's tension test in
  `test/castdraw.test.ts` kept, `smoke/progress.spec.ts`'s fight played on the bar, and a phone-width fight picture in
  `smoke/look.spec.ts`.
- `CLAUDE.md`: the fishing paragraph says the fight is the zone.

Out of scope: the cast, the bite and the strike, kinds of fish, sound, and the physics.

## Parts

- [x] 1. `line.ts` and `FIGHT`: the zone fight's sums. `test/line.test.ts` is green, covering criteria 1 to 4, 6
      and 8, and is seen failing first.
- [x] 2. `game.ts` wired: the meter sets `out`, and the weight sets the heft. A game test of landing, slipping and
      following the meter (criteria 3 and 7) is green.
- [x] 3. The angler, the fuzzer's watcher, the bench and the determinism script play the bar, and the invariants are
      added. Criterion 5 is measured over 40 seeds, `FIGHT` is tuned to decision 2, and `test/pace.test.ts` is green.
- [x] 4. The test API: the new fields in `fishing()`, and `fishTo('fight')`.
- [x] 5. The page: the bar in `fightview.ts` and `index.html`. `check:quick` is green.
- [x] 6. The smoke test plays the fight on the button by the bar (criterion 9), and a picture is taken at a phone's
      width.
- [x] 7. The pass: `npm run check`, `npm run fuzz -- --seeds 1-24`, perf against the parent, the pictures looked at,
      the new tests mutation-checked, and the moved gates written through `/gate-moved`.

### Where part 7 stands (16 Oct 2026)

Green: `check:quick` (464 tests), the fuzzer, `fuzz --seeds 1-24` (34 hooked, 16 landed, 8 slipped, no rule broken),
determinism, leaks, the bench (every scene within ±6%), pace (2.13 to 1.93 min, inside ±20%, baseline kept), the smoke
and the look. Fourteen mutations of the new rules were each caught. The download moved 119000 to 119598 bytes, which
was meant, and is written. The pictures `fishing-fight-dusk`, `fishing-landed` and `phone-fight` were written again,
and `desk-fight` is new, each looked at.

The perf frame, left open while the machine was busy (load 5 to 6, the same build reading 3.6 to 5.6 ms and the
parent in turn 5.49 and 5.63), was run again quiet: 3.61 ms against the baseline of 3.54, within tolerance, with boot
778 ms and the water's frame 3.76 ms by day and 3.72 by night. No baseline was written again. The pass is clean.
