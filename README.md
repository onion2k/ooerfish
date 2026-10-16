# Nuclear Fishin'

A calm, cosy fishing game in 3D, for a phone or a desktop. The Sunny Atom
Power Co.'s plant up the hill sprang a leak and its owners left town, and the
fish of the lakes below have eaten the waste and glow. The player has come
home to their grandparent's lakeside cabin and cleans the lakes the only way
they know: by fishing. Every glowing fish landed is cured and becomes a
friend, and a lake that is cleaned is seen to heal. Nothing is ever lost, and
no meter runs out but the day.

`DESIGN.md` says what the game is to be, and the order it is built in.

## How it is played

Find a fish by its glow and what the surface does, drag back to cast and let
go, let the lure sink, strike when the bobber dips, and reel with an eye on
the line's tension. The catch goes home to the cabin's curing machine and
into the aquarium, and the lake's water turns from green to blue.

**Not yet, but it plays.** The page opens straight onto the sick Duck Pond at dawn, its water seen through
to its bed, its rocks and weed and the glowing fish among them. "Cast" (or the C key) puts the camera at the
shore, where you drag back to aim, let go to cast, tap to strike when the bobber dips and hold to reel a fish
into the zone on the bar; tap the catch to put it in the bucket, which cures it and clears the pond a twelfth,
kept in the save. The day runs round from dawn. A tap on the water drops a pebble that sends rings across it.
There is no menu, cabin or aquarium yet: `docs/game.md` is the plan this slice was built from, `DESIGN.md`
the rest. `npm run dev`, then `http://localhost:5204/`; `?seed=3&paused=1&caustics=off&paint=off` are for
tests and comparing, and nothing about the game is in the address.

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
    src/lake.ts        content: the shore, the bed, the banks, the fish, the views
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
