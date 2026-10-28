/**
 * The sun-shower's rainbow (`docs/weather.md`, part 6): seven thin arcs, red outermost, each one group in a colour of
 * `RAINBOW_COLOURS`, unlit as the moon is. They lie in a plane facing back toward the lake, centred far along
 * `WEATHER.rainbow.direction` at `distance` from the world's origin and not from the camera, so every view and both
 * lakes see the same bow and nothing is written in a frame. They are scaled to nothing except in a shower at the looks
 * `WEATHER.rainbow.at` names. The matrices and patterns are sized once and written into; the groups are handed over only
 * when the look's name or the weather changes, as the moon's are.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import { built, face, round } from 'artshape-render/mesh/lowpoly';
import { WEATHER, type Weather } from './lake';
import { RAINBOW_COLOURS } from './palette';

/** The sides along an arc: enough that ten degrees of sky has no corners. */
const SIDES = 24;
/** How much light a band gives out of itself: its own colour a little over, so it reads against a bright sky. */
const GLOW = 1.2;

/** One band: the upper half of an annulus from `rIn` to `rOut` in the xy plane, facing local +z, which a placement turns to face the lake. */
function arc(rIn: number, rOut: number) {
  return built((b) => {
    const p = (i: number, r: number) => {
      const [x, y] = round(i, SIDES * 2, r, 0);
      return [x, y, 0] as [number, number, number];
    };
    // half the circle's sides, so the arch runs from one end on the horizon's side to the other
    for (let i = 0; i < SIDES; i++) face(b, p(i, rIn), p(i, rOut), p(i + 1, rOut), p(i + 1, rIn));
  });
}

export class RainbowDraw {
  private readonly meshes = RAINBOW_COLOURS.map((_, k) => {
    const out = WEATHER.rainbow.radius - k * WEATHER.rainbow.band;
    return arc(out - WEATHER.rainbow.band, out);
  });
  private readonly matrices = this.meshes.map(() => new Float32Array(16));
  private readonly patterns = this.meshes.map(() => new Float32Array(PATTERN_STRIDE));
  private drawn = false;
  /** How many times the groups have been asked for, which is how many times the page handed them over. */
  handovers = 0;

  /** The seven groups for that look and weather, written into matrices that are the same each time: scaled to nothing unless it is a shower at a look the rainbow is seen at. */
  groups(timeName: string, weather: Weather): GameGroup[] {
    this.handovers++;
    const [sx, sy, sz] = WEATHER.rainbow.direction;
    const l = Math.hypot(sx, sy, sz);
    const d = [sx / l, sy / l, sz / l];
    // the plane's own right, as the viewer looking along the direction sees it, facing back toward the lake: local z is
    // minus the direction, local x the right, so local y is z x x and points up the sky
    const right = [d[1], -d[0], 0];
    const rl = Math.hypot(right[0], right[1]) || 1;
    right[0] /= rl;
    right[1] /= rl;
    const n = [-d[0], -d[1], -d[2]];
    const y = [n[1] * right[2] - n[2] * right[1], n[2] * right[0] - n[0] * right[2], n[0] * right[1] - n[1] * right[0]];
    this.drawn = weather === 'shower' && (WEATHER.rainbow.at as readonly string[]).includes(timeName);
    const k = this.drawn ? 1 : 0;
    return this.meshes.map((mesh, i) => {
      const m = this.matrices[i];
      m.set([right[0] * k, right[1] * k, right[2] * k, 0], 0);
      m.set([y[0] * k, y[1] * k, y[2] * k, 0], 4);
      m.set([n[0] * k, n[1] * k, n[2] * k, 0], 8);
      m.set([d[0] * WEATHER.rainbow.distance, d[1] * WEATHER.rainbow.distance, d[2] * WEATHER.rainbow.distance, 1], 12);
      const colour = RAINBOW_COLOURS[i];
      packFlow(this.patterns[i], 0, { kind: FLOW_GLOW, scale: 0, speed: 0, glow: GLOW, second: colour });
      return {
        mesh,
        matrices: m,
        count: 1,
        albedo: colour,
        roughness: 1,
        patterns: this.patterns[i],
      } satisfies GameGroup;
    });
  }

  /** Whether the bow was last written for a shower at a look it is seen at, and so is on the sky. */
  shown(): boolean {
    return this.drawn;
  }
}
