/**
 * The gesture rules: what a pointer on the water, the space key, the Strike/Reel button, the window losing focus and
 * leaving cast mode each do to the game. They are here, and not in the page, so that every way of playing goes
 * through one implementation (the phone will be another source), and so a test can drive them without a browser. The
 * page turns a DOM event into a `GestureEvent` and does only what is the page's own: pointer capture, the camera and
 * the picking of a point on the water. Without this a rule would be written once for the mouse and again for each
 * new way of playing, and they would drift. Pure: no DOM, no renderer, no game state, only the `GestureTarget` it is
 * handed.
 */
import { aimFrom } from './aim';
import type { Mode } from './mode';

/** How far a pointer may move, in CSS pixels, and how long it may be down, in milliseconds, and still be a tap and not a drag. */
export const TAP_PX = 6,
  TAP_MS = 400;

/**
 * How far a thumb may wander on the phone's pad and still be a tap, as a share of the pad's shorter side. The screen's
 * `TAP_PX` is in pixels, which a pad of unknown size has none of.
 */
export const TAP_SHARE = 0.03;

/** The phone's figures this file reads, handed in (`PHONE` in `lake.ts`) so that this file imports no content. */
export interface PhoneTuning {
  tiltRange: number;
  aimSpread: number;
  flickMin: number;
  flickFull: number;
  previewPower: number;
  flickLeast: number;
}

/** Where an event came from. */
export type Source = 'screen' | 'key' | 'button' | 'phone';

/** A pointer on the water, in the page's pixels and the event's own milliseconds. */
export interface PointerGesture {
  type: 'down' | 'move' | 'up' | 'cancel';
  source: 'screen';
  x: number;
  y: number;
  at: number;
}

/**
 * What the phone says, as the screen hears it: `at` is the screen's own arrival time in milliseconds, which tap timing
 * needs and the wire does not carry. A move is a share of the pad (0 to 1) and the pad's width over its height.
 */
export type PhoneGesture =
  | { type: 'hello'; source: 'phone'; motion: boolean }
  | { type: 'down'; source: 'phone'; at: number }
  | { type: 'move'; source: 'phone'; x: number; y: number; aspect: number; at: number }
  | { type: 'up'; source: 'phone'; at: number }
  /** The phone's gamma, in degrees. */
  | { type: 'tilt'; source: 'phone'; g: number }
  /** A flick's peak acceleration, in metres a second squared. */
  | { type: 'flick'; source: 'phone'; peak: number }
  /** The phone left. */
  | { type: 'gone'; source: 'phone' };

export type GestureEvent =
  | PointerGesture
  | PhoneGesture
  /** A key or the button pressed (`repeat` for a key held down). */
  | { type: 'press'; source: 'key' | 'button'; repeat: boolean }
  | { type: 'release'; source: 'key' | 'button' }
  /** The button as the keyboard presses it (a click with no pointer): a strike, unless a fish is on. */
  | { type: 'activate'; source: 'button' }
  /** The window lost the focus. */
  | { type: 'blur' }
  /** The page left cast mode. */
  | { type: 'left-cast' };

/** What the gestures do to, and read of, the game and the page. */
export interface GestureTarget {
  cast(angle: number, power: number): void;
  strike(): void;
  reel(on: boolean): void;
  /** The aim the page draws, or none. */
  setAim(aim: { angle: number; power: number } | null): void;
  /** Drops a pebble where the page's point (x, y) meets the water: the page keeps the camera and the picking. */
  pebble(x: number, y: number): void;
  mode(): Mode;
  bitePhase(): string;
  lurePhase(): string;
  /** Whether the boat is being rowed, in which the phone's gestures are ignored, as they are in row mode. Optional: a target without a boat never rows. */
  rowing?(): boolean;
  /** The screen's shorter side in pixels and the camera's heading round the compass, for a drag's cast. */
  view(): { short: number; heading: number };
  /** A gesture from the phone arrived in look mode: the page goes to cast mode, at the Shore view, and the gesture goes on. */
  wantCast(): void;
}

/** The phone's thumb on the pad, from its down. */
interface Thumb {
  at: number;
  /** Where the thumb first was, as shares; the down carries no point, so the first move says. */
  from: { x: number; y: number } | null;
  /** The furthest it has gone from there, against the pad's shorter side. */
  far: number;
  /** The gamma that is the aim's zero, once there is one (motion only). */
  zero: number | null;
  /** The aim's turn off the heading, in radians, from the last tilt. */
  turn: number;
  /** A flick has cast: the rest of this touch does nothing. */
  flicked: boolean;
}

export class Gesture {
  /** Where the pointer went down, while it is a drag or a tap in the making. */
  private down: { x: number; y: number; at: number } | null = null;
  /** The sources holding the reel. It is held while there is one, and let go when the last lets go. */
  private readonly holds = new Set<Source>();
  /** Whether `reel(true)` is out and has not been taken back, so the first hold sends it and only the last lets go. */
  private sent = false;
  /** Whether the phone has motion sensors; until it says, it has none. */
  private motion = false;
  private thumb: Thumb | null = null;
  /** Who set the aim the page draws, so one that leaves takes back its own aim and not another's. */
  private aimBy: 'screen' | 'phone' | null = null;

  constructor(
    private readonly target: GestureTarget,
    private readonly phone: PhoneTuning,
  ) {}

  /**
   * Keeps the reel true to the holds after the game stopped reeling by itself (a fish landed or slipped, which the
   * holds know nothing of): the page calls it each frame. A hold still down when the next fish is hooked reels again;
   * without this the set would say the reel was out and swallow it.
   */
  sync() {
    if (!this.holds.size) return;
    if (this.target.bitePhase() !== 'hooked') this.sent = false;
    else if (!this.sent) this.reelOn();
  }

  handle(e: GestureEvent) {
    this.sync();
    if ('source' in e && e.source === 'phone') {
      this.fromPhone(e);
      return;
    }
    const t = this.target;
    switch (e.type) {
      case 'down':
        // with a fish on, a hold on the water from the shore reels, for as long as it is held
        if (t.mode() === 'cast' && t.bitePhase() === 'hooked') {
          this.hold('screen');
          return;
        }
        this.down = { x: e.x, y: e.y, at: e.at };
        return;
      case 'move':
        if (this.down && t.mode() === 'cast') this.aim('screen', this.aimOf(e, this.down));
        return;
      case 'cancel':
        this.down = null;
        this.unaim('screen');
        this.drop('screen');
        return;
      case 'up':
        this.up(e);
        return;
      case 'press':
        if (e.source === 'key') {
          if (t.bitePhase() === 'hooked') this.hold('key');
          else if (!e.repeat) t.strike();
        } else {
          if (t.bitePhase() !== 'hooked') t.strike();
          if (t.bitePhase() === 'hooked') this.hold('button');
        }
        return;
      case 'activate':
        if (t.bitePhase() !== 'hooked') t.strike();
        return;
      case 'release':
        this.release(e.source);
        return;
      case 'blur':
        // the window lost the focus, so a key could not come up in it: the key's hold goes, and a button's does not
        this.release('key');
        return;
      case 'left-cast':
        // leaving cast drops an aim begun, and a reel held by the screen or by the phone, whose thumb is then for a
        // mode that is gone: its next touch asks for cast again
        this.unaim(null);
        this.down = null;
        this.thumb = null;
        this.drop('screen');
        this.drop('phone');
        return;
    }
  }

  private up(e: PointerGesture) {
    const t = this.target;
    if (this.holds.has('screen')) {
      this.release('screen');
      return;
    }
    const was = this.down;
    this.down = null;
    if (was && t.mode() === 'cast') {
      // let go inside the dead zone, the drag is taken back and nothing is cast
      const to = this.aimOf(e, was);
      this.unaim('screen');
      if (to) {
        t.cast(to.angle, to.power);
        return;
      }
    }
    if (!was || Math.hypot(e.x - was.x, e.y - was.y) > TAP_PX || e.at - was.at > TAP_MS) return;
    // from the shore with the lure in the water, a tap strikes; anywhere else it drops a pebble where it was tapped
    if (t.mode() === 'cast' && t.lurePhase() === 'sinking') {
      t.strike();
      return;
    }
    t.pebble(e.x, e.y);
  }

  private aimOf(e: PointerGesture, from: { x: number; y: number }) {
    const { short, heading } = this.target.view();
    return aimFrom(e.x - from.x, e.y - from.y, short, heading);
  }

  /** The phone's gestures, which always act as in cast mode: the first in look mode asks the page to go there; in row mode and while rowing they are ignored. */
  private fromPhone(e: PhoneGesture) {
    const t = this.target;
    // in row mode and while the boat is rowed the phone is not the rod: its touches are ignored, not refused (no call, no
    // word to the page); what it says about itself and its leaving are always taken
    if (e.type !== 'hello' && e.type !== 'gone' && (t.mode() === 'row' || t.rowing?.())) return;
    switch (e.type) {
      case 'hello':
        this.motion = e.motion;
        return;
      case 'down':
        if (t.mode() !== 'cast') t.wantCast();
        // with a fish on, the thumb reels; otherwise it raises the rod, or begins a drag
        if (t.bitePhase() === 'hooked') {
          this.hold('phone');
          return;
        }
        this.thumb = { at: e.at, from: null, far: 0, zero: null, turn: 0, flicked: false };
        return;
      case 'move': {
        const th = this.thumb;
        if (!th) return;
        if (!th.from) th.from = { x: e.x, y: e.y };
        const { dx, dy, short } = this.padDrag(e, th.from);
        th.far = Math.max(th.far, Math.hypot(dx, dy) / short);
        if (!this.motion) this.aim('phone', aimFrom(dx, dy, short, t.view().heading));
        return;
      }
      case 'tilt': {
        const th = this.thumb;
        if (!th || !this.motion || th.flicked) return;
        th.zero ??= e.g;
        const p = this.phone;
        const share = Math.max(-1, Math.min(1, (e.g - th.zero) / p.tiltRange));
        // a phone tilted right aims right as the camera sees it, which is clockwise: the angle goes down
        th.turn = -share * ((p.aimSpread * Math.PI) / 180);
        this.aim('phone', { angle: t.view().heading + th.turn, power: p.previewPower });
        return;
      }
      case 'flick': {
        const th = this.thumb;
        if (!th || !this.motion || th.flicked) return;
        const p = this.phone;
        const strength = Math.max(0, Math.min(1, (e.peak - p.flickMin) / (p.flickFull - p.flickMin)));
        th.flicked = true;
        this.unaim('phone');
        t.cast(t.view().heading + th.turn, p.flickLeast + (1 - p.flickLeast) * strength);
        return;
      }
      case 'up':
        this.phoneUp(e);
        return;
      case 'gone':
        // the phone left: its reel is let go, its rod is lowered and an aim it began is dropped; a screen drag goes on
        this.thumb = null;
        this.motion = false;
        this.drop('phone');
        if (this.aimBy === 'phone') this.unaim('phone');
        return;
    }
  }

  private phoneUp(e: Extract<PhoneGesture, { type: 'up' }>) {
    const t = this.target;
    if (this.holds.has('phone')) {
      this.release('phone');
      return;
    }
    const th = this.thumb;
    this.thumb = null;
    if (!th || th.flicked) return;
    // without motion the pad is a drag, and what it last aimed is the cast
    const to = this.motion ? null : this.lastDrag;
    this.unaim('phone');
    if (to) {
      t.cast(to.angle, to.power);
      return;
    }
    // a tap strikes while the lure is sinking; the pad has no point on the lake, so it never drops a pebble
    if (th.far <= TAP_SHARE && e.at - th.at <= TAP_MS && t.lurePhase() === 'sinking') t.strike();
  }

  /** What the pad's drag, without motion, now aims; null inside the dead zone. */
  private lastDrag: { angle: number; power: number } | null = null;

  /** A drag between two points on the pad, in the pad's own units against its shorter side. */
  private padDrag(e: { x: number; y: number; aspect: number }, from: { x: number; y: number }) {
    return { dx: (e.x - from.x) * e.aspect, dy: e.y - from.y, short: Math.min(e.aspect, 1) };
  }

  /** The aim the page draws, owned by `by`; none clears it. */
  private aim(by: 'screen' | 'phone', to: { angle: number; power: number } | null) {
    if (by === 'phone') this.lastDrag = to;
    this.aimBy = to ? by : this.aimBy === by ? null : this.aimBy;
    if (to || this.aimBy === null) this.target.setAim(to);
  }

  /** Clears the aim if `by` owns it or nobody does; null clears it whoever owns it. */
  private unaim(by: 'screen' | 'phone' | null) {
    if (by === 'phone') this.lastDrag = null;
    if (by && this.aimBy && this.aimBy !== by) return;
    this.aimBy = null;
    this.target.setAim(null);
  }

  private reelOn() {
    this.sent = true;
    this.target.reel(true);
  }

  /** A source holds the reel: sent for the first, and again for a repeat of one already holding (a key held down). */
  private hold(source: Source) {
    const again = this.holds.has(source);
    this.holds.add(source);
    if (!this.sent || again) this.reelOn();
  }

  /** A source lets go of the reel; it is let go only when no source holds it, whether this one was holding or not. */
  private release(source: Source) {
    this.holds.delete(source);
    if (this.holds.size) return;
    this.sent = false;
    this.target.reel(false);
  }

  /** As `release`, but only for a source that is holding. */
  private drop(source: Source) {
    if (this.holds.has(source)) this.release(source);
  }
}
