/** The cast line's words: what the lure is doing, and in a clean pond that nothing will take the bait. */
import { describe, expect, it } from 'vitest';
import { CLEAN_WORDS, castWords, propWords, type CastState } from '../src/castwords';

const state = (over: Partial<CastState> = {}): CastState => ({
  bite: 'none',
  lure: 'sinking',
  heard: null,
  clean: false,
  second: false,
  ...over,
});

describe('the cast line', () => {
  it('waits for a fish while the lure sinks in a pond that still has some', () => {
    expect(castWords(state())).toBe('waiting for a fish…');
  });

  it('says the pond is clean, and nothing takes this bait, when the lure sinks in a clean pond', () => {
    expect(CLEAN_WORDS).toBe('the pond is clean: nothing takes this bait');
    expect(castWords(state({ clean: true }))).toBe(CLEAN_WORDS);
    expect(castWords(state({ clean: false }))).not.toBe(CLEAN_WORDS);
  });

  it('keeps a strike’s own words over the clean pond’s, and says nothing of waiting before a cast', () => {
    expect(castWords(state({ clean: true, heard: 'missed' }))).toBe('missed');
    expect(castWords(state({ clean: true, lure: 'ready' }))).toBe('');
    expect(castWords(state({ clean: true, lure: 'lying' }))).toBe('on the bank: reel it in');
  });

  it('says the fish’s part of the fight as before', () => {
    expect(castWords(state({ bite: 'biting' }))).toBe('BITE! strike now');
    expect(castWords(state({ bite: 'nibbling' }))).toBe('nibble… wait for the dip');
    expect(castWords(state({ bite: 'hooked' }))).toBe('a fish on! hold to lift the zone, keep the fish in it');
  });

  it('says the other head’s turn in the trout’s second window', () => {
    expect(castWords(state({ bite: 'biting', second: true }))).toBe('the other head bites! strike now');
    expect(castWords(state({ bite: 'nibbling', second: true }))).toBe('the other head nibbles… wait for the dip');
    expect(castWords(state({ bite: 'biting' }))).toBe('BITE! strike now');
  });
});

describe('the cast line while snagged (`docs/boat.md`, C4)', () => {
  it('says to hold to tug and let go to free it, and “tugging…” while the reel is held', () => {
    expect(castWords(state({ lure: 'snagged' }))).toBe('snagged in the reeds: hold to tug, let go to free it');
    expect(castWords(state({ lure: 'snagged', tugging: true }))).toBe('tugging…');
    expect(castWords(state({ lure: 'snagged', tugging: false }))).toBe(
      'snagged in the reeds: hold to tug, let go to free it',
    );
  });

  it('keeps a heard line (the free, for one) over the snag’s, as it does over the waiting', () => {
    expect(castWords(state({ lure: 'snagged', heard: 'missed' }))).toBe('missed');
  });

  it('does not say it of a lure that is not snagged, whatever tugging says', () => {
    expect(castWords(state({ lure: 'sinking', tugging: true }))).toBe('waiting for a fish…');
  });
});

describe('the cast line while the rod is propped (`docs/boat.md`, C5)', () => {
  it('waits for the bell, not for a fish, and says the bell on a bite', () => {
    expect(castWords(state({ propped: true }))).toBe('rod propped: waiting for the bell…');
    expect(castWords(state({ propped: true, clean: true }))).toBe('rod propped: waiting for the bell…');
    expect(castWords(state({ propped: true, bite: 'biting' }))).toBe('the bell! a bite: strike now');
  });

  it('is as it was with the rod in hand, said or not', () => {
    expect(castWords(state({ propped: false }))).toBe('waiting for a fish…');
    expect(castWords(state({ propped: false, bite: 'biting' }))).toBe('BITE! strike now');
    expect(castWords(state({ bite: 'biting' }))).toBe('BITE! strike now');
  });

  it('keeps a heard line, a nibble and the fight over the waiting', () => {
    expect(castWords(state({ propped: true, heard: 'missed' }))).toBe('missed');
    expect(castWords(state({ propped: true, bite: 'nibbling' }))).toBe('nibble… wait for the dip');
    expect(castWords(state({ propped: true, bite: 'hooked' }))).toBe(
      'a fish on! hold to lift the zone, keep the fish in it',
    );
  });

  it('says what a prop and a take-up did, to be heard for a while', () => {
    expect(propWords(true)).toBe('the rod is propped');
    expect(propWords(false)).toBe('rod in hand');
  });
});
