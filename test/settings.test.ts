/** The lab's settings, read from the address and written back to it, anything not known refused. */
import { describe, expect, it } from 'vitest';
import { DEFAULTS, changed, readSettings, writeSettings } from '../src/settings';

describe("the lab's settings", () => {
  it('are the defaults from an empty address', () => {
    expect(readSettings(new URLSearchParams(''))).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ water: 'open', dirt: 1, time: 'day', view: 'shore', caustics: 'on' });
  });

  it('are read from the address', () => {
    expect(readSettings(new URLSearchParams('water=clear&dirt=0.25&time=dusk&view=boat&caustics=off'))).toEqual({
      water: 'clear',
      dirt: 0.25,
      time: 'dusk',
      view: 'boat',
      caustics: 'off',
    });
  });

  it('refuse what they do not know, by name, keeping the default', () => {
    const s = readSettings(new URLSearchParams('water=lava&dirt=lots&time=teatime&view=moon&caustics=sometimes'));
    expect(s).toEqual(DEFAULTS);
    expect(readSettings(new URLSearchParams('dirt=7')).dirt).toBe(1);
    expect(readSettings(new URLSearchParams('dirt=-2')).dirt).toBe(0);
    expect(readSettings(new URLSearchParams('dirt=')).dirt).toBe(DEFAULTS.dirt);
  });

  it('come back as they went, through the address', () => {
    const s = { water: 'ripple', dirt: 0.4, time: 'night', view: 'overhead', caustics: 'off' } as const;
    const back = readSettings(new URLSearchParams(writeSettings(s, new URLSearchParams('seed=3&paused=1'))));
    expect(back).toEqual(s);
    // what else the address said is kept
    const query = new URLSearchParams(writeSettings(s, new URLSearchParams('seed=3&paused=1')));
    expect(query.get('seed')).toBe('3');
    expect(query.has('paused')).toBe(true);
  });

  it('take a change, and refuse what they do not know, keeping what they had', () => {
    const s = changed(DEFAULTS, { water: 'ripple', dirt: 0.3 });
    expect(s).toEqual({ ...DEFAULTS, water: 'ripple', dirt: 0.3 });
    expect(changed(s, { water: 'lava', time: 'teatime', view: 'moon', dirt: Number.NaN })).toEqual(s);
    expect(changed(s, { dirt: 9 }).dirt).toBe(1);
  });
});
