/** The lab's settings, read from the address and written back to it, anything not known refused. */
import { describe, expect, it } from 'vitest';
import { DEFAULTS, changed, readSettings, writeSettings } from '../src/settings';

describe("the lab's settings", () => {
  it('are the defaults from an empty address', () => {
    expect(readSettings(new URLSearchParams(''))).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ dirt: 1, time: 'day', view: 'shore', caustics: 'on', paint: 'on' });
  });

  it('are read from the address', () => {
    expect(readSettings(new URLSearchParams('dirt=0.25&time=dusk&view=boat&caustics=off&paint=off'))).toEqual({
      dirt: 0.25,
      time: 'dusk',
      view: 'boat',
      caustics: 'off',
      paint: 'off',
    });
  });

  it('refuse what they do not know, by name, keeping the default', () => {
    const s = readSettings(new URLSearchParams('dirt=lots&time=teatime&view=moon&caustics=sometimes&paint=maybe'));
    expect(s).toEqual(DEFAULTS);
    // the paint, by name: on and off are known, and nothing else is
    expect(readSettings(new URLSearchParams('paint=maybe')).paint).toBe('on');
    expect(readSettings(new URLSearchParams('paint=off')).paint).toBe('off');
    expect(readSettings(new URLSearchParams('paint=on')).paint).toBe('on');
    expect(readSettings(new URLSearchParams('dirt=7')).dirt).toBe(1);
    expect(readSettings(new URLSearchParams('dirt=-2')).dirt).toBe(0);
    expect(readSettings(new URLSearchParams('dirt=')).dirt).toBe(DEFAULTS.dirt);
  });

  it('come back as they went, through the address', () => {
    const s = { dirt: 0.4, time: 'night', view: 'overhead', caustics: 'off', paint: 'off' } as const;
    const back = readSettings(new URLSearchParams(writeSettings(s, new URLSearchParams('seed=3&paused=1'))));
    expect(back).toEqual(s);
    // what else the address said is kept
    const query = new URLSearchParams(writeSettings(s, new URLSearchParams('seed=3&paused=1')));
    expect(query.get('seed')).toBe('3');
    expect(query.has('paused')).toBe(true);
  });

  it('take a change, and refuse what they do not know, keeping what they had', () => {
    const s = changed(DEFAULTS, { dirt: 0.3 });
    expect(s).toEqual({ ...DEFAULTS, dirt: 0.3 });
    expect(changed(s, { time: 'teatime', view: 'moon', dirt: Number.NaN })).toEqual(s);
    expect(changed(s, { dirt: 9 }).dirt).toBe(1);
    expect(changed(s, { paint: 'off' }).paint).toBe('off');
    expect(changed(s, { paint: 'maybe' })).toEqual(s);
  });

  it('have no choice of water: the lake is seen into, and an address from before that said one still loads', () => {
    const old = readSettings(new URLSearchParams('water=ripple&dirt=0.5'));
    expect(old).toEqual({ ...DEFAULTS, dirt: 0.5 });
    expect('water' in old).toBe(false);
  });
});
