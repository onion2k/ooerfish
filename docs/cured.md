# Cured fish go back into the pond

## Context

The pond now cures: each fish stowed adds one to `save.cured`, and the water clears a twelfth of the way
(`CURE.toClean`, 12). But the cured fish vanishes. `Game.stow` calls `School.respawn`, and a new glowing fish
takes its place at once, so the pond always holds 6 glowing fish (`FISH_COUNT`). The user dropped the separate
aquarium: with one kind of fish it would only count catches. Instead, a cured fish goes back into the pond,
healthy, and swims there in its new colours, so the game is about curing fish rather than capturing them.

**Chosen by the user (17 Oct 2026):**

- The cured look is B with a glow: a warm gold body, coral fins and a faint warm glow. It was mocked in the real
  renderer, in a throwaway copy, variant `d`.
- Cured fish never bite again. The story: the player's bait is one that only uncured fish will take.

## What

- Stowing a landed fish cures it and lets it go. It drops into the water just out from the angler, with a
  splash, and swims off in the cured look. From then on it wanders with the school and never comes to the lure.
- No new glowing fish replaces it. The pond holds a fixed number of fish, **as many as it takes to clean it**,
  all glowing at the start. Each cure turns one gold, so the green thins out and the gold fills in as the water
  clears. When the last is cured the pond is clean, and "Every fish is cured" is literally true.
- In a clean pond nothing takes the bait. The cast line says so ("the pond is clean: nothing takes this bait"),
  and casting and reeling in still work.
- A reload shows the same number of gold fish as the save says have been cured.

## Where it stands now (measured)

| Figure                                | Now                                        | Source                                       |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| Fish in the pond                      | 6 glowing, each replaced when stowed       | `FISH_COUNT`, `Game.stow` / `School.respawn` |
| Fish to clean the pond                | 12                                         | `CURE.toClean`                               |
| Most fish the pools hold              | 32                                         | `FISH_CAPACITY`                              |
| A step of the lake                    | 0.0017 ms at 6 fish; 0.0086 ms full, at 32 | bench (`npm run check`, 17 Oct)              |
| A frame at the standard scene         | 3.6 ms, budget 8                           | perf                                         |
| Pace: game minutes to land three fish | 1.79 against a baseline of 2.13 (±20%)     | pace gate                                    |

Doubling the pond from 6 fish to 12 costs about 0.002 ms a step, read off the bench's two points (an estimate).
The six fish drawn extra are 36 more placements in groups that already exist. Pace will move: more fish to bite
early on, and fewer as they are cured.

## Acceptance criteria

1. A new game has `FISH_COUNT` fish, all glowing, and `FISH_COUNT` is what it takes to clean the pond: one
   figure, with `CURE.toClean` read from it, or the other way round.
2. Stowing a landed fish marks that fish cured. It stays in the school, with no respawn, at a point in the water
   just out from the angler (on the water by `inside`), and a splash is told there.
3. A cured fish is never chosen to come to the lure, and so is never nibbling, biting, hooked or landed. This
   holds when it is the nearest, and when the bait is twitched.
4. Once every fish is cured, nothing comes to the lure however long it sinks, and the cast line says the pond is
   clean.
5. Loaded from a save with `cured` n, the first min(n, `FISH_COUNT`) fish are cured. A save with more than that
   (old saves allowed any count) is all cured, and loads without complaint.
6. Each fish is drawn glowing green (as now) or cured: body [1, 0.7, 0.22], fins [1, 0.42, 0.38], glowing
   [1, 0.78, 0.42] at 0.25 on the body and 0.12 on the fins. A fish drawn changes look in the frame after it is
   cured, including when the contamination did not change (the lab lever's clean pond).
7. `game.fish()` gives each fish's `cured`. The invariants hold that the number cured is min(save.cured,
   `FISH_COUNT`) and that no cured fish is the bite's.

## Edge cases (from the checklist)

- **save:** no new field. Cured fish are rebuilt from `cured`. An old save without the field loads as 0, and one
  past the pond's size loads as all cured (criterion 5). The corpus needs no new shape.
- **scale:** 12 fish of a capacity of 32, measured by the bench and perf. Never above capacity, held by a test.
- **phone:** the cured look in the phone-width pond pictures. The phone's word in a clean pond is "Cast", and
  casting still works.
- **the mode:** look and cast unchanged. A tap strikes on a sinking lure even in a clean pond (and finds
  nothing).
- **the rung:** full and lean draw the same fish.
- **the lab:** the dirt lever (`game.dirt`) moves the water only, not the cured fish. Each time of day: the
  cured glow shows faintly at night (from the mock).
- **the water:** a released fish is placed on the water and kept in it, by the existing fish invariants.
- **the line:** cast and sunk in a clean pond, nothing comes; reeled in. A fish half-cured while hooked is not
  possible: only a landed fish is stowed.
- **the fish:** wandering, drawn to the lure (glowing only), fleeing a splash, hooked. A cured fish in the
  bite's reach, alone, is not chosen.
- **snags, the boat, the calendar, the real clock, the cabin:** not reachable yet.
- **the day:** unchanged, including at night.
- **the lake's contamination:** only the cure lowers it, as now. All fish cured means clean.

## Decisions (yours)

1. **The pond holds as many fish as it takes to clean it: 12** (recommended). That's `CURE.toClean`, which the
   branch marked an estimate. The alternative is to keep 6 fish and clean in 6, a pond done twice as fast.
2. **The cast line in a clean pond** says "the pond is clean: nothing takes this bait" (recommended), rather than
   nothing at all. When the cabin and other lakes come, this is where a nudge onwards would go.
3. **Where a released fish goes:** a few units out from the angler, toward the middle of the pond, with a small
   splash (recommended), rather than the spot it was hooked.

## Performance risk

- **Frame:** 6 more fish drawn, and a cure re-handing the fish's groups to the renderer (the glow is uploaded
  only with the groups; colours alone could go through `tint`). The re-handover happens once a cure, not each
  frame. Measured in the pass: perf against the parent commit, and the frame paired at the standard scene with 0
  and 12 cured.
- **Step:** the bench's scenes at 12 fish. A move in its baseline would be meant, and decided through
  `/gate-moved`.
- **Download:** a few hundred bytes. The baseline is written through `/gate-moved`.
- **Pace:** it will move (more fish early, fewer that bite later). It is written again through `/gate-moved`,
  with the reason.

## Design

- `src/lake.ts`: `FISH_COUNT` becomes 12, and `CURE.toClean` reads it, so it is said once. `CURED_LOOK` holds the
  chosen colours and glows. `RELEASE` says how far out a released fish is placed, as a first guess.
- `src/fish.ts`: `School.cured`, a `Uint8Array(FISH_CAPACITY)` (sized once, never grows). `cure(i, x, y,
heading)` marks fish `i` and places it, and `curedCount()` reads them. `fill` takes how many start cured.
- `src/bite.ts`: the choice loop skips a cured fish before its chance is drawn, so a cured fish costs no draw.
- `src/game.ts`: `stow` cures the landed fish and releases it with a splash (no `respawn`). The constructor fills
  the school with `min(save.cured, FISH_COUNT)` cured. A `pondClean` getter is added.
- `src/fishdraw.ts`: `groups()` writes each fish's `materials` and `patterns` from `school.cured`. It is handed
  the school, or a reader of it. `CURED_LOOK`'s colours are handed in, since a lower module does not import
  content.
- `src/main.ts`: re-hands the fish's groups when the cured count changes, beside the contamination check it
  already has (`watered`). It also gives the cast line's words for a clean pond.
- `src/debug.ts`: `fish()` gains `cured`.
- `src/invariants.ts`: two new rules (criterion 7).
- `scripts/determinism.ts`: the cured flags go into the hash.
- `scripts/fuzzer.ts`: no new action, since stowing already exists. The fuzzer's lake now runs down to clean,
  and a seed that cures all 12 is held by a reach test.
- `docs/cured.md`: this spec, kept in the repo with its boxes. `CLAUDE.md`: a line on the cure and the release.

Out of scope: the cabin and its curing machine; naming fish; letting fish go; more lakes; the journal; a renderer
call to rewrite patterns without re-handing the groups (a package change).

## Test plan

- **Unit:**
  - `test/fish.test.ts`: cure marks and places, the count is held, and `fill` with cured.
  - `test/bite.test.ts`: a cured fish, nearest and twitched, never comes, and an all-cured pond never bites
    over a long sink.
  - `test/game.test.ts`: stow cures without a respawn, the splash is told, the count matches the save, a reload
    rebuilds, a save past the pond's size, and the pond clean at `FISH_COUNT`.
  - `test/fishdraw.test.ts`: each fish's colour and glow follow `cured`.
  - `test/lake.test.ts`: `CURE.toClean` equals `FISH_COUNT`, at or under capacity.
- **End-to-end (`smoke/progress.spec.ts`):**
  - land, then tap the card, and see `game.fish()` show one cured, near the angler, still in the water;
  - fish on (`fishTo`) and see the bite never take a cured fish;
  - from a save of 11, cure the last, and see the cast line's clean-pond words after a long sink with nothing
    coming.
- **Fuzzer:** the existing actions over 24 seeds, with the new invariants. A reach test that some seed cures the
  pond clean.
- **Pictures:**
  - `desk-pond-playing` and `phone-pond-playing` (8 cured) now show 8 gold fish among 4 green, meant, and are
    written again and looked at;
  - `desk-pond-clean` all gold;
  - a new picture by night with half cured, for the faint glow;
  - every canvas picture with 0 cured is unchanged.
- **Mutation:** a cured fish allowed to bite, a respawn kept in `stow`, the look not re-handed when the
  contamination is unchanged, and a reload ignoring the save. Each must fail its test.

## Parts

- [x] 1. **The school knows cured fish:** `School.cured`, `cure`, `fill` with cured; `FISH_COUNT` 12 with
      `CURE.toClean` read from it. Check: fish and lake unit tests, seen failing first.
- [x] 2. **Cured fish never bite; stow releases:** `bite.ts` skips cured, `Game.stow` cures and releases with a
      splash, the save rebuilds on load, and the invariants. Check: bite and game unit tests, invariants.
- [x] 3. **The cured look:** `fishdraw.ts` from `school.cured`, `CURED_LOOK`, re-handed on a cure. Check:
      fishdraw unit test, and a headless picture looked at.
- [ ] 4. **The page and the API:** the clean-pond cast line, `game.fish()` cured, the determinism hash, the
      fuzzer's reach test. Check: the end-to-end steps, `check:quick`.
- [ ] 5. **The pass:** the full check, fuzz on seeds 1 to 24, pictures written again and looked at, perf,
      bench and pace through `/gate-moved`, the mutations, `docs/cured.md` and `CLAUDE.md`, and the report.
