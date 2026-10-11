/**
 * How the perf gate judges a figure against its baseline, apart from the
 * browser so that it can be tested without one: see `smoke/perf.spec.ts`.
 * Run only whole, on the GPU, a judgement that lets a change through looks
 * the same as one that passes.
 */

import { PNG } from 'pngjs';

/** The figures the perf gate holds. */
export interface Figures {
  bootMs: number;
  frameMs: number;
  bundleBytes: number;
  /** The scenery kit's files in dist/scenery, each gzipped alone, in bytes. */
  sceneryBytes: number;
}

/**
 * How far a figure may move from the baseline, either way, before it is a
 * change: a share, and a slack for a figure too small to share.
 *
 * The frame read 0.171 to 0.178 ms over forty pages just booted, 4% highest
 * over lowest, on an M4 Pro with other sessions at work on it: 15% is
 * between three and four times that, and its slack is a hundredth of a
 * millisecond. The 0.6 ms it had was three times the frame, and let one
 * through at half its baseline and at three times it.
 *
 * The download is held to the byte. The build gives the same bytes every
 * time, so there is no wobble to allow for, and with a tenth allowed three
 * games' downloads crept up a kilobyte at a time until a change that had
 * nothing to do with it tripped the gate. A change that moves it writes the
 * baseline again, and says so.
 */
export const TOLERANCE: Record<keyof Figures, readonly [number, number]> = {
  bootMs: [0.35, 250],
  frameMs: [0.15, 0.01],
  bundleBytes: [0, 0],
  // a built file is the same bytes every time, as the download is
  sceneryBytes: [0, 0],
};

/** Whether a figure has moved from its baseline by more than its tolerance. */
export function moved(key: keyof Figures, was: number, now: number): boolean {
  const [share, slack] = TOLERANCE[key];
  return Math.abs(now - was) > Math.max(Math.abs(was) * share, slack);
}

/**
 * How many pixels of a picture may differ between two draws of the very same moment, in a scene with grass. The
 * renderer's grass is written to the GPU's blade list by an atomic counter, so its blades are drawn in no fixed
 * order, and where two meet at the same depth the one drawn last wins: a pixel or two of the far bank flickers
 * between draws, though the game's state is the same to the bit. Measured on 24 draws each of four scenes (clear day
 * and sick night from the shore, half-clean from overhead and from the boat), six fresh pages apiece: at most one
 * pixel in a million differed by more than 5 of 255 in a channel, and most draws had none.
 * Eight is eight times that, and a hundredth of a button: a small button over the picture is hundreds.
 */
export const GRASS_WOBBLE = 8;

/**
 * How many pixels of two PNGs differ by more than `per` of 255 in any channel: the measure that tells the grass's
 * wobble from a change in the picture, where byte-for-byte equality, which held before the grass, no longer does.
 * Pictures of different sizes are wholly apart.
 */
export function pixelsApart(a: Buffer, b: Buffer, per = 5): number {
  const A = PNG.sync.read(a),
    B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return A.width * A.height;
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4)
    if (
      Math.abs(A.data[i] - B.data[i]) > per ||
      Math.abs(A.data[i + 1] - B.data[i + 1]) > per ||
      Math.abs(A.data[i + 2] - B.data[i + 2]) > per
    )
      n++;
  return n;
}
