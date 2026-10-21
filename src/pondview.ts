/**
 * The pond on the page: the glow gauge in the corner (the lake's name and a bar that empties as it is cleaned, read
 * from the game each frame), the welcome line a new player sees until the first cast, and the line said for a while
 * when a fish is cured, when a drum of waste is hauled and when the pond is clean. What it says is `pondWords`, a pure function of the game's state, so
 * it is tested without a page; the view writes the page only where that has changed, and does nothing of the game: the
 * player's fishing is `fightview.ts`'s, and the cure is the game's.
 */
import type { Game } from './game';
import { GIFT_GIVER } from './lake';
import type { Lake } from './lakes/lake';
import { HOME } from './lakes';

export interface PondElements {
  gauge: HTMLElement;
  name: HTMLElement;
  bar: HTMLElement;
  /** The dark part of the bar, from its right, as wide as the share of the glow that has gone. */
  gone: HTMLElement;
  welcome: HTMLElement;
  toast: HTMLElement;
}

/**
 * What the words depend on: how many fish are cured and how many drums hauled, whether a cast has been made, and the
 * lines said last and until when.
 */
export interface PondState {
  cured: number;
  /** How many fish it takes to cure them all. */
  toClean: number;
  /** How many drums of waste are hauled. */
  drums: number;
  /** Whether the player has cast, this session. */
  cast: boolean;
  /** How many fish had been cured when the line was last said, and the game time it is said until. */
  toastCured: number;
  toastUntil: number;
  /** How many drums had been hauled when the line about a haul was last said, and the game time it is said until. */
  toastHauled: number;
  hauledUntil: number;
  /** Until when the line about a treasure kept is said, in game time: it is the last one's, kept and not counted. */
  foundUntil: number;
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
  /** The share of the glow left, from one (as sick as it starts) to nought (clean): what the bar shows, the lake's own sum. */
  glow: number;
  clean: boolean;
  /** The line said for a fish cured, in a plain lead and a bold rest, or null when none is. */
  toast: { lead: string; bold: string } | null;
}

/** What the page says for this state of the pond. */
export function pondWords(s: PondState, lake: Lake = HOME): PondWords {
  const name = lake.name;
  // clean is every fish cured and every drum hauled, and the gauge is the lake's own formula for how far from it
  const clean = s.cured >= s.toClean && s.drums >= lake.drums.count;
  const glow = lake.contaminationAfter(s.cured, s.drums);
  let toast: PondWords['toast'] = null;
  const cureOn = s.t < s.toastUntil && s.toastCured > 0;
  const haulOn = s.t < s.hauledUntil && s.toastHauled > 0;
  const foundOn = s.t < s.foundUntil;
  // the newest of the lines is the one said: a treasure kept, a drum hauled or a fish cured
  if (foundOn && (!haulOn || s.foundUntil > s.hauledUntil) && (!cureOn || s.foundUntil > s.toastUntil)) {
    toast = { lead: 'Found!', bold: "It's for the shelf." };
  } else if (haulOn && (!cureOn || s.hauledUntil >= s.toastUntil)) {
    if (clean) toast = { lead: `The ${name} is clean!`, bold: 'Every fish is cured and every drum hauled.' };
    else toast = { lead: 'Hauled out!', bold: 'The pond clears a lot.' };
  } else if (cureOn) {
    if (s.toastCured === s.toClean && clean) toast = { lead: `The ${name} is clean!`, bold: 'Every fish is cured.' };
    else toast = { lead: 'Cured!', bold: 'The pond clears a little.' };
  } else if (s.gift && s.t >= s.giftFrom && s.t < s.giftUntil)
    toast = { lead: `A gift from ${GIFT_GIVER}: ${s.gift.name}.`, bold: s.gift.words };
  // a player who has cured a fish is not welcomed again, on this visit or the next
  return { name, welcome: !s.cast && s.cured === 0 && s.drums === 0, glow, clean, toast };
}

/** A share as a per cent, to a tenth, so a still bar writes nothing. */
const per = (v: number) => `${Math.round(v * 1000) / 10}%`;

export class PondView {
  private cast = false;
  private toastCured = 0;
  private toastUntil = -Infinity;
  private toastHauled = 0;
  private hauledUntil = -Infinity;
  private foundUntil = -Infinity;
  private gift: PondState['gift'] = null;
  private giftFrom = -Infinity;
  private giftUntil = -Infinity;
  private was = { welcome: '', toast: '', gone: '', clean: '', gauge: '', name: '' };

  /** `heardFor` is how long a line about a cure is said, in seconds of game time. */
  constructor(
    private readonly el: PondElements,
    private readonly game: () => Game,
    private readonly heardFor: number,
    private readonly lake: Lake,
  ) {
    el.bar.setAttribute('role', 'meter');
    el.bar.setAttribute('aria-label', `Glow in the ${lake.name}, from clean to sick`);
    el.bar.setAttribute('aria-valuemin', '0');
    el.bar.setAttribute('aria-valuemax', '100');
  }

  /** A fish was cured: the line about it is said for a while, from now. */
  cured(cured: number, _toClean: number) {
    this.toastCured = cured;
    this.toastUntil = this.game().t + this.heardFor;
  }

  /** A drum was hauled: the line about it is said for a while, from now. */
  hauled(hauled: number, _drums: number) {
    this.toastHauled = hauled;
    this.hauledUntil = this.game().t + this.heardFor;
  }

  /** A treasure was kept for the shelf: the line about it is said for a while, from now. It cleans nothing, so the gauge does not move. */
  found(_id: string) {
    this.foundUntil = this.game().t + this.heardFor;
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
    const w = pondWords(
      {
        cured: g.progress.save.cured,
        toClean: this.lake.toClean,
        drums: g.progress.save.drums,
        cast: this.cast,
        toastCured: this.toastCured,
        toastUntil: this.toastUntil,
        toastHauled: this.toastHauled,
        hauledUntil: this.hauledUntil,
        foundUntil: this.foundUntil,
        gift: this.gift,
        giftFrom: this.giftFrom,
        giftUntil: this.giftUntil,
        t: g.t,
      },
      this.lake,
    );
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
    // away from the pond (yawning, or in the cabin) the pond's own lines are not said, and their time stands still
    const away = g.place !== 'pond';
    const welcome = w.welcome && !away ? 'on' : 'off';
    if (welcome !== this.was.welcome) {
      this.was.welcome = welcome;
      el.welcome.hidden = welcome === 'off';
    }
    const said = away ? null : w.toast;
    const toast = said ? `${said.lead}|${said.bold}` : '';
    if (toast !== this.was.toast) {
      this.was.toast = toast;
      el.toast.hidden = !said;
      if (said) el.toast.innerHTML = `${said.lead} <b>${said.bold}</b>`;
    }
  }
}
