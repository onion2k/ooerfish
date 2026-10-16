/** The phone's messages: each kind round-trips, and what is not known is refused by name. */
import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  parsePhoneMessage,
  parseScreenMessage,
  type PhoneMessage,
  type ScreenMessage,
} from '../src/phone/protocol';
import type { FightPicture } from '../src/fightview';

const PICTURE: FightPicture = {
  phase: 'hooked',
  zone: 0.4,
  width: 0.28,
  fishAt: 0.5,
  meter: 0.3,
  tension: 0,
  reeling: true,
  biting: false,
  pulse: 0,
  words: 'in the zone',
  button: 'Reel',
};

const PHONE: PhoneMessage[] = [
  { kind: 'hello', v: PROTOCOL_VERSION, motion: true },
  { kind: 'down' },
  { kind: 'move', x: 0.25, y: 0.75, aspect: 0.6 },
  { kind: 'up' },
  { kind: 'tilt', g: -12.5 },
  { kind: 'flick', peak: 28 },
];
const SCREEN: ScreenMessage[] = [
  { kind: 'state', word: 'Reel', picture: PICTURE },
  { kind: 'state', word: '', picture: PICTURE },
  { kind: 'buzz' },
  { kind: 'busy' },
];

const wire = (m: unknown) => JSON.parse(JSON.stringify(m)) as unknown;

describe('the phone protocol', () => {
  it('is at version one', () => expect(PROTOCOL_VERSION).toBe(1));

  it.each(PHONE)('round-trips the phone message $kind', (m) => {
    expect(parsePhoneMessage(wire(m))).toEqual({ ok: true, message: m });
  });

  it.each(SCREEN)('round-trips the screen message $kind', (m) => {
    expect(parseScreenMessage(wire(m))).toEqual({ ok: true, message: m });
  });

  it('refuses a value that is not an object', () => {
    for (const raw of [null, 3, 'down', [], undefined]) {
      const r = parsePhoneMessage(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why).toContain('object');
    }
  });

  it('refuses an unknown kind by its name', () => {
    const r = parsePhoneMessage({ kind: 'teleport' });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.why).toContain('teleport');
    const s = parseScreenMessage({ kind: 'explode' });
    if (!s.ok) expect(s.why).toContain('explode');
    else throw new Error('accepted');
  });

  it('refuses a missing kind', () => {
    const r = parsePhoneMessage({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toContain('kind');
  });

  it('refuses a version it does not know', () => {
    const r = parsePhoneMessage({ kind: 'hello', v: 2, motion: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toContain('version');
  });

  it('refuses a field that is missing, by name', () => {
    for (const [m, name] of [
      [{ kind: 'move', x: 0.5, aspect: 1 }, 'y'],
      [{ kind: 'tilt' }, 'g'],
      [{ kind: 'flick' }, 'peak'],
      [{ kind: 'hello', v: 1 }, 'motion'],
    ] as const) {
      const r = parsePhoneMessage(m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why).toContain(name);
    }
    const s = parseScreenMessage({ kind: 'state', word: 'Reel' });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.why).toContain('picture');
  });

  it('refuses a number that is not finite, by name', () => {
    for (const bad of [NaN, Infinity, -Infinity, '3', null]) {
      const r = parsePhoneMessage({ kind: 'tilt', g: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why).toContain('g');
    }
    // NaN cannot survive the wire, but a hostile peer need not use JSON.stringify
    expect(parsePhoneMessage({ kind: 'flick', peak: Infinity }).ok).toBe(false);
    expect(parseScreenMessage({ kind: 'state', word: '', picture: { ...PICTURE, zone: NaN } }).ok).toBe(false);
  });

  it('refuses a number out of range, by name', () => {
    for (const [m, name] of [
      [{ kind: 'move', x: 1.5, y: 0.5, aspect: 1 }, 'x'],
      [{ kind: 'move', x: 0.5, y: -0.1, aspect: 1 }, 'y'],
      [{ kind: 'move', x: 0.5, y: 0.5, aspect: 0 }, 'aspect'],
      [{ kind: 'tilt', g: 400 }, 'g'],
      [{ kind: 'flick', peak: -1 }, 'peak'],
      [{ kind: 'flick', peak: 1e6 }, 'peak'],
    ] as const) {
      const r = parsePhoneMessage(m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why).toContain(name);
    }
    const s = parseScreenMessage({ kind: 'state', word: '', picture: { ...PICTURE, meter: 2 } });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.why).toContain('meter');
  });

  it('refuses an extra field, by name', () => {
    const r = parsePhoneMessage({ kind: 'down', sneaky: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toContain('sneaky');
    const s = parseScreenMessage({ kind: 'state', word: '', picture: { ...PICTURE, extra: 1 } });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.why).toContain('extra');
  });

  it('refuses a word it does not know, and a picture field of the wrong type, by name', () => {
    const w = parseScreenMessage({ kind: 'state', word: 'Shout', picture: PICTURE });
    expect(w.ok).toBe(false);
    if (!w.ok) expect(w.why).toContain('word');
    const p = parseScreenMessage({ kind: 'state', word: '', picture: { ...PICTURE, reeling: 'yes' } });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.why).toContain('reeling');
    const q = parseScreenMessage({ kind: 'state', word: '', picture: { ...PICTURE, phase: 'dancing' } });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.why).toContain('phase');
  });

  it('keeps each side to its own kinds', () => {
    for (const m of SCREEN) expect(parsePhoneMessage(wire(m)).ok).toBe(false);
    for (const m of PHONE) expect(parseScreenMessage(wire(m)).ok).toBe(false);
  });
});
