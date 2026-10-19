# Kinds of fish, the journal, and a drum of waste

## Context

The Duck Pond has one kind of fish, the glowing perch. Every catch is the same fish at a different weight. Stage 4 of `DESIGN.md`, "the journal and the junk treasures", is
where that changes. This first slice has three things:

- **kinds of fish,** each with a depth of its own;
- **a journal** of what has been caught;
- **the first junk,** a drum of waste on the pond's bed that is hauled up and cleans more than a fish.

The shelves are the slice after this one, not built here (`docs/junk.md`).

**Chosen by the user (19 Oct 2026):**

- **All three in one slice:** the kinds, the journal and the drum.
- **Three kinds:** glowing perch in the middle water (as now), sunny bream in the shallows, and pike in the deep.
- **Drums are counted in.** The Duck Pond has a fixed number of drums on its bed, each worth two fish. It is clean
  when every fish is cured and every drum is hauled up. That keeps `docs/cured.md`'s rule that the pond holds exactly
  what it takes to clean it.

Later slices: the shelves (the drum goes there), the other junk (old lures, Sunny Atom merchandise,
message bottles, the rubber duck), the journal's drawings and silly facts, and the two-headed trout, eel and
anglerfish with their own ways of biting.

## What

- **Three kinds swim in the pond.** Each kind has its own name, depth, weights, size and glow:
  - **sunny bream:** keeps to the shallows; small (0.2 to 1 kg); a warm yellow glow;
  - **glowing perch:** keeps to the middle water, as now (0.3 to 2.4 kg); the green glow;
  - **pike:** keeps near the bed; long (1.5 to 5 kg); a blue-green glow.

  The pond's twelve fish are 4 bream, 5 perch and 3 pike. Which slot is which kind is fixed, so the same seed gives
  the same school with no extra chance drawn. A cured fish of any kind is gold, as now.

- **Depth matters.** A fish comes to the lure only when the lure is near its own depth (`FISHING.band`, narrowed from
  5 to a first guess of 1.5). The lure sinks through the bands as it goes down. Strike early in the sink for bream,
  wait for perch, and leave it near the bed for pike. There is no new control: the sink is the choice.
- **The fight is the fish's own, within its kind.** A fish's heft is where its weight lies within its kind's range, so
  `fightFor` is unchanged: a heavy bream fights like a heavy perch. The card names the kind ("a feisty pike, 3.62 kg").
- **The drum.** Two drums of waste lie on the pond's bed, at places of their own seed. A lure lying near one on the
  bed may snag it: the bobber goes under heavily, and a strike hooks it. A drum does not fight. It never darts, the
  meter fills steadily while the reel is held, it never slips, and a let-go reel just waits. Landed, the card says
  "a drum of waste", and a tap hauls it up onto the bank. That cleans the pond two fish's worth, said in the toast
  ("Hauled out! The pond clears a lot."). A drum hauled is gone from the bed for good.
- **The journal.** A "Journal" item in the ⋯ menu opens a page. It lists each kind with how many were caught, the
  best weight, and the day it was first caught. A kind not yet caught shows as "not yet caught". Below that is the
  junk: "drums of waste hauled: 1 of 2". The page stops game time while open, as `DESIGN.md` says the journal does.
  It is kept in the save.

## Where it stands now (read)

| Figure                      | Now                                                                                     | Source                          |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Kinds                       | one: `PERCH`, 0.3 to 2.4 kg, read only by `game.ts` and the card                        | `lake.ts:570`                   |
| A fish's depth              | `keeps`, a share (0.2 to 0.7) of the deepest it may swim at its spot, one draw          | `fish.ts:134`                   |
| What depth does to the bite | almost nothing: `FISHING.band` is 5 and the lake is 6 deep at most                      | `bite.ts:75`                    |
| The lure                    | sinks at 1.2 a second to the line's depth (5) or 0.3 over the bed                       | `lure.ts:77`, `lake.ts:877`     |
| The fight                   | `fightFor(heft, temper, gear)`, heft from the weight within `PERCH`                     | `fight.ts:74`, `game.ts:244`    |
| A fish's colour             | per slot, in `materials` and `patterns`, handed over only on a cure or the water's step | `fishdraw.ts:85`, `main.ts:313` |
| The cleaning                | `1 - cured / 12`, from the count alone; clean when every fish is cured                  | `lake.ts:833`, `game.ts:272`    |
| The save                    | `{ cured, day }`; files `01-empty`, `02-cured`, `03-day`                                | `progress.ts`, `test/saves/`    |
| The ⋯ menu                  | Pair a phone, Go to bed, Start again; a dialog is a `.card` with `role=dialog`          | `index.html:745`, `main.ts:518` |
| Junk                        | none anywhere                                                                           | grep                            |
| Pace                        | 2.2 minutes for three fish                                                              | `scripts/pace-baseline.json`    |

The balance tool plays heft bands of a bare `Line` and reads neither `PERCH` nor the kinds. It stays exactly as it is,
because heft is still a share of a range. Pace will move on purpose: the narrowed band makes fish come only near
their depth, and the pace angler's lure sinks to the line's depth, the perch's and the pike's water.

## Acceptance criteria

1. **Kinds.** `KINDS` in `lake.ts` gives each kind an id, a name, a weight range, a depth share (`keeps` drawn
   within it), a body scale and a glow. `FISH_KINDS` gives the kind of each of the twelve slots, 4/5/3. `School.kind`
   is a `Uint8Array`. `fill` makes the same number of draws as now: `keeps` is the same one draw, put into the
   kind's band.
2. **Depth.** With `FISHING.band` narrowed, a fish is chosen only while the lure is within the band of its depth.
   A bream comes to a lure in the shallows and a pike to one near the bed, both held by tests on a fixed school.
3. **The catch.** The weight is drawn from the kind's range, and heft is its place in it, so `fightFor` and the
   balance tool are unchanged. `landed(kind, weight, temper)` gives the kind's name. The card's words come from a pure
   function, tested without a page.
4. **The look.** Each fish is drawn at its kind's scale and glow. `swim.ts` poses the scaled spine, and the joints are
   held in the water by the existing invariant. A cured fish is gold whatever its kind.
5. **Drums.** `DRUMS` gives a count of 2, a worth of 2, a weight, a snag reach and rate, and a seed. Their places are
   on the bed, from their own seed, never the game's chance. The bite's quarry is a fish or a drum. A drum is snagged
   only while the lure is lying on the bed within reach of it, plays a `Line` with the drum's profile (no darts, never
   slips), and when landed and tapped is hauled: `save.drums` rises, it is saved, and `GameEvents.hauled` is told.
6. **The cleaning.** `contaminationAfter(cured, drums)` is
   `max(0, 1 - (cured + drums × worth) / (FISH_COUNT + DRUMS.count × worth))`, the one place it is worked out. The
   gifts still come from the count cured. `pondClean` means every fish is cured and every drum hauled. With every fish
   cured, a drum left on the bed can still be snagged.
7. **The journal.** `Save.journal`, default `{}`, holds `{ caught, best, first }` for each kind's id, updated at each
   stow (`first` is the day). The journal page's words come from a pure function: each kind, caught or not, and the
   drums hauled. It opens from the ⋯ menu, closes on its button, Escape or the backdrop, and the page does not step
   the game while it is open.
8. **Loading.** The fish of each kind cured on load are as many as the journal says that kind has had caught (at most
   the kind's slots). If the journal accounts for fewer than `cured` (an old save), the rest are cured in slot order,
   as now. The first `drums` drums load hauled.
9. **The save files.** `test/saves/04-journal.json` has `cured`, `day`, `drums` and a journal. Bad entries are taken
   for none, field by field: an unknown kind, a negative count, a weight outside its kind, or a first day after today.
10. **The test API.** `game.fish()` gives each fish's `kind`. `game.drums()` gives each drum's place and whether it's
    hauled. `game.journal()` reads the save's journal. `game.openJournal()` opens the page, and `fishTo` can take a
    kind or `'drum'`.
11. **The invariants.**
    - Every fish's kind is a known one and fixed.
    - Hauled drums are from 0 to `DRUMS.count` and equal the save; a hauled drum is never the bite's.
    - The contamination is the formula's, unless the lever has set it.
    - For each kind, the cured fish are `min(journal caught, its slots)`, unless an old save's leftover applies.
    - A journal's best weight is within its kind's range, its first day is at most today, and the caught counts sum to
      at most `cured`.

## Edge cases (from the checklist)

- **save:** `journal` and `drums` are saved at each stow and haul. An old save has no journal and no drums: its cured
  fish are cured in slot order, the journal is empty, and no drum is hauled. A journal entry for a kind the game
  doesn't know is dropped. A best weight outside its kind's range is taken for none. `drums` past `DRUMS.count` is
  held to it. Start again wipes them all.
- **scale:** 12 fish of 32 capacity, as now. Two drums, fixed. The journal has at most `KINDS.length` (3) entries,
  watched by `leaks` under the 2000-byte save ceiling.
- **phone:** the journal page and the card with each kind at all eight screens of `smoke/layout.spec.ts`, and at the
  Pixel 7a's 412×915. A paired phone strikes and reels a drum as a fish. Its word for a drum is the same as for a fish.
- **the mode:** look and cast unchanged. The journal opens over either. Keys and taps don't reach the game while it's
  open.
- **the rung:** full and lean draw the same kinds and drums.
- **the switches:** each kind's glow at each time of day (a picture by night), the lake clear and sick, the paint on
  and off for the drum, and caustics unchanged.
- **the water:** a bream in the shallows near the shore, and a pike near the bed at the deepest. The joints of the
  long pike are held in the water by the existing rule. A drum on the bed is under the water and never off it.
- **the line:** cast and sunk through each band; reeled in early (bream water); left on the bed near a drum (a snag)
  and away from one (none); a drum hooked and reeled; the reel let go on a drum (it waits; it never slips).
- **the fish:** each kind wandering at its own depth, drawn to the lure only in its band, hooked, landed and cured. A
  cured fish of any kind never bites. Two fish at one lure: the nearest in the band.
- **the day:** the journal's first day is today's. The journal open stops the clock, so midnight waits while it's
  open. A drum hooked at midnight holds the day open, as a fish does.
- **the lake's contamination:** it falls only by a cure or a haul. A drum's haul is two twelfths' worth of the old
  scale. The pond is clean at the last cure or haul, whichever is last.
- **snags:** a drum is the first thing snagged on the bed. Reeds, rocks and rooftops are later.
- **the cabin, the boat, the calendar's seasons, the real clock:** not reachable.

## Decisions (yours)

1. **The mix:** 4 bream, 5 perch and 3 pike (recommended), so the pike is the rarer prize.
2. **The depth band:** narrowed from 5 to 1.5 (recommended), so depth is a real choice. It's a first guess, tuned by
   measuring which kinds the pace angler meets. The alternative is 2.5, which makes depth looser.
3. **The drums:** 2 on the Duck Pond's bed, each worth two fish (recommended), so the pond takes 16 "cleans" to clear,
   not 12.
4. **The drum's haul:** a snag while the lure lies on the bed near one, then a slow, steady reel with no darts and no
   slipping (recommended). The alternative is that a drum comes up whenever the lure is near it, with no reel at all.
5. **The journal stops time while open** (recommended), as `DESIGN.md` says the journal does. The alternative is that
   it doesn't, as the other menus don't yet.
6. **Cured fish are gold whatever their kind** (recommended), as now. The alternative is a cured look for each kind,
   which was left for later; a cured fish is let go into the pond at once.

## Performance risk

- **Frame:** the kinds are per-slot colours and scales in arrays that already exist, handed over at the moments they
  are now. Two drums are a static group each, or one dynamic group that moves only at a haul. The standard frame is
  measured against the parent commit.
- **Step:** the bite's band check is the same sum. The drum's snag is one distance check a drum while the lure lies.
  The bench is held at ±15%.
- **Download:** a few kB of code. The journal page is HTML. The baseline is written through `/gate-moved`, with the
  bytes said.
- **Pace:** moves on purpose (the band). It's measured, then written through `/gate-moved` with the figure and the
  reason.
- **Balance:** unmoved, exactly. A move is a bug.

## Design

- `src/lake.ts`:
  - `KINDS` (replacing `PERCH`) and `FISH_KINDS`;
  - `DRUMS`;
  - `CURE` reads `DRUMS` too, and `contaminationAfter(cured, drums)`;
  - `FISHING.band`;
  - each kind's glow lives in `src/palette.ts`, and the drum's colours too.
- `src/fish.ts`: `School.kind`; `fill` puts `keeps` in each kind's band; `cure` keeps its meaning.
- `src/drums.ts` (new, pure): the drums' places from their seed on the bed, and the snag test. It has no content
  imports: `DRUMS` is handed in.
- `src/bite.ts`: the quarry is a fish or a drum; the band check reads it; a drum's snag; a drum's heavy dip.
- `src/fight.ts`: `drumFight(gear)`, the drum's profile for the `Line`: no darts, never slips.
- `src/game.ts`:
  - the weight drawn from the kind;
  - `stow` writes the journal;
  - `haul` (the card's tap on a drum), with `GameEvents.hauled`;
  - the load cures by kind and hauls by count.
- `src/progress.ts`: `drums` and `journal`, each read field by field and defaulted.
- `src/journal.ts` (new, pure): updating an entry on a catch, and the page's words.
- `src/fishdraw.ts`: each slot's scale and glow from its kind, handed in. `src/swim.ts` poses a scaled body.
  `src/drumdraw.ts` (new): the drums on the bed, a yellow drum with the atom (painted, with the paint's set).
- `src/fightview.ts`: the card's words, from a pure function, for a kind or a drum.
- `src/main.ts` and `index.html`: the Journal item and its dialog (as `#startAgain` is), added to the overlays that
  keep input from the game, and not stepping the game while it is open. The hauled toast goes in `src/pondview.ts`.
- `src/debug.ts`: criterion 10. `src/invariants.ts`: criterion 11. `scripts/determinism.ts`: hashes kinds, drums,
  `save.drums` and the journal.
- `scripts/fuzzer.ts`:
  - a "lie on the bed" cast, a cast left to sink to the bed, so drums are reached;
  - the start draws `drums` and a journal from its own stream, as it draws `cured`;
  - reach tests in `test/fuzz.test.ts`: each kind caught, a drum hauled, and a pond cleaned by cures and hauls.
- `scripts/leaks.ts`: `journal kinds` (ceiling `KINDS.length`) and `drums hauled` (ceiling `DRUMS.count`).
- `DESIGN.md`: stage 4's note says what's in. Its "the pond holds what it takes to clean it" is said with drums.
  "What is not decided" gains the drum's worth as an estimate. `CLAUDE.md`: the kinds, the drum, the journal, the
  save, and a model feature for "a kind of fish".

## Test plan

- **Unit:**
  - `test/fish.test.ts`: each slot's kind, `keeps` within each kind's band, and the same number of draws as before.
  - `test/bite.test.ts`: a bream comes in the shallows and not at the bed; a pike at the bed and not in the
    shallows; a cured fish of each kind never comes; a drum snags only lying near it on the bed; a hauled drum never
    snags.
  - `test/fight.test.ts`: the drum's fight never darts or slips, and lands with the reel held.
  - `test/game.test.ts`:
    - the weight is within the kind's range;
    - a stow writes the journal (count, best, first day);
    - a haul saves, lowers the contamination by the formula and tells;
    - the pond is clean only when all are cured and hauled;
    - a load cures by kind;
    - an old save cures in slot order.
  - `test/journal.test.ts`: an entry on a first catch, a better weight, a worse one, and the page's words.
  - `test/drums.test.ts`: the places on the bed, under the water and the same every time.
  - `test/lake.test.ts`: the formula at 0, after cures alone, after hauls alone, and at clean; the slots 4/5/3; the
    kinds' bands not overlapping too far.
  - `test/saves.test.ts`: `04-journal.json`, and each bad shape.
  - The card's words for each kind and a drum.
- **End-to-end (`smoke/progress.spec.ts`):**
  - "each kind is caught at its depth and written in the journal": `fishTo('bream')` then `fishTo('pike')`, then
    land and stow each, and see the journal page list both with their weight and today's day;
  - "a drum on the bed is hauled up and cleans the pond more": fish to a drum, reel it in (it never slips with the
    reel let go), haul it, and see the gauge fall two steps and the toast;
  - the journal stops the clock while open.
- **Layout (`smoke/layout.spec.ts`):** the journal page and the drum's card at all eight screens.
- **Fuzzer:** the new cast. The reach tests (each kind, a drum, a pond cleaned with hauls). The new invariants hold
  over seeds 1 to 24.
- **Leaks:** the two new ceilings. The save bytes stay under 2000.
- **Pictures (`smoke/look.spec.ts`):**
  - `fish-kinds-day` and `fish-kinds-night` (the three kinds under the water);
  - `drum-bed` (a drum on the bed, seen into);
  - `fishing-landed-pike` and `fishing-landed-drum` (desk);
  - `desk-journal` and `phone-journal` (a journal part filled);
  - the existing pictures move (the school's colours and sizes), on purpose: each is written again and looked at.
- **Perf:** the standard frame against the parent.
- **Mutation:** the band ignored; the weight drawn from the perch's range for every kind; a drum that slips; a haul
  that doesn't count in the cleaning; the journal's best kept when worse; the load ignoring the journal's kinds; the
  journal not stopping the clock. Each must fail its test.

## Parts

- [x] 0. **The spec in the repo:** this file, `docs/journal.md`, agreed with the user on 19 Oct 2026.
- [x] 1. **Kinds in the school:** `KINDS`, `FISH_KINDS`, `School.kind`, the bands, the weight by kind, the card's
      words, and the draw count unchanged. Check: the fish, game and card unit tests, seen failing first, and the
      balance tool unmoved.
- [x] 2. **Depth matters:** `FISHING.band` narrowed and the bite by depth. Check: the bite unit tests, then pace
      measured and decided through `/gate-moved`.
- [x] 3. **The kinds drawn:** scale and glow by kind, the posed scaled spine, and a picture looked at. Check: the
      fishdraw unit test, and `fish-kinds-day` looked at.
- [x] 4. **The drum:** `DRUMS`, `drums.ts`, the snag, `drumFight`, `haul`, the formula, `save.drums`, the drawing
      and the invariants. Check: the drum, bite, fight, game and lake unit tests, and `drum-bed` looked at.
- [x] 5. **The journal:** `journal.ts`, `save.journal`, the load by kind, `04-journal.json`, the page in the menu,
      and the clock stopped. Check: the journal and saves unit tests, and the end-to-end stages.
- [x] 6. **The gates play it:** the fuzzer's cast and start, the reach tests, the leaks ceilings and the determinism
      hash. Check: fuzz on seeds 1 to 24, and the leak run.
- [x] 7. **The pass:** the full check, the pictures written and looked at, perf, the mutations, `DESIGN.md`,
      `CLAUDE.md`, `docs/journal.md` and the report.

**Built on sonnet,** in a session switched to it in the model menu (`~/.claude/CLAUDE.md`), through `/feature`'s
phase 3 onward, from `docs/journal.md`.
