# The post: letters from the town asking for things, a page to read them on, and a reply when a request is met

## Context

Stage 7 of `DESIGN.md` is the town: "the story is told through the townsfolk's letters and the pages of a
logbook", each townsperson with a request, and "a request has a soft 'by the festival' and never fails; it waits
until next time". Stage 5's morning is "the calendar, the radio's forecast and gossip, and the mail". This is B1
of `docs/roadmap.md`: the post and the first requests, those the fish already serve. The design names the
townsfolk by role only, and lists their names and the story's words as not decided; the user asked for names and a
voice to be proposed here, to change as they like. Later slices add letters as their fish and finds arrive (the
baker's pink fish, the postmistress's eel, the engineer's logbook, the mayor's lanterns, the contests).

**Chosen by the user (28 Oct 2026):** the town, the names, the voice and the three letters as proposed below, and
the rival's 3.5 kg.

## The town (proposed)

The town is **Brightwater**, below the Sunny Atom plant. Its people, in the design's roles:

| Role                       | Name                                           | A line of them                                                       |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| The postmistress           | **Mrs Ida Penny**                              | writes for anyone who cannot, ducks included; knows everything first |
| The retired plant engineer | **Wendell Fisk**                               | embarrassed, precise, kind; keeps saying it was not his department   |
| The baker                  | **Marigold Bunn**                              | pays in pies and buns; weather by the rise of her dough              |
| The children's club        | **the Glow-Worms**, letters by **Pip (age 9)** | capitals when excited                                                |
| The mayor                  | **Mayor Hubert Quill**                         | fond of a ceremony and a ribbon                                      |
| The old fisherman          | **Old Ned**                                    | has caught everything once, in nineteen fifty-something              |
| His rival                  | **Flo Keel**                                   | quicker, drier, buys the buns when she loses                         |
| The duck family            | **the Mallards**, seven of them                | the Duck Pond's own; Mrs Penny writes for them                       |

**The voice:** a short letter, first person, three or four sentences: a greeting, what is asked and why, a kind word
that there is no hurry, a signature. Warm and a little funny, picture-book, never tense; a soft date is "by the Lake
Festival if you like, and if not, next year". A reply is shorter and glad.

## The letters (B1's three, proposed)

1. **`ducks`, from Ida Penny for the Mallards.** Met when the Duck Pond is clean (every fish cured, every drum
   hauled: the lake's `toClean` and `drums.count` against its entry).

   > Dear neighbour, The Mallards have asked me to write, since a duck cannot hold a pen. They would like the Duck
   > Pond back the way it was, clear to the bottom, and they will come home the day it is. No hurry, they say; the
   > reeds up the hill are comfortable enough. Yours, Ida Penny, Postmistress.

   > The Mallards are back, all seven, and have been round the pond twice to check it. Thank you from all of us at
   > the post office. Ida.

2. **`rainbow`, from Pip and the Glow-Worms.** Met when every kind in `KINDS` has been caught at least once, over
   every lake's journal.

   > Dear Fisher, We are the Glow-Worms and we are making a RAINBOW for the school hall, and we need one fish of
   > every kind that glows. You do not have to keep them. Just catch them and we will draw them. Please. From Pip
   > (age 9) and the Glow-Worms.

   > WE DREW THEM ALL. The rainbow is on the wall by the coats and Miss says it is the best one yet. Thank you from
   > Pip and everybody.

3. **`biggest`, from Flo Keel.** Met when any journal's `best` is at or over `REQUESTS.biggest.kg` (3.5, an
   estimate: a pike runs 1.5 to 5 kg, so it is a big one and not the biggest).

   > Dear Rival, Old Ned says the biggest fish in the Duck Pond is his, from nineteen fifty-something. I say it is
   > still in there. Land one over three and a half kilos and I will buy the buns. No rush. Fish do not read
   > calendars. Flo Keel.

   > Three and a half! I have told Ned and he has gone quiet. The buns are at the bakery with your name on them.
   > Flo.

## What

- **The requests are content**, `REQUESTS` in `src/town/requests.ts`: id, `from` (the name), `role`, `asks` (the
  letter), `reply`, and `met(save, lakes)`, a pure predicate over the save. `TOWN` beside it names the town and
  its people (`src/town/town.ts`), so later slices and the radio can use them. The letters are words beside the
  code, as `GOSSIP` is.
- **The save** gains `requests: string[]`, the ids answered in order (default `[]`; unknown ids dropped, each once,
  one the save does not earn dropped too, read after the lakes so the request's own test is asked,
  held to `REQUESTS.length`; `test/saves/11-requests.json`). `Game.answer()` runs after `stow`, `haul` and at
  construction: every request met and not yet in `save.requests` is added, persisted, and told as
  `GameEvents.answered(id)` only when it happens in play (never at a load, which marks silently). Nothing is ever
  removed: a request never fails.
- **The toast** at the pond: `pondWords` gains `answered`, "Answered! <from> will be pleased.", for `HEARD_FOR`,
  after the cure line as the gift's waits.
- **The post page** `#post` (markup and CSS from `#sleep`'s, the card as the journal's width), "Post" in the ⋯ menu
  after Journal, and a tap on the cabin's table in the cabin view (`tableHit` in `src/pick.ts` from the table's
  box in `CABIN_ROOM.furniture`, as `cabinHit` tests a box; `game.tableOnScreen()`). `postWords(requests, save)` in
  `src/town/post.ts` is pure: `{ title: 'Post', letters: [{ id, from, heading, body, reply }] }`, open letters first
  in `REQUESTS` order, answered ones after with their reply under the letter; the heading "From Ida Penny" /
  "Answered: from Flo Keel". The page stops the clock as every page does (`pagesOpen`), closes by Close, Escape and
  the backdrop; `game.openPost(open)` is the API.
- **The invariant:** every id in `save.requests` is known, once, and its request is met; and every request met is
  in it (so a load that meets one marks it). `scripts/leaks.ts` holds `requests` to `REQUESTS.length`.
- **The fuzzer** starts a share of seeds with some requests answered from a stream of its own, and opens nothing
  (pages are the smoke's); the determinism hash takes the save in already.

## Where it stands now (read)

- The journal is the model page: `journalWords` pure, `openJournal` in `main.ts`, the layout spec's modal fit rule.
- The toast is one line by game time, shown at the pond only, newest first, the gift waiting behind the cure.
- The save is 194 bytes against a 2,000 ceiling; three ids add about 40.
- `pondClean` is per lake live; the ducks' predicate reads the save's entry so it holds at a load too.

## Acceptance criteria

1. Each request's `met` is pure and true exactly when its condition holds over the save (crafted saves: the pond
   clean or one short; every kind caught over two lakes or one missing; a best of 3.5 and 3.49).
2. `Game.answer` adds met requests once, in order, persists, tells `answered` in play and not at a load.
3. `postWords` lists open letters first in order, then answered with replies, with the headings.
4. The page opens from the menu and from a tap on the table in the cabin, stops the clock, closes three ways, and
   fits or scrolls on every layout.
5. The save reads `requests` with its defaults and refusals; the corpus has the file.
6. The invariant catches an unknown id, a duplicate, an unmet id and an unmarked met request.

## Edge cases (from the checklist)

- **save:** an old save without `requests` opens with all open; one that already meets a request is marked at the
  load silently; Start again clears them with the rest.
- **the lakes:** the ducks' letter is the Duck Pond's whatever lake the player is at; the rainbow counts every
  lake's journal; the toast at the Reservoir names the request all the same.
- **the day:** the page stops the clock; the toast is game time, so it waits through a page.
- **the cabin:** the table tap opens the post in the cabin view only; a tap on the map still opens the lakes.
- **the phone:** the layout spec's `post` moment at eight screens; the gestures ignore the page as the others.
- **the fish, the line, the cure:** a request is checked at the stow and the haul only, the moments the save moves.
- **the mode, the rung, the switches, the weather, the real clock, the festivals:** not reachable.

## Decisions (the user's)

1. **The town's name, the people's names and the voice,** as proposed above, or changed.
2. **The rival's weight,** 3.5 kg (recommended), or another figure.

## Decisions (mine, said so they can be changed)

- **All three letters are on the table from day 1,** since there is no earlier moment for the post; later slices
  may gate a letter on a day or an earlier reply.
- **A reply shows under the letter on the page** rather than as a second letter, so the page stays short.
- **The toast says the name,** not the words; the words are on the page.

## Performance risk

- **Frame:** none (the page is DOM, built on open). **Boot:** nothing. **Download:** the letters and the page,
  about 2.5 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/requests.test.ts` (1, 3), `test/game.test.ts` or `test/town.test.ts` (2), `test/saves.test.ts`
  (5), `test/invariants.test.ts` (6), `test/pondview.test.ts` (the toast), `test/pick.test.ts` (`tableHit`).
- **End to end, `smoke/progress.spec.ts` "the post":** the page from the menu lists three open letters and holds
  the clock; a save one cure short of clean, then `fishTo('landed')` and `stow()`, shows the toast and the page
  lists the ducks' reply; a tap on the table in the cabin (`tableOnScreen`) opens it; a load with a journal meeting
  the rainbow has it answered with no toast.
- **Fuzzer:** the start's answered requests; the invariant through every action.
- **Pictures:** `desk-post`, `phone-post`, `desk-post-answered` (the ducks and the rival answered).
- **Perf:** the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/post.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/post.md`; `DESIGN.md` stage 7 notes the slice; the roadmap. Check: Prettier.
- [x] 1. **The town and the requests:** `town.ts`, `requests.ts`, the save field and its file, `Game.answer`, the
      event, the invariant, the leaks ceiling, the fuzzer's start. Check: `test/requests`, `test/saves`,
      `test/invariants`, `test/game`.
- [x] 2. **The page and the toast:** `postWords`, `#post`, the menu item, the table tap, `game.openPost`,
      `tableOnScreen`, the layout spec's moment. Check: `test/post`, `test/pondview`, `test/pick`, the layout's
      post moments.
- [x] 3. **The pictures and the stage:** the smoke stage, the three pictures. Check: `npm run look`,
      `smoke/progress.spec.ts`.
- [x] 4. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (a predicate inverted; the
      answer told at a load; the page's order reversed), the report. Commit.

## Part 4's notes (the pass)

- **A save that claims a request it does not earn** is read as not written: `readRequests` runs after the lakes
  are read and asks each request's own test, as a journal counting more caught than cured is dropped. The builder
  had left it to the invariant to name; the house reads a lying save as none.
- **A load marks silently and writes nothing,** since loading alone must never write; the next write carries it.
- **The toast's order** is the cure (or the clean line at the twelfth), then Answered!, then the gift.
- **The open-menu picture** was taken again, meant: the menu gained "Post" after Journal.
- **The download** grew from 208,883 to 210,821 bytes gzipped, the letters, the page and the picker; that figure
  was written into the perf baseline by hand. Boot and frame hold.
- **The mutations:** the rival's test inverted (two fail), the load told as play (five fail), the page's order
  reversed (two fail).
- **The fuzzer** starts a share of seeds with answered requests from a stream of its own and plays no page.
