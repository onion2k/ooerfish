/**
 * The messages between the phone and the screen, versioned, as plain JSON with a kind field. Both ends read what
 * arrives as if anyone had sent it: a peer in the room is only a stranger with the key, so a kind, a field or a number
 * that is not known is refused by name, and nothing half-read reaches the game. Pure, so the phone page and the screen
 * share one reading of the wire and a test can send either anything.
 */
import type { BitePhase } from '../bite';
import type { FightPicture } from '../fightview';

/** Bumped when a message changes shape; a hello of any other version is refused. */
export const PROTOCOL_VERSION = 1;

/** What the phone's large word may say; empty when there is nothing to do. */
export const WORDS = ['Cast', 'Strike!', 'Reel', 'Tap the catch', ''] as const;
export type Word = (typeof WORDS)[number];

/**
 * A point on the pad is its share across and down the pad (0 to 1), and the pad's aspect, its width over its height.
 * A drag is measured against the pad's shorter side (`aimFrom`), so the screen needs the shape as well as the point
 * to turn two shares back into the same drag in pixels on any phone, held either way up.
 */
export type PhoneMessage =
  | { kind: 'hello'; v: number; motion: boolean }
  | { kind: 'down' }
  | { kind: 'move'; x: number; y: number; aspect: number }
  | { kind: 'up' }
  /** The phone's gamma, in degrees. */
  | { kind: 'tilt'; g: number }
  /** A flick's peak acceleration, in metres a second squared. */
  | { kind: 'flick'; peak: number };

export type ScreenMessage =
  | { kind: 'state'; word: Word; picture: FightPicture }
  | { kind: 'buzz' }
  /** Sent to a second phone: the screen already has one. */
  | { kind: 'busy' };

export type Parsed<M> = { ok: true; message: M } | { ok: false; why: string };

/** Ceilings that no real reading comes near, so a stranger's huge number is refused and not passed on. */
const MAX_ASPECT = 20;
const MAX_TILT = 360;
const MAX_PEAK = 1000;

const PHASES = ['none', 'coming', 'nibbling', 'biting', 'hooked', 'landed'] as const satisfies readonly BitePhase[];
const PICTURE_WORDS = ['', 'in the zone', 'out of the zone'] as const;
const BUTTONS = ['', 'Strike', 'Reel'] as const;

type Raw = Record<string, unknown>;
/** A check reads one field: its value, or the reason it is refused. */
type Check = (value: unknown, name: string) => { value: unknown } | string;
type Shape = Record<string, Check>;

const fail = (why: string) => ({ ok: false, why }) as const;

function number(min: number, max: number, exclusiveMin = false): Check {
  return (value, name) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} is not a finite number`;
    if (value < min || value > max || (exclusiveMin && value === min)) return `${name} is out of range`;
    return { value };
  };
}
const share = number(0, 1);

const boolean: Check = (value, name) => (typeof value === 'boolean' ? { value } : `${name} is not true or false`);

function oneOf(known: readonly string[]): Check {
  return (value, name) => (known.includes(value as string) ? { value } : `${name} is not known`);
}

/** Reads `raw`'s fields by `shape`, refusing a missing, wrong or extra one by name; `kind` is the message's own. */
function read(raw: Raw, shape: Shape): { ok: true; fields: Raw } | { ok: false; why: string } {
  const fields: Raw = {};
  for (const [name, check] of Object.entries(shape)) {
    if (!Object.hasOwn(raw, name)) return fail(`${name} is missing`);
    const out = check(raw[name], name);
    if (typeof out === 'string') return fail(out);
    fields[name] = out.value;
  }
  for (const name of Object.keys(raw)) {
    if (name !== 'kind' && !Object.hasOwn(shape, name)) return fail(`${name} is not a field of this message`);
  }
  return { ok: true, fields };
}

const PHONE_SHAPES: Record<PhoneMessage['kind'], Shape> = {
  hello: { v: number(0, 1e6), motion: boolean },
  down: {},
  move: { x: share, y: share, aspect: number(0, MAX_ASPECT, true) },
  up: {},
  tilt: { g: number(-MAX_TILT, MAX_TILT) },
  flick: { peak: number(0, MAX_PEAK) },
};

const PICTURE_SHAPE: Shape = {
  phase: oneOf(PHASES),
  zone: share,
  width: share,
  fishAt: share,
  meter: share,
  tension: share,
  reeling: boolean,
  biting: boolean,
  pulse: share,
  words: oneOf(PICTURE_WORDS),
  button: oneOf(BUTTONS),
};

const isObject = (raw: unknown): raw is Raw => typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** The kind a message says, or the reason it says none. */
function kindOf(raw: unknown, known: readonly string[]): { kind: string } | { why: string } {
  if (!isObject(raw)) return { why: 'a message is not an object' };
  if (typeof raw.kind !== 'string') return { why: 'kind is missing' };
  if (!known.includes(raw.kind)) return { why: `kind ${JSON.stringify(raw.kind)} is not known` };
  return { kind: raw.kind };
}

/** What the phone sent, or why it is refused. */
export function parsePhoneMessage(raw: unknown): Parsed<PhoneMessage> {
  const k = kindOf(raw, Object.keys(PHONE_SHAPES));
  if ('why' in k) return fail(k.why);
  const got = read(raw as Raw, PHONE_SHAPES[k.kind as PhoneMessage['kind']]);
  if (!got.ok) return got;
  if (k.kind === 'hello' && got.fields.v !== PROTOCOL_VERSION) {
    return fail(`version ${String(got.fields.v)} is not known (this is ${PROTOCOL_VERSION})`);
  }
  return { ok: true, message: { kind: k.kind, ...got.fields } as PhoneMessage };
}

/** What the screen sent, or why it is refused. */
export function parseScreenMessage(raw: unknown): Parsed<ScreenMessage> {
  const k = kindOf(raw, ['state', 'buzz', 'busy']);
  if ('why' in k) return fail(k.why);
  const body = raw as Raw;
  if (k.kind !== 'state') {
    const got = read(body, {});
    return got.ok ? { ok: true, message: { kind: k.kind } as ScreenMessage } : got;
  }
  const got = read(body, {
    word: oneOf(WORDS),
    picture: (value) => (isObject(value) ? { value } : 'picture is not an object'),
  });
  if (!got.ok) return got;
  const picture = read(got.fields.picture as Raw, PICTURE_SHAPE);
  if (!picture.ok) return fail(`picture: ${picture.why}`);
  return {
    ok: true,
    message: { kind: 'state', word: got.fields.word as Word, picture: picture.fields as unknown as FightPicture },
  };
}
