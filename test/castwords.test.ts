/** The cast line's words: what the bite and the lure are doing, as the page said them before. */
import { describe, expect, it } from 'vitest';
import { castWords, type CastState } from '../src/castwords';

const state = (over: Partial<CastState> = {}): CastState => ({ bite: 'none', lure: 'sinking', heard: null, ...over });

describe('the cast line', () => {
  it('waits for a fish while the lure sinks, says nothing before a cast and asks for a lure on the bank to be reeled in', () => {
    expect(castWords(state())).toBe('waiting for a fish…');
    expect(castWords(state({ lure: 'ready' }))).toBe('');
    expect(castWords(state({ lure: 'lying' }))).toBe('on the bank: reel it in');
  });

  it('keeps a strike’s own words over what the lure is doing', () => {
    expect(castWords(state({ heard: 'missed' }))).toBe('missed');
  });

  it('says the fish’s part of the fight before anything else', () => {
    expect(castWords(state({ bite: 'biting', heard: 'missed' }))).toBe('BITE! strike now');
    expect(castWords(state({ bite: 'nibbling' }))).toBe('nibble… wait for the dip');
    expect(castWords(state({ bite: 'hooked' }))).toBe('a fish on! hold to lift the zone, keep the fish in it');
  });
});
