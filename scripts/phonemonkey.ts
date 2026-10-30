/**
 * A phone played at random, for the fuzzer and the leak run: the gesture rules (`gesture.ts`) over a game with no page,
 * handed what a phone could send, well formed and not. It exists so that what a phone can make the game do is hunted
 * by the same monkey as everything else; without it the phone's rules would be tried only by the tests someone thought
 * to write. It holds a `Gesture` and nothing else of the phone's, and everything it does reaches the game through the
 * game's own methods, which the invariants already hold, so it adds no invariant of its own.
 *
 * Time is the caller's frame clock in milliseconds of game time (never `Date` or `performance`), so a replay is the
 * same, and a tap is as long as the frames between its down and its up.
 */
import { Gesture, type GestureTarget } from '../src/gesture';
import type { Game } from '../src/game';
import { HOME } from '../src/lakes';
import { PHONE } from '../src/lake';
import { PhoneSession, gestureFrom } from '../src/phone/session';
import type { Link } from '../src/phone/link';
import { parsePhoneMessage } from '../src/phone/protocol';
import type { Random } from '../src/random';

const VIEWS = HOME.views;

/** The Shore view's heading: the camera stands on the south bank, an azimuth round from the target, and looks back at it. */
const HEADING = VIEWS.shore.azimuth + Math.PI;
/** A pad's shorter side in pixels; only its size against a drag matters, so it is fixed. */
const SHORT = 800;

/** What the phone made the game do, for the reach test and the report. */
export interface PhoneCounts {
  cast: number;
  strike: number;
  reel: number;
  /** Raw messages refused by `parsePhoneMessage`, each checked to have changed nothing. */
  refused: number;
}

export const newCounts = (): PhoneCounts => ({ cast: 0, strike: 0, reel: 0, refused: 0 });

/**
 * The target a phone's gestures act on in a game with no page: always in cast mode (so `wantCast` has nothing to do),
 * no aim drawn, no camera, and no pebble, since a phone never drops one.
 */
export function gestureTarget(game: () => Game, counts: PhoneCounts): GestureTarget {
  return {
    cast: (angle, power) => {
      counts.cast++;
      game().cast(angle, power);
    },
    strike: () => {
      counts.strike++;
      game().strike();
    },
    reel: (on) => {
      if (on) counts.reel++;
      game().reel(on);
    },
    setAim: () => {},
    pebble: () => {},
    mode: () => 'cast',
    bitePhase: () => game().bite.phase,
    lurePhase: () => game().lure.phase,
    view: () => ({ short: SHORT, heading: HEADING }),
    wantCast: () => {},
  };
}

/** The sizes of what an object keeps in its collections, and so the most it can be made to hold: for the leak run. */
export function collectionsKept(thing: object): number {
  let n = 0;
  for (const value of Object.values(thing)) {
    if (value instanceof Set || value instanceof Map) n += value.size;
    else if (Array.isArray(value)) n += value.length;
  }
  return n;
}

/** One thing a phone can say, as the wire carries it: a good one of each kind, or one broken in a way a stranger might. */
function rawMessage(random: Random): unknown {
  const between = (a: number, b: number) => a + random() * (b - a);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];
  const good: Record<string, unknown>[] = [
    { kind: 'hello', v: 1, motion: random() < 0.5 },
    { kind: 'down' },
    { kind: 'move', x: random(), y: random(), aspect: between(0.3, 3) },
    { kind: 'up' },
    { kind: 'tilt', g: between(-2.5 * PHONE.tiltRange, 2.5 * PHONE.tiltRange) },
    { kind: 'flick', peak: between(0, 60) },
  ];
  const message = { ...pick(good) };
  const broken = random();
  if (broken < 0.5) return message;
  if (broken < 0.6) return { ...message, kind: pick(['spin', '', 'Hello', 'state', 7]) };
  if (broken < 0.7) return { ...message, extra: 1 };
  if (broken < 0.8) return { kind: 'hello', v: pick([0, 2, 99, -1, NaN]), motion: true };
  if (broken < 0.9) {
    // a number that is no number, or too big, in whatever field the message has
    const fields = Object.keys(message).filter((k) => k !== 'kind' && k !== 'motion');
    if (fields.length) message[pick(fields)] = pick([NaN, Infinity, -1, 1e9, '3', null]);
    else message.kind = 'move';
    return message;
  }
  if (broken < 0.95) return pick([null, 3, 'down', [], undefined]);
  delete message.kind;
  return message;
}

export interface PhoneMonkey {
  /** Begins one thing a phone could do, and says what it was; a script already running is left to finish, and none is said. */
  start(frame: number): string | null;
  /** Runs what is due at `frame` and keeps the reel true to the holds, as the page does each frame. */
  tick(frame: number): void;
  readonly counts: PhoneCounts;
}

/** A phone at random over the game `game()` is at the moment (the fuzzer's reload replaces it); `counts` outlives the phone. */
export function phoneMonkey(game: () => Game, random: Random, counts: PhoneCounts = newCounts()): PhoneMonkey {
  const gesture = new Gesture(gestureTarget(game, counts), PHONE);
  const between = (a: number, b: number) => a + random() * (b - a);
  const now = (frame: number) => (frame * 1000) / 60;
  /** What is still to be sent, in order, and the frame each is due. */
  let script: { due: number; send: (frame: number) => void }[] = [];

  const hand = (type: 'down' | 'up', frame: number) => gesture.handle({ type, source: 'phone', at: now(frame) });
  const tilt = (g: number) => gesture.handle({ type: 'tilt', source: 'phone', g });
  const flick = (peak: number) => gesture.handle({ type: 'flick', source: 'phone', peak });
  const move = (frame: number, x: number, y: number, aspect: number) =>
    gesture.handle({ type: 'move', source: 'phone', x, y, aspect, at: now(frame) });

  /** A raw message through the parser and on as a gesture; a refused one must not have touched the game. */
  const raw = (frame: number) => {
    const message = rawMessage(random);
    const before = counts.cast + counts.strike + counts.reel;
    const parsed = parsePhoneMessage(message);
    if (parsed.ok) gesture.handle(gestureFrom(parsed.message, now(frame)));
    else {
      counts.refused++;
      if (counts.cast + counts.strike + counts.reel !== before)
        throw new Error(`a refused message acted: ${parsed.why}`);
    }
  };

  /** A touch that spans frames: down, some drag or tilt, maybe a flick, up. */
  const touch = (frame: number, motion: boolean, tap = false) => {
    const steps: ((f: number) => void)[] = [(f) => hand('down', f)];
    const aspect = between(0.4, 2.4);
    const kind = tap ? 0 : random();
    if (kind < 0.25) {
      // a tap
    } else if (motion) {
      const swings = 1 + Math.floor(random() * 4);
      for (let i = 0; i < swings; i++) steps.push(() => tilt(between(-2.5 * PHONE.tiltRange, 2.5 * PHONE.tiltRange)));
      if (kind < 0.8) {
        const peak = between(0, 60);
        steps.push(() => flick(peak));
        // a second flick inside the first's touch, which does nothing
        if (random() < 0.2) steps.push(() => flick(between(0, 60)));
      }
    } else {
      const drags = 1 + Math.floor(random() * 5);
      let x = random(),
        y = random();
      for (let i = 0; i < drags; i++) {
        x = Math.max(0, Math.min(1, x + between(-0.3, 0.3)));
        y = Math.max(0, Math.min(1, y + between(-0.3, 0.3)));
        const [px, py] = [x, y];
        steps.push((f) => move(f, px, py, aspect));
      }
    }
    steps.push((f) => hand('up', f));
    let due = frame;
    script = steps.map((send) => ({ due: (due += Math.floor(between(0, 14))), send }));
    // the first step is now
    script[0].due = frame;
  };

  return {
    counts,
    start(frame) {
      if (script.length) return null;
      const r = random();
      if (r < 0.1) {
        const motion = random() < 0.6;
        gesture.handle({ type: 'hello', source: 'phone', motion });
        return `phone hello, ${motion ? 'with' : 'without'} motion`;
      }
      if (r < 0.55) {
        const motion = random() < 0.6;
        gesture.handle({ type: 'hello', source: 'phone', motion });
        // a player taps when the bobber is under, so a share of touches then are taps
        const tap = game().lure.phase === 'sinking' && random() < 0.5;
        touch(frame, motion, tap);
        return `phone touch, ${tap ? 'tap' : motion ? 'tilt and flick' : 'drag'}`;
      }
      if (r < 0.65) {
        // a tilt or a flick with no thumb down, which does nothing
        if (random() < 0.5) tilt(between(-100, 100));
        else flick(between(0, 60));
        return 'phone tilt or flick with no thumb';
      }
      if (r < 0.75) {
        gesture.handle({ type: 'gone', source: 'phone' });
        script = [];
        return 'phone gone';
      }
      const n = 1 + Math.floor(random() * 4);
      for (let i = 0; i < n; i++) raw(frame);
      return `phone raw x${n}`;
    },
    tick(frame) {
      gesture.sync();
      while (script.length && script[0].due <= frame) script.shift()!.send(frame);
    },
  };
}

/**
 * A busy room for the leak run: the phone's whole screen side, a `PhoneSession` over a link of its own that goes
 * nowhere, with phones joining, talking, leaving and strangers knocking, an hour of it. The session and the gesture are
 * the real ones; the link is a stand-in, since what is being watched is what they keep.
 */
export interface Crowd {
  session: PhoneSession;
  gesture: Gesture;
  /** Does something to the room if it is the frame for it (about ten a second). */
  tick(frame: number): void;
}

export function crowd(game: () => Game, random: Random): Crowd {
  const between = (a: number, b: number) => a + random() * (b - a);
  const gesture = new Gesture(gestureTarget(game, newCounts()), PHONE);
  let onMessage: (raw: unknown, peer: string) => void = () => {};
  let onJoin: (peer: string) => void = () => {};
  let onLeave: (peer: string) => void = () => {};
  const link: Link = {
    send: () => {},
    onMessage: (h) => {
      onMessage = h;
    },
    onJoin: (h) => {
      onJoin = h;
    },
    onLeave: (h) => {
      onLeave = h;
    },
    leave: () => {},
  };
  let frame = 0;
  const session = new PhoneSession(link, {
    handle: (e) => gesture.handle(e),
    now: () => (frame * 1000) / 60,
    stateHz: PHONE.stateHz,
  });
  // every phone that has ever come, by number, so a stranger can be one that joined long ago and left
  let made = 0;
  const peer = (n: number) => `peer-${n}`;
  /** The peer the session took for its phone, as far as this room can tell. */
  let phone: string | null = null;
  const join = () => {
    const name = peer(++made);
    onJoin(name);
    if (phone === null && session.reading().paired) phone = name;
  };
  const say = (message: unknown) => {
    if (phone !== null) onMessage(message, phone);
  };
  join();
  return {
    session,
    gesture,
    tick(at) {
      frame = at;
      gesture.sync();
      if (frame % 6 !== 0) return;
      const g = game();
      // a night passed, the player wakes in the cabin and goes down to the pond, so the room plays on
      if (g.place === 'cabin') g.out();
      // the lake is fished, by the screen's angler for the cast and the strike and by the phone's thumb for the reel, so
      // a hold is made and let go of for as long as the room is played
      if (g.lure.phase === 'ready' || g.lure.phase === 'lying') g.cast(g.lake.aim.angle + between(-0.4, 0.4), 0.6);
      if (g.bite.phase === 'biting') g.strike();
      if (g.bite.phase === 'hooked' && random() < 0.5) say({ kind: 'down' });
      else if (random() < 0.15) say({ kind: 'up' });
      session.sendState(frame * (1000 / 60), () => ({ kind: 'buzz' }));
      const r = random();
      if (r < 0.04) join();
      else if (r < 0.08) {
        // the phone or a stranger leaves; a phone that left lets the next to join be the phone
        const gone = peer(Math.max(1, made - Math.floor(random() * 3)));
        onLeave(gone);
        if (gone === phone) phone = null;
      } else if (r < 0.3) session.buzz();
      else onMessage(rawMessage(random), peer(Math.max(1, made - Math.floor(random() * 2))));
    },
  };
}
