/**
 * What a fish's size and temper do to its fight, as plain sums: `fightFor` gives the figures a `Line` plays by, so the
 * line itself has no idea of sizes or tempers and the balance tool plays the very same fights as the game. Without it
 * the figures would be read straight from `FIGHT` and every fish would fight alike. Like `line.ts`, it reads the
 * content tables itself. The gifts the cure count has earned (`gearFor`) are a further argument, and ease the figures
 * they name; the bobber's and the bait's belong to the bite, which asks `windowFor` and `noticeFor`.
 */
import { DRUMS, FIGHT, FISHING, GEAR, SIZE, TEMPERS } from './lake';
import type { Random } from './random';

export type Temper = (typeof TEMPERS)[number]['name'];

/** Every figure a `Line` reads during a fight, and the heft they were made for. */
export interface FightFigures {
  /** The size the figures were made for, from the lightest of its kind (0) to the heaviest (1), for whoever reads it. */
  heft: number;
  /** How fast the fish darts, in bars a second; the least of a dart and the longest it may take, in seconds. */
  dart: number;
  dartLeast: number;
  dartLongest: number;
  /** The lowest the fish darts to. */
  floor: number;
  /** How long it rests between darts, the least and the most, in seconds, and the share a fully sick lake keeps. */
  rest: readonly [number, number];
  sickRest: number;
  /** How fast the meter fills with the fish in the zone and drains with it out, a second. */
  fill: number;
  drain: number;
  /** The zone's height on the bar, and how hard holding pushes it up and how hard it falls when let go. */
  width: number;
  push: number;
  fall: number;
  /** Whether this is a drum of waste's hauling and not a fish's fight: no darts, a steady fill while held, never a slip. */
  drum: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The temper of a fish, by name. */
export const temperNamed = (temper: Temper) => TEMPERS.find((t) => t.name === temper)!;

/** A temper drawn by the odds in `TEMPERS`, with one draw of the chance handed in. */
export function drawTemper(random: Random): Temper {
  const r = random();
  let sum = 0;
  for (const t of TEMPERS) {
    sum += t.odds;
    if (r < sum) return t.name;
  }
  return TEMPERS[TEMPERS.length - 1].name;
}

/** Which gifts are held: a flag for each, by its id in `GEAR`. A small object, so it never grows with the count. */
export type Gear = Readonly<Record<(typeof GEAR)[number]['id'], boolean>>;

/** The gear of a player who has been given nothing. */
export const NO_GEAR: Gear = { line: false, reel: false, rod: false, bobber: false, bait: false };

/** The gifts a count of fish cured has earned, all of them held for good once earned; none for what is not a count. */
export function gearFor(cured: number): Gear {
  const gear = { ...NO_GEAR } as Record<keyof Gear, boolean>;
  for (const g of GEAR) gear[g.id] = cured >= g.at;
  return gear;
}

const gift = <T extends (typeof GEAR)[number]['id']>(id: T) =>
  GEAR.find((g) => g.id === id) as Extract<(typeof GEAR)[number], { id: T }>;

/** How long the strike's window stays open, the bobber's gift lengthening it. */
export const windowFor = (gear: Gear) => FISHING.window * (gear.bobber ? gift('bobber').times : 1);

/** How likely a fish in reach is to notice the lure a second, the bait's gift raising it. */
export const noticeFor = (gear: Gear) => FISHING.notice * (gear.bait ? gift('bait').times : 1);

/** The figures of a fight with a fish of `heft` (from nought to one) and a `temper`, eased by the `gear` held. */
export function fightFor(heft: number, temper: Temper, gear: Gear = NO_GEAR): FightFigures {
  const h = clamp(heft, 0, 1);
  const t = temperNamed(temper);
  const rest = (1 + SIZE.rest * h) * t.rest;
  const width = FIGHT.width + (gear.rod ? gift('rod').plus : 0);
  return {
    heft: h,
    dart: FIGHT.dart * (1 + SIZE.dart * h) * t.dart,
    // a dart is a share of the bar, so it is held below the whole of it
    dartLeast: Math.min(0.9, FIGHT.dartLeast * (1 + SIZE.reach * h) * t.reach),
    dartLongest: FIGHT.dartLongest,
    // the lowest it darts to stands above the zone's top at rest on the bottom of the bar, whatever the zone's width,
    // so a hand that never holds can never have the fish rest in the zone and fill the meter
    floor: width + FIGHT.floor,
    rest: [FIGHT.rest[0] * rest, FIGHT.rest[1] * rest],
    sickRest: FIGHT.sickRest,
    fill: FIGHT.fill * (1 + SIZE.fill * h) * t.fill,
    drain: FIGHT.drain * (gear.line ? gift('line').times : 1),
    width,
    push: FIGHT.push * (gear.reel ? gift('reel').times : 1),
    fall: FIGHT.fall,
    drum: false,
  };
}

/**
 * The profile a drum of waste is hauled by, for the `Line` to play: the fish's base figures (the zone, how the reel
 * pushes it), but no darts, a meter that fills steadily at the drum's own rate while the reel is held and just waits
 * when it is let go, and one that never drains, so a drum never slips. The reel's gift speeds the hauling as it does
 * the zone; the other gifts are for a fish. It draws no chance.
 */
export function drumFight(gear: Gear = NO_GEAR): FightFigures {
  return {
    ...fightFor(0, 'steady', gear),
    dart: 0,
    drain: 0,
    fill: DRUMS.fill * (gear.reel ? gift('reel').times : 1),
    drum: true,
  };
}
