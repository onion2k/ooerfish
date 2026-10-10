/**
 * The page: the lake drawn, and the lab's panel. Everything that happens at
 * the lake happens in `game.ts`; this draws the frame, on the game path of
 * artshape-render, and turns the panel's settings into the water, the light
 * and the camera they name. There is no game logic here.
 */
import { createContext } from 'artshape-render/gpu/context';
import { Orbit } from 'artshape-render/gpu/camera';
import { LightPool } from 'artshape-render/game/lights';
import { invertInto } from 'artshape-render/geom/transform';
import { EFFECT_STRIDE, GameRenderer } from 'artshape-render/game/renderer';
import { createApi } from './debug';
import { splashBurst } from './bursts';
import { FishDraw } from './fishdraw';
import { frameCost } from './frame-cost';
import { Game, type GameEvents } from './game';
import { glowQuads } from './glow';
import { buildPanel } from './lab';
import { FISH_CAPACITY, VIEWS } from './lake';
import { light, nearestTime, timeNamed } from './look';
import { waterPoint } from './pick';
import { Progress } from './progress';
import { seeded } from './random';
import { RippleDraw } from './ripplesdraw';
import { SHADOW_BOX, Scene } from './scene';
import { changed, readSettings, writeSettings, type Settings } from './settings';
import { STYLES, styleNamed } from './water/styles';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  EFFECT_CAPACITY = FISH_CAPACITY,
  // twelve splashes live at once, a hundred droplets each, with room to spare
  PARTICLE_CAPACITY = 2048;
/** How far a pointer may move, in CSS pixels, and how long it may be down, in milliseconds, and still be a tap and not a drag. */
const TAP_PX = 6,
  TAP_MS = 400;
/** How many of the game's events the test API keeps, before the oldest go. */
const EVENTS_KEPT = 500;

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot')!;
const bootMsg = document.getElementById('bootMsg')!;
const stats = document.getElementById('stats')!;
const help = document.getElementById('help')!;
const lab = document.getElementById('lab')!;

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
  const events: GameEvents = {
    splashed(x, y, size) {
      log(`splashed ${x.toFixed(1)},${y.toFixed(1)}`);
      // the droplets thrown up, once, in the lake's colour as it is now
      renderer.emit(splashBurst(x, y, size, game.contamination));
    },
  };
  const game = new Game(new Progress(), { ...(seed !== null ? { random: seeded(+seed) } : {}), events });

  // ---- the scene ----

  const scene = new Scene();
  renderer.setStatic(scene.static());
  renderer.setLights(new LightPool(LIGHT_CAPACITY));

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

  // ---- the lab's settings, and what each one changes ----

  let settings: Settings = readSettings(query);
  /** The fish as they are drawn, and which of the dynamic groups they are. */
  const fish = new FishDraw();
  let fishSlot = 1;
  /** The ripples' rings, drawn as the group after the fish's. */
  const ripples = new RippleDraw();
  const look = (x: number, y: number, view: { azimuth?: number; polar?: number; radius?: number }) => {
    cam.target = [x, y, 0];
    orbit.setSpherical(view);
    for (let i = 0; i < 400; i++) orbit.update();
  };
  /** The water, the light and the camera made what the settings say, where they differ from `was`. */
  async function apply(was: Settings | null) {
    game.setContamination(settings.dirt);
    const style = styleNamed(settings.water);
    if (!was || was.water !== settings.water || was.dirt !== settings.dirt) {
      // the water's groups and the fish's handed over again: once a change, never once a frame
      const water = style.groups(game.contamination);
      fishSlot = water.length;
      renderer.setDynamic([...water, fish.group(), ripples.group()]);
    }
    if (!was || was.time !== settings.time) {
      const time = timeNamed(settings.time);
      game.setTimeOfDay(time.at);
      await light(renderer, ctx, time);
    }
    // how see-through water is, which only it reads: a uniform, so written on every change for nothing
    renderer.look = {
      ...renderer.look,
      clear: style.clear?.(game.contamination, settings.caustics === 'on', timeNamed(settings.time)),
    };
    if (!was || was.view !== settings.view) {
      const v = VIEWS[settings.view];
      look(v.x, v.y, v);
    }
    await renderer.prepare();
  }
  const panel = buildPanel(
    lab,
    (next) => void change(next),
    () => game.dropNear(cam.target[0], cam.target[1]),
  );

  // a short tap on the water drops a pebble where it was tapped; a drag turns the camera, and drops nothing
  const tapInverse = new Float32Array(16);
  let down: { x: number; y: number; at: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, at: e.timeStamp };
  });
  canvas.addEventListener('pointerup', (e) => {
    const was = down;
    down = null;
    if (!was || Math.hypot(e.clientX - was.x, e.clientY - was.y) > TAP_PX || e.timeStamp - was.at > TAP_MS) return;
    cam.update();
    if (!invertInto(tapInverse, cam.viewProjection)) return;
    const box = canvas.getBoundingClientRect();
    const at = waterPoint(
      tapInverse,
      ((e.clientX - box.left) / box.width) * 2 - 1,
      1 - ((e.clientY - box.top) / box.height) * 2,
    );
    if (at) game.drop(at[0], at[1]);
  });
  async function change(next: Partial<Settings>) {
    const was = settings;
    settings = changed(settings, next);
    panel.show(settings);
    history.replaceState(null, '', `?${writeSettings(settings, new URLSearchParams(location.search))}`);
    await apply(was);
  }
  panel.show(settings);
  await apply(null);

  /** The glow over each fish, written each frame into a pool sized once. */
  const glow = new Float32Array(FISH_CAPACITY * EFFECT_STRIDE);
  /** Each frame: the fish where they are, and their glow on the surface for water that cannot be seen through. */
  const writeGlow = () => {
    renderer.move(fishSlot, fish.matrices, fish.write(game.fish));
    renderer.move(fishSlot + 1, ripples.matrices, ripples.write(game.splashes, game.t));
    const shown = styleNamed(settings.water).surfaceGlow
      ? glowQuads(glow, game.fish, cam, nearestTime(game.timeOfDay).glow)
      : 0;
    renderer.setEffects(glow, shown);
  };

  /** Whether a frame is being measured: the frame loop stands still while one is. */
  let measuring = false;

  /**
   * What a frame of the scene as it stands costs, drawn to a texture of our own rather than the canvas, so no wait
   * to be shown is counted. The frame loop draws nothing meanwhile: its frame, sixty times a second, fell in one
   * sample in three and read as a frame taking twice as long.
   */
  async function measureFrame(warm?: number): Promise<number> {
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
          writeGlow();
          return renderer.frame(view, 'redraw', 1 / 60);
        },
        () => ctx.device.queue.onSubmittedWorkDone(),
        warm,
      );
    } finally {
      measuring = false;
      target.destroy();
    }
  }

  await renderer.ready;
  boot.classList.add('gone');
  stats.hidden = false;
  help.hidden = false;
  lab.hidden = false;

  // ---- each frame ----

  let frames = 0;
  let smoothed = 0;
  function simulate(dt: number) {
    frames++;
    game.step(dt);
  }
  function draw(dt: number) {
    orbit.update();
    cam.update();
    // the renderer's clock is the game's, so a paused lake is still and a test that steps it draws the same frame
    renderer.time = game.t;
    writeGlow();
    const t = performance.now();
    renderer.frame(ctx.context.getCurrentTexture().createView(), 'redraw', dt);
    smoothed += (performance.now() - t - smoothed) * 0.05;
    if (frames % 30 === 0) stats.textContent = `${smoothed.toFixed(1)} ms`;
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
    project(x, y, z) {
      cam.update();
      const m = cam.viewProjection;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0) return null;
      const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      const box = canvas.getBoundingClientRect();
      return { x: box.left + ((nx + 1) / 2) * box.width, y: box.top + ((1 - ny) / 2) * box.height };
    },
    target: () => [cam.target[0], cam.target[1]],
    events: eventLog,
    measureFrame,
    settings: () => ({ ...settings }),
    change,
    styles: () => STYLES.map((s) => s.name),
  });

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (measuring) return;
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
}
