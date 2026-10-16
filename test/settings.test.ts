/** The settings the address still holds, read as if anyone had written them, anything not known refused. */
import { describe, expect, it } from 'vitest';
import * as settings from '../src/settings';
import { DEFAULTS, changed, readSettings } from '../src/settings';

describe('the settings the address holds', () => {
  it('are the defaults from an empty address, and are the caustics and the paint only', () => {
    expect(readSettings(new URLSearchParams(''))).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ caustics: 'on', paint: 'on' });
  });

  it('are read from the address', () => {
    expect(readSettings(new URLSearchParams('caustics=off&paint=off'))).toEqual({ caustics: 'off', paint: 'off' });
  });

  it('refuse what they do not know, by name, keeping the default', () => {
    expect(readSettings(new URLSearchParams('caustics=sometimes&paint=maybe'))).toEqual(DEFAULTS);
    expect(readSettings(new URLSearchParams('paint=maybe')).paint).toBe('on');
    expect(readSettings(new URLSearchParams('paint=off')).paint).toBe('off');
    expect(readSettings(new URLSearchParams('paint=on')).paint).toBe('on');
    expect(readSettings(new URLSearchParams('caustics=')).caustics).toBe('on');
  });

  it('no longer say the game: an address from the lab, with its dirt, time and view, still opens the game, unread', () => {
    const old = readSettings(new URLSearchParams('dirt=0.25&time=dusk&view=boat&water=ripple&caustics=off'));
    expect(old).toEqual({ caustics: 'off', paint: 'on' });
    for (const gone of ['dirt', 'time', 'view', 'water']) expect(gone in old).toBe(false);
  });

  it('are never written back to the address', () => {
    expect('writeSettings' in settings).toBe(false);
  });

  it('take a change, and refuse what they do not know, keeping what they had', () => {
    const s = changed(DEFAULTS, { caustics: 'off' });
    expect(s).toEqual({ caustics: 'off', paint: 'on' });
    expect(changed(s, { paint: 'maybe', caustics: 'sometimes' })).toEqual(s);
    expect(changed(s, { paint: 'off' }).paint).toBe('off');
    // what the address used to hold is not a setting now, and a change that names it changes nothing
    expect(changed(s, { dirt: 0.3, time: 'dusk', view: 'boat' } as never)).toEqual(s);
  });
});
