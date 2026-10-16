/**
 * The bite and the fight on the page: while the strike's window is open, the Strike button pulsing and a mark over the
 * bobber; the bar beside the Reel button, with the zone the reel pushes up it, the fish darting on it in
 * its glow, and the meter beside it, with words for whether the fish is in the zone so position is not all it says;
 * the button that strikes, and held, reels, for any view and for one finger; the catch shown off on a card, put in the
 * bucket by a tap on it; and the bucket's count. It reads the game each frame and writes the page only where something
 * has changed, to a tenth of a per cent, and does nothing of the fishing itself: it calls the game's strike, reel and
 * stow.
 */
import type { Game } from './game';
import { FIGHT, PERCH } from './lake';
import { PALETTE, type Colour } from './palette';

export interface FightElements {
  gauge: HTMLElement;
  zone: HTMLElement;
  fish: SVGSVGElement;
  /** The mark over the bobber while the strike's window is open. */
  mark: HTMLElement;
  meter: HTMLElement;
  meterFill: HTMLElement;
  words: HTMLElement;
  button: HTMLButtonElement;
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

export class FightView {
  private was = {
    gauge: '',
    zone: '',
    fish: '',
    meter: '',
    words: '',
    button: '',
    pulse: '',
    mark: '',
    card: '',
    bucket: -1,
  };

  constructor(
    private readonly el: FightElements,
    private readonly game: () => Game,
    private readonly toScreen: ToScreen,
  ) {
    const { button, card } = el;
    el.zone.style.height = per(FIGHT.width);
    el.fish.style.fill = css(PALETTE.glow);
    el.fish.style.filter = `drop-shadow(0 0 4px ${css(PALETTE.glow)})`;
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

    const on = phase === 'hooked';
    const gauge = on ? 'on' : '';
    if (gauge !== this.was.gauge) {
      this.was.gauge = gauge;
      el.gauge.hidden = !on;
    }
    if (on) {
      const { line } = g;
      const zone = per(line.zone),
        fish = per(line.fishAt),
        meter = per(line.meter);
      const words = line.inZone() ? 'in the zone' : 'out of the zone';
      if (zone !== this.was.zone) el.zone.style.bottom = this.was.zone = zone;
      if (fish !== this.was.fish) el.fish.style.bottom = this.was.fish = fish;
      if (meter !== this.was.meter) {
        el.meterFill.style.height = this.was.meter = meter;
        el.meter.setAttribute('aria-valuenow', String(Math.round(line.meter * 100)));
      }
      if (words !== this.was.words) el.words.textContent = this.was.words = words;
    }

    // the button is there while the lure is in the water or a fish is on: Strike until one is hooked, then Reel
    const live = g.lure.phase === 'sinking' || phase === 'hooked';
    const button = !live ? '' : phase === 'hooked' ? `Reel ${g.reeling}` : 'Strike';
    // while the window is open the button pulses and a mark stands over the bobber, both by the game's clock, so a
    // picture is the same every run; each written only where it has changed
    const biting = phase === 'biting';
    const pulse = biting ? (Math.round((0.5 + 0.5 * Math.sin(g.t * PULSE_RATE)) * 20) / 20).toString() : '';
    if (pulse !== this.was.pulse) {
      this.was.pulse = pulse;
      el.button.classList.toggle('biting', biting);
      el.button.style.setProperty('--pulse', pulse || '0');
    }
    const at = biting ? this.toScreen(g.lure.bobber[0], g.lure.bobber[1], MARK_HIGH) : null;
    const mark = at ? `${Math.round(at.x)} ${Math.round(at.y)}` : '';
    if (mark !== this.was.mark) {
      this.was.mark = mark;
      el.mark.hidden = !at;
      if (at) {
        el.mark.style.left = `${Math.round(at.x)}px`;
        el.mark.style.top = `${Math.round(at.y)}px`;
      }
    }

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
