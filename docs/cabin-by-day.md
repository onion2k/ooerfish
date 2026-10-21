# Into the cabin by day: a menu item and a tap on the cabin walk the player in, and out again at the same time

## Context

The cabin is where the player wakes, and the only way in is to sleep: the yawn at midnight, "Go to bed" or "Sleep
through…". The calendar, the map and the shelves are only ever seen on waking. The user asked for a way in by day
(21 Oct 2026): a "Go to the cabin" item in the ⋯ menu, and a tap on the cabin from the shore. Inside, time stops as
the design says the cabin does, and "Out to the <lake>" brings the player back to the same lake at the same time.

## What

- **`Game.enter()`:** refused (false) with a fish hooked or landed, while yawning or leaving, in the cabin already,
  or at a lake without a cabin (the Reservoir: see below); otherwise it reels the lure in and lets the reel go as the
  yawn does, sets `place` to `cabin` with the fade at full and fading in over `NIGHT.fadeIn` (as a wake does), keeps
  the clock, the day, the fish, the heal and the splashes exactly where they are, and persists (the save's `place`
  is `cabin`, its `time` the clock as it was, so a load lands in the cabin and `out` resumes the same time). It tells
  `GameEvents.entered`. `out()` is unchanged: the place goes back to the pond and the clock runs on from where it
  held. The invariants' rule that the cabin's clock is dawn **changes**: the clock holds in the cabin (unchanged while
  `place` is `cabin`, which the held-still rule already says), at whatever time; a cabin save's `time` is kept rather
  than forced to dawn (`progress.ts` and `Game`'s constructor), with the corpus file `08-cabin.json`'s read updated.
- **From the Reservoir:** "Go to the cabin" is a journey home into the cabin: `Game.travel(HOME.id, 'cabin')` takes a
  destination place, and `persist` while leaving writes it, so the reload lands in the cabin at home with the clock
  as it was. The tap has no cabin there.
- **The words:** the morning line becomes the cabin's line: "Day N. Morning at the cabin." at dawn as now, and by the
  look of the clock otherwise: "Afternoon at the cabin." by day, "Evening" at dusk, "Night" at night
  (`nightWords(place, day, fighting, lakeName, timeName)`, pure; the moon line as now). "Out to the <lake>" as now.
- **The menu:** "Go to the cabin" (`#cabinButton`, between "Lakes" and "Pair a phone"), greyed mid-fight and in the
  cabin, calling `enterCabin()` in `main.ts`: at home `game.enter()` then the pillow view in look mode; elsewhere the
  journey home.
- **The tap:** in look mode at a lake with a cabin, a tap (not a drag) whose ray meets the cabin's box (`cabinHit`
  pure in `src/cabin.ts` or `src/pick.ts`: the ray against the cabin's axis-aligned box from `CABIN_AT`, the body's
  size and height, as `mapHit` meets the map's rectangle) enters the cabin instead of dropping a pebble; in cast mode
  a tap strikes as now. A paired phone's gestures are untouched.
- **The test API:** `game.enter()`, `game.cabinOnScreen()` (the cabin's centre in CSS pixels, for the stage's tap).
- **The fuzzer:** an "into the cabin" action at the pond, refused as bed is, counted; the leave-the-cabin timer
  already takes the player out.

## Acceptance criteria

1. `enter()` from the pond at 0.6 lands in the cabin with the clock 0.6, the day unchanged, the fish and the heal
   where they were, the fade in from full; `out()` resumes at 0.6; refused mid-fight, yawning, leaving, in the cabin,
   and at the Reservoir; the save after `enter` reads `place: 'cabin', time: 0.6` and loads so.
2. The line in the cabin reads Morning/Afternoon/Evening/Night by the clock's look, the moon line as now.
3. "Go to the cabin" in the menu enters at home and journeys home into the cabin from the Reservoir; a tap on the
   cabin from the shore in look mode enters, a tap on the water drops a pebble as now, and a tap in cast mode strikes.
4. Every existing picture unchanged but the menu's (its new item) and any morning picture whose words change (none:
   a wake is at dawn); new pictures `cabin-afternoon` (entered by day) and `desk-menu-open` rewritten.
5. The fuzzer enters and leaves the cabin at random over seeds 1 to 24 with no rule broken; determinism unchanged.

## Edge cases

- **save:** a cabin save at 0.6 loads in the cabin at 0.6 (new); old cabin saves at dawn as before; `08-cabin.json`
  now keeps its 0.6.
- **the day:** entering just before midnight and going out: midnight comes at the pond as now; entering with the
  yawn owed (midnight passed mid-fight) is refused as yawning; sleeping from inside the cabin as now.
- **the mode:** a tap on the cabin in cast mode strikes or does nothing as now; the tap in look mode only.
- **the lakes:** the Reservoir's menu item journeys home into the cabin; the tap there hits nothing.
- **the phone:** the menu item at the phone's width in the layout spec's menu moment; the tap on a phone is the
  same tap.
- **the rung, the switches, the water, the line:** unchanged.

## Decisions (mine)

- **The cabin's clock holds at any time** rather than snapping to dawn: it is the design's "time passes only while
  the player is out", and a wake still sets dawn itself.
- **Walking in has no fade-out,** only the fade in, so it feels like stepping through the door, not a night.

## Test plan

- **Unit:** `test/game.test.ts` or `test/cabin.test.ts` (`enter`, the refusals, the clock held, the save, `travel`
  with a destination), `test/invariants.test.ts` (the dawn rule gone, the held-still rule kept), `test/saves.test.ts`
  (`08-cabin.json` keeps 0.6; a cabin save at a time), `test/nightview.test.ts` (the four lines),
  `test/pick.test.ts` or `test/cabin.test.ts` (`cabinHit`: a ray at the cabin's middle hits, one at the water misses).
- **Stages, `smoke/progress.spec.ts` "the cabin by day":** the menu item enters at 0.6 and the line reads
  "Afternoon", `out` resumes; the tap through `cabinOnScreen` enters; a tap on the water still drops a pebble; the
  Reservoir's item journeys home into the cabin; refused mid-fight (greyed).
- **Pictures:** `cabin-afternoon`; `desk-menu-open` rewritten.
- **Fuzzer and determinism** as above; `npm run check` green.

## Parts

Built on `sonnet` by the `builder` agent in one go, from `docs/cabin-by-day.md`, this spec copied into the repo.

- [x] 0. The spec in the repo.
- [x] 1. `Game.enter`, the clock held, the save, the words, the invariants, `travel`'s destination.
- [x] 2. The menu item, the tap, the API, the stages, the pictures, the fuzzer.
- [x] 3. The pass: `npm run check`, fuzz 1-24, the mutations (the clock snapped to dawn on enter; the tap entering
      in cast mode), the report. Commit.
