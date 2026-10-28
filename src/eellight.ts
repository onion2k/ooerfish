/**
 * The lamp eel's light (`docs/kinds.md`): at night each uncured eel is one of the renderer's point lights, at the eel and
 * in its glow's colour, so it lights the bed and the weed round it. The lights are made once, a `PointLight` for each
 * slot of the lake that holds an eel, and written into the page's pool each frame it is lit, their positions written
 * into arrays that are already there; nothing is made after the constructor. The page says when it is lit (at the pond,
 * at night, on the full rung), and this knows nothing of the clock, the rung or the renderer.
 */
import type { LightPool, PointLight } from 'artshape-render/game/lights';
import type { School } from './fish';
import { EEL_LIGHT, KIND_INDEX, KINDS } from './lake';
import type { Lake } from './lakes/lake';
import { PALETTE } from './palette';

export class EelLights {
  /** The school slots that hold an eel, and the light each has. */
  private readonly slots: number[];
  private readonly lights: PointLight[];
  /** A light that gives nothing, filling the slots before the eels' (the lamp's, which is out of doors), so a stale one is not lit. */
  private readonly dark: PointLight = { position: [0, 0, 0], radius: 1, colour: [0, 0, 0], intensity: 0 };
  private live = 0;
  private wasLit = false;

  /** `base` is the first pool slot the eels use, after the cabin lamp's. */
  constructor(
    lake: Pick<Lake, 'fishKinds'>,
    private readonly base: number,
  ) {
    this.slots = lake.fishKinds.flatMap((k, i) => (k === KIND_INDEX.eel ? [i] : []));
    const colour = PALETTE[KINDS[KIND_INDEX.eel].glow];
    this.lights = this.slots.map(() => ({
      position: [0, 0, 0],
      radius: EEL_LIGHT.radius,
      colour: [colour[0], colour[1], colour[2]],
      intensity: EEL_LIGHT.intensity,
    }));
  }

  /** How many eels are lit now. */
  get count(): number {
    return this.live;
  }

  /** Whether any eel is lit now. */
  get lit(): boolean {
    return this.live > 0;
  }

  /**
   * Light the uncured eels of `school` in `pool` when `lit`, and none when not. The pool is rewritten from the empty
   * while lit, and emptied once on going dark, never otherwise, so a lamp in the cabin is not touched by a pond's day.
   * Says whether the pool changed, so the page hands it to the renderer then and only then.
   */
  write(school: School, lit: boolean, pool: LightPool): boolean {
    let n = 0;
    if (lit) {
      pool.clear();
      for (let k = 0; k < this.base; k++) pool.set(k, this.dark);
      for (let k = 0; k < this.slots.length; k++) {
        const i = this.slots[k];
        if (i >= school.count || school.cured[i] === 1 || school.kind[i] !== KIND_INDEX.eel) continue;
        const light = this.lights[k];
        light.position[0] = school.x[i];
        light.position[1] = school.y[i];
        light.position[2] = -school.depth[i];
        if (!pool.set(this.base + n, light)) break;
        n++;
      }
      // none to show: the empty pool, as an unlit page has it
      if (n === 0) pool.clear();
    } else if (this.wasLit) pool.clear();
    this.live = n;
    const changed = lit || this.wasLit;
    this.wasLit = n > 0;
    return changed;
  }

  /** The lights made, for the tests to see that a write reuses them. */
  objects(): readonly PointLight[] {
    return this.lights;
  }
}
