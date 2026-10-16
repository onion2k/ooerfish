/** The phone's large word: what the next gesture does, from the bite's phase and the lure's. */
import { describe, expect, it } from 'vitest';
import type { BitePhase } from '../src/bite';
import type { LurePhase } from '../src/lure';
import { WORDS } from '../src/phone/protocol';
import { phoneWord } from '../src/phone/word';

describe('the phone’s word', () => {
  it('says Cast while the lure is on the rod or lying on the bank', () => {
    expect(phoneWord('none', 'ready')).toBe('Cast');
    expect(phoneWord('none', 'lying')).toBe('Cast');
  });

  it('says Strike! while the strike’s window is open, Reel while hooked, and Tap the catch when landed', () => {
    expect(phoneWord('biting', 'sinking')).toBe('Strike!');
    expect(phoneWord('hooked', 'hooked')).toBe('Reel');
    expect(phoneWord('landed', 'ready')).toBe('Tap the catch');
  });

  it('says nothing while the lure flies, or sinks and waits, a fish coming or nibbling', () => {
    expect(phoneWord('none', 'flying')).toBe('');
    expect(phoneWord('none', 'sinking')).toBe('');
    expect(phoneWord('coming', 'sinking')).toBe('');
    expect(phoneWord('nibbling', 'sinking')).toBe('');
  });

  it('gives a word the protocol knows for every pair of phases', () => {
    const bites: BitePhase[] = ['none', 'coming', 'nibbling', 'biting', 'hooked', 'landed'];
    const lures: LurePhase[] = ['ready', 'flying', 'sinking', 'lying', 'hooked'];
    for (const b of bites) for (const l of lures) expect(WORDS).toContain(phoneWord(b, l));
  });
});
