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

**Not yet.** What is in `src/` is still the template's stub, a sled shoving
balls into a hole, until the first feature lands and replaces it. `npm run
dev` shows that stub, not the game.

## What is here

Made from [artshape-game-template](https://github.com/onion2k/artshape-game-template),
on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics), with every
gate the template carries:

    npm run dev            the game at http://localhost:5204
    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook)
    npm run fuzz           a monkey plays it, and the rules are checked
    npm run determinism    the same seed played twice, hashed
    npm run leaks          a long game, watching what must stay bounded
    npm run pace:check     how it plays, held to a baseline both ways
    npm run bench          what the physics costs a frame, held to a baseline
    npm run perf           boot time, a frame's cost and the download, held to a budget and a baseline
    npm run smoke          the real thing in headless Chromium on the GPU
    npm run look           what it looks like, held to a picture
    npm run check          all of it

`CLAUDE.md` says how the game is changed, and `.claude/skills` carries
`/feature`, `/bug`, `/gate-moved` and `/commit`.

## Layout

    src/game.ts        the game without the picture
    src/main.ts        the page: events into words, the frame drawn
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/autopilot.ts   the game played by itself, for the gates
    src/arena.ts       content (the stub's floor, hole and balls, for now)
    src/progress.ts    the save, and where it is kept
    src/physics.ts     the game's side of artshape-physics
    src/scene.ts       the arena as it is drawn
    src/sled.ts        the stub's player machine, the last of it to go
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, drives, plays through, looks right
