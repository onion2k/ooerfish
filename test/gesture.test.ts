/** The gesture rules: what a pointer, the space key, the Strike/Reel button and the window's blur each do to the game. */
import { describe, expect, it } from 'vitest';
import { aimFrom } from '../src/aim';
import { Gesture, TAP_MS, TAP_PX, TAP_SHARE, type GestureEvent, type GestureTarget } from '../src/gesture';
import { PHONE } from '../src/lake';
import type { Mode } from '../src/mode';

/** A target that records the calls made on it, with the mode and phases it is told to report. */
function fake(mode: Mode = 'cast') {
  const calls: string[] = [];
  const state = { mode, bite: 'none', lure: 'ready', short: 800, heading: 0.5, strikeHooks: false, rowing: false };
  const target: GestureTarget = {
    cast: (angle, power) => calls.push(`cast ${angle.toFixed(4)} ${power.toFixed(4)}`),
    strike: () => {
      calls.push('strike');
      if (state.strikeHooks) state.bite = 'hooked';
    },
    reel: (on) => calls.push(`reel ${on}`),
    setAim: (aim) => calls.push(aim ? `aim ${aim.angle.toFixed(4)} ${aim.power.toFixed(4)}` : 'aim off'),
    pebble: (x, y) => calls.push(`pebble ${x} ${y}`),
    mode: () => state.mode,
    bitePhase: () => state.bite,
    lurePhase: () => state.lure,
    rowing: () => state.rowing,
    view: () => ({ short: state.short, heading: state.heading }),
    wantCast: () => {
      calls.push('want cast');
      state.mode = 'cast';
    },
  };
  return { calls, state, gesture: new Gesture(target, PHONE) };
}

const down = (x: number, y: number, at = 0) => ({ type: 'down', source: 'screen', x, y, at }) as const;
const move = (x: number, y: number, at = 10) => ({ type: 'move', source: 'screen', x, y, at }) as const;
const up = (x: number, y: number, at = 50) => ({ type: 'up', source: 'screen', x, y, at }) as const;
const cancel = { type: 'cancel', source: 'screen', x: 0, y: 0, at: 0 } as const;

describe('the screen', () => {
  it('reels for as long as it is held with a fish hooked, in cast mode', () => {
    const { calls, state, gesture } = fake('cast');
    state.bite = 'hooked';
    gesture.handle(down(100, 100));
    expect(calls).toEqual(['reel true']);
    gesture.handle(move(300, 300));
    gesture.handle(up(300, 300, 900));
    expect(calls).toEqual(['reel true', 'reel false']);
  });

  it('does not reel in look mode with a fish hooked', () => {
    const { calls, state, gesture } = fake('look');
    state.bite = 'hooked';
    gesture.handle(down(100, 100));
    gesture.handle(up(100, 100, 20));
    expect(calls).not.toContain('reel true');
  });

  it('aims as a drag back goes, and lets go casts it through aimFrom', () => {
    const { calls, gesture } = fake('cast');
    gesture.handle(down(400, 300));
    gesture.handle(move(400, 400));
    const want = aimFrom(0, 100, 800, 0.5)!;
    expect(calls).toEqual([`aim ${want.angle.toFixed(4)} ${want.power.toFixed(4)}`]);
    gesture.handle(up(400, 400));
    expect(calls.slice(1)).toEqual(['aim off', `cast ${want.angle.toFixed(4)} ${want.power.toFixed(4)}`]);
  });

  it('casts nothing when let go in the dead zone, and takes the aim back', () => {
    const { calls, gesture } = fake('cast');
    gesture.handle(down(400, 300));
    gesture.handle(move(400, 340));
    gesture.handle(move(400, 300));
    gesture.handle(up(400, 300, 5000));
    expect(calls.filter((c) => c.startsWith('cast'))).toEqual([]);
    expect(calls.at(-1)).toBe('aim off');
  });

  it('does not aim in look mode', () => {
    const { calls, gesture } = fake('look');
    gesture.handle(down(400, 300));
    gesture.handle(move(400, 500));
    gesture.handle(up(400, 500, 5000));
    expect(calls).toEqual([]);
  });

  it('strikes on a tap while the lure is sinking in cast mode', () => {
    const { calls, state, gesture } = fake('cast');
    state.lure = 'sinking';
    gesture.handle(down(200, 200));
    gesture.handle(up(202, 201, 100));
    expect(calls).toEqual(['aim off', 'strike']);
  });

  it('drops a pebble at the tapped point in cast mode otherwise, and in look mode even with the lure sinking', () => {
    const a = fake('cast');
    a.gesture.handle(down(200, 200));
    a.gesture.handle(up(200, 200, 100));
    expect(a.calls).toEqual(['aim off', 'pebble 200 200']);
    const b = fake('look');
    b.state.lure = 'sinking';
    b.gesture.handle(down(210, 220));
    b.gesture.handle(up(210, 220, 100));
    expect(b.calls).toEqual(['pebble 210 220']);
  });

  it('does nothing for a tap too long or moved too far in look mode', () => {
    const slow = fake('look');
    slow.gesture.handle(down(200, 200, 0));
    slow.gesture.handle(up(200, 200, TAP_MS + 1));
    const far = fake('look');
    far.gesture.handle(down(200, 200, 0));
    far.gesture.handle(up(200 + TAP_PX + 1, 200, 50));
    const edge = fake('look');
    edge.gesture.handle(down(200, 200, 0));
    edge.gesture.handle(up(200 + TAP_PX, 200, TAP_MS));
    expect(slow.calls).toEqual([]);
    expect(far.calls).toEqual([]);
    expect(edge.calls).toEqual(['pebble 206 200']);
  });

  it('does nothing for an up with no down', () => {
    const { calls, gesture } = fake('look');
    gesture.handle(up(10, 10));
    expect(calls).toEqual([]);
  });

  it('clears the aim and lets go on a cancel, and the drag no longer casts', () => {
    const { calls, state, gesture } = fake('cast');
    gesture.handle(down(400, 300));
    gesture.handle(move(400, 500));
    gesture.handle(cancel);
    expect(calls.slice(1)).toEqual(['aim off']);
    gesture.handle(up(400, 500, 5000));
    expect(calls.filter((c) => c.startsWith('cast'))).toEqual([]);
    // a held reel is let go by a cancel too
    const held = fake('cast');
    held.state.bite = 'hooked';
    held.gesture.handle(down(1, 1));
    held.gesture.handle(cancel);
    expect(held.calls).toEqual(['reel true', 'aim off', 'reel false']);
    expect(state.mode).toBe('cast');
  });

  it('drops the aim and a screen hold on leaving cast', () => {
    const { calls, gesture } = fake('cast');
    gesture.handle(down(400, 300));
    gesture.handle(move(400, 500));
    gesture.handle({ type: 'left-cast' });
    expect(calls.slice(1)).toEqual(['aim off']);
    gesture.handle(up(400, 500, 5000));
    expect(calls.filter((c) => c.startsWith('cast'))).toEqual([]);
    const held = fake('cast');
    held.state.bite = 'hooked';
    held.gesture.handle(down(1, 1));
    held.gesture.handle({ type: 'left-cast' });
    expect(held.calls).toEqual(['reel true', 'aim off', 'reel false']);
    // with nothing held, leaving cast does not touch the reel
    const idle = fake('cast');
    idle.gesture.handle({ type: 'left-cast' });
    expect(idle.calls).toEqual(['aim off']);
  });
});

describe('the keys, the button and the window', () => {
  it('strikes on space once, not on repeat, with no fish hooked', () => {
    const { calls, gesture } = fake('look');
    gesture.handle({ type: 'press', source: 'key', repeat: false });
    gesture.handle({ type: 'press', source: 'key', repeat: true });
    expect(calls).toEqual(['strike']);
  });

  it('reels on space with a fish hooked, again on repeat', () => {
    const { calls, state, gesture } = fake('cast');
    state.bite = 'hooked';
    gesture.handle({ type: 'press', source: 'key', repeat: false });
    gesture.handle({ type: 'press', source: 'key', repeat: true });
    expect(calls).toEqual(['reel true', 'reel true']);
  });

  it('lets go of the reel when space comes up and when the window blurs', () => {
    const { calls, gesture } = fake('look');
    gesture.handle({ type: 'release', source: 'key' });
    gesture.handle({ type: 'blur' });
    expect(calls).toEqual(['reel false', 'reel false']);
  });

  it('lets go of one source and not of another that still holds the reel', () => {
    const { calls, state, gesture } = fake('cast');
    state.bite = 'hooked';
    gesture.handle(down(1, 1));
    gesture.handle({ type: 'release', source: 'key' });
    expect(calls).toEqual(['reel true']);
    gesture.handle(up(1, 1, 900));
    expect(calls).toEqual(['reel true', 'reel false']);
  });

  it('strikes on a button press, and reels on one with a fish hooked', () => {
    const a = fake('look');
    a.gesture.handle({ type: 'press', source: 'button', repeat: false });
    expect(a.calls).toEqual(['strike']);
    const b = fake('look');
    b.state.bite = 'hooked';
    b.gesture.handle({ type: 'press', source: 'button', repeat: false });
    expect(b.calls).toEqual(['reel true']);
  });

  it('strikes when the button is a press the keyboard made, unless a fish is hooked, and lets go on its release', () => {
    const a = fake('look');
    a.gesture.handle({ type: 'activate', source: 'button' });
    expect(a.calls).toEqual(['strike']);
    const b = fake('look');
    b.state.bite = 'hooked';
    b.gesture.handle({ type: 'activate', source: 'button' });
    b.gesture.handle({ type: 'release', source: 'button' });
    expect(b.calls).toEqual(['reel false']);
  });

  it('strikes from a button press that finds the fish already hooked by the strike', () => {
    // the strike hooks it at once, and the same press goes on to reel
    const { calls, state, gesture } = fake('look');
    state.bite = 'biting';
    state.strikeHooks = true;
    gesture.handle({ type: 'press', source: 'button', repeat: false });
    expect(calls).toEqual(['strike', 'reel true']);
  });
});

const key = { type: 'press', source: 'key', repeat: false } as const;
const button = { type: 'press', source: 'button', repeat: false } as const;
const keyUp = { type: 'release', source: 'key' } as const;
const buttonUp = { type: 'release', source: 'button' } as const;

describe('the reel held by any source', () => {
  it('goes out once for the first hold, and lets go only when the last one does, in either order', () => {
    for (const order of [
      ['key', 'button'],
      ['button', 'key'],
    ] as const) {
      const { calls, state, gesture } = fake('look');
      state.bite = 'hooked';
      const press = { key, button };
      const rel = { key: keyUp, button: buttonUp };
      gesture.handle(press[order[0]]);
      gesture.handle(press[order[1]]);
      gesture.handle(rel[order[0]]);
      expect(calls.filter((c) => c === 'reel false')).toEqual([]);
      gesture.handle(rel[order[1]]);
      expect(calls.at(-1)).toBe('reel false');
      expect(calls.filter((c) => c === 'reel false')).toHaveLength(1);
    }
  });

  it('holds for the phone and the screen together, let go in each order', () => {
    for (const first of ['phone', 'screen'] as const) {
      const { calls, state, gesture } = fake('cast');
      state.bite = 'hooked';
      gesture.handle({ type: 'hello', source: 'phone', motion: true });
      gesture.handle(down(1, 1));
      gesture.handle({ type: 'down', source: 'phone', at: 0 });
      expect(calls).toEqual(['reel true']);
      if (first === 'phone') gesture.handle({ type: 'up', source: 'phone', at: 900 });
      else gesture.handle(up(1, 1, 900));
      expect(calls).toEqual(['reel true']);
      if (first === 'phone') gesture.handle(up(1, 1, 900));
      else gesture.handle({ type: 'up', source: 'phone', at: 900 });
      expect(calls).toEqual(['reel true', 'reel false']);
    }
  });

  it('lets a blur go of the key only, so a button hold stays', () => {
    const { calls, state, gesture } = fake('look');
    state.bite = 'hooked';
    gesture.handle(button);
    gesture.handle(key);
    gesture.handle({ type: 'blur' });
    expect(calls.filter((c) => c === 'reel false')).toEqual([]);
    gesture.handle(buttonUp);
    expect(calls.at(-1)).toBe('reel false');
  });

  it('holds the reel again for a hold still down when a new fish is hooked after the game stopped reeling', () => {
    const { calls, state, gesture } = fake('cast');
    state.bite = 'hooked';
    gesture.handle(down(1, 1));
    expect(calls).toEqual(['reel true']);
    // the game lands the fish and stops reeling by itself; the thumb is still down
    state.bite = 'landed';
    gesture.sync();
    state.bite = 'hooked';
    gesture.sync();
    expect(calls).toEqual(['reel true', 'reel true']);
    gesture.handle(up(1, 1, 900));
    expect(calls.at(-1)).toBe('reel false');
  });

  it('holds again for a fresh press after the game stopped reeling, even with no sync between', () => {
    const { calls, state, gesture } = fake('look');
    state.bite = 'hooked';
    gesture.handle(key);
    state.bite = 'landed';
    gesture.sync();
    gesture.handle(keyUp);
    state.bite = 'hooked';
    gesture.handle(key);
    expect(calls).toEqual(['reel true', 'reel false', 'reel true']);
  });
});

describe('the phone with motion', () => {
  const hello = { type: 'hello', source: 'phone', motion: true } as const;
  const pdown = (at = 0) => ({ type: 'down', source: 'phone', at }) as const;
  const pup = (at = 1000) => ({ type: 'up', source: 'phone', at }) as const;
  const tilt = (g: number) => ({ type: 'tilt', source: 'phone', g }) as const;
  const flick = (peak: number) => ({ type: 'flick', source: 'phone', peak }) as const;
  const spread = (PHONE.aimSpread * Math.PI) / 180;
  /** A phone with motion, thumb down and zeroed at gamma 10. */
  function raised(mode: Mode = 'cast') {
    const f = fake(mode);
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    f.gesture.handle(tilt(10));
    f.calls.length = 0;
    return f;
  }
  const angleOf = (c: string) => Number(c.split(' ')[1]);

  it('swings the aim right as the camera sees it for a tilt right, left for a tilt left, clamped at the range', () => {
    const f = raised();
    f.gesture.handle(tilt(10 + PHONE.tiltRange / 2));
    f.gesture.handle(tilt(10 - PHONE.tiltRange / 2));
    f.gesture.handle(tilt(10 + PHONE.tiltRange * 3));
    f.gesture.handle(tilt(10 - PHONE.tiltRange * 3));
    f.gesture.handle(tilt(10));
    const h = f.state.heading;
    const want = [h - spread / 2, h + spread / 2, h - spread, h + spread, h];
    expect(f.calls).toHaveLength(5);
    f.calls.forEach((c, i) => {
      expect(c.startsWith('aim ')).toBe(true);
      expect(angleOf(c)).toBeCloseTo(want[i], 4);
      expect(Number(c.split(' ')[2])).toBeCloseTo(PHONE.previewPower, 4);
    });
    // a tilt to the right is to the camera's right: the angle goes clockwise, as aimFrom's right is (sin h, -cos h)
    expect(aimFrom(-100, 100, 800, h)!.angle).toBeLessThan(aimFrom(100, 100, 800, h)!.angle);
  });

  it('makes the gamma at the first tilt the zero when none had come at the down', () => {
    const f = fake('cast');
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    f.gesture.handle(tilt(-20));
    f.gesture.handle(tilt(-20 + PHONE.tiltRange));
    expect(angleOf(f.calls[0])).toBeCloseTo(f.state.heading, 4);
    expect(angleOf(f.calls[1])).toBeCloseTo(f.state.heading - spread, 4);
  });

  it('casts at the aim on a flick, with power from flickMin to flickFull, and then the up does nothing', () => {
    const power = (peak: number) => {
      const f = raised();
      f.gesture.handle(tilt(10 + PHONE.tiltRange));
      f.calls.length = 0;
      f.gesture.handle(flick(peak));
      const cast = f.calls.find((c) => c.startsWith('cast'))!;
      expect(angleOf(cast)).toBeCloseTo(f.state.heading - spread, 3);
      expect(f.calls).toContain('aim off');
      f.calls.length = 0;
      f.gesture.handle(pup());
      expect(f.calls).toEqual([]);
      return Number(cast.split(' ')[2]);
    };
    expect(power(PHONE.flickMin)).toBeCloseTo(PHONE.flickLeast, 4);
    expect(power((PHONE.flickMin + PHONE.flickFull) / 2)).toBeCloseTo((1 + PHONE.flickLeast) / 2, 4);
    expect(power(PHONE.flickFull * 4)).toBeCloseTo(1, 4);
  });

  it('casts at the heading for a flick before any tilt', () => {
    const f = fake('cast');
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    f.gesture.handle(flick(PHONE.flickFull));
    expect(angleOf(f.calls.find((c) => c.startsWith('cast'))!)).toBeCloseTo(f.state.heading, 4);
  });

  it('casts nothing for a flick with no thumb down, or after the thumb is up', () => {
    const f = fake('cast');
    f.gesture.handle(hello);
    f.gesture.handle(flick(50));
    f.gesture.handle(pdown());
    f.gesture.handle(tilt(0));
    f.gesture.handle(pup());
    f.gesture.handle(flick(50));
    expect(f.calls.filter((c) => c.startsWith('cast'))).toEqual([]);
  });

  it('takes the cast back on an up without a flick, a tilt after it no longer aims, and casts nothing', () => {
    const f = raised();
    f.gesture.handle(tilt(30));
    f.calls.length = 0;
    f.gesture.handle(pup(2000));
    expect(f.calls).toEqual(['aim off']);
    f.calls.length = 0;
    f.gesture.handle(tilt(0));
    f.gesture.handle(flick(50));
    expect(f.calls).toEqual([]);
  });

  it('strikes on a short tap while the lure is sinking, and a phone tap never drops a pebble', () => {
    const f = fake('cast');
    f.state.lure = 'sinking';
    f.gesture.handle(hello);
    f.gesture.handle(pdown(0));
    f.gesture.handle(pup(TAP_MS));
    expect(f.calls).toEqual(['aim off', 'strike']);
    const slow = fake('cast');
    slow.state.lure = 'sinking';
    slow.gesture.handle(hello);
    slow.gesture.handle(pdown(0));
    slow.gesture.handle(pup(TAP_MS + 1));
    expect(slow.calls).toEqual(['aim off']);
    const idle = fake('cast');
    idle.gesture.handle(hello);
    idle.gesture.handle(pdown(0));
    idle.gesture.handle(pup(50));
    expect(idle.calls.filter((c) => c.startsWith('pebble'))).toEqual([]);
    expect(idle.calls).not.toContain('strike');
  });

  it('does not strike on an up after the thumb moved past the tap threshold', () => {
    const f = fake('cast');
    f.state.lure = 'sinking';
    f.gesture.handle(hello);
    f.gesture.handle(pdown(0));
    // the first move is where the thumb is; the next is how far it went
    f.gesture.handle({ type: 'move', source: 'phone', x: 0.5, y: 0.5, aspect: 0.5, at: 5 });
    f.gesture.handle({ type: 'move', source: 'phone', x: 0.5 + TAP_SHARE * 2, y: 0.5, aspect: 0.5, at: 10 });
    f.gesture.handle(pup(50));
    expect(f.calls).not.toContain('strike');
  });

  it('reels on a down with a fish hooked, and does not raise the rod', () => {
    const f = fake('cast');
    f.state.bite = 'hooked';
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    f.gesture.handle(tilt(30));
    f.gesture.handle(flick(50));
    f.gesture.handle(pup());
    expect(f.calls).toEqual(['reel true', 'reel false']);
  });

  it('asks to cast on a gesture in look mode, and not in cast mode', () => {
    const look = fake('look');
    look.gesture.handle(hello);
    look.gesture.handle(pdown());
    look.gesture.handle(tilt(5));
    look.gesture.handle(tilt(15));
    expect(look.calls[0]).toBe('want cast');
    expect(look.calls.filter((c) => c === 'want cast')).toHaveLength(1);
    expect(look.calls.filter((c) => c.startsWith('aim'))).toHaveLength(2);
    const cast = fake('cast');
    cast.gesture.handle(hello);
    cast.gesture.handle(pdown());
    expect(cast.calls).not.toContain('want cast');
    // the screen's own pointer in look mode never asks
    const screen = fake('look');
    screen.gesture.handle(down(1, 1));
    screen.gesture.handle(up(1, 1, 50));
    expect(screen.calls).not.toContain('want cast');
  });

  it('asks to cast for a hold with a fish hooked in look mode, and then reels', () => {
    const f = fake('look');
    f.state.bite = 'hooked';
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    expect(f.calls).toEqual(['want cast', 'reel true']);
  });

  it('on gone lets go of its reel and lowers its rod, clearing its own aim', () => {
    const held = fake('cast');
    held.state.bite = 'hooked';
    held.gesture.handle(hello);
    held.gesture.handle(pdown());
    held.gesture.handle({ type: 'gone', source: 'phone' });
    expect(held.calls).toEqual(['reel true', 'reel false']);
    const f = raised();
    f.gesture.handle(tilt(30));
    f.calls.length = 0;
    f.gesture.handle({ type: 'gone', source: 'phone' });
    expect(f.calls).toEqual(['aim off']);
    f.calls.length = 0;
    f.gesture.handle(tilt(0));
    f.gesture.handle(flick(50));
    f.gesture.handle(pup());
    expect(f.calls).toEqual([]);
  });

  it('on gone keeps a screen drag in progress and its aim, and a key hold', () => {
    const f = fake('cast');
    f.gesture.handle(hello);
    f.gesture.handle(down(400, 300));
    f.gesture.handle(move(400, 400));
    f.calls.length = 0;
    f.gesture.handle({ type: 'gone', source: 'phone' });
    expect(f.calls).toEqual([]);
    f.gesture.handle(up(400, 400));
    expect(f.calls.some((c) => c.startsWith('cast'))).toBe(true);
    const k = fake('cast');
    k.state.bite = 'hooked';
    k.gesture.handle(key);
    k.gesture.handle(pdown());
    k.gesture.handle({ type: 'gone', source: 'phone' });
    expect(k.calls).toEqual(['reel true']);
  });

  it('lets go of the phone hold on leaving cast, as the screen does', () => {
    const f = fake('cast');
    f.state.bite = 'hooked';
    f.gesture.handle(hello);
    f.gesture.handle(pdown());
    f.gesture.handle({ type: 'left-cast' });
    expect(f.calls).toEqual(['reel true', 'aim off', 'reel false']);
  });
});

describe('the phone without motion', () => {
  const noMotion = { type: 'hello', source: 'phone', motion: false } as const;
  const pad = (type: 'down' | 'move' | 'up', x: number, y: number, aspect: number, at: number): GestureEvent =>
    type === 'move' ? { type, source: 'phone', x, y, aspect, at } : { type, source: 'phone', at };

  it('aims and casts as the screen does for the same drag, against the pad shorter side', () => {
    for (const aspect of [0.5, 2]) {
      const f = fake('cast');
      f.gesture.handle(noMotion);
      f.gesture.handle(pad('down', 0, 0, aspect, 0));
      f.gesture.handle(pad('move', 0.5, 0.5, aspect, 0));
      f.gesture.handle(pad('move', 0.4, 0.8, aspect, 10));
      // the drag in the pad's own units: dx = Δx·aspect, dy = Δy, against min(aspect, 1)
      const want = aimFrom(-0.1 * aspect, 0.3, Math.min(aspect, 1), f.state.heading)!;
      const line = `aim ${want.angle.toFixed(4)} ${want.power.toFixed(4)}`;
      expect(f.calls.at(-1)).toBe(line);
      f.gesture.handle(pad('up', 0, 0, aspect, 50));
      expect(f.calls.slice(-2)).toEqual(['aim off', `cast ${want.angle.toFixed(4)} ${want.power.toFixed(4)}`]);
    }
  });

  it('takes a drag back in the dead zone, strikes on a tap while sinking, and drops no pebble', () => {
    const back = fake('cast');
    back.gesture.handle(noMotion);
    back.gesture.handle(pad('down', 0, 0, 1, 0));
    back.gesture.handle(pad('move', 0.5, 0.5, 1, 4));
    back.gesture.handle(pad('move', 0.5, 0.7, 1, 5));
    back.gesture.handle(pad('move', 0.5, 0.5, 1, 6));
    back.gesture.handle(pad('up', 0, 0, 1, 5000));
    expect(back.calls.filter((c) => c.startsWith('cast'))).toEqual([]);
    const tap = fake('cast');
    tap.state.lure = 'sinking';
    tap.gesture.handle(noMotion);
    tap.gesture.handle(pad('down', 0, 0, 1, 0));
    tap.gesture.handle(pad('up', 0, 0, 1, 100));
    expect(tap.calls).toEqual(['aim off', 'strike']);
    const dry = fake('cast');
    dry.gesture.handle(noMotion);
    dry.gesture.handle(pad('down', 0, 0, 1, 0));
    dry.gesture.handle(pad('up', 0, 0, 1, 100));
    expect(dry.calls.filter((c) => c.startsWith('pebble'))).toEqual([]);
  });

  it('reels for a hold with a fish on, and ignores tilt and flick', () => {
    const f = fake('cast');
    f.state.bite = 'hooked';
    f.gesture.handle(noMotion);
    f.gesture.handle(pad('down', 0, 0, 1, 0));
    f.gesture.handle({ type: 'tilt', source: 'phone', g: 30 });
    f.gesture.handle({ type: 'flick', source: 'phone', peak: 60 });
    f.gesture.handle(pad('up', 0, 0, 1, 900));
    expect(f.calls).toEqual(['reel true', 'reel false']);
    const g = fake('cast');
    g.gesture.handle(noMotion);
    g.gesture.handle(pad('down', 0, 0, 1, 0));
    g.gesture.handle({ type: 'tilt', source: 'phone', g: 30 });
    g.gesture.handle({ type: 'flick', source: 'phone', peak: 60 });
    expect(g.calls).toEqual([]);
  });

  it('asks to cast in look mode', () => {
    const f = fake('look');
    f.gesture.handle(noMotion);
    f.gesture.handle(pad('down', 0, 0, 1, 0));
    expect(f.calls).toEqual(['want cast']);
  });
});

describe('the phone in row mode and while rowing', () => {
  const hello = { type: 'hello', source: 'phone', motion: true } as const;
  const gestures: GestureEvent[] = [
    { type: 'down', source: 'phone', at: 0 },
    { type: 'move', source: 'phone', x: 0.5, y: 0.5, aspect: 0.5, at: 5 },
    { type: 'move', source: 'phone', x: 0.9, y: 0.1, aspect: 0.5, at: 10 },
    { type: 'tilt', source: 'phone', g: 30 },
    { type: 'flick', source: 'phone', peak: 60 },
    { type: 'up', source: 'phone', at: 1000 },
  ];

  it('is ignored in row mode: no cast, no strike, no aim, and the page is not asked for cast mode', () => {
    const f = fake('row');
    f.gesture.handle(hello);
    for (const g of gestures) f.gesture.handle(g);
    expect(f.calls).toEqual([]);
  });

  it('is ignored while the boat is rowed, in any mode', () => {
    for (const mode of ['look', 'cast'] as const) {
      const f = fake(mode);
      f.state.rowing = true;
      f.gesture.handle(hello);
      for (const g of gestures) f.gesture.handle(g);
      expect(f.calls, mode).toEqual([]);
    }
  });

  it('is heard again once the row is over and the mode is cast, and a hold on the reel is let go by the phone leaving', () => {
    const f = fake('cast');
    f.state.rowing = true;
    f.gesture.handle(hello);
    f.gesture.handle({ type: 'down', source: 'phone', at: 0 });
    expect(f.calls).toEqual([]);
    f.state.rowing = false;
    f.gesture.handle({ type: 'down', source: 'phone', at: 0 });
    f.gesture.handle({ type: 'tilt', source: 'phone', g: 10 });
    expect(f.calls.some((c) => c.startsWith('aim'))).toBe(true);
    f.gesture.handle({ type: 'gone', source: 'phone' });
  });

  it('does not hold the screen back: a tap on the water in row mode reaches the page as a point', () => {
    const f = fake('row');
    f.gesture.handle(down(200, 200, 0));
    f.gesture.handle(up(200, 200, 50));
    expect(f.calls).toEqual(['pebble 200 200']);
  });
});
