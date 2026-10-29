# The logbook's pages: six pages of the plant's lost logbook on the beds of the pond and the Reservoir, read in order in the journal, and the engineer's letter

## Context

`DESIGN.md`'s story is told "through the townsfolk's letters and the pages of a logbook": the retired plant engineer
"asks for the pages of the plant's lost logbook, fished up one by one. Together they tell what went wrong", and
among the hidden things "the logbook's last page says the leak began with someone fishing in the cooling pond". This
is B3 of `docs/roadmap.md`, the second slice of stage 7 after the post (`docs/post.md`), built on the junk treasures
(`docs/junk.md`): a page comes up on the line as a treasure does and is kept, not for a shelf but for the book.

## What

- **Six pages** of the cooling pond's logbook, written by Wendell Fisk, lie on the beds: pages 1 to 3 in the Duck
  Pond, 4 to 6 in the Reservoir, which gets its first treasures. A page is **a treasure with a page number**
  (`TreasureSpec.page`, its words in `note`, and `shelf: null`, since a page goes in the book and not on a shelf): it
  lies where the lake's treasure seed puts it, clear of the drums and the other treasures, is snagged by a lure lying
  on the bed within a treasure's reach at a treasure's rate, dips the bobber lightly, hauls in by `treasureFight`, and
  its card says "a logbook page", its line and the page's words. A tap is `Game.keep`, as for any treasure, and the
  id goes in that lake's `found`. The pond's first six treasures keep their places (the pages' draws come after).
- **The journal's new section, "The logbook"**: the six pages in page order whatever lake they are in or were found
  at, each "Page n" with its words once found and "not yet found" until then, and a line "pages found: n of 6". The
  section reads every lake's `found`, so a page found at the Reservoir is read at the pond; the "Found in …" section
  stays the lake's own, and a page is not listed in it, since it is in the book. `journalWords` gains `pages` and
  the ids found over every lake; `logbookPages(lakes)` in `src/town/logbook.ts` gathers and sorts them, pure.
- **The engineer's letter**, `logbook` in `REQUESTS`, from Wendell Fisk, met when every page is found over the lakes:

  > Dear Angler, This is awkward. When the plant shut, the cooling pond's logbook went into the water, a page at a
  > time, in a wind I should have seen coming. It was not my department, but it was my handwriting. If you fish any of
  > them up I would like them back, in order if it can be managed. There are six. Wendell Fisk, formerly of the plant.

  > All six, and in order. I have read them through once and put them in a drawer. Thank you. It was not my
  > department, but it was my fault, a little. Wendell.

- **The pages' words** (the engineer's voice: precise, embarrassed, kind):
  1. "Cooling pond, 0600. Readings normal. Somebody has left a deckchair by the outflow. Removed it. W.F."
  2. "The deckchair is back, with a flask. Readings normal. Asked around. Nobody in the plant owns a deckchair. W.F."
  3. "Valve 3 found open a quarter turn this morning. Closed it. Not my department, but I closed it. W.F."
  4. "Readings up. A little. Put a sign on valve 3. Somebody has drawn a fish on the sign. W.F."
  5. "The outflow is warm and the fish like it. There are a great many fish. Some of them are glowing. Reported it. W.F."
  6. "Found him. Night shift, valve 3, a rod and a bucket, since March. He said the warm water brought the big ones up
     and he had only opened it a bit. Closed the valve. Kept the bucket. I should have looked sooner. W.F."

  The sixth is the hidden thing (stage 14) and is in: it is a line of words, and the book is not whole without it.

- **The model:** a page is a thin pale sheet with two darker ruled lines, under sixty triangles, drawn on the bed at
  `bedScale` and nowhere once found (`TreasureDraw` shelves only a treasure with a shelf; `shelfSpot` throws for a
  page, and `game.treasures()` gives `shelf: null` for it).
- **The test API:** `fishTo('landed', 'page1')` works as any treasure's id does; `game.logbook()` reads the section's
  rows as the page shows them.

## Where it stands now (read)

- The Duck Pond has six treasures, seed 6211, band 8 to 21 from the angler, `apart` 4; the Reservoir has none
  (`count: 0`, `test/reservoir.test.ts:241` pins it). `places` draws in order, so three appended pages move none of
  the six.
- `TreasureSpec.shelf` is required and read by `shelfSpot`, `debug.ts` `treasures()`, `test/cabinroom.test.ts` and
  `test/treasuredraw.test.ts`. The card already shows `note`.
- `readFound` keeps ids the lake knows; `requestRules` and `readRequests` hold an answered request to `met`.
- `leaks.ts` ceils the treasures found at the most any lake has (6, to be 9).

## Decisions

- **Mine, to change:** a page is a treasure, not a third `BedFinds` as the roadmap's line guessed. Everything a page
  does on the bed, on the line and on the card is a treasure's; a third set would copy the quarry, the fight, the
  invariants, the fuzzer's aim, the determinism hash and the draw for no difference a player sees. The roadmap line
  is corrected in the slice.
- **Mine:** three pages a lake, the story's order from the pond out, so the pond alone tells the start and the
  Reservoir the end; the last page is written in now.
- **Mine:** a found page is drawn nowhere and kept in the book, not on a shelf or the table.

## Acceptance criteria

1. Six `page` treasures over the lakes, numbered 1 to 6 once each, three a lake, each with words; the pond's first six
   treasures lie where they did, to the bit; the Reservoir's pages lie on its bed clear of its drums.
2. A page on the bed is snagged, hauled and kept as a treasure is, and its card says its words; the pond's cure
   arithmetic is unchanged; a page can be snagged in a clean lake.
3. The journal's logbook section lists the six in order over every lake's `found`, found or not, with the count; a
   page is not among the lake's "Found in" rows.
4. The engineer's request is met by all six found over the lakes and by nothing less; an old save with no pages is
   as it was, and a save naming a page a lake does not have drops it.
5. A found page is drawn nowhere; an unfound one lies on the bed; `game.treasures()` says `shelf: null` for a page.
6. `fishTo('landed', 'page4')` at the Reservoir lands it and a keep writes it; `game.logbook()` reads it.

## Edge cases (from the checklist)

- **save:** the ids ride in each lake's `found` (no new field, no new corpus file); a flat old save has none; a page
  id under the wrong lake is dropped by `readFound`.
- **the lakes:** the Reservoir gets treasures for the first time, so every `count: 0` path now runs there (the
  fuzzer's "lie by a treasure", the wary list, the draw); a page found at either lake reads in the journal at both.
- **the contamination:** a page cleans nothing; snagged in a clean pond as a treasure is (the fuzzer counts it).
- **the fish, the line, the phone:** a page's dip and buzz are a treasure's; one quarry at a time as ever.
- **the day, the mode, the rung, the switches, the water:** as a treasure's; not reachable otherwise.

## Performance risk

- **Frame:** three sheets a lake, a group or two each, drawn on the bed: under 0.05 ms, measured at the standard
  scene by the perf gate and at the Reservoir by `measureFrame`. **Boot:** nothing. **Download:** the words and the
  model, about 1.5 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/bedfinds.test.ts` (1: the counts, the numbering, the pond's six to the bit), `test/reservoir.test.ts`
  (1), `test/treasuredraw.test.ts` (5: the sheet, a found page at no size, `shelfSpot` throws), `test/journal.test.ts`
  (3), `test/logbook.test.ts` (3: `logbookPages` over the lakes), `test/requests.test.ts` (4), `test/progress.test.ts`
  (4: the dropped id), `test/cabinroom.test.ts` (the shelf rules skip pages).
- **End to end, `smoke/progress.spec.ts` "the logbook":** at the pond `fishTo('landed', 'page2')`, the card's words,
  a keep, the journal's row; at the Reservoir `page4`, then `game.logbook()` reads two found of six; the post's letter
  open with five pages found and answered at the sixth.
- **Fuzzer:** aims at treasures already and starts with some found; the invariants carry a page as a treasure. One new
  rule in `test/`, not the invariants: the page numbers are 1 to 6 once each over the registry (content).
- **Pictures:** `logbook-bed` (a page on the bed, by day, from over it), `desk-journal-logbook` and
  `phone-journal-logbook` (the section with four found); `desk-journal`, `phone-journal`, `desk-journal-found`,
  `desk-post`, `phone-post`, `desk-post-answered` move (the section, five letters), all meant; `treasure-bed` and the
  pond's shore pictures looked at for a page in view.
- **Perf:** the standard scene as now; the Reservoir told.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/logbook.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/logbook.md`; `DESIGN.md` stage 7 notes the slice; the roadmap's B3 line
      corrected and ticked at the end. Check: Prettier.
- [x] 1. **The pages on the beds:** `TreasureSpec.page` and `shelf: null`, the six specs in the two lakes, the sheet
      in `treasuredraw.ts`, `shelfSpot` and `debug.ts`, the leaks ceiling. Check: `test/bedfinds`, `test/reservoir`,
      `test/treasuredraw`, `test/cabinroom`.
- [x] 2. **The book and the letter:** `src/town/logbook.ts`, the journal's section and `#journalLogbook`, the
      request, `game.logbook()`. Check: `test/logbook`, `test/journal`, `test/requests`, `test/progress`.
- [x] 3. **The pictures and the stage:** the smoke stage, the layout moments, the new and moved pictures. Check:
      `npm run look`, `smoke/progress.spec.ts`, `smoke/layout.spec.ts`.
- [x] 4. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the request met at five; a
      page listed out of order; a found page drawn on the bed), the report. Commit and push.

## Part 4's notes (the pass)

- **The pond's pages keep three apart, not four.** With six treasures and two drums already in the band, `places`
  found no room for a seventh thing four apart, however many tries. Rather than move the six (nineteen pictures and
  the finds a player has) `BedSpec` gained `later: { from, apart }`: the things from index `from` on keep only that
  gap, `apartOf(spec, k)` says which applies, and the invariant and the clearance test read it. The pond's pages are
  `later: { from: 6, apart: 3 }`; the Reservoir's three place four apart without it.
- **A keep asks the town.** `Game.keep` did not call `answer`, so the engineer's letter would have waited for the next
  fish stowed or drum hauled; it does now, and `test/game.test.ts` holds it (the sixth page kept answers and tells).
- **The sheet was invisible on the bed** at the spec's size and sunk 0.05: it is now 0.6 by 0.8 by 0.1, with three
  broad ink rules and a stained paper colour, and reads under the ripples in `logbook-bed`, softly.
- **The journal no longer fits a screen whole:** with the six rows under the finds it scrolls at a desk's height too,
  so the layout spec's "nothing to scroll" rule for the `journal` moment was folded into the "may scroll, must be able
  to" rule the `journal found` moment already had.
- **The fuzzer's kinds coverage** (`test/fuzz.test.ts`) catches fewer fish in four thousand frames with nine things on
  the pond's bed to lie by; the test plays eight thousand, which catches each kind three times or more over the seeds.
- **Pictures:** 87 moved, every one looked at by the builder in the actual and the diff: every pond and Reservoir shore
  picture, by the pages lying on the beds; the journal and post pictures, by the section and the fifth letter;
  `treasure-bed`, a page at its edge. New: `logbook-bed`, `desk-journal-logbook`, `phone-journal-logbook`.
- **Figures:** quick check 1523 tests; fuzz seeds 1 to 24 clean; bench, pace (2.2 to 2.11 min), balance and leaks
  within tolerance; perf in the full check boot 799 ms, frame 3.95 ms, download 212548 to 213783 B (the words and the
  sheet, written by hand), the Reservoir 804 ms and 3.90 ms; look 119 pictures; progress 413 stages. Mutations: the
  request met at five, the pages unsorted, a found page drawn on the bed, and a keep that does not ask the town: each
  caught by one test.
- **Not verified:** the one failed run of the Reservoir stage the builder saw once and could not repeat (rerun five
  times at the pass); the pages seen by eye on the live site.
