/**
 * The film's arithmetic: how many frames a number of seconds is, which of
 * them go on the strip and where each sits, how a frame is shrunk onto it,
 * and what the command line may ask for. The filming itself is tried by
 * running it; this is the part of it that could put the wrong frames on a
 * strip, or film a scene nobody named, without any run of it showing.
 */
import { describe, expect, it } from 'vitest';
import { FPS, STRIP_EVERY, frameCount, parseFilmArgs, shrinkInto, stripFrames, stripLayout } from '../scripts/filming';

const SCENES = ['standard', 'clear-day', 'half-boat'];
const DEFAULTS = { port: 5299 };

describe('the film', () => {
  it('films a frame for every step of the game in the seconds asked for', () => {
    expect(FPS).toBe(60);
    expect(frameCount(5)).toBe(300);
    expect(frameCount(0.5)).toBe(30);
    // a share of a step is not a frame the game ever drew
    expect(frameCount(1 / 120 + 1)).toBe(60);
    // a float holds 4.1 seconds as a hair under 246 frames, which must not lose the last of them
    expect(frameCount(4.1)).toBe(246);
  });

  it('puts every eighth frame on the strip, from the first, and none past the last', () => {
    expect(STRIP_EVERY).toBe(8);
    expect(stripFrames(300)).toEqual(Array.from({ length: 38 }, (_, k) => k * 8));
    expect(stripFrames(17)).toEqual([0, 8, 16]);
    expect(stripFrames(16)).toEqual([0, 8]);
    expect(stripFrames(1)).toEqual([0]);
    expect(stripFrames(10, 3)).toEqual([0, 3, 6, 9]);
  });

  it('lays the strip out row by row, each tile the frame shrunk and a gap round each', () => {
    const strip = stripLayout([0, 8, 16, 24, 32], 1280, 800, { columns: 3, tileWidth: 320, gap: 4 });
    expect(strip.columns).toBe(3);
    expect(strip.rows).toBe(2);
    expect(strip.tileWidth).toBe(320);
    expect(strip.tileHeight).toBe(200);
    expect(strip.width).toBe(3 * 320 + 4 * 4);
    expect(strip.height).toBe(2 * 200 + 3 * 4);
    expect(strip.tiles).toEqual([
      { frame: 0, x: 4, y: 4 },
      { frame: 8, x: 328, y: 4 },
      { frame: 16, x: 652, y: 4 },
      { frame: 24, x: 4, y: 208 },
      { frame: 32, x: 328, y: 208 },
    ]);
  });

  it('makes a strip of a few frames no wider than they are, and every tile inside it', () => {
    const strip = stripLayout([0, 8], 1280, 800);
    expect(strip.columns).toBe(2);
    expect(strip.rows).toBe(1);
    for (const many of [stripFrames(300), stripFrames(17), stripFrames(1)]) {
      const s = stripLayout(many, 1280, 800);
      expect(s.tiles.map((t) => t.frame)).toEqual(many);
      for (const t of s.tiles) {
        expect(t.x + s.tileWidth).toBeLessThanOrEqual(s.width);
        expect(t.y + s.tileHeight).toBeLessThanOrEqual(s.height);
      }
    }
  });

  it('refuses a strip of no frames, or of frames with no size, by name', () => {
    expect(() => stripLayout([], 1280, 800)).toThrow(/no frames/);
    expect(() => stripLayout([0], 0, 800)).toThrow(/frame of 0 by 800/);
  });

  it('shrinks a frame onto the strip by the mean of the pixels each tile pixel covers', () => {
    // a 2 by 2 frame: red, green, blue and white, to one pixel at (1, 0) of a 2 by 1 strip
    const frame = {
      width: 2,
      height: 2,
      data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
    };
    const strip = { width: 2, data: new Uint8Array(8) };
    shrinkInto(frame, strip, 1, 0, 1, 1);
    expect(Array.from(strip.data)).toEqual([0, 0, 0, 0, 128, 128, 128, 255]);
    // and a frame the tile's own size is copied as it is
    const same = { width: 2, data: new Uint8Array(16) };
    shrinkInto(frame, same, 0, 0, 2, 2);
    expect(Array.from(same.data)).toEqual(Array.from(frame.data));
  });
});

describe("the film's command line", () => {
  it('takes a scene, the seconds, a folder and a port', () => {
    expect(parseFilmArgs(['--scene', 'clear-day', '--seconds', '5'], SCENES, DEFAULTS)).toEqual({
      scene: 'clear-day',
      seconds: 5,
      out: 'node_modules/.cache/film/clear-day',
      port: 5299,
    });
    expect(
      parseFilmArgs(['--scene=half-boat', '--seconds=2.5', '--out', '/tmp/x', '--port', '5211'], SCENES, DEFAULTS),
    ).toEqual({ scene: 'half-boat', seconds: 2.5, out: '/tmp/x', port: 5211 });
  });

  it('films five seconds when the seconds are not asked for', () => {
    expect(parseFilmArgs(['--scene', 'standard'], SCENES, DEFAULTS).seconds).toBe(5);
  });

  it('refuses a scene it does not know by name, and says which there are', () => {
    expect(() => parseFilmArgs(['--scene', 'clear-dya'], SCENES, DEFAULTS)).toThrow(
      'no scene named "clear-dya": the scenes are standard, clear-day, half-boat',
    );
    expect(() => parseFilmArgs(['--seconds', '5'], SCENES, DEFAULTS)).toThrow(/--scene is needed/);
  });

  it('refuses seconds that are not a number of them, or too few to film or too many to keep', () => {
    for (const bad of ['five', '0', '-1', 'NaN', 'Infinity', '', '1e3', '0.001'])
      expect(() => parseFilmArgs(['--scene', 'standard', '--seconds', bad], SCENES, DEFAULTS), bad).toThrow(
        `--seconds "${bad}"`,
      );
    expect(parseFilmArgs(['--scene', 'standard', '--seconds', '60'], SCENES, DEFAULTS).seconds).toBe(60);
  });

  it('refuses a port that is not one, a flag it does not know, and a flag with nothing after it', () => {
    for (const bad of ['0', '70000', '52.5', 'x'])
      expect(() => parseFilmArgs(['--scene', 'standard', '--port', bad], SCENES, DEFAULTS), bad).toThrow(
        `--port "${bad}"`,
      );
    expect(() => parseFilmArgs(['--scene', 'standard', '--fps', '30'], SCENES, DEFAULTS)).toThrow('no option "--fps"');
    expect(() => parseFilmArgs(['--scene'], SCENES, DEFAULTS)).toThrow('--scene needs a value');
    expect(() => parseFilmArgs(['--scene', '--seconds', '5'], SCENES, DEFAULTS)).toThrow('--scene needs a value');
    expect(() => parseFilmArgs(['clear-day'], SCENES, DEFAULTS)).toThrow('no option "clear-day"');
  });
});
