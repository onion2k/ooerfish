/**
 * The lab's panel: a row of buttons for each choice and a slider for the
 * contamination, which turn a click into a change of the settings, and show
 * the settings as they are; and a button that drops a pebble on the water,
 * which is a thing done and not a setting. It holds nothing of its own beyond what it is
 * handed and what it hands back; the page decides what a change does.
 */
import { VIEWS } from './lake';
import { TIMES } from './look';
import type { Settings } from './settings';

/** What a view is called on the panel. */
const VIEW_LABELS: Record<keyof typeof VIEWS, string> = {
  shore: 'Shore',
  boat: 'Boat',
  overhead: 'Overhead',
  phone: 'Phone',
};

export interface Panel {
  /** The panel shows these settings, without telling anyone of a change. */
  show(settings: Settings): void;
}

/** What the panel's buttons for things done, and not settings, do. */
export interface Actions {
  drop(): void;
  reelIn(): void;
}

/** The panel built into `root`, telling `change` of every setting changed by the viewer, and `actions` of its other buttons. */
export function buildPanel(root: HTMLElement, change: (next: Partial<Settings>) => void, actions: Actions): Panel {
  root.replaceChildren();
  const pebble = document.createElement('button');
  pebble.type = 'button';
  pebble.id = 'pebble';
  pebble.textContent = 'Drop a pebble';
  pebble.addEventListener('click', () => actions.drop());
  const reel = document.createElement('button');
  reel.type = 'button';
  reel.id = 'reel';
  reel.textContent = 'Reel in';
  reel.addEventListener('click', () => actions.reelIn());
  const act = document.createElement('fieldset');
  const actLegend = document.createElement('legend');
  actLegend.textContent = 'On the water';
  act.append(actLegend, pebble, reel);
  const buttons = new Map<string, HTMLButtonElement>();

  const group = (key: 'time' | 'view' | 'caustics' | 'paint', title: string, choices: [string, string][]) => {
    const field = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = title;
    field.append(legend);
    for (const [name, label] of choices) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.setting = key;
      b.dataset.value = name;
      b.addEventListener('click', () => change({ [key]: name }));
      buttons.set(`${key}:${name}`, b);
      field.append(b);
    }
    root.append(field);
  };

  const dirtField = document.createElement('fieldset');
  const dirtLegend = document.createElement('legend');
  dirtLegend.textContent = 'Contamination';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.id = 'dirt';
  slider.setAttribute('aria-label', 'Contamination, from clear to sick');
  const ends = document.createElement('div');
  ends.className = 'ends';
  ends.innerHTML = '<span>clear</span><span>sick</span>';
  slider.addEventListener('input', () => change({ dirt: Number(slider.value) }));
  dirtField.append(dirtLegend, slider, ends);
  root.append(dirtField);

  group(
    'time',
    'Time',
    TIMES.map((t) => [t.name, t.name[0].toUpperCase() + t.name.slice(1)]),
  );
  group(
    'view',
    'View',
    (Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => [v, VIEW_LABELS[v]]),
  );
  group('caustics', 'Caustics', [
    ['on', 'On'],
    ['off', 'Off'],
  ]);
  // the paint's choices are not called On and Off, which the caustics' already are
  group('paint', 'Paint', [
    ['on', 'Painted'],
    ['off', 'Plain'],
  ]);
  root.append(act);

  return {
    show(settings) {
      for (const [id, b] of buttons) {
        const [key, value] = id.split(':') as [keyof Settings, string];
        b.setAttribute('aria-pressed', String(String(settings[key]) === value));
      }
      slider.value = String(settings.dirt);
    },
  };
}
