/**
 * Which of the page's three layouts a screen takes, by its shape and not its width: a phone held upright and a
 * tablet are both taller than wide, and a phone on its side is wide but short. It is said here once, as sums, so the
 * page can set it on the document for the CSS to key off and the test API can read it back; a rule written again in
 * a stylesheet would drift from this one without anything noticing.
 */

/** A screen no taller than this, and not taller than it is wide, is a phone held sideways. */
export const SIDEWAYS_MAX_HEIGHT = 500;

export type Layout = 'portrait' | 'sideways' | 'desk';

/** The layout for a screen of this many CSS pixels: portrait if taller than wide, sideways if short, else the desk's. */
export function layoutFor(width: number, height: number): Layout {
  if (height > width) return 'portrait';
  return height <= SIDEWAYS_MAX_HEIGHT ? 'sideways' : 'desk';
}
