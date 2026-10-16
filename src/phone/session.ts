/**
 * The screen's side of one phone, without the page: which peer is the phone, what it says as gestures, and what is
 * refused. The first peer to join is the phone and any other is told the screen is busy and then ignored, so two
 * hands can never fight over one rod; a message goes through `parsePhoneMessage` before anything acts on it, and one
 * that is refused is counted and changes nothing; the phone leaving is a `gone` gesture, which lets go of its reel.
 * Pure of the DOM, the game and the network (it is handed a `Link` and a place to send gestures), so a test plays the
 * phone and the strangers and reads the result. Without it the overlay and the rules for the one phone would be one
 * lump that only a browser could test.
 */
import type { GestureEvent, PhoneGesture } from '../gesture';
import type { Link } from './link';
import type { LinkName } from './linkname';
import { parsePhoneMessage, type PhoneMessage } from './protocol';

/** What the test API reads of the pairing. */
export interface PhoneReading {
  /** A phone is in the room and is the screen's phone. */
  paired: boolean;
  /** The phone said it has motion sensors. */
  motion: boolean;
  /** The kind of the last good message, or null before one. */
  lastKind: string | null;
  /** How many messages have been refused, over the whole session. */
  refused: number;
  /** Why the last refused message was, or null before one. */
  lastRefusal: string | null;
}

/** A pairing: a room and the key that is its password, both made fresh for the session. */
export interface Pairing {
  room: string;
  key: string;
}

/** A word of `n` random bytes in base 36, from the browser's crypto: never the game's chance, which is for logic. */
const word = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(36).padStart(2, '0')).join('');

/** A new room and key. The room is public to the relays; the key is the password that keeps strangers out of it. */
export function newPairing(): Pairing {
  return { room: word(6), key: word(12) };
}

/**
 * The address the QR code carries: the phone page, with the room and key in the fragment, which never goes to a
 * server. The local link is named in it for tests, since the phone has no address of its own to learn it from.
 */
export function phoneUrl(origin: string, pairing: Pairing, link: LinkName): string {
  const fragment = `room=${pairing.room}&key=${pairing.key}${link === 'local' ? '&link=local' : ''}`;
  return `${origin}/phone.html#${fragment}`;
}

/** A message from the phone as the gesture it is, stamped with the screen's own time `at` (the wire carries none). */
export function gestureFrom(message: PhoneMessage, at: number): PhoneGesture {
  switch (message.kind) {
    case 'hello':
      return { type: 'hello', source: 'phone', motion: message.motion };
    case 'down':
      return { type: 'down', source: 'phone', at };
    case 'move':
      return { type: 'move', source: 'phone', x: message.x, y: message.y, aspect: message.aspect, at };
    case 'up':
      return { type: 'up', source: 'phone', at };
    case 'tilt':
      return { type: 'tilt', source: 'phone', g: message.g };
    case 'flick':
      return { type: 'flick', source: 'phone', peak: message.peak };
  }
}

export interface SessionOptions {
  /** Where the phone's gestures go: the page's `Gesture.handle`. */
  handle(e: GestureEvent): void;
  /** The screen's clock in milliseconds, for a gesture's `at`: `performance.now` in the page. */
  now(): number;
  /** The phone joined or left, for the page to say so. */
  onChange?(what: 'joined' | 'left'): void;
}

export class PhoneSession {
  /** The one phone, while there is one. */
  private peer: string | null = null;
  private motion = false;
  private lastKind: string | null = null;
  private refused = 0;
  private lastRefusal: string | null = null;

  constructor(
    private readonly link: Link,
    private readonly options: SessionOptions,
  ) {
    link.onJoin((peer) => this.joined(peer));
    link.onLeave((peer) => this.left(peer));
    link.onMessage((raw, peer) => this.heard(raw, peer));
  }

  reading(): PhoneReading {
    return {
      paired: this.peer !== null,
      motion: this.motion,
      lastKind: this.lastKind,
      refused: this.refused,
      lastRefusal: this.lastRefusal,
    };
  }

  private joined(peer: string) {
    if (this.peer === null) {
      this.peer = peer;
      this.options.onChange?.('joined');
      return;
    }
    // one phone to a screen: the second is told, and then ignored
    if (peer !== this.peer) this.link.send({ kind: 'busy' }, peer);
  }

  private left(peer: string) {
    if (peer !== this.peer) return;
    this.peer = null;
    this.motion = false;
    this.options.handle({ type: 'gone', source: 'phone' });
    this.options.onChange?.('left');
  }

  private heard(raw: unknown, peer: string) {
    if (peer !== this.peer) return;
    const parsed = parsePhoneMessage(raw);
    if (!parsed.ok) {
      this.refused++;
      this.lastRefusal = parsed.why;
      return;
    }
    const { message } = parsed;
    this.lastKind = message.kind;
    if (message.kind === 'hello') this.motion = message.motion;
    this.options.handle(gestureFrom(message, this.options.now()));
  }
}
