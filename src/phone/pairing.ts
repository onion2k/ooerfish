/**
 * Pairing, the page's half: the overlay that shows the QR code, and the room it opens for the phone to scan its way
 * into. It is imported only when Pair a phone is first pressed, so the QR library and Trystero (which the link imports
 * in its turn) are never fetched to boot the game. It makes the room and key from the browser's crypto, opens the
 * link, hands the phone's gestures to the page, and closes the overlay when the phone joins. The rules for the one
 * phone are `session.ts`'s, which a test can play without a browser. Takes its elements and its places to send things
 * as arguments and imports no game state, so `main.ts` stays the only place that wires.
 */
import QRCode from 'qrcode';
import { blankPicture, fightPicture } from '../fightview';
import type { Game } from '../game';
import type { GestureEvent } from '../gesture';
import { localLink, trysteroLink, type Link } from './link';
import type { LinkName } from './linkname';
import type { ScreenMessage } from './protocol';
import { PhoneSession, newPairing, phoneUrl, type Pairing, type PhoneReading } from './session';
import { phoneWord } from './word';

/** The overlay's elements, found by the page. */
export interface PairingElements {
  overlay: HTMLElement;
  qr: HTMLCanvasElement;
  /** The phone's address in words, for a viewer who cannot scan. */
  address: HTMLElement;
  status: HTMLElement;
  close: HTMLButtonElement;
}

export interface PairingOptions {
  elements: PairingElements;
  /** The phone's gestures go here. */
  handle(e: GestureEvent): void;
  /** What the phone page is served from: the LAN address under `dev:phone`, the page's own otherwise. */
  origin: string;
  link: LinkName;
  /** The game, read for the word and the bar the phone is sent; the pairing never changes it. */
  game: () => Game;
  /** How many times a second the phone is sent the state of the fight at the most. */
  stateHz: number;
  /** The phone joined or left, said on the big screen. */
  said(text: string): void;
}

export class PairingOverlay {
  private pairing: Pairing | null = null;
  private link: Link | null = null;
  private session: PhoneSession | null = null;
  /** Opening is one thing at a time: a second press while the first is making the link shares it. */
  private opening: Promise<void> | null = null;
  /** The one message the phone is sent, written into each time: a frame at thirty a second makes nothing. */
  private readonly state: Extract<ScreenMessage, { kind: 'state' }> = {
    kind: 'state',
    word: '',
    picture: blankPicture(),
  };

  constructor(private readonly options: PairingOptions) {
    options.elements.close.addEventListener('click', () => this.close());
    // Escape closes it from anywhere; it is only listened for while the overlay is shown
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !options.elements.overlay.hidden) this.close();
    });
  }

  /** What the test API reads, or null until the link is open (the test API says nobody for that). */
  reading(): PhoneReading | null {
    return this.session?.reading() ?? null;
  }

  /**
   * Shows the overlay. The first time (or when `fixed` names a different room) it makes the room and opens the link;
   * after, it shows the same code again, since the room stays open while the page does. Resolves once the QR code is
   * drawn. `fixed` is for tests and the look pictures only, so a picture of the code holds still: a real press never
   * passes it. Its `origin` is the address the code carries, so a picture does not hold the port it was served on.
   */
  async open(fixed?: Pairing & { origin?: string }): Promise<void> {
    const same = !fixed || (this.pairing?.room === fixed.room && this.pairing.key === fixed.key);
    if (this.opening && same) await this.opening;
    else if (!this.pairing || !same) {
      this.opening = this.start(fixed ?? newPairing(), fixed?.origin).finally(() => (this.opening = null));
      await this.opening;
      // a phone that joined while the code was being drawn has already closed the overlay, and it stays closed
      if (this.session?.reading().paired) return;
    }
    this.show();
  }

  /**
   * Sends the phone the word and the bar if they are due, by the page's clock `now` in milliseconds (a frame's
   * timestamp). The picture is the game's, so a paused game sends a still bar. Does nothing, and builds nothing, with
   * no phone.
   */
  tick(now: number) {
    this.session?.sendState(now, () => {
      const game = this.options.game();
      this.state.word = phoneWord(game.bite.phase, game.lure.phase);
      fightPicture(game, this.state.picture);
      return this.state;
    });
  }

  /** The phone is asked to vibrate: a fish has bitten. */
  buzz() {
    this.session?.buzz();
  }

  close() {
    const { overlay } = this.options.elements;
    overlay.hidden = true;
  }

  private async start(pairing: Pairing, origin = this.options.origin) {
    // an earlier room, replaced, is left, or its phone would go on playing in a room nobody is shown
    this.link?.leave();
    this.pairing = pairing;
    const { link, elements } = this.options;
    const address = phoneUrl(origin, pairing, link);
    elements.overlay.dataset.url = address;
    elements.address.textContent = address;
    elements.status.textContent = 'Waiting for the phone…';
    this.link = link === 'local' ? localLink(pairing.room) : await trysteroLink(pairing.room, pairing.key);
    this.session = new PhoneSession(this.link, {
      handle: (e) => this.options.handle(e),
      now: () => performance.now(),
      stateHz: this.options.stateHz,
      onChange: (what) => {
        if (what === 'joined') {
          this.options.said('Phone connected');
          elements.status.textContent = 'Phone connected.';
          this.close();
        } else {
          this.options.said('The phone left');
          elements.status.textContent = 'The phone left. It can scan this code again, or open its address.';
        }
      },
    });
    await QRCode.toCanvas(elements.qr, address, { width: 256, margin: 2 });
    // drawn at its own size, shown at the card's: a narrow screen shrinks the code and keeps it square
    elements.qr.style.width = '100%';
    elements.qr.style.height = 'auto';
  }

  private show() {
    const { overlay, close } = this.options.elements;
    overlay.hidden = false;
    close.focus();
  }
}
