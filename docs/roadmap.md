# The road to the end of `DESIGN.md`

Agreed with the user on 28 October 2026. Stages 1 to 3 of the design's order of work were done, 4, 5 and 6 part
built, and stage 11 had its first slice (the Reservoir); everything from stage 7 on was unstarted. This puts the
rest in an order, cut into slices of the size the last fortnight's were (one `/feature` each, with a spec in
`docs/`, built on sonnet, every gate green, a note in `DESIGN.md`, a `/commit`, and a push to Netlify), and names
at each slice the decision the user has to make first, from the design's "What is not decided". It is a roadmap,
not a spec: each slice gets its own spec when it is started, as `docs/moon.md` and `docs/lakes.md` did. A slice
that is built ticks its line here and names its spec.

The ordering rule: **what others wait on comes first.** The weather is waited on by the radio, the rain's fish and
the fog's hidden catch, the sun-shower's rainbow and the festivals' sleep page; the town is waited on by the mail,
the festivals, the birthdays and the shop's earnings; the boat and its snags are waited on by the Flooded Town and
the Marsh. Sound is cross-cutting and comes once there is a radio to play.

## Part A: finish the calendar (stages 5 and 6)

- [x] **A1. The weather** (stage 6, slice 3; `docs/weather.md`, landed 28 Oct 2026). Five weathers from the day, pure in `calendar.ts`:
      sunny, rain, fog, sun-shower, wind. Rain is falling particles and rings on the water, and brings fish up; fog
      is the renderer's fog thick over the lake, hiding the glow a catch's kind is told by; the sun-shower is rain by
      day with a rainbow; wind bends the cast's flight and its preview. The fuzzer reaches every weather; the
      determinism hash takes it in; the sleep page lists the weather's nights.
- [x] **A2. The radio and the morning** (stage 5, slice 4; `docs/radio.md`, landed 28 Oct 2026). The cabin's morning line becomes the radio: today's
      forecast, the moon, the season, and a line of gossip from a small pool keyed by what has happened (a lake
      cleaned, a drum hauled, a treasure found). Words a pure function in `src/radio.ts` with a unit test, as
      `nightWords` is. No sound yet: the radio is text until Part D. The mail waits on Part B.
- [x] **A3. Winter's dressing** (stage 6, tidy; `docs/winter.md`, landed 28 Oct 2026). Snow on the cabin roof and the boat's cover, frost on the reeds:
      static parts shown by the season, so the stage reads done. Small.

## Part B: the town (stage 7, and the mail of stage 5)

- [x] **B1. The post and the requests** (`docs/post.md`, landed 28 Oct 2026). `Save.requests` (open, done, by id), a `Request` list in
      `src/town/requests.ts` (id, who, what is asked, the test of a catch that answers it, the letter's words), the
      mail on the cabin's table read in the morning (a page, as the journal is, stopping the clock), and a reply
      when a request is met. The first requests are those the fish already serve: the duck family (the pond
      cleaned), the rival's "biggest fish" and "fewest casts" (the journal has `best`), the children's rainbow (one
      of each kind). A request never fails: "by the festival" is a soft date.
      _Decision first:_ the townsfolk's names and the letters' voice.
- [x] **B2. More kinds of fish** (`docs/kinds.md`, landed 28 Oct 2026). The pink dawn fish (bites only at dawn, the baker's), the eel (lights the water
      round it, at night, the postmistress's), the two-headed trout (two bites and two strike windows, a `Bite`
      change). Each a line in `KINDS` and a slot in a lake's `fishKinds` per the model feature. The journal's silly
      facts come with the kinds.
- [x] **B3. The logbook's pages** (`docs/logbook.md`, landed 29 Oct 2026). Six pages across the pond and the
      Reservoir, each a treasure with a page number (not a third `BedFinds`: a page does nothing a treasure does not),
      read in order in the journal's new section; the engineer's letter is met by all six. The last page's line, the
      hidden thing of stage 14, is written in with them.
- [x] **B4. Photo mode** (`docs/photo.md`, landed 29 Oct 2026). A page that stops the clock, frames the view, and keeps a photograph: the camera, the
      time and the weather, drawn again when looked at (the renderer's `postClock` holds a still's grain), not
      pixels, so the save stays small. Answers the postmistress's request and fills the journal. Counted in
      `leaks.ts`. _Decision first:_ figures re-drawn (recommended) or an image kept.
- [ ] **B5. The rival's contests** (fewest casts, a fish in the rain): a request with a counter.

## Part C: the boat (stage 8)

The largest change left, and the first use of artshape-physics. One `docs/boat.md` with the user's choices, built
in slices, each a commit. _Decision first:_ whether the line stays a tension number (recommended, until the boat's
drift shows the line needs to bend) or becomes the design's rope of sixteen to thirty-two points.

- [ ] **C1. `src/physics.ts` and the bodies.** The lure and the bobber as bodies in a `World`, buoyancy added in
      the game's step as golf's wind is, the cast's flight unchanged. Nothing visible moves: the look pictures hold
      or `/gate-moved` says why. The bench times it.
- [ ] **C2. The boat from spot to spot.** `Game.board`, a boat at the jetty, moved between a lake's `spots`
      (content, in the `Lake`), anchored by a tap; the `boat` view from its seat; the cast's reach from the boat;
      rocking by ooergolf's sway. The pace angler and the fuzzer board at random; the invariants keep the boat on
      the water.
- [ ] **C3. Drift, wind and current.** Unanchored, the boat drifts on the wind and a lake's currents (belts, as
      ooergolf's streams, content in the `Lake`), carrying the lure and moving the line. Anchoring stops it.
- [ ] **C4. Snags.** Reeds, rocks and rooftops as static bodies and boxes in the lake's content; a lure cast onto
      one catches, freed by a give of line; fish hide behind them. The Flooded Town and the Marsh need them.
- [ ] **C5. Lazy fishing.** The rod propped on the rail or the boat's gunwale, the bobber left, a bell on the bite:
      the reel-held state with a timer and the strike's window widened.

## Part D: sound (stage 10)

- [ ] **D1. The sound.** `src/sound.ts`: a pool of buffers played on `GameEvents` (the reel's ratchet on hold, the
      splash on `splashed`, the bell on the bite, the counter purring by the nearest fish's glow, the radio's chatter
      in the cabin), fetched lazily after `ready` as pairing's libraries are, muted by a switch in the ⋯ menu and in
      every test and picture. After A2, so the radio has something to say.
      _Decision first:_ synthesised in code (recommended for the ratchet, the bell and the counter, costing no
      download) or sampled from CC0 packs, and the download budget's line for them.

## Part E: the lakes after the first (stage 11, slices 2 on)

Each lake is a `Lake` object (`src/lakes/`), so each is a slice with its own geometry, views, surface, fish, drums,
treasures and pictures. With each: its rubber duck and treasure set, a postcard for the cabin wall when cleaned,
and its **big fish** met as a gentle puzzle, not a fight, each a `KINDS` entry with a bite rule of its own. A
merged journal across lakes rides with E1. _Decision first:_ six lakes as the design says (recommended), and each
one's fish count and drums.

- [ ] **E1. The Cooling Pond** (warm, no winter mist, the logbook's start).
- [ ] **E2. The Marsh** (reeds as snags, shallow; needs C4).
- [ ] **E3. The Flooded Town** (rooftops as snags, the old high street as painted solids on the bed; needs C4).
- [ ] **E4. Reactor Lake** (the deepest, the last; The Core).

## Part F: the shop and the shore (stage 9)

_Decision first:_ the currency and its name, and whether the shop's gear is the gifts' levels (recommended) or a
parallel set.

- [ ] **F1. Earnings.** What the baker's pies and the requests pay, a count in the save.
- [ ] **F2. The shop.** Three aisles as ooergolf's, a page from the cabin: rods, reels, lines and lures (a gear level
      bought ahead of the cures, nothing needed to finish), the boat's dressing (flags, a lamp, the cat), the cabin's.
- [ ] **F3. Restoring.** Reeds, lilies and saplings planted on the shore from the shop, each a static part shown by
      the save and a small speed on the heal.
- [ ] **F4. The cat** in the bow, which catches something odd while the player idles.

## Part G: the year's marks (stage 12) and the real clock (stage 13)

- [ ] **G1. Festivals.** Eight marked days in the year (`CALENDAR.festivals`, a square on the wall calendar, a row on
      the sleep page), each a dressing of the lake for the day (lanterns on the jetty, blossom thicker, the
      Glow-Down's lights) and a request from B1.
- [ ] **G2. Birthdays.** A townsperson's day on the calendar, a gift from the shelves, a letter back.
- [ ] **G3. The real clock.** `?date=` read once by `main.ts` at the start of a game day and handed in as chance is,
      `Save.where` ("Where's your lake?" asked once, guessed from the time zone, changeable in the menu), the
      real-season extras (the cocoa stall, the snowman, the ice-cream bicycle, conkers) and the marked dates
      (Halloween's orange glow, New Year's fireworks, the first snow's letter), and the invariant the design names:
      the same seed plays the same fish, weather and catches with the clock on and off, held by the determinism hash
      run both ways.

## Part H: the hidden things (stage 14)

Each a small slice once its stage is in; several can share a commit.

- [ ] **H1.** The Moon Fish on a cleaned lake at the full moon.
- [ ] **H2.** The star, cast into the moon's reflection at midnight.
- [ ] **H3.** Sunny the Atom at Reactor Lake's bed, a bed find that floats up.
- [ ] **H4.** The first fish cured follows the boat.
- [ ] **H5.** The logbook's last page.
- [ ] **H6.** The rainbow's doubled colours under a sun-shower.

## What each slice carries

By `CLAUDE.md`'s definition of done: unit tests in `test/`; a stage in `smoke/progress.spec.ts`; an action in
`scripts/fuzzer.ts` and a rule in `src/invariants.ts`; a ceiling in `scripts/leaks.ts` for anything kept; a default
in `progress.ts` and a save in `test/saves/` for a new field; the perf figures before and after; a picture in
`smoke/look.spec.ts` at a desk's and a phone's width; `npm run check` green and `npm run fuzz -- --seeds 1-24`
clean; a note under the stage in `DESIGN.md`; a `/commit`. Content figures go in `lake.ts` or the `Lake`, words in
a pure `*Words` function, and chance is handed in. At the end of each Part, a play-test on fish.ooer.com after the
push.
