/**
 * The lake filmed, headless, a stepped frame at a time.
 *
 *   npm run film -- --scene clear-day --seconds 5 [--out <dir>] [--port <n>]
 *
 * Every judgement of the water was made on a still, and what the water does
 * is move: a swell that travels too fast, a caustic that crawls, a mirror
 * that shimmers or a sparkle that flickers all look right held still. This
 * films a scene as the look pictures are taken (the game seeded and paused,
 * the lab set through the test API, the overlays hidden), then steps the
 * game one fixed step at a time and takes a picture after each, so the film
 * is the same every run and never waits on a clock. The frames go in the
 * folder as PNGs, with a filmstrip of every eighth beside them; where
 * `ffmpeg` is on the machine, an MP4 at the game's sixty frames a second and
 * a GIF as well.
 *
 * The scenes are the look pictures' names, `standard`, and `cast-sinking`,
 * the cast picture's, played to its moment as the look spec plays it. The film runs its
 * own dev server, on `--port` or `FILM_PORT` (5211 unless said), so it never
 * meets the main checkout's on 5204 or the smoke's on 5205. It is a tool and
 * not a gate: nothing is held to what it films, and it is for looking at.
 * Its arithmetic, which frames go on the strip and where, and what the
 * command line may say, is in `filming.ts`, tested.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { PICTURES, STANDARD, castSinking, hideOverlays, set, start, watch, type Scene } from '../smoke/game';
import { FPS, frameCount, parseFilmArgs, shrinkInto, stripFrames, stripLayout } from './filming';

const SCENES: [string, Scene][] = [['standard', STANDARD], ...PICTURES];
/**
 * The scenes made by playing and not only by setting the lab: the look picture's cast landed and sinking under its
 * bobber, so the bobber and its rings are filmed riding the swells.
 */
const PLAYED = ['cast-sinking'];
/** The frames stepped before filming, as the look pictures are taken: the fish and the water well on. */
const SETTLE = 180;
/** The seed the look pictures are taken from, so a film's first frame is the picture's. */
const SEED = 11;

const frameName = (f: number) => `frame-${String(f).padStart(4, '0')}.png`;

async function main() {
  let options;
  try {
    options = parseFilmArgs(process.argv.slice(2), [...SCENES.map(([name]) => name), ...PLAYED], {
      port: Number(process.env.FILM_PORT ?? 5211),
    });
  } catch (e) {
    console.error(`film: ${(e as Error).message}`);
    process.exit(2);
  }
  const { scene, seconds, port } = options;
  const out = resolve(options.out);
  const frames = frameCount(seconds);
  mkdirSync(out, { recursive: true });
  // frames from a longer film before would be taken into this one's MP4 and GIF: only the film's own are cleared
  for (const old of readdirSync(out)) if (/^frame-\d{4}\.png$/.test(old)) rmSync(join(out, old));

  const server = await serve(port);
  const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-webgpu'] });
  let problems: string[] = [];
  try {
    const context = await browser.newContext({
      baseURL: `http://localhost:${port}`,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    problems = watch(page);
    await start(page, { seed: SEED, paused: true });
    if (scene === 'cast-sinking') await castSinking(page);
    else await set(page, SCENES.find(([name]) => name === scene)![1], SETTLE);
    await hideOverlays(page);
    const view = page.locator('#view');
    console.log(`film: ${scene}, ${frames} frames (${seconds} s at ${FPS} a second) into ${out}`);
    for (let f = 0; f < frames; f++) {
      if (f > 0) await page.evaluate(() => window.game!.step(1));
      writeFileSync(join(out, frameName(f)), await view.screenshot({ animations: 'disabled' }));
    }
  } finally {
    await browser.close();
    server.kill();
  }

  const strip = writeStrip(out, frames);
  console.log(`film: the strip, every eighth frame, in ${strip}`);
  if (spawnSync('ffmpeg', ['-version']).status === 0) {
    const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(out, 'frame-%04d.png')];
    ffmpeg([...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(out, 'film.mp4')]);
    // a GIF counts its frames' times in hundredths of a second, and a browser plays one faster than fifty a second
    // at its own pace: at thirty, every other frame, and half the size, it plays at the game's speed and stays a
    // size worth opening
    const gif = 'fps=30,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse';
    ffmpeg([...input, '-vf', gif, join(out, 'film.gif')]);
    console.log(`film: film.mp4 and film.gif in ${out}`);
  } else console.log('film: no ffmpeg on the machine, so no MP4 or GIF: the frames and the strip are there');
  if (problems.length) {
    console.error(`film: the page went wrong while filming:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
}

/** The strip of every eighth frame, read back from the frames written, so it shows what the films are made of. */
function writeStrip(out: string, frames: number): string {
  const picked = stripFrames(frames);
  const first = PNG.sync.read(readFileSync(join(out, frameName(0))));
  const layout = stripLayout(picked, first.width, first.height);
  const strip = new PNG({ width: layout.width, height: layout.height });
  strip.data.fill(255);
  for (const tile of layout.tiles) {
    const frame = PNG.sync.read(readFileSync(join(out, frameName(tile.frame))));
    shrinkInto(frame, strip, tile.x, tile.y, layout.tileWidth, layout.tileHeight);
  }
  const path = join(out, 'strip.png');
  writeFileSync(path, PNG.sync.write(strip));
  return path;
}

function ffmpeg(args: string[]) {
  const run = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`ffmpeg ${args.at(-1)} failed: ${run.stderr}`);
}

/** The film's own dev server, on a port no other is on, once it answers. */
async function serve(port: number) {
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let said = '';
  server.stderr.on('data', (d: Buffer) => (said += d.toString()));
  for (let tries = 0; tries < 600; tries++) {
    if (server.exitCode !== null) throw new Error(`the dev server on ${port} stopped: ${said}`);
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return server;
    } catch {
      // not answering yet
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  server.kill();
  throw new Error(`the dev server on ${port} did not answer in a minute`);
}

await main();
