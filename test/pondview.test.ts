/** The pond on the screen: the glow gauge, the welcome line, and the lines said when a fish is cured and when the pond is clean. */
import { describe, expect, it } from 'vitest';
import { CURE, DRUMS, LAKE_NAME, contaminationAfter } from '../src/lake';
import { PondView, pondWords, type PondState } from '../src/pondview';
import { DT, newGame } from './helpers';

const state = (over: Partial<PondState> = {}): PondState => ({
  cured: 0,
  toClean: CURE.toClean,
  drums: 0,
  cast: false,
  toastCured: 0,
  toastUntil: -Infinity,
  toastHauled: 0,
  hauledUntil: -Infinity,
  foundUntil: -Infinity,
  gift: null,
  giftFrom: -Infinity,
  giftUntil: -Infinity,
  t: 0,
  ...over,
});

describe('what the pond says', () => {
  it('welcomes a player who has cast nothing and cured nothing, and the gauge is full', () => {
    const w = pondWords(state());
    expect(w.welcome).toBe(true);
    expect(w.glow).toBe(1);
    expect(w.clean).toBe(false);
    expect(w.toast).toBe(null);
    expect(w.name).toBe(LAKE_NAME);
    expect(LAKE_NAME).toBe('Duck Pond');
  });

  it('stops welcoming at the first cast, and never welcomes a player who has cured a fish', () => {
    expect(pondWords(state({ cast: true })).welcome).toBe(false);
    // a reload with fish already cured: the line is not shown again, though nothing has been cast this time
    expect(pondWords(state({ cured: 1 })).welcome).toBe(false);
  });

  it('empties the gauge by the lake’s own formula, a sixteenth a fish cured and an eighth a drum hauled, to nothing at all of them', () => {
    for (const cured of [0, 1, 3, 11, 12, 13, 40])
      for (const drums of [0, 1, DRUMS.count]) {
        const w = pondWords(state({ cured, drums }));
        expect(w.glow, `${cured} cured, ${drums} hauled`).toBeCloseTo(contaminationAfter(cured, drums), 12);
        expect(w.clean, `${cured} cured, ${drums} hauled`).toBe(cured >= CURE.toClean && drums >= DRUMS.count);
      }
    expect(pondWords(state({ cured: 12, drums: DRUMS.count })).glow).toBe(0);
    expect(pondWords(state({ cured: 12 })).glow, 'twelve cured, the drums still there').toBeCloseTo(0.25, 12);
  });

  it('does not welcome a player who has hauled a drum, whatever else', () => {
    expect(pondWords(state({ drums: 1 })).welcome).toBe(false);
  });

  it('says a drum was hauled, for a while after: "Hauled out! The pond clears a lot."', () => {
    const said = (over: Partial<PondState>) =>
      pondWords(state({ toastHauled: 1, hauledUntil: 2, drums: 1, ...over })).toast;
    expect(said({ t: 1 })).toEqual({ lead: 'Hauled out!', bold: 'The pond clears a lot.' });
    expect(said({ t: 2 }), 'over at the time').toBe(null);
  });

  it('says the pond is clean at the last drum hauled, and not at the last fish cured with a drum left', () => {
    const last = pondWords(
      state({ cured: CURE.toClean, drums: DRUMS.count, toastHauled: DRUMS.count, hauledUntil: 9, t: 1 }),
    ).toast;
    expect(last).toEqual({ lead: 'The Duck Pond is clean!', bold: 'Every fish is cured and every drum hauled.' });
    const fishDone = pondWords(
      state({ cured: CURE.toClean, drums: 0, toastCured: CURE.toClean, toastUntil: 9, t: 1 }),
    ).toast;
    expect(fishDone?.lead, 'a drum is still on the bed').toBe('Cured!');
  });

  it('says the newer of a cure’s line and a haul’s', () => {
    const both = state({ toastCured: 3, toastUntil: 4, toastHauled: 1, hauledUntil: 5, drums: 1, cured: 3, t: 1 });
    expect(pondWords(both).toast?.lead).toBe('Hauled out!');
    expect(pondWords({ ...both, toastUntil: 6 }).toast?.lead).toBe('Cured!');
  });

  it('says a treasure was kept, for a while after: "Found! It\'s for the shelf."', () => {
    const said = (over: Partial<PondState>) => pondWords(state({ foundUntil: 2, ...over })).toast;
    expect(said({ t: 1 })).toEqual({ lead: 'Found!', bold: "It's for the shelf." });
    expect(said({ t: 2 }), 'over at the time').toBe(null);
    expect(said({ t: 1, cured: 5 })?.lead, 'a treasure is not a cure').toBe('Found!');
  });

  it('says the newest of a cure’s, a haul’s and a treasure’s line', () => {
    const all = state({
      toastCured: 3,
      toastUntil: 4,
      toastHauled: 1,
      hauledUntil: 5,
      foundUntil: 6,
      drums: 1,
      cured: 3,
      t: 1,
    });
    expect(pondWords(all).toast?.lead).toBe('Found!');
    expect(pondWords({ ...all, foundUntil: 4.5 }).toast?.lead).toBe('Hauled out!');
    expect(pondWords({ ...all, foundUntil: 4.5, hauledUntil: 3 }).toast?.lead).toBe('Found!');
    expect(pondWords({ ...all, foundUntil: 3.5, hauledUntil: 3 }).toast?.lead).toBe('Cured!');
  });

  it('says a fish was cured for a while after, in the words of the mock, and not after it', () => {
    const said = (over: Partial<PondState>) => pondWords(state({ toastUntil: 2, ...over })).toast;
    expect(said({ cured: 1, toastCured: 1, t: 1 })).toEqual({ lead: 'Cured!', bold: 'The pond clears a little.' });
    expect(said({ cured: 1, toastCured: 1, t: 2 }), 'over at the time').toBe(null);
    expect(said({ cured: 5, toastCured: 5, t: 0 })?.lead).toBe('Cured!');
  });

  it('says the pond is clean at the twelfth', () => {
    const at = (cured: number) =>
      pondWords(state({ cured, drums: DRUMS.count, toastCured: cured, toastUntil: 9, t: 1 })).toast;
    expect(at(CURE.toClean)).toEqual({ lead: 'The Duck Pond is clean!', bold: 'Every fish is cured.' });
    expect(at(CURE.toClean - 1)?.lead).toBe('Cured!');
  });
});

describe('what the pond says of a gift', () => {
  const gift = { name: 'a stronger line', words: 'The meter drains more slowly.' };
  const said = (over: Partial<PondState>) =>
    pondWords(state({ cured: 2, toastCured: 2, toastUntil: 2, gift, giftFrom: 2, giftUntil: 4, ...over })).toast;
  it('names the giver, the gift and what it does, once the cure’s own line is over', () => {
    expect(said({ t: 2 })).toEqual({
      lead: 'A gift from the Sunny Atom: a stronger line.',
      bold: 'The meter drains more slowly.',
    });
    expect(said({ t: 3.9 })?.lead).toContain('Sunny Atom');
    expect(said({ t: 4 }), 'over at the time').toBe(null);
  });
  it('lets the cure’s line have the first two seconds, so the two never overlap', () => {
    expect(said({ t: 1 })?.lead).toBe('Cured!');
    expect(said({ t: 1.99 })?.lead).toBe('Cured!');
  });
  it('says none with no gift', () => {
    expect(said({ t: 3, gift: null })).toBe(null);
  });
});

/** An element that counts how many times each thing on it was written, so a page not changed is seen to be left alone. */
function stub() {
  const writes: Record<string, number> = {};
  const props: Record<string, unknown> = { hidden: true, textContent: '', innerHTML: '' };
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const el = new Proxy(
    {
      style: new Proxy(style, {
        set(t, k: string, v: string) {
          if (t[k] !== v) writes[`style.${k}`] = (writes[`style.${k}`] ?? 0) + 1;
          t[k] = v;
          return true;
        },
      }),
      attrs,
      classes: new Set<string>(),
      classList: {
        toggle(name: string, on: boolean) {
          writes.class = (writes.class || 0) + 1;
          if (on) el.classes.add(name);
          else el.classes.delete(name);
        },
      },
      setAttribute(k: string, v: string) {
        writes[`attr.${k}`] = (writes[`attr.${k}`] ?? 0) + 1;
        attrs[k] = v;
      },
      writes,
    },
    {
      get: (t, k: string) => (k in t ? (t as never)[k] : props[k]),
      set(t, k: string, v) {
        if (!(k in t)) {
          writes[k] = (writes[k] ?? 0) + 1;
          props[k] = v;
          return true;
        }
        return false;
      },
    },
  );
  return el as unknown as HTMLElement & {
    writes: Record<string, number>;
    attrs: Record<string, string>;
    classes: Set<string>;
  };
}

function view() {
  const { game } = newGame(3);
  const el = {
    gauge: stub(),
    name: stub(),
    bar: stub(),
    gone: stub(),
    welcome: stub(),
    toast: stub(),
  };
  const pond = new PondView(el, () => game, 2);
  return { game, el, pond };
}
const total = (el: Record<string, { writes: Record<string, number> }>) =>
  Object.values(el).reduce((n, e) => n + Object.values(e.writes).reduce((a, b) => a + b, 0), 0);

describe('the pond view', () => {
  it('says the gift after the cure’s line, once, and then nothing', () => {
    const { game, el, pond } = view();
    pond.cured(2, CURE.toClean);
    pond.gifted('a stronger line', 'The meter drains more slowly.');
    pond.show();
    expect(el.toast.innerHTML).toContain('Cured!');
    game.t = 2.5;
    pond.show();
    expect(el.toast.innerHTML).toContain('A gift from the Sunny Atom: a stronger line.');
    expect(el.toast.innerHTML).toContain('<b>The meter drains more slowly.</b>');
    game.t = 4.5;
    pond.show();
    expect(el.toast.hidden).toBe(true);
  });

  it('shows the gauge, the name and the welcome at the start, hides the toast, and reads the gauge for a screen reader', () => {
    const { el, pond } = view();
    pond.show();
    expect(el.gauge.hidden).toBe(false);
    expect(el.name.textContent).toBe('Duck Pond');
    expect(el.gone.style.width).toBe('0%');
    expect(el.bar.attrs['aria-valuenow']).toBe('100');
    expect(el.welcome.hidden).toBe(false);
    expect(el.toast.hidden).toBe(true);
  });

  it('writes the page only where something has changed', () => {
    const { game, el, pond } = view();
    pond.show();
    const once = total(el);
    for (let f = 0; f < 30; f++) {
      game.step(DT);
      pond.show();
    }
    expect(total(el), 'nothing written for a pond that has not changed').toBe(once);
  });

  it('takes the welcome away at the first cast, and keeps it away', () => {
    const { game, el, pond } = view();
    pond.show();
    game.cast(Math.PI / 2, 0.6);
    pond.show();
    expect(el.welcome.hidden).toBe(true);
    game.reelIn();
    pond.show();
    expect(el.welcome.hidden, 'reeled in, it does not come back').toBe(true);
  });

  it('says a cure for a while, steps the gauge, and takes the line away when the time is up', () => {
    const { game, el, pond } = view();
    pond.show();
    game.progress.save.cured = 1;
    game.contamination = contaminationAfter(1, 0);
    pond.cured(1, CURE.toClean);
    pond.show();
    expect(el.toast.hidden).toBe(false);
    expect(el.toast.innerHTML).toContain('Cured!');
    expect(el.toast.innerHTML).toContain('The pond clears a little.');
    expect(el.gone.style.width, 'a sixteenth of the glow gone').toBe('6.3%');
    expect(el.bar.attrs['aria-valuenow']).toBe(String(Math.round(contaminationAfter(1, 0) * 100)));
    expect(el.welcome.hidden, 'a fish cured, no welcome').toBe(true);
    for (let f = 0; f < 60 * 2 + 5; f++) game.step(DT);
    pond.show();
    expect(el.toast.hidden).toBe(true);
  });

  it('says a haul, and steps the gauge an eighth', () => {
    const { game, el, pond } = view();
    pond.show();
    game.progress.save.drums = 1;
    pond.hauled(1, DRUMS.count);
    pond.show();
    expect(el.toast.innerHTML).toContain('Hauled out!');
    expect(el.toast.innerHTML).toContain('The pond clears a lot.');
    expect(el.gone.style.width).toBe('12.5%');
    expect(el.welcome.hidden, 'a drum hauled, no welcome').toBe(true);
    for (let f = 0; f < 60 * 2 + 5; f++) game.step(DT);
    pond.show();
    expect(el.toast.hidden).toBe(true);
  });

  it('says a treasure kept, for the shelf, and leaves the gauge where it was', () => {
    const { game, el, pond } = view();
    pond.show();
    const before = el.gone.style.width;
    pond.found('lunchbox');
    pond.show();
    expect(el.toast.hidden).toBe(false);
    expect(el.toast.innerHTML).toContain('Found!');
    expect(el.toast.innerHTML).toContain("It's for the shelf.");
    expect(el.gone.style.width, 'a treasure cleans nothing').toBe(before);
    for (let f = 0; f < 60 * 2 + 5; f++) game.step(DT);
    pond.show();
    expect(el.toast.hidden).toBe(true);
  });

  it('says the newer of a cure’s line and a treasure’s', () => {
    const { game, el, pond } = view();
    game.progress.save.cured = 1;
    game.contamination = contaminationAfter(1, 0);
    pond.cured(1, CURE.toClean);
    for (let f = 0; f < 30; f++) game.step(DT);
    pond.found('duck');
    pond.show();
    expect(el.toast.innerHTML).toContain('Found!');
  });

  it('turns the gauge clean at the last fish cured and the last drum hauled, and says so', () => {
    const { game, el, pond } = view();
    game.progress.save.cured = CURE.toClean;
    game.progress.save.drums = DRUMS.count;
    game.contamination = 0;
    pond.cured(CURE.toClean, CURE.toClean);
    pond.show();
    expect(el.gone.style.width).toBe('100%');
    expect(el.gauge.classes.has('clean')).toBe(true);
    expect(el.toast.innerHTML).toContain('The Duck Pond is clean!');
  });
  it('keeps the welcome and the cure’s line away while the player is not at the pond, and brings them back', () => {
    const { game, el, pond } = view();
    pond.cured(1, CURE.toClean);
    game.sleep();
    pond.show();
    expect(el.welcome.hidden, 'no welcome while yawning').toBe(true);
    expect(el.toast.hidden, 'no toast while yawning').toBe(true);
    for (let f = 0; f < 200; f++) game.step(DT);
    expect(game.place).toBe('cabin');
    pond.show();
    expect(el.welcome.hidden, 'no welcome in the cabin').toBe(true);
    game.out();
    pond.show();
    expect(el.toast.hidden, 'the cure’s line is said again at the pond, its time not run down in the cabin').toBe(
      false,
    );
  });
});
