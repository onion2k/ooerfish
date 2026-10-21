/**
 * The moon in the night sky, as two discs: a bright one, unlit as the cabin's window is, and one in the night sky's
 * colour slid across it by the phase, so the lit part of the moon is a shape cut by two circles (`docs/moon.md`). Both
 * lie far along `MOON.direction` at `MOON.distance` from the world's origin, not from the camera, so every view and
 * both lakes see the same moon and nothing is written in a frame, and both face back toward the lake. By day, dawn
 * and dusk they are scaled to nothing. The matrices are sized once and written into; the groups are handed over only
 * when the look's name or the phase changes, as `CalendarDraw`'s are when the day does.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import { built, disc } from 'artshape-render/mesh/lowpoly';
import { MOON } from './lake';
import { MOON_COLOUR, type Colour } from './palette';

/** The sides of a disc: enough that four degrees of sky has no corners. */
const SIDES = 24;
/** How much light the moon gives out of itself, and the sky-coloured disc, which must read as the sky and so gives out its own colour at full. */
const MOON_GLOW = 1.6;
const SHADOW_GLOW = 2.4;
/** The shadow is a little wider than the moon, so a new moon has no bright rim, and nearer the lake by a unit, so it is the one seen. */
const SHADOW_WIDER = 1.04;
const NUDGE = 1;

/** A unit disc facing up (local +z), which a placement turns to face the lake. */
function unitDisc() {
  return built((b) => disc(b, (p) => p, SIDES, 1, 0));
}

/**
 * How far across the moon's face, to the viewer's right, the shadow's centre lies at a phase (0 full to 7) for a moon
 * of radius `r`: `r (1 - cos(pi d / 4))` for `d` phases from the new moon, so nought at new (covering), `r` at the
 * quarters (half across) and `2r` at full (clear of the face), growing all the way between. The waxing moon (5 to 7)
 * is lit on the right, so its shadow lies to the left and is negative; the waning moon's is positive.
 */
export function shadowOffset(phase: number, r: number): number {
  const d = Math.abs(phase - MOON.new);
  const across = r * (1 - Math.cos((Math.PI * d) / 4));
  return phase < MOON.new ? across : -across;
}

/** What the night's look gives the moon: the sky's colour where the moon stands, to cut the shadow in. */
export interface NightSky {
  sky: Colour;
}

export class MoonDraw {
  private readonly mesh = unitDisc();
  private readonly moon = new Float32Array(16);
  private readonly shadow = new Float32Array(16);
  private readonly moonPattern = new Float32Array(PATTERN_STRIDE);
  private readonly shadowPattern = new Float32Array(PATTERN_STRIDE);
  private drawn = false;
  /** How many times the groups have been asked for, which is how many times the page handed them over. */
  handovers = 0;

  /**
   * The two groups for that look and phase, written into matrices that are the same each time: scaled to nothing
   * unless `timeName` is `night`.
   */
  groups(timeName: string, phase: number, night: NightSky): GameGroup[] {
    this.handovers++;
    const [sx, sy, sz] = MOON.direction;
    const l = Math.hypot(sx, sy, sz);
    const d: [number, number, number] = [sx / l, sy / l, sz / l];
    // the disc's own right, as the viewer looking along the light sees it, and its own up
    const right = [d[1], -d[0], 0];
    const rl = Math.hypot(right[0], right[1]) || 1;
    right[0] /= rl;
    right[1] /= rl;
    // ... facing back toward the lake: local z is minus the light's way, local x the right, so local y is z x x
    const n = [-d[0], -d[1], -d[2]];
    const y = [n[1] * right[2] - n[2] * right[1], n[2] * right[0] - n[0] * right[2], n[0] * right[1] - n[1] * right[0]];
    this.drawn = timeName === 'night';
    const r = this.drawn ? MOON.radius : 0;
    const across = shadowOffset(phase, MOON.radius);
    const full = phase === MOON.full;
    const frame = (out: Float32Array, scale: number, slide: number, near: number) => {
      const o = [
        d[0] * MOON.distance + right[0] * slide + n[0] * near,
        d[1] * MOON.distance + right[1] * slide + n[1] * near,
        d[2] * MOON.distance + right[2] * slide + n[2] * near,
      ];
      out.set([right[0] * scale, right[1] * scale, right[2] * scale, 0], 0);
      out.set([y[0] * scale, y[1] * scale, y[2] * scale, 0], 4);
      out.set([n[0] * scale, n[1] * scale, n[2] * scale, 0], 8);
      out.set([o[0], o[1], o[2], 1], 12);
    };
    frame(this.moon, r, 0, 0);
    frame(this.shadow, full ? 0 : r * SHADOW_WIDER, across, NUDGE);
    packFlow(this.moonPattern, 0, { kind: FLOW_GLOW, scale: 0, speed: 0, glow: MOON_GLOW, second: MOON_COLOUR });
    packFlow(this.shadowPattern, 0, { kind: FLOW_GLOW, scale: 0, speed: 0, glow: SHADOW_GLOW, second: night.sky });
    return [
      { mesh: this.mesh, matrices: this.moon, count: 1, albedo: MOON_COLOUR, roughness: 1, patterns: this.moonPattern },
      {
        mesh: this.mesh,
        matrices: this.shadow,
        count: 1,
        albedo: night.sky,
        roughness: 1,
        patterns: this.shadowPattern,
      },
    ];
  }

  /** Whether the discs were last written for a night, and so are on the sky. */
  shown(): boolean {
    return this.drawn;
  }
}
