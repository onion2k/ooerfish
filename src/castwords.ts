/**
 * The words on the cast's line, as a pure function of what the lure and the bite are doing. They were the page's own;
 * kept here they can be tested without a page, and said once, where the page and its test both read them.
 */
import type { BitePhase } from './bite';
import type { LurePhase } from './lure';

export interface CastState {
  bite: BitePhase;
  lure: LurePhase;
  /** What a strike or a fish letting go said, while it is still being said; null once it is over. */
  heard: string | null;
}

/** The line to show: the fight first, then what was heard, then what the lure is doing; empty for nothing to say. */
export function castWords(s: CastState): string {
  if (s.bite === 'hooked') return 'a fish on! hold to lift the zone, keep the fish in it';
  if (s.bite === 'biting') return 'BITE! strike now';
  if (s.bite === 'nibbling') return 'nibble… wait for the dip';
  if (s.heard !== null) return s.heard;
  if (s.lure === 'sinking') return 'waiting for a fish…';
  if (s.lure === 'lying') return 'on the bank: reel it in';
  return '';
}
