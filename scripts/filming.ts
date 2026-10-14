/**
 * The film's arithmetic, apart from the browser so that it can be tested
 * without one: how many frames some seconds of the game are, which of them
 * go on the filmstrip and where each sits on it, how a frame is shrunk to
 * its tile, and what the command line may ask for. Left in among the
 * filming, a strip that skipped a frame or a scene filmed by a misspelt
 * name would only ever be found by looking hard at a picture.
 */

/** The game's fixed step, as `window.game.step` takes it: a frame is a sixtieth of a second of game time. */
export const FPS = 60;

/** Every eighth frame on the strip: five seconds are thirty-eight tiles, enough to see a swell travel and few enough to read. */
export const STRIP_EVERY = 8;

/** The most seconds filmed: a minute is 3,600 frames of a megabyte or so each, which is as much as is worth keeping. */
export const MOST_SECONDS = 60;

/**
 * How many frames the seconds are, at the fixed step. A share of a step left over is not a frame the game ever
 * drew, so it is dropped; the small allowance keeps a figure such as 4.1 seconds, which a float holds as a hair
 * under 246 frames, from losing its last one.
 */
export function frameCount(seconds: number, fps = FPS): number {
  return Math.floor(seconds * fps + 1e-9);
}

/** The frames that go on the strip: the first, and every `every`th after it, none past the last. */
export function stripFrames(count: number, every = STRIP_EVERY): number[] {
  const frames: number[] = [];
  for (let f = 0; f < count; f += every) frames.push(f);
  return frames;
}

export interface StripLayout {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  /** The whole strip, gaps and all, in pixels. */
  width: number;
  height: number;
  /** Where each frame's tile has its top left corner, in the order the frames were given. */
  tiles: { frame: number; x: number; y: number }[];
}

/**
 * The strip laid out row by row, left to right, so it reads as a page does: each tile the frame shrunk to
 * `tileWidth` across with its own shape kept, and a gap round every tile. A strip of fewer frames than a row is
 * only as wide as they are.
 */
export function stripLayout(
  frames: readonly number[],
  frameWidth: number,
  frameHeight: number,
  { columns = 8, tileWidth = 320, gap = 4 }: { columns?: number; tileWidth?: number; gap?: number } = {},
): StripLayout {
  if (frames.length === 0) throw new Error('a strip of no frames: there is nothing to lay out');
  if (!(frameWidth > 0 && frameHeight > 0))
    throw new Error(`a frame of ${frameWidth} by ${frameHeight}: there is nothing to shrink`);
  const across = Math.min(columns, frames.length);
  const rows = Math.ceil(frames.length / across);
  const tileHeight = Math.round((tileWidth * frameHeight) / frameWidth);
  return {
    columns: across,
    rows,
    tileWidth,
    tileHeight,
    width: across * tileWidth + (across + 1) * gap,
    height: rows * tileHeight + (rows + 1) * gap,
    tiles: frames.map((frame, k) => ({
      frame,
      x: gap + (k % across) * (tileWidth + gap),
      y: gap + Math.floor(k / across) * (tileHeight + gap),
    })),
  };
}

/** Pixels as four bytes each, red, green, blue and alpha, a row after a row, as a PNG decodes. */
export interface Pixels {
  width: number;
  data: Uint8Array;
}

/**
 * A frame shrunk into a `w` by `h` box of the strip at (`x`, `y`): each pixel of the box the mean of the frame's
 * pixels it covers. A mean and not a pick, since a pick of one pixel in sixteen would show a sparkle on one tile and
 * lose it on the next, and the strip is there to show what moves.
 */
export function shrinkInto(
  frame: Pixels & { height: number },
  strip: Pixels,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const sum = [0, 0, 0, 0];
  for (let j = 0; j < h; j++) {
    const y0 = Math.floor((j * frame.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((j + 1) * frame.height) / h));
    for (let i = 0; i < w; i++) {
      const x0 = Math.floor((i * frame.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((i + 1) * frame.width) / w));
      sum.fill(0);
      for (let v = y0; v < y1; v++)
        for (let u = x0; u < x1; u++) {
          const s = (v * frame.width + u) * 4;
          for (let c = 0; c < 4; c++) sum[c] += frame.data[s + c];
        }
      const n = (x1 - x0) * (y1 - y0);
      const d = ((y + j) * strip.width + x + i) * 4;
      for (let c = 0; c < 4; c++) strip.data[d + c] = Math.round(sum[c] / n);
    }
  }
}

export interface FilmOptions {
  scene: string;
  seconds: number;
  /** The folder the frames, the strip and the films go in. */
  out: string;
  /** The port the film's own dev server is on. */
  port: number;
}

const OPTIONS = ['--scene', '--seconds', '--out', '--port'];

/**
 * The command line read, and anything it does not know refused by name: a scene misspelt would otherwise film
 * nothing, or the wrong lake, and a figure that is not one would film for ever or not at all. The frames go under
 * `node_modules/.cache` unless a folder is asked for, so a film never lands in the repo.
 */
export function parseFilmArgs(
  argv: readonly string[],
  scenes: readonly string[],
  defaults: { port: number },
): FilmOptions {
  const given = new Map<string, string>();
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k];
    const eq = arg.indexOf('=');
    const name = eq >= 0 ? arg.slice(0, eq) : arg;
    if (!OPTIONS.includes(name)) throw new Error(`no option "${name}": the options are ${OPTIONS.join(', ')}`);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv.at(++k);
    // the end of the line, or the next option taken for this one's value, are both a value left out
    if (value === undefined || OPTIONS.includes(value)) throw new Error(`${name} needs a value`);
    given.set(name, value);
  }
  const scene = given.get('--scene');
  if (scene === undefined) throw new Error(`--scene is needed: the scenes are ${scenes.join(', ')}`);
  if (!scenes.includes(scene)) throw new Error(`no scene named "${scene}": the scenes are ${scenes.join(', ')}`);
  const secondsText = given.get('--seconds') ?? '5';
  const seconds = Number(secondsText);
  // NaN fails both comparisons, and an empty string, which Number reads as nought, fails the frame's
  if (!(seconds <= MOST_SECONDS && frameCount(seconds) >= 1))
    throw new Error(`--seconds "${secondsText}" is not a number of seconds from a frame's to ${MOST_SECONDS}`);
  const portText = given.get('--port');
  const port = portText === undefined ? defaults.port : Number(portText);
  if (!(Number.isInteger(port) && port >= 1 && port <= 65535)) throw new Error(`--port "${portText}" is not a port`);
  return { scene, seconds, out: given.get('--out') ?? `node_modules/.cache/film/${scene}`, port };
}
