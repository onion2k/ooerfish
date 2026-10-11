/**
 * The rung the page is drawn on: `full`, with the banks' grass, or `lean`, without it, for a GPU that cannot draw it
 * inside the frame budget. The grass is the one thing it takes away: measured on 11 October 2026 (standard scene,
 * five fresh pages each), the grass costs about a millisecond (3.0 ms with it, 2.0 without) and the woodland of two
 * hundred and ten low-poly trees about a tenth of one (2.03 ms with, 1.91 without), well under the 0.3 ms it would
 * take to be worth dropping, so the trees stand on both. The governor picks one at boot from a frame measured there;
 * the decision is a sum on that number so it can be held without a GPU, and what the address may ask for is read here
 * too, since an unknown name must be refused and not guessed at. Without this a slow machine would be given the grass
 * anyway, and a test could not put the page on either rung.
 */
import { RUNG_DOWN_MS } from './lake';

export const RUNGS = ['full', 'lean'] as const;
export type Rung = (typeof RUNGS)[number];

/**
 * The rung for a frame that took `ms` to draw at boot. A reading that is not a positive finite number says nothing
 * (nothing was drawn, or the clock could not see it), and a machine is not stepped down on no evidence.
 */
export function rungFor(ms: number): Rung {
  if (!Number.isFinite(ms) || ms <= 0) return 'full';
  return ms > RUNG_DOWN_MS ? 'lean' : 'full';
}

/** What `?rung=` in the address asks for: a rung by name, `auto` for the governor to choose, and anything else refused. */
export function rungAsked(value: string | null): Rung | 'auto' {
  if (value === null) return 'auto';
  if ((RUNGS as readonly string[]).includes(value)) return value as Rung;
  throw new Error(`unknown rung "${value}": ${RUNGS.join(' or ')}`);
}

/**
 * How the governor measures the frame at boot: the GPU kept drawing for a hundred milliseconds (it has sat idle while
 * the page booted, and an idle one runs slow), then the least of five samples of ten frames at the least. The least
 * is the frame's own cost, since whatever else the machine is doing only adds to a sample, and a frame too dear for
 * the budget is dear in every one of them. Read on eight fresh pages of this machine at the standard scene, the full
 * rung's frame was 6.71 to 6.92 ms, a wobble of 3%, against the budget's 8. It costs the boot about half a second:
 * the test API's `measureFrame` takes three, with twenty-four samples, and reads finer.
 */
export const BOOT_MEASURE = { warmMs: 100, samples: 5 } as const;
