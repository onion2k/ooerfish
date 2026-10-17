/**
 * The balance tool's sums, apart from the runner so that they can be tested without printing anything: a careful hand
 * a reaction late, one fight played to its end, a cell of many fights, the whole table, and the table held to a
 * baseline. Left in among the runner they would only ever be tried by running it, and a tool that cannot be seen to
 * fail looks the same from there as one that is right.
 *
 * The same seeds give the same numbers, so a baseline is held exactly, counts and medians both: a median to the tenth
 * of a second it is written to. There is no tolerance to hide a moved figure in; a change to the fight is meant to
 * move it, and is written again through /gate-moved.
 */
import { careful } from '../src/angler';
import { drawTemper, fightFor, type Temper } from '../src/fight';
import { Line } from '../src/line';
import { seeded, type Random } from '../src/random';

const DT = 1 / 60;
/** The lake's sickness the fights are played in, half-sick, as the figures in docs/fight2.md were measured. */
export const HOT = 0.5;
/** How far from where it will be landed the fish is hooked, in world units. */
export const OUT = 20;
/** A fight that has gone on this long is counted as capped, not landed or slipped. */
export const CAP_SECONDS = 120;
/** The hand's reactions in frames of a sixtieth: 0.15, 0.25, 0.4 and 0.6 s. */
export const REACTIONS = [9, 15, 24, 36] as const;
/** A fish's size as a band of heft: the least, the middle and the most it weighs for its kind. */
export const BANDS = [
  { name: 'light', lo: 0, hi: 0.33 },
  { name: 'middle', lo: 0.33, hi: 0.66 },
  { name: 'heavy', lo: 0.66, hi: 1 },
] as const;
/** The gear the hand has. Only none now; the gifts add their levels here, and every cell is played at each. */
export const GEARS = ['none'] as const;
/**
 * How many fights a cell plays in the check: a fight is 0.1% of a rate. The table takes about 0.9 s, so six gear
 * levels would still take about five.
 */
export const FIGHTS = 1000;

export type Gear = (typeof GEARS)[number];
export type BandName = (typeof BANDS)[number]['name'];
export interface Cell {
  gear: Gear;
  reaction: number;
  band: BandName;
}
export interface Result {
  fights: number;
  landed: number;
  /** The median seconds of the landed fights, to a tenth, or null where none landed. */
  median: number | null;
}
export type Table = Record<string, Result>;

export const cellKey = (c: Cell) => `${c.gear}/${c.reaction}/${c.band}`;

export function medianOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

/**
 * What a player sees of the fish on the bar, a reaction late: the value exactly `reaction` frames back, and the
 * present one until that many have passed, as the angler's own buffer does. The ring is sized once.
 */
export class DelayedHand {
  readonly ring: Float64Array;
  private n = 0;
  constructor(private readonly reaction: number) {
    this.ring = new Float64Array(reaction + 1);
  }
  push(fishAt: number) {
    this.ring[this.n++ % this.ring.length] = fishAt;
  }
  seen(): number {
    const latest = this.ring[(this.n - 1) % this.ring.length];
    return this.n > this.reaction ? this.ring[(this.n - 1 - this.reaction) % this.ring.length] : latest;
  }
  reset() {
    this.n = 0;
  }
}

export interface FightOptions {
  reaction: number;
  heft: number;
  /** The fish's temper; steady unless a test asks otherwise, since a fight with none given draws one as the game does. */
  temper?: Temper;
  /** What the hand does for the line and the fish it sees; the careful hand unless a test asks otherwise. */
  hand?: (line: Line, seen: number) => boolean;
  capSeconds?: number;
}
export interface FightResult {
  result: 'landed' | 'slipped' | 'capped';
  seconds: number;
}

/** One fight played to its end, or to the cap, with the real `Line` and a hand. */
export function playFight(random: Random, o: FightOptions): FightResult {
  const line = new Line();
  const delayed = new DelayedHand(o.reaction);
  const hand = o.hand ?? ((l: Line, seen: number) => careful(l.zone, l.zoneSpeed, seen));
  // the temper is drawn here, one draw after the heft and before the line's own, as the game's hook does
  line.start(OUT, fightFor(o.heft, o.temper ?? drawTemper(random)), random);
  const frames = Math.round((o.capSeconds ?? CAP_SECONDS) / DT);
  for (let f = 1; f <= frames; f++) {
    delayed.push(line.fishAt);
    const r = line.step(DT, hand(line, delayed.seen()), HOT, random);
    if (r !== 'fighting') return { result: r, seconds: f * DT };
  }
  return { result: 'capped', seconds: frames * DT };
}

/** A fight's seed from its own index, reaction and band, so no cell's fights are another's and one more changes none. */
export function fightSeed(index: number, reaction: number, band: BandName): number {
  const b = BANDS.findIndex((x) => x.name === band);
  return index * 7919 + reaction * 104729 + b * 1299709 + 17;
}

/** The tempers' table: one cell per temper and size, at the 0.25 s hand and no gear, each played over its own seeds. */
export const TEMPER_REACTION = 15;
export const TEMPER_NAMES: readonly Temper[] = ['calm', 'steady', 'feisty'];

export interface CellOptions {
  /** A temper to give every fight in the cell, instead of drawing one as the game does. */
  temper?: Temper;
  /** Overrides, for the faults put there on purpose; none in the check. */
  reaction?: number;
  hand?: FightOptions['hand'];
}

/** A cell's fights: the heft drawn in the band from the fight's own seed, then the fight from the same stream. */
export function playCell(cell: Cell, fights: number, o: CellOptions = {}): Result {
  const band = BANDS.find((b) => b.name === cell.band)!;
  const times: number[] = [];
  for (let i = 0; i < fights; i++) {
    const random = seeded(fightSeed(i, cell.reaction, cell.band));
    const heft = band.lo + random() * (band.hi - band.lo);
    const r = playFight(random, { reaction: o.reaction ?? cell.reaction, heft, hand: o.hand, temper: o.temper });
    if (r.result === 'landed') times.push(r.seconds);
  }
  const m = medianOf(times);
  return { fights, landed: times.length, median: m === null ? null : Math.round(m * 10) / 10 };
}

export function playTable(fights = FIGHTS, gears: readonly Gear[] = GEARS): Table {
  const table: Table = {};
  for (const gear of gears)
    for (const reaction of REACTIONS)
      for (const band of BANDS) {
        const cell = { gear, reaction, band: band.name };
        table[cellKey(cell)] = playCell(cell, fights);
      }
  return table;
}

/** The cells that differ from the baseline, each named with both figures; none if they agree exactly. */
export function compareTables(baseline: Table, now: Table): string[] {
  const out: string[] = [];
  const show = (r: Result) => `${r.landed}/${r.fights} landed, median ${r.median === null ? 'none' : `${r.median} s`}`;
  for (const key of Object.keys(baseline)) {
    const was = baseline[key];
    const is = now[key] as Result | undefined;
    if (!is) out.push(`${key}: missing (was ${show(was)})`);
    else if (was.fights !== is.fights || was.landed !== is.landed || was.median !== is.median)
      out.push(`${key}: ${show(was)} -> ${show(is)}`);
  }
  for (const key of Object.keys(now))
    if (!(baseline[key] as Result | undefined)) out.push(`${key}: new (${show(now[key])})`);
  return out;
}

/** The table as the spec's: a row a reaction (and gear), a column a size, each "rate, median". */
export function formatTable(table: Table): string {
  const lines: string[] = [];
  lines.push(['gear', 'reaction', ...BANDS.map((b) => b.name.padEnd(16))].join('  '));
  for (const gear of GEARS)
    for (const reaction of REACTIONS) {
      const cells = BANDS.map((band) => {
        const r = table[cellKey({ gear, reaction, band: band.name })] as Result | undefined;
        if (!r) return 'n/a'.padEnd(16);
        const rate = Math.round((100 * r.landed) / r.fights);
        return `${rate}%, ${r.median === null ? '-' : `${r.median.toFixed(1)} s`}`.padEnd(16);
      });
      lines.push([gear.padEnd(4), `${(reaction / 60).toFixed(2)} s`.padEnd(8), ...cells].join('  '));
    }
  return lines.join('\n');
}

/** The temper table: the rate and median of each temper at each size, played with that temper given to every fight. */
export function playTemperTable(fights = FIGHTS): Table {
  const table: Table = {};
  for (const temper of TEMPER_NAMES)
    for (const band of BANDS) {
      const cell = { gear: 'none' as Gear, reaction: TEMPER_REACTION, band: band.name };
      table[`${temper}/${band.name}`] = playCell(cell, fights, { temper });
    }
  return table;
}

/** The temper table: a row a temper, a column a size, each "rate, median". */
export function formatTemperTable(table: Table): string {
  const lines = [['temper'.padEnd(7), ...BANDS.map((b) => b.name.padEnd(16))].join('  ')];
  for (const temper of TEMPER_NAMES) {
    const cells = BANDS.map((band) => {
      const r = table[`${temper}/${band.name}`];
      return `${Math.round((100 * r.landed) / r.fights)}%, ${r.median === null ? '-' : `${r.median.toFixed(1)} s`}`.padEnd(
        16,
      );
    });
    lines.push([temper.padEnd(7), ...cells].join('  '));
  }
  return lines.join('\n');
}
