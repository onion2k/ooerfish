# The radio: the cabin's morning is a broadcast, the forecast, the moon, the season and a line of gossip

## Context

Stage 5 of `DESIGN.md` is the calendar; its morning at the cabin is "the wall calendar, the radio's forecast and
gossip, and the mail". The calendar hangs; the mail waits on the town (Part B). The radio is slice A2 of
`docs/roadmap.md`. Today the cabin's line reads "Day 13. Morning at the cabin. New moon tonight. Rain today.", one
element, `#morning`, written by `NightView` in `src/nightview.ts` from the pure `nightWords`; nothing in the room is
a radio, and nothing says what the town is saying. The design says the story is told through the townsfolk, and
that their names and the story's words are not decided, so every line here is a placeholder in the design's
roles (the postmistress, the baker, the mayor, the old fisherman, the children's club), as the treasures' lines
are. No sound: that is Part D.

**Chosen by the user (28 Oct 2026):** **words only**, no radio modelled in the room (so no cabin picture moves, only
the four morning ones for the new panel), and the station is **"Sunny Atom Radio"**, a placeholder until the
story's words.

## What

- **The radio's words** are the pure `radioWords(day, save, lakes, hour)` in `src/radio.ts`, returning
  `{ forecast, gossip }`, two short sentences shown together, written to a new `#radio` panel under the morning
  line, in the cabin only, whenever the morning line is shown (a wake, a load there, a walk in by day), and
  written only on change as the morning line is.
- **The forecast** is one sentence from the day: the weather, and the moon if it is full or new tonight:
  "Sunny Atom Radio says rain today, and a new moon tonight." / "…says a fine day." (sunny) / "…says fog on the
  lake this morning, and the full moon tonight." The season's first day adds a clause: "the first day of autumn,"
  on days 15, 29, 43 and 57 (and 1). The words move out of the morning line: it becomes
  "Day 13. Morning at the cabin." again, so nothing is said twice; `moonLine` and `weatherLine` move to
  `radio.ts`.
- **The gossip** is one line, chosen by what the save says has happened, the most notable thing first, and varied
  among that thing's lines by `dayHash` (exported from `calendar.ts`) so a week of mornings does not repeat:
  1. a lake fully clean (every fish cured and every drum hauled): "The ducks are back on the Duck Pond, and the
     whole town is talking about it." (lines name the lake through `theLake`);
  2. a first fish of a kind caught yesterday (`journal[kind].first === day - 1`): "Word is somebody landed their
     first pike yesterday. The old fisherman says he is not jealous.";
  3. the latest treasure found (the last of `found`, if any): a line each, "The children's club want to know who
     has their rubber duck." for the duck, and so on for the six;
  4. a drum hauled (`drums > 0`): "The mayor is pleased to hear a drum of waste came out of the pond.";
  5. a gift held (`gearFor(curedTotal)`): "The Sunny Atom has been leaving parcels on somebody's step again.";
  6. nothing yet: a line by the season or the weather: "The baker says it is pie weather." (rain), "The
     postmistress has lost her glasses in the fog." (fog), "Good fishing weather, they say." (sunny), the four
     seasons' lines.
     Each key has two or three lines; the pool is about twenty, placeholders until the story's words are decided,
     named `GOSSIP` in `src/radio.ts` (words, not content figures, so beside the function as `CLEAN_WORDS` is).
- **The page:** `#radio` in `index.html`, a `.panel` under `#morning` (top 26 + the line's height; portrait and
  sideways rules beside the morning's), smaller type, the forecast and the gossip as two lines, `max-width` as the
  morning's; `NightView` takes the element and writes it when its words change; `nightWords` keeps its signature and
  loses the two sentences; `radioWords` is called by the view with `game.progress.save`, `game.progress.lakes` and
  the hour. `game.radio()` on the test API reads `{ forecast, gossip, shown }`.

## Where it stands now (read)

- `#morning` is written only on change, hidden with its buttons; `nightWords` is pure and pinned by 11 unit
  expectations, 10 smoke expectations and 1 picture assertion, all of which change with the two sentences
  moving (they are this slice's to re-pin).
- The sideways phone (915×412) has the least room under the morning line: the line starts at 76 px and the
  elsewhere button's top is about 300 px; two short lines of 14 px fit, held by `smoke/layout.spec.ts`.

## Acceptance criteria

1. `radioWords` is pure: the same day and save give the same words, and nothing in it draws chance.
2. The forecast names the weather of the day, the moon when full or new tonight, and the season on its first
   day; sunny with no moon reads "a fine day".
3. The gossip picks the most notable key (clean lake over a first catch over a treasure over a drum over a gift
   over the weather) and varies within the key by day; every line in the pool is reachable by some save and day.
4. The morning line reads "Day N. <hour> at the cabin." and nothing more.
5. `#radio` is shown exactly when `#morning` is, written only on change (the stub counts), in every layout with
   no overlap and inside the screen (the layout spec's morning moment gains the overlay).
6. `game.radio()` reads the words the page shows.

## Edge cases (from the checklist)

- **save:** an old save without a journal or finds gossips from the weather or season; a save with every lake
  clean gossips about the home lake first; the words are not saved.
- **the day:** the forecast is the waking day's; in the cabin by day the hour is the afternoon's and the forecast
  still "today"; at night in the cabin "tonight"; slept through to a marked night, that day's words; the clock is
  stopped in the cabin so the words never change while read.
- **the seasons, the moon, the weather:** every combination reads as a sentence (a unit test walks days 1 to
  112); winter rain says snow.
- **the lakes:** gossip names the lake it is about through `theLake`; waking at home after the Reservoir, the
  Reservoir clean is the most notable.
- **the phone:** portrait under the morning line, sideways two short lines; the layout spec at all eight screens.
- **the rung:** none. **the switches:** none (`game.radio()` reads only).
- **the mode, the line, the fish, the water, the contamination, the real clock, the festivals:** not reachable.

## Decisions (the user's)

1. **A radio in the room:** words only, no model (chosen; the model can be a later tidy).
2. **The station's name:** "Sunny Atom Radio" (chosen), the plant's old station still on the air.

## Decisions (mine, said so they can be changed)

- **The moon and weather move out of the morning line** into the forecast, so a morning is one voice.
- **Gossip is from the save, not events:** a first catch "yesterday" is read from the journal's `first` day, so
  the words are pure and a load shows the same morning.
- **One gossip line a morning,** varied by the day's hash; a player who wakes on the same day sees the same line.
- **Roles, not names:** the design has not named the townsfolk, so the lines say "the baker" and so on.

## Performance risk

- **Frame:** none (strings written on change).
- **Boot:** nothing. **Download:** the pool of lines and the view, about 2 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/radio.test.ts` (criteria 1 to 3: every forecast over days 1 to 112 against `weatherOf`,
  `moonOf` and `seasonOf`; the gossip's order of keys by crafted saves; the variety by day; every line reachable);
  `test/nightview.test.ts` (4, 5: the line without the sentences; `#radio` written with the morning and only on
  change, re-pinned days).
- **End to end, `smoke/progress.spec.ts` "the radio":** a wake on day 13 shows `#radio` with "rain today, and a
  new moon tonight"; a walk in by day shows it with the afternoon; out to the pond hides it; a save with a lake
  clean gossips about it; `game.radio()` matches the text. Existing stages' `#morning` expectations re-pinned.
- **Fuzzer and invariants:** no action (words only) and no rule beyond purity, held by the unit test; said in the
  report.
- **Pictures:** `desk-radio-morning` (day 13), `phone-radio-morning`; the four morning pictures retaken through
  `/gate-moved`, meant.
- **Perf:** the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, one at a time, from `docs/radio.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/radio.md`; `DESIGN.md` stage 5 notes the slice; `docs/roadmap.md` ticks
      A1 and names A2. Check: Prettier.
- [x] 1. **The words:** `src/radio.ts`, `dayHash` exported, `moonLine`/`weatherLine` moved, `nightWords` shortened.
      Check: `test/radio`, `test/nightview`.
- [x] 2. **The page:** `#radio`, its CSS, `NightView`, `game.radio()`, the layout spec's overlay, re-pinned
      expectations. Check: `test/nightview`, `smoke/layout.spec.ts` morning moments.
- [x] 3. **The pictures and the stage:** the smoke stage, the new pictures, the moved ones through `/gate-moved`.
      Check: `npm run look`, `smoke/progress.spec.ts`.
- [x] 4. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the key order reversed;
      the hash dropped from the pick; the view writing every frame), the report. Commit.

## Part 4's notes (the pass)

- **The phone's squeeze.** A fixed box placed at `left: 50%` with a transform has only the right half of the screen
  to shrink to fit in, so the morning line and the radio came out as a 206 px column on a phone. Both are centred by
  `left`/`right` 16 px, `width: fit-content` and auto margins now; the six morning pictures were taken again (the
  desk's unchanged to the eye).
- **The gossip's pick is salted** (`PICK_SALT`): the weather is drawn from `dayHash(day)`, so within one weather the
  hash sits in a narrow band and a key's second line was never picked.
- **The download** grew from 206,525 to 208,318 bytes gzipped, the words and the view; that figure was written into
  the perf baseline by hand. Boot and frame hold (792 ms, 4.02 ms against 805 and 4.02).
- **The mutations:** the drum put over a clean lake (five order tests fail), the hash dropped from the pick (three
  fail), the view writing every frame (one fails).
- **No fuzzer action and no invariant:** the radio is words from the day and the save, held pure by its unit test.
