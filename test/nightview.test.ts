/** The night on the screen: the fade, the yawn's words, the morning line, and the Down to the pond and Go to bed buttons. */
import { describe, expect, it } from 'vitest';
import { NIGHT } from '../src/lake';
import { radioWords } from '../src/radio';
import { NightView, nightWords } from '../src/nightview';
import { DT, newGame } from './helpers';

describe('what the night says', () => {
  it('says nothing at the pond, and the bed is there to go to', () => {
    expect(nightWords('pond', 1, false, 'Duck Pond', 'dawn')).toEqual({
      yawn: null,
      morning: null,
      out: null,
      bed: true,
      cabin: true,
    });
  });

  it('yawns while yawning, and the bed is refused', () => {
    const w = nightWords('yawning', 1, false, 'Duck Pond', 'dawn');
    expect(w.yawn).toBe('Yawn… time for bed');
    expect(w.morning).toBe(null);
    expect(w.bed).toBe(false);
  });

  it('names the day in the morning at the cabin, and the bed can be gone to again', () => {
    expect(nightWords('cabin', 2, false, 'Duck Pond', 'dawn')).toEqual({
      yawn: null,
      morning: 'Day 2. Morning at the cabin.',
      out: 'Out to the Duck Pond',
      bed: true,
      cabin: false,
    });
    expect(nightWords('cabin', 13, false, 'Duck Pond', 'dawn').morning).toBe('Day 13. Morning at the cabin.');
    expect(nightWords('cabin', 57, false, 'Duck Pond', 'dawn').morning).toBe('Day 57. Morning at the cabin.');
  });

  it('names the season in the morning from autumn on, and says nothing of summer', () => {
    expect(nightWords('cabin', 15, false, 'Duck Pond', 'dawn').morning).toBe('Day 15. An autumn morning at the cabin.');
    expect(nightWords('cabin', 29, false, 'Duck Pond', 'dawn').morning).toBe('Day 29. A winter morning at the cabin.');
    expect(nightWords('cabin', 43, false, 'Duck Pond', 'dawn').morning).toBe('Day 43. A spring morning at the cabin.');
  });

  it('refuses the bed and the cabin with a fish on the line or landed', () => {
    expect(nightWords('pond', 1, true, 'Duck Pond', 'dawn').bed).toBe(false);
    expect(nightWords('pond', 1, true, 'Duck Pond', 'dawn').cabin).toBe(false);
  });

  it('allows the way into the cabin only at the pond with no fish on', () => {
    expect(nightWords('pond', 1, false, 'Duck Pond', 'day').cabin).toBe(true);
    for (const place of ['yawning', 'cabin', 'leaving'] as const)
      expect(nightWords(place, 1, false, 'Duck Pond', 'day').cabin, place).toBe(false);
  });

  it('names the hour by the look of the clock: morning, afternoon, evening, night', () => {
    const line = (name: string, day = 2) => nightWords('cabin', day, false, 'Duck Pond', name).morning;
    expect(line('dawn')).toBe('Day 2. Morning at the cabin.');
    expect(line('day')).toBe('Day 2. Afternoon at the cabin.');
    expect(line('dusk')).toBe('Day 2. Evening at the cabin.');
    expect(line('night')).toBe('Day 2. Night at the cabin.');
  });

  it('keeps the season word with the hour, from autumn on', () => {
    const line = (name: string, day: number) => nightWords('cabin', day, false, 'Duck Pond', name).morning;
    expect(line('day', 15)).toBe('Day 15. An autumn afternoon at the cabin.');
    expect(line('dusk', 29)).toBe('Day 29. A winter evening at the cabin.');
    expect(line('night', 43)).toBe('Day 43. A spring night at the cabin.');
    expect(line('day', 2)).toBe('Day 2. Afternoon at the cabin.');
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
  const el = {
    fade: stub(),
    yawn: stub(),
    morning: stub(),
    radio: stub(),
    down: stub(),
    elsewhere: stub(),
    bed: stub(),
    sleep: stub(),
    cabin: stub(),
  };
  let timeName = 'dawn';
  const night = new NightView(
    el,
    () => game,
    () => timeName,
  );
  return {
    game,
    el,
    night,
    at: (name: string) => {
      timeName = name;
    },
  };
}

describe('the morning button', () => {
  it('names the lake the save names, which after a wake at home is the home', () => {
    expect(nightWords('cabin', 2, false, 'Reservoir', 'dawn').out).toBe('Out to the Reservoir');
    expect(nightWords('cabin', 2, false, 'Duck Pond', 'dawn').out).toBe('Out to the Duck Pond');
  });

  it('is there only in the cabin', () => {
    expect(nightWords('yawning', 2, false, 'Reservoir', 'dawn').out).toBeNull();
    expect(nightWords('leaving', 2, false, 'Reservoir', 'dawn')).toEqual({
      yawn: null,
      morning: null,
      out: null,
      bed: false,
      cabin: false,
    });
  });
});

describe('the night view', () => {
  it('shows nothing at the pond but the bed, enabled', () => {
    const { el, night } = view();
    night.show();
    expect(el.fade.hidden).toBe(true);
    expect(el.yawn.hidden).toBe(true);
    expect(el.morning.hidden).toBe(true);
    expect(el.down.hidden).toBe(true);
    expect(el.bed.disabled).toBe(false);
    expect(el.sleep.disabled, 'Sleep through… is held by the same flag as Go to bed').toBe(false);
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
    expect(el.sleep.disabled).toBe(true);
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

  it('says the afternoon in the cabin by day, and greys Go to the cabin there and mid-fight', () => {
    const { game, el, night, at } = view();
    at('day');
    night.show();
    expect(el.cabin.disabled, 'at the pond').toBe(false);
    game.enter();
    for (let f = 0; f < Math.ceil(NIGHT.fadeIn / DT) + 1; f++) game.step(DT);
    night.show();
    expect(el.morning.hidden).toBe(false);
    expect(el.morning.textContent).toBe('Day 1. Afternoon at the cabin.');
    expect(el.cabin.disabled, 'in the cabin').toBe(true);
    at('dusk');
    night.show();
    expect(el.morning.textContent).toBe('Day 1. Evening at the cabin.');
    game.out();
    night.show();
    expect(el.cabin.disabled).toBe(false);
    game.bite.phase = 'hooked';
    night.show();
    expect(el.cabin.disabled, 'mid-fight').toBe(true);
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

describe('the radio panel', () => {
  const words = (game: ReturnType<typeof view>['game'], hour: string) => {
    const w = radioWords(game.day, game.progress.save, game.progress.lakes, hour);
    return `${w.forecast}\n${w.gossip}`;
  };
  const toCabin = (game: ReturnType<typeof view>['game']) => {
    game.sleep();
    for (let f = 0; f < Math.ceil(NIGHT.fadeOut / DT) + 1; f++) game.step(DT);
  };

  it('is hidden at the pond and shown with the morning line, in the words of that day and save', () => {
    const { game, el, night } = view();
    night.show();
    expect(el.radio.hidden).toBe(true);
    toCabin(game);
    night.show();
    expect(el.radio.hidden).toBe(false);
    expect(el.radio.textContent).toBe(words(game, 'dawn'));
    expect(night.radio().shown).toBe(true);
    expect(night.radio().forecast).toMatch(/^Sunny Atom Radio says /);
    game.out();
    night.show();
    expect(el.radio.hidden).toBe(true);
    expect(night.radio().shown).toBe(false);
  });

  it('is hidden while yawning', () => {
    const { game, el, night } = view();
    game.sleep();
    night.show();
    expect(el.radio.hidden).toBe(true);
  });

  it('is written only where the words change, over many frames', () => {
    const { game, el, night } = view();
    toCabin(game);
    // the fade lifts first, which is the page's other writing
    for (let f = 0; f < Math.ceil(NIGHT.fadeIn / DT) + 1; f++) game.step(DT);
    night.show();
    const once = { ...el.radio.writes };
    const all = total(el);
    for (let f = 0; f < 200; f++) {
      game.step(DT);
      night.show();
    }
    expect(el.radio.writes, 'nothing written for words that stood').toEqual(once);
    expect(total(el)).toBe(all);
  });

  it('changes once after a wake into another day, and not at all where the words are the same', () => {
    const { game, el, night } = view();
    toCabin(game);
    night.show();
    let written = el.radio.writes.textContent;
    let changes = 0;
    for (let n = 0; n < 6; n++) {
      const before = el.radio.textContent;
      game.out();
      night.show();
      toCabin(game);
      night.show();
      expect(el.radio.textContent).toBe(words(game, 'dawn'));
      if (el.radio.textContent !== before) changes++;
      expect(el.radio.writes.textContent, `day ${game.day}`).toBe(written + (el.radio.textContent !== before ? 1 : 0));
      written = el.radio.writes.textContent;
    }
    expect(changes, 'the days do not all read alike').toBeGreaterThan(0);
  });

  it('follows the hour in the cabin by day', () => {
    const { game, el, night, at } = view();
    at('day');
    game.enter();
    for (let f = 0; f < Math.ceil(NIGHT.fadeIn / DT) + 1; f++) game.step(DT);
    night.show();
    expect(el.radio.textContent).toBe(words(game, 'day'));
  });
});

describe('the morning line', () => {
  const morning = (day: number) => nightWords('cabin', day, false, 'Duck Pond', 'dawn').morning;

  it('says the day and the hour and nothing of the moon or the weather, which the radio says', () => {
    for (const d of [1, 2, 5, 9, 11, 13, 15, 29, 43, 57, 61]) {
      expect(morning(d)).not.toMatch(/moon|today|Rain|Foggy|Windy|sun-shower/);
      expect(morning(d)).toMatch(/^Day \d+\. .* at the cabin\.$/);
    }
    expect(morning(1)).toBe('Day 1. Morning at the cabin.');
    expect(morning(9)).toBe('Day 9. Morning at the cabin.');
    expect(morning(61)).toBe('Day 61. Morning at the cabin.');
  });

  it('leaves the yawn’s words alone', () => {
    expect(nightWords('yawning', 5, false, 'Duck Pond', 'dawn').yawn).toBe('Yawn… time for bed');
  });
});

describe('the Go to the cabin item aboard the boat', () => {
  it('is greyed while the player is aboard, rowing or anchored, and live again ashore, with the bed left alone', () => {
    const { game, el, night } = view();
    night.show();
    expect(el.cabin.disabled).toBe(false);
    game.boat.aboard = true;
    night.show();
    expect(el.cabin.disabled).toBe(true);
    expect(el.bed.disabled).toBe(false);
    game.boat.aboard = false;
    night.show();
    expect(el.cabin.disabled).toBe(false);
  });
});
