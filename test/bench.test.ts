/**
 * The bench's arithmetic: how it times a scenario against the reference, how
 * it judges a move, and how it tells that a scenario did what it is named
 * for. The timing itself is tried by running the bench against a frame
 * slowed on purpose; this is the part of it that can be wrong without any
 * run of it showing.
 */
import { describe, expect, it } from 'vitest';
import { AGREE, TOLERANCE, agreed, bestRatio, did, heldToDay, judge, swimming } from '../scripts/benching';
import { Game } from '../src/game';
import { CLOCK } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

describe('the bench', () => {
  it('holds a figure both ways, faster as much as slower', () => {
    expect(judge(1, 1)).toBe('within tolerance');
    expect(judge(1, 1 + TOLERANCE * 0.9)).toBe('within tolerance');
    expect(judge(1, 1 - TOLERANCE * 0.9)).toBe('within tolerance');
    expect(judge(1, 1 + TOLERANCE * 1.1)).toBe('slower');
    expect(judge(1, 1 - TOLERANCE * 1.1)).toBe('faster');
  });

  it('fails a frame made slower however little the frame costs', () => {
    // a frame of the floor at rest is a twenty-thousandth of the reference, and a thousandth of a millisecond:
    // an allowance in milliseconds is one a frame that small can hide in, thirty times over
    expect(judge(0.00005, 0.00025), 'five times slower').toBe('slower');
    expect(judge(0.00005, 0.000065), 'three tenths slower').toBe('slower');
    expect(judge(0.00005, 0.000035), 'three tenths faster').toBe('faster');
  });

  it('judges each run against the reference timed beside it', () => {
    // the machine slows down just after the first reference is timed, and stays slow: every run takes twice as
    // long, and so does every reference after the first. Each run against its own references is a tenth; held to
    // the first reference, as a reference timed once at the start was, every run would read a fifth
    const r = bestRatio(3, fake([10, 20, 20, 20, 20, 20]), fake([2, 2, 2]));
    expect(r.ratio).toBeCloseTo(0.1, 9);
  });

  it('keeps the lowest ratio, so a run held up by something else does not count', () => {
    const r = bestRatio(3, fake([10, 10, 10, 10, 10, 10]), fake([1.5, 1, 3]));
    expect(r.ratio).toBeCloseTo(0.1, 9);
    expect(r.ms).toBeCloseTo(1, 9);
    expect(r.ref).toBe(10);
  });

  it('takes the lower of the two references beside a run, so one held up cannot make a run look fast', () => {
    // one of the references either side of the run was held up, to three times its time, before it or after it:
    // against that one, the run would look a third as long as it was
    for (const refs of [
      [10, 30],
      [30, 10],
    ]) {
      const r = bestRatio(1, fake(refs), fake([1]));
      expect(r.ratio, refs.join(', ')).toBeCloseTo(0.1, 9);
      expect(r.ref, refs.join(', ')).toBe(10);
    }
  });

  it('writes a baseline only from two readings that agree, and writes the middle of them', () => {
    expect(agreed(1, 1)).toBe(1);
    expect(agreed(1, 1 + AGREE * 0.9)).toBeCloseTo(1 + AGREE * 0.45, 9);
    expect(agreed(1 + AGREE * 0.9, 1)).toBeCloseTo(1 + AGREE * 0.45, 9);
    // one of the two taken while the machine was at other work: the baseline that would have been written from it
    // alone failed nine of the next ten runs of the bench, with nothing changed
    expect(agreed(0.0000526, 0.0000613)).toBe(null);
    expect(agreed(1, 1 + AGREE * 1.1)).toBe(null);
    expect(agreed(1 + AGREE * 1.1, 1)).toBe(null);
    // two readings that agree are well inside the tolerance of each other, or the baseline would fail its own check
    expect(AGREE).toBeLessThanOrEqual(TOLERANCE / 2);
  });

  it('says when a scenario did not do what it is named for', () => {
    const rest: [number, number] = [0, 0],
      play: [number, number] = [0.25, 1];
    expect(did({ frames: 1000, busy: 0 }, rest)).toBe(true);
    expect(did({ frames: 1000, busy: 1 }, rest), 'a still lake with one thing moving in it').toBe(false);
    expect(did({ frames: 1000, busy: 0 }, play), 'fish that never swam').toBe(false);
    expect(did({ frames: 1000, busy: 249 }, play)).toBe(false);
    expect(did({ frames: 1000, busy: 250 }, play)).toBe(true);
    expect(did({ frames: 1000, busy: 1000 }, play)).toBe(true);
    expect(did({ frames: 0, busy: 0 }, rest), 'a run of no frames did nothing at all').toBe(false);
  });
});

/** Something timed that takes each of `times` in turn. */
function fake(times: number[]): () => number {
  let k = 0;
  return () => times[k++];
}

describe('whether the school is swimming', () => {
  it('is while any fish moves, and not when none does', () => {
    // a fish that turns about at a wall for a frame stands still in it; the school is not stilled for that
    const school = { count: 3, x: new Float64Array([1, 2, 3]) };
    const busy = swimming(school);
    expect(busy(), 'nothing has moved since it was looked at').toBe(false);
    school.x[2] = 3.1;
    expect(busy(), 'only the last fish moved').toBe(true);
    school.x[0] = 1.1;
    school.x[1] = 2.1;
    school.x[2] = 3.2;
    expect(busy(), 'all moved').toBe(true);
    school.x[1] = 2.2;
    expect(busy(), 'one moved, two stand still').toBe(true);
    expect(busy(), 'none moved').toBe(false);
    // only the fish in the lake count: one beyond the count that moves is not swimming
    const few = swimming({ count: 2, x: school.x });
    school.x[2] = 10;
    expect(few()).toBe(false);
  });
});

describe('a scenario held to the day', () => {
  it('keeps the lab’s fish swimming through what would be a night', () => {
    // the longest scenario runs eleven game minutes, past midnight, and a game left to itself would yawn there and
    // sit in the cabin with its fish stilled: the lever puts the clock back short of midnight, and the lever is never
    // a midnight, so every frame is a frame of fish swimming
    const game = new Game(new Progress(memoryStore()), { random: seeded(1) });
    const hold = heldToDay(game, CLOCK.startsAt);
    const busy = swimming(game.fish);
    let still = 0;
    for (let f = 0; f < 40000; f++) {
      hold();
      game.step(1 / 60);
      if (f > 180 && !busy()) still++;
    }
    expect(game.place).toBe('pond');
    expect(game.day).toBe(1);
    expect(still).toBe(0);
  });
});
