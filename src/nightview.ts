/**
 * The day's end on the screen: the fade to the night and back, the yawn's words while the screen goes dark, the morning
 * line and the Out to the lake button once the player has woken in the cabin, and the Go to bed item in the menu. What
 * is said is `nightWords`, a pure function of where the player is, so it is tested without a page; the fade is the
 * game's own (`Game.fade`, stepped like everything else, never a CSS transition on the wall clock, so a picture holds
 * still), and the view writes the page only where something has changed.
 */
import type { Game } from './game';
import { HOUR, seasonOf } from './calendar';
import { theLake } from './lakes/page';
import { radioWords } from './radio';
import type { Place } from './night';

export interface NightElements {
  /** The full-screen cover whose opacity is the fade. */
  fade: HTMLElement;
  /** The yawn's words. */
  yawn: HTMLElement;
  /** The morning line. */
  morning: HTMLElement;
  /** The radio's panel under it: the forecast and the gossip, one to a line. */
  radio: HTMLElement;
  /** The Out to the lake button, shown with the morning line. */
  down: HTMLElement;
  /** The Somewhere else… button, shown with it, which opens the lakes page. */
  elsewhere: HTMLElement;
  /** The Go to bed item in the menu, greyed when the night cannot be begun. */
  bed: HTMLButtonElement;
  /** The Camera item, greyed with them: a photograph is not taken with a fish on the line. */
  camera?: HTMLButtonElement;
  /** The Sleep through… item beside it, greyed by the same flag: the bed and sleeping through are refused together. */
  sleep: HTMLButtonElement;
  /** The Go to the cabin item beside them, greyed mid-fight, in the cabin (where there is no door to walk in by) and aboard the boat. */
  cabin: HTMLButtonElement;
}

/** What the page says of the night: the yawn's line, the morning's, and whether Go to bed may be pressed. */
export interface NightWords {
  yawn: string | null;
  morning: string | null;
  /** The morning's button, naming the lake the save names; with it the Somewhere else… button is shown. */
  out: string | null;
  /** Whether Go to bed and Sleep through… may be pressed, which they are together. */
  bed: boolean;
  /** Whether Go to the cabin may be pressed: at the pond with no fish on the line or landed. */
  cabin: boolean;
}

/** The yawn's line, as the player is put to bed. */
export const YAWN_WORDS = 'Yawn… time for bed';

/**
 * The hour's name on a day: summer's is the plain, capitalised word ("Morning", "Afternoon"), and the other seasons
 * name themselves before it ("A winter afternoon"), as the morning always has. A look not known is the morning.
 */
function hourOf(day: number, timeName: string): string {
  const season = seasonOf(day);
  const hour = HOUR[timeName] ?? 'morning';
  if (season === 'summer') return hour[0].toUpperCase() + hour.slice(1);
  return `${season === 'autumn' ? 'An' : 'A'} ${season} ${hour}`;
}

/**
 * The words for where the player is on this day, with a fish on the line or landed or not (which holds the bed and the
 * way into the cabin off), and the name of the clock's look (`dawn`, `day`, `dusk` or `night`), which the cabin's line
 * says as the hour.
 * The morning's button names the lake the save names, which after a wake is the home whichever lake the day ended at:
 * going back is "Somewhere else…", the lakes page.
 */
export function nightWords(
  place: Place,
  day: number,
  fighting: boolean,
  lakeName: string,
  timeName: string,
): NightWords {
  return {
    yawn: place === 'yawning' ? YAWN_WORDS : null,
    morning: place === 'cabin' ? `Day ${day}. ${hourOf(day, timeName)} at the cabin.` : null,
    out: place === 'cabin' ? `Out to ${theLake(lakeName)}` : null,
    bed: place === 'pond' || place === 'cabin' ? !fighting : false,
    cabin: place === 'pond' && !fighting,
  };
}

export class NightView {
  private was = { fade: '', yawn: '', morning: '', out: '', bed: '', cabin: '' };
  /**
   * The radio's last words, and what they were worked out for. The clock holds in the cabin and the save cannot change
   * there, so the words are worked out again only when the day or the hour moves or the cabin is newly entered, never
   * each frame.
   */
  private said = { forecast: '', gossip: '', text: '', day: 0, hour: '', shown: false };

  /** The radio's words as last written to the page, and whether they are shown. */
  radio(): { forecast: string; gossip: string; shown: boolean } {
    const { forecast, gossip, shown } = this.said;
    return { forecast, gossip, shown };
  }

  constructor(
    private readonly el: NightElements,
    private readonly game: () => Game,
    /** The name of the look the clock is at, which the page keeps (it knows the season's and the moon's looks). */
    private readonly timeName: () => string,
  ) {}

  /** The page made what the game says, where it has changed. */
  show() {
    const g = this.game();
    const { el, was } = this;
    const fighting = g.bite.phase === 'hooked' || g.bite.phase === 'landed';
    // the button names the lake the save names, which is the lake the page was loaded at but for the moment of a wake
    const { lakes, save } = g.progress;
    const w = nightWords(g.place, g.day, fighting, (lakes[save.lake] ?? g.lake).name, this.timeName());

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
    // the radio is heard with the morning line, and its words are worked out only when what they are of has moved
    const { said } = this;
    if (morning === '') {
      if (said.shown) {
        said.shown = false;
        said.day = 0;
        said.forecast = said.gossip = '';
        el.radio.hidden = true;
      }
    } else {
      const hour = this.timeName();
      if (!said.shown || said.day !== g.day || said.hour !== hour) {
        const r = radioWords(g.day, save, lakes, hour);
        const text = `${r.forecast}\n${r.gossip}`;
        said.shown = true;
        said.day = g.day;
        said.hour = hour;
        said.forecast = r.forecast;
        said.gossip = r.gossip;
        el.radio.hidden = false;
        if (text !== said.text) {
          said.text = text;
          el.radio.textContent = text;
        }
      }
    }
    const out = w.out ?? '';
    if (out !== was.out) {
      was.out = out;
      el.down.textContent = out;
    }
    const bed = w.bed ? 'on' : 'off';
    if (bed !== was.bed) {
      was.bed = bed;
      el.bed.disabled = el.sleep.disabled = !w.bed;
      if (el.camera) el.camera.disabled = !w.bed;
    }
    // the cabin is reached from the shore: the item is greyed aboard the boat, rowing or anchored, as the game refuses it
    const walk = w.cabin && !g.boat.aboard;
    const cabin = walk ? 'on' : 'off';
    if (cabin !== was.cabin) {
      was.cabin = cabin;
      el.cabin.disabled = !walk;
    }
  }
}
