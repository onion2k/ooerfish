# Fights that differ, fish that get away, and gifts that help

## Context

The user played the game and found that every catch feels the same and that no fish ever escapes. Harder fights
need a counter, so they asked for gear: a better rod, line, bobber or bait. This spec does all three together,
because they balance each other. A fish's size and temper shape its fight. A fish can get away, at agreed rates.
Gifts earned by curing make the fight easier as the pond heals.

## Where it stands now (measured 17 Oct)

The real `Line` was played by the pace gate's careful hand (`careful` in `src/angler.ts`) at four reaction times:
400 fights for each size, in a half-sick lake.

| Reaction                 | Light fish         | Middle       | Heavy        |
| ------------------------ | ------------------ | ------------ | ------------ |
| 0.15 s (quick)           | 100% landed, 8.5 s | 100%, 8.4 s  | 100%, 9.5 s  |
| 0.25 s (the pace gate's) | 100%, 8.7 s        | 100%, 17.4 s | 100%, 19.4 s |
| 0.40 s                   | 100%, 25.6 s       | 100%, 27.1 s | 100%, 27.5 s |
| 0.60 s (slow)            | 100%, 45.3 s       | 100%, 52.3 s | 96%, 55.5 s  |

So a slow hand loses no fish, it only takes longer, and size hardly matters. A heavier fish darts at most 1.6 times
as fast (`FIGHT.heavyDart` 0.6), and every fish rests 0.6 to 1.8 s.

**The levers are steep.** With the meter draining twice as fast (`drain` 0.12), a 0.25 s hand lands 100% light and
98% heavy, but a 0.4 s hand lands only 30% and 11%. With heavy fish also darting 2.5 times as fast, a 0.25 s hand
lands 99% light and 42% heavy. The targets are reachable, but the rates fall off a cliff, so they are tuned against a
measuring tool, not by eye.

## What

1. **Each fish fights its own way.**
   - Its size sets how fast and how far it darts, how long it rests, and how fast the meter fills.
   - Its **temper** is drawn when it is hooked: calm, steady or feisty. It shifts those figures again, so two fish of
     one size still differ.
   - The catch card says the temper ("a feisty glowing perch, 1.84 kg").
   - A sick lake's fish still rest less, so the fights ease as the pond heals.
2. **Fish get away.** When the meter empties the fish slips off, as the design has it: nothing is lost, and the
   fish swims on, still glowing, to be caught again. The rates are tuned to the agreed targets.
3. **Gifts from curing.** At set cures the player is given a piece of gear, said in a toast ("A gift from the Sunny
   Atom: a longer rod. Your zone is wider."). Each eases one part of fishing, and is held for the rest of the game:
   - **rod:** a wider zone;
   - **reel:** the zone lifts faster;
   - **line:** the meter drains more slowly;
   - **bobber:** a longer strike window;
   - **bait:** fish notice the lure sooner.

   The gear is worked out from the cure count, so the save needs no new field, and a later shop can sell the same
   gear.

## Acceptance criteria

1. A hooked fish's fight is set by its size and temper through `fightFor(heft, temper)`, a pure function into the
   `Line`. The same seed gives the same fish and fight. The card names the temper.
2. **The balance tool** (`npm run balance`) plays the real `Line` with the careful hand at reactions 0.15, 0.25, 0.4
   and 0.6 s, across light, middle and heavy fish and each gear level, over fixed seeds. It reports the landing rate
   and the median fight length, and is held to a baseline both ways. It reproduces this spec's table today, within
   a few percent, before anything is changed.
3. **With no gear,** the rates are inside the agreed targets (decision 1).
4. **With all the gear,** the same hands land clearly more, inside the agreed targets.
5. A fish that slips is told (`GameEvents.slipped`, as now), swims on uncured and can bite again later.
6. The gift for a cure count is given exactly once, said in a toast, and the gear is in force from the next fight.
   A load gives the gear its count has earned, with no toasts.
7. The pace gate moves, as meant, and is written again through `/gate-moved` with the figure.

## Edge cases (from the checklist)

- **save:** no new field; gear is derived from `cured`. An old save loads with the gear its count earns.
- **scale:** one fight at a time, as now. The tool's runs are its own and cost the check some seconds (measured).
- **phone:** the phone's bar draws the wider zone from the `FightPicture`'s `width` (which today is fixed: it
  becomes the gear's). The temper word fits the card at a phone's width (a picture).
- **the mode:** unchanged.
- **the lab:** unchanged.
- **the line:** bitten and let out of the zone until the meter empties: the fish slips off, nothing lost, and can
  come again. Held by an end-to-end test.
- **the fish:** hooked with each temper; a slipped fish is uncured and can be the next to bite.
- **the lake's contamination:** sicker means fewer rests; clean is calmest.
- **snags, the boat, the calendar, the real clock, the cabin:** not reachable.

## Decisions (yours)

1. **The targets.** Recommended: with no gear, a 0.25 s hand (the pace gate's, a careful player) lands about 90%
   of light, 75% of middle and 55% of heavy fish, and a 0.4 s hand about 60%, 40% and 20%. With all the gear, a
   0.25 s hand lands about 98%, 92% and 85%. A 0.15 s hand lands nearly everything throughout. A median fight is
   under 30 s.

   **Changed with the user, 17 Oct, after the first tuning:** the median fight landed by the 0.25 s hand is
   between 10 and 30 s in every column, not merely under 30. The first tuning met the rates by swinging the meter
   three to five times as fast (fill 0.28, drain 0.28), which gave 3 to 13 s fights and a fish that could not keep
   up with the line. The rates come from the fish (size and temper) instead, with the meter near its old pace. A
   hand that never holds the reel lands no fish: the fish's lowest dart (`floor`) stands above a zone resting at
   the bottom of the bar, so a meter cannot fill while the player does nothing.

   **Relaxed with the user, 17 Oct, after the second tuning:** the agreed rates could only be met by making calm
   fish sure to be landed and feisty middle and heavy fish never landed, so the temper decided more than skill. The
   user chose instead that **every fish is catchable**. For the careful 0.25 s hand with no gear: light about 100%,
   middle about 98%, heavy about 80%, and every temper and size landed at least 20% of the time (feisty heavy about
   1 in 5). For the 0.4 s hand: about 65%, 42% and 21%. The 0.15 s hand lands nearly all. The median landed by the
   0.25 s hand is 10 to 30 s. Fish escape mostly from slower hands; size and temper make fights longer, not
   unwinnable. Every seed of the pace gate's angler lands its three fish.

2. **The gifts and when.** Recommended: the line at 2 cures, the reel at 4, the rod at 6, the bobber at 8 and the
   bait at 10 (the pond takes 12), so the hardest fights come first and the gear arrives as the pond heals.
   Alternatively, fewer and bigger gifts (rod at 4, line at 8).
3. **The tempers.** Recommended: calm (1 in 4), steady (2 in 4) or feisty (1 in 4), with feisty heavy fish the hard
   ones. The alternative is size alone.
4. **The gift's toast:** the giver named "the Sunny Atom", the power plant's mascot from `DESIGN.md` (recommended),
   or no giver.

## Performance risk

- **Frame:** none. A fight is the same sums with different figures.
- **The full check:** the balance tool's runs are measured, and kept to a few seconds by the number of fights.
- **Download:** a few hundred bytes, written through `/gate-moved`.
- **Pace** moves and is rewritten, meant.

## Design

- `src/lake.ts`: the content tables. `FIGHT` keeps its base figures. `SIZE` (how each figure scales with heft),
  `TEMPERS` (a name, odds and multipliers), and `GEAR` (the gifts in order: the cure count, a name, the toast's
  words and what each eases) are new, all first guesses until tuned.
- `src/fight.ts` (new, pure): `fightFor(heft, temper, gear)`, which returns the figures a `Line` plays by.
  `gearFor(cured)`, the gear a count has earned. `drawTemper(random)`.
- `src/line.ts`: `start` takes the figures from `fightFor` rather than reading `FIGHT` directly. The zone's width is
  one of them, and `FightPicture.width` reads it.
- `src/game.ts`: draws the temper on the hook, passes the gear, and adds `GameEvents.gifted(name)` on the cure that
  earns one. The catch card's words gain the temper.
- `src/bite.ts`: the bobber's window and the bait's notice read the gear.
- `scripts/balance.ts` and `scripts/balancing.ts` (its sums, unit-tested): the tool, with its baseline in
  `scripts/balance-baseline.json`, added to `npm run check`.
- The page: the gift toast in `pondview.ts` and the temper on the card in `fightview.ts`. `docs/fight2.md` holds
  the spec.

Out of scope: a shop and its money; gear drawn on the rod; more fish kinds; the boat.

## Test plan

- **Unit:**
  - `fightFor` across size, temper and gear;
  - `gearFor` at each count;
  - the temper draw's odds over many seeds;
  - the `Line` playing a profile's figures;
  - the balance tool's sums (`test/balancing.test.ts`).
- **The tool's trust:**
  - before any change, it reproduces the table above;
  - a fault put there on purpose (the meter never draining) moves it as expected;
  - the same seeds give the same answer twice.
- **End-to-end (`smoke/progress.spec.ts`):**
  - a fish let out of the zone slips, is told and swims on uncured;
  - the gift at the second cure shows its toast once, and the next fight's zone is the line's (or rod's) figure;
  - a load from a save of 6 has three gifts and no toasts;
  - the card names the temper.
- **Fuzzer:** nothing new for the player to do. A reach test that fish slip and that gifts are given; and
  invariants that the gear never shrinks as cures rise, and that the zone's width is the gear's.
- **Pictures:** the card with a temper at a desk's and a phone's width; the gift toast; the fight with the wider rod.
- **Mutation:** a gift given twice; the gear ignored in the fight; the temper ignored; a slipped fish left cured.

## Parts

- [x] 1. **The balance tool:** `balance.ts` and `balancing.ts`, its baseline of today's game, and its trust checks.
      Check: its sums' unit tests, and today's table reproduced.
- [x] 2. **Size and temper:** `fight.ts`, `TEMPERS` and `SIZE`, the `Line` from a profile, and the card. Check:
      unit tests, and the balance tool showing the sizes and tempers apart. **It also takes part 4's no-gear
      half:** the figures are tuned to decision 1's no-gear targets here, so part 4 tunes only what the gear
      brings.
- [ ] 3. **The gifts:** `GEAR`, `gearFor`, the gear in the fight and the bite, the toast, and the load. Check: unit
      and end-to-end tests.
- [ ] 4. **Tuned to the targets:** the figures tuned with the balance tool to decision 1, and the balance and pace
      baselines written through `/gate-moved`. Check: the tool inside the targets at each gear level.
- [ ] 5. **The pass:** the full check, fuzz on seeds 1 to 24, pictures looked at, the mutations, `CLAUDE.md` and
      the report.
