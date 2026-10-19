/** The drums as they are drawn: built once, painted, on the bed where the game says, and gone when hauled. */
import { describe, expect, it } from 'vitest';
import { DrumDraw, drumParts } from '../src/drumdraw';
import { Drums, drumPlaces } from '../src/drums';
import { ANGLER, DRUMS, bedDepth, inside } from '../src/lake';
import { PALETTE } from '../src/palette';

const drums = () => new Drums(drumPlaces(DRUMS, { inside, bedDepth, from: [ANGLER.x, ANGLER.y] }));

describe('the drum’s parts', () => {
  it('is painted on the body, a few dozen triangles in all, standing on the ground it is placed at', () => {
    const { body, bands, atom } = drumParts();
    expect(body.paint, 'painted').toBeInstanceOf(Float32Array);
    expect(bands.paint).toBeUndefined();
    const triangles = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;
    expect(triangles(body)).toBeGreaterThan(10);
    expect(triangles(body) + triangles(bands) + triangles(atom)).toBeLessThan(200);
    const z = (m: { positions: ArrayLike<number> }) =>
      Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions[i * 3 + 2]);
    expect(Math.min(...z(body))).toBe(0);
    expect(Math.max(...z(body))).toBeCloseTo(DRUMS.height, 6);
    // the atom is on the lid, a hair above it
    expect(Math.min(...z(atom))).toBeGreaterThan(DRUMS.height);
  });

  it('is built the same each time', () => {
    const a = drumParts(),
      b = drumParts();
    expect(Array.from(a.body.positions)).toEqual(Array.from(b.body.positions));
    expect(Array.from(a.atom.positions)).toEqual(Array.from(b.atom.positions));
  });
});

describe('the drums drawn', () => {
  it('is three groups, a yellow drum, its bands and its black atom, one placement a drum on the bed', () => {
    const d = drums();
    const groups = new DrumDraw().groups(d);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.albedo)).toEqual([PALETTE.drum, PALETTE.drumBand, PALETTE.drumAtom]);
    for (const g of groups) {
      expect(g.count).toBe(DRUMS.count);
      expect(g.matrices.length).toBe(DRUMS.count * 16);
    }
    // each stands where the drum lies, a little sunk into the bed under it
    for (let i = 0; i < DRUMS.count; i++) {
      const m = groups[0].matrices;
      expect(m[i * 16 + 12]).toBeCloseTo(d.x[i], 5);
      expect(m[i * 16 + 13]).toBeCloseTo(d.y[i], 5);
      expect(m[i * 16 + 14]).toBeLessThan(-bedDepth(d.x[i], d.y[i]) + 1e-6);
      expect(m[i * 16 + 14]).toBeGreaterThan(-bedDepth(d.x[i], d.y[i]) - 0.5);
    }
  });

  it('draws a hauled drum no more, and packs the rest from the first placement', () => {
    const d = drums();
    const draw = new DrumDraw();
    d.haul(0);
    const groups = draw.groups(d);
    for (const g of groups) {
      expect(g.count).toBe(DRUMS.count - 1);
      expect(g.matrices[12]).toBeCloseTo(d.x[1], 5);
      expect(g.matrices[13]).toBeCloseTo(d.y[1], 5);
    }
    d.haul(1);
    for (const g of draw.groups(d)) expect(g.count).toBe(0);
  });

  it('builds its meshes once however often it is handed over, and writes into pools sized once', () => {
    const d = drums();
    const draw = new DrumDraw();
    const first = draw.groups(d);
    d.haul(0);
    const second = draw.groups(d);
    expect(second[0].mesh).toBe(first[0].mesh);
    expect(second[0].matrices).toBe(first[0].matrices);
  });
});
