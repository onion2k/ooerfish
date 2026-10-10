/**
 * The fight on the page: the line's tension as an arc, white to red, with a word for it so the colour is not all it
 * says; the button that strikes, and held, reels, for any view and for one finger; the catch shown off on a card,
 * put in the bucket by a tap on it; and the bucket's count. It reads the game each frame and writes the page only
 * where something has changed, and does nothing of the fishing itself: it calls the game's strike, reel and stow.
 */
import type { Game } from './game';
import { PERCH } from './lake';
import { PALETTE, type Colour } from './palette';

export interface FightElements {
  gauge: HTMLElement;
  fill: SVGPathElement;
  words: HTMLElement;
  button: HTMLButtonElement;
  card: HTMLButtonElement;
  name: HTMLElement;
  weight: HTMLElement;
  bucket: HTMLElement;
}

/** What the tension is called, from slack to as tight as it goes, at the start of each quarter. */
const WORDS = ['slack', 'taut', 'tight', 'too tight!'] as const;
const COLOURS: readonly Colour[] = [PALETTE.line, PALETTE.lineWarm, PALETTE.lineHot, PALETTE.lineRed];
const css = ([r, g, b]: Colour) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

export class FightView {
  private was = { gauge: '', button: '', card: '', bucket: -1 };

  constructor(
    private readonly el: FightElements,
    private readonly game: () => Game,
  ) {
    const { button, card } = el;
    // the button strikes when pressed, and while a fish is on, reels for as long as it is held
    button.addEventListener('pointerdown', (e) => {
      button.setPointerCapture(e.pointerId);
      const g = this.game();
      if (g.bite.phase !== 'hooked') g.strike();
      if (g.bite.phase === 'hooked') g.reel(true);
    });
    const letGo = () => this.game().reel(false);
    button.addEventListener('pointerup', letGo);
    button.addEventListener('pointercancel', letGo);
    button.addEventListener('lostpointercapture', letGo);
    // by the keyboard it strikes once a press; space held anywhere reels, which the page handles
    button.addEventListener('click', (e) => {
      if (e.detail === 0 && this.game().bite.phase !== 'hooked') this.game().strike();
    });
    card.addEventListener('click', () => {
      this.game().stow();
    });
  }

  /** The page made what the game says, where it has changed. */
  show() {
    const g = this.game();
    const { phase } = g.bite;
    const el = this.el;

    const tension = phase === 'hooked' ? g.line.tension : -1;
    const step = Math.min(3, Math.floor(Math.max(0, tension) * 4));
    const gauge = tension < 0 ? '' : `${Math.round(tension * 100)} ${step}`;
    if (gauge !== this.was.gauge) {
      this.was.gauge = gauge;
      el.gauge.hidden = !gauge;
      if (gauge) {
        el.fill.setAttribute('stroke-dasharray', `${Math.round(tension * 100)} 100`);
        el.fill.setAttribute('stroke', css(COLOURS[step]));
        el.words.textContent = WORDS[step];
      }
    }

    // the button is there while the lure is in the water or a fish is on: Strike until one is hooked, then Reel
    const live = g.lure.phase === 'sinking' || phase === 'hooked';
    const button = !live ? '' : phase === 'hooked' ? `Reel ${g.reeling}` : 'Strike';
    if (button !== this.was.button) {
      this.was.button = button;
      el.button.hidden = !button;
      el.button.textContent = phase === 'hooked' ? 'Reel' : 'Strike';
      el.button.setAttribute('aria-pressed', String(phase === 'hooked' && g.reeling));
    }

    const card = phase === 'landed' ? `${g.catchWeight}` : '';
    if (card !== this.was.card) {
      this.was.card = card;
      el.card.hidden = !card;
      if (card) {
        el.name.textContent = PERCH.name;
        el.weight.textContent = `${g.catchWeight.toFixed(2)} kg`;
      }
    }

    if (g.bucket !== this.was.bucket) {
      this.was.bucket = g.bucket;
      el.bucket.hidden = g.bucket === 0;
      el.bucket.textContent = `in the bucket: ${g.bucket}`;
    }
  }
}
