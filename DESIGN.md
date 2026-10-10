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
ooergolf has (`LOOK.md` there), lighter and more whimsical: pastel water, soft edges, and banks that wear a kit's trees, plants and stones in the game's palette.

## The loop

1. **Morning at the cabin.** The wall calendar, the radio's forecast and gossip, the mail, and the aquarium.
2. **Out to a lake,** from the shore or in the boat.
3. **Fish.** Find, cast, sink, bite, reel, land.
4. **Cure.** The catch goes into the cabin's bubbling machine and comes out a normal, happy fish for the
   aquarium. The lake's glow goes down.
5. **The day ends** at midnight with a yawn and a fade, or earlier by choice, in bed at the cabin.

## The fishing

One way of fishing, the same all year. The seasons change what is round the player and which fish are about,
never how a fish is caught.

- **Find.** Fish show by their glow under the water, and by what the surface does: bubbles, a swirl, a lily
  pad twitching. A Geiger counter that purrs rather than clicks is an optional gadget.
- **Cast.** Drag back, see where the lure will land, let go: ooergolf's strike, with its preview of the
  flight and the wind's bend. On a phone it is one finger.
- **Sink.** The lure sinks while the player counts it down; fish keep to depths of their own. A twitch draws
  one in.
- **Bite.** The bobber dips, and the player strikes inside a timing window, which is generous.
- **Reel.** A line's tension: reeling raises it, giving line lowers it, and a fish pulls and rests. A hotter
  fish pulls more often. A line drawn too tight does not snap and lose anything: the fish slips off with a
  wiggle and can be found again.
- **Land.** The fish comes up, is shown off, and goes in the bucket for the cabin.
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

- **The aquarium.** Every cured fish swims in it, can be named, and can be let go into its lake once the lake
  is clean.
- **Bottled glow.** What the curing machine draws off is harmless lamp light: the cabin's lamps, lanterns along
  the jetty, the festival's lights.
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
- **A star,** hooked by casting into the moon's reflection at midnight; it twinkles in the aquarium.
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

- **The water** is the renderer's open water (`PATTERN.ocean`); its `body` and `tint` moving from green to blue
  is the cleaning seen. **The glow under the water** is the first thing to try: if the water cannot show depth,
  a glow on the surface over a fish, brighter and wider the shallower it swims, may do, and otherwise the
  renderer is changed.
- **The day** is the sky gradient and the lights, by game time; **spray, blossom, leaves, snow and fireflies**
  the renderer's particles, the ones blown by a wash of air that ooergolf never used; **the banks** the GPU
  grass in the wind, the low-poly scenery and the backdrop.
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
from nought to one; a lake's contamination never rises; the aquarium holds only fish caught; and **the real
clock changes nothing but its extras**, held by a test that the same seed plays the same fish, weather and
catches with it on and off, by a hash.

### What the fuzzer does

Casts any way at any power, reels and gives line at random, leaves the rod propped, moves and anchors the boat,
goes to bed early, and **sleeps to a marked day**, so that every season, phase of the moon and festival is
played, and not only the first afternoon.

### The save

The day's number, what has been caught and cured and named, the aquarium, the requests open, the shore
planted, each lake's contamination, the shelves, the boat's paint, where the player's lake is, and the
day's real-clock fact. Each field with a default and a save in the new shape, as ooergolf's rule has it.

## The order of the work

Each stage is a feature, built and verified before the next, every gate green at each:

1. **The shore and a lake:** the Duck Pond, a cast with its preview, the lure sinking, the bobber.
2. **A fish:** its steering, the bite, the strike, the line's tension, landing it.
3. **The cure and the aquarium,** and the lake's contamination with its water changing colour: the heart of
   the cosy loop.
4. **The journal and the junk treasures.**
5. **The calendar:** the day, the cabin morning, the end of a day, sleeping through.
6. **The seasons, the moon and the weather.**
7. **The town:** the letters, the requests and the logbook's pages.
8. **The boat:** moving, anchoring, drifting, currents and snags.
9. **The shop, the boat's dressing, the shore's planting.**
10. **Sound.**
11. **The lakes after the first,** and each one's big fish.
12. **The festivals and birthdays.**
13. **The real clock's extras.**
14. **The hidden things.**

## What is not decided

- Whether the renderer's water can show a glow beneath it, or the surface stands in for depth.
- Whether the game-side rope feels right on a fast reel, or the physics needs a rope.
- The fishing's figures: the cast's reach, the sink's rate, the strike's window, the tension's limits.
- How many lakes, and each one's fish.
- The townsfolk's names and faces, and the story's words.
- The sound: where its assets come from, and what it may cost of the download.
- How big the aquarium may grow, and the ceiling `leaks` holds it to.
- The new repo's name, and when it is made.
