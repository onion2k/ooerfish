/**
 * The phone's page: the rod. It joins the room named in its address when Connect is tapped (the tap is where iOS will
 * ask for the motion sensors), then sends what the thumb and the sensors do, as the protocol's messages, and shows the
 * word and the fight's bar the screen sends back. It decides nothing: the screen's gesture rules turn what it sends
 * into casts, strikes and reels, so a thumb, a tilt and a flick are only reported here. The one piece of arithmetic on
 * the phone is `Flicks`, because the sensor's samples come at a rate that would be wasteful to send.
 */
import '../fight.css';
import { FightBar } from '../fightview';
import { Flicks } from '../flick';
import { PHONE } from '../lake';
import { localLink, trysteroLink, type Link } from './link';
import { readPhoneAddress } from './linkname';
import { PROTOCOL_VERSION, parseScreenMessage, type PhoneMessage } from './protocol';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $('status');
const connectButton = $<HTMLButtonElement>('connect');
const pad = $('pad');
const wordEl = $('word');

const address = readPhoneAddress(location.hash);
let link: Link | null = null;
/** The peer that is the screen, once it has spoken: the room may hold other phones. */
let screen: string | null = null;
let busy = false;
let motion = false;
/** Messages from the screen that were refused, for a person debugging with the page open. */
let refused = 0;

const bar = new FightBar({
  gauge: $('gauge'),
  zone: $('gaugeZone'),
  fish: $<HTMLElement>('gaugeFish') as unknown as SVGSVGElement,
  meter: $('gaugeMeter'),
  meterFill: $('gaugeMeterFill'),
  words: $('gaugeWords'),
  button: $<HTMLButtonElement>('reelButton'),
});

const send = (message: PhoneMessage) => {
  if (!busy) link?.send(message);
};

/**
 * Sends the latest of a stream at most `hz` times a second: the first at once, and a later one that came too soon when
 * the interval is up, so the last reading always arrives. `flush` sends what is waiting now.
 */
function limited<T>(hz: number, out: (value: T) => void) {
  const gap = 1000 / hz;
  let last = -Infinity;
  let waiting: { value: T } | null = null;
  let timer = 0;
  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    if (!waiting) return;
    const { value } = waiting;
    waiting = null;
    last = performance.now();
    out(value);
  };
  return {
    push(value: T) {
      const now = performance.now();
      if (now - last >= gap && !waiting) {
        last = now;
        out(value);
        return;
      }
      waiting = { value };
      timer ||= window.setTimeout(flush, Math.max(0, gap - (now - last)));
    },
    flush,
  };
}

if (!address.ok) {
  status.textContent = `This address will not do (${address.why}). Please scan the code on the screen again.`;
  connectButton.disabled = true;
} else {
  status.textContent = 'Tap Connect to find the screen.';
}

// ---- the pad ----

const share = (v: number) => Math.min(1, Math.max(0, v));
const padPoint = (e: PointerEvent): PhoneMessage => {
  const r = pad.getBoundingClientRect();
  return {
    kind: 'move',
    x: share((e.clientX - r.left) / r.width),
    y: share((e.clientY - r.top) / r.height),
    aspect: r.width / r.height,
  };
};
// sixty a second at the most; a finger's moves are all it can use
const moves = limited<PhoneMessage>(60, send);
let held: number | null = null;
pad.addEventListener('pointerdown', (e) => {
  if (held !== null) return;
  held = e.pointerId;
  pad.setPointerCapture(e.pointerId);
  send({ kind: 'down' });
  // the drag is measured from where the thumb came down
  send(padPoint(e));
});
pad.addEventListener('pointermove', (e) => {
  if (e.pointerId === held) moves.push(padPoint(e));
});
const lift = (e: PointerEvent) => {
  if (e.pointerId !== held) return;
  held = null;
  moves.flush();
  send({ kind: 'up' });
};
pad.addEventListener('pointerup', lift);
pad.addEventListener('pointercancel', lift);
pad.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- the sensors ----

const flicks = new Flicks({ min: PHONE.flickMin, rest: PHONE.flickRest });
const tilts = limited<number>(PHONE.stateHz, (g) => send({ kind: 'tilt', g }));

/** iOS asks only from inside a tap; Android and the desktop give a secure page the sensors. Says whether it is on. */
async function askForMotion(): Promise<boolean> {
  const note = $('sensors');
  if (!window.isSecureContext) {
    note.textContent = 'Motion sensors need HTTPS, and this page is not secure: the pad aims on its own.';
    return false;
  }
  if (typeof DeviceMotionEvent === 'undefined') {
    note.textContent = 'No motion sensors here: the pad aims on its own.';
    return false;
  }
  const ask = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (ask) {
    const answer = await ask.call(DeviceMotionEvent).catch(() => 'denied');
    if (answer !== 'granted') {
      note.textContent = 'Motion sensors refused: the pad aims on its own.';
      return false;
    }
  }
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma !== null) tilts.push(e.gamma);
  });
  window.addEventListener('devicemotion', (e) => {
    const a = e.acceleration;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const flick = flicks.sample(performance.now(), a.x, a.y, a.z);
    if (!flick) return;
    $('flick').textContent = `last flick ${flick.peak.toFixed(1)}`;
    send({ kind: 'flick', peak: flick.peak });
  });
  note.textContent = 'Motion sensors on.';
  return true;
}

// ---- the screen ----

/** What was told the screen of this phone; sent again when a peer joins, so the order of arrival does not matter. */
const hello = () => send({ kind: 'hello', v: PROTOCOL_VERSION, motion });

function heard(raw: unknown, peer: string) {
  const parsed = parseScreenMessage(raw);
  if (!parsed.ok) {
    refused++;
    document.body.dataset.refused = String(refused);
    return;
  }
  const { message } = parsed;
  screen = peer;
  if (message.kind === 'busy') {
    busy = true;
    status.textContent = 'The screen already has a phone.';
    wordEl.textContent = '';
  } else if (message.kind === 'buzz') {
    // Safari has no vibrator
    if ('vibrate' in navigator) navigator.vibrate(150);
  } else {
    if (!busy) status.textContent = 'Connected to the screen.';
    if (wordEl.textContent !== message.word) wordEl.textContent = message.word;
    bar.draw(message.picture);
  }
}

connectButton.addEventListener('click', () => {
  if (!address.ok) return;
  connectButton.disabled = true;
  status.textContent = 'Finding the screen…';
  // the permission is asked for first, and from inside the tap
  void askForMotion().then(async (on) => {
    motion = on;
    link = address.link === 'local' ? localLink(address.room) : await trysteroLink(address.room, address.key);
    link.onMessage(heard);
    link.onJoin(() => hello());
    link.onLeave((peer) => {
      if (peer !== screen) return;
      screen = null;
      status.textContent = 'The screen went away.';
    });
    hello();
  });
});

// a reload, or a locked screen, says goodbye, so that the screen lets go of the reel and a rejoin is not told it is busy
window.addEventListener('pagehide', () => link?.leave());
