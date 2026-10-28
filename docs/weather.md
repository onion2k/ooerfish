# The weather: five skies from the day, rain that brings fish up, fog, a sun-shower's rainbow, and a wind that bends the cast

## Context

Stage 6 of `DESIGN.md` is "the seasons, the moon and the weather"; the seasons and the moon are in. The design says
the weather comes from the radio's forecast: sunny; rain, which brings fish up; fog, which hides a catch's kind
until it is landed; a sun-shower, with its rainbow; and wind, which bends a cast; and that from the cabin the
player may sleep through to the next weather. Nothing of it exists: every day is sunny, the cast flies straight,
the sleep page lists the moons only and says the weather's rows join it later (`src/sleep/page.ts:21`). This is
slice A1 of `docs/roadmap.md`. The radio is the next slice; here the morning line carries one sentence.

**Chosen by the user (28 Oct 2026):** **the odds by season** (summer mostly sunny with showers, autumn rain and
fog, winter fog and snow with no showers, spring rain and showers: the table under Decisions; day 1 always sunny),
and **the wind bends the flight as a curve**, a constant push across it, the preview showing the bend.

## What

- **The weather is a pure function of the day**, as the season and the moon are: `weatherOf(day)` in
  `src/calendar.ts`, one of `'sunny' | 'rain' | 'fog' | 'shower' | 'wind'`, drawn by a hash of the day (one LCG
  step from `seeded(day)`, never the game's chance) against the season's odds, `WEATHER.odds[season]` in `lake.ts`.
  **Day 1 is sunny** (`WEATHER.firstDay`), so the game as drawn today holds and the first morning is calm, as day 1
  is a full moon by the same reasoning. The save gains nothing: the same save has the same forecast every time
  because the day decides it. `nextWeather(day, kind)` gives the nights to the next day of a kind within
  `MOON.days` (the sleep's cap), or null.
- **`Game.weather`** reads `weatherOf(this.day)` unless the lever `setWeather(name)` set it (counted in
  `game.levers`, as `setContamination` is; cleared by a wake, since the day moved). It is what the fish, the cast
  and the page read; `game.weather()` on the test API reads and sets it, resolving when the page has dressed it.
- **Rain brings fish up.** `School.step(dt, random, lift)` takes a lift of 0 to 1: the depth each fish eases toward
  is `hi * keeps[i] * (1 - lift)`, clamped as now, so the one draw per fish is untouched and the chance moves
  nowhere. `FISHING.rainLift` (0.5, an estimate) is the lift in rain and in a shower, 0 otherwise. A fish within
  `FISHING.band` of the lure is the bite's rule as now, so a shallow sink finds fish in rain. In winter rain falls as
  snow (the season's falling at the rain's cadence) and lifts the fish all the same.
- **Fog hides the kind by hiding the fish:** nothing names a fish's kind before it is landed (the card is the first
  word of it), and the glow seen under the water is how a player tells one; fog is the renderer's fog over the whole
  lake (`weatherFog` beside `mistFor` in `src/season.ts`: `WEATHER.fog`, density, height and reach to haze the far
  bank and the water's glow by every look, over the season's mist). The card at landing reads as now. On the lean
  rung the fog is off as the mist is: the sky and the light still say fog.
- **The look:** `timesFor(season, phase, weather)` in `look.ts`, memoised by all three: rain and fog mix a grey into
  the sky's zenith and horizon and scale the ambient down (`WEATHER.<kind>.sky`, `ambient`); the shower mixes a
  little; wind and sunny change nothing. The cube stays keyed `season:time`, as the moon left it (no bake per
  weather). The water's `sparkle` is scaled by `WEATHER.<kind>.sparkle`.
- **Rain's drops** are the falling ring at the rain's own `Falling` (`WEATHER.rain.falling`: a small blue-grey
  `disc`, high gravity, no drift, short life), in place of the season's leaves or petals while it rains, sized to
  fit the pool: `particleWindow(season, lake, weather)` holds under `PARTICLE_POOL` with the falls' mist, so the pool
  does not move (it is a picture baseline). **Rain's rings** on the water are raindrops in the splash pool: `Game.step`
  adds one of size `WEATHER.rain.ring` every `WEATHER.rain.ringEvery` seconds of stepped time at the pond, at a point
  from a hash of the ring's own counter (how many have come), never the game's chance, so determinism holds; at that
  rate half the twelve slots stay the player's. They fire no `splashed` event (the event is the player's pebble's: the
  droplets and the sound would be a rain of them), and the ripples draw them as any splash.
- **The sun-shower's rainbow:** `src/rainbowdraw.ts`, `RainbowDraw`: seven thin arcs (a `ring` segment from
  `lowpoly` each, one group a colour, unlit through `FLOW_GLOW`, `RAINBOW_COLOURS` (`src/palette.ts`)), far along `WEATHER.rainbow
.direction` at `distance` and `radius` (opposite the day's sun by its bearing, low over the north bank, within the
  far plane; measured in the build and given a direction of its own if the shore view does not hold it, as the moon
  was), scaled to nothing except in a shower by dawn, day or dusk (as built, see part 5's note below: it stands over the
  lake's north shore rather than at the far sky); handed over only when the look or the weather
  changes. Part of the `falling` draws for rain run in a shower too.
- **Wind bends the cast.** `flightAt(angle, power, t, out, lake, wind)` gains a lateral term, the wind's push
  across the flight (decision 2 below); `landingTime`, `flight`, `pathPoints` and `aimAt` take the wind through, so
  the preview is the bent flight to the bit and `aimAt` (the test API's `fishTo`) lands where it says. `Lure.cast`
  keeps the wind at the cast, so a weather change mid-flight changes nothing. The wind is `WEATHER.wind.push` along
  `BREEZE.direction` in the wind weather and zero otherwise; the grass's `renderer.wind.strength` is the season's
  breeze times `WEATHER.wind.gust`, the particles' `setWind` the push, and the waves `wavesFor(season)` scaled by
  `WEATHER.wind.waves` (the bobber's surface rebuilt, as a season's is).
- **The sleep page** lists, with the moons, "Till the next rain (n nights)" for each kind within eight nights, in
  order of distance, as its comment promised. **The morning line** gains a sentence as the moon's: "Rain today.",
  "Fog this morning.", "A sun-shower today.", "Windy today."; sunny says nothing.
- **The page** dresses the weather in `showWeather(w)` (`main.ts`): at boot, at the wake, and when the lever moves:
  the falling ring rebuilt, the fog and light written (`showLight` reads the weather with the season), the wind set,
  the rainbow handed over. `game.weather()` reads `{ name, lift, wind, handovers }`.

## Where it stands now (read)

- The cast takes no wind; `flightAt` is the one flight every caller samples (`src/cast.ts:59`).
- A fish's `keeps` is one draw at `place`; the depth it eases toward is worked out each step from it
  (`src/fish.ts:241`), at `SINK` 0.4 a second.
- The splash pool and the renderer's ring slots are both 12; the particle pool 2048 with about 1,910 live in
  autumn at the falls.
- The perf baseline: boot 805 ms, frame 4.02 ms, bundle 203,759 B. The mist costs about 0.2 ms.

## Acceptance criteria

1. `weatherOf(day)` is pure, one of the five, `sunny` on day 1, and over 560 days each season's shares are within
   0.05 of its odds.
2. `nextWeather(day, kind)` is the nights to the next such day within eight, or null, and never zero.
3. In rain, every fish's target depth is `(1 - rainLift)` of its sunny one (clamped), and a fish is never above
   `fishShallowest`; in sunny weather the school steps to the bit as before (the determinism hash of a sunny seed is
   unchanged from today's).
4. With wind zero, `flightAt` is unchanged to the bit; with wind, the landing moves downwind, the preview's last
   point is the landing, and `aimAt(x, y, lake, wind)` lands within 0.05 of `(x, y)`.
5. The lever `setWeather` changes `Game.weather` and counts a lever; a wake clears it; the invariant holds the
   weather to `weatherOf(day)` unless a lever was set, the fish's lift to the weather, and the lure's wind to the
   weather at its cast.
6. The particle window in rain, every season, is under `PARTICLE_POOL`, held in `leaks`.
7. The raindrop rings come at the rate, from the step count, so two games of one seed in rain hash the same.
8. The sleep page lists the weather rows in order with the moons; a choice lands on that day with the morning
   line naming the weather.
9. The rainbow is drawn in a shower by day and not at night, not in rain; the fog's density is the weather's on
   full and nothing on lean.
10. Every existing picture holds, since the pictures' `set` puts the weather sunny.

## Edge cases (from the checklist)

- **save:** nothing new; an old save loads and its day's weather is drawn.
- **the day:** the weather is the day's at dawn, day, dusk and night (the rainbow by day only; fog at night a
  darker fog); midnight's wake dresses the new day's; slept through, the chosen day's; the cabin shows no weather
  (the window is unlit, the clock stopped); the lever cleared at the wake.
- **the seasons:** each season's odds; winter's rain is snow; the season's falling comes back when the rain stops.
- **the rung:** full has the drops, the fog and the rainbow; lean the drops and the rainbow, no fog (as no mist),
  the light and the sky the same; the governor unchanged.
- **the lakes:** the Reservoir has the same weather on the same day (it is the day's), its own falling ring and
  fog over its own water; the rainbow by the look's direction, as the moon.
- **the phone:** the layout unchanged; a flick casts into the wind as a drag does (the same `cast`).
- **the switches:** `game.weather('fog')` from each weather, each time, each view; an unknown name refused by name;
  `?weather=` is not a switch (the lever is the tests'; a player gets the day's).
- **the line:** cast into the wind onto the water, the bank and the edge; the preview and the flight agree; the
  lure's wind fixed at the cast; `fishTo` aims with the wind.
- **the fish:** in rain the whole school rises over a few seconds, none above the shallowest; a cured fish too;
  the hooked fish steered to the lure as now; the fight unchanged.
- **the water:** the raindrop rings only on the water (`dropNear` refuses off it, so the hash's point is pulled
  inside as `dropNear` does); the pool's oldest replaced.
- **the lake's contamination:** unchanged by any weather.
- **the pace, the bench, balance:** each runs with the lever sunny, so their baselines hold; said in each script.
- **the mode, the cabin, the festivals, the real clock, the boat:** not reachable.

## Decisions (the user's)

1. **The odds by season.** Recommended, from the design's table (spring showers, autumn mist, winter snow):

   | Season | sunny | rain | fog  | shower | wind |
   | ------ | ----- | ---- | ---- | ------ | ---- |
   | summer | 0.55  | 0.15 | 0.05 | 0.15   | 0.10 |
   | autumn | 0.35  | 0.25 | 0.20 | 0.05   | 0.15 |
   | winter | 0.40  | 0.15 | 0.25 | 0      | 0.20 |
   | spring | 0.40  | 0.25 | 0.10 | 0.15   | 0.10 |

   The other way is even odds, a fifth each, so every weather is seen in the first week; it costs the seasons
   their character. Either is a table; nothing else changes.

2. **How the wind bends a cast.** Recommended: **a curve**, a constant push across the flight (`x += push·t²/2`
   along the wind), so the lure visibly bends away through the air and lands downwind, the preview showing the
   curve, one term in `flightAt`. The other is **a drift**, the flight straight and the landing moved downwind,
   which is one line less and reads as a jump. The push's size: `WEATHER.wind.push` so a full cast lands about 4
   units off line (an estimate, tuned on the picture).

## Decisions (mine, said so they can be changed)

- **The day decides, not a seed in the save:** every player's day 12 has the same sky. A seed in the save would be
  a new field for a difference nobody would see, and the design's "the same save has the same forecast" holds.
- **Fog hides nothing on the card:** the fog itself hides the glow. A line of code that hid the name would hide
  what the player cannot see anyway.
- **Rain's rings are splashes**, half the pool at most, rather than a second ring buffer: the renderer has twelve
  slots and the splashes already draw them.
- **No cube per weather**, as no cube per phase: the mirror keeps the sunny glint under a grey sky.
- **The rainbow is arcs, not a sprite**, so it is a shape at any size, as the moon is discs.

## Performance risk

- **Frame:** the fog in weather fog, measured (the mist is 0.2 ms; more height and reach may be 0.3); the rainbow's
  seven arcs, nothing per frame; the drops within the pool, so no new cost. Measured by `measureFrame` in the
  rain, fog and shower scenes in the smoke and told in the report; the standard scene is sunny and holds.
- **Boot:** the rainbow's meshes, small.
- **Download:** `weather` in calendar, `rainbowdraw.ts`, the words, the page: about 3 kB gzipped, said exactly.

## Test plan

- **Unit:** `test/calendar.test.ts` (criteria 1, 2); `test/cast.test.ts` (4); `test/fish.test.ts` and
  `test/bite.test.ts` (3: the lift, a bite found by a shallow lure in rain); `test/season.test.ts` or
  `test/look.test.ts` (`timesFor` with weather, `weatherFog`); `test/falling.test.ts` (6, the window per season in
  rain); `test/rainbowdraw.test.ts` (shown by look and weather, the same matrices); `test/sleep.test.ts` (8, the
  rows); `test/nightview.test.ts` (the line); `test/game.test.ts` (5, the lever, the wake, the rings' rate);
  `test/invariants.test.ts` (5, a broken lift caught); `test/leaks.test.ts` (6).
- **End to end, `smoke/progress.spec.ts` "the weather":** a load on a rainy day reads `weather()` rain with the
  fish risen after 300 frames and a shallow `fishTo('bite')`; `weather('fog')` on full reads the fog's density, on
  lean none; `weather('shower')` by day draws the rainbow, at night not; `weather('wind')` and a cast lands downwind
  of the same cast in sunny; the sleep page lists the rows and a choice wakes on the day with the line.
- **Fuzzer:** the start's day already spreads over every weather; the sleep-through action reaches them; a new
  action sets the lever at random (a player cannot, but the pictures do, and the invariants must hold through
  it), counted.
- **Determinism:** the hash takes in the weather's index, the lift and the lure's wind; a seed played in rain
  hashes the same twice.
- **Pictures:** `weather-rain-day`, `weather-rain-night`, `weather-fog-day`, `weather-fog-dusk`,
  `weather-shower-day` (the rainbow), `cast-wind-preview` (the bent preview from the shore), `weather-snow-winter`,
  `weather-reservoir-rain`, `desk-sleep-weather`, `phone-sleep-weather`, `phone-weather-rain`; `set` puts every
  existing picture sunny, so none moves.
- **Perf:** the standard scene as now; the three scenes measured and told.

## Part 5's notes (as built)

- **The rainbow stands near, not far.** The far-sky placement part 3 gave it was clipped by the Shore view's frame (the
  sky above the ridge is a few degrees tall, and the cliff and trees hide the rest), so it is now a bow `WEATHER.rainbow`
  `distance` 22 out along a direction a little west of north, `radius` 17, bands 1.2 wide: whole, over the north
  shore in front of the cliff, reflected in the water. It is a bow in the lake's own space, so it parallaxes as the
  camera orbits; a far one is a change of those three figures.
- **The cabin's fog** is `fogFor(season, time, mm, weather, place)` in `src/season.ts`: the season's mist alone while the
  player is in the cabin, the weather's everywhere else.
- **The sky of a wet weather** also dims the sun's colour (`sun`) and, but never at night, the exposure (`exposure`),
  so the banks read as under cloud; the fog's fill (`light`) is a ratio to the sun's and its anisotropy is nothing.
- **The fuzzer's lever** stands outside its weighted list, picked by a stream of its own at a half like the walk into the
  cabin, so the seeds played before it play the same until the lever fires.

## Parts

Built on `sonnet` by the `builder` agent, one at a time (they share `main.ts`), from `docs/weather.md`, which is
this spec copied into the repo as part 0. The session is on Fable: the build passes to sonnet, picked in the menu.

- [x] 0. **The spec in the repo:** `docs/weather.md`, the roadmap as `docs/roadmap.md`, `DESIGN.md` stage 6 notes
      the slice. Check: Prettier.
- [x] 1. **The weather from the day:** `WEATHER` in `lake.ts`, `weatherOf`, `nextWeather`, `Game.weather`, the
      lever, `game.weather()`, the invariant, the determinism hash. Check: `test/calendar`, `test/game`,
      `test/invariants`, `test/determinism`.
- [x] 2. **The fish and the cast:** the lift in `School.step`, the wind in `cast.ts` and `Lure`, the pace, bench
      and balance scripts on the lever. Check: `test/fish`, `test/bite`, `test/cast`, `npm run pace:check`.
- [x] 3. **The page:** `timesFor` with weather, `weatherFog`, the rain's falling and rings, the wind on the grass,
      particles and waves, `rainbowdraw.ts`, `showWeather`. Check: `test/season`, `test/falling`,
      `test/rainbowdraw`, `test/leaks`.
- [x] 4. **The words:** the sleep page's rows, the morning line. Check: `test/sleep`, `test/nightview`.
- [x] 5. **The pictures and the stage:** `set` sunny by default, the new pictures, the smoke stage, the fuzzer's
      lever action. Check: `npm run look`, `smoke/progress.spec.ts`.
- [x] 6. **The pass:** `npm run check`, fuzz 1-24, perf before and after, the mutations (the lift ignored; the wind
      dropped from the preview; the hash without the weather), the report. Commit.

## Part 6's notes (the pass)

- **The day's hash was no hash.** One step of `seeded(day)` gives a first draw that climbs in a straight line with the
  seed (0.258, 0.280, 0.302 for days 1, 2, 3), so the weather came in runs of a fortnight: days 1 to 14 sunny, 17 to
  25 fog. `dayHash` in `calendar.ts` is now murmur3's finishing mix of the day, and a test holds that the weather
  changes from one day to the next on more than 45% of days (independent draws at these odds change on about six in
  ten; the runs changed on fewer than two). The shares test reads 5,600 days, since 140 a season put a 0.05 bound at
  one sigma. The sequence moved: day 5 and day 9 are sun-showers, 13 rain, 15 fog; the stages and pictures that
  pinned a day were re-pinned, and `desk-morning-full-moon`, `desk-sleep-page` and `phone-sleep-page` were taken
  again because their day's line and rows gained the weather, meant.
- **"Foggy today."** not "Fog this morning.", since the cabin's line reads at any hour.
- **The layout's sleep moment** is day 9, where every weather is within the round: six rows, the most the page ever
  holds, fit on all eight screens.
- **The download** grew by 2,766 B gzipped (203,759 to 206,525), the weather's code and words; that one figure was
  written into the perf baseline by hand. Boot and frame hold: on a quiet machine the gate read boot 788 ms and frame
  3.99 ms against 805 and 4.02; the three loaded readings before it (boot 982 to 1116 ms) were the machine, since
  the parent commit stashed and measured under the same load booted at 1,095 ms.
- **The mutations:** the lift ignored (two tests fail), the wind dropped from the preview (one fails), the hash
  without the weather's index (the determinism test survived it when it switched to rain, since the lift carries
  rain too; it now switches to fog, which lifts and blows nothing, and fails as it should).
