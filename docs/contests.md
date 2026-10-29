# The rival's contests: three fish in the rain and three fish on three casts, two letters from Flo Keel with a counter each, and the post's open letters saying how far they have got

## Context

`DESIGN.md`: "The old fisherman's rival sets friendly contests: the biggest fish, the fewest casts, a fish in the
rain." The biggest fish is in (`docs/post.md`, the `biggest` letter). This is B5 of `docs/roadmap.md`, stage 7's
fourth slice: "a request with a counter". The post's letters so far are met by what the save already keeps (cures,
the journal, the finds, the album); a contest is met by something that happens in play and is counted as it does,
so the save gains a tally and the letters a line saying how far along they are.

## What

- **The tally** (`Save.tally`, `{ rain: number; run: number; best: number }`, defaults 0): `rain` is how many fish
  have been stowed while the weather was `rain` (the sky at the stow, whatever lake; a sun-shower does not count,
  which the letter says); `run` is how many fish in a row have been landed and stowed with no cast wasted, and
  `best` the longest such run. **A cast is wasted** when it ends with no fish stowed: the next `cast` finds the last
  one unstowed (`castStowed` false since the cast) and puts `run` to nought before counting. So a lure reeled in
  empty, a fish that slips, a missed strike, a drum or a treasure hauled instead (a cast with no fish in it), a cast
  onto the bank and a yawn's reel-in all start the run again; a cure between casts does not. `stow` sets `castStowed`,
  puts `run` up and `best` to the greater, counts `rain` if it is raining, persists (it does already) and asks the
  town (it does already).
- **Two letters** from Flo Keel in `REQUESTS`, `rain` and `casts`, after the postmistress's:

  > Dear Rival, Ned says fish do not bite in the rain. Ned says a lot of things. Land three while it is raining and I
  > will stand you a hot chocolate. A sun-shower does not count. Flo Keel.

  > Three in the rain. Ned has gone to check his barometer. The hot chocolate is at the bakery, tell Marigold I sent
  > you. Flo.

  > Dear Rival, New game. Three fish on three casts, not one wasted. A cast that comes back empty starts you again. I
  > did it once, in 1998, and nobody saw. Flo Keel.

  > Three on three. I saw it this time, from the dam. Fair is fair. Flo.

  `rain` is met at `tally.rain >= CONTESTS.rain` (3), `casts` at `tally.best >= CONTESTS.run` (3); `CONTESTS` in
  `src/lake.ts`.

- **The counter on the letter:** `Request.progress?(save, lakes): string | null`, a line the post page shows in
  small under an open letter and never under an answered one: the rain's "In the rain so far: 1 of 3."; the casts'
  "Best run: 2 of 3. This run: 1." (the run part only while it is above nought); and, since it costs a line, the
  logbook's "Pages found: 4 of 6." and the rainbow's "Kinds caught: 4 of 6." `postWords` carries it as
  `PostLetter.progress`; the page writes a `small.progress` element.
- **The toast:** nothing new; a contest met is told as any answered letter is.
- **The test API:** `game.tally()` reads the three; `game.save()` has it already.

## Where it stands now (read)

- `Game.stow` persists and calls `answer(true)`; `Game.cast` is the one road a cast takes (the fuzzer's and the
  page's), `reelIn` the way back, and the yawn and a travel reel in through it.
- `postWords` is pure over `Request` and `save.requests`; the page writes a heading, a body and a reply.
- The save has `requests` and `photos` read after the lakes; the corpus is at `12-photos.json`.
- The fuzzer casts, strikes, reels and stows already, and sets the weather lever to rain on some seeds.

## Acceptance criteria

1. `tally.rain` goes up by one at a stow in rain, not in a shower or sun; `run` goes up at each stow, `best` keeps the
   greatest, and a cast after a wasted one puts `run` to nought: an empty reel-in, a slip, a drum hauled, a cast onto
   the bank, each tested; a cure between casts keeps the run.
2. The two letters are met at three and not at two; answered, they stay answered though `run` falls.
3. `postWords` gives the progress line under the open letters that have one, none under an answered one.
4. A save reads the tally back, takes anything but a non-negative whole number as nought, and holds `run <= best`;
   an old save has noughts.
5. The invariants hold the tally's three to non-negative whole numbers with `run <= best`.

## Edge cases (from the checklist)

- **save:** `tally` with defaults, `readTally`, `test/saves/13-tally.json`; a load mid-run keeps the run.
- **the lakes:** the tally is the save's, so a run carries over a journey (travel reels in: the journey's cast
  is wasted only if one was out; `travel` calls `reelIn`, so a lure out at departure wastes it, said in the test).
- **the day:** the yawn reels the lure in: a lure out at midnight is a wasted cast; the day's weather by the day.
- **the weather:** the lever's rain counts as the day's does (the fuzzer sets it); a shower does not.
- **the fish, the line:** a slip wastes; a fish let go by a missed strike then reeled in wastes.
- **the contamination:** a clean pond's casts are all wasted, and the run stays at nought, no rule broken.
- **the mode, the phone, the rung, the switches, the water, the cabin:** not reachable.

## Decisions (mine, said so they can be changed)

- **Three** for both contests: a first guess, tuned in play; the fuzz coverage test says both are reached.
- **A drum or a treasure wastes the cast** for the run, since the contest is fish on casts; the letter says
  "a cast that comes back empty", and a drum is not a fish.
- **A sun-shower does not count** as rain, so the rainbow stays its own thing; the letter says so.

## Performance risk

- **Frame:** nothing (three numbers at a stow and a cast). **Boot:** nothing. **Download:** the letters and the
  lines, about 1 kB gzipped, said exactly. **Save:** about 40 bytes, within the ceiling.

## Test plan

- **Unit:** `test/tally.test.ts` (1, 2 on `Game`, with the helpers that hook and land a fish, a drum and a treasure
  in `test/game.test.ts`), `test/requests.test.ts` (2, 3: the words word for word, met at three), `test/post.test.ts`
  (3), `test/saves.test.ts` (4), `test/invariants.test.ts` (5).
- **End to end, `smoke/progress.spec.ts` "the contests":** a save with `tally.rain` 2 and the lever on rain:
  `fishTo('landed', 'bream')`, a stow, the toast "Answered!" and the post shows Flo's reply; a save with `best` 2
  and a stow on a fresh cast answers the casts letter; the open letters show their lines.
- **Fuzzer:** nothing new to do; `test/fuzz.test.ts` gets a test that across seeds 1 to 24 a fish is stowed in rain
  and a run of two is reached (the weather lever is set to rain on some seeds already; if not reached, start some
  seeds with a tally from a stream of their own, as the album does); the invariants carry the tally's rules.
- **Pictures:** `desk-post`, `phone-post`, `desk-post-answered` move (eight letters, the lines); new
  `desk-post-progress` (a save part way through both contests and the logbook, so the lines are seen).
- **Perf:** the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/contests.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/contests.md`; `DESIGN.md` stage 7 notes the slice; the roadmap. Check: Prettier.
- [x] 1. **The tally:** `CONTESTS`, `Save.tally`, its reader and corpus file, `Game.cast`/`stow`/`reelIn`'s counting,
      the invariants, `game.tally()`. Check: `test/tally`, `test/saves`, `test/invariants`.
- [x] 2. **The letters and the lines:** the two requests, `progress` on the four, `postWords`, the page's line.
      Check: `test/requests`, `test/post`.
- [x] 3. **The stage, the pictures and the fuzz coverage:** the smoke stage, the layout count, the pictures, the fuzz
      test. Check: `npm run look`, `smoke/progress.spec.ts`, `test/fuzz`.
- [x] 4. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (a shower counted; a wasted
      cast not resetting; met at two), the report. Commit and push.

## Part 4's notes (the pass)

- **A broken run reaches the save at the next write,** not at the cast that broke it: the clock is written every ten
  seconds at the pond, so a reload inside that window keeps the old run. Said here; a persist at every cast would
  write the save on every throw for a figure the next stow writes anyway.
- **The fuzzer does not answer either letter in play:** its monkey stows nought to three fish a seed, so across the
  twenty-four seeds it stows one in rain and reaches a run of two only from a start tally (two seeds in five start
  with one, from a stream of their own). The contests are held by `test/tally.test.ts`, `test/requests.test.ts` and
  the stage; the fuzz test holds the weaker reach and says so.
- **The cure test's stows are a run of three,** so `casts` is answered inside it, and the test says so.
- **`progress` is a property function, not a method,** since the lint's unbound-method rule refuses a test that
  pulls a method off the object.
- **Figures:** quick check 1600 tests; fuzz seeds 1 to 24 clean; bench, pace (2.2 to 2.11 min), balance and leaks
  within tolerance; perf in the full check boot 795 ms, frame 3.97 ms, download 217021 to 217781 B (the letters and
  the lines, written by hand), the Reservoir 769 ms and 3.92 ms; look 126 pictures (new `desk-post-progress`; moved
  the three post pictures by the two letters and their lines); progress 443 stages. Mutations: a shower counted, a
  wasted cast not breaking the run, the rain letter met at two: each caught by one test.
- **Not verified:** the contests in play on the live site; three is a first guess for both.
