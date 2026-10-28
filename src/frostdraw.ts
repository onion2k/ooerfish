/**
 * The lace of frost at a clean lake's edge in winter (`docs/winter.md`, part 2): one thin ring sheet on the bank from
 * `FROST.inner` to `FROST.outer` of the shore's distance, a little above the ground, in the frost's colour and unlit
 * as the moon is, so it reads at night too. It is one moving group in the dynamic set, scaled to nothing unless the
 * season is winter and the lake is clean; the matrix is sized once and written into, and the page hands the group over
 * only when `show` says it changed, as the water's shown dirt or the season moves.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import type { Mesh } from 'artshape-render/mesh/types';
import { FROST, type Season } from './lake';
import type { Lake } from './lakes/lake';
import { sheet } from './meshes';
import { PALETTE } from './palette';
import { ringOn } from './scene';

const meshes = new WeakMap<Lake, Mesh>();

/** The ring for a lake, made once: on `ringOn`'s waterline, each vertex just above the bank's own ground. */
export function frostMesh(lake: Lake): Mesh {
  let mesh = meshes.get(lake);
  if (!mesh) {
    mesh = sheet(
      ringOn(lake),
      (x, y) => lake.groundUnder(x, y) + FROST.lift,
      FROST.inner,
      FROST.outer,
      FROST.rings,
      FROST.segments,
    );
    meshes.set(lake, mesh);
  }
  return mesh;
}

export class FrostDraw {
  private readonly mesh: Mesh;
  private readonly matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  private readonly pattern = new Float32Array(PATTERN_STRIDE);
  private drawn = false;
  /** How many times the group has been asked for, which is how many times the page handed it over. */
  handovers = 0;

  constructor(lake: Lake) {
    this.mesh = frostMesh(lake);
    packFlow(this.pattern, 0, { kind: FLOW_GLOW, scale: 0, speed: 0, glow: FROST.glow, second: PALETTE.frost });
    this.write(false);
  }

  private write(on: boolean) {
    const k = on ? 1 : 0;
    this.matrix[0] = k;
    this.matrix[5] = k;
    this.matrix[10] = k;
    this.drawn = on;
  }

  /** The frost shown for that season and state of the lake, or scaled to nothing; whether that was a change. */
  show(season: Season, clean: boolean): boolean {
    const on = season === 'winter' && clean;
    if (on === this.drawn) return false;
    this.write(on);
    return true;
  }

  /** The one group, over the matrix as `show` last wrote it. */
  groups(): GameGroup[] {
    this.handovers++;
    return [
      { mesh: this.mesh, matrices: this.matrix, count: 1, albedo: PALETTE.frost, roughness: 1, patterns: this.pattern },
    ];
  }

  /** Whether the frost was last written on, and so is on the bank. */
  shown(): boolean {
    return this.drawn;
  }
}
