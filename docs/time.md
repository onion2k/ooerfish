# The time is saved, the menu stops the clock, and a calendar hangs in the cabin

## Context

Stage 5 of `DESIGN.md`'s order of work (the calendar) has the day's clock and the day's end in. Of what is left,
sleeping through waits on the weather and marked days (stage 6) and the radio and the mail on the weather and the
town (stages 6 and 7). Three things do not wait and are this slice: **the time of day and the player's place are
saved**, so a load opens where the player was instead of at the pond at dawn (`docs/day.md`'s "a load opens at the
pond at dawn, as now" is the sentence this changes); **the ⋯ menu and everything it opens stop the clock**, as the
journal already does and as the design says ("menus, the journal and the cabin stop it"); and **a wall calendar hangs
in the cabin's room**, the first of the wall's things.

**Chosen by the user (19 Oct 2026):** the calendar is the year's grid, fifty-six squares in four rows of fourteen
(the design's four seasons), the days gone darkened and today marked bright, with no digits, since the morning line
already says "Day N"; and all of the menu stops the clock, the open ⋯ list as much as the pages it opens.

## What

- **The time is saved.** `Save` gains `time` (the clock, `timeOfDay`, a fraction of the day in [0, 1), default
  `CLOCK.startsAt`) and `place` (`'pond'` or `'cabin'`, default `'pond'`). `Game.persist` writes the clock and the
  place into the save before the store is written; `Game` is built from them, so a load opens at the pond at the saved
  time, or in the cabin at dawn on the saved day. A save made while yawning keeps the time and place it had, since the
  yawn's clock is just past midnight and the day has not gone up: the load lands before the yawn, which comes again.
  A cabin save holds dawn whatever the file says, since the invariants hold the cabin's clock at dawn.
- **When it is written.** As now at the wake, a cure, a haul and a find; and newly every `CLOCK.saveEvery` seconds of
  stepped game time at the pond (10, a first guess: about seventy writes a day, a JSON of under 300 bytes each), on
  `Game.out` (the place changed), and by the page when it is hidden or left (`visibilitychange` to hidden and
  `pagehide`), so a tab closed or a phone put away loses at most ten seconds of the clock. A load never writes.
- **A load into the cabin** looks and reads as a wake does: the camera at the pillow (`setView('cabin', true)`), the
  morning line "Day N. Morning at the cabin." with "Down to the pond", the lamp lit, and the clock held. The `woke`
  event does not fire on a load, so the page does the same from `game.place` after the first frame is up.
- **The menu stops the clock.** `simulate` in `main.ts` returns early while any page is open: the ⋯ list, the journal,
  the Start again question and the Pair a phone card. The one flag `journalOpen` becomes `pagesOpen()`, read from the
  four. While a page is open the keys, the Cast button, taps and a paired phone's gestures reach nothing, as the
  journal's do now. The pairing card closes as it does today when a phone connects, and the clock runs again.
- **The calendar.** A sheet on the room's lake wall, in the cabin view, with a thin frame bar at its top: fifty-six
  squares as flat faces, four rows of fourteen; the days gone this year (`(day - 1) % 56` of them) a darker ink,
  today a bright mark, the rest the sheet's paper. The year repeats, so day 57 is the first square again. The marks
  are a fixed bank of instances handed over only when the day changes (as `TreasureDraw` hands its shelves over),
  never in a frame. The sheet and frame are static, painted with the wood's set like the picture's frame.

## Where it stands now (read)

| Figure               | Now                                                                             | Source                     |
| -------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| The save             | `{ cured, day, drums, journal, found }`, 53 bytes fresh, written at four events | `progress.ts`, `leaks`     |
| The clock on a load  | always `CLOCK.startsAt` (0.25); the place always the pond                       | `game.ts:139-148`          |
| What stops the clock | `journalOpen` alone, at `simulate`'s first line                                 | `main.ts:920`              |
| Unguarded pages      | the ⋯ list, Start again, the pairing card                                       | `main.ts:564-615`          |
| The room             | twelve pieces, under 1500 triangles, held by `test/cabinroom.test.ts`           | `cabinroom.ts`             |
| Text on a mesh       | none anywhere; the picture is blocks                                            | grep                       |
| Cabin frame          | measured by the perf gate; standard frame 3.6 ms of 8                           | `smoke/perf-baseline.json` |

## Acceptance criteria

1. A `Game` built from a save with `time: 0.6` opens at the pond with `timeOfDay` 0.6; with `place: 'cabin'` it opens
   in the cabin at dawn on the saved day, the morning line and the Down button shown, the camera at the pillow.
2. `persist` writes the clock and the place; a save written at the pond at 0.6 and loaded again reads 0.6 and `pond`.
   A save written while yawning carries the time and place from before the yawn.
3. `time` that is not a finite number in [0, 1), and `place` that is not `pond` or `cabin`, read as the defaults; a
   save without the fields (every file in `test/saves/`) loads as it does today. A cabin save reads dawn.
4. The save is written every `CLOCK.saveEvery` seconds of stepped time at the pond, on `out`, and by the page on
   `visibilitychange` hidden and `pagehide`; a load writes nothing.
5. With the ⋯ list open, the journal open, the Start again question up, or the pairing card up, `game.step(120)`
   moves neither `t` nor `timeOfDay` nor a fish, and a key, tap, button or phone gesture does nothing; closed, the
   clock runs again. `game.pagesOpen()` reads it.
6. The room has a `calendar` piece on the lake wall, within the cabin view's frame, inside the walls, hung on the
   wall, 1.2 from the eye, clear of the door and the window, with every piece still under 1500 triangles; its marks
   show `(day - 1) % 56` days gone and today's square, and move when the day changes and not otherwise.
7. The invariants hold `save.time` in [0, 1), `save.place` known, `save.day === game.day` as now, and the clock at
   dawn in the cabin as now. The fuzzer starts each seed from a saved time and place of its own stream and plays its
   save-and-reload action through the new fields; determinism plays a seed from a save with a time and from the cabin.
8. The outside pictures are unchanged; the cabin pictures are rewritten and looked at.

## Edge cases (from the checklist)

- **save:** saved, reloaded, and an old save without the fields (criteria 2, 3); a save with `place: 'yawning'` or
  `'elsewhere'` reads `pond`; `time: 1`, `-0.1`, `NaN`, `"0.5"` read dawn; `place: 'cabin'` with `time: 0.6` reads
  dawn in the cabin. Start again wipes them with the rest.
- **the day:** a load at 0.999 at the pond yawns within a second; a load in the cabin on day 57 shows the first square
  marked and none gone; day 1 shows none gone; the save made at the wake holds `cabin` and dawn.
- **the mode:** a page open in look and in cast mode stops the clock alike; a held reel is let go when a page opens
  (as the journal does now, or added if it does not).
- **the phone as the rod:** a paired phone's gestures are ignored while a page is open; the pairing card's own
  stop ends when the phone connects or the card is closed.
- **the switches:** `?paused` is unchanged; `game.clock(at)` still moves the clock and, newly, is what the next
  persist writes.
- **the cabin:** the calendar is seen from the pillow in `cabin` and `cabinTall`; nothing of it shows outside.
- **scale, the water, the line, the fish, snags, the boat, the calendar's seasons, the real clock, contamination:**
  not reachable.

## Decisions (mine, said so they can be changed)

- **Cadence 10 s** of game time, in `CLOCK.saveEvery`, stepped in `Game.step` so it is deterministic and tested
  without a page; the page's hidden/left write covers the rest.
- **Yawning is not saved as a place;** the save keeps what it had until the wake writes `cabin`.
- **The calendar's place:** a first guess on the lake wall between the coat and the shelf (about `along` −1.85,
  0.5 wide, 0.45 high, 1.5 up), or above the picture if that reads better, tuned by the picture as the furniture was.
- **Colours:** three new `ROOM_PARTS` (`calendarSheet` paper, `calendarGone` ink, `calendarToday` a warm red), each a
  distinct albedo as the room's test demands, plus the frame bar as `frame`-like timber.

## Performance risk

- **Frame:** about 120 triangles of flat faces and a handover on the day's change only. Measured by the perf gate's
  cabin frame and `measureFrame` in the `cabin-dawn` scene before and after.
- **Boot:** the sheet is built with the room at boot; a few blocks. Measured by `npm run perf`.
- **Download:** a few hundred bytes of code; the perf baseline's bytes are rewritten and said.
- **The save:** fresh grows from 53 bytes by about 28; `scripts/leaks.ts`'s ceiling (2000) holds, and
  `test/leaks.test.ts`'s pinned sizes are rewritten and said.

## Test plan

- **Unit, headless:** `test/saves.test.ts` (new `07-time.json` and `08-cabin.json`, the `KEPT` map, the field reads,
  the round trip); `test/game.test.ts` (built from a time and a place, persist writes them, the cadence, `out` writes,
  the yawn's save, the cabin's dawn); `test/invariants.test.ts` (the new rules bite); `test/cabinroom.test.ts` (the
  piece, its rules, the triangle ceiling, the marks for days 1, 2, 56, 57, and that the marks' matrices change only
  with the day); `test/calendar.test.ts` for the pure function from a day to the squares gone and today.
- **End to end, `smoke/progress.spec.ts`:** a stage loading at 0.6 at the pond and one loading in the cabin (the
  morning line, the Down button, the clock held, the calendar's groups); the menu, Start again and pairing card each
  holding the clock as the journal stage does, and letting it run on close; a hidden page writing the save.
- **Fuzzer:** each seed's start draws a time and a place from its own stream; the save-then-reload action compares
  the JSON as now, with the new fields; a new action opens no page (the page's stop is the smoke's).
- **Invariants:** `save.time` in [0, 1), `save.place` known; the cabin's dawn as now.
- **Determinism:** `playTwice` from a save with a time and one in the cabin, as well as from dawn.
- **Pictures:** `cabin-dawn`, `cabin-shelves`, `desk-morning`, `phone-morning` rewritten and looked at; a new
  `cabin-day57` with a full year gone; `desk-menu-open` with the list up. The outside pictures unchanged.

## Parts

Built on `sonnet` by the `builder` agent, one part at a time (they share `main.ts`), from `docs/time.md`, which is
this spec copied into the repo as part 0.

- [x] 0. **The spec in the repo:** `docs/time.md`; `DESIGN.md` stage 5 and `docs/day.md`'s load sentence updated.
      Check: Prettier.
- [x] 1. **The save:** `Save.time` and `Save.place`, their reads and defaults, `Game` built from them, `persist`
      writing them, the cadence, `out`, the corpus files, the invariants, leaks' sizes. Check: `test/saves`, `test/game`,
      `test/invariants`, `test/leaks` green.
- [x] 2. **The page's load and writes:** the cabin load's camera, line and lamp; hidden/left writes; `game.pagesOpen()`
      on the API. Check: the two load stages in `smoke/progress.spec.ts`.
- [x] 3. **The menu stops the clock:** `pagesOpen()` from the four, `simulate` and the inputs gated on it. Check: the
      menu stages.
- [x] 4. **The calendar:** `src/calendar.ts` (pure: a day to its squares), the piece in `CABIN_ROOM.furniture`,
      `FURNITURE`, `ROOM_PARTS`, `ROOM_COLOURS`, the marks handed over on the day's change in `main.ts`. Check:
      `test/cabinroom`, `test/calendar`, the pictures looked at.
- [x] 5. **The gates play through it:** the fuzzer's start and reload, determinism's saves, `game.ts` hashing. Check:
      `npm run fuzz -- --seeds 1-24`, `npm run determinism`.
- [x] 6. **The pass:** `npm run check`, the perf figures before and after, the mutation checks (a load ignoring `time`;
      the menu's gate removed; the calendar's marks off by one), the report.
