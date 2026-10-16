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

/** Where an event came from; the phone joins these later. */
export type Source = 'screen' | 'key' | 'button' | 'phone';

/** A pointer on the water, in the page's pixels and the event's own milliseconds. */
export interface PointerGesture {
  type: 'down' | 'move' | 'up' | 'cancel';
  source: 'screen';
  x: number;
  y: number;
  at: number;
}

export type GestureEvent =
  | PointerGesture
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
  /** The screen's shorter side in pixels and the camera's heading round the compass, for a drag's cast. */
  view(): { short: number; heading: number };
}

export class Gesture {
  /** Where the pointer went down, while it is a drag or a tap in the making. */
  private down: { x: number; y: number; at: number } | null = null;
  /** Whether the screen is holding the reel, with a fish on. */
  private screenHold = false;

  constructor(private readonly target: GestureTarget) {}

  handle(e: GestureEvent) {
    const t = this.target;
    switch (e.type) {
      case 'down':
        // with a fish on, a hold on the water from the shore reels, for as long as it is held
        if (t.mode() === 'cast' && t.bitePhase() === 'hooked') {
          this.screenHold = true;
          t.reel(true);
          return;
        }
        this.down = { x: e.x, y: e.y, at: e.at };
        return;
      case 'move':
        if (this.down && t.mode() === 'cast') t.setAim(this.aimOf(e, this.down));
        return;
      case 'cancel':
        this.down = null;
        t.setAim(null);
        if (this.screenHold) t.reel(false);
        this.screenHold = false;
        return;
      case 'up':
        this.up(e);
        return;
      case 'press':
        if (e.source === 'key') {
          if (t.bitePhase() === 'hooked') t.reel(true);
          else if (!e.repeat) t.strike();
        } else {
          if (t.bitePhase() !== 'hooked') t.strike();
          if (t.bitePhase() === 'hooked') t.reel(true);
        }
        return;
      case 'activate':
        if (t.bitePhase() !== 'hooked') t.strike();
        return;
      // Today a key, the button or a blur letting go of the reel lets go whatever else holds it. Part 4 changes this:
      // the reel will be held while any one source holds it (criterion 6), and the blur will let go of the key's only.
      case 'release':
      case 'blur':
        t.reel(false);
        return;
      case 'left-cast':
        // leaving cast drops an aim begun, and a reel held by the screen
        t.setAim(null);
        this.down = null;
        if (this.screenHold) t.reel(false);
        this.screenHold = false;
        return;
    }
  }

  private up(e: PointerGesture) {
    const t = this.target;
    if (this.screenHold) {
      this.screenHold = false;
      t.reel(false);
      return;
    }
    const was = this.down;
    this.down = null;
    if (was && t.mode() === 'cast') {
      // let go inside the dead zone, the drag is taken back and nothing is cast
      const to = this.aimOf(e, was);
      t.setAim(null);
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
}
