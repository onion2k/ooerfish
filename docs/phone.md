# The phone as the rod

## Context

The controller lab (`~/projects/ooerfish-controller-lab`) showed that a phone on the same Wi-Fi can pair with the
game through a QR code, with Trystero handling the handshake over public Nostr relays, and then send readings
directly over WebRTC. Headless figures: paired in 0.6–0.9 s, round trip 1–3 ms, no readings lost. The user then
tried it on a real phone, and it worked. This spec brings it into the game: the phone becomes the rod. It aims by
tilt, casts by a flick, strikes by a tap and reels by a hold, and shows the fight's bar so a fight can be played
without looking up. The user chose these three things:

- **Gestures:** the pad plus tilt to aim and a flick to cast.
- **The phone's screen:** a word for the next gesture, plus the fight's bar mirrored.
- **HTTPS:** a new `npm run dev:phone` script.

## What

- **Pairing.** On the lab panel, **Pair a phone** shows a QR code over the game. The phone scans it, opens the
  phone page and taps **Connect**. The code closes when the phone joins. One phone pairs with a screen at a time.
- **On the phone, with motion sensors:**
  - Hold a thumb on the pad to raise the rod. While it is held, tilting left or right swings the aim, and the
    preview is drawn on the big screen.
  - A flick while holding casts, harder for a harder flick.
  - Letting go without a flick takes the cast back.
  - A tap strikes.
  - A hold with a fish on reels, and letting go gives line.
- **Without motion sensors** (refused, absent, or the page not secure): the pad works as the screen does in cast
  mode. Drag back to aim, let go to cast.
- **The phone's screen:** one large word for what the next gesture does (Cast / Strike! / Reel / Tap the catch),
  the fight's bar with the zone, the fish and the catch meter, and a buzz on a bite where the phone can vibrate
  (Android). Small text gives the last flick's strength, to tune by.
- **The big screen:** the first gesture from the phone puts the page in cast mode at the Shore view, through
  `nextMode(mode, 'cast')`. The mouse, the keys and the Strike/Reel button all keep working beside the phone.

## Where it stands now (measured)

| Figure                                              | Now                                               | Source                     |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| Download, `dist/assets` gzipped                     | 120,109 B (117.3 kB) of the 400 kB budget         | `smoke/perf-baseline.json` |
| Trystero 0.26.0 with Nostr, gzipped                 | 29,380 B                                          | lab build                  |
| QR code library plus the lab's screen code, gzipped | 11.2 kB                                           | lab build                  |
| Pair time / round trip, two headless browsers       | 0.63–0.87 s / median 1 ms, 95th percentile 2–3 ms | lab, 3 runs                |
| Longest gap between readings at 60 a second         | 21–22 ms                                          | lab, 3 runs                |

The perf gate counts every script in `dist/assets`, and that includes lazily loaded chunks. Estimate: about
+45 kB, to about 165 kB of 400. Boot time is unchanged, since nothing loads until **Pair a phone** is pressed.
`crypto.subtle`, which the room password needs, works only on a secure page. The phone therefore needs HTTPS:
`localhost` is enough for the big screen, but the phone reaches it by its LAN address.

## Acceptance criteria

1. **Pair a phone** loads the pairing code only when pressed (no Trystero in the boot's requests), and shows a QR
   code for `https://<LAN>:<port>/phone.html#room=…&key=…`. A phone that opens it and taps Connect is paired, and
   the code closes.
2. With the phone paired and holding, a tilt moves the preview on the big screen. A flick casts at the tilted
   angle, with power rising with the flick's strength between `PHONE.flickMin` and `PHONE.flickFull`.
3. Letting go without a flick casts nothing. A flick with no thumb down casts nothing.
4. With no motion sensors, a drag back on the pad aims through the same `aimFrom`, and letting go casts.
5. A tap on the pad with the lure sinking calls the same `strike` as a tap on the screen. A hold with a fish
   hooked reels until let go.
6. The reel is held while any one of the phone, the pointer, the space key or the Reel button holds it, and
   letting go of one does not let go of another. The screen losing focus lets go of the key's hold only.
7. The phone shows the word for the game's phase. Its bar shows the same zone, width, fish position and meter as
   `game.fishing()`, to within a step of the phone's update rate. A bite asks the phone to vibrate once.
8. When the phone leaves (a closed tab, a locked screen, lost Wi-Fi), its reel is let go and any aim it began is
   dropped. The big screen says the phone left, and the phone can rejoin from the same address.
9. A second phone in the room is told the screen already has one, and is ignored.
10. A message that is malformed, from an unknown version, or of an unknown kind is refused by name and changes
    nothing.
11. `npm run dev` is unchanged. `npm run dev:phone` serves the game over HTTPS on the LAN.

## Edge cases (from the checklist)

- **save:** nothing is saved. A pairing lasts for a session, and a reload of the screen means a new code.
- **scale:** one phone; a second is refused (criterion 9). At most 60 phone messages a second plus 30 of state a
  second the other way. Nothing is kept beyond the last of each.
- **phone:** the phone page is the phone case. The pairing overlay at phone width on the screen is in the look
  pictures. The phone page draws no WebGPU, so a slow phone has nothing to step down.
- **the mode:** a gesture from the phone in look mode switches to cast at the Shore view. Picking a view while
  playing by phone is look mode, as now, and the next phone gesture casts again. A tap, a hold, a drag and a flick
  are each tested in both modes, and casting again while out reels in first, as `cast` already does.
- **the rung:** unaffected (full and lean draw the same preview). The frame is measured paired on full.
- **the lab:** each time of day and view while paired. The pebble button still works. `?phonelink=nonsense` is
  refused by name.
- **the water:** a flick cast lands where `cast` lands it, so the existing rules hold: onto the bank and at the
  shore's edge.
- **the line:** cast onto the water, onto the bank and at the edge; reeled in; cast again while out; bitten; let
  out of the zone until the meter empties; all by phone in the end-to-end test.
- **the fish:** hooked and played from the phone. The fish's own rules are unchanged.
- **the day:** pause and step through the test API with the phone paired. The phone's state follows the game's
  clock, so a paused game shows a still bar.
- **snags, the boat, the calendar, the real clock, the contamination, the cabin:** not reachable yet.

## Performance risk

- **Download:** about +45 kB gzipped (Trystero, the QR library, the pairing and phone code), within budget. The
  perf baseline is written again through `/gate-moved`, and the commit says by how much.
- **Boot:** none expected, since the pairing code is a lazy import. The perf gate holds it.
- **Frame:** unpaired, nothing runs. Paired, a parse and a dispatch per message and a packed state at 30 a
  second. `measureFrame` is run paired in the phone end-to-end test and compared with unpaired at the standard
  scene, held under 8 ms.
- **Lag:** Trystero's channel is reliable and ordered, so on a Wi-Fi hiccup a lost packet holds back the ones
  behind it. The lab's gap was 21 ms on loopback, and the real phone's figure is not measured. If the phone shows
  stutter, the fix is a lossy channel opened through Trystero's handshake hook (a follow-up, not in this spec).

## Design

- **`src/gesture.ts` (new, pure):** the gesture rules for both the screen and the phone, as a state machine from
  `down / move / up / tilt / flick / gone` events, each tagged with its source (`screen`, `phone`, `key`,
  `button`), to calls on a `GestureTarget` (`aim`, `cast`, `strike`, `reel(on)`). It holds the set of hold sources
  so the reel is held while any one holds it (criterion 6), and it uses `aimFrom` (`src/aim.ts`) for drags. The
  pointer code in `main.ts` (lines 292–350) moves onto it, so a behaviour has one implementation. **That move is
  a refactor commit of its own, before the feature.**
- **`src/flick.ts` (new, pure):** turns a run of acceleration samples into a flick and its strength: the peak of
  the acceleration with gravity removed, over `PHONE.flickMin`, then a rest of `PHONE.flickRest`. It runs on the
  phone, where the samples come at full rate.
- **`src/phone/protocol.ts` (new, pure):** the versioned messages each way. Phone to screen: `hello{v, motion}`,
  `down`, `move{x,y}`, `up`, `tilt{g}`, `flick{peak}`. Screen to phone: `state{word, phase, zone, width, fishAt,
meter, tension}` and `buzz`. It packs and parses them, and refuses unknown or malformed messages by name.
- **`src/phone/link.ts` (new):** a `Link` interface (`send`, `onMessage`, `onJoin`, `onLeave`, `leave`) with two
  makers: `trysteroLink(room, key)` (lazy, Nostr) and `localLink(room)` over `BroadcastChannel`, which is for the
  smoke test only and is chosen by `?phonelink=local`. The end-to-end test never depends on public relays.
- **`src/phone/pairing.ts` (new, lazy):** the room and key from `crypto.getRandomValues` (never the game's chance,
  which is for logic), the QR overlay, and the peer kept to one. The test API can fix the pairing so the look
  picture holds still.
- **`phone.html` + `src/phone/page.ts` (new entry):** the pad, the motion permission behind Connect, tilt
  readings at 30 a second, flicks from `flick.ts`, the word, the bar, the buzz.
- **`src/fightview.ts` (refactor):** split into `fightPicture(game)`, a pure snapshot, and a draw of a snapshot.
  The screen draws from the game's snapshot, and the phone from the snapshot that arrives in `state`. The bar
  then has one way of being drawn.
- **`src/lake.ts`:** `PHONE` content: the state rate (30 a second), the tilt range (±35° of the phone's gamma
  maps to ±60° off the heading), and `flickMin` 15, `flickFull` 35 and `flickRest` 400 ms. **All of these are
  first guesses, tuned on the real phone.**
- **`src/lab.ts`:** a **Pair a phone** button in "On the water", passed through `Actions`.
- **`src/main.ts`:** it wires the link into `gesture.ts` and `nextMode`, and sends state to the phone each frame
  at the rate it has.
- **`src/debug.ts`:** `game.phone()` reads `{paired, motion, lastKind, refused}`, and `game.pair()` opens the
  overlay, resolving once it is drawn.
- **`vite.config.ts` and `package.json`:** `phone.html` as a second entry. `dev:phone` sets `PHONE_DEV=1`, which
  turns on `@vitejs/plugin-basic-ssl` and `host: true`. Dependencies: `trystero@0.26.0` and `qrcode@1.5.4`; dev
  dependency `@vitejs/plugin-basic-ssl@2.3.0`.
- **`scripts/pair.ts` (new, not in `check`):** two headless browsers pair over the real Nostr relays and print the
  figures, as the lab did. It depends on the network, so it is a tool and not a gate.
- **`CLAUDE.md`:** a paragraph on the phone (the layout, `dev:phone`, `pair`, the local link) and a "phone link"
  line in the edge-case checklist.

Out of scope: a lossy channel; tuning the flick numbers beyond the first try; a hosted (non-dev) HTTPS build;
phone pairing that lasts over a reload; more than one phone; a flick as a strike.

## Test plan

- **Unit (`test/`):**
  - `gesture.test.ts`: every row of criteria 2–6 and 8, the screen's existing tap, drag and hold rules held as
    they are now (written before the refactor and seen green on the old code).
  - `flick.test.ts`: recorded-shape sample runs (a held phone, a wave, a flick, two flicks inside the rest).
  - `protocol.test.ts`: a round trip of each kind; refusals by name for version, kind, NaN and an extra field.
  - `fightview.test.ts`: `fightPicture` matches `game.fishing()`.
- **End-to-end (`smoke/phone.spec.ts`):** the game with `?phonelink=local`, and the phone page as a second page
  in the same context. It pairs; drags on the phone's pad and sees the preview and the cast land; dispatches
  `DeviceOrientationEvent` and `DeviceMotionEvent` for tilt and flick and sees the cast's angle and power; uses
  `fishTo('bite')`, sees `Strike!` and a vibrate call (stubbed), and taps to hook; holds and sees
  `fishing().reeling`; compares the phone's bar with `fishing()`; closes the phone and sees the reel let go. It
  also clicks **Pair a phone** as a user does, and checks Trystero is absent from the boot's requests.
- **Fuzzer:** a new action, "a gesture from the phone", with random down, move, up, tilt and flick through
  `gesture.ts`, plus now and then a malformed message through `protocol.ts`. There is no new game invariant,
  because the phone only calls the game's existing methods, which the invariants already hold. The reel's
  any-source rule is held by the gesture unit tests.
- **Leaks:** the link keeps one peer and the last message of each kind. A ceiling of one peer is added to
  `scripts/leaks.ts` through the gesture state.
- **Pictures (`smoke/look.spec.ts`):** the pairing overlay at desk and phone width with a fixed pairing; the phone
  page at 390×844 in Cast, Strike! and Reel with the bar part filled.
- **Perf:** the gate in the pass against the parent commit, plus `measureFrame` paired and unpaired.
- **Mutation:** put back a reel let go by the screen's blur, a flick cast without a hold, an accepted unknown
  kind, and a phone bar read from stale state; each must fail its test.

## Not verifiable here

The real phone's lag, the flick's feel, and the iOS motion prompt. These need you, with `npm run dev:phone` and
`npm run pair`. The `PHONE` figures stay first guesses until then, and the report will say so.

## Parts

- [x] 1. **Gesture refactor:** `src/gesture.ts` from `main.ts`'s pointer, key and button code, with no behaviour
      change. Check: the new `gesture.test.ts` green on the old behaviour, `check:quick`, the existing smoke for
      cast, strike and reel green. Its own commit.
- [ ] 2. **Fight view snapshot:** `fightPicture` and draw-from-snapshot. Check: `fightview.test.ts`; the fight
      look pictures unchanged to the pixel.
- [ ] 3. **Protocol and flick:** `protocol.ts` and `flick.ts`. Check: their unit tests, each seen failing first.
- [ ] 4. **Phone gestures in `gesture.ts`:** tilt aim, flick cast, the any-source reel, gone. Check:
      `gesture.test.ts` rows for criteria 2, 3, 6 and 8.
- [ ] 5. **Link, pairing and lab button:** `link.ts` (Trystero plus local), `pairing.ts`, **Pair a phone**,
      `game.phone()` and `game.pair()`, `dev:phone`. Check: `phone.spec.ts` pairing steps on the local link;
      `scripts/pair.ts` pairs over Nostr once.
- [ ] 6. **The phone page:** `phone.html`, pad, motion, word, bar, buzz. Check: `phone.spec.ts` complete.
- [ ] 7. **Fuzzer, leaks, pictures, CLAUDE.md.** Check: `fuzz -- --seeds 1-24` clean, leaks green, pictures
      written and each looked at.
- [ ] 8. **The pass:** `npm run check`, the perf baseline through `/gate-moved` (download only), the mutations, and
      the report.
