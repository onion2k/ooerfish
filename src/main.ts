/**
 * The page: the lake drawn, and the lab's panel. Everything that happens at
 * the lake happens in `game.ts`; this draws the frame, on the game path of
 * artshape-render, and turns the panel's settings into the water, the light
 * and the camera they name. There is no game logic here.
 */
import { createContext } from 'artshape-render/gpu/context';
import { Orbit } from 'artshape-render/gpu/camera';
import { LightPool } from 'artshape-render/game/lights';
import { EFFECT_STRIDE, GameRenderer } from 'artshape-render/game/renderer';
import { createApi } from './debug';
import { frameCost } from './frame-cost';
import { Game } from './game';
import { glowQuads } from './glow';
import { buildPanel } from './lab';
import { FISH_CAPACITY, VIEWS } from './lake';
import { light, nearestTime, timeNamed } from './look';
import { Progress } from './progress';
import { seeded } from './random';
import { SHADOW_BOX, Scene } from './scene';
import { changed, readSettings, writeSettings, type Settings } from './settings';
import { STYLES, styleNamed } from './water/styles';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  EFFECT_CAPACITY = FISH_CAPACITY,
  PARTICLE_CAPACITY = 1024;

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
  const game = new Game(new Progress(), seed !== null ? { random: seeded(+seed) } : {});

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
  const look = (x: number, y: number, view: { azimuth?: number; polar?: number; radius?: number }) => {
    cam.target = [x, y, 0];
    orbit.setSpherical(view);
    for (let i = 0; i < 400; i++) orbit.update();
  };
  /** The water, the light and the camera made what the settings say, where they differ from `was`. */
  async function apply(was: Settings | null) {
    game.setContamination(settings.dirt);
    if (!was || was.water !== settings.water || was.dirt !== settings.dirt)
      // the water's groups handed over again: once a change, never once a frame
      renderer.setDynamic(styleNamed(settings.water).groups(game.contamination));
    if (!was || was.time !== settings.time) {
      const time = timeNamed(settings.time);
      game.setTimeOfDay(time.at);
      await light(renderer, ctx, time);
    }
    if (!was || was.view !== settings.view) {
      const v = VIEWS[settings.view];
      look(v.x, v.y, v);
    }
    await renderer.prepare();
  }
  const panel = buildPanel(lab, (next) => void change(next));
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
  const writeGlow = () => renderer.setEffects(glow, glowQuads(glow, game.fish, cam, nearestTime(game.timeOfDay).glow));

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
