/** The page's mode, look or cast: what each event does to it and to the camera, and what the page says of it. */
import { describe, expect, it } from 'vitest';
import { nextMode, orbits, wording, type Mode, type ModeEvent } from '../src/mode';

describe('the mode of the page', () => {
  it('switches by the button or the key, to cast with the camera put at the shore, and back with it left where it is', () => {
    expect(nextMode('look', 'toggle')).toEqual({ mode: 'cast', camera: 'shore' });
    expect(nextMode('cast', 'toggle')).toEqual({ mode: 'look', camera: 'keep' });
  });

  it('is put in a mode by name, and cast is always at the shore, look never moves the camera', () => {
    for (const from of ['look', 'cast'] as const) {
      expect(nextMode(from, 'cast')).toEqual({ mode: 'cast', camera: 'shore' });
      expect(nextMode(from, 'look')).toEqual({ mode: 'look', camera: 'keep' });
    }
  });

  it('is look after a view is picked on the panel, whichever it was, and the picked view is where the camera goes', () => {
    for (const from of ['look', 'cast'] as const)
      expect(nextMode(from, 'view')).toEqual({ mode: 'look', camera: 'keep' });
  });

  it('is only ever one of the two, whatever the events', () => {
    const events: ModeEvent[] = ['toggle', 'cast', 'look', 'view'];
    let mode: Mode = 'look';
    for (let k = 0; k < 64; k++) {
      mode = nextMode(mode, events[(k * 7 + (k >> 2)) % events.length]).mode;
      expect(['look', 'cast']).toContain(mode);
    }
  });

  it('turns the camera by a drag in look and holds it still in cast, where a drag aims', () => {
    expect(orbits('look')).toBe(true);
    expect(orbits('cast')).toBe(false);
  });

  it('says on the button what it does next, and on the hint what a drag does now', () => {
    expect(wording('look').button).toBe('Cast');
    expect(wording('cast').button).toBe('Look round');
    expect(wording('look').hint).toMatch(/drag to look round/);
    expect(wording('cast').hint).toMatch(/drag back to cast/);
    // each tells of the key that switches
    expect(wording('look').hint).toMatch(/C /);
    expect(wording('cast').hint).toMatch(/C /);
  });
});
