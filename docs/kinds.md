# Three new kinds: the pink dawn fish, the eel that lights the water, and the two-headed trout, in the Reservoir, with the journal's facts and the baker's letter

## Context

`DESIGN.md`'s fish are "kinds of their own": among them "an eel that lights the water round it", "the pink dawn
fish" that "come out only at dawn", and "a two-headed trout, with two bites and two strike windows". The town's
baker "pays in pies for a fish that glows pink", and the journal is to carry "a silly fact" per kind. The pond has
three kinds (sunny bream, glowing perch, pike), the Reservoir the same three. This is B2 of `docs/roadmap.md`,
built on the model feature "a kind of fish" in `CLAUDE.md`; the trout is the one that touches the bite.

**Chosen by the user (28 Oct 2026):** **the Reservoir only** has the new kinds, so the Duck Pond's school, pace
baseline and pictures hold; and **the eel carries a real point light** at night.

## What

- **Three lines in `KINDS`** (`src/lake.ts`), appended after pike so every index holds, each with a glow colour in
  `src/palette.ts` and a `fact`:
  - `dawnfish`, "pink dawn fish": 0.4 to 1.6 kg, keeps [0.2, 0.45], scale 0.95, `glowPink`; `hours: [0.125, 0.375]`
    (the dawn look's band of the day, pure arithmetic beside `CLOCK`, never `look.ts`): outside it the fish keeps
    to the bed (`School.step` takes the time of day and a kind with `hours` wants the deepest it may, the lift
    aside) and never comes to the lure (the bite skips it before its draw, as it skips a cured fish, so no other
    fish's chance moves). Fact: "Pink from blushing. It has never been seen by anyone who was not up early."
  - `eel`, "lamp eel": 0.8 to 3 kg, keeps [0.5, 0.8], scale 1.1, `stretch: 1.7` (the joints spaced longer along the
    spine, the girth as the scale: `poseFish` takes a length scale, the invariants' pose check the same), `glowEel`,
    the brightest glow; at night (the look's name) each uncured eel is one of the renderer's point lights at its
    position (`src/eellight.ts`, `EelLights`: a `LightPool` slot per eel after the lamp's, radius `EEL_LIGHT.radius`
    6, the glow's colour, intensity 1, written each frame into the pool, allocated once, off by day and on the lean
    rung as the grass is; `game.eels()` reads them). Fact: "Lights the postmistress's window at night. She has
    stopped paying for electricity."
  - `trout`, "two-headed trout": 0.6 to 2.2 kg, keeps [0.35, 0.65], scale 1.1, `glowTrout`, `bites: 2`: when its
    first strike window runs out unstruck, the other head nibbles once (`FISHING.nibbleGap`) and bites again with a
    second window, once; a miss on the second lets go as any miss does; `castWords` says "the other head bites!
    strike now" for the second. Drawn with a second head: `FISH_PARTS` gains `head2` before the fins (the fin
    colouring is by part order), a matrix beside the first head turned `SWIM.secondHead` apart, scaled to nothing
    for every other kind. Fact: "Two heads, one opinion. They both want the lure."
  - Facts for the three old kinds too (bream: "Sunny by name. Sunny by nature. Not very bright."; perch: "The
    first to glow and the proudest of it."; pike: "Has never once said sorry.").
- **The Reservoir's sixteen slots re-dealt** (`src/lakes/reservoir.ts`): 3 bream, 4 perch, 3 pike, 2 dawn fish, 2
  eels, 2 trout, interleaved; the pond's twelve untouched.
- **The journal** shows a kind's fact under its row once caught (`JournalKind.fact`, `JournalRow.fact`), the page
  a `small` line; six rows now.
- **The baker's letter** `pink` in `REQUESTS`, met when any lake's journal has a dawn fish caught:

  > Dear Early Riser, There is a fish in the Reservoir that glows pink, and it only comes up at dawn, which is when I
  > am up anyway. Catch me one and I will pay in pies. Any morning will do. Marigold Bunn, the bakery.

  > A PINK one! I have put a pie in the window with your name on it, and another behind the counter in case. Marigold.

- **The test API:** `fishTo('dawnfish' | 'eel' | 'trout')`; `fishTo('dawnfish')` puts the clock at dawn first.
  `game.eels()` reads `{ lit, count }`.
- **The invariants:** a kind only in a lake that lists it; a hiding kind outside its hours never the bite's fish; a
  second window only on a two-bite kind, once.

## Where it stands now (read)

- `School.place` draws once per fish whatever the kind; `bite.step` draws once per eligible fish after the cured
  and wary skips, so a gate placed there moves no draw.
- `Bite` has no second-window state; `strike` on `biting` hooks, the timer's end lets go.
- Lights: `LIGHT_CAPACITY` 16, the lamp in slot 0; 0.018 ms a light.
- The Reservoir's slots are pinned 5/7/4 in `test/reservoir.test.ts`; no stored determinism hash; balance is
  kind-blind (heft is a share of the range); the pace runs the pond only.
- `test/journal.test.ts:53` uses `eel` as an unknown kind: it becomes `heron` or such.

## Acceptance criteria

1. Each new kind is a `KINDS` line with its range, band, scale, glow, fact; the Reservoir deals 3/4/3/2/2/2 and the
   pond 4/5/3 as before; the determinism of a pond seed is unchanged to the bit.
2. A dawn fish wants the bed outside its hours and the band inside; the bite never picks it outside, and the draws
   of the other fish are the same with it skipped as with it cured.
3. The trout's first unstruck window is followed by one more nibble and window, the cast words say so, a strike in
   the second hooks, a miss on the second lets go and marks it wary; no other kind bites twice.
4. The eel's joints are spaced by the stretch with the girth by the scale, every joint in the water; its lights are
   one per uncured eel at night only, at its position, none by day, none on lean, none at the pond.
5. The journal's row carries the fact once caught; the baker's letter is met by a dawn fish caught.
6. `fishTo` reaches each new kind at the Reservoir, the dawn fish with the clock put to dawn.

## Edge cases (from the checklist)

- **save:** an old save's journal has no new kinds; a load cures by kind as before (the new kinds' slots among
  them); `rainbow` now needs six kinds, said in the letter's test.
- **the day:** the dawn fish hides at day, dusk and night; the eel's lights at night only; slept through, the same.
- **the lakes:** the pond has no new kind; the Reservoir's cures count 16 as before; travel resets the lights.
- **the rung:** lean has no eel lights; the trout's head and the eel's stretch on both.
- **the fish:** a hooked dawn fish at the moment dawn ends keeps fighting (the gate is the bite's, not the fight's);
  a cured dawn fish wanders in the band at any hour; two trout at one lure: one at a time as ever.
- **the line, the mode, the phone:** a strike in the second window is a strike as any; the phone's buzz on the
  second bite too.
- **the weather:** rain lifts a hiding dawn fish no higher than the bed's share says; fog hides them all alike.
- **the contamination, the switches, the real clock, the festivals, the cabin:** not reachable.

## Decisions (mine, said so they can be changed)

- **The dawn band is the look's,** a quarter of the day centred on dawn, so "at dawn" and the sky agree.
- **A hiding fish sits on the bed,** not out of the lake, so the count cured and the school's size hold.
- **The trout's second window is a flag, not a phase,** so every reader of the phases is untouched.
- **The eel's light is at the fish, radius nine,** so it lights the bed round it and nothing far.

## Performance risk

- **Frame:** two lights at night at the Reservoir, about 0.04 ms; one more group per fish for the second head
  (sixteen small groups, most scaled to nothing); measured by `measureFrame` at the Reservoir by night and told.
- **Boot:** nothing. **Download:** the kinds, the light, the words: about 2 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/fish.test.ts` (1, 2: the slots, the hiding), `test/bite.test.ts` (2, 3), `test/castwords.test.ts`
  (3), `test/swim.test.ts` and `test/fishdraw.test.ts` (4: the stretch, the second head), `test/eellight.test.ts`
  (4), `test/journal.test.ts` (5), `test/requests.test.ts` (5), `test/reservoir.test.ts` (1), `test/invariants.test.ts`.
- **End to end, `smoke/progress.spec.ts` "the new kinds":** at the Reservoir at dawn `fishTo('bite', 'dawnfish')`
  reaches a bite and at day it does not within the attempts; `fishTo('fight', 'trout')` after a missed first window
  reads the second from `fishing()`; at night `eels().lit` is 2, by day 0, on lean 0; a trout landed shows the card
  "two-headed trout"; the journal row carries the fact after a stow.
- **Fuzzer:** plays the Reservoir and the clock already; the invariants carry the rules.
- **Pictures:** `reservoir-kinds-day` and `reservoir-kinds-night` (overhead on the new three), `eel-light-night`
  (the bed lit round an eel from the shore), `fishing-landed-trout`; `desk-journal`, `phone-journal`,
  `desk-journal-found`, `phone-journal-found` move (six rows, the facts), and `desk-post`, `phone-post`,
  `desk-post-answered` (four letters), all meant.
- **Perf:** the standard scene as now; the Reservoir by night told.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/kinds.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/kinds.md`; `DESIGN.md` stage 4 notes the slice; the roadmap. Check: Prettier.
- [x] 1. **The kinds and the school:** `KINDS`, the palette, the Reservoir's slots, the dawn fish's hiding, the
      invariant of a kind's lake and hours. Check: `test/fish`, `test/reservoir`, `test/invariants`.
- [x] 2. **The bite:** the dawn gate, the trout's second window, the cast words, `fishTo`. Check: `test/bite`,
      `test/castwords`.
- [x] 3. **The drawing and the light:** the stretch, the second head, `eellight.ts`, `game.eels()`. Check:
      `test/swim`, `test/fishdraw`, `test/eellight`.
- [x] 4. **The words:** the facts in the journal, the baker's letter. Check: `test/journal`, `test/requests`.
- [x] 5. **The pictures and the stage:** the smoke stage, the new and moved pictures. Check: `npm run look`,
      `smoke/progress.spec.ts`.
- [x] 6. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the dawn gate dropped; the
      second window given to every kind; the light lit by day), the report. Commit and push.

## Part 6's notes (the pass)

- **The eel's light** needed radius 9 and intensity 40 (the spec's 6 and 1 were invisible): a soft pool on the bed
  round the eel at night.
- **The second head's cost:** part 3 gave every fish a `head2` group, drawn at a zero scale for every kind without
  two heads, and the standard scene's frame rose from 3.98 ms (the parent commit, measured under the same load) to
  4.53. The group is now made only for a school with a two-headed kind, so the pond's fish carry none, and the frame
  reads 4.04. The page hands the fish over by `fish.drawn`, the groups last handed over.
- **The two heads by eye:** not seen. A landed trout hangs tiny in the shore view and could not be found by a
  close-up through the test API (the camera orbits a point on the water and the fish hangs eight units above it);
  the heads are held by the unit test (within a head's width, turned `SWIM.secondHead` apart) and left to the
  user's play-test.
- **A dawn fish's window that ends with dawn** is let go quietly, no `missed`; rare, and the invariant holds.
- **The Reservoir's eight pictures** moved with the re-dealt school, meant, and were taken again; the four journal
  and three post pictures with the six rows, the facts and the fourth letter.
- **The download** grew from 210,821 to 212,548 bytes gzipped, the kinds, the light and the words; that figure was
  written into the perf baseline by hand.
- **The mutations:** the dawn gate dropped (three fail), the second window given to every kind (two fail), the
  light lit by day (one fails).
- **The smoke's Reservoir save** was first written in a shape the save type refuses; Playwright does not typecheck,
  so the full check's typecheck caught it.
