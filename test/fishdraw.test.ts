/** The fish as they are drawn: a glowing mesh each, placed where the school says, under the water. */
import { FLOW_GLOW } from 'artshape-render/game/flow';
import { describe, expect, it } from 'vitest';
import { FISH_CAPACITY } from '../src/lake';
import { FishDraw } from '../src/fishdraw';
import { newGame, settle } from './helpers';

describe('the fish, drawn', () => {
  it('are one group of glowing meshes, sized once at the most a lake holds', () => {
    const draw = new FishDraw();
    const g = draw.group();
    expect(g.matrices.length).toBe(FISH_CAPACITY * 16);
    expect(g.count).toBe(0);
    expect(g.patterns?.[0]).toBe(FLOW_GLOW);
    expect(g.patterns?.[3], 'how brightly they glow').toBeGreaterThan(0);
  });

  it('are placed where the school is, under the water by their depth, heading the way they swim', () => {
    const { game } = newGame(2);
    settle(game, 120);
    const draw = new FishDraw();
    expect(draw.write(game.fish)).toBe(game.fish.count);
    for (let i = 0; i < game.fish.count; i++) {
      const m = draw.matrices.subarray(i * 16, i * 16 + 16);
      expect(m[12]).toBeCloseTo(game.fish.x[i], 5);
      expect(m[13]).toBeCloseTo(game.fish.y[i], 5);
      expect(m[14], 'under the surface').toBeCloseTo(-game.fish.depth[i], 5);
      // the mesh's own x, its nose, along the heading
      expect(Math.atan2(m[1], m[0])).toBeCloseTo(game.fish.heading[i], 5);
    }
  });
});
