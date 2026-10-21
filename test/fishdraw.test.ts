/**
 * The fish as they are drawn: a chain of glowing segments each, placed along the spine the school's stroke poses,
 * under the water. Without these a segment could be drawn adrift of the one before it, a fin left behind its body, or
 * a landed fish hung the wrong way up.
 */
import { FLOW_GLOW } from 'artshape-render/game/flow';
import { PATTERN_STRIDE } from 'artshape-render/game/renderer';
import { describe, expect, it } from 'vitest';
import { HOME } from '../src/lakes';
import { FISH_CAPACITY, KINDS, SWIM } from '../src/lake';
import { CURED_GLOW, FISH_BODY, FISH_PARTS, FishDraw } from '../src/fishdraw';
import { fin, loft } from '../src/meshes';
import { PALETTE } from '../src/palette';
import { bodyLength } from '../src/swim';
import { newGame, settle } from './helpers';

const FISH_KINDS = HOME.fishKinds;

const SEGS = SWIM.segments.length;
/** The placement of fish `i` in part `p`'s group: its translation and its own x, the way its front faces. */
function placed(draw: FishDraw, p: number, i: number) {
  const m = draw.matrices[p].subarray(i * 16, i * 16 + 16);
  return { at: [m[12], m[13], m[14]], x: [m[0], m[1], m[2]], y: [m[4], m[5], m[6]], z: [m[8], m[9], m[10]] };
}

describe('the fish, drawn', () => {
  it('are a group of glowing meshes for each part, each sized once at the most a lake holds', () => {
    const draw = new FishDraw();
    const groups = draw.groups(new Uint8Array(FISH_CAPACITY));
    expect(groups.length).toBe(FISH_PARTS.length);
    expect(FISH_PARTS).toEqual(['head', 'body', 'body', 'stalk', 'tail', 'dorsal']);
    for (const g of groups) {
      expect(g.matrices.length).toBe(FISH_CAPACITY * 16);
      expect(g.count).toBe(0);
      expect(g.patterns?.[0]).toBe(FLOW_GLOW);
      expect(g.patterns?.[3], 'how brightly they glow').toBeGreaterThan(0);
    }
  });

  it('is as long as it was, and as wide and as deep', () => {
    expect(bodyLength(SWIM)).toBeCloseTo(FISH_BODY.length, 6);
    expect(Math.max(...SWIM.segments.map((s) => s[1])) * 2).toBeCloseTo(FISH_BODY.width, 6);
    expect(Math.max(...SWIM.segments.map((s) => s[2])) * 2).toBeCloseTo(FISH_BODY.height, 6);
  });

  it('places each fish’s head where the school is, nose the way it swims, each segment joined to the one before', () => {
    const { game } = newGame(2);
    settle(game, 300);
    const draw = new FishDraw();
    expect(draw.write(game.fish)).toBe(game.fish.count);
    for (let i = 0; i < game.fish.count; i++) {
      const head = placed(draw, 0, i);
      const size = KINDS[game.fish.kind[i]].scale;
      const len = SWIM.segments[0][0]; // the placement's own x is already scaled
      // the head's back, a head's length behind its nose along its own x, is where the school has the fish
      expect(head.at[0] - head.x[0] * len).toBeCloseTo(game.fish.x[i], 5);
      expect(head.at[1] - head.x[1] * len).toBeCloseTo(game.fish.y[i], 5);
      const off = Math.atan2(head.x[1], head.x[0]) - game.fish.heading[i];
      expect(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))), 'the head along the heading').toBeLessThan(0.35);
      for (let p = 0; p < SEGS - 1; p++) {
        const a = placed(draw, p, i),
          b = placed(draw, p + 1, i);
        for (let c = 0; c < 3; c++)
          expect(b.at[c], `fish ${i}, part ${p + 1} joined to ${p}`).toBeCloseTo(
            a.at[c] - a.x[c] * SWIM.segments[p][0],
            4,
          );
      }
      const stalk = placed(draw, SEGS - 1, i),
        tail = placed(draw, SEGS, i);
      for (let c = 0; c < 3; c++)
        expect(tail.at[c]).toBeCloseTo(stalk.at[c] - stalk.x[c] * SWIM.segments[SEGS - 1][0], 4);
      // the dorsal fin rides the first body segment
      expect(Array.from(draw.matrices[SEGS + 1].subarray(i * 16, i * 16 + 16))).toEqual(
        Array.from(draw.matrices[1].subarray(i * 16, i * 16 + 16)),
      );
      // each placement is a turn stretched evenly by its kind's scale: the meshes are built at the shape's own size
      expect(Math.hypot(...head.x)).toBeCloseTo(size, 5);
      expect(Math.hypot(...head.z)).toBeCloseTo(size, 5);
      expect(head.z[2], 'its back up').toBeGreaterThan(0.8);
    }
  });

  it('hangs the fish it is told to nose up from the line’s end, flapping, and the rest where the school is', () => {
    const { game } = newGame(2);
    settle(game, 60);
    const draw = new FishDraw();
    const end: [number, number, number] = [3, -20, 4];
    const hang = [end[0], end[1], end[2] - FISH_BODY.length / 2];
    const tails: number[] = [];
    for (const t of [0, 0.2, 0.4]) {
      expect(draw.write(game.fish, 1, hang, t)).toBe(game.fish.count);
      const head = placed(draw, 0, 1);
      expect(head.at[2], 'its nose at the line’s end').toBeCloseTo(end[2], 1);
      expect(head.x[2] / KINDS[game.fish.kind[1]].scale, 'nose up').toBeGreaterThan(0.95);
      tails.push(placed(draw, SEGS, 1).at[0]);
    }
    expect(new Set(tails.map((x) => x.toFixed(4))).size, 'it flaps').toBeGreaterThan(1);
    expect(placed(draw, 0, 0).at[2]).toBeLessThan(0);
  });
});

describe('the meshes a fish is made of', () => {
  /** Every triangle's normal, and its middle. */
  function faces(m: { positions: Float32Array; indices: Uint32Array }) {
    const out: { n: number[]; c: number[] }[] = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      const p = [0, 1, 2].map((k) => Array.from(m.positions.subarray(m.indices[t + k] * 3, m.indices[t + k] * 3 + 3)));
      const u = p[1].map((v, c) => v - p[0][c]),
        v = p[2].map((w, c) => w - p[0][c]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      out.push({ n, c: [0, 1, 2].map((c) => (p[0][c] + p[1][c] + p[2][c]) / 3) });
    }
    return out;
  }

  it('a segment is a closed loft from its front at its origin back along its x, every face wound outward', () => {
    const m = loft(0.4, [0.1, 0.12], [0.3, 0.25], 6);
    const xs = Array.from(m.positions).filter((_, k) => k % 3 === 0);
    expect(Math.max(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...xs)).toBeCloseTo(-0.4, 6);
    for (const { n, c } of faces(m)) {
      // outward from the axis, or out of the end it caps
      const out = Math.abs(c[0]) < 1e-6 ? [1, 0, 0] : Math.abs(c[0] + 0.4) < 1e-6 ? [-1, 0, 0] : [0, c[1], c[2]];
      expect(n[0] * out[0] + n[1] * out[1] + n[2] * out[2]).toBeGreaterThan(0);
    }
  });

  it('a fin is seen from either side', () => {
    const m = fin([
      [0, 0, 0],
      [-0.3, 0, 0.2],
      [-0.2, 0, 0],
    ]);
    const ys = faces(m).map((f) => Math.sign(f.n[1]));
    expect(ys).toContain(1);
    expect(ys).toContain(-1);
  });
});

describe('the fish, glowing or cured', () => {
  const none = new Uint8Array(FISH_CAPACITY);
  const colourAt = (g: { materials?: Float32Array }, i: number) => Array.from(g.materials!.subarray(i * 4, i * 4 + 4));
  const flowAt = (g: { patterns?: Float32Array }, i: number) =>
    Array.from(g.patterns!.subarray(i * PATTERN_STRIDE, i * PATTERN_STRIDE + 7));

  it('draws every fish glowing green when none is cured, as before', () => {
    const groups = new FishDraw().groups(none);
    groups.forEach((g, p) => {
      const glow = p >= SEGS ? FISH_BODY.glow * 0.7 : FISH_BODY.glow;
      expect(g.materials!.length).toBe(FISH_CAPACITY * 4);
      expect(g.patterns!.length).toBe(FISH_CAPACITY * PATTERN_STRIDE);
      for (let i = 0; i < FISH_CAPACITY; i++) {
        expect(colourAt(g, i)).toEqual([...PALETTE.glow, 0.6].map(Math.fround));
        expect(flowAt(g, i)).toEqual([FLOW_GLOW, 0, 0, glow, ...PALETTE.glow].map(Math.fround));
      }
    });
  });

  it('draws a cured fish gold in its body and coral in its fins, glowing softly, and the rest as they were', () => {
    const cured = new Uint8Array(FISH_CAPACITY);
    cured[1] = cured[3] = 1;
    const groups = new FishDraw().groups(cured);
    groups.forEach((g, p) => {
      const fin = p >= SEGS;
      for (let i = 0; i < FISH_CAPACITY; i++) {
        if (i === 1 || i === 3) {
          expect(colourAt(g, i)).toEqual([...(fin ? PALETTE.curedFin : PALETTE.cured), 0.45].map(Math.fround));
          expect(flowAt(g, i)).toEqual(
            [FLOW_GLOW, 0, 0, fin ? CURED_GLOW.fin : CURED_GLOW.body, ...PALETTE.curedGlow].map(Math.fround),
          );
        } else {
          expect(colourAt(g, i)).toEqual([...PALETTE.glow, 0.6].map(Math.fround));
          expect(flowAt(g, i)[4]).toBe(Math.fround(PALETTE.glow[0]));
        }
      }
    });
  });

  it('draws every slot in its kind’s glow, in the body and the second light, and a cured one gold whatever its kind', () => {
    const kind = Uint8Array.from({ length: FISH_CAPACITY }, (_, i) => FISH_KINDS[i % FISH_KINDS.length]);
    const cured = new Uint8Array(FISH_CAPACITY);
    cured[0] = cured[1] = cured[2] = 1;
    const groups = new FishDraw().groups(cured, kind);
    groups.forEach((g, p) => {
      const fin = p >= SEGS;
      for (let i = 0; i < FISH_CAPACITY; i++) {
        const glow = PALETTE[KINDS[kind[i]].glow];
        const want = cured[i] ? (fin ? PALETTE.curedFin : PALETTE.cured) : glow;
        expect(colourAt(g, i).slice(0, 3), `slot ${i} part ${p}`).toEqual(Array.from(want).map(Math.fround));
        expect(flowAt(g, i).slice(4), `slot ${i} second light`).toEqual(
          Array.from(cured[i] ? PALETTE.curedGlow : glow).map(Math.fround),
        );
      }
    });
    expect(new Set(KINDS.map((k) => k.glow)).size, 'three different glows').toBe(3);
  });

  it('stretches each fish’s placements by its kind’s scale, and a landed fish hung by it too', () => {
    const { game } = newGame(2);
    settle(game, 50);
    const draw = new FishDraw();
    draw.write(game.fish);
    for (let i = 0; i < game.fish.count; i++) {
      const m = draw.matrices[0].subarray(i * 16, i * 16 + 16);
      expect(Math.hypot(m[0], m[1], m[2]), `fish ${i}`).toBeCloseTo(KINDS[game.fish.kind[i]].scale, 5);
      expect(Math.hypot(m[4], m[5], m[6])).toBeCloseTo(KINDS[game.fish.kind[i]].scale, 5);
      expect(Math.hypot(m[8], m[9], m[10])).toBeCloseTo(KINDS[game.fish.kind[i]].scale, 5);
    }
    const pike = FISH_KINDS.indexOf(2),
      bream = FISH_KINDS.indexOf(0);
    const len = (i: number) => {
      draw.write(game.fish, i, [0, 0, -2]);
      const a = draw.joints.subarray(i * 15, i * 15 + 3),
        b = draw.joints.subarray(i * 15 + 12, i * 15 + 15);
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    };
    expect(len(pike) / len(bream)).toBeCloseTo(1.35 / 0.85, 2);
  });

  it('is written again for a school that changed, by a new set of groups, from meshes made once', () => {
    const draw = new FishDraw();
    const a = draw.groups(none);
    const cured = new Uint8Array(FISH_CAPACITY).fill(1, 0, 2);
    const b = draw.groups(cured);
    expect(b[0].mesh).toBe(a[0].mesh);
    expect(b[0].materials).not.toBe(a[0].materials);
    expect(colourAt(b[0], 0).slice(0, 3)).toEqual(Array.from(PALETTE.cured).map(Math.fround));
    expect(colourAt(a[0], 0).slice(0, 3)).toEqual(Array.from(PALETTE.glow).map(Math.fround));
  });
});
