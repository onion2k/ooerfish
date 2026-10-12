/**
 * The two waterfalls down the cliff, as they are drawn: for each notch in the crest a thin strip of rippling water
 * running from the lip down to just under the lake's surface, leaning a little out from the face so the rock does not
 * cover it, a white disc of foam where it lands, and the mist thrown up there. They are the page's picture and the
 * game knows nothing of them: no fish is affected, and a lure cast into one is only in the water. Where the notches
 * are is the lake's (`CLIFF.notches`), so the strip, the channel it runs in and the lumps that keep clear of it
 * are held to one place; what is here is how the water looks and moves.
 *
 * The renderer's clock runs at the water's pace (`WATER_PACE`), slow for a calm pond, so a fall's flow is made
 * faster by its inverse to seem to fall at the speed it is given. Without that the water would drift down the wall.
 */
import { FLOW_RIPPLE, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import type { Emit } from 'artshape-render/game/particles';
import { MIST, mist } from './bursts';
import { CLIFF, NOTCHES, WATER_PACE, groundUnder, inward } from './lake';
import { box, disc } from './meshes';
import { PALETTE } from './palette';

/** How fast each fall seems to fall, in world units a second of the game's clock: the wide one slower, the narrow one quicker. */
const SPEEDS = [7, 8.5] as const;

/** A fall: where it comes down, as wide as the notch it runs in, and how fast it seems to fall. */
export const FALLS = CLIFF.notches.map(({ angle, width }, i) => ({ angle, width, speed: SPEEDS[i] }));

/** The water's look: its ripples' size, how much it glows from itself, how thick the strip is, and the foam's height over the surface. */
const LOOK = { scale: 0.5, glow: 0.35, thick: 0.3, foamHeight: 0.08 } as const;
/** How far past the shore the strip lands, onto the water, and how far under the surface it ends. */
const LANDS = 0.8;
const UNDER = 0.3;

type V3 = [number, number, number];

/** A fall's strip placed: its top at the lip and bottom under the surface, its foot on the water, and the frame it is drawn in. */
export interface FallFrame {
  top: V3;
  bottom: V3;
  /** Where the water lands on the surface, in plan: the foam and the mist are here. */
  foot: [number, number];
  /** How long the strip is, top to bottom. */
  length: number;
  /** Column-major: x down the fall, y along the cliff, z out toward the lake. */
  matrix: Float32Array;
}

/** The frames of the strips, one for each fall, worked out from the notches. */
export function fallFrames(): FallFrame[] {
  return NOTCHES.map((n) => {
    // the lip: out along the notch's line from the shore to where the wall tops out
    let px = n.x,
      py = n.y;
    for (let s = 0; s < 4000 && 1 - inward(px, py) < CLIFF.top; s++) {
      px = n.x - n.inward[0] * s * 0.02;
      py = n.y - n.inward[1] * s * 0.02;
    }
    const top: V3 = [px, py, groundUnder(px, py)];
    // lands a little onto the water, and goes on to a hand under the surface, on the line from the lip
    const wx = n.x + n.inward[0] * LANDS,
      wy = n.y + n.inward[1] * LANDS;
    const lean = UNDER / top[2];
    const bottom: V3 = [wx + (wx - px) * lean, wy + (wy - py) * lean, -UNDER];
    const dx = bottom[0] - top[0],
      dy = bottom[1] - top[1],
      dz = bottom[2] - top[2];
    const length = Math.hypot(dx, dy, dz);
    const down: V3 = [dx / length, dy / length, dz / length];
    const along: V3 = [n.along[0], n.along[1], 0];
    // out from the face, so the frame is right-handed
    const out: V3 = [
      down[1] * along[2] - down[2] * along[1],
      down[2] * along[0] - down[0] * along[2],
      down[0] * along[1] - down[1] * along[0],
    ];
    const mid: V3 = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2];
    const matrix = new Float32Array([...down, 0, ...along, 0, ...out, 0, ...mid, 1]);
    return { top, bottom, foot: [wx, wy], length, matrix };
  });
}

/** What the fall draws: a strip of rippling water for each, and one group of the foam discs where they land. */
export function fallGroups(): GameGroup[] {
  const frames = fallFrames();
  const groups: GameGroup[] = frames.map((f, i) => ({
    mesh: box(f.length, FALLS[i].width, LOOK.thick, true),
    matrices: f.matrix,
    albedo: PALETTE.fallWater,
    roughness: 0.3,
    // the renderer's clock is slower than the game's by the water's pace, so the flow is faster by it
    patterns: packFlow(new Float32Array(PATTERN_STRIDE), 0, {
      kind: FLOW_RIPPLE,
      scale: LOOK.scale,
      speed: FALLS[i].speed / WATER_PACE,
      glow: LOOK.glow,
      second: [0.95, 0.98, 1],
    }),
  }));
  const foam = new Float32Array(frames.length * 16);
  frames.forEach((f, i) => {
    const r = FALLS[i].width * 0.8;
    foam.set(
      [
        r,
        0,
        0,
        0,
        0,
        r,
        0,
        0,
        0,
        0,
        1,
        0,
        f.foot[0] + NOTCHES[i].inward[0] * 0.3,
        f.foot[1] + NOTCHES[i].inward[1] * 0.3,
        LOOK.foamHeight,
        1,
      ],
      i * 16,
    );
  });
  groups.push({ mesh: disc(1, 24), matrices: foam, albedo: PALETTE.foam, roughness: 0.9 });
  return groups;
}

/** The mist each fall throws up at its foot, made once: the page hands the same Emit to the renderer each time it is due. */
export function fallMists(): Emit[] {
  return fallFrames().map((f, i) => mist(f.foot[0], f.foot[1], NOTCHES[i].inward[0], NOTCHES[i].inward[1]));
}

/**
 * Whether fall `i` throws its mist on the game's frame number `frame`: every `MIST.every` frames, the falls a share of
 * that apart so it is not thrown in a lump. Counted from the game's own frame, so a paused lake throws none and a test
 * that steps it throws the same every run.
 */
export function mistDue(frame: number, i: number): boolean {
  return (frame + i * Math.floor(MIST.every / FALLS.length)) % MIST.every === 0;
}
