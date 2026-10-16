# The bite seen, and a taller bar

## Context

Played by the user, the bite was too hard to see: the lake starts sick and murky, the bobber is a few pixels across,
its twitch and dip move it a pixel or two, and the strike's 0.9 s window was told only by a line of text, so a strike
seemed to do nothing. The fight's bar was small, and its fish an oval. From a playable mock the user chose (16 Oct
2026): the bar 280 px tall, a side-on fish, and bite cue C: a ring on the water at each nibble and a bigger one at the
bite, the Strike button pulsing while the window is open, a mark over the bobber, and the bobber shaking.

## What

- **The bar** is 280 px tall (from 180), on a desk and a phone; the zone keeps its share of it.
- **The fish on the bar** is a side-on glowing fish, nose to the right, tail forked, with an eye: an inline SVG, its
  colour `PALETTE.glow` as before.
- **A nibble** rings the water at the bobber, small, and throws a few droplets; **the bite** rings it bigger. They are
  the water's own ripples, through the splash pool, but do not scare the fish as a pebble does.
- **The bobber shakes** sideways while the window is open, by the game's clock, on top of its dip.
- **A mark**, a "!" in the button's amber, stands over the bobber while the window is open.
- **The Strike button pulses** amber while the window is open, by the game's clock.
- **The words** say what is happening and what a strike did: "waiting for a fish…" while the lure sinks,
  "nibble… wait for the dip", "BITE! strike now", then for two game seconds after it, "too soon, it swam off" (struck
  at a nibble), "too late, it let go" (the window shut, or the fish let go some other way), or "nothing biting yet"
  (struck with no fish there, which twitches the lure). These words are mine where the mock had none (it said "too
  soon" for any early strike; with no fish there that would be false).

The strike's window stays 0.9 s, as in the mock.

## Acceptance criteria

1. A nibble adds a splash at the bobber of `FISHING.nibbleRing`, and the bite one of `FISHING.biteRing`, each told as
   `splashed`; the fish goes on to bite and be hooked as before.
2. `GameEvents.struck` tells each strike's result: `twitch`, `spooked`, `hooked`.
3. The bobber's x moves while biting and not while nibbling or sinking, by the game's time, the same each run.
4. On the page, while biting: the mark is shown within a few pixels above the bobber's place on the screen, the Strike
   button pulses (its `--pulse` changes with game time), and the words say "BITE! strike now"; otherwise the mark is
   hidden and the button still.
5. The words after a strike too soon, after a window let shut, and after a strike with no fish, as above, for two game
   seconds.
6. The bar is 280 px tall and its fish is the side-on SVG.

## Parts

- [x] 1. Game: the bite's rings and `struck`; unit tests in `test/bite.test.ts`, seen failing first.
- [x] 2. `castdraw.ts`: the bobber's shake; a unit test in `test/castdraw.test.ts`.
- [x] 3. The page: the bar's height and fish, the mark, the pulse, the words; `check:quick` green.
- [x] 4. Smoke: the bite seen (criteria 4 and 5) in `smoke/progress.spec.ts`; the bar's height and fish; a picture of
      the bite with its overlays at a desk's width; the fight pictures written again and looked at.
- [x] 5. The pass: `npm run check`, `fuzz --seeds 1-24`, the new tests mutation-checked, moved gates through
      `/gate-moved`.

The pass (16 Oct 2026): `npm run check` green, 467 unit tests and 50 smoke; `fuzz --seeds 1-24` clean; eleven mutations
of the new rules each caught. The download rose from 119,598 to 120,109 bytes, meant, and is written. The frame read
about 4.0 ms on a machine at a load of 3 to 4, and the parent timed in turn read 4.15 to 4.31 against the change's 3.87
to 4.29, so the frame baseline (3.54, written quiet) is kept. The rings were looked at half a second after a nibble
and after the bite; `cast-sinking`, `fishing-bite`, `fishing-fight-dusk`, `fishing-landed`, `desk-fight` and
`phone-fight` were written again, and `desk-bite` is new, each looked at.
