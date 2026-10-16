/** What of pairing is not the page: the phone's messages as gestures, the address in the code, and the one phone. */
import { describe, expect, it, vi } from 'vitest';
import type { GestureEvent, PhoneGesture } from '../src/gesture';
import type { Link } from '../src/phone/link';
import { PROTOCOL_VERSION, type PhoneMessage } from '../src/phone/protocol';
import { PhoneSession, gestureFrom, newPairing, phoneUrl } from '../src/phone/session';

describe('a message from the phone as a gesture', () => {
  const cases: [PhoneMessage, PhoneGesture][] = [
    [
      { kind: 'hello', v: PROTOCOL_VERSION, motion: true },
      { type: 'hello', source: 'phone', motion: true },
    ],
    [
      { kind: 'hello', v: PROTOCOL_VERSION, motion: false },
      { type: 'hello', source: 'phone', motion: false },
    ],
    [{ kind: 'down' }, { type: 'down', source: 'phone', at: 1234 }],
    [
      { kind: 'move', x: 0.25, y: 0.75, aspect: 0.5 },
      { type: 'move', source: 'phone', x: 0.25, y: 0.75, aspect: 0.5, at: 1234 },
    ],
    [{ kind: 'up' }, { type: 'up', source: 'phone', at: 1234 }],
    [
      { kind: 'tilt', g: -12.5 },
      { type: 'tilt', source: 'phone', g: -12.5 },
    ],
    [
      { kind: 'flick', peak: 27 },
      { type: 'flick', source: 'phone', peak: 27 },
    ],
  ];
  for (const [message, gesture] of cases) {
    it(`turns ${message.kind}${message.kind === 'hello' ? ` (motion ${String(message.motion)})` : ''} into the gesture`, () => {
      expect(gestureFrom(message, 1234)).toEqual(gesture);
    });
  }
});

describe('the pairing and its address', () => {
  it('makes a room and a key that are new each time, from the browser and not the game', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('chance was used');
    });
    try {
      const a = newPairing();
      const b = newPairing();
      expect(a.room).toMatch(/^[0-9a-z]{12}$/);
      expect(a.key).toMatch(/^[0-9a-z]{24}$/);
      expect(a).not.toEqual(b);
    } finally {
      random.mockRestore();
    }
  });

  it('puts the room and key in the fragment, and says the link only when it is the local one', () => {
    const pairing = { room: 'abc', key: 'def' };
    expect(phoneUrl('https://192.168.1.5:5204', pairing, 'nostr')).toBe(
      'https://192.168.1.5:5204/phone.html#room=abc&key=def',
    );
    expect(phoneUrl('http://localhost:5205', pairing, 'local')).toBe(
      'http://localhost:5205/phone.html#room=abc&key=def&link=local',
    );
  });
});

/** A link that does nothing but remember: the test plays the peers. */
function fakeLink() {
  const handlers = {
    message: (_raw: unknown, _peer: string) => {},
    join: (_peer: string) => {},
    leave: (_peer: string) => {},
  };
  const sent: { message: unknown; to?: string }[] = [];
  const link: Link = {
    send: (message, to) => void sent.push({ message, to }),
    onMessage: (h) => void (handlers.message = h),
    onJoin: (h) => void (handlers.join = h),
    onLeave: (h) => void (handlers.leave = h),
    leave: () => {},
  };
  return { link, handlers, sent };
}

function session() {
  const fake = fakeLink();
  const handled: GestureEvent[] = [];
  const changes: string[] = [];
  let clock = 100;
  const s = new PhoneSession(fake.link, {
    handle: (e) => void handled.push(e),
    now: () => clock++,
    onChange: (what) => void changes.push(what),
  });
  return { ...fake, s, handled, changes };
}

describe('the one phone', () => {
  it('reads nothing until a phone joins', () => {
    const { s } = session();
    expect(s.reading()).toEqual({ paired: false, motion: false, lastKind: null, refused: 0, lastRefusal: null });
  });

  it('takes the first peer to join as the phone, and tells the screen so', () => {
    const { s, handlers, changes } = session();
    handlers.join('phone-a');
    expect(s.reading().paired).toBe(true);
    expect(changes).toEqual(['joined']);
  });

  it('tells a second peer the screen is busy, and ignores everything it says', () => {
    const { s, handlers, sent, handled } = session();
    handlers.join('phone-a');
    handlers.join('phone-b');
    expect(sent).toEqual([{ message: { kind: 'busy' }, to: 'phone-b' }]);
    handlers.message({ kind: 'down' }, 'phone-b');
    handlers.message({ kind: 'nonsense' }, 'phone-b');
    expect(handled).toEqual([]);
    expect(s.reading()).toMatchObject({ paired: true, lastKind: null, refused: 0 });
    // and the second leaving is not the phone leaving
    handlers.leave('phone-b');
    expect(s.reading().paired).toBe(true);
    expect(handled).toEqual([]);
  });

  it('ignores a peer that has not joined', () => {
    const { s, handlers, handled } = session();
    handlers.message({ kind: 'down' }, 'stranger');
    expect(handled).toEqual([]);
    expect(s.reading().lastKind).toBeNull();
  });

  it('hands a good message to the gestures at the screen’s own time, and keeps its kind', () => {
    const { s, handlers, handled } = session();
    handlers.join('phone-a');
    handlers.message({ kind: 'hello', v: PROTOCOL_VERSION, motion: true }, 'phone-a');
    expect(s.reading()).toMatchObject({ motion: true, lastKind: 'hello' });
    handlers.message({ kind: 'down' }, 'phone-a');
    expect(s.reading().lastKind).toBe('down');
    expect(handled).toEqual([
      { type: 'hello', source: 'phone', motion: true },
      { type: 'down', source: 'phone', at: 101 },
    ]);
  });

  const refused: [string, unknown, string][] = [
    ['one that is not an object', 'hello', 'not an object'],
    ['one of a kind not known', { kind: 'strike' }, 'kind "strike"'],
    ['a hello of a version not known', { kind: 'hello', v: 99, motion: false }, 'version 99'],
    ['a field that is not a number', { kind: 'tilt', g: Number.NaN }, 'g'],
    ['a field that is not one of the message’s', { kind: 'down', extra: 1 }, 'extra'],
  ];
  for (const [what, raw, why] of refused) {
    it(`refuses ${what} by name, counts it, and changes nothing`, () => {
      const { s, handlers, handled, changes } = session();
      handlers.join('phone-a');
      handlers.message({ kind: 'up' }, 'phone-a');
      const before = handled.length;
      handlers.message(raw, 'phone-a');
      expect(handled).toHaveLength(before);
      const reading = s.reading();
      expect(reading.refused).toBe(1);
      expect(reading.lastRefusal).toContain(why);
      expect(reading.lastKind).toBe('up');
      expect(changes).toEqual(['joined']);
      handlers.message({ kind: 'nope' }, 'phone-a');
      expect(s.reading().refused).toBe(2);
    });
  }

  it('sends gone when the phone leaves, forgets its motion, and takes the same or another phone after', () => {
    const { s, handlers, handled, changes } = session();
    handlers.join('phone-a');
    handlers.message({ kind: 'hello', v: PROTOCOL_VERSION, motion: true }, 'phone-a');
    handlers.leave('phone-a');
    expect(handled.at(-1)).toEqual({ type: 'gone', source: 'phone' });
    expect(s.reading()).toMatchObject({ paired: false, motion: false });
    expect(changes).toEqual(['joined', 'left']);
    handlers.join('phone-c');
    expect(s.reading().paired).toBe(true);
    handlers.message({ kind: 'down' }, 'phone-c');
    expect(handled.at(-1)).toMatchObject({ type: 'down' });
  });

  it('counts refusals over the whole session, not one phone’s', () => {
    const { s, handlers } = session();
    handlers.join('phone-a');
    handlers.message({ kind: 'x' }, 'phone-a');
    handlers.leave('phone-a');
    handlers.join('phone-b');
    handlers.message({ kind: 'y' }, 'phone-b');
    expect(s.reading().refused).toBe(2);
  });
});
