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
import { LightPool } from 'artshape-render/game/lights';
import { invertInto } from 'artshape-render/geom/transform';
import { GameRenderer } from 'artshape-render/game/renderer';
import { NO_PHONE, createApi } from './debug';
import { cabinGroups, jettyGroups } from './cabin';
import { FALLS, fallGroups, fallMists, mistDue } from './falls';
import { BREEZE, GRASS_OPTIONS, bankField } from './grass';
import { splashBurst } from './bursts';
import { Gesture, type PointerGesture } from './gesture';
import { CastDraw, LINE_COLOURS, type Aim } from './castdraw';
import { FISH_PARTS, FishDraw } from './fishdraw';
import { frameCost } from './frame-cost';
import { Game, type GameEvents } from './game';
import { PHONE, SPLASH_CAPACITY, SWIM, VIEWS, WATER_PACE, framingFor, type ViewName } from './lake';
import { TIMES, bakeLooks, light, looksBaked, nearestTime, paintFor, type TimeOfDay } from './look';
import { nextMode, orbits, wording, type Mode, type ModeEvent } from './mode';
import { waterPoint } from './pick';
import { Progress } from './progress';
import { BOOT_MEASURE, rungAsked, rungFor, type Rung } from './rung';
import { seeded } from './random';
import { RIPPLE_FLOATS, rippleData } from './ripples';
import { SHADOW_BOX, Scene, sceneryFigures } from './scene';
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
import { PondView } from './pondview';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  // nothing is drawn as an effect layer: the fish glow under the water as meshes
  EFFECT_CAPACITY = 0,
  // twelve splashes live at once, a hundred droplets each, with room to spare
  PARTICLE_CAPACITY = 2048;
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
const modeButton = document.getElementById('modeButton')!;
const byId = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as unknown as T;

main().catch((err: unknown) => {
  bootMsg.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
});

async function main() {
  // ---- the renderer ----

  const ctx = await createContext(canvas);
  bootMsg.textContent = 'compiling shaders…';
  const renderer = new GameRenderer(ctx, LIGHT_CAPACITY, EFFECT_CAPACITY, PARTICLE_CAPACITY, MM_PER_UNIT);
  renderer.camera.fov = 40;
  renderer.camera.near = 1;
  renderer.camera.far = 1500;
  renderer.setSunShadow(SHADOW_BOX);

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
      // the droplets thrown up, once, in the lake's colour as it is now
      renderer.emit(splashBurst(x, y, size, game.contamination));
    },
    nibbled: () => log('nibbled'),
    bitten: () => {
      log('bitten');
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
    landed: (kind, weight) => log(`landed ${kind} ${weight.toFixed(2)}`),
    cured: (cured, toClean) => {
      log(`cured ${cured}/${toClean}`);
      // the water steps clearer at once, and the line says so; the gauge reads the save the game has just written
      void showWater();
      pond.cured(cured, toClean);
    },
  };
  const game = new Game(new Progress(), { ...(seed !== null ? { random: seeded(+seed) } : {}), events });

  // ---- the scene ----

  // the scenery kit is loaded before the first frame, as the first frame's business, and the banks are built from it
  bootMsg.textContent = 'loading the scenery…';
  const scenery = await loadScenery(
    (url) => fetch(url),
    import.meta.env.BASE_URL + 'scenery/',
    (blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
  );
  renderer.setCardImages(scenery.masks);

  const scene = new Scene();
  // the rung the page is drawn on: full has the banks' grass, lean has none (the woodland costs a tenth of a
  // millisecond and stands on both). The address may ask for one (a test does, and so does a slow machine's owner);
  // without, the governor chooses once the page has booted.
  const asked = rungAsked(query.get('rung'));
  let rung: Rung = asked === 'auto' ? 'full' : asked;
  // worked out once, from the placements the groups are made from, and read back by the test API
  const sceneryFigured = sceneryFigures(scene.placements(scenery.kit));
  // the grass field is made once and handed over each time the full rung is drawn: nothing in it grows
  let field: ReturnType<typeof bankField> | null = null;
  /** The page put on a rung: the grass grown or let go. */
  async function setRung(to: Rung) {
    rung = to;
    field ??= bankField();
    await renderer.setGrass(to === 'full' ? field : null, GRASS_OPTIONS);
  }
  // the cliff's falls are the page's picture, flowing down its notches; the mist they throw is made once and handed on;
  // the cabin and the jetty are built once and stand still
  const mists = fallMists();
  renderer.setStatic([...scene.static(scenery.kit), ...fallGroups(), ...cabinGroups(), ...jettyGroups()]);
  await setRung(rung);
  // a slow breeze: the renderer's clock runs at the water's pace (`WATER_PACE`), so the gusts roll by slowly, and the
  // grass has no second clock of its own
  renderer.wind = BREEZE;
  renderer.setLights(new LightPool(LIGHT_CAPACITY));

  // the foam rings the shore and the boulders from the lake's field, made once and before the first frame
  renderer.setShoreField(shoreField());

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
  const casting = new CastDraw();
  /** What a cast is being aimed at, while one is: the preview is drawn from it. */
  let aim: Aim | null = null;
  const look = (x: number, y: number, view: { azimuth?: number; polar?: number; radius?: number }) => {
    // the orbit moves the camera only while it is on, so it is on while the camera is put there, and as it was after
    const was = orbit.enabled;
    orbit.enabled = true;
    // the momentum of a drag is let die away first: left in, it carries the view past where it is put
    for (let i = 0; i < 40; i++) orbit.update();
    cam.target = [x, y, 0];
    orbit.setSpherical(view);
    for (let i = 0; i < 400; i++) orbit.update();
    orbit.enabled = was;
  };
  /** The page's look: the time it is lit as, the view the camera was last put at, and the contamination the water was handed over at. */
  let time: TimeOfDay = nearestTime(game.timeOfDay);
  let viewName: ViewName = 'shore';
  /** Whether the screen was taller than wide when the camera was last put at a view. */
  let tall = false;
  let watered: number | null = null;
  /** How many fish were cured when the fish's groups were last handed over, since their colour and glow go over only with the groups. */
  let curedDrawn = -1;
  /** The water's finish and the rocks' paint, at the contamination, the time and the settings as they stand: uniforms, so written on any change and nothing recompiles. */
  function finish() {
    const water = style.clear(game.contamination, settings.caustics === 'on', time);
    rippleLife = water.ringLife ?? 0;
    renderer.look = { ...renderer.look, clear: water, paint: paintFor(settings.paint) };
  }
  /** The water made as clear as the game says it is: its groups and the fish's handed over again when the contamination or the number of cured fish has changed, once a change and never once a frame. */
  async function showWater() {
    const cured = game.fish.curedCount();
    if (watered !== game.contamination || curedDrawn !== cured) {
      watered = game.contamination;
      curedDrawn = cured;
      const water = style.groups(game.contamination);
      fishSlot = water.length;
      // what floats rides the swells the water is drawn with, at the water's own pace
      casting.surface = surfaceOf(style.waves, MM_PER_UNIT, WATER_PACE);
      renderer.setDynamic([...water, ...fish.groups(game.fish.cured), ...casting.groups()]);
    }
    finish();
    await renderer.prepare();
  }
  /** The lake made as dirty as that, and the water drawn so. */
  async function setDirt(v: number) {
    game.setContamination(v);
    await showWater();
  }
  /** The light of the time of that name, which the game's clock is put at; one not known is refused. */
  async function setTime(name: string) {
    const to = TIMES.find((t) => t.name === name);
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
    const lit = light(renderer, ctx, to, settings.paint);
    finish();
    await lit;
    await renderer.prepare();
  }
  /** The camera put at the view of that name, even when it is the view already, so it is the way back from being turned away; one not known is refused. */
  async function setView(name: string, byMode = false) {
    if (!Object.hasOwn(VIEWS, name)) return;
    viewName = name as ViewName;
    // a view picked, from the test API, is look mode unless it is the mode itself that picked it
    if (!byMode) showMode(nextMode(mode, 'view').mode);
    // the Shore view is framed for a phone on a screen taller than it is wide
    const v = framingFor(viewName, width / height);
    tall = height > width;
    look(v.x, v.y, v);
    aim = null;
    // look turns the camera by a drag in every view; cast holds it still behind the angler, where a drag aims
    orbit.enabled = orbits(mode);
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
    const { lure, bite } = game;
    const text =
      bite.phase === 'hooked'
        ? 'a fish on! hold to lift the zone, keep the fish in it'
        : bite.phase === 'biting'
          ? 'BITE! strike now'
          : bite.phase === 'nibbling'
            ? 'nibble… wait for the dip'
            : game.t < heard.until
              ? heard.text
              : lure.phase === 'sinking'
                ? 'waiting for a fish…'
                : lure.phase === 'lying'
                  ? 'on the bank: reel it in'
                  : '';
    if (text === castText) return;
    castText = text;
    castLine.textContent = text;
    castLine.hidden = !text;
  }

  // the gesture rules are src/gesture.ts's; the page turns its events into theirs and does what is the page's own: the
  // pointer capture, the camera and the picking of a point on the water
  const tapInverse = new Float32Array(16);
  const gestures = new Gesture(
    {
      cast: (angle, power) => void game.cast(angle, power),
      strike: () => void game.strike(),
      reel: (on) => game.reel(on),
      setAim: (to) => {
        aim = to;
      },
      // a short tap on the water drops a pebble where it was tapped; a drag turns the camera, and drops nothing
      pebble: (x, y) => {
        cam.update();
        if (!invertInto(tapInverse, cam.viewProjection)) return;
        const box = canvas.getBoundingClientRect();
        const at = waterPoint(tapInverse, ((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2);
        if (at) game.drop(at[0], at[1]);
      },
      mode: () => mode,
      bitePhase: () => game.bite.phase,
      lurePhase: () => game.lure.phase,
      view: () => {
        const box = canvas.getBoundingClientRect();
        return {
          short: Math.min(box.width, box.height),
          heading: Math.atan2(cam.target[1] - cam.position[1], cam.target[0] - cam.position[0]),
        };
      },
      // a phone's first gesture, in look mode, puts the page in cast mode at the Shore view
      wantCast: () => void setMode('cast'),
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
          handle: (e) => gestures.handle(e),
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
  }

  // what not every player wants is behind the corner's button: it opens a short list, and a choice from it, a click
  // anywhere else or Escape closes it again
  const menuButton = byId<HTMLButtonElement>('menuButton');
  const menuList = byId('menuList');
  const showMenu = (open: boolean) => {
    menuList.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => showMenu(menuList.hidden));
  byId('pairButton').addEventListener('click', () => {
    showMenu(false);
    void openPairing();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menuList.hidden && e.target instanceof Node && !byId('menu').contains(e.target)) showMenu(false);
  });
  document.addEventListener('keydown', (e) => {
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
    gestures.handle(pointer('down', e));
  });
  canvas.addEventListener('pointermove', (e) => gestures.handle(pointer('move', e)));
  canvas.addEventListener('pointercancel', (e) => gestures.handle(pointer('cancel', e)));
  canvas.addEventListener('pointerup', (e) => gestures.handle(pointer('up', e)));
  // space strikes, and held with a fish on, reels, in any view; let go, the fish takes line. C switches between look
  // and cast. Neither over the page's own buttons, where the key is only what it presses
  const onControl = (e: KeyboardEvent) =>
    e.target instanceof HTMLElement && e.target.closest('#catch, #modeButton, #pairing, #menu') !== null;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !onControl(e)) {
      void setMode('toggle');
      return;
    }
    if (e.code !== 'Space' || onControl(e)) return;
    e.preventDefault();
    gestures.handle({ type: 'press', source: 'key', repeat: e.repeat });
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
      bucket: byId('bucket'),
    },
    () => game,
    toScreen,
    (e) => gestures.handle(e),
  );

  const pond = new PondView(
    {
      gauge: byId('pond'),
      name: byId('pondName'),
      bar: byId('pondBar'),
      gone: byId('pondBarGone'),
      welcome: byId('welcome'),
      toast: byId('toast'),
    },
    () => game,
    HEARD_FOR,
  );

  /** The page in a mode, its button and hint saying so: the camera is the caller's, as `nextMode` says. */
  function showMode(to: Mode) {
    if (to !== 'cast') {
      // leaving cast drops an aim begun, and a reel held by the screen
      gestures.handle({ type: 'left-cast' });
    }
    mode = to;
    orbit.enabled = orbits(mode);
    const words = wording(mode);
    modeButton.textContent = words.button;
    help.textContent = words.hint;
  }
  /** A mode event: the mode it makes, and the camera put at the shore if it says so, resolving once that is ready. */
  async function setMode(event: ModeEvent) {
    const step = nextMode(mode, event);
    showMode(step.mode);
    if (step.camera === 'shore') await setView('shore', true);
  }
  modeButton.addEventListener('click', () => void setMode('toggle'));

  await setDirt(game.contamination);
  await showLight(time);
  await setView('shore', true);

  /** Each frame: the fish where they are, glowing under the water, the splashes' ripples in it, and the cast. */
  const writeFrame = () => {
    // the cast first, which says where a landed fish hangs; then the fish, that one hanging there
    const drawn = casting.write(game, aim);
    const hung = drawn.hung ? game.bite.fish : -1;
    const swimming = fish.write(game.fish, hung, casting.hang, game.t);
    for (let p = 0; p < FISH_PARTS.length; p++) renderer.move(fishSlot + p, fish.matrices[p], swimming);
    rippling = rippleData(game.splashes, game.t, rippleLife, ripples);
    renderer.setRings(ripples, rippling);
    // the cast's groups after the fish's, each as many as are live
    const c = fishSlot + FISH_PARTS.length;
    // the rod, then the line in each of its colours (all of it in one), then the rest, in the order of `groups`
    let g = c;
    renderer.move(g++, casting.rod, drawn.rod);
    for (let k = 0; k < LINE_COLOURS; k++) renderer.move(g++, casting.lines[k], drawn.lines[k]);
    renderer.move(g++, casting.lure, drawn.lure);
    renderer.move(g++, casting.bobber, drawn.bobber);
    renderer.move(g++, casting.dots, drawn.dots);
    renderer.move(g++, casting.ringWater, drawn.ringWater);
    renderer.move(g, casting.ringBank, drawn.ringBank);
    showCast();
    fightView.show();
    pond.show();
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

  // ---- each frame ----

  let frames = 0;
  function simulate(dt: number) {
    frames++;
    game.step(dt);
    gestures.sync();
    // the day's clock has run on: when it has come to the next look, the page is lit as that, once, so a frame in
    // play compares a name and nothing more; the environments are all baked, so this is a uniform write
    const want = nearestTime(game.timeOfDay);
    if (want !== time) void showLight(want);
    // the falls' mist, on the game's own frame count: a paused lake throws none, and a step throws what it always does
    for (let i = 0; i < FALLS.length; i++) if (mistDue(frames, i)) renderer.emit(mists[i]);
  }
  function draw(dt: number) {
    orbit.update();
    cam.update();
    // the renderer's clock is the game's at the water's pace, so a paused lake is still and a test that steps it draws
    // the same frame
    renderer.time = waterClock(game.t, WATER_PACE);
    writeFrame();
    renderer.frame(ctx.context.getCurrentTexture().createView(), 'redraw', dt);
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
    settings: () => ({ ...settings }),
    phone: () => overlay?.reading() ?? NO_PHONE,
    pair: (fixed) => openPairing(fixed),
    setSettings,
    setDirt,
    setTime,
    setView: (name) => setView(name),
    looksBaked,
    drawnDirt: () => watered,
    drawnCured: () => curedDrawn,
    time: () => time.name,
    view: () => viewName,
    mode: () => mode,
    setMode: (to) => setMode(to),
  });

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
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
  // the four looks are baked now that the page is up, about thirty milliseconds that are not the boot's
  bakeLooks(ctx);
}
