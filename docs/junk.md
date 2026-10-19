# Junk treasures on the pond's bed, and the cabin's shelves

## Context

Stage 4's first slice is in (`docs/journal.md`, commit 7bfe2fe): three kinds of fish, two drums of waste counted in
the cleaning, and a journal behind the ⋯ menu. The rest of stage 4 is the junk treasures `DESIGN.md` lists: old
lures, Sunny Atom merchandise, message bottles and a rubber duck from every lake. They come up on the line and are
kept on the cabin's shelves. This slice brings them to the Duck Pond.

It also puts right what the last spec got wrong. `docs/journal.md` named the aquarium as the next slice. The user has
dropped it for good: a cured fish is always let go at once, so there is nothing for a tank to hold. The aquarium's
lines in `DESIGN.md`, `docs/journal.md` and `CLAUDE.md`'s checklist are taken out or reworded in this slice.

**Chosen by the user (19 Oct 2026):**

- **The treasures lie on the bed,** like the drums: each at a place of its own seed. A lure left lying near one snags
  it, it reels in quickly, never slips, and once found it's gone from the bed. The pond holds a fixed set to find.
- **Six in the Duck Pond:**
  - an old lure;
  - a Sunny Atom mascot plush;
  - a Sunny Atom lunchbox;
  - a "Safety First!" badge;
  - a message bottle;
  - the pond's rubber duck.

  None of them cleans the pond. With the two drums, that's eight things on the bed.

- **The bottle holds a short note:** a few lines from someone in town, shown on the card when found and kept in the
  journal. Its words are a placeholder until the story's words are decided (`DESIGN.md`, what is not decided).

Later slices: other lakes' sets and their ducks, the found-and-painted lures (a separate collectable that changes the
lure's look), the logbook's pages (stage 7), the wall's postcards and calendar.

## What

- **On the bed.** Each treasure lies on the bed at a place from `TREASURES.seed`, never the game's chance, kept clear
  of the drums. It is drawn there, seen into through the water, as the drums are. A lure lying on the bed within
  reach may snag the nearest unfound thing, a drum or a treasure. The bobber dips (lightly for a treasure), and a
  strike hooks it.
- **The haul.** A treasure reels in as a drum does, but lighter and quicker. It never darts and never slips. Landed,
  the card names it ("a Sunny Atom lunchbox") with a line about it. The bottle's card shows its note. A tap keeps it,
  with the toast "Found! It's for the shelf.", and it is gone from the bed for good.
- **The cleaning is unchanged.** Only cures and drums clean. A clean pond can still have treasures lying on its bed,
  and they can still be snagged there. Nothing bites in it, as now.
- **The shelves.** The cabin room's one shelf becomes two, one above the other on the lake wall where the room's view
  sees them. Each treasure found stands on them in a place of its own, and a hauled drum stands on the bank beside
  the cabin (decision 1).
- **The journal.** Its page gains a "Found in the pond" part: each treasure by name, or "not yet found", and the
  bottle's note under its name once found. The drums' line stays.
- **The aquarium is gone** from the design and the docs, and the reason is said once.

## Where it stands now (read)

| Figure               | Now                                                                                                       | Source                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Things on the bed    | 2 drums: seeded places (`drumPlaces`), a `Drums` class with `hauled`, `snagged`, `load(n)`                | `src/drums.ts`, `DRUMS` `lake.ts:870`           |
| The bite's quarry    | a fish or a drum (`Bite.fish`, `Bite.drum`). Fish are tried first, then a drum if the lure is on the bed. | `bite.ts:42-106`                                |
| The drum's fight     | `drumFight(gear)`: no darts, no drain, fill `DRUMS.fill`                                                  | `fight.ts:107`                                  |
| The cleaning         | `(cured + 2·drums) / 16`; clean needs every drum hauled                                                   | `lake.ts:891-906`, `game.ts:312`                |
| The save             | `{ cured, day, drums, journal }`; files 01 to 05; a fresh save is 42 bytes                                | `progress.ts`, `test/leaks.test.ts:23`          |
| The journal page     | kinds as rows, plus one drums line                                                                        | `journal.ts:48`, `index.html:809`               |
| The room's shelf     | one, on the lake wall at along -2.8, 1.4 wide, 1.5 high; about 0.6 of it free                             | `lake.ts:754`, `cabinroom.ts:260`               |
| The room's furniture | about 530 triangles (an estimate) of a 1500 ceiling; built once into the static set                       | `test/cabinroom.test.ts:197`                    |
| Dynamic groups       | water, fish, cast, drums; handed over on a change, never each frame                                       | `main.ts:349`                                   |
| Fuzzer               | "lie on the bed" casts aim at an unhauled drum; reach tests for snags and hauls                           | `scripts/fuzzer.ts:178`, `test/fuzz.test.ts:68` |

## Acceptance criteria

1. **A refactor first.** `Drums` becomes `BedFinds`, a set of things on the bed of one spec: places from a seed, a
   found flag, the snag test, and loading by ids. The drums are one `BedFinds`, and the treasures another, placed
   clear of the drums. This lands as its own commit, with every gate unmoved.
2. **Treasures.** `TREASURES` in `lake.ts` gives each its id, name, card line, weight, size on the bed, snag
   figures, the bottle's note, and its place on the shelves. Six, with places from `TREASURES.seed` on the bed, under
   the water, clear of each drum by `apart`.
3. **The snag.** With no fish coming and the lure on the bed, the nearest unfound drum or treasure within its reach
   may snag, at its own rate. The bite's quarry is a fish, a drum or a treasure, never two at once. A treasure snag's
   dip is lighter than a drum's.
4. **The haul.** `treasureFight(gear)` is the drum's profile at a quicker fill. A landed treasure's card gives its
   name and line (the bottle's note too), from the pure `cardWords`. A tap keeps it: `save.found` gains its id, it is
   saved, `GameEvents.found(id)` is told, and the toast shows.
5. **The cleaning is unchanged.** `contaminationAfter` and `pondClean` read cures and drums only. The fuzzer's "bites
   in a clean pond" counts fish bites. Treasure snags in a clean pond are allowed and counted apart.
6. **The save.** `Save.found`, default `[]`, a list of treasure ids. Unknown ids and repeats are dropped on load. It
   is never longer than `TREASURES.length`. There's a new `test/saves/06-found.json`, and the fresh-save size in
   `test/leaks.test.ts` is written again.
7. **The shelves.** `CABIN_ROOM.furniture` gains a second shelf above the first. Each treasure found stands on the
   shelves at its own place, drawn from a fixed pool of dynamic groups (count live), handed over only when the count
   found changes. A hauled drum stands on the bank by the cabin, drawn the same way. The room stays under its
   triangle ceiling, and the treasures' models are held under a ceiling of their own.
8. **The journal page.** `journalWords` gains the treasures, found or not, with the bottle's note once it's found.
   The page shows them under "Found in the pond".
9. **The test API.** `game.treasures()` gives each treasure's place and whether it's found. `fishTo` takes a
   treasure's id. `game.journal()` includes `found`.
10. **The invariants.**
    - Found ids are known, unique, at most six, and equal the save.
    - A found treasure is never the quarry, and the quarry is at most one thing.
    - Treasures lie on the bed under the water, clear of the drums.
    - The cleaning is the formula's, as now.
11. **The aquarium's words** are gone from `DESIGN.md` (the loop, the cabin, the rules, the save, stage 3's note, what
    is not decided), `docs/journal.md` (it names the shelves' slice as next, not the aquarium) and `CLAUDE.md`'s
    checklist. Each change says the fish go back into the pond.

## Edge cases (from the checklist)

- **save:** `found` is saved at each keep. An old save without it has found nothing. Unknown ids, repeats and a list
  too long are dropped or held down. Start again wipes it.
- **scale:** six treasures and two drums on the bed, fixed. The shelves hold at most six. `leaks` gains
  "treasures found" (ceiling `TREASURES.length`). The save bytes stay under 2000 with all found (about 120 bytes
  more).
- **phone:** the treasure's card (the bottle's note the longest) and the journal's longer page at all eight screens
  of `smoke/layout.spec.ts`, scrolling if they must, and at the Pixel 7a's 412×915. A paired phone strikes and reels
  a treasure as a drum.
- **the mode:** look and cast, unchanged.
- **the rung:** full and lean draw the same treasures and shelves.
- **the switches:** the paint on and off for the shelves and the treasures, each time of day (a treasure on the bed
  by night), the lake clear and sick (a treasure seen through sick water), and caustics.
- **the water:** a treasure on the bed is under the water at its place, never off it, and never on a boulder or by
  the shore within `margin`.
- **the line:** left lying near a treasure (a snag), near a treasure and a drum (the nearer), and near nothing (none);
  hooked and reeled; the reel let go (it waits, never slips); reeled in before the strike (it lets go, and is wary a
  while, as a drum is).
- **the fish:** a fish coming first always wins over a snag, as now.
- **snags:** a treasure is the second thing snagged on the bed. Reeds, rocks and rooftops are later.
- **the day:** a treasure hooked at midnight holds the day open, as a fish does. The shelves in the cabin room at dawn.
- **the lake's contamination:** unchanged by treasures. A pond clean with treasures left still lets them be found.
- **the cabin:** the shelves with none, some and all six found.
- **the boat, the calendar's seasons, the real clock:** not reachable.

## Decisions (yours)

1. **A hauled drum stands on the bank beside the cabin** (recommended), seen from the shore. At 42 kg and 1.9 high, it
   doesn't fit on a shelf. The alternative is that drums aren't shown once hauled.
2. **Two shelves, one above the other,** on the lake wall by the door (recommended), where the room's view sees them.
   The alternative is one longer shelf along the end wall, which the view only sees at its edge.
3. **The treasures' lines** (placeholders until the story's words are decided):
   - old lure: "A rusty spinner, still shiny where it counts.";
   - plush: "The Sunny Atom, soggy but smiling.";
   - lunchbox: "Empty, thank goodness.";
   - badge: "Safety First! (They weren't.)";
   - duck: "The Duck Pond's own rubber duck.";
   - the bottle's note: "If you're reading this, the fish are glowing again. Bring them home. — E."
4. **The snag:** a treasure snags at the drum's rate within the drum's reach, and reels in about three times as fast
   (recommended).

## Performance risk

- **Frame:** six small treasures on the bed and up to six on the shelves, each under 60 triangles, in dynamic groups
  handed over only when the found count changes. The standard frame is measured against the parent commit, and the
  cabin's frame with all six found.
- **Step:** the snag's distance check covers eight things instead of two, only while the lure lies on the bed. The
  bench is held at ±15%.
- **Download:** a few kB of code and words. The baseline is written through `/gate-moved`, with the bytes said.
- **Pace:** expected unmoved. Its angler's lure rarely lies on the bed near the north, and the treasures' places keep
  to their own band. It is measured, and any move goes through `/gate-moved`.
- **Balance:** unmoved, exactly.

## Design

- `src/drums.ts` becomes `src/bedfinds.ts`: `BedFinds` with `places(spec, world)`, `found`, `snagged`, `load(ids)` and
  `find(i)`. The drums load by count as before (the first n). This is the refactor's commit.
- `src/lake.ts`: `TREASURES`, the second shelf in `CABIN_ROOM.furniture`, the drums' place by the cabin. `src/palette.ts`:
  the treasures' colours.
- `src/bite.ts`: the quarry's third kind; the snag tries drums and treasures together, nearest first.
- `src/fight.ts`: `treasureFight(gear)`.
- `src/game.ts`: `catchTreasure`, `keep()` (the card's tap on a treasure), `GameEvents.found`, and the load.
- `src/progress.ts`: `found`, read and cleaned.
- `src/journal.ts`: the treasures in `journalWords`. `index.html` and `main.ts`: the page's new part.
- `src/fightview.ts`: `cardWords` for a treasure. `src/pondview.ts`: the found toast.
- `src/treasuredraw.ts` (new): each treasure's model from primitives, painted, once. It also places them on the bed
  and on the shelves, and the hauled drums by the cabin, from fixed pools. `src/drumdraw.ts` gains the place on the
  bank.
- `src/cabinroom.ts`: the second shelf.
- `src/debug.ts`: criterion 9. `src/invariants.ts`: criterion 10. `scripts/determinism.ts`: hashes the treasures and
  `found`.
- `scripts/fuzzer.ts`:
  - "lie on the bed" aims at an unfound drum or treasure;
  - the start draws `found` from its own stream;
  - the counters for a treasure snagged and kept, and fish bites in a clean pond.

  Reach tests in `test/fuzz.test.ts`. `scripts/leaks.ts`: "treasures found".

- `DESIGN.md`, `docs/journal.md`, `CLAUDE.md`: the aquarium taken out (criterion 11), stage 4's note, the junk, and a
  model feature for "a thing on the bed".

## Test plan

- **Unit:**
  - `test/bedfinds.test.ts` (the drums' tests moved): places from a seed, under the water, apart; snag nearest;
    found never snagged; load.
  - `test/bite.test.ts`:
    - a treasure snags lying near it and not otherwise;
    - a drum and a treasure, the nearer wins;
    - a fish coming first wins;
    - a found treasure never snags;
    - a clean pond has no fish bites but a treasure can snag.
  - `test/fight.test.ts`: the treasure's fight never darts or slips, and is quicker than a drum's.
  - `test/game.test.ts`:
    - a keep saves, tells and leaves the cleaning alone;
    - a load finds by ids;
    - a treasure hooked at midnight holds the day.
  - `test/journal.test.ts`: the treasures' words, found and not, and the note.
  - `test/saves.test.ts`: `06-found.json`, unknown ids, repeats, too long.
  - `test/cabinroom.test.ts`: the second shelf inside the walls and under the ceiling, and each shelf place on a
    shelf.
  - `test/treasuredraw.test.ts`: each model built the same each time, painted, under its triangle ceiling.
  - The card's words for each treasure.
- **End-to-end (`smoke/progress.spec.ts`):**
  - "a treasure on the bed is found and kept for the shelf": fish to the lunchbox, reel it, keep it, and see the
    toast, the journal's part, and the gauge unchanged;
  - "the bottle's note": find it and read the note on the card and in the journal;
  - go to bed and see the found ones on the shelves.
- **Layout (`smoke/layout.spec.ts`):** the bottle's card and the journal with all found, at all eight screens.
- **Fuzzer:** the aimed cast, the reach tests (a treasure snagged and kept), and the redefined clean-pond count. The
  new invariants hold over seeds 1 to 24.
- **Leaks:** the new ceiling, and the save bytes with all found.
- **Pictures (`smoke/look.spec.ts`):**
  - `treasure-bed` and `treasure-bed-night`;
  - `fishing-landed-bottle` (desk) and `phone-landed-bottle`;
  - `desk-journal-found` and `phone-journal-found`;
  - `cabin-shelves` (all six) and `cabin-dawn` unchanged with none found;
  - `drums-by-cabin` (two hauled, from the shore);
  - every other picture unchanged, since the treasures lie away from the standard views. Any that moves is looked at
    and decided.
- **Perf:** the standard frame against the parent, and the cabin's frame with all six.
- **Mutation:** a found treasure that snags again; a keep that cleans; the drum winning when farther; `found` not
  saved; repeats kept on load; the note missing from the journal. Each must fail its test.

## Parts

- [x] 0. **The spec in the repo, and the aquarium taken out:** this file as `docs/junk.md`; `DESIGN.md`,
      `docs/journal.md` and `CLAUDE.md` reworded (criterion 11). Check: it's there, and a grep finds the aquarium
      only where it is said to be dropped.
- [x] 1. **The refactor:** `BedFinds` from `Drums`, the drums on it, and every gate unmoved. Check: `npm run check`
      green, with no baseline written. It is committed on its own when the user asks.
      _Its gates were unmoved but for one: the download, held to the byte, moved by 3 bytes gzipped from the renamed
      properties alone (181,291 to 181,294), so the refactor commit on its own fails `perf` by that much. The perf
      baseline was written once, for the whole slice, in part 7 (181,291 to 184,730). The user chose on 19 Oct 2026 to commit the slice as one, so the refactor has no commit of its own._
- [x] 2. **Treasures on the bed:** `TREASURES`, their places, the snag in the bite, `treasureFight`, `keep`,
      `save.found` and `06-found.json`, and the invariants. Check: the bedfinds, bite, fight, game and saves unit
      tests, seen failing first.
- [x] 3. **Seen:** `treasuredraw.ts` on the bed, and the card's words and note. Check: the unit tests, and
      `treasure-bed` and `fishing-landed-bottle` looked at.
- [x] 4. **The shelves and the bank:** the second shelf, the treasures on it, and the drums by the cabin. Check: the
      room's unit test, and `cabin-shelves` and `drums-by-cabin` looked at.
- [x] 5. **The journal and the page:** the found part, the toast, and the layout. Check: the journal unit test, the
      end-to-end stages and the layout spec.
- [x] 6. **The gates play it:** the fuzzer's aim, start and counters, the reach tests, leaks and the hash. Check:
      fuzz on seeds 1 to 24, and the leak run.
- [x] 7. **The pass:** the full check, the pictures written and looked at, perf, the mutations, `CLAUDE.md`,
      `docs/junk.md` and the report.

**Built on sonnet,** in a session switched to it in the model menu (`~/.claude/CLAUDE.md`), through `/feature`'s
phase 3 onward, from `docs/junk.md`.
