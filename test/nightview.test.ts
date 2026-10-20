/** The night on the screen: the fade, the yawn's words, the morning line, and the Down to the pond and Go to bed buttons. */
import { describe, expect, it } from 'vitest';
import { NIGHT } from '../src/lake';
import { NightView, nightWords } from '../src/nightview';
import { DT, newGame } from './helpers';

describe('what the night says', () => {
  it('says nothing at the pond, and the bed is there to go to', () => {
    expect(nightWords('pond', 1, false)).toEqual({ yawn: null, morning: null, bed: true });
  });

  it('yawns while yawning, and the bed is refused', () => {
    const w = nightWords('yawning', 1, false);
    expect(w.yawn).toBe('Yawn… time for bed');
    expect(w.morning).toBe(null);
    expect(w.bed).toBe(false);
  });

  it('names the day in the morning at the cabin, and the bed can be gone to again', () => {
    expect(nightWords('cabin', 2, false)).toEqual({ yawn: null, morning: 'Day 2. Morning at the cabin.', bed: true });
    expect(nightWords('cabin', 13, false).morning).toBe('Day 13. Morning at the cabin.');
    expect(nightWords('cabin', 57, false).morning).toBe('Day 57. Morning at the cabin.');
  });

  it('names the season in the morning from autumn on, and says nothing of summer', () => {
    expect(nightWords('cabin', 15, false).morning).toBe('Day 15. An autumn morning at the cabin.');
    expect(nightWords('cabin', 29, false).morning).toBe('Day 29. A winter morning at the cabin.');
    expect(nightWords('cabin', 43, false).morning).toBe('Day 43. A spring morning at the cabin.');
  });

  it('refuses the bed with a fish on the line or landed', () => {
    expect(nightWords('pond', 1, true).bed).toBe(false);
  });
});

/** An element that counts what is written to it, as the pond view's test does. */
function stub() {
  const writes: Record<string, number> = {};
  const props: Record<string, unknown> = { hidden: true, textContent: '', disabled: false };
  const style: Record<string, string> = {};
  const count = (k: string) => (writes[k] = (writes[k] ?? 0) + 1);
  const base: Record<string, unknown> = {
    style: new Proxy(style, {
      set(t, k: string, v: string) {
        count(`style.${k}`);
        t[k] = v;
        return true;
      },
    }),
    writes,
  };
  const el = new Proxy(base, {
    get: (t, k: string) => (k in t ? t[k] : props[k]),
    set(t, k: string, v) {
      if (k in t) return false;
      count(k);
      props[k] = v;
      return true;
    },
  });
  return el as unknown as HTMLButtonElement & { writes: Record<string, number>; style: Record<string, string> };
}
const total = (el: Record<string, { writes: Record<string, number> }>) =>
  Object.values(el).reduce((n, e) => n + Object.values(e.writes).reduce((a, b) => a + b, 0), 0);

function view() {
  const { game } = newGame(3);
  const el = { fade: stub(), yawn: stub(), morning: stub(), down: stub(), bed: stub() };
  return { game, el, night: new NightView(el, () => game) };
}

describe('the night view', () => {
  it('shows nothing at the pond but the bed, enabled', () => {
    const { el, night } = view();
    night.show();
    expect(el.fade.hidden).toBe(true);
    expect(el.yawn.hidden).toBe(true);
    expect(el.morning.hidden).toBe(true);
    expect(el.down.hidden).toBe(true);
    expect(el.bed.disabled).toBe(false);
  });

  it('writes the fade as the game stepped it, the words with it, and the bed greyed while yawning', () => {
    const { game, el, night } = view();
    game.sleep();
    for (let f = 0; f < Math.round(NIGHT.fadeOut / 2 / DT); f++) game.step(DT);
    night.show();
    expect(el.fade.hidden).toBe(false);
    expect(Number(el.fade.style.opacity)).toBeCloseTo(0.5, 2);
    expect(el.yawn.hidden).toBe(false);
    expect(el.yawn.textContent).toBe('Yawn… time for bed');
    expect(el.bed.disabled).toBe(true);
    expect(el.morning.hidden).toBe(true);
  });

  it('wakes to the morning line and the button, the fade lifting to nothing', () => {
    const { game, el, night } = view();
    game.sleep();
    for (let f = 0; f < Math.ceil(NIGHT.fadeOut / DT) + 1; f++) game.step(DT);
    expect(game.place).toBe('cabin');
    night.show();
    expect(el.yawn.hidden).toBe(true);
    expect(el.morning.hidden).toBe(false);
    expect(el.morning.textContent).toBe('Day 2. Morning at the cabin.');
    expect(el.down.hidden).toBe(false);
    expect(el.bed.disabled).toBe(false);
    for (let f = 0; f < Math.ceil(NIGHT.fadeIn / DT) + 1; f++) game.step(DT);
    night.show();
    expect(el.fade.hidden).toBe(true);
    game.out();
    night.show();
    expect(el.morning.hidden).toBe(true);
    expect(el.down.hidden).toBe(true);
  });

  it('writes the page only where something has changed', () => {
    const { game, el, night } = view();
    night.show();
    const once = total(el);
    for (let f = 0; f < 30; f++) {
      game.step(DT);
      night.show();
    }
    expect(total(el), 'nothing written at a pond that is as it was').toBe(once);
    game.sleep();
    night.show();
    const yawning = total(el);
    night.show();
    night.show();
    expect(total(el), 'nothing written for a fade that has not moved').toBe(yawning);
  });
});
