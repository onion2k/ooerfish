# Nuclear Fishin'

A calm, cosy fishing game in 3D, for a phone or a desktop. The Sunny Atom
Power Co.'s plant up the hill sprang a leak and its owners left town, and the
fish of the lakes below have eaten the waste and glow. The player has come
home to their grandparent's lakeside cabin and cleans the lakes the only way
they know: by fishing. Every glowing fish landed is cured and becomes a
friend, and a lake that is cleaned is seen to heal. Nothing is ever lost, and
no meter runs out but the day.

`DESIGN.md` says what the game is to be, and the order it is built in.

## How to play

It is live at [fish.ooer.com](https://fish.ooer.com), on a phone or a desktop; every push to `main` deploys there.
Nothing is ever lost and no meter runs out but the day, so there is no wrong way to play.

**The loop.** You are at the Duck Pond at dawn, its water seen through to the bed and the glowing fish among the
weed. Press **Cast** (or the **C** key): the camera comes to the shore, and from there

- **drag back** anywhere on the screen to aim (the arc shows where the lure will land), and **let go** to cast;
- the lure sinks under its bobber; a fish comes to it only at its own depth, so the sink is the choice: bream in
  the shallows, perch in the middle, pike near the bed;
- **tap** (or **space**) the moment the bobber dips, to strike;
- **hold** (or hold space) to reel: the fish darts on the bar and the reel held pushes the zone up it, so keep the
  fish in the zone and the meter fills; let it out too long and the fish slips off, and nothing is lost;
- **tap the catch** to put it in the bucket. That cures it: it goes back into the pond gold and never bites again,
  and the pond clears a little. A lure left lying on the bed may snag a drum of waste or a junk treasure instead;
  hauled or kept the same way.

Curing brings gifts from the Sunny Atom: a stronger line, a faster reel, a longer rod, a bigger bobber, tastier
bait. The pond is clean when every fish is cured and every drum hauled.

**Looking round.** Outside cast mode a **drag** turns the camera and the **wheel** zooms; a **tap on the water** drops
a pebble. A **tap on the cabin** walks in.

**The day.** A day is twelve minutes, dawn to midnight. At midnight you yawn, the screen fades and you wake in the
cabin next morning; **Go to bed** in the ⋯ menu does the same early, and **Sleep through…** skips to the next full or
new moon. The year is four seasons of fourteen days, summer first, and the moon goes round in eight: the night is
darkest at the new moon, when the fish glow brightest.

**The cabin.** The ⋯ menu's **Go to the cabin** (or a tap on it from the shore) walks in without ending the day; time
stops inside. The calendar on the wall is the year, a square a day, with the seasons' bands and the moons marked;
the map in the frame is the lakes, a pin on where you fished last; the shelves hold what you have found. **Out to
the lake** takes you back to the same moment.

**The lakes.** All open from the start: tap the map, or **Lakes** in the ⋯ menu, and **Go**. The Duck Pond is home,
where the cabin is; the Reservoir is bigger, deeper and under a dam, with sixteen fish and three drums. Wherever you
are at midnight, you wake at home. Each lake keeps its own count of cures; the gifts are yours and come with you.

**The journal** (in the ⋯ menu) is what you have caught at this lake, the biggest of each kind, and what you found
on the bed.

**A phone as the rod.** **Pair a phone** in the ⋯ menu shows a code; scan it and the phone is the rod: flick to cast,
tilt to aim, hold the pad to reel, and the bite buzzes in your hand. The screen keeps the picture.

**Start again** in the ⋯ menu wipes the save after asking. Progress is kept in the browser, saved as you play.

For the game at your own machine: `npm run dev`, then `http://localhost:5204/`. `?seed=3&paused=1&caustics=off&paint=off`
are for the tests and for comparing, and nothing about the game is in the address. `docs/` holds the plan each
feature was built from, and `DESIGN.md` the rest.

## What is here

Made from [artshape-game-template](https://github.com/onion2k/artshape-game-template),
on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics), with the
template's gates (all but its pace gate, which comes back with the fishing):

    npm run dev            the game at http://localhost:5204
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook)
    npm run fuzz           a monkey plays it, and the rules are checked
    npm run determinism    the same seed played twice, hashed
    npm run leaks          a long game, watching what must stay bounded
    npm run bench          what a step of the lake costs, held to a baseline
    npm run perf           boot time, a frame's cost and the download, held to a budget and a baseline
    npm run smoke          the real thing in headless Chromium on the GPU
    npm run look           what it looks like, held to a picture
    npm run check          all of it

The trees are low-poly broadleaves and conifers cut by
[artshape-render](https://github.com/onion2k/artshape-render)'s generators, as
ooergolf's are. The pebbles and the plants on the banks are Quaternius's
Stylized Nature MegaKit (CC0), via [poly.pizza](https://poly.pizza), turned into
the game's palette.

`CLAUDE.md` says how the game is changed, and `.claude/skills` carries
`/feature`, `/bug`, `/gate-moved` and `/commit`.

## Layout

    src/game.ts        the lake without the picture: its clock, its fish, the cure
    src/main.ts        the page: the game's state into the water, the light and the camera
    src/mode.ts        look or cast: what a drag does, and the camera's part in switching
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/lake.ts        the rules: the clock, the fight, the gear, the kinds, the calendar, the seasons, the moon
    src/lakes/         each lake as a Lake object: the Duck Pond, the Reservoir, the registry; the lakes page
    src/calendar.ts    the day's square, its season and its moon, as pure sums; season.ts the season's dressing
    src/cabinroom.ts   the cabin's room: the furniture, the calendar, the map; moondraw.ts the moon in the sky
    src/fish.ts        the school, swimming
    src/water/         the water seen into, a file and a line in STYLES
    src/look.ts        the toon look and the times of day
    src/fishdraw.ts    the fish as glowing meshes under the water
    src/cast.ts        a cast's flight, as sums; lure.ts the lure; aim.ts a drag as a cast
    src/castdraw.ts    the rod, the line, the bobber, the lure and the preview
    src/splash.ts      the splashes on the water; ripples.ts and ripplesdraw.ts their rings
    src/pick.ts        a tap on the screen, to the point on the water
    src/pondview.ts    the glow gauge, the welcome and the cure's lines; settings.ts reads the address
    src/scene.ts       the bed and its rocks and weed, the banks, the stones and the trees
    src/trees.ts       the low-poly tree variants and their colours
    src/scenery.ts     loads the kit's plants and stones from public/scenery
    src/progress.ts    the save, and where it is kept
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, plays through, looks right
