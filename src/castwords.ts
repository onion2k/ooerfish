/**
 * The words on the cast's line, as a pure function of what the lure and the bite are doing. They were the page's own;
 * kept here they can be tested without a page, and the clean pond's words are said once, where the page and its test
 * both read them. Without them a player in a clean pond would wait for a fish that cannot come.
 */
import type { BitePhase } from './bite';
import type { LurePhase } from './lure';

export const CLEAN_WORDS = 'the pond is clean: nothing takes this bait';

export interface CastState {
  bite: BitePhase;
  lure: LurePhase;
  /** What a strike or a fish letting go said, while it is still being said; null once it is over. */
  heard: string | null;
  /** Every fish in the pond is cured. */
  clean: boolean;
  /** The bite is a two-headed fish's second window, or the nibble before it. */
  second: boolean;
  /** The reel is held on a snagged lure (`docs/boat.md`, C4); optional, so a caller with no snag to tell of need not say. */
  tugging?: boolean;
  /** The rod is propped (`docs/boat.md`, C5); optional, so a caller with no rest to tell of need not say. */
  propped?: boolean;
}

/** What is said for `HEARD_FOR` when the rod is propped or taken up. */
export const propWords = (on: boolean): string => (on ? 'the rod is propped' : 'rod in hand');

/** The line to show: the fight first, then what was heard, then what the lure is doing; empty for nothing to say. */
export function castWords(s: CastState): string {
  if (s.bite === 'hooked') return 'a fish on! hold to lift the zone, keep the fish in it';
  if (s.bite === 'biting' && s.propped) return 'the bell! a bite: strike now';
  if (s.bite === 'biting') return s.second ? 'the other head bites! strike now' : 'BITE! strike now';
  if (s.bite === 'nibbling') return s.second ? 'the other head nibbles… wait for the dip' : 'nibble… wait for the dip';
  if (s.heard !== null) return s.heard;
  if (s.lure === 'snagged') return s.tugging ? 'tugging…' : 'snagged in the reeds: hold to tug, let go to free it';
  if (s.lure === 'sinking' && s.propped) return 'rod propped: waiting for the bell…';
  if (s.lure === 'sinking') return s.clean ? CLEAN_WORDS : 'waiting for a fish…';
  if (s.lure === 'lying') return 'on the bank: reel it in';
  return '';
}
