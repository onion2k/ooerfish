/**
 * The day's end on the screen: the fade to the night and back, the yawn's words while the screen goes dark, the morning
 * line and the Out to the lake button once the player has woken in the cabin, and the Go to bed item in the menu. What
 * is said is `nightWords`, a pure function of where the player is, so it is tested without a page; the fade is the
 * game's own (`Game.fade`, stepped like everything else, never a CSS transition on the wall clock, so a picture holds
 * still), and the view writes the page only where something has changed.
 */
import type { Game } from './game';
import { seasonOf } from './calendar';
import { theLake } from './lakes/page';
import type { Place } from './night';

export interface NightElements {
  /** The full-screen cover whose opacity is the fade. */
  fade: HTMLElement;
  /** The yawn's words. */
  yawn: HTMLElement;
  /** The morning line. */
  morning: HTMLElement;
  /** The Out to the lake button, shown with the morning line. */
  down: HTMLElement;
  /** The Somewhere else… button, shown with it, which opens the lakes page. */
  elsewhere: HTMLElement;
  /** The Go to bed item in the menu, greyed when the night cannot be begun. */
  bed: HTMLButtonElement;
}

/** What the page says of the night: the yawn's line, the morning's, and whether Go to bed may be pressed. */
export interface NightWords {
  yawn: string | null;
  morning: string | null;
  /** The morning's button, naming the lake the save names; with it the Somewhere else… button is shown. */
  out: string | null;
  bed: boolean;
}

/** The yawn's line, as the player is put to bed. */
export const YAWN_WORDS = 'Yawn… time for bed';

/** The morning's name: summer's is the plain one it always was, and the other seasons name themselves. */
function morningOf(day: number): string {
  const season = seasonOf(day);
  if (season === 'summer') return 'Morning';
  return `${season === 'autumn' ? 'An' : 'A'} ${season} morning`;
}

/**
 * The words for where the player is on this day, with a fish on the line or landed or not (which holds the bed off).
 * The morning's button names the lake the save names, which after a wake is the home whichever lake the day ended at:
 * going back is "Somewhere else…", the lakes page.
 */
export function nightWords(place: Place, day: number, fighting: boolean, lakeName: string): NightWords {
  return {
    yawn: place === 'yawning' ? YAWN_WORDS : null,
    morning: place === 'cabin' ? `Day ${day}. ${morningOf(day)} at the cabin.` : null,
    out: place === 'cabin' ? `Out to ${theLake(lakeName)}` : null,
    bed: place === 'pond' || place === 'cabin' ? !fighting : false,
  };
}

export class NightView {
  private was = { fade: '', yawn: '', morning: '', out: '', bed: '' };

  constructor(
    private readonly el: NightElements,
    private readonly game: () => Game,
  ) {}

  /** The page made what the game says, where it has changed. */
  show() {
    const g = this.game();
    const { el, was } = this;
    const fighting = g.bite.phase === 'hooked' || g.bite.phase === 'landed';
    // the button names the lake the save names, which is the lake the page was loaded at but for the moment of a wake
    const { lakes, save } = g.progress;
    const w = nightWords(g.place, g.day, fighting, (lakes[save.lake] ?? g.lake).name);

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
      el.morning.hidden = el.down.hidden = el.elsewhere.hidden = morning === '';
      el.morning.textContent = morning;
    }
    const out = w.out ?? '';
    if (out !== was.out) {
      was.out = out;
      el.down.textContent = out;
    }
    const bed = w.bed ? 'on' : 'off';
    if (bed !== was.bed) {
      was.bed = bed;
      el.bed.disabled = !w.bed;
    }
  }
}
