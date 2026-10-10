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

**Not yet.** Only the cast is built: from the Shore view, drag back to aim
(a dotted arc shows where the lure will land), let go to cast, and the lure
splashes in and sinks under its bobber; "Reel in" brings it back. Otherwise
the page is the **lake lab**:
one pond, drawn three ways side by side (open water, lit ripple, and water
that is seen through to its bed, its rocks and weed and the fish glowing
among them), so the water, which is what a player looks at most, is chosen
by looking. Its panel switches between the
ways of drawing the water, how dirty the lake is, the time of day and where
the camera stands; a tap on the water, or the "Drop a pebble" button,
drops a pebble that splashes and sends rings across it; and every setting is
in the address, so a link brings the
same lake back: `npm run dev`, then for instance
`http://localhost:5204/?water=ripple&dirt=1&time=dusk&view=shore`.

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

The scenery on the banks is Quaternius's Stylized Nature MegaKit (CC0), via
[poly.pizza](https://poly.pizza), turned into the game's palette.

`CLAUDE.md` says how the game is changed, and `.claude/skills` carries
`/feature`, `/bug`, `/gate-moved` and `/commit`.

## Layout

    src/game.ts        the lake without the picture: its clock, its fish, the lab's levers
    src/main.ts        the page: the lab's settings into the water, the light and the camera
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/lake.ts        content: the shore, the bed, the banks, the fish, the views
    src/fish.ts        the school, swimming
    src/water/         the ways of drawing the water, one a file
    src/look.ts        the toon look and the times of day
    src/glow.ts        a fish's glow on the surface over it, for water not seen through
    src/fishdraw.ts    the fish as glowing meshes under the water
    src/cast.ts        a cast's flight, as sums; lure.ts the lure; aim.ts a drag as a cast
    src/castdraw.ts    the rod, the line, the bobber, the lure and the preview
    src/splash.ts      the splashes on the water; ripples.ts and ripplesdraw.ts their rings
    src/pick.ts        a tap on the screen, to the point on the water
    src/lab.ts         the lab's panel; settings.ts reads and writes the address
    src/scene.ts       the bed and its rocks and weed, the banks, the stones and the trees
    src/scenery.ts     loads the kit's trees, plants and stones from public/scenery
    src/progress.ts    the save, and where it is kept
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, works the panel, plays through, looks right
