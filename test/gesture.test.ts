/** The gesture rules: what a pointer, the space key, the Strike/Reel button and the window's blur each do to the game. */
import { describe, expect, it } from 'vitest';
import { aimFrom } from '../src/aim';
import { Gesture, TAP_MS, TAP_PX, type GestureTarget } from '../src/gesture';
import type { Mode } from '../src/mode';

/** A target that records the calls made on it, with the mode and phases it is told to report. */
function fake(mode: Mode = 'cast') {
  const calls: string[] = [];
  const state = { mode, bite: 'none', lure: 'ready', short: 800, heading: 0.5, strikeHooks: false };
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
    view: () => ({ short: state.short, heading: state.heading }),
  };
  return { calls, state, gesture: new Gesture(target) };
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

  it('lets go of the reel whatever else holds it, as it does today', () => {
    const { calls, state, gesture } = fake('cast');
    state.bite = 'hooked';
    gesture.handle(down(1, 1));
    gesture.handle({ type: 'release', source: 'key' });
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
