/**
 * The fish as they are drawn: a chain of low-poly segments each, head, body, stalk and tail fin, with a fin on its
 * back, glowing in its kind's colour (the glow's green for the perch) with a light of their own (the renderer's `FLOW_GLOW`). Each segment is laid along
 * the spine `swim.ts` poses from the school's stroke, so a fish flexes as it swims and bends into its turns; the
 * renderer has no skinning, and without the chain a fish is one stiff shape sliding through the water. The water is
 * seen through, so they are seen, dimmed and tinted by the water over them.
 *
 * A group a part, each pool sized once at the most a lake holds, written each frame.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import type { School } from './fish';
import { FISH_CAPACITY, KIND_INDEX, KINDS, SWIM, type Kind } from './lake';
import { frame } from './matrix';
import { fin, loft } from './meshes';
import { PALETTE } from './palette';
import { bodyLength, pose, poseFish } from './swim';

/** A fish's length, width and height, in world units, and how brightly its own light glows. */
export const FISH_BODY = { length: 1.7, width: 0.6, height: 0.55, glow: 1.4 } as const;

const SEGS = SWIM.segments.length;
const JOINTS = SEGS + 1;
/** Where the second head is among the parts, and where the fins begin. */
const HEAD2 = SEGS,
  FIN_FROM = SEGS + 1;

/**
 * The parts a fish is drawn in, a group each, in the order of `groups`: its segments nose first, then the second head
 * (scaled to nothing but on the two-headed trout), then its fins. The second head follows the segments, not the first
 * head, so the segments stay one run along the spine; the fins are the parts from `FIN_FROM`, by order.
 */
export const FISH_PARTS: readonly string[] = [
  'head',
  ...Array.from({ length: SEGS - 2 }, () => 'body'),
  'stalk',
  'head2',
  'tail',
  'dorsal',
];
/** The fins glow a little less than the body, so a fish reads as a body with fins and not one shape. */
const FIN_GLOW = 0.7;
/** How brightly a cured fish's own light glows, softer than the green's, on its body and on its fins. */
export const CURED_GLOW = { body: 0.25, fin: 0.12 } as const;
/** A fish's roughness, glowing and cured. */
const ROUGH = { glow: 0.6, cured: 0.45 } as const;

export class FishDraw {
  /** Each part's placements, sixteen floats a fish. */
  readonly matrices: readonly Float32Array[] = FISH_PARTS.map(() => new Float32Array(FISH_CAPACITY * 16));
  /**
   * The matrices of the groups last handed over, in their order: all of the parts, but for the second head when no fish
   * of the school has two, since a group drawn at all costs a draw a frame even when every placement is nothing. The
   * page moves these, one a group; `matrices` stays indexed by part for the writes and the tests.
   */
  drawn: readonly Float32Array[] = this.matrices;
  /** The spine of the fish being written, and of each fish as the last frame posed it, for the test API. */
  readonly joints = new Float64Array(FISH_CAPACITY * JOINTS * 3);
  private readonly spine = new Float64Array(JOINTS * 3);

  /** The parts' meshes, lofted once on the first call, since a re-handover on a cure would only make them again. */
  private meshes: GameGroup['mesh'][] | null = null;

  private parts(): GameGroup['mesh'][] {
    if (this.meshes) return this.meshes;
    const meshes = [];
    let front: readonly [number, number] = SWIM.nose;
    for (const [length, w, h] of SWIM.segments) {
      meshes.push(loft(length, front, [w, h]));
      front = [w, h];
    }
    const { length: tl, span, notch } = SWIM.tail;
    meshes.push(
      fin([
        [0, 0, 0],
        [-tl, 0, span],
        [-tl * (1 - notch), 0, 0],
        [-tl, 0, -span],
      ]),
    );
    const { from, length: dl, height } = SWIM.dorsal;
    const back = SWIM.segments[1][2] * 0.92;
    meshes.push(
      fin([
        [-from, 0, back],
        [-from - dl * 0.35, 0, back + height],
        [-from - dl, 0, back],
      ]),
    );
    // the second head is the first head's mesh, placed beside it
    meshes.splice(HEAD2, 0, meshes[0]);
    this.meshes = meshes;
    return meshes;
  }

  /**
   * The groups, handed to the renderer: their placements written by `write`, as many live as it says. Each fish is
   * glowing green, or, where `cured` is 1, gold in its body and coral in its fins with a softer light; the renderer
   * reads both only when groups are handed over, so they are handed over again when a cure changes `cured`. An uncured
   * fish glows the colour of its kind (`kind` indexes `KINDS`, the glowing perch where none is given), a cured one is
   * gold whatever it was. `glow` scales every light by the season's share (`SEASON_DRESSING`), so the fish read against
   * winter's white; it is a handover's figure like the rest, so the page hands the groups over again when it changes.
   */
  groups(
    cured: Uint8Array,
    kind: Uint8Array = new Uint8Array(FISH_CAPACITY).fill(KIND_INDEX.perch),
    season = 1,
  ): GameGroup[] {
    // the second head is a group only where a fish has two heads: the pond's twelve have none, so they pay no draw for it
    const two = kind.some((k) => (KINDS[k] as Kind).bites === 2);
    const used = this.parts()
      .map((mesh, p) => ({ mesh, p }))
      .filter(({ p }) => two || p !== HEAD2);
    this.drawn = used.map(({ p }) => this.matrices[p]);
    return used.map(({ mesh, p }) => {
      const fin = p >= FIN_FROM;
      const patterns = new Float32Array(FISH_CAPACITY * PATTERN_STRIDE);
      const materials = new Float32Array(FISH_CAPACITY * 4);
      for (let i = 0; i < FISH_CAPACITY; i++) {
        const gold = cured[i] === 1;
        const glow =
          season * (gold ? (fin ? CURED_GLOW.fin : CURED_GLOW.body) : fin ? FISH_BODY.glow * FIN_GLOW : FISH_BODY.glow);
        const glowing = PALETTE[KINDS[kind[i]].glow];
        const colour = gold ? (fin ? PALETTE.curedFin : PALETTE.cured) : glowing;
        packFlow(patterns, i * PATTERN_STRIDE, {
          kind: FLOW_GLOW,
          scale: 0,
          speed: 0,
          glow,
          second: gold ? PALETTE.curedGlow : glowing,
        });
        materials.set([colour[0], colour[1], colour[2], gold ? ROUGH.cured : ROUGH.glow], i * 4);
      }
      return { mesh, matrices: this.matrices[p], count: 0, materials, patterns };
    });
  }

  /**
   * Every fish where it is now, posed by its stroke; but fish `hung`, landed and shown off, hanging nose up with its
   * middle at `at` and flapping by the game's clock `t`. Says how many are placed, which every group draws.
   */
  write(fish: School, hung = -1, at: ArrayLike<number> = [0, 0, 0], t = 0): number {
    const n = Math.min(fish.count, FISH_CAPACITY);
    const j = this.spine;
    for (let i = 0; i < n; i++) {
      const size = KINDS[fish.kind[i]].scale,
        stretch = (KINDS[fish.kind[i]] as Kind).stretch ?? 1;
      if (i === hung)
        pose(
          j,
          SWIM,
          at[0],
          at[1],
          // `at` is the middle of a fish of the shape's own length; a bigger fish's middle hangs lower, so its nose is still at the line's end
          at[2] - (bodyLength(SWIM) * (size * stretch - 1)) / 2,
          fish.heading[i],
          Math.PI / 2,
          0,
          t * SWIM.flap * Math.PI * 2,
          SWIM.flapAmp,
          (bodyLength(SWIM) * size * stretch) / 2,
          size,
          stretch,
        );
      else poseFish(j, SWIM, fish, i, fish.lake.bedDepth, size, stretch);
      this.joints.set(j, i * JOINTS * 3);
      const lx = -Math.sin(fish.heading[i]),
        ly = Math.cos(fish.heading[i]);
      for (let p = 0; p < SEGS; p++) {
        const a = p * 3,
          b = a + 3;
        frame(
          this.matrices[p],
          i,
          j[a],
          j[a + 1],
          j[a + 2],
          j[a] - j[b],
          j[a + 1] - j[b + 1],
          j[a + 2] - j[b + 2],
          lx,
          ly,
          0,
        );
        // the unit axes stretched to the kind's size, so the lofted mesh is that much longer, wider and deeper; along
        // the spine by the kind's stretch as well, so it fills the longer gap between its joints and no more
        const o = i * 16;
        for (let c = 0; c < 12; c++) if (c % 4 !== 3) this.matrices[p][o + c] *= c < 3 ? size * stretch : size;
      }
      this.heads(i, (KINDS[fish.kind[i]] as Kind).bites === 2);
      // the tail fin carries on the stalk's line from its end, and the dorsal rides the first body segment
      const tail = this.matrices[FIN_FROM],
        stalk = this.matrices[SEGS - 1],
        o = i * 16,
        e = SEGS * 3;
      tail.set(stalk.subarray(o, o + 12), o);
      // a fin is the size of the fish and not its length, so the stalk's stretch is taken off its axis
      if (stretch !== 1) for (let c = 0; c < 3; c++) tail[o + c] /= stretch;
      tail[o + 12] = j[e];
      tail[o + 13] = j[e + 1];
      tail[o + 14] = j[e + 2];
      tail[o + 15] = 1;
      this.matrices[FIN_FROM + 1].set(this.matrices[1].subarray(o, o + 16), o);
    }
    return n;
  }

  /**
   * The second head of fish `i`, beside the first: the head's placement turned about the head's up axis, from its neck
   * (its back, where it joins the body), the two turned apart by `SWIM.secondHead`, half each way, and the second
   * moved half a head's width to the left so the two read as two. Scaled to nothing, a zero placement, for a fish that
   * has one head. A taste call for the eye to settle: the angle and the offset are figures in `SWIM`.
   */
  private heads(i: number, two: boolean) {
    const head = this.matrices[0],
      second = this.matrices[HEAD2],
      o = i * 16;
    if (!two) {
      second.fill(0, o, o + 16);
      return;
    }
    second.set(head.subarray(o, o + 16), o);
    this.turn(head, o, -SWIM.secondHead / 2, 0);
    this.turn(second, o, SWIM.secondHead / 2, SWIM.segments[0][1]);
  }

  /** Placement `o` of `m` turned by `angle` about its up axis from its neck, then moved `aside` along its new left. */
  private turn(m: Float32Array, o: number, angle: number, aside: number) {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      len = SWIM.segments[0][0];
    // the neck is a head's length behind the nose (the placement's origin) along its x
    const nx = m[o + 12] - m[o] * len,
      ny = m[o + 13] - m[o + 1] * len,
      nz = m[o + 14] - m[o + 2] * len;
    for (let k = 0; k < 3; k++) {
      const x = m[o + k],
        y = m[o + 4 + k];
      m[o + k] = c * x + s * y;
      m[o + 4 + k] = c * y - s * x;
    }
    m[o + 12] = nx + m[o] * len + m[o + 4] * aside;
    m[o + 13] = ny + m[o + 1] * len + m[o + 5] * aside;
    m[o + 14] = nz + m[o + 2] * len + m[o + 6] * aside;
  }
}
