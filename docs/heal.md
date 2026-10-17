# The pond heals gradually

## Context

The user played the game and found that when a fish is cured, the pond changes colour all at once. It should heal
gradually instead. Today `Game.stow` drops `contamination` a twelfth in one step, and the page re-hands the water's
groups at the new value in the next frame. The user chose to do this before the harder fights and the gear.

## What

- After a cure, the water heals from where it was to where the cure puts it over `HEAL.seconds` of game time. It
  eases out: most of the change comes early, so the cure is seen to do something at once, and then it settles.
- Two cures close together keep healing toward the newer target, never jumping.
- The pond's gauge steps at once (the cure happened) while the water catches up.
- A paused game heals nothing. A load from a save opens on the water as clean as the save says, with no healing.
- The lever (`game.dirt`, for the tests and pictures) sets the water at once, as now.

## Where it stands now (measured 17 Oct, headless, at 1280×800)

| Figure                                                        | Now                                         | Source                                            |
| ------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| One cure's change to the water                                | a twelfth (0.083), in one frame             | `CURE.toClean` 12, `Game.stow`                    |
| A handover of the water's groups (`setDynamic` and `prepare`) | 0.5 ms at the median (0.2 to 0.9), 24 timed | the test API's `dirt`, against the preview server |
| A frame at that scene                                         | 4.06 ms (budget 8)                          | `measureFrame`                                    |

**What depends on the contamination:**

- The water's **groups**: the shallow colour (the group's albedo) and the deep colour (its pattern). Patterns go to
  the GPU only with a handover, and a handover makes new buffers.
- The **look's uniforms**: clarity, caustics, the near colour and the sparkles. These are written cheaply, but
  each write builds a look object.

Either way, "nothing is made each frame" rules out a handover or a look write every frame for 30 s.

**The design that fits:** the water is drawn at a value that moves in fine steps of `HEAL.step` (1/480 of sick to
clean, an invisible 0.2% of the colour). A cure's twelfth is then 40 steps, about one every 0.75 s over 30 s, each
costing about 0.5 ms once. No frame does a handover unless the drawn value has moved a whole step.

## Acceptance criteria

1. `Game` keeps `waterDirt`, the contamination the water shows. Each `step(dt)` moves it toward `contamination` by
   an ease-out over `HEAL.seconds` of game time, and never past it. Paused (`dt` 0), it does not move.
2. A cure leaves `contamination` lowered at once, as now, while `waterDirt` starts where it was. After
   `HEAL.seconds` it equals `contamination` exactly, not merely near it.
3. A second cure while healing retargets with no jump: `waterDirt` is continuous across the cure, and still
   eases.
4. `waterDirt` never rises except by the lever, and is never below `contamination`. Both are invariants.
5. `setContamination` (the lever) sets `waterDirt` too, at once. A new `Game` (a load) starts with `waterDirt`
   equal to `contamination`.
6. The page draws the water, the look's uniforms and a splash's droplet colour at `waterDirt`, quantised to
   `HEAL.step`. It hands the water over again only when the quantised value changes: at most `1 / HEAL.step` times
   in a heal, and never in a frame where it has not moved.
7. The gauge (`pondview.ts`) still reads the cure count, so it steps at once.
8. The fight's sick-lake rests (`line.ts`) still read `contamination`, the truth, not the water's look.

## Edge cases (from the checklist)

- **save:** no new field. `waterDirt` is not saved, and a load starts healed. An old save is unaffected.
- **scale:** at most 40 handovers a cure, 0.5 ms each. Twelve cures in a row heal one after another at no extra
  cost.
- **phone:** the same on a phone; the phone page is not touched.
- **the mode, the rung:** unaffected; full and lean heal the same.
- **the lab:** the lever sets at once; each time of day heals the same.
- **the water:** above and under, the same drawn value.
- **the day:** healing runs on game time, so paused it holds, and it runs at night as by day.
- **the lake's contamination:** the truth only ever goes down by a cure, as now, and the water follows it down. A
  fully clean lake heals to 0 and stays there.
- **the cabin, snags, the boat, the calendar, the real clock:** not reachable.

## Decisions (yours)

1. **How long a cure takes to heal:** **30 s of game time** (recommended). That's long enough to watch while
   casting again, and short against a 720 s day. Alternatives are 15 s (brisk) or 60 s (slow and calm).
2. **The curve:** **ease-out** (recommended): half the heal in about the first fifth, so the cure reads as doing
   something at once. Linear is the alternative, which reads as mechanical.
3. **The gauge:** **steps at once** (recommended), as a receipt for the cure, while the water catches up.
   Alternatively it eases with the water.

## Performance risk

- **Frame:** a handover costs about 0.5 ms, at most every 0.75 s while healing, and nothing otherwise. That
  stays inside the 8 ms budget with room. It is measured in the pass: the frame and its worst during a heal, by a
  headless run that times every frame of a 30 s heal.
- **Garbage:** a handover makes buffers, but 40 a cure is tolerable. The leak run watches the heap.
- **Download:** some tens of bytes, written through `/gate-moved`.
- **Pace and bench:** none expected, since the fight reads the truth.

## Design

- `src/lake.ts`: `HEAL = { seconds: 30, step: 1 / 480 }`, first guesses, with a comment.
- `src/heal.ts` (new, pure): `healToward(from, start, target, elapsed, seconds)`, the ease-out. The game keeps
  where the heal started and when, and retargets from the current value on a new cure. Unit-tested alone.
- `src/game.ts`: `waterDirt`, its heal state, and the step. `setContamination` and the constructor set it.
- `src/main.ts`: `showWater()` and `finish()` read `quantised(game.waterDirt)` (a pure helper beside `heal.ts`),
  and the frame loop calls `showWater` when the quantised value has changed, keeping its `watered` check. Splash
  droplets use `waterDirt`.
- `src/debug.ts`: `state()` gains `waterDirt`, and `drawnDirt` keeps reading what was handed over.
- `src/invariants.ts`: criterion 4's rules.
- `scripts/determinism.ts`: `waterDirt` is hashed.

Out of scope: the harder fights and the gear (the next feature); a renderer call to rewrite a group's pattern
without a handover (a package change, which would allow every frame).

## Test plan

- **Unit:**
  - `test/heal.test.ts`: the curve at 0, a fifth, half and the end; exact at the end; never past the target;
    retargeting continuous.
  - `test/game.test.ts`: a cure, then the steps; paused holds; two cures; the lever; a load.
  - The quantising helper.
- **End-to-end (`smoke/progress.spec.ts`):**
  - a cure, then `drawnDirt` read over stepped frames: it moves in steps toward the target, and the number of
    handovers is counted and held under `1 / HEAL.step` a heal (`game.waterHandovers()`, a count on the test API);
  - the gauge is at the new count on the frame after the cure.
- **Fuzzer:** no new action (stowing and the lever already exist). The new invariants hold over seeds 1 to 24.
- **Pictures:**
  - a new `healing` picture, a second into a heal at a desk's width, for the look of mid-heal;
  - the clean-pond pictures are taken after `HEAL.seconds` has passed, so they still show the clean pond;
  - every other picture unchanged.
- **Mutation:** the water drawn at `contamination` (a jump); healing that runs while paused; a handover every
  frame while healing; the lever not setting `waterDirt`. Each must fail a test.

## Parts

- [x] 1. **The heal in the game:** `heal.ts`, `HEAL`, `Game.waterDirt`, the invariants and the hash. Check: unit
      tests seen failing first, `check:quick`, fuzz on seeds 1 to 24.
- [ ] 2. **The page draws the heal:** quantised drawing, the handover only on a step, droplets, `state()` and the
      handover count. Check: the end-to-end steps.
- [ ] 3. **The pass:** the full check, the frame during a heal measured, pictures (`healing` new, clean ones
      re-taken after the heal) looked at, the mutations, `CLAUDE.md`, `docs/heal.md` and the report.
