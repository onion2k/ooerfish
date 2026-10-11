/**
 * The rung the page draws on: full, with the banks' grass, or lean, without it. The governor's
 * decision is a pure sum on a measured frame, so it is held here without a GPU; the measuring itself is the smoke
 * test's. A governor that stepped down a machine that was fast enough would take the grass away for nothing, and one
 * that never stepped down would leave a slow machine below its frame rate.
 */
import { describe, expect, it } from 'vitest';
import { RUNG_DOWN_MS } from '../src/lake';
import { RUNGS, rungAsked, rungFor } from '../src/rung';

describe('the governor', () => {
  it('draws the full rung on a frame inside the budget, and at it', () => {
    expect(rungFor(3)).toBe('full');
    expect(rungFor(RUNG_DOWN_MS)).toBe('full');
  });

  it('steps down to lean on a frame over the budget', () => {
    expect(rungFor(RUNG_DOWN_MS + 0.001)).toBe('lean');
    expect(rungFor(20)).toBe('lean');
  });

  it('steps down at the budget the page is held to, 8 ms', () => {
    expect(RUNG_DOWN_MS).toBe(8);
  });

  it('keeps the full rung where nothing was measured: no reading is not a slow one', () => {
    expect(rungFor(0)).toBe('full');
    expect(rungFor(NaN)).toBe('full');
    expect(rungFor(Infinity)).toBe('full');
  });
});

describe('the rung the address asks for', () => {
  it('is left to the governor when it does not ask', () => {
    expect(rungAsked(null)).toBe('auto');
  });

  it('is the one it names, of the rungs there are', () => {
    expect(RUNGS).toEqual(['full', 'lean']);
    expect(rungAsked('full')).toBe('full');
    expect(rungAsked('lean')).toBe('lean');
  });

  it('refuses what it does not know, by name', () => {
    expect(() => rungAsked('thin')).toThrow(/thin/);
    expect(() => rungAsked('')).toThrow();
  });
});
