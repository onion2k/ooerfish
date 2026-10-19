/**
 * The day's end on the screen: the fade to the night and back, the yawn's words while the screen goes dark, the morning
 * line and the Down to the pond button once the player has woken in the cabin, and the Go to bed item in the menu. What
 * is said is `nightWords`, a pure function of where the player is, so it is tested without a page; the fade is the
 * game's own (`Game.fade`, stepped like everything else, never a CSS transition on the wall clock, so a picture holds
 * still), and the view writes the page only where something has changed.
 */
import type { Game } from './game';
import type { Place } from './night';

export interface NightElements {
  /** The full-screen cover whose opacity is the fade. */
  fade: HTMLElement;
  /** The yawn's words. */
  yawn: HTMLElement;
  /** The morning line. */
  morning: HTMLElement;
  /** The Down to the pond button, shown with the morning line. */
  down: HTMLElement;
  /** The Go to bed item in the menu, greyed when the night cannot be begun. */
  bed: HTMLButtonElement;
}

/** What the page says of the night: the yawn's line, the morning's, and whether Go to bed may be pressed. */
export interface NightWords {
  yawn: string | null;
  morning: string | null;
  bed: boolean;
}

/** The yawn's line, as the player is put to bed. */
export const YAWN_WORDS = 'Yawn… time for bed';

/** The words for where the player is on this day, with a fish on the line or landed or not (which holds the bed off). */
export function nightWords(place: Place, day: number, fighting: boolean): NightWords {
  return {
    yawn: place === 'yawning' ? YAWN_WORDS : null,
    morning: place === 'cabin' ? `Day ${day}. Morning at the cabin.` : null,
    bed: place !== 'yawning' && !fighting,
  };
}

export class NightView {
  private was = { fade: '', yawn: '', morning: '', bed: '' };

  constructor(
    private readonly el: NightElements,
    private readonly game: () => Game,
  ) {}

  /** The page made what the game says, where it has changed. */
  show() {
    const g = this.game();
    const { el, was } = this;
    const fighting = g.bite.phase === 'hooked' || g.bite.phase === 'landed';
    const w = nightWords(g.place, g.day, fighting);

    // a thousandth is finer than an eye or a frame can tell, and a fade that has not moved writes nothing
    const f = g.fade();
    const fade = f > 0 ? f.toFixed(3) : '';
    if (fade !== was.fade) {
      was.fade = fade;
      el.fade.hidden = fade === '';
      if (fade !== '') el.fade.style.opacity = fade;
    }
    const yawn = w.yawn ?? '';
    if (yawn !== was.yawn) {
      was.yawn = yawn;
      el.yawn.hidden = yawn === '';
      el.yawn.textContent = yawn;
    }
    const morning = w.morning ?? '';
    if (morning !== was.morning) {
      was.morning = morning;
      el.morning.hidden = el.down.hidden = morning === '';
      el.morning.textContent = morning;
    }
    const bed = w.bed ? 'on' : 'off';
    if (bed !== was.bed) {
      was.bed = bed;
      el.bed.disabled = !w.bed;
    }
  }
}
