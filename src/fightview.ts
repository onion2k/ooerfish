/**
 * The bite and the fight on the page: while the strike's window is open, the Strike button pulsing and a mark over the
 * bobber; the bar beside the Reel button, with the zone the reel pushes up it, the fish darting on it in
 * its glow, and the meter beside it, with words for whether the fish is in the zone so position is not all it says;
 * the button that strikes, and held, reels, for any view and for one finger; the catch shown off on a card, put in the
 * bucket by a tap on it; and the bucket's count. It reads the game each frame and writes the page only where something
 * has changed, to a tenth of a per cent, and does nothing of the fishing itself: it calls the game's strike, reel and
 * stow.
 *
 * What the bar and the button show is `fightPicture(game)`, plain numbers, words and flags, and `FightBar` draws one
 * onto the bar's elements, so the phone can draw the same bar from a picture sent to it. What only the big screen has
 * (the mark placed over the bobber by the camera, the catch card and the bucket) is `FightView`'s own, read from the
 * game and not from the picture, since none of it is the phone's to show.
 */
import type { Game } from './game';
import type { GestureEvent } from './gesture';
import { FIGHT, PERCH } from './lake';
import { PALETTE, type Colour } from './palette';

/** The elements of the bar and the button, which the screen and the phone each have. */
export interface BarElements {
  gauge: HTMLElement;
  zone: HTMLElement;
  fish: SVGSVGElement;
  meter: HTMLElement;
  meterFill: HTMLElement;
  words: HTMLElement;
  button: HTMLButtonElement;
}

/** The big screen's own elements besides the bar. */
export interface FightElements extends BarElements {
  /** The mark over the bobber while the strike's window is open. */
  mark: HTMLElement;
  card: HTMLButtonElement;
  name: HTMLElement;
  weight: HTMLElement;
  bucket: HTMLElement;
}

const css = ([r, g, b]: Colour) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
/** Where a point of the lake is on the screen, or null behind the camera. */
export type ToScreen = (x: number, y: number, z: number) => { x: number; y: number } | null;

/** How fast the Strike button pulses while the window is open, in radians of game time a second; how high over the bobber the mark stands, in world units. */
const PULSE_RATE = 14;
const MARK_HIGH = 1.4;

/** A share of the bar as a per cent, to a tenth, so a still bar writes nothing. */
const per = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** What the bar and the button show, as plain data: only numbers, strings and booleans, so it can be sent as it is. */
export interface FightPicture {
  /** The bite's phase: none, coming, nibbling, biting, hooked or landed. */
  phase: string;
  /** The bar, each from nought to one: the foot of the zone, its height, where the fish is, and the meter. */
  zone: number;
  width: number;
  fishAt: number;
  meter: number;
  /** How far the fish is out of the zone, from calm to one. */
  tension: number;
  /** Whether the reel is held. */
  reeling: boolean;
  /** Whether the strike's window is open. */
  biting: boolean;
  /** How bright the Strike button is, from nought to one, to a twentieth; nought unless the window is open. */
  pulse: number;
  /** Whether the fish is in the zone: said in words so position is not all the bar says. Empty unless hooked. */
  words: string;
  /** The button's label, Strike or Reel, and empty when there is no button. */
  button: string;
}

/** A picture of nothing happening, to be written into by `fightPicture`: for a caller that keeps one and reuses it. */
export function blankPicture(): FightPicture {
  return {
    phase: 'none',
    zone: 0,
    width: FIGHT.width,
    fishAt: 0,
    meter: 0,
    tension: 0,
    reeling: false,
    biting: false,
    pulse: 0,
    words: '',
    button: '',
  };
}

/**
 * The fight as the bar and the button show it, worked out from the game and nothing else. It writes into `into` when
 * given one and hands it back, so the phone's thirty a second do not each make an object.
 */
export function fightPicture(g: Game, into: FightPicture = blankPicture()): FightPicture {
  const { phase } = g.bite;
  const hooked = phase === 'hooked';
  const biting = phase === 'biting';
  // the button is there while the lure is in the water or a fish is on: Strike until one is hooked, then Reel
  const live = g.lure.phase === 'sinking' || hooked;
  into.phase = phase;
  into.zone = g.line.zone;
  into.width = FIGHT.width;
  into.fishAt = g.line.fishAt;
  into.meter = g.line.meter;
  into.tension = g.line.tension;
  into.reeling = g.reeling;
  into.biting = biting;
  // by the game's clock, so a picture is the same every run
  into.pulse = biting ? Math.round((0.5 + 0.5 * Math.sin(g.t * PULSE_RATE)) * 20) / 20 : 0;
  into.words = hooked ? (g.line.inZone() ? 'in the zone' : 'out of the zone') : '';
  into.button = !live ? '' : hooked ? 'Reel' : 'Strike';
  return into;
}

/** The bar and the button drawn from a picture, writing an element only where its value has changed. */
export class FightBar {
  private was = { gauge: '', zone: '', fish: '', meter: '', words: '', button: '', pulse: '' };

  constructor(private readonly el: BarElements) {
    el.zone.style.height = per(FIGHT.width);
    el.fish.style.fill = css(PALETTE.glow);
    el.fish.style.filter = `drop-shadow(0 0 4px ${css(PALETTE.glow)})`;
  }

  draw(p: FightPicture) {
    const el = this.el;
    const on = p.phase === 'hooked';
    const gauge = on ? 'on' : '';
    if (gauge !== this.was.gauge) {
      this.was.gauge = gauge;
      el.gauge.hidden = !on;
    }
    if (on) {
      const zone = per(p.zone),
        fish = per(p.fishAt),
        meter = per(p.meter);
      if (zone !== this.was.zone) el.zone.style.bottom = this.was.zone = zone;
      if (fish !== this.was.fish) el.fish.style.bottom = this.was.fish = fish;
      if (meter !== this.was.meter) {
        el.meterFill.style.height = this.was.meter = meter;
        el.meter.setAttribute('aria-valuenow', String(Math.round(p.meter * 100)));
      }
      if (p.words !== this.was.words) el.words.textContent = this.was.words = p.words;
    }

    // while the window is open the button pulses, written only where it has changed
    const pulse = p.biting ? p.pulse.toString() : '';
    if (pulse !== this.was.pulse) {
      this.was.pulse = pulse;
      el.button.classList.toggle('biting', p.biting);
      el.button.style.setProperty('--pulse', pulse || '0');
    }

    const button = p.button ? `${p.button} ${p.reeling}` : '';
    if (button !== this.was.button) {
      this.was.button = button;
      el.button.hidden = !p.button;
      el.button.textContent = p.button === 'Reel' ? 'Reel' : 'Strike';
      el.button.setAttribute('aria-pressed', String(p.button === 'Reel' && p.reeling));
    }
  }
}

export class FightView {
  private readonly bar: FightBar;
  private was = { mark: '', card: '', bucket: -1 };

  constructor(
    private readonly el: FightElements,
    private readonly game: () => Game,
    private readonly toScreen: ToScreen,
    gesture: (e: GestureEvent) => void,
  ) {
    const { button, card } = el;
    this.bar = new FightBar(el);
    // the button strikes when pressed, and while a fish is on, reels for as long as it is held: the rules are
    // gesture.ts's, and the pointer capture is the page's
    button.addEventListener('pointerdown', (e) => {
      button.setPointerCapture(e.pointerId);
      gesture({ type: 'press', source: 'button', repeat: false });
    });
    const letGo = () => gesture({ type: 'release', source: 'button' });
    button.addEventListener('pointerup', letGo);
    button.addEventListener('pointercancel', letGo);
    button.addEventListener('lostpointercapture', letGo);
    // by the keyboard it strikes once a press; space held anywhere reels, which the page handles
    button.addEventListener('click', (e) => {
      if (e.detail === 0) gesture({ type: 'activate', source: 'button' });
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

    this.bar.draw(fightPicture(g));

    // a mark stands over the bobber while the window is open, where the camera puts it
    const at = phase === 'biting' ? this.toScreen(g.lure.bobber[0], g.lure.bobber[1], MARK_HIGH) : null;
    const mark = at ? `${Math.round(at.x)} ${Math.round(at.y)}` : '';
    if (mark !== this.was.mark) {
      this.was.mark = mark;
      el.mark.hidden = !at;
      if (at) {
        el.mark.style.left = `${Math.round(at.x)}px`;
        el.mark.style.top = `${Math.round(at.y)}px`;
      }
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
