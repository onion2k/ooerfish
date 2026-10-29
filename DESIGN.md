# Nuclear Fishin': the design

What the game is to be, agreed in conversation on 9 October 2026, before any of it was built. It was drafted
in ooergolf and moved here on 10 October 2026. The game is to be made from ooergolf's factory: the skills in
`.claude/skills`, the gates, the invariants and the fuzzer, and a `CLAUDE.md` of its own, written when the first
code is.

Where a feature finds the design wrong, the design is changed in the same commit, and says why.

## The game

A calm, cosy fishing game in 3D, on a phone or a desktop, in a light and whimsical look. The Sunny Atom Power
Co.'s plant up the hill sprang a leak, its owners left town in a hurry, and the fish of the lakes below have
eaten the waste and glow. The player has come home to their grandparent's lakeside cabin, with its rowing
boat, and cleans the lakes up the only way they know: by fishing. Every glowing fish landed is cured and
becomes a friend, and a lake that is cleaned is seen to heal.

It is never tense. Nothing is lost for good, nothing fails, and no meter runs out but the day.

## The tone

The 1950s atomic age as a children's picture book: a friendly town, a smiling atom for a mascot, soft colours,
round shapes, and the glow as something pretty rather than something frightening. The look is the toon daylight
ooergolf has (`LOOK.md` there), lighter and more whimsical: pastel water, soft edges, and banks that wear low-poly trees and a kit's plants and stones in the game's palette.

## The loop

1. **Morning at the cabin.** The wall calendar, the radio's forecast and gossip, and the mail.
2. **Out to a lake,** from the shore or in the boat.
3. **Fish.** Find, cast, sink, bite, reel, land.
4. **Cure.** The catch goes in the bucket and comes out a normal, happy fish, let go into the pond at once. The
   lake's glow goes down.
5. **The day ends** at midnight with a yawn and a fade, or earlier by choice, in bed at the cabin.

## The fishing

One way of fishing, the same all year. The seasons change what is round the player and which fish are about,
never how a fish is caught.

- **Find.** Fish show by their glow under the water, and by what the surface does: bubbles, a swirl, a lily
  pad twitching. A Geiger counter that purrs rather than clicks is an optional gadget.
- **Cast.** Drag back, see where the lure will land, let go: ooergolf's strike, with its preview of the
  flight and the wind's bend. On a phone it is one finger. The camera is the player's to move, by a drag, and a
  button (or the C key) switches between looking round and casting.
- **Sink.** The lure sinks while the player counts it down; fish keep to depths of their own. A twitch draws
  one in.
- **Bite.** The bobber dips, and the player strikes inside a timing window, which is generous.
- **Reel.** A line's tension: reeling raises it, giving line lowers it, and a fish pulls and rests. A hotter
  fish pulls more often. A line drawn too tight does not snap and lose anything: the fish slips off with a
  wiggle and can be found again.
- **Land.** The fish comes up, is shown off, and goes in the bucket, where it is cured.
- **Lazy fishing.** The rod propped on the jetty rail, the bobber left to sit, and a bell when something
  bites, while the player reads the journal or watches the sky.
- **Junk.** Drums of waste, old lures, Sunny Atom merchandise and message bottles come up too. A drum is
  heavy, does not fight, and cleans a lot.

The player's own glow is no meter: after a big catch their hands glow a little and fade back after a cup of
tea, which is a look and nothing more.

## The lakes

A run of lakes, each its own course, opened in turn. The smallest first:

- **The Duck Pond:** the tutorial, from the shore. The ducklings follow the boat once it is clean.
- **The Reservoir**
- **The Cooling Pond**
- **The Marsh**
- **The Flooded Town:** rooftops to snag on, and the old high street under the water.
- **Reactor Lake:** the deepest, and the last.

Each lake has a **contamination** that only goes down. As it falls the water turns from a sick green to clear
blue, grass comes back on the banks, birds and frogs return and the sky clears; a lake fully cleaned gets a
postcard for the cabin wall, and in winter a lace of frost at its very edge (scenery only: the lure always
lands on open water).

**The shore and the boat.** From the shore a player reaches only so far, and the footing is the tutorial's.
The boat goes from spot to spot and anchors; wind and current make it drift, carrying the lure and moving the
line. Reeds, rocks and rooftops snag a lure, and fish hide behind them.

**Restoring.** Reeds, lilies and saplings bought with what the player earns, planted on the shore, each
speeding the cleaning a little, and seen filling the shore in.

## The calendar

- **The year** is four seasons of fourteen days, fifty-six days in all, and repeats. The lakes stay as they
  were left. A later year brings new requests and a few rare fish and never a deadline.
- **A day** is dawn, day, dusk and night, twelve to fifteen minutes of play. The fish glow brightest at
  night, so dusk is the magic hour. **Time passes only while the player is out**: menus, the journal and the
  cabin stop it.
- **The day ends gently.** At midnight the player yawns, the screen fades, and they wake at the cabin. No
  penalty, nothing lost. From the cabin they may go to bed early, or sleep through to the next weather or a
  marked day, so waiting for the full moon is never a chore.
- **The moon** goes round in eight days, so each season has a full and a new moon. At a full moon the Moon
  Fish may be about on a cleaned lake; at a new moon the night is darkest and the glow reads best.
- **The weather**, from the radio's forecast: sunny; rain, which brings fish up; fog, which hides a catch's
  kind until it is landed; a sun-shower, with its rainbow; and wind, which bends a cast.
- **Birthdays.** Each townsperson's is on the calendar; a gift earns a letter, and sometimes a lure.

| Season | The water and the weather                         | Its own                                      |
| ------ | ------------------------------------------------- | -------------------------------------------- |
| Spring | Blossom drifting on the water, showers            | Bright fry, Reed Planting Day                |
| Summer | Long days, dragonflies, still warm evenings       | Firefly Night, the Lake Festival             |
| Autumn | Falling leaves, mist at dawn                      | The Lantern Walk, the Harvest Pie Contest    |
| Winter | Snow on the banks, mist rising off the warm water | Winter fish, Snowy Star Night, the Glow-Down |

**No lake ever freezes and there is no ice fishing**: the glow keeps the water a little warm, which is the
story's reason. Winter is snow on the banks, the cabin roof and the boat's cover, frost on the reeds, mist on
cold mornings, and the glow brighter against the white.

**Nothing is missed for good.** A festival and a season's fish come round again next year. A request has a
soft "by the festival" and never fails; it waits until next time.

## The real clock

The game's own calendar decides everything: the weather, the moon, the seasons, the festivals and the fish.
The real date only **adds moments when the two agree**, and never locks anything: no journal entry, request,
collectable or step of the story needs it, since a player in the tropics, the other hemisphere, or who only
plays in summer would otherwise be shut out.

- **The game's season is the real one:** in winter, snow falling during the game's snowy days, a cocoa stall
  on the jetty, a townsperson's snowman by the cabin and frost on the window in the morning; in spring, thicker
  blossom and ducklings on the Duck Pond; in summer, more fireflies and an ice-cream bicycle at the jetty; in
  autumn, heavier leaf fall and conkers on the cabin step.
- **A real date, whatever the game's season:** Halloween, a pumpkin lantern on the boat and fish that glow
  orange that night; New Year's Eve, fireworks over the lake at the game's midnight; the first real snow of the
  year, a letter from the old fisherman.
- **Where the player's lake is:** asked once on the first run, "Where's your lake?" (north, south, tropical,
  or ignore the real calendar), guessed from the time zone and changeable at any time.

## The town and its requests

The story is told through the townsfolk's letters and the pages of a logbook, not through cutscenes.

- **The postmistress** wants a photograph of the eel that lights her window at night.
- **The retired plant engineer,** embarrassed, asks for the pages of the plant's lost logbook, fished up one
  by one. Together they tell what went wrong.
- **The baker** pays in pies for a fish that glows pink, which come out only at dawn.
- **The children's club** wants a fish of every colour for a rainbow at the school.
- **The mayor** wants the lanterns lit for the Lake Festival, with bottled glow.
- **The duck family** on the smallest pond, which is the tutorial.
- **The old fisherman's rival** sets friendly contests: the biggest fish, the fewest casts, a fish in the
  rain.

## The cabin

- **No aquarium and no curing machine.** Both were dropped on 19 Oct 2026: a fish is cured in the bucket and goes
  straight back into its lake, so there is nothing for a machine to do or a tank to hold.
- **Bottled glow.** What the cure draws off is harmless lamp light: the cabin's lamps, lanterns along the jetty,
  the festival's lights.
- **The shelves** hold the junk treasures; **the wall** the postcards and the calendar.
- **The boat** is painted and dressed: flags, a little lamp, a cat in the bow.
- **The cat** sometimes catches a fish while the player idles, and it is always something odd.

## Collectables

- **The fish journal:** every kind, drawn, with its weight, where and when it was caught, a silly fact, and
  its glowing and cured forms.
- **Junk treasures:** Sunny Atom merchandise (a mascot plush, a lunchbox, a "Safety First!" badge), message
  bottles, old lures, and a rubber duck from every lake.
- **Lures,** found and painted (a tiny atom, a carrot, a moon): mostly a look, with a gentle liking in some
  fish.
- **Photographs** from the photo mode, which fill the journal and answer requests.
- **Postcards,** one for each lake cleaned.

## The fish

Kinds of their own, never another game's: glowing perch; a two-headed trout, with two bites and two strike
windows; an eel that lights the water round it; a pike; an anglerfish whose lure is a glowing pellet; the
pink dawn fish; the season's own. Each lake has a **big one**, met as a gentle puzzle and not a fight of
endurance: The Core, a catfish that swallowed a fuel rod, is Reactor Lake's.

## Hidden things

- **The Moon Fish,** silver and naturally magical, on a cleaned lake at the full moon.
- **A star,** hooked by casting into the moon's reflection at midnight; it twinkles as it is let go.
- **Sunny the Atom,** the giant inflatable mascot from the plant's opening day, at the bottom of the deepest
  lake. Hooked, it floats up grinning, and becomes the Glow-Down's centrepiece.
- **The first fish cured** follows the boat on its own lake.
- **The logbook's last page** says the leak began with someone fishing in the cooling pond.
- **The sun-shower's rainbow:** a fish caught under it comes up twice as colourful.

## The shop

Three aisles, as ooergolf's: **rods and reels**, **lines and lures**, and **the boat and the cabin**. Nothing in
it is needed to finish the game; it makes fishing easier or lovelier.

## The tech

artshape-render and artshape-physics, as ooergolf uses them, and the factory's rules from ooergolf's
`CLAUDE.md`: seeded chance handed in, nothing made each frame, nothing kept for ever, invariants, the fuzzer,
determinism, leaks and perf.

- **The water** is the renderer's clear water, seen into (`FLOW_CLEAR`); its colours, its clarity and its
  murk moving from sick green to blue are the cleaning seen. It is the game's only water: the lake is seen into
  as it is cleaned. **The glow under the water** is the fish themselves, glowing meshes the water shows, dimmed
  and tinted by the depth; a glow drawn on the surface was tried first and is gone.
- **The day** is the sky gradient and the lights, by game time; **spray, blossom, leaves, snow and fireflies**
  the renderer's particles, the ones blown by a wash of air that ooergolf never used; **the banks** the GPU
  grass in the wind (built: `src/grass.ts`), the low-poly scenery (built, with a woodland round the lake) and the backdrop.
- **The lure, the bobber and the drums** are bodies; floating and sinking are added in the game's step, as
  golf's wind is, unless the physics is given buoyancy. **Currents** are belts, as ooergolf's streams.
  **Snags** are static bodies and boxes. **The cast** is golf's flight, and its preview.
- **The line** is a rope of sixteen to thirty-two points held apart, worked in the game so it is deterministic
  and tested, drawn as a strip from a pool. A rope in the physics is a package change, only if this one does not
  feel right.
- **The fish** steer in the game (wander, keep a depth, come to the lure, flee, run when hooked), by the seeded
  chance; the physics only where one touches something. **The boat rocks** by ooergolf's sway.
- **The calendar** is the save's seed and the day's number: the same save has the same forecast every time.
  **The real date is handed in** as chance is: `main.ts` reads it once at the start of a game day and passes
  in whether the day matches the real season and whether it is a marked date, which the save keeps for the day.
  Nothing else in `src/` calls `Date`. Tests, the fuzzer and the pictures pass a fixed date or none (`?date=` on
  the page).
- **Sound** is new: the reel's ratchet, splashes, the purring counter, the radio, the bell. ooergolf has none,
  so it is new code, new assets and a line in the download budget.

### The rules that must always hold

A first list for `invariants.ts`: a fish is in the water; the line out is never more than the spool holds;
the tension is a number of nought or more; the day is a whole number and never goes back; the time of day is
from nought to one; a lake's contamination never rises; and **the real
clock changes nothing but its extras**, held by a test that the same seed plays the same fish, weather and
catches with it on and off, by a hash.

### What the fuzzer does

Casts any way at any power, reels and gives line at random, leaves the rod propped, moves and anchors the boat,
goes to bed early, and **sleeps to a marked day**, so that every season, phase of the moon and festival is
played, and not only the first afternoon.

### The save

The day's number, what has been caught and cured, the requests open, the shore
planted, each lake's contamination, the shelves, the boat's paint, where the player's lake is, and the
day's real-clock fact. Each field with a default and a save in the new shape, as ooergolf's rule has it.

## The order of the work

Each stage is a feature, built and verified before the next, every gate green at each:

1. **The shore and a lake:** the Duck Pond, a cast with its preview, the lure sinking, the bobber.
2. **A fish:** its steering, the bite, the strike, the line's tension, landing it.
3. **The cure,** and the lake's contamination with its water changing colour: the heart of
   the cosy loop.
   _A first slice is in (16 Oct 2026): each fish put in the bucket is cured, lowering the Duck Pond's
   contamination by a twelfth (an estimate), kept in the save as a count, with the glow gauge. The curing machine
   was to follow, in the cabin; it was scrapped on 19 Oct 2026, the bucket being the cure, so the stage is done._
4. **The journal and the junk treasures.**
   _A first slice is in (19 Oct 2026): three kinds of fish, each at a depth of its own (sunny bream in the
   shallows, glowing perch in the middle, pike near the bed, 4/5/3 of the pond's twelve), two drums of waste on
   the pond's bed that are snagged by a lure lying beside them, hauled with a slow steady reel and clean the pond
   two fish's worth each, and a journal behind the menu that stops the clock. The pond holds what it takes to
   clean it, with drums: twelve fish and two drums at two fish each, sixteen cleans. The shelves,
   the other junk and the journal's drawings are not._
   _A second slice is in (19 Oct 2026, `docs/junk.md`): six junk treasures lie on the Duck Pond's bed (an old lure, a
   Sunny Atom plush, a Sunny Atom lunchbox, a "Safety First!" badge, a message bottle and the pond's rubber duck), snagged
   by a lure left lying near them like a drum, reeled in lighter and quicker, and kept by a tap for the cabin's two
   shelves. None cleans the pond. The bottle holds a short note, kept in the journal, whose words are a placeholder. A
   hauled drum stands on the bank by the cabin. The other lakes' sets, their ducks and the found-and-painted lures are
   not._
   _A third slice is in (28 Oct 2026, `docs/kinds.md`): three kinds of the design's own in the Reservoir,
   the pink dawn fish that comes out only at dawn, the lamp eel that lights the water round it at night, and the
   two-headed trout with two bites and two strike windows; a silly fact a kind in the journal; and the baker's letter
   asking for a pink one. The pond keeps its three kinds by the user's choice._
5. **The calendar:** the day, the cabin morning, the end of a day, sleeping through.
   _Two slices are in: the day's clock runs from dawn (720 s a day, an estimate) and the light steps through
   dawn, day, dusk and night; and the day ends (19 Oct 2026): at midnight, once no fish is on the line, the player
   yawns and the screen fades, and they wake at dawn in the cabin's room on the next day, which the save keeps,
   with "Go to bed" in the menu for an early night. A third is being built (19 Oct 2026, `docs/time.md`): the time
   of day and the player's place are saved, so a load opens where they were; the ⋯ menu and all it opens stop the
   clock as the journal does; and a wall calendar in the cabin, the year's fifty-six squares with the days gone
   darkened and today marked. Sleeping through, the radio and the mail are not, and wait on the weather and the town._
   _Sleeping through came with the moon (stage 6). The radio is being built (28 Oct 2026, `docs/radio.md`): the
   cabin's morning is a broadcast under the line, Sunny Atom Radio's forecast (the weather, the moon tonight, the
   season's first day) and one line of gossip from what the save says has happened, in the townsfolk's roles since
   their names are not decided; no sound, and no radio in the room, by the user's choice. The mail waits on the town._
6. **The seasons, the moon and the weather.**
   _A first slice is being built (20 Oct 2026, `docs/seasons.md`): the day's season, summer first so the lake as
   drawn today is summer's, then autumn, winter and spring, each seen as the banks' colours, the sky and the water's
   finish, the wind and waves, leaves, snow or blossom falling on the wind, and mist at autumn dawns and on winter
   mornings and nights. The moon, the weather, the festivals and sleeping through are not._
   _A second slice is being built (21 Oct 2026, `docs/moon.md`): the moon's eight-day round from the day, day 1 a full
   moon, the night darker at the new moon with the glow reading best, a disc with its phase in the night sky, the full
   and new moons marked on the calendar, and "Sleep through…" to the next marked night. The weather and the festivals
   are not._
   _A third slice is in (28 Oct 2026, `docs/weather.md`): five weathers from the day, pure as the moon is,
   with the odds by season and day 1 sunny; rain's drops and rings that bring the fish up; fog over the lake that
   hides the glow a catch's kind is told by; a sun-shower's rainbow; a wind that bends the cast's flight and its
   preview; the weather's nights on the sleep page and a sentence in the morning line. The festivals are not. The
   rest of the order of work is cut into slices in `docs/roadmap.md`._
   _A fourth slice is in (28 Oct 2026, `docs/winter.md`): winter's dressing finished: snow lying on the
   boulders and the cliff's lumps, the beach, the pebbles and the clumps frosted, a lace of frost at a clean lake's
   edge, and the glow brighter against the white. The boat's cover waits on the boat; the festivals are stage 12's._
7. **The town:** the letters, the requests and the logbook's pages.
   _A first slice is in (28 Oct 2026, `docs/post.md`): the town is Brightwater and its people are named
   (Ida Penny the postmistress, Wendell Fisk the engineer, Marigold Bunn the baker, Pip and the Glow-Worms, Mayor
   Hubert Quill, Old Ned, Flo Keel his rival, and the Mallards), the post is a page from the menu and a tap on the
   cabin's table, and three letters ask for what the fish already serve: the Duck Pond cleaned, a fish of every
   kind, and one over three and a half kilos; a request met is answered by a reply and never fails. The logbook,
   the other letters and the contests are later slices._
   _A second slice is in (29 Oct 2026, `docs/logbook.md`): the cooling pond's logbook, six pages on the
   beds of the pond and the Reservoir, each fished up as a junk treasure is and read in order in the journal, and
   Wendell Fisk's letter asking for them, answered at the sixth. The last page says what stage 14 promised._
   _A third slice is in (29 Oct 2026, `docs/photo.md`): the camera, a page that frames the lake and keeps a
   photograph as figures (the camera, the time, the weather, the kinds in frame), an album of twelve in the journal, a
   photograph looked at drawn again with the grain held, and the postmistress's letter for the lit eel._
   _A fourth slice is in (29 Oct 2026, `docs/contests.md`): Flo Keel's two contests, three fish in the rain
   and three fish on three casts, counted by a tally the save keeps, and the post's open letters say how far along
   each is._
8. **The boat:** moving, anchoring, drifting, currents and snags.
   _Being built in slices (29 Oct 2026, `docs/boat.md`): the line is a rope of twenty-four points worked in the game
   (the user's choice over a tension number alone), and the physics' floor is the water's surface, since it refuses the
   bed as terrain; the bobber is its first body, the boat the next. The boat is rowed to a tap anywhere on the water,
   the camera following, through a Row mode beside Cast. A row ends anchored; weighed (a third button, aboard only)
   the boat drifts on the wind weather and a lake's currents, which carry the bobber too._
9. **The shop, the boat's dressing, the shore's planting.**
10. **Sound.**
11. **The lakes after the first,** and each one's big fish.
    _A first slice is being built (21 Oct 2026, `docs/lakes.md`): the Duck Pond becomes one lake of several, the
    Reservoir is the second (an oval with a dam, sixteen fish, three drums, no cabin), every lake is open from the
    start, and a map in the cabin is how the player travels. The big fish, the other lakes' treasures and a stream
    are not; the stream was set aside as too much change at once._
12. **The festivals and birthdays.**
13. **The real clock's extras.**
14. **The hidden things.**

## What is not decided

- Whether the game-side rope feels right on a fast reel, or the physics needs a rope.
- The fishing's figures: the cast's reach, the sink's rate, the strike's window, the tension's limits.
- How many lakes, and each one's fish.
- The townsfolk's faces, and the story's words beyond the first letters (the names are in `docs/post.md`,
  28 Oct 2026).
- The sound: where its assets come from, and what it may cost of the download.
- What a drum of waste is worth in the cleaning (two fish's, an estimate), and how many the lakes after the first hold.
- The words of the junk: each treasure's line and the bottle's note are placeholders until the story's words are decided.
- The new repo's name, and when it is made.
