# The day ends, and the player wakes at the cabin

## Context

Stage 3 is done: a caught fish is cured and goes straight back into the pond, and the pond clears a twelfth with
each. The aquarium was dropped on 17 Oct, so the cabin is not for curing or for looking at fish. Its job in the
design's loop is the start and the end of a day: "the day ends at midnight with a yawn and a fade, or earlier by
choice, in bed at the cabin." Stage 5's first slice runs the clock from dawn. Today it wraps past midnight with
nothing happening, there is no day number, and the save holds only the count cured. This slice gives the day an end.
At midnight the player yawns, the screen fades, and they wake at dawn inside the cabin on the next day. They go down
to the pond from there.

**Chosen by the user (19 Oct 2026):**

- **They wake in a 3D room:** the cabin's interior, with a bed, a window and the door, built now.
- **The yawn waits.** A fish on the line, or landed and not yet in the bucket, holds the day open until it is
  settled. Nothing is cut off.
- **"Go to bed" is in the ⋯ menu,** beside Start again. There's no question first, because nothing is lost. It is
  refused while a fish is on the line or landed, as midnight waits.

Later slices, not this one: the morning's things (the wall calendar, the radio, the mail), sleeping through to a
weather or a marked day, the seasons and the moon, saving the time of day, menus stopping time, and a blended sky.

## What

- **Midnight.** When the clock passes midnight at the pond, with no fish on the line or landed, the player yawns
  ("Yawn… time for bed"), and the screen fades to night over `NIGHT.fadeOut` (1.5 s). If a fish is on the line or
  landed, the clock runs on past midnight until it's settled (landed and put in the bucket, or slipped). Then the yawn
  comes.
- **Waking.** The day's number goes up and is saved. The clock is set to dawn (`CLOCK.startsAt`). The fade lifts over
  `NIGHT.fadeIn` (1 s) on the cabin's interior, seen from its own view: the bed, the window with the dawn in it, the
  door, and a lamp. A line says "Day 2. Morning at the cabin." **Game time stops in the cabin.** The clock, the fish
  and the water all hold.
- **Down to the pond.** A "Down to the pond" button (or Enter) brings the player out to the Shore view, in look mode.
  The clock runs again from dawn.
- **Bed early.** "Go to bed" in the ⋯ menu does the same as midnight, at once: the yawn, the fade and the next day.
  It works from the pond or the cabin, and is refused (greyed) while a fish is on the line or landed.
- **The night passes.** At the yawn, the lure is reeled in, a coming or nibbling fish lets go, an aim or a held reel
  is let go, and the toasts are cleared. On waking, a heal still running is finished, since the night has passed, and
  the splashes are gone.
- **A load** opens at the pond at dawn, as now, on the saved day. A new game is day 1. Start again wipes it.

## Where it stands now (read and measured)

| Figure                        | Now                                                                                                                                                                       | Source                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| The day                       | 720 s, from dawn (0.25); midnight comes 540 s (9 min) in                                                                                                                  | `CLOCK`, `lake.ts:706`        |
| At midnight                   | the clock wraps to 0 and nothing reacts                                                                                                                                   | `setTimeOfDay`, `game.ts:290` |
| Day number                    | none anywhere                                                                                                                                                             | grep                          |
| The save                      | `{ cured }`, saved only at a stow                                                                                                                                         | `progress.ts`                 |
| Looks                         | night, dawn, day and dusk, stepped. Waking is night to dawn.                                                                                                              | `look.ts:100-161`             |
| A fade                        | `#boot`, a CSS fade on the wall clock, hidden for pictures                                                                                                                | `index.html:217`              |
| The cabin                     | 9 × 7 × 4.6 at about (47.5, 32.1), drawn as solid blocks. The window glows at a fixed 0.6. No view near it.                                                               | `CABIN`, `cabin.ts`           |
| Point lights                  | a pool of 16 is set, and none is used                                                                                                                                     | `main.ts:176`                 |
| A frame at the standard scene | 3.6 ms (budget 8). Boot 756 ms. Download 171,764 B.                                                                                                                       | `smoke/perf-baseline.json`    |
| Gates that cross midnight     | leaks (10 min in check, 60 in full) and the fuzzer (clock set to 0.99 and the like). Pace (about 2.2 min, capped at 10) almost never. Determinism (60 s from dawn) never. | `scripts/`                    |

The renderer has one scene, one camera and no culling. So the room is built inside the cabin on the bank and drawn
with the lake behind its walls. The cabin's outer walls are solid, so the room's walls are its own, facing in.

## Acceptance criteria

1. **The day.** `Game.day`, a whole number from 1, is read from `save.day` and never goes back. `Game.place` is
   `'pond'`, `'yawning'` or `'cabin'`.
2. **Midnight.** A step at the pond that carries `timeOfDay` past midnight starts the yawn, unless a fish is hooked
   or landed. In that case the yawn starts on the first step after the fight is settled and the bucket is filled.
   Setting the clock with the lever is not a step past midnight.
3. **The yawn.** Yawning lasts `NIGHT.fadeOut` of game-stepped time. It holds `t`, the clock, the fish and the
   water. It starts by reeling the lure in, which lets a coming or nibbling fish go. `game.fade()` goes from 0 to 1
   over it.
4. **Waking.** At the yawn's end: `day` goes up by one, `save.day` is saved, `timeOfDay` is dawn, `waterDirt` is
   the contamination (the heal is over), the splashes are emptied, `place` is `'cabin'`, and `GameEvents.woke(day)`
   is told. The fade lifts over `NIGHT.fadeIn` of time stepped in the cabin.
5. **The cabin.** In the cabin, `step(dt)` moves only the fade. `t`, `timeOfDay`, the fish, the lure, the splashes
   and `waterDirt` are exactly as they were. `Game.out()` sets `place` back to `'pond'`. It is refused while
   yawning.
6. **Bed early.** `Game.sleep()` starts the yawn from the pond or the cabin, and is refused while a fish is hooked or
   landed, or while already yawning.
7. **The save.** `Save.day`, default 1, read as a safe whole number of 1 or more, with
   `test/saves/03-day.json`. It is saved on waking. An old save loads as day 1. A load is at the pond at dawn.
8. **The page.** The cabin's view (`VIEWS.cabin`, with `framingFor` giving a portrait one) has the orbit off, and a
   lamp is lit inside while there and out at the pond. The fade is a full-screen element whose opacity is
   `game.fade()`, written only on change, so it is stepped like everything else and a picture holds still. The
   morning line and "Down to the pond" show in the cabin, and the yawn's words while yawning. "Go to bed" is in the
   menu. The look follows the clock to dawn on waking. The cast button, the welcome line and the fight's overlays
   are hidden outside the pond.
9. **The room** (`src/cabinroom.ts`): its floor, its inward-facing walls and ceiling, a bed, a window frame, the
   door and a lamp. It's built once at boot into the static set, painted with the wood's set, the same every time,
   unseen from outside (every outside picture unchanged).
10. **The test API.** `game.day()`, `game.place()`, `game.fade()`, `game.sleep()` and `game.out()`, each resolving
    once drawn. `game.view()` says `cabin` inside. `game.view(name)` and `game.time(name)` are refused outside the
    pond (time is stopped there).
11. **The invariants.** The day is a whole number of 1 or more, never goes back, and equals the save. In the cabin
    and while yawning, `t`, the clock and the fish do not move, the lure is ready, and no fish is hooked or landed.
    In the cabin the clock is dawn. The fade is in [0, 1].
12. **The gates.** Pace is unmoved: its angler goes down to the pond whenever it is in the cabin, and its runs end
    long before midnight. The fuzzer, leaks and the angler leave the cabin to play on.

## Edge cases (from the checklist)

- **save:** `day` is saved on waking. An old save without it is day 1. A bad value is day 1. A reload in the cabin
  or mid-yawn opens at the pond, on the day the save says: a yawn that hadn't ended didn't count. Start again
  wipes it.
- **scale:** one number, no list. The day is bounded by `Number.MAX_SAFE_INTEGER`, held as `cured` is. Leaks plays
  five days an hour, so the save bytes are watched under their ceiling of 2000.
- **phone:** the cabin's view at the Pixel 7a's 412×915, portrait framed. The cabin's line and button, and the yawn,
  at all eight screens of `smoke/layout.spec.ts`. A paired phone's gestures are ignored outside the pond and nothing
  is refused. Its word is unchanged (a word of its own is later). A phone leaving mid-yawn changes nothing.
- **the mode:** midnight from look and from cast. Waking has the orbit off. Down to the pond is look mode at the
  Shore view. Outside the pond, C, space, a drag and a tap do nothing.
- **the rung:** full and lean draw the same room. The grass outside is unseen.
- **the switches:** the paint on and off for the room's timber. Each time of day at the pond, then midnight. The lake
  clear and sick. Caustics change nothing inside. `?dirt=` and the other old links are unchanged.
- **the water, the line:** midnight with the lure flying, sinking or on the bank: it is reeled in. Hooked: the day
  runs on until the fish is landed (and stowed) or slips. Landed: the day waits for the stow.
- **the fish:** a coming or nibbling fish at midnight lets go. Fish keep their places overnight.
- **the day:** at dawn, day, dusk and night as now; at midnight's end of the day (the point of this slice); slept
  through (later); time stopped in the cabin (this slice). Menus stopping time is not this slice: the ⋯ menu and
  Start again don't stop the clock today, and still don't.
- **the lake's contamination:** unchanged by the night. A heal is finished by morning.
- **the cabin:** the room and its bed. The curing machine, the aquarium and the shelves are not part of it (see
  Context).
- **snags, the boat, the calendar's seasons and moon, the real clock:** not reachable.

## Decisions (yours)

1. **The fade:** 1.5 s out and 1 s in (recommended), soft and quick. The alternative is 3 s and 2 s, slower and
   sleepier.
2. **The words:** "Yawn… time for bed" at the fade, and "Day 2. Morning at the cabin." on waking (recommended).
3. **A load opens at the pond** (recommended), as now, so a reload is straight back to fishing and no test's start
   moves. The alternative is to open in the cabin each time, as a morning.
4. **The room's furniture:** a bed, the window, the door and a lamp, with the camera by the bed facing the door and
   the window (recommended). First guesses, tuned later, since the prototype comes before polish.

## Performance risk

- **Frame in the cabin:** the whole lake still draws behind the walls, plus the room and one point light. Held by
  `measureFrame` at a new `cabin` scene, against 8 ms.
- **Frame outside:** the lamp is out, and the room's few hundred static triangles are drawn unseen. Perf against the
  parent commit at the standard scene. Any move is decided through `/gate-moved`.
- **The fade:** an opacity written only on change, nothing made each frame. Waking sets the look to dawn, a uniform
  write (the four looks are baked once).
- **Boot:** the room joins the static set. It's measured, and if it costs more than a few milliseconds it's built
  after `ready`.
- **Download:** a few kB of code. The baseline is written through `/gate-moved`, with the bytes said.
- **Pace, bench, balance:** unmoved. A move is a bug, not a baseline to write.

## Design

- `src/lake.ts`: `NIGHT = { fadeOut: 1.5, fadeIn: 1 }`, and `CABIN_ROOM`, the interior's content: the inset of the
  walls, the floor, the bed's place and size, the window's frame, the door, the lamp's place and colour, and the
  `cabin` view inside, all relative to `CABIN_AT` and `CABIN`. These are first guesses.
- `src/night.ts` (new, pure): the day's rules as sums. `pastMidnight(before, after)` and `fadeAt(place, elapsed)`,
  unit-tested alone. It has no content imports: the seconds are handed in.
- `src/game.ts`: `day`, `place`, the fade's elapsed time, `sleep()`, `out()`, the midnight check in `step` (after
  the clock moves, deferred while hooked or landed), the yawn's start (reel in), waking (save, dawn, heal finished,
  splashes emptied), and `GameEvents.yawned` and `woke`. `step` does nothing to the pond outside it.
- `src/progress.ts`: `day`, read and defaulted. `Game.persist` on waking.
- `src/splash.ts`: `clear()`, if it has none.
- `src/cabinroom.ts` (new): the room's static groups, painted with the wood's set (as `cabin.ts` is), the colours
  handed in. `src/cabin.ts` is unchanged outside.
- `src/main.ts`: the yawn and woke events; the fade element; the view and orbit on waking and going down; the lamp
  through `setLights`; the morning line and the button; "Go to bed" in the menu; input outside the pond refused in
  `gesture.ts`'s target (the page's side). `index.html`: `#night`, `#morning` and `#bed`, with the layout rules for
  each shape of screen. `src/pondview.ts`: the yawn's and morning's words as a pure function, beside `pondWords`.
- `src/debug.ts`: criterion 10. `src/invariants.ts`: criterion 11. `scripts/determinism.ts`: hashes `day`,
  `place` and the fade, and gains a run that starts a little before midnight so a yawn is hashed.
- `src/angler.ts`: in the cabin, go down to the pond. The fuzzer, pace and leaks play through it. The fuzzer gains
  "go to bed" (sometimes mid-fight, refused) and "down to the pond" actions.
- `DESIGN.md`: the stage 5 note says the day's end, waking in the cabin and bed are in. `docs/game.md`: the day's end
  is in. `CLAUDE.md`: the clock's paragraph, the cabin's room, and the day in the save.

## Test plan

- **Unit:**
  - `test/night.test.ts`: past midnight across the wrap and not otherwise; the fade's curve out and in.
  - `test/game.test.ts`:
    - a step past midnight yawns, and a lever set doesn't;
    - hooked or landed at midnight waits, then yawns once settled;
    - the yawn reels in and lets a nibbling fish go;
    - waking puts the day up and saves it, sets dawn, finishes the heal and empties the splashes;
    - nothing moves in the cabin over many steps;
    - `out` returns to the pond and the clock runs;
    - `sleep` from the pond and the cabin, refused hooked, landed or yawning.
  - `test/progress.test.ts` and the corpus: `day` defaults, bad values, and `03-day.json`.
  - `test/cabinroom.test.ts`: built the same each time, painted, inside the cabin's walls, and walls facing in.
  - The words for the yawn and the morning. The cabin's framing for a tall screen.
- **End-to-end (`smoke/progress.spec.ts`):**
  - "the day ends at midnight and the player wakes at the cabin": clock to just before midnight, step through the
    yawn (the fade rises), wake (the day is 2 and saved, the view is `cabin`, the line shows, and `t` holds over 300
    frames), down to the pond (Shore view, dawn, the clock running).
  - A stage for midnight with a fish hooked: the day runs on until it's landed and stowed.
  - A stage for Go to bed from the menu, and for it refused mid-fight.
  - A reload on day 3.
- **Layout (`smoke/layout.spec.ts`):** the cabin's moment and the yawn at all eight screens.
- **Fuzzer:** the new actions. A reach test that some seed crosses midnight and wakes, and that some seed goes to bed
  early. The new invariants hold over seeds 1 to 24.
- **Leaks:** no new list. The 10 min run in check now crosses a yawn and a waking, and the hour five. The save bytes
  are held under 2000.
- **Pictures (`smoke/look.spec.ts`):**
  - `cabin-dawn` (world only, desk): the room;
  - `desk-yawn` (the fade half up, with its words);
  - `desk-morning` and `phone-morning` (the room with its line and button);
  - every outside picture unchanged, which shows the room is unseen through the walls.
- **Perf:** the standard frame against the parent, and `measureFrame` at the `cabin` scene.
- **Mutation:** midnight ignored; the yawn not waiting for a hooked fish; time running in the cabin; the day not
  saved; the lever counted as a midnight; the fade on the wall clock. Each must fail its test.

## Parts

- [x] 0. **The spec in the repo:** this file, `docs/day.md`, agreed with the user on 19 Oct 2026.
- [x] 1. **The night in the game:** `night.ts`, `NIGHT`, `Game.day`, `place`, the yawn, waking, `sleep`, `out`, the
      save's `day` and its file, the invariants and the hash. Check: the night, game and progress unit tests, seen
      failing first, and `check:quick`.
- [x] 2. **The gates play through it:** the angler, the fuzzer's actions and reach tests, determinism's midnight
      run, and leaks crossing a night. Check: fuzz on seeds 1 to 24, pace unmoved, and the leak run.
- [x] 3. **The room:** `CABIN_ROOM`, `cabinroom.ts`, the view, the lamp, and a headless picture looked at. Check:
      the room's unit test, and `cabin-dawn` looked at (nothing floating, not too dark, walls whole, and nothing seen
      from outside).
- [x] 4. **The page and the API:** the fade, the words, the button, Go to bed, input outside the pond, the layout
      rules and the test API. Check: the end-to-end stages and the layout spec.
- [x] 5. **The pass:** the full check, fuzz on seeds 1 to 24, the pictures written and looked at, perf with the
      cabin's frame, the mutations, `DESIGN.md`, `docs/game.md`, `CLAUDE.md`, `docs/day.md` and the report.

## The room's furniture (asked for on 19 Oct 2026, after the pass)

The room as first built was bare: a bed, the window, the door and a lamp. The user asked for furniture. The design's
cabin has a wall calendar, a radio, mail, shelves of junk and postcards on the wall; this slice puts the furniture
they will sit on into the room now, with nothing on it that is a later slice's (no calendar, radio words or junk).

- **A table and a chair** under the window, on the lake wall: a square table on four legs, a chair with a back
  pulled up to it on the room's side, and a mug on the table.
- **A stove** on the end wall under the chimney (`CABIN.chimney` is 2.8 along, so the stove stands where the
  chimney comes down): a squat box with a stovepipe up to the ceiling, a door and a flue, in iron.
- **A shelf** on the back wall, over the bed's foot and clear of the headboard, on two brackets, with a few books
  and a jar on it in the palette's colours.
- **A rug** on the floor between the bed and the door, a flat slab a little proud of the planks, in the blanket's
  blue with a border.
- **A chest** at the foot of the bed, a lidded box.
- **A framed picture** on the lake wall between the window and the door, a frame round a pale square.
- **A coat on a peg** by the door, a hook and a hanging block.

Rules: each piece is a part in `ROOM_PARTS` with a colour in `ROOM_COLOURS`, built as the others are (`block`,
`frustum`, `split` and `painted` with the wood's set, iron and cloth unpainted or painted as the builder judges
best by the picture), every vertex inside the cabin's outer walls, standing on the floor (its lowest vertex at the
floor) or hung on a wall (within 0.05 of it), none closer than 1.2 to the camera's eye nor blocking the door or
the window, and under 1500 triangles for all of them together. `CABIN_ROOM` gains their places and sizes as
content. The three cabin pictures (`cabin-dawn`, `desk-morning`, `phone-morning`) are written again and looked
at; every outside picture is unchanged; the layout spec holds at eight screens; the cabin scene's frame stays
under the budget; the bench, pace, balance and the download are as the gates say.

- [x] 6. **The furniture:** the pieces above, their test (each present, on the floor or the wall, inside, clear
      of the camera, the door and the window, built the same each time), the pictures written again and looked at,
      and the full check.

**Built on sonnet,** in a session switched to it in the model menu (`~/.claude/CLAUDE.md`), through `/feature`'s
phase 3 onward, from `docs/day.md`.
