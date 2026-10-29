/**
 * The page: the lake drawn. Everything that happens at the lake happens in
 * `game.ts`; this draws the frame, on the game path of artshape-render, and
 * turns what the game says into the water, the light and the camera: the water
 * when the contamination changes, the light when the time does, the camera when
 * a view is picked. There is no game logic here.
 */
import './fight.css';
import { createContext } from 'artshape-render/gpu/context';
import { Orbit } from 'artshape-render/gpu/camera';
import { LightPool, type PointLight } from 'artshape-render/game/lights';
import { invertInto } from 'artshape-render/geom/transform';
import { GameRenderer } from 'artshape-render/game/renderer';
import { NO_PHONE, createApi } from './debug';
import { cabinGroups, jettyGroups } from './cabin';
import { CalendarDraw } from './calendardraw';
import { lampAt, roomGroups, tableBox } from './cabinroom';
import { MapDraw, mapHit } from './mapdraw';
import { MoonDraw } from './moondraw';
import { RainbowDraw } from './rainbowdraw';
import { FrostDraw } from './frostdraw';
import { BoatDraw } from './boatdraw';
import { fallsOf, fallGroups, fallMists, mistDue } from './falls';
import type { Emit } from 'artshape-render/game/particles';
import { fallingDue, fallingEmits, fallingKind, fallingOf, windDrift } from './falling';
import { BREEZE, GRASS_OPTIONS, bankField } from './grass';
import { splashBurst } from './bursts';
import { Gesture, type GestureEvent, type PointerGesture } from './gesture';
import { CastDraw, LINE_COLOURS, type Aim } from './castdraw';
import { DrumDraw } from './drumdraw';
import { TreasureDraw } from './treasuredraw';
import { EelLights } from './eellight';
import { FishDraw } from './fishdraw';
import { frameCost } from './frame-cost';
import { quantised } from './heal';
import { castWords } from './castwords';
import { Game, type GameEvents } from './game';
import { HOME, LAKES, lakeNamed } from './lakes';
import type { Lake } from './lakes/lake';
import { journalWords } from './journal';
import { logbookWords } from './town/logbook';
import { albumWords, inFrame, photoLine, photoWords } from './photo';
import { postWords } from './town/post';
import { REQUESTS } from './town/requests';
import { YOU_ARE_HERE, lakesWords } from './lakes/page';
import { sleepWords } from './sleep/page';
import {
  HEAL,
  KINDS,
  PARTICLE_POOL,
  PHOTOS,
  PHONE,
  SPLASH_CAPACITY,
  type Season,
  SEASON_DRESSING,
  WATER_LEVEL,
  WEATHER,
  SWIM,
  framingFor,
  type ViewName,
  type Weather,
} from './lake';
import { bakeLooks, light, looksBaked, nearestTime, paintFor, timesFor, type TimeOfDay } from './look';
import { anchorWording, nextMode, orbits, rowWording, wording, type Mode, type ModeEvent } from './mode';
import { NightView } from './nightview';
import { cabinHit, tableHit, waterPoint } from './pick';
import { ROOM_COLOURS, mix } from './palette';
import { hourName, moonOf, seasonOf } from './calendar';
import { seasonGrass, seasonPalette, fogFor } from './season';
import { Progress } from './progress';
import { BOOT_MEASURE, rungAsked, rungFor, type Rung } from './rung';
import { seeded } from './random';
import { RIPPLE_FLOATS, rippleData } from './ripples';
import { Scene, cliffLumps, sceneryFigures } from './scene';
import { rockCaps } from './rocks';
import { loadScenery } from './scenery';
import { changed, readSettings, type Settings } from './settings';
import { STYLES } from './water/styles';
import { shoreField } from './shorefield';
import { surfaceOf, waterClock } from './water/swell';
import { FightView } from './fightview';
import { readPhoneLink } from './phone/linkname';
import type { PairingOverlay } from './phone/pairing';

/** Where the phone page is served from for the QR code: the LAN address under `npm run dev:phone`, empty otherwise. */
declare const __PHONE_ORIGIN__: string;
import { layoutFor, type Layout } from './layout';
import { PondView } from './pondview';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  // nothing is drawn as an effect layer: the fish glow under the water as meshes
  EFFECT_CAPACITY = 0,
  // the falls' mist, twelve splashes and a season's falling things at once, with room to spare (`PARTICLE_POOL`)
  PARTICLE_CAPACITY = PARTICLE_POOL;
/** How long what a strike did is said for, in seconds of game time. */
const HEARD_FOR = 2;
/** How many of the game's events the test API keeps, before the oldest go. */
const EVENTS_KEPT = 500;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot')!;
const bootMsg = document.getElementById('bootMsg')!;
const help = document.getElementById('help')!;
const castLine = document.getElementById('castLine')!;
const phoneStatus = document.getElementById('phoneStatus')!;
const modeButton = document.getElementById('modeButton') as HTMLButtonElement;
const rowButton = document.getElementById('rowButton') as HTMLButtonElement;
const anchorButton = document.getElementById('anchorButton') as HTMLButtonElement;
const byId = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

main().catch((err: unknown) => {
  bootMsg.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
});

async function main() {
  // ---- the lake ----

  // the one lake this page plays, chosen once at boot from the save and never swapped (travel is a reload): the save
  // names it, and an id the game does not know is the home
  const progress = new Progress(undefined, LAKES);
  const lake: Lake = lakeNamed(progress.save.lake);
  /** The page is on its way to being loaded afresh (a journey, or a wake away from home), so nothing is written again. */
  let reloading = false;

  // ---- the renderer ----

  const ctx = await createContext(canvas);
  bootMsg.textContent = 'compiling shaders…';
  const renderer = new GameRenderer(ctx, LIGHT_CAPACITY, EFFECT_CAPACITY, PARTICLE_CAPACITY, MM_PER_UNIT);
  renderer.camera.fov = 40;
  renderer.camera.near = 1;
  renderer.camera.far = 1500;
  renderer.setSunShadow(lake.shadowBox);

  // ---- the game ----

  const query = new URLSearchParams(location.search);
  // ?seed=N makes chance the same from before anything is built, for a test that wants the same lake every run
  const seed = query.get('seed');
  /** What has happened, a line each, for the test API: kept to the last few hundred. */
  const eventLog: string[] = [];
  const log = (line: string) => {
    eventLog.push(line);
    if (eventLog.length > EVENTS_KEPT) eventLog.splice(0, eventLog.length - EVENTS_KEPT);
  };
  /** What a strike or a fish letting go did, said on the cast's line for `HEARD_FOR` seconds of game time after. */
  const heard = { text: '', until: -Infinity };
  const hear = (text: string) => {
    heard.text = text;
    heard.until = game.t + HEARD_FOR;
  };
  const events: GameEvents = {
    splashed(x, y, size) {
      log(`splashed ${x.toFixed(1)},${y.toFixed(1)}`);
      // the droplets thrown up, once, in the colour the water is drawn at (the quantised heal), so they match what they land on
      renderer.emit(splashBurst(x, y, size, waterShown()));
    },
    nibbled: () => log('nibbled'),
    bitten: (heavy, quarry) => {
      log(heavy ? 'bitten (a drum)' : quarry === 'treasure' ? 'bitten (a treasure)' : 'bitten');
      // a phone that can vibrate is asked to, once, as the strike's window opens
      overlay?.buzz();
    },
    hooked: () => log('hooked'),
    missed: () => {
      log('missed');
      hear('too late, it let go');
    },
    struck: (did) => {
      log(`struck ${did}`);
      // a fish struck at while it only nibbled has just let go, and that is what is said, not that it was too late
      if (did === 'spooked') hear('too soon, it swam off');
      else if (did === 'twitch') hear('nothing biting yet');
    },
    slipped: () => log('slipped'),
    landed: (kind, weight, temper) => log(`landed ${temper} ${kind} ${weight.toFixed(2)}`),
    cured: (cured, toClean) => {
      log(`cured ${cured}/${toClean}`);
      // the water steps clearer at once, and the line says so; the gauge reads the save the game has just written
      void showWater();
      pond.cured(cured, toClean);
    },
    hauled: (hauled, drums) => {
      log(`hauled ${hauled}/${drums}`);
      // the drum is gone from the bed and the water steps clearer at once, and the line says so
      void showWater();
      pond.hauled(hauled, drums);
    },
    found: (id) => {
      log(`found ${id}`);
      // the treasure leaves the bed for its shelf, and the line says so; the water is as it was
      void showWater();
      pond.found(id);
    },
    photographed: (index) => {
      log(`photographed ${index}`);
      pond.photographed();
    },
    discarded: (index) => log(`discarded ${index}`),
    rowed: (x, y) => {
      log(`rowed ${x.toFixed(1)},${y.toFixed(1)}`);
      // the boat sets off: an aim begun and a reel held are let go, the page looks (the camera follows the seat by a drag
      // that turns it, which cast mode's still camera could not), and the boat's cover comes off with the player aboard
      showMode(nextMode(mode, 'done').mode);
      aim = null;
      letGoOfReel();
      void showWater();
    },
    adrift: () => {
      log('adrift');
      showAnchor();
    },
    anchored: (x, y) => {
      log(`anchored ${x.toFixed(1)},${y.toFixed(1)}`);
      // the camera is put at its view again, from the seat where the boat now lies
      void setView(viewName, true);
      showAnchor();
    },
    ashore: () => {
      log('ashore');
      // stepped off at the mooring: the camera is put at its view from the shore's place, and the boat is covered in winter
      void setView(viewName, true);
      void showWater();
    },
    yawned: () => {
      log('yawned');
      // the night is begun from look or from cast: an aim begun and a reel held are let go, and the page looks
      showMode('look');
      aim = null;
    },
    left: (id) => {
      log(`left for ${id}`);
      // the save names the new lake already, and the screen is black: the load is the journey's other half
      reloading = true;
      location.reload();
    },
    woke: (day) => {
      log(`woke ${day}`);
      // waking is at home: the game has written the save at the home's cabin, and the page, which plays one lake and
      // never swaps it, is loaded afresh there before anything of the cabin is drawn (the lake here may have none)
      if (lake.id !== HOME.id) {
        reloading = true;
        location.reload();
        return;
      }
      // the player wakes in the cabin, and the camera is put at the pillow
      void setView('cabin', true);
      // a new day, a new square of the calendar's year gone
      void showWater();
    },
    answered: (id) => {
      log(`answered ${id}`);
      pond.answered(id);
    },
    gifted: (name, words) => {
      log(`gifted ${name}`);
      pond.gifted(name, words);
    },
  };
  const game = new Game(progress, {
    lake,
    // every load fades in from black, which hides a journey's cut and the boot alike
    arrives: true,
    ...(seed !== null ? { random: seeded(+seed) } : {}),
    events,
  });

  // ---- the scene ----

  // the scenery kit is loaded before the first frame, as the first frame's business, and the banks are built from it
  bootMsg.textContent = 'loading the scenery…';
  const scenery = await loadScenery(
    (url) => fetch(url),
    import.meta.env.BASE_URL + 'scenery/',
    (blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
  );
  renderer.setCardImages(scenery.masks);

  const scene = new Scene(lake);
  // the rung the page is drawn on: full has the banks' grass, lean has none (the woodland costs a tenth of a
  // millisecond and stands on both). The address may ask for one (a test does, and so does a slow machine's owner);
  // without, the governor chooses once the page has booted.
  const asked = rungAsked(query.get('rung'));
  let rung: Rung = asked === 'auto' ? 'full' : asked;
  // worked out once, from the placements the groups are made from, and read back by the test API
  const sceneryFigured = sceneryFigures(scene.placements(scenery.kit), lake);
  // the grass field is made once, and handed over each time the full rung is drawn or a season's blades are: nothing in
  // it grows, so only the kind it carries changes between seasons
  const baseField = bankField(undefined, lake);
  let field: ReturnType<typeof bankField> = baseField;
  /** The page put on a rung: the grass grown or let go, and the mist's fog allowed or not. */
  async function setRung(to: Rung) {
    rung = to;
    // the mist is the full rung's: the lean one has no fog whatever the season says (`docs/seasons.md`, part 5)
    renderer.economy = { ...renderer.economy, fog: to === 'full' };
    await renderer.setGrass(to === 'full' ? field : null, GRASS_OPTIONS);
  }
  // the cliff's falls are the page's picture, flowing down its notches; the mist they throw is made once and handed on;
  // the cabin, the room inside it and the jetty are built once and stand still; the room is wholly inside the cabin's
  // solid walls, so it is drawn and never seen until the camera is put in it
  const mists = fallMists(lake);
  const falls = fallsOf(lake);
  /** The falling things of the dressed season (empty in summer), made in `dress` once a season, and how many have been emitted. */
  let fallers: Emit[] = [];
  let fallEvery = 1;
  let fell = 0;
  /** The weather the page is dressed for (the game's, from the moment `showWeather` has run), and what falls in it: the rain's, the season's or nothing. */
  let weatherDressed: Weather = game.weather;
  let fallingNow: 'rain' | 'season' | null = null;
  /** The season last dressed (null before the first), how many static sets were handed over, and what the last cost. */
  let dressed: Season | null = null;
  let dressing: Season | null = null;
  /** The phase of the moon the night's look was last made for, so a wake into another re-lights it. */
  let phaseLit = moonOf(game.day);
  let statics = 0;
  let dressMs = 0;
  /** The snow caps appended to the static set at the last dress (none outside winter). */
  let caps = 0;
  /** The frost at a clean lake's edge, scaled to nothing unless it is winter and the lake is clean: the dynamic set's last group. Made before the first dress, which sets it. */
  const frost = new FrostDraw(lake);
  /** The boat, a moving part of four groups placed each frame, and the dynamic set's slot of its first; none in a lake with no boat. */
  const boatDraw = new BoatDraw(lake);
  let boatSlot = -1;
  /**
   * The lake dressed for a season (`docs/seasons.md`, part 2): the static set built again with the season's palette
   * (the meshes are memoised and only the albedo differs) and the grass handed over with the season's blades, once, at
   * boot and at a wake into a new season, where nothing moves. The lean rung still has no grass.
   */
  async function dress(season: Season) {
    const began = performance.now();
    dressing = season;
    const palette = seasonPalette(season);
    renderer.setStatic([
      ...scene.static(scenery.kit, palette, season),
      ...fallGroups(lake),
      ...(lake.cabin ? cabinGroups(palette, lake) : []),
      ...(lake.cabin ? roomGroups(ROOM_COLOURS, lake, Object.values(LAKES)) : []),
      ...(lake.jetty ? jettyGroups(palette, lake) : []),
    ]);
    caps = season === 'winter' ? rockCaps(lake, cliffLumps(lake)).length : 0;
    // the frost follows the season at once, so a wake into winter on a clean lake hands it over with this dressing
    frost.show(season, game.pondClean);
    field = { ...baseField, kinds: [seasonGrass(season)] };
    await setRung(rung);
    applyWeather();
    dressed = season;
    statics++;
    dressMs = performance.now() - began;
  }
  /**
   * The wind, the falling things and the particles' wind for the season being dressed in the weather the page is
   * dressed for, made once a change of either and never in a frame: the grass's strength is the season's breeze, gusting
   * in the wind weather (written here and nowhere else, so the lean rung's still air is the economy's and not ours); the
   * rain's drops (or snow) fall in place of the season's in rain and a shower, and fall on the lean rung too, as flakes do.
   */
  function applyWeather() {
    const season = dressing ?? seasonOf(game.day);
    const gust = weatherDressed === 'wind' ? WEATHER.wind.gust : 1;
    renderer.wind = { ...BREEZE, strength: SEASON_DRESSING[season].breeze * gust };
    fallers = fallingEmits(season, { radius: lake.radius, level: WATER_LEVEL }, weatherDressed);
    fallEvery = fallingOf(season, weatherDressed)?.every ?? 1;
    fallingNow = fallingKind(season, weatherDressed);
    renderer.setWind(windDrift(season, weatherDressed));
  }
  await dress(seasonOf(game.day));
  // the breeze is slow: the renderer's clock runs at the water's pace (`lake.waterPace`), so the gusts roll by slowly, and the
  // grass has no second clock of its own; `dress` sets its strength by the season
  /** The season the sky, the water and the swells are drawn in: the one being dressed, which is the day's from the moment of the wake. */
  const seasonNow = (): Season => dressing ?? 'summer';
  /** How long the last bake of a season's four looks took, in milliseconds. */
  let bakeMs = 0;
  // the pool of lights holds the cabin's lamp only, written once; it is counted live while the player is in the cabin
  // and not at the pond, so a frame outside pays nothing for it
  const lights = new LightPool(LIGHT_CAPACITY);
  const lamp: PointLight | null = lake.cabin
    ? {
        position: lampAt(lake),
        radius: lake.cabin.room.lamp.radius,
        colour: [...lake.cabin.room.lamp.colour],
        intensity: lake.cabin.room.lamp.intensity,
      }
    : null;
  if (lamp) lights.set(0, lamp);
  lights.clear();
  renderer.setLights(lights);
  let lampLit = false;
  // the lamp eels' lights follow the lamp's in the pool; written each frame they are lit, since an eel moves
  const eelLights = new EelLights(lake, 1);

  // the foam rings the shore and the boulders from the lake's field, made once and before the first frame
  renderer.setShoreField(shoreField(undefined, lake));

  const cam = renderer.camera;
  cam.target = [0, 0, 0];
  cam.position = [0, -70, 30];
  const orbit = new Orbit(cam, {
    element: canvas,
    minPolar: 0.2,
    maxPolar: 1.5,
    minDistance: 10,
    maxDistance: 200,
    rotateSpeed: 0.4,
    zoomSpeed: 0.8,
    panSpeed: 0,
    inertia: 0.5,
  });

  let width = 1,
    height = 1;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    cam.aspect = width / height;
    renderer.resize(width, height);
  };
  addEventListener('resize', resize);
  resize();
  // the layout the screen's shape gives is set on the document for the CSS to key off, now and whenever it is turned
  const setLayout = () => {
    document.documentElement.dataset.layout = layoutFor(innerWidth, innerHeight);
  };
  addEventListener('resize', setLayout);
  setLayout();

  // ---- what the address holds, and what each change of the game's makes of the page ----

  /** The caustics and the paint, from the address: the viewer's and the tests', never saved and never written back. */
  let settings: Settings = readSettings(query);
  /** The one way the water is drawn; another would be chosen here. */
  const style = STYLES[0];
  /** The fish as they are drawn, and the first of the dynamic groups they are, a part each. */
  const fish = new FishDraw();
  let fishSlot = 1;
  /**
   * The splashes' ripples handed to the water each frame, which carries them out across itself as rings in its own
   * surface, and how many the last frame handed; and how long the water's ripples last, which its look says.
   */
  const ripples = new Float32Array(SPLASH_CAPACITY * RIPPLE_FLOATS);
  let rippling = 0;
  let rippleLife = 0;
  /** The cast's groups, after the fish's: the angler to the preview. */
  const casting = new CastDraw(lake);
  /** What a cast is being aimed at, while one is: the preview is drawn from it. */
  let aim: Aim | null = null;
  /** The lens the page was made with, which every view but the room's keeps. */
  const lens = renderer.camera.fov;
  const look = (
    x: number,
    y: number,
    view: { azimuth?: number; polar?: number; radius?: number; z?: number; fov?: number },
  ) => {
    // the orbit moves the camera only while it is on, so it is on while the camera is put there, and as it was after
    const was = orbit.enabled;
    orbit.enabled = true;
    // the momentum of a drag is let die away first: left in, it carries the view past where it is put
    for (let i = 0; i < 40; i++) orbit.update();
    cam.target = [x, y, view.z ?? 0];
    cam.fov = view.fov ?? lens;
    orbit.setSpherical(view);
    for (let i = 0; i < 400; i++) orbit.update();
    orbit.enabled = was;
  };
  /** Whether a drag turns the camera: in look mode at the pond, and never in the room, where the bed's pillow is the one place to look from, nor while the screen fades. */
  const orbitOn = () =>
    !stillOpen &&
    game.place === 'pond' &&
    // the camera page frames the view whatever the mode, since a drag is all it asks of the player; the cabin's view holds
    ((orbits(mode) && viewName !== 'cabin') || (cameraOpen && viewName !== 'cabin'));
  /** The page's look: the time it is lit as, the view the camera was last put at, and the contamination the water was handed over at. */
  let time: TimeOfDay = nearestTime(game.timeOfDay, timesFor(seasonNow(), moonOf(game.day), weatherDressed));
  let viewName: ViewName = 'shore';
  /** Whether the screen was taller than wide when the camera was last put at a view. */
  let tall = false;
  let watered: number | null = null;
  /** How many times the water's groups have been handed over since boot: a count, for the test API. */
  let handovers = 0;
  /** The wait on `prepare` that is under way, if one is, and how many handovers have asked for one while it ran: see `prepared`. */
  let preparing: Promise<void> | null = null;
  let prepareAsked = 0;
  /** How many fish were cured when the fish's groups were last handed over, since their colour and glow go over only with the groups. */
  let curedDrawn = -1;
  /** The season's share of the fish's glow when their groups were last handed over; `dress` sets the season before it, in the same handover that a new day brings. */
  let glowDrawn = 1;
  /** The drums of waste, drawn on the bed, and how many were hauled when their groups were last handed over. */
  const drumDraw = new DrumDraw(lake);
  let hauledDrawn = -1;
  /** The junk treasures, on the bed or on their shelves, and how many were found when their groups were last handed over. */
  const treasureDraw = new TreasureDraw(lake);
  let foundDrawn = -1;
  /** The wall calendar's marks, and the day they were last handed over for, and how many handovers that has been. */
  const calendarDraw = lake.cabin ? new CalendarDraw(lake) : null;
  let dayDrawn = -1;
  let calendarHandovers = 0;
  /**
   * The moon's two discs, and the look, phase and season they were last handed over for (none before the first). They
   * are in the sky at the same place at both lakes, so only the look's name, the phase (the day's) and the season (whose
   * tint is in the shadow's sky colour) can change them; `showLight` hands them over again when one has, never a frame.
   */
  const moonDraw = new MoonDraw();
  const moonDrawn: { time: string; phase: number; season: Season | null; weather: Weather | null } = {
    time: '',
    phase: -1,
    season: null,
    weather: null,
  };
  /** The sun-shower's seven arcs, and the look and weather they were last handed over for (none before the first). */
  const rainbow = new RainbowDraw();
  const rainbowDrawn: { time: string; weather: Weather | null } = { time: '', weather: null };
  /** The map's pin, on the lake the save names, and the lake it was last handed over for (none before the first), and how many handovers that has been. */
  const mapDraw = lake.cabin ? new MapDraw(lake, Object.values(LAKES)) : null;
  let lakeDrawn = '';
  let mapHandovers = 0;
  /** The dirt the water is drawn at: the heal's value in whole steps, worked out here and nowhere else, so the groups and the uniforms never differ. */
  function waterShown(): number {
    return quantised(game.waterDirt, HEAL.step);
  }
  /** The water's finish and the rocks' paint, at the contamination, the time and the settings as they stand: uniforms, so written on any change and nothing recompiles. */
  function finish() {
    const water = style.clear(waterShown(), settings.caustics === 'on', time, seasonNow(), weatherDressed);
    rippleLife = water.ringLife ?? 0;
    renderer.look = { ...renderer.look, clear: water, paint: paintFor(settings.paint) };
  }
  /** Whether the sky's discs were written for another look, phase or season than the page is at. */
  const moonStale = () =>
    moonDrawn.time !== time.name ||
    moonDrawn.phase !== moonOf(game.day) ||
    moonDrawn.season !== seasonNow() ||
    moonDrawn.weather !== weatherDressed;
  /** Whether the sky's discs or the rainbow's arcs were written for another look, phase, season or weather than the page is at. */
  const skyStale = () => moonStale() || rainbowDrawn.time !== time.name || rainbowDrawn.weather !== weatherDressed;
  /** Whether the frost was written for another season or state of the lake than the page is at. */
  const frostStale = () => frost.shown() !== (seasonNow() === 'winter' && game.pondClean);
  /** The sky's two discs for the look and phase the page is at, and the key they were written for noted. */
  function moonGroups() {
    const phase = moonOf(game.day);
    moonDrawn.time = time.name;
    moonDrawn.phase = phase;
    moonDrawn.season = seasonNow();
    moonDrawn.weather = weatherDressed;
    const night = timesFor(seasonNow(), phase, weatherDressed).find((t) => t.name === 'night')!;
    // the sky low where the moon stands is mostly the horizon's colour, which the shadow must match to be unseen
    return moonDraw.groups(time.name, phase, { sky: mix(night.zenith, night.horizon, 0.85) });
  }
  /** The rainbow's arcs for the look and weather the page is at, and the key they were written for noted. */
  function rainbowGroups() {
    rainbowDrawn.time = time.name;
    rainbowDrawn.weather = weatherDressed;
    return rainbow.groups(time.name, weatherDressed);
  }
  /** Whether the boat's cover was written for another season or another state of the boat (aboard or not) than the page is at. */
  const boatStale = () => boatDraw.shown() !== (seasonNow() === 'winter' && !game.boat.aboard);
  /** The boat's groups, with the cover shown for winter with nobody aboard or scaled to nothing: the dynamic set's last. */
  function boatGroupsNow() {
    boatDraw.show(seasonNow(), game.boat.aboard);
    return boatDraw.groups();
  }
  /** The frost's group, written for winter and a clean lake or scaled to nothing. */
  function frostGroups() {
    frost.show(seasonNow(), game.pondClean);
    return frost.groups();
  }
  /** The water made as clear as the game says it is: its groups and the fish's handed over again when the contamination or the number of cured fish has changed, once a change and never once a frame. */
  async function showWater() {
    const cured = game.fish.curedCount();
    const hauled = game.drums.foundCount();
    const found = game.treasures.foundCount();
    const dirt = waterShown();
    if (
      watered !== dirt ||
      curedDrawn !== cured ||
      hauledDrawn !== hauled ||
      foundDrawn !== found ||
      dayDrawn !== game.day ||
      lakeDrawn !== game.progress.save.lake ||
      skyStale() ||
      frostStale() ||
      boatStale()
    ) {
      watered = dirt;
      curedDrawn = cured;
      hauledDrawn = hauled;
      foundDrawn = found;
      if (dayDrawn !== game.day) calendarHandovers++;
      // a new season is dressed at the wake, in the cabin, where nothing moves; a wake inside a season hands nothing over
      // and its four looks are baked for it, about 35 ms, with the page lit as the same time of day in the new season
      const next = seasonOf(game.day);
      const phase = moonOf(game.day);
      // a new phase re-lights the night, whose values moved; the cube is the full moon's, so nothing is baked for it
      if (next === dressing && phase !== phaseLit) {
        phaseLit = phase;
        void showLight(timesFor(next, phase, weatherDressed).find((t) => t.name === time.name) ?? time);
      }
      if (next !== dressing) phaseLit = phase;
      if (next !== dressing)
        void dress(next).then(() => {
          const began = performance.now();
          bakeLooks(ctx, next);
          bakeMs = performance.now() - began;
          return showLight(timesFor(next, moonOf(game.day), weatherDressed).find((t) => t.name === time.name) ?? time);
        });
      dayDrawn = game.day;
      if (lakeDrawn !== game.progress.save.lake) mapHandovers++;
      lakeDrawn = game.progress.save.lake;
      handovers++;
      // after `dress` above, which has set the season for a wake into a new one
      glowDrawn = SEASON_DRESSING[seasonNow()].glow;
      const water = style.groups(dirt, lake);
      fishSlot = water.length;
      // what floats rides the swells the water is drawn with, at the water's own pace
      game.surface = surfaceOf(
        style.wavesIn?.(seasonNow(), weatherDressed) ?? style.waves,
        MM_PER_UNIT,
        lake.waterPace,
      );
      // the drums and the treasures last, so the slots of the fish and the cast ahead of them are as they were
      const dynamic = [
        ...water,
        ...fish.groups(game.fish.cured, game.fish.kind, glowDrawn),
        ...casting.groups(),
        ...drumDraw.groups(game.drums),
        ...drumDraw.bank(game.drums),
        ...treasureDraw.groups(game.treasures),
        // the moon, after the drums and treasures so the slots ahead of it are as they were
        ...moonGroups(),
        // the calendar hangs in the home's cabin, and a lake with none has no wall to hang it on
        ...(calendarDraw
          ? calendarDraw.groups(game.day, { gone: ROOM_COLOURS.calendarGone, today: ROOM_COLOURS.calendarToday })
          : []),
        // and the map's pin, on the lake the save names (which a journey changes before the page is loaded afresh)
        ...(mapDraw ? mapDraw.groups(lakeDrawn, ROOM_COLOURS.mapPin) : []),
        // the rainbow last of all, so the slots of everything ahead of it are as they were
        ...rainbowGroups(),
        // and the frost after that, written for the season and the lake's state as they stand, so a change hands it over
        ...frostGroups(),
      ];
      // and the boat after that, its slot noted for the frame to move
      boatSlot = dynamic.length;
      dynamic.push(...boatGroupsNow());
      renderer.setDynamic(dynamic);
    }
    finish();
    await prepared();
  }
  /**
   * `renderer.prepare()` as one wait at a time: a handover made while one is under way (a heal's steps stepped faster
   * than the GPU settles, as the test API does) does not start a second, it asks for one more when the first ends, so
   * the frames queue nothing and the last handover is always the one waited on.
   */
  function prepared(): Promise<void> {
    if (preparing) {
      prepareAsked++;
      return preparing;
    }
    preparing = (async () => {
      let seen: number;
      do {
        seen = prepareAsked;
        await renderer.prepare();
      } while (prepareAsked !== seen);
    })().finally(() => {
      preparing = null;
    });
    return preparing;
  }
  /** The lake made as dirty as that, and the water drawn so. */
  async function setDirt(v: number) {
    game.setContamination(v);
    await showWater();
  }
  /** The light of the time of that name, which the game's clock is put at; one not known is refused. */
  async function setTime(name: string) {
    const to = timesFor(seasonNow(), moonOf(game.day), weatherDressed).find((t) => t.name === name);
    if (!to) return;
    game.setTimeOfDay(to.at);
    await showLight(to);
  }
  /**
   * The page lit as `to`: the look and the environment, and the water's finish with it, all set before the first wait,
   * so a frame that does not wait draws it; resolving once the pipelines are compiled.
   */
  async function showLight(to: TimeOfDay) {
    time = to;
    const lit = light(renderer, ctx, to, settings.paint, seasonNow());
    renderer.fog = fogFor(seasonNow(), to.name, MM_PER_UNIT, weatherDressed, game.place);
    finish();
    await lit;
    // the sky's discs follow the look's name, the phase and the season: handed over with the dynamic set, once a change
    if (skyStale()) return showWater();
    await renderer.prepare();
  }
  /**
   * The page dressed for the game's weather as it stands (`docs/weather.md`, part 3), at the lever's move and the wake's
   * new day: the wind, the falling ring and the particles' wind written, the page lit again with its sky and fog, and the
   * dynamic set handed over for the rainbow and the bobber's waves. Nothing is done if the weather is the one dressed.
   */
  async function showWeather() {
    if (weatherDressed === game.weather && rainbowDrawn.weather === weatherDressed) return;
    weatherDressed = game.weather;
    applyWeather();
    await showLight(timesFor(seasonNow(), moonOf(game.day), weatherDressed).find((t) => t.name === time.name) ?? time);
  }
  /** The camera put at the view of that name, even when it is the view already, so it is the way back from being turned away; one not known is refused. */
  async function setView(name: string, byMode = false) {
    if (!Object.hasOwn(lake.views, name)) return;
    viewName = name as ViewName;
    // a view picked, from the test API, is look mode unless it is the mode itself that picked it
    if (!byMode) showMode(nextMode(mode, 'view').mode);
    // the Shore view is framed for a phone on a screen taller than it is wide
    // aboard the boat the shore, phone and boat views are the seat's, turned to the way the boat points
    const v = framingFor(lake, viewName, width / height, game.boat.aboard ? game.anglerAt() : undefined);
    tall = height > width;
    look(v.x, v.y, v);
    aim = null;
    // look turns the camera by a drag in every view; cast holds it still behind the angler, where a drag aims
    orbit.enabled = orbitOn();
    await renderer.prepare();
  }
  // a screen turned on its side while the camera is held at the shore in cast mode is framed again, for the new shape;
  // in look mode the camera is the player's to have turned, and is left where it is
  addEventListener('resize', () => {
    if (mode === 'cast' && viewName === 'shore' && tall !== height > width) void setView('shore', true);
  });
  /** The caustics or the paint changed, as the test API asks. */
  async function setSettings(next: Partial<Settings>) {
    const was = settings;
    settings = changed(settings, next);
    // the paint is in the look's sets, so a change of it lights the page again; the caustics only change the water's finish
    if (was.paint !== settings.paint) await showLight(time);
    else {
      finish();
      await renderer.prepare();
    }
  }
  /** Look, where a drag turns the camera, or cast, where it aims a cast: the page starts by looking. */
  let mode: Mode = 'look';

  /**
   * The line on the screen that says what the lure is doing and what to do: waiting, a nibble, the bite, a fish on, or
   * that it lies on the bank; and for a while after a strike or a fish letting go, what that did.
   */
  let castText = '';
  function showCast() {
    // there is no line to speak of away from the pond: yawning and in the cabin it is brought in
    const text =
      game.place !== 'pond'
        ? ''
        : castWords({
            bite: game.bite.phase,
            lure: game.lure.phase,
            heard: game.t < heard.until ? heard.text : null,
            clean: game.pondClean,
            second: game.bite.second,
          });
    if (text === castText) return;
    castText = text;
    castLine.textContent = text;
    castLine.hidden = !text;
  }

  // the gesture rules are src/gesture.ts's; the page turns its events into theirs and does what is the page's own: the
  // pointer capture, the camera and the picking of a point on the water
  const tapInverse = new Float32Array(16);
  /** Whether the tap at the page's point (`x`, `y`) falls on the map on the cabin's wall: the ray through it, to the paper's rectangle. */
  const tappedMap = (x: number, y: number): boolean => {
    cam.update();
    if (!invertInto(tapInverse, cam.viewProjection)) return false;
    const box = canvas.getBoundingClientRect();
    return mapHit(((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2, tapInverse, lake);
  };
  /** Whether the tap at the page's point (`x`, `y`) falls on the table in the cabin, where the post lies. */
  const tappedTable = (x: number, y: number): boolean => {
    cam.update();
    if (!invertInto(tapInverse, cam.viewProjection)) return false;
    const box = canvas.getBoundingClientRect();
    return tableHit(((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2, tapInverse, lake);
  };
  /** Whether the player is at the pond, where the game runs and the rod is theirs. */
  const atPond = () => game.place === 'pond';
  /** Whether the tap at the page's point (`x`, `y`) falls on the cabin from the shore: the ray through it, to the cabin's box. */
  const tappedCabin = (x: number, y: number): boolean => {
    cam.update();
    if (!invertInto(tapInverse, cam.viewProjection)) return false;
    const box = canvas.getBoundingClientRect();
    return cabinHit(((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2, tapInverse, lake);
  };
  /**
   * Whether a page holds the game still: the menu's list, the journal, the camera, a photograph looked at, the lakes page, the Start again question or the pairing card.
   * While one is open the clock does not run and no key, tap, button or phone gesture reaches the game, only letting go.
   */
  const pagesOpen = () =>
    journalOpen ||
    cameraOpen ||
    stillOpen ||
    postOpen ||
    lakesOpen ||
    sleepOpen ||
    !menuList.hidden ||
    !startAgain.hidden ||
    !byId('pairing').hidden;
  /** What a page open still lets through: a hold ending is always heard, or a reel would stay held under it. */
  const LETTING_GO: ReadonlySet<string> = new Set(['up', 'cancel', 'release', 'blur', 'left-cast', 'gone']);
  /** Every way of playing comes in here, so one gate keeps them all out while a page is open. */
  const gestureHeard = (e: GestureEvent) => {
    if (pagesOpen() && !LETTING_GO.has(e.type)) return;
    gestures.handle(e);
  };
  /** A page has opened over a game that may have a reel held: it is let go, as the window losing the focus lets it go. */
  const letGoOfReel = () => {
    gestures.handle({ type: 'blur' });
    gestures.handle({ type: 'release', source: 'button' });
  };
  const gestures = new Gesture(
    {
      // away from the pond (yawning, or in the cabin) the player can do nothing with the rod: a cast, a strike, a reel, an
      // aim, a pebble and a call for cast mode are each let go unanswered, which a paired phone's are too, and nothing
      // is told back; only letting go (a reel off, an aim cleared) is always heard
      cast: (angle, power) => {
        if (atPond()) game.cast(angle, power);
      },
      strike: () => {
        if (atPond()) game.strike();
      },
      reel: (on) => {
        if (!on || atPond()) game.reel(on);
      },
      setAim: (to) => {
        if (to === null || atPond()) aim = to;
      },
      // a short tap on the water drops a pebble where it was tapped; a drag turns the camera, and drops nothing
      pebble: (x, y) => {
        // in the cabin a tap on the map opens the lakes page, a tap on the table the post, and a tap anywhere else does nothing
        if (game.place === 'cabin' && viewName === 'cabin') {
          if (tappedMap(x, y)) void openLakes();
          else if (tappedTable(x, y)) void openPost();
          return;
        }
        if (!atPond()) return;
        // in look mode a tap on the cabin walks in, and drops no pebble; cast mode's tap is a strike, never here
        if (mode === 'look' && tappedCabin(x, y)) {
          void enterCabin();
          return;
        }
        cam.update();
        if (!invertInto(tapInverse, cam.viewProjection)) return;
        const box = canvas.getBoundingClientRect();
        const at = waterPoint(tapInverse, ((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2);
        // row mode's tap rows to the water it falls on, and lands from anywhere off it (the bank, the cabin, the sky); a
        // refusal (too near the shore, across the jetty, a fish on) says nothing and leaves the mode, a row begun
        // leaves it for look through the `rowed` event
        if (mode === 'row') {
          if (at && lake.inside(at[0], at[1])) game.row(at[0], at[1]);
          else game.land();
          return;
        }
        if (at) game.drop(at[0], at[1]);
      },
      mode: () => mode,
      bitePhase: () => game.bite.phase,
      lurePhase: () => game.lure.phase,
      rowing: () => game.boat.rowing,
      view: () => {
        const box = canvas.getBoundingClientRect();
        return {
          short: Math.min(box.width, box.height),
          heading: Math.atan2(cam.target[1] - cam.position[1], cam.target[0] - cam.position[0]),
        };
      },
      // a phone's first gesture, in look mode, puts the page in cast mode at the Shore view
      wantCast: () => {
        if (atPond()) void setMode('cast');
      },
    },
    PHONE,
  );
  // ---- the phone ----

  // which link the pairing opens: the real one unless the address asks for the tests' local one, and a value not known
  // is refused by name. The pairing's code (the QR library, Trystero, the rules for the one phone) is fetched when Pair
  // a phone is first pressed and never to boot, so the page keeps only the overlay it is handed.
  const phoneLink = readPhoneLink(query);
  if (phoneLink.refusal) console.warn(phoneLink.refusal);
  let pairing: Promise<PairingOverlay> | null = null;
  /** The overlay once its code has loaded, for the test API to read; null until Pair a phone has been pressed. */
  let overlay: PairingOverlay | null = null;
  /** Shows the pairing overlay, loading its code the first time; `fixed` is the test API's, for a still picture. */
  async function openPairing(fixed?: { room: string; key: string; origin?: string }) {
    pairing ??= import('./phone/pairing').then(
      ({ PairingOverlay }) =>
        new PairingOverlay({
          elements: {
            overlay: byId('pairing'),
            qr: byId<HTMLCanvasElement>('pairingQr'),
            address: byId('pairingAddress'),
            status: byId('pairingStatus'),
            close: byId<HTMLButtonElement>('pairingClose'),
          },
          handle: gestureHeard,
          origin: __PHONE_ORIGIN__ || location.origin,
          link: phoneLink.link,
          game: () => game,
          stateHz: PHONE.stateHz,
          // a status of its own and not the cast line, which is rewritten every frame by what the lure is doing and
          // would hide "the phone left" in the middle of a fight, when it matters most
          said: (text) => {
            phoneStatus.textContent = text;
            phoneStatus.hidden = false;
          },
        }),
    );
    overlay = await pairing;
    await overlay.open(fixed);
    letGoOfReel();
  }

  // what not every player wants is behind the corner's button: it opens a short list, and a choice from it, a click
  // anywhere else or Escape closes it again
  const menuButton = byId<HTMLButtonElement>('menuButton');
  const menuList = byId('menuList');
  const showMenu = (open: boolean) => {
    menuList.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) letGoOfReel();
  };
  menuButton.addEventListener('click', () => showMenu(menuList.hidden));
  byId('pairButton').addEventListener('click', () => {
    showMenu(false);
    void openPairing();
  });

  // Go to bed is the day's end at once, from the pond or the cabin, with no question since nothing is lost; the game
  // refuses it with a fish on the line or landed, and the item is greyed then (`NightView`)
  byId('bedButton').addEventListener('click', () => {
    showMenu(false);
    game.sleep();
  });
  // Down to the pond, from the cabin: the clock runs on from dawn, the page looks, and the camera is at the Shore view
  async function goOut(): Promise<boolean> {
    if (!game.out()) return false;
    showMode('look');
    await setView('shore', true);
    return true;
  }
  byId('downButton').addEventListener('click', () => void goOut());
  // Go to the cabin, by day: at home the player walks in with the clock held and the camera at the pillow; anywhere
  // else it is the journey home, landing in the cabin (the game refuses it mid-fight, and the item is greyed then)
  async function enterCabin(): Promise<boolean> {
    if (lake.id !== HOME.id) return travelTo(HOME.id, 'cabin');
    if (!game.enter()) return false;
    showMode('look');
    letGoOfReel();
    await setView('cabin', true);
    return true;
  }
  byId('cabinButton').addEventListener('click', () => {
    showMenu(false);
    void enterCabin();
  });
  // Travel is a reload: the game refuses it mid-fight or for a lake it does not know, reels the lure in, writes the save
  // naming the lake and fades the screen out, and the page is loaded afresh at the end of the fade (`left`). To the lake
  // the player is at it goes out from the cabin, as the button does, and is nothing at the pond.
  async function travelTo(id: string, into: 'pond' | 'cabin' = 'pond'): Promise<boolean> {
    if (id === lake.id && game.place === 'cabin' && into === 'pond') return goOut();
    if (!game.travel(id, into)) return false;
    if (game.place === 'leaving') {
      showMode('look');
      aim = null;
      letGoOfReel();
    }
    return true;
  }
  // Start again asks first, in a small dialog of the page's own. Keep playing is focused so a stray Enter keeps
  // playing; Keep playing, Escape or a click outside the card close it and change nothing, and Start again has the
  // save wiped by the progress itself (the page decides nothing about it) and the page loaded afresh.
  const startAgain = byId('startAgain');
  const keepPlaying = byId<HTMLButtonElement>('startAgainKeep');
  /** Start again has wiped the save, so nothing is written again before the page is loaded afresh. */
  let wiped = false;
  const openStartAgain = () => {
    showMenu(false);
    startAgain.hidden = false;
    letGoOfReel();
    keepPlaying.focus();
    return Promise.resolve();
  };
  const closeStartAgain = () => {
    startAgain.hidden = true;
    menuButton.focus();
  };
  byId('startAgainButton').addEventListener('click', () => void openStartAgain());
  keepPlaying.addEventListener('click', closeStartAgain);
  startAgain.addEventListener('pointerdown', (e) => {
    if (e.target === startAgain) closeStartAgain();
  });
  byId('startAgainConfirm').addEventListener('click', () => {
    // the reload's own leaving event must not write the clock back over the wiped save
    wiped = true;
    game.progress.reset();
    location.reload();
  });

  // The journal is a page of the same kind over the game, written from `journalWords` each time it is opened and not
  // on a frame. While it is open the page does not step the game (a frame of its own or a step a test asks for), so
  // game time holds, as `DESIGN.md` says of the journal; it keeps drawing, and no key or tap reaches the game.
  const journalPage = byId('journal');
  const journalKinds = byId('journalKinds');
  const journalDrums = byId('journalDrums');
  const journalFound = byId('journalFound');
  const journalFoundCount = byId('journalFoundCount');
  const journalLogbook = byId('journalLogbook');
  const journalLogbookCount = byId('journalLogbookCount');
  const journalClose = byId<HTMLButtonElement>('journalClose');
  const journalAlbum = byId('journalAlbum');
  let journalOpen = false;
  let cameraOpen = false;
  let stillOpen = false;
  let stillIndex = -1;
  // a photograph looked at is the camera page's kind of page (`lookAtPhoto`, below), from the journal's Look button
  const lookAt = (index: number): Promise<boolean> => lookAtPhoto(index);
  // The album's rows, written from `albumWords`: Look only where `here`, Discard always. Discarding rewrites the rows
  // and the count in place, so the page stays open for the next.
  const writeAlbum = (album: ReturnType<typeof albumWords>) => {
    byId('journalAlbumTitle').textContent = album.title;
    byId('journalAlbumCount').textContent = album.count;
    journalAlbum.replaceChildren(
      ...album.rows.map((row) => {
        const item = document.createElement('li');
        const words = document.createElement('span');
        words.textContent = row.words;
        item.append(words);
        if (row.here) {
          const look = document.createElement('button');
          look.type = 'button';
          look.textContent = 'Look';
          look.dataset.look = String(row.index);
          item.append(look);
        }
        const discard = document.createElement('button');
        discard.type = 'button';
        discard.textContent = 'Discard';
        discard.dataset.discard = String(row.index);
        item.append(discard);
        return item;
      }),
    );
  };
  journalAlbum.addEventListener('click', (e) => {
    const button = (e.target as Element).closest('button');
    if (!button) return;
    if (button.dataset.look !== undefined) void lookAt(Number(button.dataset.look));
    else if (button.dataset.discard !== undefined) {
      game.discard(Number(button.dataset.discard));
      writeAlbum(albumWords(game.progress.save.photos, LAKES, lake.id, KINDS, hourName));
    }
  });
  const openJournal = () => {
    showMenu(false);
    const page = journalWords(
      game.progress.entry(lake.id).journal,
      KINDS,
      game.drums.foundCount(),
      lake.drums.count,
      lake.treasures.list,
      game.progress.entry(lake.id).found,
      lake === HOME ? null : lake.name,
      logbookWords(LAKES, game.progress.save),
      albumWords(game.progress.save.photos, LAKES, lake.id, KINDS, hourName),
    );
    byId('journalTitle').textContent = page.title;
    byId('journalFoundTitle').textContent = page.foundTitle;
    journalKinds.replaceChildren(
      ...page.rows.map((row) => {
        const item = document.createElement('li');
        const name = document.createElement('b');
        const words = document.createElement('span');
        name.textContent = row.name;
        words.textContent = row.words;
        if (row.caught) item.className = 'caught';
        item.append(name, words);
        if (row.fact) {
          const fact = document.createElement('small');
          fact.textContent = row.fact;
          item.append(fact);
        }
        return item;
      }),
    );
    journalDrums.textContent = page.drums;
    journalFoundCount.textContent = page.found;
    journalFound.replaceChildren(
      ...page.treasures.map((row) => {
        const item = document.createElement('li');
        const name = document.createElement('b');
        name.textContent = row.name;
        if (row.found) item.className = 'caught';
        item.append(name);
        if (row.note) {
          const note = document.createElement('span');
          note.textContent = row.note;
          item.append(note);
        }
        return item;
      }),
    );
    byId('journalLogbookTitle').textContent = page.logbook.title;
    journalLogbookCount.textContent = page.logbook.found;
    journalLogbook.replaceChildren(
      ...page.logbook.rows.map((row) => {
        const item = document.createElement('li');
        const name = document.createElement('b');
        const words = document.createElement('span');
        name.textContent = `Page ${row.page}`;
        words.textContent = row.words;
        if (row.found) item.className = 'caught';
        item.append(name, words);
        return item;
      }),
    );
    writeAlbum(page.album);
    journalPage.hidden = false;
    journalOpen = true;
    letGoOfReel();
    journalClose.focus();
    return Promise.resolve();
  };
  const closeJournal = () => {
    if (!journalOpen) return Promise.resolve();
    journalPage.hidden = true;
    journalOpen = false;
    menuButton.focus();
    return Promise.resolve();
  };
  byId('journalButton').addEventListener('click', () => void openJournal());
  journalClose.addEventListener('click', () => void closeJournal());
  journalPage.addEventListener('pointerdown', (e) => {
    if (e.target === journalPage) void closeJournal();
  });
  // The post is the journal's kind of page, written from `postWords` each time it is opened: a letter each, who it is
  // from over it and, once answered, the reply under it. It opens from the menu and from a tap on the cabin's table.
  const postPage = byId('post');
  const postList = byId('postList');
  const postClose = byId<HTMLButtonElement>('postClose');
  let postOpen = false;
  const openPost = () => {
    showMenu(false);
    if (postOpen) return Promise.resolve();
    const page = postWords(REQUESTS, game.progress.save, LAKES);
    byId('postTitle').textContent = page.title;
    postList.replaceChildren(
      ...page.letters.map((letter) => {
        const item = document.createElement('li');
        const heading = document.createElement('b');
        const body = document.createElement('p');
        heading.textContent = letter.heading;
        body.textContent = letter.body;
        item.append(heading, body);
        if (letter.progress !== null) {
          const progress = document.createElement('small');
          progress.className = 'progress';
          progress.textContent = letter.progress;
          item.append(progress);
        }
        if (letter.reply !== null) {
          const reply = document.createElement('p');
          reply.className = 'reply';
          reply.textContent = letter.reply;
          item.className = 'answered';
          item.append(reply);
        }
        return item;
      }),
    );
    postPage.hidden = false;
    postOpen = true;
    letGoOfReel();
    postClose.focus();
    return Promise.resolve();
  };
  const closePost = () => {
    if (!postOpen) return Promise.resolve();
    postPage.hidden = true;
    postOpen = false;
    menuButton.focus();
    return Promise.resolve();
  };
  byId('postButton').addEventListener('click', () => void openPost());
  postClose.addEventListener('click', () => void closePost());
  postPage.addEventListener('pointerdown', (e) => {
    if (e.target === postPage) void closePost();
  });
  // The lakes page is the journal's kind of page, written from `lakesWords` each time it is opened: a row a lake with
  // where the player is, how much of its glow is left in words, and the button that goes there (Out to the lake, from
  // the cabin, for the lake the player is at). A choice closes the page and then travels, so the clock has started
  // again when the journey does; it opens from the map's tap, the menu's Lakes and Somewhere else…, in the cabin and
  // at the pond both.
  const lakesPage = byId('lakes');
  const lakesList = byId('lakesList');
  const lakesClose = byId<HTMLButtonElement>('lakesClose');
  let lakesOpen = false;
  function openLakes(): Promise<void> {
    showMenu(false);
    // the yawn and the fade of a journey are no time for it
    if (lakesOpen || (game.place !== 'pond' && game.place !== 'cabin')) return Promise.resolve();
    // a journey starts from the shore: aboard the boat Go is greyed as it is with a fish on, since the game refuses it
    const fighting = game.bite.phase === 'hooked' || game.bite.phase === 'landed' || game.boat.aboard;
    const rows = lakesWords(Object.values(LAKES), game.progress.save, game.progress.save.lake, {
      inCabin: game.place === 'cabin',
      fighting,
    });
    lakesList.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement('li');
        const words = document.createElement('div');
        const name = document.createElement('b');
        name.textContent = row.name;
        words.append(name);
        if (row.here) {
          const here = document.createElement('span');
          here.className = 'where';
          here.textContent = YOU_ARE_HERE;
          words.append(here);
        }
        const glow = document.createElement('span');
        glow.textContent = row.glow;
        words.append(glow);
        item.append(words);
        if (row.here) item.className = 'here';
        if (row.button) {
          const go = document.createElement('button');
          go.type = 'button';
          go.textContent = row.button;
          go.disabled = !row.enabled;
          if (row.label) go.setAttribute('aria-label', row.label);
          go.dataset.lake = row.id;
          item.append(go);
        }
        return item;
      }),
    );
    lakesPage.hidden = false;
    lakesOpen = true;
    letGoOfReel();
    (lakesList.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? lakesClose).focus();
    return Promise.resolve();
  }
  const closeLakes = () => {
    if (!lakesOpen) return Promise.resolve();
    lakesPage.hidden = true;
    lakesOpen = false;
    menuButton.focus();
    return Promise.resolve();
  };
  byId('lakesButton').addEventListener('click', () => void openLakes());
  byId('elsewhereButton').addEventListener('click', () => void openLakes());
  lakesClose.addEventListener('click', () => void closeLakes());
  lakesPage.addEventListener('pointerdown', (e) => {
    if (e.target === lakesPage) void closeLakes();
  });
  lakesList.addEventListener('click', (e) => {
    const go = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[data-lake]') : null;
    if (!go || go.disabled) return;
    const id = go.dataset.lake!;
    void closeLakes().then(() => travelTo(id));
  });
  // The sleep page is the lakes page's kind, written from `sleepWords` each time it opens: a button a marked night. A
  // choice closes the page and then sleeps through, so the game's yawn (`yawned`, which puts the page in look mode and
  // drops an aim) is what any bed is. It opens from the menu's Sleep through…, at the pond and in the cabin, and is
  // held off with a fish on the line (the item is greyed by `NightView` and the buttons here are).
  const sleepPage = byId('sleep');
  const sleepList = byId('sleepList');
  const sleepClose = byId<HTMLButtonElement>('sleepClose');
  let sleepOpen = false;
  function openSleep(): Promise<void> {
    showMenu(false);
    if (sleepOpen || (game.place !== 'pond' && game.place !== 'cabin')) return Promise.resolve();
    const fighting = game.bite.phase === 'hooked' || game.bite.phase === 'landed';
    sleepList.replaceChildren(
      ...sleepWords(game.day, fighting).map((row) => {
        const item = document.createElement('li');
        const go = document.createElement('button');
        go.type = 'button';
        go.textContent = row.label;
        go.disabled = !row.enabled;
        go.dataset.nights = String(row.nights);
        item.append(go);
        return item;
      }),
    );
    sleepPage.hidden = false;
    sleepOpen = true;
    letGoOfReel();
    (sleepList.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? sleepClose).focus();
    return Promise.resolve();
  }
  const closeSleep = () => {
    if (!sleepOpen) return Promise.resolve();
    sleepPage.hidden = true;
    sleepOpen = false;
    menuButton.focus();
    return Promise.resolve();
  };
  byId('sleepButton').addEventListener('click', () => void openSleep());
  sleepClose.addEventListener('click', () => void closeSleep());
  sleepPage.addEventListener('pointerdown', (e) => {
    if (e.target === sleepPage) void closeSleep();
  });
  sleepList.addEventListener('click', (e) => {
    const go = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button[data-nights]') : null;
    if (!go || go.disabled) return;
    const nights = Number(go.dataset.nights);
    void closeSleep().then(() => game.sleepThrough(nights));
  });

  // The camera is a page that holds the game and hides the overlays (`html[data-camera]`) under a viewfinder, while the
  // lake keeps drawing. The orbit is driven by the canvas's own pointer events, which no page blocks, so a drag and the
  // wheel frame the view; the gesture gate keeps a tap from dropping a pebble or striking. Done leaves the view as framed
  // (the mode, the overlays and the orbit's flag are the page's again), and Take keeps the figures of what is in frame.
  const cameraPage = byId('camera');
  const cameraLine = byId('cameraLine');
  const cameraButton = byId<HTMLButtonElement>('cameraButton');
  const stillPage = byId('still');
  const stillLine = byId('stillLine');
  const stillBack = byId<HTMLButtonElement>('stillBack');
  const fighting = () => game.bite.phase === 'hooked' || game.bite.phase === 'landed';
  /** The viewfinder's line: the day, the hour and the lake, or what the last Take said, until the view is moved. */
  const writeCameraLine = (said?: string) => {
    cameraLine.textContent = said ?? photoLine({ lake: lake.id, day: game.day, time: game.timeOfDay }, LAKES, hourName);
  };
  function openCamera(): Promise<void> {
    showMenu(false);
    if (cameraOpen || pagesOpen()) return Promise.resolve();
    if ((game.place !== 'pond' && game.place !== 'cabin') || fighting()) return Promise.resolve();
    letGoOfReel();
    document.documentElement.dataset.camera = '';
    writeCameraLine();
    cameraPage.hidden = false;
    cameraOpen = true;
    orbit.enabled = orbitOn();
    byId('cameraTake').focus();
    return Promise.resolve();
  }
  function closeCamera(): Promise<void> {
    if (!cameraOpen) return Promise.resolve();
    delete document.documentElement.dataset.camera;
    cameraPage.hidden = true;
    cameraOpen = false;
    orbit.enabled = orbitOn();
    menuButton.focus();
    return Promise.resolve();
  }
  /** The photograph of what is in frame now: the fish whose bodies the camera sees, and whether the look is night. */
  function takePhoto(): boolean {
    if (!cameraOpen) return false;
    cam.update();
    const { fish: school } = game;
    const kinds: string[] = [];
    for (let i = 0; i < school.count; i++) {
      if (!inFrame(cam.viewProjection, cam.position, school.x[i], school.y[i], -school.depth[i], PHOTOS.reach))
        continue;
      const id = KINDS[school.kind[i]].id;
      if (!kinds.includes(id)) kinds.push(id);
    }
    const view = {
      x: cam.target[0],
      y: cam.target[1],
      z: cam.target[2],
      azimuth: orbit.currentAzimuth,
      polar: orbit.currentPolar,
      radius: orbit.distance,
    };
    // the toast is hidden under the camera, so the viewfinder's own line says it, until the view is moved again
    if (game.photograph({ view, kinds, lit: time.name === 'night' })) {
      pond.photographed();
      writeCameraLine('Photographed!');
      return true;
    }
    pond.albumFull();
    writeCameraLine('The album is full.');
    return false;
  }
  cameraButton.addEventListener('click', () => void openCamera());
  byId('cameraTake').addEventListener('click', () => void takePhoto());
  byId('cameraDone').addEventListener('click', () => void closeCamera());
  // a view moved, or a wheel turned, puts the line back to the day and the place
  canvas.addEventListener('pointerdown', () => cameraOpen && writeCameraLine());
  canvas.addEventListener('wheel', () => cameraOpen && writeCameraLine(), { passive: true });

  // A photograph looked at is the lake drawn again at its camera, its hour and its weather, with the grain held at one
  // moment so the still is the same frame whenever it is drawn (`draw` writes the renderer's clock each frame). What
  // was there is kept to put back; the clock and the weather are put only at the pond, since the cabin's light is the
  // lamp's and its clock holds.
  let before: {
    target: [number, number, number];
    azimuth: number;
    polar: number;
    radius: number;
    fov: number;
    orbitEnabled: boolean;
    postClock: number;
    journal: boolean;
  } | null = null;
  const showClock = () =>
    showLight(nearestTime(game.timeOfDay, timesFor(seasonNow(), moonOf(game.day), weatherDressed)));
  async function lookAtPhoto(index: number): Promise<boolean> {
    const photo = game.progress.save.photos.at(index);
    if (!photo || stillOpen || cameraOpen) return false;
    if (pagesOpen() && !journalOpen) return false;
    if (!game.lookAt(index)) return false;
    before = {
      target: [cam.target[0], cam.target[1], cam.target[2]],
      azimuth: orbit.currentAzimuth,
      polar: orbit.currentPolar,
      radius: orbit.distance,
      fov: cam.fov,
      orbitEnabled: orbit.enabled,
      postClock: renderer.postClock,
      journal: journalOpen,
    };
    await closeJournal();
    letGoOfReel();
    // held first, so nothing steps while the lake is dressed for the photograph
    stillOpen = true;
    stillIndex = index;
    document.documentElement.dataset.camera = '';
    stillLine.textContent = photoWords(photo, LAKES, KINDS, hourName);
    stillPage.hidden = false;
    const v = photo.view;
    look(v.x, v.y, { z: v.z, azimuth: v.azimuth, polar: v.polar, radius: v.radius, fov: cam.fov });
    orbit.enabled = false;
    renderer.postClock = PHOTOS.grain;
    // the game has put the weather and the clock to the photograph's; the page shows what it now says
    if (game.place === 'pond') {
      await showWeather();
      await showClock();
    }
    stillBack.focus();
    return true;
  }
  async function lookAway(): Promise<void> {
    if (!stillOpen || !before) return;
    const was = before;
    before = null;
    stillPage.hidden = true;
    delete document.documentElement.dataset.camera;
    renderer.postClock = was.postClock;
    game.lookAway();
    if (game.place === 'pond') {
      await showWeather();
      await showClock();
    }
    look(was.target[0], was.target[1], {
      z: was.target[2],
      azimuth: was.azimuth,
      polar: was.polar,
      radius: was.radius,
      fov: was.fov,
    });
    stillOpen = false;
    stillIndex = -1;
    orbit.enabled = orbitOn() && was.orbitEnabled;
    if (was.journal) await openJournal();
  }
  stillBack.addEventListener('click', () => void lookAway());
  document.addEventListener('pointerdown', (e) => {
    if (!menuList.hidden && e.target instanceof Node && !byId('menu').contains(e.target)) showMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stillOpen) {
      void lookAway();
      return;
    }
    if (e.key === 'Escape' && cameraOpen) {
      void closeCamera();
      return;
    }
    if (e.key === 'Escape' && journalOpen) {
      void closeJournal();
      return;
    }
    if (e.key === 'Escape' && postOpen) {
      void closePost();
      return;
    }
    if (e.key === 'Escape' && lakesOpen) {
      void closeLakes();
      return;
    }
    if (e.key === 'Escape' && sleepOpen) {
      void closeSleep();
      return;
    }
    if (e.key === 'Escape' && !startAgain.hidden) {
      closeStartAgain();
      return;
    }
    if (e.key === 'Escape' && !menuList.hidden) {
      showMenu(false);
      menuButton.focus();
    }
  });

  const pointer = (type: PointerGesture['type'], e: PointerEvent): PointerGesture => ({
    type,
    source: 'screen',
    x: e.clientX,
    y: e.clientY,
    at: e.timeStamp,
  });
  canvas.addEventListener('pointerdown', (e) => {
    // in cast mode the pointer is captured, so a drag or a hold that leaves the canvas still ends on it
    if (mode === 'cast') canvas.setPointerCapture(e.pointerId);
    gestureHeard(pointer('down', e));
  });
  canvas.addEventListener('pointermove', (e) => gestureHeard(pointer('move', e)));
  canvas.addEventListener('pointercancel', (e) => gestureHeard(pointer('cancel', e)));
  canvas.addEventListener('pointerup', (e) => gestureHeard(pointer('up', e)));
  // space strikes, and held with a fish on, reels, in any view; let go, the fish takes line. C switches between look
  // and cast. Neither over the page's own buttons, where the key is only what it presses
  const onControl = (e: KeyboardEvent) =>
    pagesOpen() ||
    (e.target instanceof HTMLElement &&
      e.target.closest(
        '#catch, #modeButton, #rowButton, #anchorButton, #downButton, #elsewhereButton, #pairing, #startAgain, #menu',
      ) !== null);
  window.addEventListener('keydown', (e) => {
    // Enter brings the player down from the cabin, as the button does
    if (e.key === 'Enter' && !e.repeat && game.place === 'cabin' && !onControl(e)) {
      void goOut();
      return;
    }
    if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !onControl(e)) {
      void setMode('toggle');
      return;
    }
    if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !onControl(e)) {
      void setMode('row');
      return;
    }
    if (e.code === 'KeyA' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !onControl(e)) {
      toggleAnchor();
      return;
    }
    if (e.code === 'KeyP' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !onControl(e)) {
      void openCamera();
      return;
    }
    if (e.code !== 'Space' || onControl(e)) return;
    e.preventDefault();
    gestureHeard({ type: 'press', source: 'key', repeat: e.repeat });
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') gestures.handle({ type: 'release', source: 'key' });
  });
  // a reel held when the page loses the focus is let go, or the zone would ride up unseen while the fish got away
  window.addEventListener('blur', () => gestures.handle({ type: 'blur' }));
  /** Where a point of the lake is on the screen, in the page's pixels, or null behind the camera. */
  function toScreen(x: number, y: number, z: number) {
    cam.update();
    const m = cam.viewProjection;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) return null;
    const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    const box = canvas.getBoundingClientRect();
    return { x: box.left + ((nx + 1) / 2) * box.width, y: box.top + ((1 - ny) / 2) * box.height };
  }
  const fightView = new FightView(
    {
      gauge: byId('gauge'),
      zone: byId('gaugeZone'),
      fish: byId<SVGSVGElement>('gaugeFish'),
      mark: byId('biteMark'),
      meter: byId('gaugeMeter'),
      meterFill: byId('gaugeMeterFill'),
      words: byId('gaugeWords'),
      button: byId<HTMLButtonElement>('reelButton'),
      card: byId<HTMLButtonElement>('catch'),
      name: byId('catchName'),
      weight: byId('catchWeight'),
      hint: byId('catchHint'),
      about: byId('catchAbout'),
      note: byId('catchNote'),
      bucket: byId('bucket'),
    },
    () => game,
    toScreen,
    gestureHeard,
    lake,
  );

  const pond = new PondView(
    {
      gauge: byId('pond'),
      name: byId('pondName'),
      bar: byId('pondBar'),
      gone: byId('pondBarGone'),
      welcome: byId('welcome'),
      welcomeLine: byId('welcomeLine'),
      toast: byId('toast'),
    },
    () => game,
    HEARD_FOR,
    lake,
  );

  const night = new NightView(
    {
      fade: byId('night'),
      yawn: byId('yawn'),
      morning: byId('morning'),
      radio: byId('radio'),
      down: byId('downButton'),
      elsewhere: byId('elsewhereButton'),
      bed: byId<HTMLButtonElement>('bedButton'),
      camera: byId<HTMLButtonElement>('cameraButton'),
      sleep: byId<HTMLButtonElement>('sleepButton'),
      cabin: byId<HTMLButtonElement>('cabinButton'),
    },
    () => game,
    () => nearestTime(game.timeOfDay, timesFor(seasonNow(), moonOf(game.day), weatherDressed)).name,
  );
  const hud = byId('hud');
  /** Whether the Cast button and its hint are hidden, which they are away from the pond. */
  let hudAway = false;

  /** The page in a mode, its button and hint saying so: the camera is the caller's, as `nextMode` says. */
  function showMode(to: Mode) {
    if (to !== 'cast') {
      // leaving cast drops an aim begun, and a reel held by the screen
      gestures.handle({ type: 'left-cast' });
    }
    mode = to;
    orbit.enabled = orbitOn();
    const words = wording(mode);
    modeButton.textContent = words.button;
    rowButton.textContent = rowWording(mode).button;
    help.textContent = words.hint;
  }
  /** A mode event: the mode it makes, and the camera put at the shore if it says so, resolving once that is ready. */
  async function setMode(event: ModeEvent) {
    // there is no casting away from the pond: C and the test API's mode are let go there
    if (!atPond() || pagesOpen()) return;
    // the boat is rowed or it is not: the Cast and Row buttons are greyed while it is, and the keys are let go with them;
    // a lake with no boat has no row to ask for
    if (game.boat.rowing && event !== 'view' && event !== 'done' && event !== 'look') return;
    if (event === 'row' && !lake.boat) return;
    const step = nextMode(mode, event);
    showMode(step.mode);
    if (step.camera === 'shore') await setView('shore', true);
  }
  modeButton.addEventListener('click', () => void setMode('toggle'));
  rowButton.addEventListener('click', () => void setMode('row'));
  /** The anchor weighed or dropped, as the button and the A key ask; the game refuses ashore, rowing and away. */
  function toggleAnchor() {
    if (!atPond() || pagesOpen()) return;
    game.anchor(!game.boat.anchored);
    showAnchor();
  }
  anchorButton.addEventListener('click', toggleAnchor);
  /** The Anchor button from the game's state: shown only aboard, greyed while rowing, worded for what it does next; each written on change only. */
  function showAnchor() {
    const aboard = !!lake.boat && game.boat.aboard;
    if (anchorButton.hidden === aboard) anchorButton.hidden = !aboard;
    const rowing = game.boat.rowing;
    if (anchorButton.disabled !== rowing) anchorButton.disabled = rowing;
    const words = anchorWording(game.boat.anchored);
    if (anchorButton.textContent !== words) anchorButton.textContent = words;
  }

  await setDirt(game.contamination);
  await showLight(time);
  await setView('shore', true);

  /** Each frame: the fish where they are, glowing under the water, the splashes' ripples in it, and the cast. */
  const writeFrame = () => {
    // the cast first, which says where a landed fish hangs; then the fish, that one hanging there
    const drawn = casting.write(game, aim);
    const hung = drawn.hung ? game.bite.fish : -1;
    const swimming = fish.write(game.fish, hung, casting.hang, game.t);
    // at night at the pond the lamp eels are lights, on the full rung only, as the grass is; the renderer copies the
    // live lights (a few floats each) on each handover, so a frame while they are lit pays that and one going dark pays it once
    if (eelLights.write(game.fish, game.place === 'pond' && time.name === 'night' && rung === 'full', lights))
      renderer.setLights(lights);
    const parts = fish.drawn;
    for (let p = 0; p < parts.length; p++) renderer.move(fishSlot + p, parts[p], swimming);
    rippling = rippleData(game.splashes, game.t, rippleLife, ripples);
    renderer.setRings(ripples, rippling);
    // the cast's groups after the fish's, each as many as are live
    const c = fishSlot + parts.length;
    // the rod, then the line in each of its colours (all of it in one), then the rest, in the order of `groups`
    let g = c;
    renderer.move(g++, casting.rod, drawn.rod);
    for (let k = 0; k < LINE_COLOURS; k++) renderer.move(g++, casting.lines[k], drawn.lines[k]);
    renderer.move(g++, casting.lure, drawn.lure);
    renderer.move(g++, casting.bobber, drawn.bobber);
    renderer.move(g++, casting.dots, drawn.dots);
    renderer.move(g++, casting.ringWater, drawn.ringWater);
    renderer.move(g, casting.ringBank, drawn.ringBank);
    // the boat where the game has it, rocking by the game's clock: each of its parts has a matrix of one
    if (boatSlot >= 0 && boatDraw.matrices.length) {
      boatDraw.write(game, game.t);
      for (let k = 0; k < boatDraw.matrices.length; k++) renderer.move(boatSlot + k, boatDraw.matrices[k], 1);
    }
    showCast();
    fightView.show();
    pond.show();
    night.show();
    // the mode buttons are greyed while the boat is rowed, and Row for a lake with no boat; written on change only
    const rowing = game.boat.rowing;
    if (modeButton.disabled !== rowing) modeButton.disabled = rowing;
    const noRow = rowing || !lake.boat;
    if (rowButton.disabled !== noRow) rowButton.disabled = noRow;
    showAnchor();
    const away = !atPond();
    if (away !== hudAway) {
      hudAway = away;
      hud.hidden = away;
    }
    // the lamp is lit while the player is in the cabin and out at the pond, and the camera comes back to the shore when
    // they go down to it; each is a change of a flag and a count, never made anew
    const inCabin = game.place === 'cabin';
    if (inCabin !== lampLit) {
      lampLit = inCabin;
      // the room shows no weather, so the lake's fog is the season's mist alone while the player is in it
      renderer.fog = fogFor(seasonNow(), time.name, MM_PER_UNIT, weatherDressed, game.place);
      if (inCabin && lamp) lights.set(0, lamp);
      else lights.clear();
      renderer.setLights(lights);
      if (!inCabin && game.place === 'pond' && viewName === 'cabin') void setView('shore', true);
    }
  };

  /** Whether a frame is being measured: the frame loop stands still while one is. */
  let measuring = false;

  /**
   * What a frame of the scene as it stands costs, drawn to a texture of our own rather than the canvas, so no wait
   * to be shown is counted. The frame loop draws nothing meanwhile: its frame, sixty times a second, fell in one
   * sample in three and read as a frame taking twice as long.
   */
  async function measureFrame(warm?: number, samples?: number): Promise<number> {
    const target = ctx.device.createTexture({
      label: 'measuring target',
      size: [width, height],
      format: ctx.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = target.createView();
    measuring = true;
    try {
      return await frameCost(
        () => {
          writeFrame();
          return renderer.frame(view, 'redraw', 1 / 60);
        },
        () => ctx.device.queue.onSubmittedWorkDone(),
        warm,
        samples,
      );
    } finally {
      measuring = false;
      target.destroy();
    }
  }

  await renderer.ready;
  // the governor: the frame of the full rung measured once, here, as the page will draw it, and the page stepped down
  // to lean if it is over the budget. The least of a few samples after the GPU has been kept drawing, so a busy
  // machine only ever adds to a sample and cannot make a fast one read slow; nothing is measured again, so a page
  // does not change what it draws as it plays
  if (asked === 'auto') {
    const ms = await measureFrame(BOOT_MEASURE.warmMs, BOOT_MEASURE.samples);
    if (rungFor(ms) !== rung) await setRung(rungFor(ms));
    await renderer.prepare();
  }
  boot.classList.add('gone');
  help.hidden = false;
  modeButton.hidden = false;
  rowButton.hidden = false;

  // ---- each frame ----

  let frames = 0;
  function simulate(dt: number) {
    // a page open holds the game still: no time, no fish, no light moving, for a frame or a step asked for
    if (pagesOpen()) return;
    frames++;
    game.step(dt);
    gestures.sync();
    // the day's clock has run on: when it has come to the next look, the page is lit as that, once, so a frame in
    // play compares a name and nothing more; the environments are all baked, so this is a uniform write
    const want = nearestTime(game.timeOfDay, timesFor(seasonNow(), moonOf(game.day), weatherDressed));
    if (want !== time) void showLight(want);
    // the day's weather, which a wake changes and the lever may: dressed once, the frame it differs
    if (weatherDressed !== game.weather) void showWeather();
    // the water healing: handed over when the drawn value has moved a whole step, so a frame where it has not moved
    // costs a comparison and nothing else
    if (watered !== waterShown() || dayDrawn !== game.day || lakeDrawn !== game.progress.save.lake) void showWater();
    // the falls' mist, on the game's own frame count: a paused lake throws none, and a step throws what it always does
    for (let i = 0; i < falls.length; i++) if (mistDue(frames, i, lake)) renderer.emit(mists[i]);
    // the season's falling things, on the same count, only while the game steps at the pond: a pond left for the cabin
    // or the yawn has nothing falling in the lake that is not seen
    if (game.place === 'pond')
      for (let i = 0; i < fallers.length; i++)
        if (fallingDue(frames, fallEvery, i)) {
          renderer.emit(fallers[i]);
          fell++;
        }
  }
  function draw(dt: number) {
    // a drag turns the camera only at the pond: the yawn and the cabin switch it off, and the way back switches it on
    const turns = orbitOn();
    if (orbit.enabled !== turns) orbit.enabled = turns;
    // while the boat is rowed the camera's target is the seat, so the orbit carries the camera along with it, keeping the
    // way the player has turned it to (the view is put again at the anchoring)
    if ((game.boat.rowing || (game.boat.aboard && !game.boat.anchored)) && turns) {
      const seat = game.anglerAt();
      cam.target = [seat.x, seat.y, cam.target[2]];
    }
    orbit.update();
    cam.update();
    // the renderer's clock is the game's at the water's pace, so a paused lake is still and a test that steps it draws
    // the same frame
    renderer.time = waterClock(game.t, lake.waterPace);
    writeFrame();
    // a photograph looked at holds the grain at one moment, set again after the frame since the frame runs it on
    if (stillOpen) renderer.postClock = PHOTOS.grain;
    renderer.frame(ctx.context.getCurrentTexture().createView(), 'redraw', dt);
    if (stillOpen) renderer.postClock = PHOTOS.grain;
  }

  // ---- the test API, and the frame loop ----

  // ?paused=1 starts the game stopped where it was built, so a test sees the
  // same lake every run: no frame of its own has run, and every one after is
  // the test's, of a length it chose
  let paused = query.has('paused');
  let ready = false;
  let bootMs = 0;
  window.game = createApi({
    game,
    ready: () => ready,
    bootMs: () => bootMs,
    paused: () => paused,
    setPaused: (p) => {
      paused = p;
    },
    simulate,
    draw,
    frame: () => frames,
    look,
    camera: () => {
      cam.update();
      return { position: [...cam.position], target: [...cam.target] };
    },
    project: toScreen,
    target: () => [cam.target[0], cam.target[1]],
    aiming: () => aim,
    setAim: (to) => {
      aim = to;
    },
    events: eventLog,
    measureFrame,
    scenery: () => ({ ...sceneryFigured }),
    rung: () => rung,
    setRung: async (to) => {
      await setRung(to);
      await renderer.prepare();
    },
    grass: () => renderer.grassDrawn(),
    ripples: () => ripples.subarray(0, rippling * RIPPLE_FLOATS),
    fishPose: (i) => {
      const n = (SWIM.segments.length + 1) * 3;
      return Number.isInteger(i) && i >= 0 && i < game.fish.count
        ? fish.joints.slice(i * n, i * n + n)
        : new Float64Array(0);
    },
    onScreen: () => {
      const { lure, bite } = game;
      const bobber = lure.phase === 'sinking' ? toScreen(lure.bobber[0], lure.bobber[1], 0) : null;
      const line =
        lure.phase === 'sinking' || lure.phase === 'hooked' ? toScreen(lure.at[0], lure.at[1], lure.at[2]) : null;
      const per = (SWIM.segments.length + 1) * 3;
      const head =
        bite.phase === 'hooked' && bite.fish >= 0 ? fish.joints.subarray(bite.fish * per, bite.fish * per + 3) : null;
      return { bobber, line, fish: head && head.length === 3 ? toScreen(head[0], head[1], head[2]) : null };
    },
    layout: () => document.documentElement.dataset.layout as Layout,
    settings: () => ({ ...settings }),
    phone: () => overlay?.reading() ?? NO_PHONE,
    pagesOpen,
    pair: (fixed) => openPairing(fixed),
    startAgain: () => openStartAgain(),
    openJournal: (open) => (open ? openJournal() : closeJournal()),
    openPost: (open) => (open ? openPost() : closePost()),
    openLakes: (open) => (open ? openLakes() : closeLakes()),
    openSleep: (open) => (open ? openSleep() : closeSleep()),
    openCamera: (open) => (open ? openCamera() : closeCamera()),
    cameraOpen: () => cameraOpen,
    photograph: () => takePhoto(),
    frameOn: (x, y, z) => {
      if (cameraOpen) look(x, y, { z, azimuth: orbit.currentAzimuth, polar: 1, radius: 25, fov: cam.fov });
    },
    lookAt: (i) => lookAtPhoto(i),
    lookAway,
    still: () => ({ shown: stillOpen, index: stillIndex, postClock: renderer.postClock }),
    setSettings,
    setDirt,
    setTime,
    setView: (name) => setView(name),
    out: () => goOut(),
    enter: () => enterCabin(),
    cabinOnScreen: () => {
      if (!lake.cabin) return null;
      const { at, floor, spec } = lake.cabin;
      return toScreen(at.x, at.y, floor + spec.body.high / 2);
    },
    travel: (id) => travelTo(id),
    looksBaked,
    drawnDirt: () => watered,
    waterHandovers: () => handovers,
    drawnCured: () => curedDrawn,
    drawnGlow: () => glowDrawn,
    eels: () => ({ lit: eelLights.lit, count: eelLights.count }),
    radio: () => night.radio(),
    calendar: () => ({ ...(calendarDraw?.shown() ?? { gone: 0, today: -1 }), handovers: calendarHandovers }),
    moon: () => ({ handovers: moonDraw.handovers, shown: moonDraw.shown() }),
    weather: () => ({
      handovers: rainbow.handovers,
      fog: renderer.economy.fog !== false ? renderer.fog.density : 0,
      falling: fallingNow,
      shown: rainbow.shown(),
    }),
    showWeather: () => showWeather(),
    map: () => ({ pin: mapDraw?.pin() ?? '', handovers: mapHandovers }),
    tableOnScreen: () => {
      if (!lake.cabin) return null;
      const { at } = lake.cabin;
      const { lo, hi } = tableBox(lake);
      const u = (lo[0] + hi[0]) / 2,
        v = (lo[1] + hi[1]) / 2;
      return toScreen(at.x + at.inward[0] * u + at.along[0] * v, at.y + at.inward[1] * u + at.along[1] * v, hi[2]);
    },
    mapOnScreen: () => {
      if (!mapDraw) return null;
      const [x, y, z] = mapDraw.middle();
      return toScreen(x, y, z);
    },
    season: () => ({
      dressed,
      statics,
      falling: fell,
      frost: frost.shown(),
      caps,
      mist: renderer.fog.density > 0 && renderer.economy.fog !== false,
      dressMs,
      bakeMs,
    }),
    time: () => time.name,
    view: () => viewName,
    mode: () => mode,
    setMode: (to) => setMode(to),
    boatDrawn: () => boatDraw.last,
  });

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    // never negative: the first frame's stamp can come before the time read when the loop was set up
    const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 20));
    last = now;
    if (measuring) return;
    // the phone's word and bar, by the page's clock and the game's state, so a paused game sends a bar that holds still
    overlay?.tick(now);
    if (paused) {
      draw(0);
      return;
    }
    simulate(dt);
    draw(dt);
  };
  ready = true;
  bootMs = performance.now();
  requestAnimationFrame(frame);
  // a load into the cabin looks as a wake does: the `woke` event does not fire on a load, so the camera is put at the
  // pillow here, once the first frame is up (the line and the lamp follow `game.place` in the frame already)
  if (game.place === 'cabin') void setView('cabin', true);
  // the clock is saved when the page is hidden or left, so a tab closed or a phone put away loses a few seconds at
  // most; both events are heard because neither is sent on every browser's way out, and a write is cheap and idempotent
  const keep = (e: Event) => {
    if (wiped || reloading) return;
    if (e.type === 'pagehide' || document.visibilityState === 'hidden') game.persist();
  };
  document.addEventListener('visibilitychange', keep);
  window.addEventListener('pagehide', keep);
  // the four looks are baked now that the page is up, about thirty milliseconds that are not the boot's
  bakeLooks(ctx, seasonNow());
}
