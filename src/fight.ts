/**
 * What a fish's size and temper do to its fight, as plain sums: `fightFor` gives the figures a `Line` plays by, so the
 * line itself has no idea of sizes or tempers and the balance tool plays the very same fights as the game. Without it
 * the figures would be read straight from `FIGHT` and every fish would fight alike. Like `line.ts`, it reads the
 * content tables itself; the gear (part of the plan not built yet) will be a further argument here.
 */
import { FIGHT, SIZE, TEMPERS } from './lake';
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

/** The figures of a fight with a fish of `heft` (from nought to one) and a `temper`. */
export function fightFor(heft: number, temper: Temper): FightFigures {
  const h = clamp(heft, 0, 1);
  const t = temperNamed(temper);
  const rest = (1 + SIZE.rest * h) * t.rest;
  const width = FIGHT.width;
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
    drain: FIGHT.drain,
    width,
    push: FIGHT.push,
    fall: FIGHT.fall,
  };
}
