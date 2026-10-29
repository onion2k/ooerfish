# Photo mode: the lake framed and photographed, an album of twelve in the journal, a photograph looked at drawn again with its grain held, and the postmistress's letter

## Context

`DESIGN.md` lists photographs among the collectables ("from the photo mode, which fill the journal and answer
requests") and gives the postmistress's request: "a photograph of the eel that lights her window at night". This is
B4 of `docs/roadmap.md`, stage 7's third slice. The renderer's `postClock` (artshape-render, from v0.47.0) is the
clock its grain and dither roll on, made so that "a still drawn at one moment (a photograph's page) has the same
grain whenever it is drawn".

**Chosen by the user (29 Oct 2026):** a photograph keeps **figures, redrawn** (the camera, the time and the weather,
about 130 bytes), not pixels; the album holds **twelve**, and a thirteenth is **refused with a line**, a photograph
discarded from the journal when the player chooses.

## What

- **The camera** is "Camera" in the ⋯ menu (and the P key, not over a control), at the pond or in the cabin, never
  mid-fight (hooked or landed: the item greyed as Go to bed is), yawning or leaving. It is a page in the sense every
  page is (`pagesOpen()`: the game holds, no key or gesture reaches it), but the lake keeps drawing and **a drag and
  the wheel frame the view** as look mode's do at the pond (the orbit on; in the cabin the pillow's view holds), the
  overlays hide (`<html data-camera>`, the CSS hiding `#pond`, `#hud`, the fight's parts, `#menu`'s button) under a
  **viewfinder** (`#camera`: a thin frame inset from the screen's edge, a line "Day 3, dawn, the Reservoir" at its
  foot, a Take button and a Done button; Escape is Done). Take is `Game.photograph(subjects)`; Done leaves it as it was
  found (the mode, the view, the overlays). The mode is the page's and not saved.
- **A photograph** (`Photo` in `src/photo.ts`): `{ lake, day, time, weather, view: { x, y, z, azimuth, polar,
radius }, kinds, lit }`: the lake's id, the day and the clock's fraction when it was taken, the weather's kind, the
  orbit's target and sphericals, the ids of the kinds of fish **in frame** (unique, in slot order), and `lit`, true
  when the look's name was `night`, which is when an eel lights the water (the rung aside: the eel lights it by the
  game's rule, and lean only leaves the lamp undrawn). In frame is the pure `inFrame(viewProjection, x, y, z,
reach)` in `src/photo.ts`: in front of the camera, inside the clip box, and within `PHOTOS.reach` (60) of the
  camera, so a speck across the lake does not count. `main.ts` works the subjects out from `cam.viewProjection` and
  the school and hands them in; `Game` knows no camera. The album is `save.photos` (`PHOTOS.most`, 12): a
  thirteenth is refused, `photograph` returns false and the page says "The album is full." `Game.discard(i)` drops
  one and persists. `GameEvents.photographed(i)` and `discarded(i)`.
- **The journal's section "Photographs"** after the logbook: a row a photograph, `photoWords` pure in `src/photo.ts`:
  "Day 3, dawn at the Reservoir, in rain: a pink dawn fish and a pike." ("nothing in particular" with no kind; the
  hour by `hourName`, the function `nightview.ts` already has for the cabin's line, moved to `src/calendar.ts` if it
  is not there; the weather by `WEATHER_NAMES`, nothing said for sunny), with a **Look** button (only at the lake it
  was taken at; elsewhere the row ends "taken at the Reservoir") and a **Discard** button, and "photographs: n of 12".
- **A photograph looked at** (`look(i)` on the page): the journal closes, the page puts the camera at the photo's view
  (`orbit.setSpherical` and the target, the orbit then off), the clock at the photo's time (`game.setTimeOfDay`, the
  light shown as the clock lever shows it) and the weather at the photo's (`game.setWeather`), sets
  `renderer.postClock` to `PHOTOS.grain` (a fixed second) before every frame, and shows `#still`: the frame, the
  caption and a Back button (Escape too). The game holds as under any page. Back puts the clock, the weather lever
  (back to the day's own, `setWeather(null)`), the camera, the orbit and `postClock` back where they were. The fish
  are where they are now and the season is today's, as the user chose. The time is put only at the pond (the
  cabin's clock holds; a photo taken in the cabin is looked at at the pillow's view by its own time: since the
  cabin's light is the lamp's, the look there is the room's and the still is the room).
- **The postmistress's letter** `window` in `REQUESTS`, from Ida Penny, met when any photograph has `eel` among its
  kinds and `lit` true:

  > Dear neighbour, Something in the Reservoir lights my window of a night, green, and I have not once been awake
  > to see it properly. Would you take its photograph? I will put it over the counter. Ida Penny, Postmistress.

  > Over the counter it goes, and everyone who comes in asks. I have told them it is an eel and they do not believe
  > me. Thank you. Ida.

- **The test API:** `game.openCamera(open)`, `game.photograph()` (as Take does, the subjects from the page's camera),
  `game.photos()` (the album as saved), `game.discard(i)`, `game.lookAt(i)` and `game.lookAway()`, `game.still()`
  reads `{ shown, index, postClock }`, and `game.camera()` already reads the camera.

## Where it stands now (read)

- Pages: the sleep page (`openSleep`/`closeSleep`, `#sleep`, `sleepWords`) is the shape; `pagesOpen()` holds the
  step and the gestures; a page never draws the lake differently.
- The camera: `Orbit` has `setSpherical`, `currentAzimuth`, `currentPolar`, `distance`; `cam.target`; `setView`
  puts it; `orbitOn()` says when a drag turns it. `toScreen` projects a point through `cam.viewProjection`.
- The levers: `game.setTimeOfDay(at)` and `host.setTime(name)` light the page; `game.setWeather(name)` and
  `host.showWeather()` dress it; both count in `game.levers` (a photo looked at and put back must leave the lever
  count as the invariants allow, or set the clock back through the same road the lever uses).
- `renderer.postClock`: get and set, run on by `dt` each frame, NaN starts it again.
- The save: 208 bytes at most in the leaks run now; the ceiling 2000. Twelve photographs at about 130 bytes are
  1560 more, so the ceiling moves to 4000 and the reason is in `leaks.ts`.

## Acceptance criteria

1. The camera opens at the pond and in the cabin and not mid-fight, holds the game, hides the overlays, draws on, and
   a drag turns the view at the pond; Done restores the page.
2. `photograph` keeps the lake, day, time, weather, view, the kinds in frame and `lit`, persists, tells; the thirteenth
   is refused and the page says so; `discard(i)` drops one and persists; `inFrame` is right for in front, behind,
   outside the box and too far.
3. The journal lists the album in order with the words, Look at its own lake only, Discard, and the count.
4. Looking at a photograph puts the camera, the clock and the weather at its own and holds `postClock` at
   `PHOTOS.grain` every frame; Back puts all four back and the still is gone.
5. The postmistress's letter is met by a photograph with a lit eel and by none without (an eel by day, a lit pike).
6. A save reads photographs back, drops a malformed one (a lake unknown, a time outside [0, 1), a day past today, a
   weather or kind unknown), holds the album to twelve; an old save has none.

## Edge cases (from the checklist)

- **save:** `photos` with a default `[]`, `readPhotos` as above, `test/saves/12-photos.json`; loaded, the album is
  as written; a photo of a lake the save has no entry for still lists.
- **the day:** a photo at each look; looked at from any hour, the still's time is the photo's and the clock goes back;
  a photo while yawning is refused (the camera does not open).
- **the lakes:** Look only at the photo's lake; a journey leaves the album whole (it is the save's, not the entry's).
- **the mode:** the camera from look and from cast, the view as it was on Done; cast mode's held camera frames too.
- **the rung:** lean has no eel lamp drawn, but `lit` is the look's, so the request can be met on lean.
- **the phone:** a paired phone's gestures are kept out as under any page; the viewfinder at the phone's shapes, held
  by the layout spec.
- **the switches:** `?time=` and `?dirt=` are not read; the levers' counts are the invariants' business.
- **the contamination, the fish, the line, the water, the cabin:** a still draws what is there; nothing moves.

## Decisions (mine, said so they can be changed)

- **Twelve** is the album, as the roadmap said; `reach` 60 for in frame; `grain` 7 s.
- **A photo's hour is named by the clock's look**, as the cabin's line names it, so the album and the cabin agree.
- **The still is the lake drawn again**, not a copy: the page keeps drawing while it is shown, which is what makes
  the grain's clock worth holding.

## Performance risk

- **Frame:** none in play (a page's gate and a `data-camera` attribute); the still is a frame as any. **Boot:**
  nothing. **Download:** the page, the words, the CSS and the letter, about 2 kB gzipped, said exactly.
- **Save:** up to about 1.8 kB; the leaks ceiling raised to 4000 and the fullest album measured.

## Test plan

- **Unit:** `test/photo.test.ts` (`inFrame`, `photoWords`, the album's limit, `discard`, `photograph` on `Game` with
  the events), `test/requests.test.ts` (5), `test/saves.test.ts` (6), `test/journal.test.ts` (3, the section handed
  in as the logbook is), `test/post.test.ts` (six letters), `test/invariants.test.ts` (the album's rules).
- **End to end, `smoke/progress.spec.ts` "the camera":** open at the pond paused, the overlays hidden, a drag turns
  the camera (`game.camera()` moves), `photograph()` keeps one with the kinds `game.onScreen`-style projection agrees
  with, the journal lists it, `lookAt(0)` moves the camera and `game.time()` to the photo's and `still().postClock`
  holds across steps, `lookAway()` restores them, a twelve-full album refuses with the line, Discard drops one; at
  the Reservoir at night a photo with the eel in frame answers the letter.
- **Fuzzer:** opens the camera, photographs with kinds drawn from the lake's at random and `lit` by the clock,
  discards, looks at and away; the invariants hold the album to `PHOTOS.most`, each photo's lake known, day no later
  than today, time in [0, 1), weather and kinds known, `lit` a boolean; determinism hashes the album; `leaks.ts`
  counts `photos`.
- **Pictures:** `desk-camera` and `phone-camera` (the viewfinder over the standard scene), `desk-still` (the standard
  scene's photo looked at with the clock at dusk and rain, so the levers are seen to be put), `desk-journal-photos`
  and `phone-journal-photos` (the section with three), `desk-post`, `phone-post`, `desk-post-answered` move (six
  letters); the layout spec gains `camera` and `still` moments.
- **Perf:** the standard scene as now.

## Parts

Built on `sonnet` by the `builder` agent, from `docs/photo.md`, this spec copied into the repo.

- [x] 0. **The spec in the repo:** `docs/photo.md`; `DESIGN.md` stage 7 notes the slice; the roadmap. Check: Prettier.
- [x] 1. **The photograph and the album:** `src/photo.ts` (`Photo`, `PHOTOS` in `lake.ts`, `inFrame`, `photoWords`),
      `Game.photograph`/`discard`, the events, the save field, its reader and corpus file, the invariants, the hash,
      the leaks ceiling, the fuzzer's actions. Check: `test/photo`, `test/saves`, `test/invariants`, `test/fuzz`.
- [x] 2. **The letter and the journal's section:** the request, `journalWords`' `photos`, the rows with Look and
      Discard. Check: `test/requests`, `test/journal`, `test/post`.
- [x] 3. **The camera and the still on the page:** the menu item and key, `#camera`, `data-camera`, the drag,
      `#still`, `look`/`lookAway` with the levers and `postClock`, the test API. Check: the smoke stage.
- [x] 4. **The pictures and the layout:** the new and moved pictures, the layout moments. Check: `npm run look`,
      `smoke/layout.spec.ts`.
- [x] 5. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (`inFrame` always true; the
      thirteenth kept; the letter met by an unlit eel; `postClock` not held), the report. Commit and push.

## Part 5's notes (the pass)

- **The still is the game's.** The page first put the photograph's weather through the test lever and wrote the
  lever count back on the way out, which is the page reaching into the game. `Game.still` now holds the photograph
  being looked at: `lookAt(i)` (refused for another lake's, a still already, mid-fight, yawning or leaving) puts the
  clock to its time at the pond and the `weather` getter answers with its weather; `lookAway()` puts the clock back;
  `step`, bed, sleeping through and travel hold while it is shown; the invariants allow the still's weather and hold
  its index to the album; the fuzzer looks at and away. The page draws what the game says and holds `postClock`.
- **The save keeps play's clock through a look:** a hidden tab writes the save mid-look, so `persist` writes
  `still.timeBefore`, not the photograph's time, and a load lands where play was.
- **The hour is the cabin's word** (morning, afternoon, evening, night), not the look's (dawn, day, dusk), so the
  album and the cabin's line agree; `hourName` lives in `src/calendar.ts` and `nightview.ts` reads it.
- **The postmistress's two letters are headed alike,** "From Ida Penny", as the first was written.
- **The fuzzer's new actions** (photograph, discard, look at) are weighted at 0.3: at 0.8 they moved two seeds off the
  coverage the reach tests hold (a pond cleaned by a haul, a midnight crossed), which is the fuzzer's play shifting,
  not a rule.
- **Figures:** quick check 1571 tests; fuzz seeds 1 to 24 clean; bench, pace (2.2 to 2.11 min), balance and leaks
  within tolerance; perf in the full check boot 799 ms, frame 3.99 ms, download 213783 to 217021 B (the page, the
  words, the letter, the CSS: written by hand), the Reservoir 751 ms and 3.94 ms; look 125 pictures (new:
  `desk-camera`, `phone-camera`, `desk-still`, `desk-journal-photos`, `phone-journal-photos`; moved: the three post
  pictures by the sixth letter, `desk-menu-open` by the Camera item, the six journal pictures by the empty album's
  heading); progress 439 stages after four stale expectations (the menu's order, six letters) were brought up. Mutations:
  `inFrame` true behind the camera, the thirteenth kept, the letter met by an unlit eel, `postClock` not held: each
  caught by one test.
- **Not verified:** the camera by hand on the live site (the drag's feel under the viewfinder, P and Escape as real
  keys); a photograph taken in the cabin and looked at there is the pillow's view with no clock put, by design.
