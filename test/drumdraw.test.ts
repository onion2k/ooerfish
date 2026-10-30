/** The drums as they are drawn: built once, painted, on the bed where the game says, and gone when hauled. */
import { describe, expect, it } from 'vitest';
import { DrumDraw, bankSpot, drumParts } from '../src/drumdraw';
import { BedFinds, places } from '../src/bedfinds';
import { HOME } from '../src/lakes';
import { DRUM_RULES } from '../src/rules';
import { PALETTE } from '../src/palette';

/** The bank the bed's things are measured from (the angler stood there until C5; now it is the lake's own `from`). */
const FROM = { x: HOME.from[0], y: HOME.from[1] };
const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const CABIN = HOME.cabin!.spec;
const bareGround = HOME.bareGround;
const bedDepth = HOME.bedDepth;
const cabinGap = HOME.cabin!.gap;
const inside = HOME.inside;
const jettyGap = HOME.jetty!.gap;

const drums = () => new BedFinds(places(DRUMS, { inside, bedDepth, from: [FROM.x, FROM.y] }));

describe('the drum’s parts', () => {
  it('is painted on the body, a few dozen triangles in all, standing on the ground it is placed at', () => {
    const { body, bands, atom } = drumParts(HOME);
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
    const a = drumParts(HOME),
      b = drumParts(HOME);
    expect(Array.from(a.body.positions)).toEqual(Array.from(b.body.positions));
    expect(Array.from(a.atom.positions)).toEqual(Array.from(b.atom.positions));
  });
});

describe('the drums drawn', () => {
  it('is three groups, a yellow drum, its bands and its black atom, one placement a drum on the bed', () => {
    const d = drums();
    const groups = new DrumDraw(HOME).groups(d);
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
    const draw = new DrumDraw(HOME);
    d.find(0);
    const groups = draw.groups(d);
    for (const g of groups) {
      expect(g.count).toBe(DRUMS.count - 1);
      expect(g.matrices[12]).toBeCloseTo(d.x[1], 5);
      expect(g.matrices[13]).toBeCloseTo(d.y[1], 5);
    }
    d.find(1);
    for (const g of draw.groups(d)) expect(g.count).toBe(0);
  });

  it('builds its meshes once however often it is handed over, and writes into pools sized once', () => {
    const d = drums();
    const draw = new DrumDraw(HOME);
    const first = draw.groups(d);
    d.find(0);
    const second = draw.groups(d);
    expect(second[0].mesh).toBe(first[0].mesh);
    expect(second[0].matrices).toBe(first[0].matrices);
  });
});

describe('the drums hauled, standing on the bank by the cabin', () => {
  it('has a spot on the bank for each drum, on dry ground clear of the cabin’s roof and the jetty, and apart', () => {
    const spots = Array.from({ length: DRUMS.count }, (_, i) => bankSpot(i, HOME));
    for (const [x, y, z] of spots) {
      expect(inside(x, y), 'not in the water').toBe(false);
      expect(cabinGap(x, y), 'beside the cabin, not under its roof').toBeGreaterThan(DRUMS.radius);
      expect(cabinGap(x, y), 'close by it').toBeLessThan(12);
      expect(jettyGap(x, y), 'off the jetty').toBeGreaterThan(DRUMS.radius);
      expect(z, 'standing on the ground there, a little sunk').toBeLessThanOrEqual(bareGround(x, y));
      expect(z).toBeGreaterThan(bareGround(x, y) - 0.5);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(2 * DRUMS.radius);
    expect(CABIN.body.along, 'the cabin is a real size').toBeGreaterThan(0);
  });

  it('draws none with none hauled, and a hauled drum at its own spot, the rest packed from the first', () => {
    const d = drums();
    const draw = new DrumDraw(HOME);
    for (const g of draw.bank(d)) expect(g.count).toBe(0);
    d.find(1);
    const one = draw.bank(d);
    expect(one).toHaveLength(3);
    expect(one.map((g) => g.albedo)).toEqual([PALETTE.drum, PALETTE.drumBand, PALETTE.drumAtom]);
    for (const g of one) {
      expect(g.count).toBe(1);
      expect(g.matrices[12]).toBeCloseTo(bankSpot(1, HOME)[0], 5);
      expect(g.matrices[13]).toBeCloseTo(bankSpot(1, HOME)[1], 5);
      expect(g.matrices[14]).toBeCloseTo(bankSpot(1, HOME)[2], 5);
    }
    d.find(0);
    for (const g of draw.bank(d)) expect(g.count).toBe(2);
  });

  it('never draws a drum on the bed and on the bank at once', () => {
    const d = drums();
    const draw = new DrumDraw(HOME);
    d.find(0);
    const bed = draw.groups(d)[0]?.count ?? 0;
    const bank = draw.bank(d)[0]?.count ?? 0;
    expect(bed + bank).toBe(DRUMS.count);
  });

  it('shares its meshes with the drums on the bed, and writes into pools sized once', () => {
    const d = drums();
    const draw = new DrumDraw(HOME);
    const bed = draw.groups(d);
    d.find(0);
    const a = draw.bank(d),
      b = draw.bank(d);
    expect(a[0].mesh).toBe(bed[0].mesh);
    expect(b[0].matrices).toBe(a[0].matrices);
  });
});
