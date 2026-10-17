/**
 * The pond on the page: the glow gauge in the corner (the lake's name and a bar that empties as it is cleaned, read
 * from the game each frame), the welcome line a new player sees until the first cast, and the line said for a while
 * when a fish is cured and when the pond is clean. What it says is `pondWords`, a pure function of the game's state, so
 * it is tested without a page; the view writes the page only where that has changed, and does nothing of the game: the
 * player's fishing is `fightview.ts`'s, and the cure is the game's.
 */
import type { Game } from './game';
import { CURE, GIFT_GIVER, LAKE_NAME } from './lake';

export interface PondElements {
  gauge: HTMLElement;
  name: HTMLElement;
  bar: HTMLElement;
  /** The dark part of the bar, from its right, as wide as the share of the glow that has gone. */
  gone: HTMLElement;
  welcome: HTMLElement;
  toast: HTMLElement;
}

/** What the words depend on: how many fish are cured, whether a cast has been made, and the line said last and until when. */
export interface PondState {
  cured: number;
  toClean: number;
  /** Whether the player has cast, this session. */
  cast: boolean;
  /** How many fish had been cured when the line was last said, and the game time it is said until. */
  toastCured: number;
  toastUntil: number;
  /**
   * The gift last given, and the game time its line is said from and until. A gift comes with its cure, so its line
   * waits for the cure's to end (`giftFrom` is that time) and the two never overlap.
   */
  gift: { name: string; words: string } | null;
  giftFrom: number;
  giftUntil: number;
  t: number;
}

export interface PondWords {
  name: string;
  /** Whether the welcome line is shown. */
  welcome: boolean;
  /** The share of the glow left, from one (as sick as it starts) to nought (clean): what the bar shows. */
  glow: number;
  clean: boolean;
  /** The line said for a fish cured, in a plain lead and a bold rest, or null when none is. */
  toast: { lead: string; bold: string } | null;
}

/** What the page says for this state of the pond. */
export function pondWords(s: PondState): PondWords {
  const clean = s.cured >= s.toClean;
  const glow = Math.max(0, 1 - s.cured / s.toClean);
  let toast: PondWords['toast'] = null;
  if (s.t < s.toastUntil && s.toastCured > 0) {
    if (s.toastCured === s.toClean) toast = { lead: `The ${LAKE_NAME} is clean!`, bold: 'Every fish is cured.' };
    else toast = { lead: 'Cured!', bold: 'The pond clears a little.' };
  } else if (s.gift && s.t >= s.giftFrom && s.t < s.giftUntil)
    toast = { lead: `A gift from ${GIFT_GIVER}: ${s.gift.name}.`, bold: s.gift.words };
  // a player who has cured a fish is not welcomed again, on this visit or the next
  return { name: LAKE_NAME, welcome: !s.cast && s.cured === 0, glow, clean, toast };
}

/** A share as a per cent, to a tenth, so a still bar writes nothing. */
const per = (v: number) => `${Math.round(v * 1000) / 10}%`;

export class PondView {
  private cast = false;
  private toastCured = 0;
  private toastUntil = -Infinity;
  private gift: PondState['gift'] = null;
  private giftFrom = -Infinity;
  private giftUntil = -Infinity;
  private was = { welcome: '', toast: '', gone: '', clean: '', gauge: '', name: '' };

  /** `heardFor` is how long a line about a cure is said, in seconds of game time. */
  constructor(
    private readonly el: PondElements,
    private readonly game: () => Game,
    private readonly heardFor: number,
  ) {
    el.bar.setAttribute('role', 'meter');
    el.bar.setAttribute('aria-label', `Glow in the ${LAKE_NAME}, from clean to sick`);
    el.bar.setAttribute('aria-valuemin', '0');
    el.bar.setAttribute('aria-valuemax', '100');
  }

  /** A fish was cured: the line about it is said for a while, from now. */
  cured(cured: number, _toClean: number) {
    this.toastCured = cured;
    this.toastUntil = this.game().t + this.heardFor;
  }

  /**
   * A gift was given with the cure just told: its line is said after the cure's own, which the game has told first,
   * for as long again, so the two never share the toast.
   */
  gifted(name: string, words: string) {
    this.gift = { name, words };
    this.giftFrom = Math.max(this.game().t, this.toastUntil);
    this.giftUntil = this.giftFrom + this.heardFor;
  }

  /** The page made what the game says, where it has changed. */
  show() {
    const g = this.game();
    const { el } = this;
    // the first cast takes the welcome away; a lure anywhere but at the rod has been cast
    if (g.lure.phase !== 'ready') this.cast = true;
    const w = pondWords({
      cured: g.progress.save.cured,
      toClean: CURE.toClean,
      cast: this.cast,
      toastCured: this.toastCured,
      toastUntil: this.toastUntil,
      gift: this.gift,
      giftFrom: this.giftFrom,
      giftUntil: this.giftUntil,
      t: g.t,
    });
    if (this.was.gauge === '') {
      this.was.gauge = 'on';
      el.gauge.hidden = false;
    }
    if (w.name !== this.was.name) el.name.textContent = this.was.name = w.name;
    // the bar is the glow that is left; the dark part covers the share that has gone, from the right
    const gone = per(1 - w.glow);
    if (gone !== this.was.gone) {
      this.was.gone = gone;
      el.gone.style.width = gone;
      el.bar.setAttribute('aria-valuenow', String(Math.round(w.glow * 100)));
    }
    const clean = w.clean ? 'clean' : '';
    if (clean !== this.was.clean) {
      this.was.clean = clean;
      el.gauge.classList.toggle('clean', w.clean);
    }
    const welcome = w.welcome ? 'on' : 'off';
    if (welcome !== this.was.welcome) {
      this.was.welcome = welcome;
      el.welcome.hidden = !w.welcome;
    }
    const toast = w.toast ? `${w.toast.lead}|${w.toast.bold}` : '';
    if (toast !== this.was.toast) {
      this.was.toast = toast;
      el.toast.hidden = !w.toast;
      if (w.toast) el.toast.innerHTML = `${w.toast.lead} <b>${w.toast.bold}</b>`;
    }
  }
}
